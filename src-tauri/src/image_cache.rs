//! Disk-backed cache for media server artwork.

use std::{
  collections::HashMap,
  path::{Path, PathBuf},
  sync::Arc,
  time::{SystemTime, UNIX_EPOCH},
};

use futures_util::{stream, StreamExt};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::jellyfin::{
  MediaServerProvider, VideoHome, VideoItemDetail, VideoLibraryPage, VideoLibraryShortcut,
  VideoSearchPage, VideoSeasonEpisodes, VideoShowDetail,
};

pub const IMAGE_CACHE_MAX_BYTES: u64 = 1024 * 1024 * 1024;
pub const IMAGE_CACHE_CONCURRENCY: usize = 6;
pub const IMAGE_CACHE_DOWNLOAD_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(2);

#[derive(Debug, thiserror::Error)]
pub enum ImageCacheError {
  #[error("I/O error: {0}")]
  Io(#[from] std::io::Error),
  #[error("JSON error: {0}")]
  Json(#[from] serde_json::Error),
  #[error("image download failed: {0}")]
  Download(String),
  #[error("system clock is before unix epoch")]
  Clock,
}

#[derive(Debug, Clone)]
pub struct ImageDownload {
  pub bytes: Vec<u8>,
  pub content_type: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ImageCachePartition {
  id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CacheEntry {
  file_name: String,
  size_bytes: u64,
  accessed_at_ms: u128,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct CacheIndex {
  entries: HashMap<String, CacheEntry>,
}

pub struct ImageCache {
  root: PathBuf,
  max_bytes: u64,
  index_lock: Mutex<()>,
}

pub struct ImageCacheState(pub Arc<RwLock<Option<Arc<ImageCache>>>>);

impl ImageCacheState {
  pub fn empty() -> Self {
    Self(Arc::new(RwLock::new(None)))
  }

  pub fn get(&self) -> Option<Arc<ImageCache>> {
    self.0.read().clone()
  }
}

impl ImageCache {
  pub fn new(root: PathBuf) -> Self {
    Self::with_max_bytes(root, IMAGE_CACHE_MAX_BYTES)
  }

  pub fn with_max_bytes(root: PathBuf, max_bytes: u64) -> Self {
    Self {
      root,
      max_bytes,
      index_lock: Mutex::new(()),
    }
  }

  pub fn partition(provider: MediaServerProvider, server_url: &str) -> ImageCachePartition {
    let provider = provider_slug(provider);
    let normalized_url = normalize_server_url(server_url);
    ImageCachePartition {
      id: format!("{provider}-{:016x}", stable_hash(normalized_url.as_bytes())),
    }
  }

  pub async fn resolve_urls<F, Fut>(
    self: &Arc<Self>,
    partition: &ImageCachePartition,
    urls: Vec<String>,
    fetch: F,
  ) -> HashMap<String, String>
  where
    F: Fn(String) -> Fut + Clone,
    Fut: std::future::Future<Output = Result<ImageDownload, ImageCacheError>>,
  {
    stream::iter(urls)
      .map(|url| {
        let cache = self.clone();
        let partition = partition.clone();
        let fetch = fetch.clone();
        async move {
          let resolved = cache
            .resolve_url(&partition, &url, fetch(url.clone()))
            .await
            .unwrap_or_else(|err| {
              log::warn!("Image cache miss fallback for {}: {}", url, err);
              url.clone()
            });
          (url, resolved)
        }
      })
      .buffer_unordered(IMAGE_CACHE_CONCURRENCY)
      .collect()
      .await
  }

  pub async fn resolve_url<Fut>(
    &self,
    partition: &ImageCachePartition,
    remote_url: &str,
    fetch: Fut,
  ) -> Result<String, ImageCacheError>
  where
    Fut: std::future::Future<Output = Result<ImageDownload, ImageCacheError>>,
  {
    if let Some(path) = self.cached_path(partition, remote_url).await? {
      return Ok(path_to_string(&path));
    }

    let download = tokio::time::timeout(IMAGE_CACHE_DOWNLOAD_TIMEOUT, fetch)
      .await
      .map_err(|_| ImageCacheError::Download("download timed out".to_string()))??;

    let path = self.write_download(partition, remote_url, download).await?;
    Ok(path_to_string(&path))
  }

  async fn cached_path(
    &self,
    partition: &ImageCachePartition,
    remote_url: &str,
  ) -> Result<Option<PathBuf>, ImageCacheError> {
    let _guard = self.index_lock.lock().await;
    let mut index = self.load_index(partition).await?;
    let key = cache_key(remote_url);
    let Some(entry) = index.entries.get_mut(&key) else {
      return Ok(None);
    };

    let path = self.partition_dir(partition).join(&entry.file_name);
    if tokio::fs::metadata(&path).await.is_err() {
      index.entries.remove(&key);
      self.save_index(partition, &index).await?;
      return Ok(None);
    }

    entry.accessed_at_ms = now_ms()?;
    self.save_index(partition, &index).await?;
    Ok(Some(path))
  }

  async fn write_download(
    &self,
    partition: &ImageCachePartition,
    remote_url: &str,
    download: ImageDownload,
  ) -> Result<PathBuf, ImageCacheError> {
    let _guard = self.index_lock.lock().await;
    let mut index = self.load_index(partition).await?;
    let partition_dir = self.partition_dir(partition);
    tokio::fs::create_dir_all(&partition_dir).await?;

    let key = cache_key(remote_url);
    let extension = cache_extension(remote_url, download.content_type.as_deref());
    let file_name = format!("{key}.{extension}");
    let path = partition_dir.join(&file_name);
    let size_bytes = download.bytes.len() as u64;
    tokio::fs::write(&path, download.bytes).await?;

    index.entries.insert(
      key,
      CacheEntry {
        file_name,
        size_bytes,
        accessed_at_ms: now_ms()?,
      },
    );
    self.prune(partition, &mut index).await?;
    self.save_index(partition, &index).await?;

    Ok(path)
  }

  async fn prune(
    &self,
    partition: &ImageCachePartition,
    index: &mut CacheIndex,
  ) -> Result<(), ImageCacheError> {
    let partition_dir = self.partition_dir(partition);
    let mut total = 0_u64;
    let mut missing = Vec::new();

    for (key, entry) in &index.entries {
      let path = partition_dir.join(&entry.file_name);
      match tokio::fs::metadata(&path).await {
        Ok(metadata) => total = total.saturating_add(metadata.len()),
        Err(_) => missing.push(key.clone()),
      }
    }

    for key in missing {
      index.entries.remove(&key);
    }

    if total <= self.max_bytes {
      return Ok(());
    }

    let mut entries = index
      .entries
      .iter()
      .map(|(key, entry)| {
        (
          key.clone(),
          entry.file_name.clone(),
          entry.size_bytes,
          entry.accessed_at_ms,
        )
      })
      .collect::<Vec<_>>();
    entries.sort_by_key(|(_, _, _, accessed_at_ms)| *accessed_at_ms);

    for (key, file_name, size_bytes, _) in entries {
      if total <= self.max_bytes {
        break;
      }
      let path = partition_dir.join(file_name);
      if let Err(err) = tokio::fs::remove_file(&path).await {
        if err.kind() != std::io::ErrorKind::NotFound {
          return Err(err.into());
        }
      }
      total = total.saturating_sub(size_bytes);
      index.entries.remove(&key);
    }

    Ok(())
  }

  async fn load_index(
    &self,
    partition: &ImageCachePartition,
  ) -> Result<CacheIndex, ImageCacheError> {
    let path = self.index_path(partition);
    match tokio::fs::read(&path).await {
      Ok(bytes) => Ok(serde_json::from_slice(&bytes)?),
      Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(CacheIndex::default()),
      Err(err) => Err(err.into()),
    }
  }

  async fn save_index(
    &self,
    partition: &ImageCachePartition,
    index: &CacheIndex,
  ) -> Result<(), ImageCacheError> {
    let partition_dir = self.partition_dir(partition);
    tokio::fs::create_dir_all(&partition_dir).await?;
    tokio::fs::write(
      self.index_path(partition),
      serde_json::to_vec_pretty(index)?,
    )
    .await?;
    Ok(())
  }

  fn partition_dir(&self, partition: &ImageCachePartition) -> PathBuf {
    self.root.join("images").join(&partition.id)
  }

  fn index_path(&self, partition: &ImageCachePartition) -> PathBuf {
    self.partition_dir(partition).join("index.json")
  }
}

pub async fn cache_video_home<F, Fut>(
  cache: Arc<ImageCache>,
  partition: &ImageCachePartition,
  mut home: VideoHome,
  fetch: F,
) -> VideoHome
where
  F: Fn(String) -> Fut + Clone,
  Fut: std::future::Future<Output = Result<ImageDownload, ImageCacheError>>,
{
  let resolved = cache
    .resolve_urls(partition, collect_video_home_urls(&home), fetch)
    .await;
  rewrite_video_home_urls(&mut home, &resolved);
  home
}

pub async fn cache_library_shortcuts<F, Fut>(
  cache: Arc<ImageCache>,
  partition: &ImageCachePartition,
  mut shortcuts: Vec<VideoLibraryShortcut>,
  fetch: F,
) -> Vec<VideoLibraryShortcut>
where
  F: Fn(String) -> Fut + Clone,
  Fut: std::future::Future<Output = Result<ImageDownload, ImageCacheError>>,
{
  let urls = shortcuts
    .iter()
    .filter_map(|item| item.artwork_url.clone())
    .collect();
  let resolved = cache.resolve_urls(partition, urls, fetch).await;
  for item in &mut shortcuts {
    rewrite_optional_url(&mut item.artwork_url, &resolved);
  }
  shortcuts
}

pub async fn cache_library_page<F, Fut>(
  cache: Arc<ImageCache>,
  partition: &ImageCachePartition,
  mut page: VideoLibraryPage,
  fetch: F,
) -> VideoLibraryPage
where
  F: Fn(String) -> Fut + Clone,
  Fut: std::future::Future<Output = Result<ImageDownload, ImageCacheError>>,
{
  let urls = page
    .items
    .iter()
    .filter_map(|item| item.artwork_url.clone())
    .collect();
  let resolved = cache.resolve_urls(partition, urls, fetch).await;
  for item in &mut page.items {
    rewrite_optional_url(&mut item.artwork_url, &resolved);
  }
  page
}

pub async fn cache_search_page<F, Fut>(
  cache: Arc<ImageCache>,
  partition: &ImageCachePartition,
  mut page: VideoSearchPage,
  fetch: F,
) -> VideoSearchPage
where
  F: Fn(String) -> Fut + Clone,
  Fut: std::future::Future<Output = Result<ImageDownload, ImageCacheError>>,
{
  let urls = page
    .items
    .iter()
    .filter_map(|item| item.artwork_url.clone())
    .collect();
  let resolved = cache.resolve_urls(partition, urls, fetch).await;
  for item in &mut page.items {
    rewrite_optional_url(&mut item.artwork_url, &resolved);
  }
  page
}

pub async fn cache_item_detail<F, Fut>(
  cache: Arc<ImageCache>,
  partition: &ImageCachePartition,
  mut detail: VideoItemDetail,
  fetch: F,
) -> VideoItemDetail
where
  F: Fn(String) -> Fut + Clone,
  Fut: std::future::Future<Output = Result<ImageDownload, ImageCacheError>>,
{
  let urls = detail.artwork_url.iter().cloned().collect();
  let resolved = cache.resolve_urls(partition, urls, fetch).await;
  rewrite_optional_url(&mut detail.artwork_url, &resolved);
  detail
}

pub async fn cache_show_detail<F, Fut>(
  cache: Arc<ImageCache>,
  partition: &ImageCachePartition,
  mut detail: VideoShowDetail,
  fetch: F,
) -> VideoShowDetail
where
  F: Fn(String) -> Fut + Clone,
  Fut: std::future::Future<Output = Result<ImageDownload, ImageCacheError>>,
{
  let mut urls = Vec::new();
  urls.extend(detail.artwork_url.iter().cloned());
  urls.extend(
    detail
      .next_episode
      .iter()
      .filter_map(|item| item.artwork_url.clone()),
  );
  urls.extend(
    detail
      .seasons
      .iter()
      .filter_map(|season| season.artwork_url.clone()),
  );
  let resolved = cache.resolve_urls(partition, urls, fetch).await;
  rewrite_optional_url(&mut detail.artwork_url, &resolved);
  if let Some(next_episode) = &mut detail.next_episode {
    rewrite_optional_url(&mut next_episode.artwork_url, &resolved);
  }
  for season in &mut detail.seasons {
    rewrite_optional_url(&mut season.artwork_url, &resolved);
  }
  detail
}

pub async fn cache_season_episodes<F, Fut>(
  cache: Arc<ImageCache>,
  partition: &ImageCachePartition,
  mut page: VideoSeasonEpisodes,
  fetch: F,
) -> VideoSeasonEpisodes
where
  F: Fn(String) -> Fut + Clone,
  Fut: std::future::Future<Output = Result<ImageDownload, ImageCacheError>>,
{
  let urls = page
    .episodes
    .iter()
    .filter_map(|item| item.artwork_url.clone())
    .collect();
  let resolved = cache.resolve_urls(partition, urls, fetch).await;
  for episode in &mut page.episodes {
    rewrite_optional_url(&mut episode.artwork_url, &resolved);
  }
  page
}

fn collect_video_home_urls(home: &VideoHome) -> Vec<String> {
  home
    .continue_watching
    .iter()
    .chain(home.next_up.iter())
    .chain(home.latest_movies.iter())
    .chain(home.latest_episodes.iter())
    .filter_map(|item| item.artwork_url.clone())
    .collect()
}

fn rewrite_video_home_urls(home: &mut VideoHome, resolved: &HashMap<String, String>) {
  for item in home
    .continue_watching
    .iter_mut()
    .chain(home.next_up.iter_mut())
    .chain(home.latest_movies.iter_mut())
    .chain(home.latest_episodes.iter_mut())
  {
    rewrite_optional_url(&mut item.artwork_url, resolved);
  }
}

fn rewrite_optional_url(value: &mut Option<String>, resolved: &HashMap<String, String>) {
  let Some(current) = value.as_ref() else {
    return;
  };
  if let Some(next) = resolved.get(current) {
    *value = Some(next.clone());
  }
}

fn provider_slug(provider: MediaServerProvider) -> &'static str {
  match provider {
    MediaServerProvider::Jellyfin => "jellyfin",
    MediaServerProvider::Emby => "emby",
  }
}

fn normalize_server_url(server_url: &str) -> &str {
  server_url.trim_end_matches('/')
}

fn cache_key(remote_url: &str) -> String {
  format!("{:016x}", stable_hash(remote_url.as_bytes()))
}

fn stable_hash(bytes: &[u8]) -> u64 {
  let mut hash = 0xcbf29ce484222325_u64;
  for byte in bytes {
    hash ^= u64::from(*byte);
    hash = hash.wrapping_mul(0x100000001b3);
  }
  hash
}

fn cache_extension(remote_url: &str, content_type: Option<&str>) -> &'static str {
  match content_type.and_then(extension_from_content_type) {
    Some(extension) => extension,
    None => extension_from_url(remote_url).unwrap_or("img"),
  }
}

fn extension_from_content_type(content_type: &str) -> Option<&'static str> {
  let media_type = content_type.split(';').next()?.trim().to_ascii_lowercase();
  match media_type.as_str() {
    "image/jpeg" | "image/jpg" => Some("jpg"),
    "image/png" => Some("png"),
    "image/webp" => Some("webp"),
    "image/gif" => Some("gif"),
    "image/avif" => Some("avif"),
    _ => None,
  }
}

fn extension_from_url(remote_url: &str) -> Option<&'static str> {
  let path = remote_url.split('?').next()?.rsplit('/').next()?;
  let extension = path.rsplit('.').next()?.to_ascii_lowercase();
  match extension.as_str() {
    "jpg" | "jpeg" => Some("jpg"),
    "png" => Some("png"),
    "webp" => Some("webp"),
    "gif" => Some("gif"),
    "avif" => Some("avif"),
    _ => None,
  }
}

fn path_to_string(path: &Path) -> String {
  path.to_string_lossy().into_owned()
}

fn now_ms() -> Result<u128, ImageCacheError> {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis())
    .map_err(|_| ImageCacheError::Clock)
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::sync::atomic::{AtomicUsize, Ordering};
  use uuid::Uuid;

  fn temp_cache_dir() -> PathBuf {
    std::env::temp_dir().join(format!("jellypilot-image-cache-test-{}", Uuid::new_v4()))
  }

  fn partition() -> ImageCachePartition {
    ImageCache::partition(MediaServerProvider::Jellyfin, "https://media.example.com/")
  }

  #[tokio::test]
  async fn partition_ignores_trailing_server_slash() {
    let a = ImageCache::partition(MediaServerProvider::Jellyfin, "https://media.example.com");
    let b = ImageCache::partition(MediaServerProvider::Jellyfin, "https://media.example.com/");

    assert_eq!(a.id, b.id);
  }

  #[tokio::test]
  async fn resolve_url_reuses_cached_file_after_first_download() {
    let root = temp_cache_dir();
    let cache = ImageCache::with_max_bytes(root.clone(), 1024 * 1024);
    let calls = Arc::new(AtomicUsize::new(0));
    let calls_for_fetch = calls.clone();

    let first = cache
      .resolve_url(
        &partition(),
        "https://media.example.com/Items/1/Images/Primary?tag=a",
        async move {
          calls_for_fetch.fetch_add(1, Ordering::SeqCst);
          Ok(ImageDownload {
            bytes: b"image".to_vec(),
            content_type: Some("image/png".to_string()),
          })
        },
      )
      .await
      .expect("first image should cache");
    let second = cache
      .resolve_url(
        &partition(),
        "https://media.example.com/Items/1/Images/Primary?tag=a",
        async {
          Ok(ImageDownload {
            bytes: b"changed".to_vec(),
            content_type: Some("image/png".to_string()),
          })
        },
      )
      .await
      .expect("second image should hit cache");

    assert_eq!(first, second);
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    let _ = std::fs::remove_dir_all(root);
  }

  #[tokio::test]
  async fn resolve_url_evicts_least_recently_used_files_over_limit() {
    let root = temp_cache_dir();
    let cache = ImageCache::with_max_bytes(root.clone(), 7);
    let partition = partition();

    let first = cache
      .resolve_url(&partition, "https://media.example.com/a.png?tag=1", async {
        Ok(ImageDownload {
          bytes: b"12345".to_vec(),
          content_type: Some("image/png".to_string()),
        })
      })
      .await
      .expect("first image should cache");
    tokio::time::sleep(std::time::Duration::from_millis(2)).await;
    let second = cache
      .resolve_url(&partition, "https://media.example.com/b.png?tag=2", async {
        Ok(ImageDownload {
          bytes: b"67890".to_vec(),
          content_type: Some("image/png".to_string()),
        })
      })
      .await
      .expect("second image should cache");

    assert!(!Path::new(&first).exists());
    assert!(Path::new(&second).exists());
    let _ = std::fs::remove_dir_all(root);
  }

  #[tokio::test]
  async fn resolve_urls_falls_back_to_remote_url_when_download_fails() {
    let root = temp_cache_dir();
    let cache = Arc::new(ImageCache::with_max_bytes(root.clone(), 1024 * 1024));
    let remote_url = "https://media.example.com/Items/1/Images/Primary?tag=a".to_string();

    let resolved = cache
      .resolve_urls(&partition(), vec![remote_url.clone()], |_| async {
        Err(ImageCacheError::Download("no route".to_string()))
      })
      .await;

    assert_eq!(resolved.get(&remote_url), Some(&remote_url));
    let _ = std::fs::remove_dir_all(root);
  }
}
