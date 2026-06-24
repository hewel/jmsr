//! Disk-backed cache for media server artwork.

use std::{
  collections::HashMap,
  path::{Path, PathBuf},
  sync::Arc,
  time::{SystemTime, UNIX_EPOCH},
};

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tauri::http::{header, Response, StatusCode};
use tokio::sync::Mutex;

use crate::config::AppConfig;
use crate::image_ref::{decode_image_id, normalize_server_url};
use crate::jellyfin::{JellyfinClient, MediaServerProvider};

pub const IMAGE_CACHE_MAX_BYTES: u64 = 1024 * 1024 * 1024;
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImageCachePartition {
  id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CacheEntry {
  file_name: String,
  size_bytes: u64,
  accessed_at_ms: u128,
  #[serde(default)]
  content_type: Option<String>,
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

#[derive(Clone)]
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

  pub async fn resolve_image_download<Fut>(
    &self,
    partition: &ImageCachePartition,
    remote_url: &str,
    fetch: Fut,
  ) -> Result<ImageDownload, ImageCacheError>
  where
    Fut: std::future::Future<Output = Result<ImageDownload, ImageCacheError>>,
  {
    if let Some(path) = self.cached_path(partition, remote_url).await? {
      let bytes = tokio::fs::read(&path).await?;
      return Ok(ImageDownload {
        bytes,
        content_type: content_type_from_path(&path),
      });
    }

    let download = tokio::time::timeout(IMAGE_CACHE_DOWNLOAD_TIMEOUT, fetch)
      .await
      .map_err(|_| ImageCacheError::Download("download timed out".to_string()))??;
    self
      .write_download(partition, remote_url, &download)
      .await?;
    Ok(download)
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
    download: &ImageDownload,
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
    tokio::fs::write(&path, &download.bytes).await?;

    index.entries.insert(
      key,
      CacheEntry {
        file_name,
        size_bytes,
        accessed_at_ms: now_ms()?,
        content_type: download.content_type.clone(),
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

pub async fn image_response_for_token(
  client: Arc<JellyfinClient>,
  config: Arc<RwLock<AppConfig>>,
  image_cache_state: ImageCacheState,
  token: String,
) -> Response<Vec<u8>> {
  let payload = match decode_image_id(&token) {
    Ok(payload) => payload,
    Err(err) => return text_response(StatusCode::BAD_REQUEST, err.to_string()),
  };

  let connection = client.login().connection_state();
  if !connection.connected {
    return text_response(StatusCode::UNAUTHORIZED, "media server is not connected");
  }
  if connection.provider != payload.provider {
    return text_response(StatusCode::FORBIDDEN, "image reference provider mismatch");
  }
  let Some(server_url) = connection.server_url.as_deref() else {
    return text_response(StatusCode::UNAUTHORIZED, "media server URL is unavailable");
  };
  if normalize_server_url(server_url) != normalize_server_url(&payload.server_url) {
    return text_response(StatusCode::FORBIDDEN, "image reference server mismatch");
  }

  let partition = ImageCache::partition(payload.provider, &payload.server_url);
  let disk_cache_enabled = config.read().image_disk_cache_enabled;
  let cache = image_cache_state.get();
  let remote_url = payload.remote_url;
  let fetch_url = remote_url.clone();
  let fetch_client = client.clone();
  let fetch = async move {
    fetch_client
      .download_image(&fetch_url)
      .await
      .map_err(|err| ImageCacheError::Download(err.to_string()))
  };

  let result = if disk_cache_enabled {
    match cache {
      Some(cache) => {
        cache
          .resolve_image_download(&partition, &remote_url, fetch)
          .await
      }
      None => fetch_with_timeout(fetch).await,
    }
  } else {
    fetch_with_timeout(fetch).await
  };

  match result {
    Ok(download) => image_response(&remote_url, download),
    Err(err) => {
      log::warn!("Image protocol request failed for {}: {}", remote_url, err);
      text_response(StatusCode::BAD_GATEWAY, "image request failed")
    }
  }
}

async fn fetch_with_timeout<Fut>(fetch: Fut) -> Result<ImageDownload, ImageCacheError>
where
  Fut: std::future::Future<Output = Result<ImageDownload, ImageCacheError>>,
{
  tokio::time::timeout(IMAGE_CACHE_DOWNLOAD_TIMEOUT, fetch)
    .await
    .map_err(|_| ImageCacheError::Download("download timed out".to_string()))?
}

fn image_response(remote_url: &str, download: ImageDownload) -> Response<Vec<u8>> {
  let content_type = download
    .content_type
    .or_else(|| content_type_from_url(remote_url))
    .unwrap_or_else(|| "application/octet-stream".to_string());
  response_builder(StatusCode::OK)
    .header(header::CONTENT_TYPE, content_type)
    .body(download.bytes)
    .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn text_response(status: StatusCode, message: impl Into<String>) -> Response<Vec<u8>> {
  response_builder(status)
    .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
    .body(message.into().into_bytes())
    .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn response_builder(status: StatusCode) -> tauri::http::response::Builder {
  Response::builder()
    .status(status)
    .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
}

fn provider_slug(provider: MediaServerProvider) -> &'static str {
  match provider {
    MediaServerProvider::Jellyfin => "jellyfin",
    MediaServerProvider::Emby => "emby",
  }
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

fn content_type_from_path(path: &Path) -> Option<String> {
  let extension = path.extension()?.to_str()?.to_ascii_lowercase();
  content_type_from_extension(&extension).map(str::to_string)
}

fn content_type_from_url(remote_url: &str) -> Option<String> {
  let extension = extension_from_url(remote_url)?;
  content_type_from_extension(extension).map(str::to_string)
}

fn content_type_from_extension(extension: &str) -> Option<&'static str> {
  match extension {
    "jpg" | "jpeg" => Some("image/jpeg"),
    "png" => Some("image/png"),
    "webp" => Some("image/webp"),
    "gif" => Some("image/gif"),
    "avif" => Some("image/avif"),
    _ => None,
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
  async fn resolve_image_download_reuses_cached_file_after_first_download() {
    let root = temp_cache_dir();
    let cache = ImageCache::with_max_bytes(root.clone(), 1024 * 1024);
    let calls = Arc::new(AtomicUsize::new(0));
    let calls_for_fetch = calls.clone();

    let first = cache
      .resolve_image_download(
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
      .resolve_image_download(
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

    assert_eq!(first.bytes, b"image");
    assert_eq!(second.bytes, b"image");
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    let _ = std::fs::remove_dir_all(root);
  }

  #[tokio::test]
  async fn resolve_image_download_evicts_least_recently_used_files_over_limit() {
    let root = temp_cache_dir();
    let cache = ImageCache::with_max_bytes(root.clone(), 7);
    let partition = partition();
    let first_url = "https://media.example.com/a.png?tag=1";
    let second_url = "https://media.example.com/b.png?tag=2";

    cache
      .resolve_image_download(&partition, first_url, async {
        Ok(ImageDownload {
          bytes: b"12345".to_vec(),
          content_type: Some("image/png".to_string()),
        })
      })
      .await
      .expect("first image should cache");
    tokio::time::sleep(std::time::Duration::from_millis(2)).await;
    cache
      .resolve_image_download(&partition, second_url, async {
        Ok(ImageDownload {
          bytes: b"67890".to_vec(),
          content_type: Some("image/png".to_string()),
        })
      })
      .await
      .expect("second image should cache");
    let first = cache
      .partition_dir(&partition)
      .join(format!("{}.png", cache_key(first_url)));
    let second = cache
      .partition_dir(&partition)
      .join(format!("{}.png", cache_key(second_url)));

    assert!(!first.exists());
    assert!(second.exists());
    let _ = std::fs::remove_dir_all(root);
  }

  #[tokio::test]
  async fn resolve_image_download_returns_error_when_download_fails() {
    let root = temp_cache_dir();
    let cache = ImageCache::with_max_bytes(root.clone(), 1024 * 1024);
    let remote_url = "https://media.example.com/Items/1/Images/Primary?tag=a".to_string();

    let err = cache
      .resolve_image_download(&partition(), &remote_url, async {
        Err(ImageCacheError::Download("no route".to_string()))
      })
      .await
      .expect_err("failed download should propagate");

    assert_eq!(err.to_string(), "image download failed: no route");
    let _ = std::fs::remove_dir_all(root);
  }
}
