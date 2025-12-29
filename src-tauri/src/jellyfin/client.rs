//! Jellyfin HTTP client for REST API calls.

use parking_lot::RwLock;
use reqwest::{Client, header};
use std::sync::Arc;
use uuid::Uuid;

use super::error::JellyfinError;
use super::types::*;

/// Device info for Jellyfin client identification.
const DEVICE_NAME: &str = "JMSR";
const DEVICE_ID_PREFIX: &str = "jmsr-";
const CLIENT_NAME: &str = "Jellyfin MPV Shim Rust";
const CLIENT_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Jellyfin HTTP API client.
pub struct JellyfinClient {
  http: Client,
  state: Arc<RwLock<ClientState>>,
  device_id: String,
}

/// Internal connection state.
struct ClientState {
  server_url: Option<String>,
  access_token: Option<String>,
  user_id: Option<String>,
  user_name: Option<String>,
  server_name: Option<String>,
}

impl JellyfinClient {
  /// Create a new Jellyfin client.
  pub fn new() -> Self {
    let device_id = format!("{}{}", DEVICE_ID_PREFIX, Uuid::new_v4());

    Self {
      http: Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .expect("Failed to create HTTP client"),
      state: Arc::new(RwLock::new(ClientState {
        server_url: None,
        access_token: None,
        user_id: None,
        user_name: None,
        server_name: None,
      })),
      device_id,
    }
  }

  /// Get the device ID.
  pub fn device_id(&self) -> &str {
    &self.device_id
  }

  /// Build authorization header value.
  fn auth_header(&self, token: Option<&str>) -> String {
    let mut header = format!(
      r#"MediaBrowser Client="{}", Device="{}", DeviceId="{}", Version="{}""#,
      CLIENT_NAME, DEVICE_NAME, self.device_id, CLIENT_VERSION
    );
    if let Some(token) = token {
      header.push_str(&format!(r#", Token="{}""#, token));
    }
    header
  }

  /// Authenticate with Jellyfin server.
  pub async fn authenticate(&self, creds: &Credentials) -> Result<AuthResponse, JellyfinError> {
    // Normalize server URL
    let server_url = creds.server_url.trim_end_matches('/').to_string();

    // Validate URL format
    if !server_url.starts_with("http://") && !server_url.starts_with("https://") {
      return Err(JellyfinError::InvalidUrl(
        "URL must start with http:// or https://".to_string(),
      ));
    }

    let url = format!("{}/Users/AuthenticateByName", server_url);

    let body = serde_json::json!({
      "Username": creds.username,
      "Pw": creds.password
    });

    let response = self
      .http
      .post(&url)
      .header(header::CONTENT_TYPE, "application/json")
      .header("X-Emby-Authorization", self.auth_header(None))
      .json(&body)
      .send()
      .await?;

    if !response.status().is_success() {
      let status = response.status();
      let text = response.text().await.unwrap_or_default();
      return Err(JellyfinError::AuthFailed(format!(
        "HTTP {}: {}",
        status, text
      )));
    }

    let auth: AuthResponse = response.json().await?;

    // Store connection state
    {
      let mut state = self.state.write();
      state.server_url = Some(server_url);
      state.access_token = Some(auth.access_token.clone());
      state.user_id = Some(auth.user.id.clone());
      state.user_name = Some(auth.user.name.clone());
    }

    // Fetch server info
    self.fetch_server_info().await.ok();

    Ok(auth)
  }

  /// Fetch server public info.
  async fn fetch_server_info(&self) -> Result<ServerInfo, JellyfinError> {
    let server_url = self.server_url()?;
    let url = format!("{}/System/Info/Public", server_url);

    let response = self.http.get(&url).send().await?;
    let info: ServerInfo = response.json().await?;

    {
      let mut state = self.state.write();
      state.server_name = Some(info.server_name.clone());
    }

    Ok(info)
  }

  /// Disconnect from server.
  pub fn disconnect(&self) {
    let mut state = self.state.write();
    state.server_url = None;
    state.access_token = None;
    state.user_id = None;
    state.user_name = None;
    state.server_name = None;
  }

  /// Restore a session from saved data.
  ///
  /// Validates the token by making a test API call.
  pub async fn restore_session(&self, session: &SavedSession) -> Result<(), JellyfinError> {
    // Set the state first
    {
      let mut state = self.state.write();
      state.server_url = Some(session.server_url.clone());
      state.access_token = Some(session.access_token.clone());
      state.user_id = Some(session.user_id.clone());
      state.user_name = Some(session.user_name.clone());
      state.server_name = session.server_name.clone();
    }

    // Validate the token by calling /System/Info/Public
    // If this fails, clear the state and return error
    match self.fetch_server_info().await {
      Ok(_) => Ok(()),
      Err(e) => {
        self.disconnect();
        Err(JellyfinError::AuthFailed(format!(
          "Session validation failed: {}",
          e
        )))
      }
    }
  }

  /// Get current session data for persistence.
  pub fn get_saved_session(&self) -> Option<SavedSession> {
    let state = self.state.read();
    if let (Some(server_url), Some(access_token), Some(user_id), Some(user_name)) = (
      state.server_url.clone(),
      state.access_token.clone(),
      state.user_id.clone(),
      state.user_name.clone(),
    ) {
      Some(SavedSession {
        server_url,
        access_token,
        user_id,
        user_name,
        server_name: state.server_name.clone(),
      })
    } else {
      None
    }
  }

  /// Check if connected.
  pub fn is_connected(&self) -> bool {
    let state = self.state.read();
    state.access_token.is_some()
  }

  /// Get current connection state.
  pub fn connection_state(&self) -> ConnectionState {
    let state = self.state.read();
    ConnectionState {
      connected: state.access_token.is_some(),
      server_url: state.server_url.clone(),
      server_name: state.server_name.clone(),
      user_name: state.user_name.clone(),
    }
  }

  /// Get server URL or error if not connected.
  fn server_url(&self) -> Result<String, JellyfinError> {
    self
      .state
      .read()
      .server_url
      .clone()
      .ok_or(JellyfinError::NotConnected)
  }

  /// Get access token or error if not connected.
  fn access_token(&self) -> Result<String, JellyfinError> {
    self
      .state
      .read()
      .access_token
      .clone()
      .ok_or(JellyfinError::NotConnected)
  }

  /// Get user ID or error if not connected.
  pub fn user_id(&self) -> Result<String, JellyfinError> {
    self
      .state
      .read()
      .user_id
      .clone()
      .ok_or(JellyfinError::NotConnected)
  }

  /// Make an authenticated GET request.
  pub async fn get<T: serde::de::DeserializeOwned>(
    &self,
    path: &str,
  ) -> Result<T, JellyfinError> {
    let server_url = self.server_url()?;
    let token = self.access_token()?;
    let url = format!("{}{}", server_url, path);

    let response = self
      .http
      .get(&url)
      .header("X-Emby-Authorization", self.auth_header(Some(&token)))
      .send()
      .await?;

    Ok(response.json().await?)
  }

  /// Make an authenticated POST request.
  pub async fn post<T: serde::de::DeserializeOwned, B: serde::Serialize>(
    &self,
    path: &str,
    body: &B,
  ) -> Result<T, JellyfinError> {
    let server_url = self.server_url()?;
    let token = self.access_token()?;
    let url = format!("{}{}", server_url, path);

    let response = self
      .http
      .post(&url)
      .header(header::CONTENT_TYPE, "application/json")
      .header("X-Emby-Authorization", self.auth_header(Some(&token)))
      .json(body)
      .send()
      .await?;

    Ok(response.json().await?)
  }

  /// Make an authenticated POST request without expecting a response body.
  pub async fn post_empty<B: serde::Serialize>(
    &self,
    path: &str,
    body: &B,
  ) -> Result<(), JellyfinError> {
    let server_url = self.server_url()?;
    let token = self.access_token()?;
    let url = format!("{}{}", server_url, path);

    self
      .http
      .post(&url)
      .header(header::CONTENT_TYPE, "application/json")
      .header("X-Emby-Authorization", self.auth_header(Some(&token)))
      .json(body)
      .send()
      .await?;

    Ok(())
  }

  /// Get media item by ID.
  pub async fn get_item(&self, item_id: &str) -> Result<MediaItem, JellyfinError> {
    let user_id = self.user_id()?;
    self
      .get(&format!("/Users/{}/Items/{}", user_id, item_id))
      .await
  }

  /// Get playback info for a media item.
  pub async fn get_playback_info(
    &self,
    item_id: &str,
    audio_stream_index: Option<i32>,
    subtitle_stream_index: Option<i32>,
  ) -> Result<PlaybackInfoResponse, JellyfinError> {
    let user_id = self.user_id()?;
    let path = format!("/Items/{}/PlaybackInfo", item_id);

    let request = PlaybackInfoRequest {
      user_id,
      device_id: self.device_id.clone(),
      max_streaming_bitrate: Some(140_000_000), // 140 Mbps
      start_time_ticks: None,
      audio_stream_index,
      subtitle_stream_index,
      enable_direct_play: true,
      enable_direct_stream: true,
      enable_transcoding: true,
      auto_open_live_stream: true,
    };

    self.post(&path, &request).await
  }

  /// Build the direct play URL for a media source.
  pub fn build_stream_url(&self, item_id: &str, media_source: &MediaSource) -> Option<String> {
    let state = self.state.read();
    let server_url = state.server_url.as_ref()?;
    let token = state.access_token.as_ref()?;

    // For file protocol, return the path directly (local files)
    if media_source.protocol == "File" {
      if let Some(path) = &media_source.path {
        return Some(path.clone());
      }
    }

    // Build streaming URL
    let container = media_source.container.as_deref().unwrap_or("mkv");
    Some(format!(
      "{}/Videos/{}/stream.{}?Static=true&MediaSourceId={}&api_key={}",
      server_url, item_id, container, media_source.id, token
    ))
  }

  /// Get WebSocket URL for session.
  pub fn websocket_url(&self) -> Result<String, JellyfinError> {
    let state = self.state.read();
    let server_url = state.server_url.as_ref().ok_or(JellyfinError::NotConnected)?;
    let token = state.access_token.as_ref().ok_or(JellyfinError::NotConnected)?;

    // Convert http(s) to ws(s)
    let ws_url = if server_url.starts_with("https://") {
      server_url.replace("https://", "wss://")
    } else {
      server_url.replace("http://", "ws://")
    };

    Ok(format!(
      "{}/socket?api_key={}&deviceId={}",
      ws_url, token, self.device_id
    ))
  }

  /// Report playback started.
  pub async fn report_playback_start(
    &self,
    info: &PlaybackStartInfo,
  ) -> Result<(), JellyfinError> {
    self.post_empty("/Sessions/Playing", info).await
  }

  /// Report playback progress.
  pub async fn report_playback_progress(
    &self,
    info: &PlaybackProgressInfo,
  ) -> Result<(), JellyfinError> {
    self.post_empty("/Sessions/Playing/Progress", info).await
  }

  /// Report playback stopped.
  pub async fn report_playback_stop(&self, info: &PlaybackStopInfo) -> Result<(), JellyfinError> {
    self.post_empty("/Sessions/Playing/Stopped", info).await
  }

  /// Report session capabilities to Jellyfin.
  ///
  /// This makes the client appear as a controllable cast target.
  pub async fn report_capabilities(&self) -> Result<(), JellyfinError> {
    let capabilities = serde_json::json!({
      "PlayableMediaTypes": ["Video", "Audio"],
      "SupportsMediaControl": true,
      "SupportedCommands": [
        "Play",
        "Pause",
        "Unpause",
        "PlayState",
        "Stop",
        "Seek",
        "SetVolume",
        "VolumeUp",
        "VolumeDown",
        "Mute",
        "Unmute",
        "ToggleMute",
        "SetAudioStreamIndex",
        "SetSubtitleStreamIndex",
        "PlayNext",
        "PlayMediaSource"
      ],
      "SupportsPersistentIdentifier": true,
      "SupportsSync": false
    });

    log::info!("Reporting capabilities to Jellyfin");
    self.post_empty("/Sessions/Capabilities/Full", &capabilities).await
  }
}

impl Default for JellyfinClient {
  fn default() -> Self {
    Self::new()
  }
}
