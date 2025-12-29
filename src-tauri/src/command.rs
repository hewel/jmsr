use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use specta::specta;
use specta_typescript::Typescript;
use std::sync::Arc;
use tauri::State;
use tauri_specta::{collect_commands, Builder};

use crate::jellyfin::{ConnectionState, Credentials, JellyfinClient, SavedSession, SessionManager};
use crate::mpv::{MpvClient, PropertyValue};

/// Player state returned to frontend.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PlayerState {
  pub connected: bool,
  pub paused: bool,
  pub time_pos: f64,
  pub duration: f64,
  pub volume: f64,
}

impl Default for PlayerState {
  fn default() -> Self {
    Self {
      connected: false,
      paused: true,
      time_pos: 0.0,
      duration: 0.0,
      volume: 100.0,
    }
  }
}

/// MPV client state managed by Tauri.
pub struct MpvState(pub Arc<MpvClient>);

/// Jellyfin client state managed by Tauri.
pub struct JellyfinState {
  pub client: Arc<JellyfinClient>,
  pub mpv: Arc<MpvClient>,
  pub session: RwLock<Option<Arc<SessionManager>>>,
}

impl JellyfinState {
  pub fn new(client: Arc<JellyfinClient>, mpv: Arc<MpvClient>) -> Self {
    Self {
      client,
      mpv,
      session: RwLock::new(None),
    }
  }
}

// ============================================================================
// MPV Commands
// ============================================================================

#[tauri::command]
#[specta]
pub fn hello_world(my_name: String) -> String {
  format!("Hello, {my_name}! You've been greeted from Rust!")
}

/// Start the MPV player.
#[tauri::command]
#[specta]
pub async fn mpv_start(state: State<'_, MpvState>) -> Result<(), String> {
  state.0.start().await.map_err(|e| e.to_string())
}

/// Stop the MPV player.
#[tauri::command]
#[specta]
pub async fn mpv_stop(state: State<'_, MpvState>) -> Result<(), String> {
  state.0.stop();
  Ok(())
}

/// Load a media file/URL for playback.
#[tauri::command]
#[specta]
pub async fn mpv_loadfile(state: State<'_, MpvState>, url: String) -> Result<(), String> {
  state.0.loadfile(&url).await.map_err(|e| e.to_string())
}

/// Seek to absolute position in seconds.
#[tauri::command]
#[specta]
pub async fn mpv_seek(state: State<'_, MpvState>, time: f64) -> Result<(), String> {
  state.0.seek(time).await.map_err(|e| e.to_string())
}

/// Set pause state.
#[tauri::command]
#[specta]
pub async fn mpv_set_pause(state: State<'_, MpvState>, paused: bool) -> Result<(), String> {
  state.0.set_pause(paused).await.map_err(|e| e.to_string())
}

/// Set volume (0-100).
#[tauri::command]
#[specta]
pub async fn mpv_set_volume(state: State<'_, MpvState>, volume: f64) -> Result<(), String> {
  state.0.set_volume(volume).await.map_err(|e| e.to_string())
}

/// Set audio track by ID.
#[tauri::command]
#[specta]
pub async fn mpv_set_audio_track(state: State<'_, MpvState>, id: i32) -> Result<(), String> {
  state
    .0
    .set_audio_track(id as i64)
    .await
    .map_err(|e| e.to_string())
}

/// Set subtitle track by ID.
#[tauri::command]
#[specta]
pub async fn mpv_set_subtitle_track(state: State<'_, MpvState>, id: i32) -> Result<(), String> {
  state
    .0
    .set_subtitle_track(id as i64)
    .await
    .map_err(|e| e.to_string())
}

/// Get a property value from MPV.
#[tauri::command]
#[specta]
pub async fn mpv_get_property(
  state: State<'_, MpvState>,
  name: String,
) -> Result<PropertyValue, String> {
  state.0.get_property(&name).await.map_err(|e| e.to_string())
}

/// Get current player state.
#[tauri::command]
#[specta]
pub async fn mpv_get_state(state: State<'_, MpvState>) -> Result<PlayerState, String> {
  if !state.0.is_connected() {
    return Ok(PlayerState::default());
  }

  let paused = match state.0.get_property("pause").await {
    Ok(PropertyValue::Bool(b)) => b,
    _ => true,
  };

  let time_pos = match state.0.get_property("time-pos").await {
    Ok(PropertyValue::Number(n)) => n,
    _ => 0.0,
  };

  let duration = match state.0.get_property("duration").await {
    Ok(PropertyValue::Number(n)) => n,
    _ => 0.0,
  };

  let volume = match state.0.get_property("volume").await {
    Ok(PropertyValue::Number(n)) => n,
    _ => 100.0,
  };

  Ok(PlayerState {
    connected: true,
    paused,
    time_pos,
    duration,
    volume,
  })
}

/// Check if MPV is connected.
#[tauri::command]
#[specta]
pub fn mpv_is_connected(state: State<'_, MpvState>) -> bool {
  state.0.is_connected()
}

// ============================================================================
// Jellyfin Commands
// ============================================================================

/// Connect to a Jellyfin server.
#[tauri::command]
#[specta]
pub async fn jellyfin_connect(
  state: State<'_, JellyfinState>,
  credentials: Credentials,
) -> Result<(), String> {
  // Authenticate with server
  state
    .client
    .authenticate(&credentials)
    .await
    .map_err(|e| e.to_string())?;

  // Create and start session manager
  let session = Arc::new(SessionManager::new(state.client.clone(), state.mpv.clone()));
  session.start().await.map_err(|e| e.to_string())?;

  // Store session
  *state.session.write() = Some(session);

  Ok(())
}

/// Disconnect from Jellyfin server.
#[tauri::command]
#[specta]
pub async fn jellyfin_disconnect(state: State<'_, JellyfinState>) -> Result<(), String> {
  // Take session without holding lock across await
  let session = state.session.write().take();

  // Stop session if active
  if let Some(session) = session {
    session.stop().await.map_err(|e| e.to_string())?;
  }

  // Disconnect client
  state.client.disconnect();

  Ok(())
}

/// Get Jellyfin connection state.
#[tauri::command]
#[specta]
pub fn jellyfin_get_state(state: State<'_, JellyfinState>) -> ConnectionState {
  state.client.connection_state()
}

/// Check if connected to Jellyfin.
#[tauri::command]
#[specta]
pub fn jellyfin_is_connected(state: State<'_, JellyfinState>) -> bool {
  state.client.is_connected()
}

/// Get the current session data for saving.
#[tauri::command]
#[specta]
pub fn jellyfin_get_session(state: State<'_, JellyfinState>) -> Option<SavedSession> {
  state.client.get_saved_session()
}

/// Restore a session from saved data.
#[tauri::command]
#[specta]
pub async fn jellyfin_restore_session(
  state: State<'_, JellyfinState>,
  session: SavedSession,
) -> Result<(), String> {
  // Restore connection from saved session
  state
    .client
    .restore_session(&session)
    .await
    .map_err(|e| e.to_string())?;

  // Create and start session manager
  let session_mgr = Arc::new(SessionManager::new(state.client.clone(), state.mpv.clone()));
  session_mgr.start().await.map_err(|e| e.to_string())?;

  // Store session
  *state.session.write() = Some(session_mgr);

  Ok(())
}

pub fn command_builder() -> Builder {
  let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
    // General
    hello_world,
    // MPV commands
    mpv_start,
    mpv_stop,
    mpv_loadfile,
    mpv_seek,
    mpv_set_pause,
    mpv_set_volume,
    mpv_set_audio_track,
    mpv_set_subtitle_track,
    mpv_get_property,
    mpv_get_state,
    mpv_is_connected,
    // Jellyfin commands
    jellyfin_connect,
    jellyfin_disconnect,
    jellyfin_get_state,
    jellyfin_is_connected,
    jellyfin_get_session,
    jellyfin_restore_session,
  ]);

  #[cfg(debug_assertions)] // <- Only export on non-release builds
  builder
    .export(Typescript::default(), "../src/bindings.ts")
    .expect("Failed to export typescript bindings");
  builder
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn export_bindings() {
    // This test triggers binding generation
    let _ = command_builder();
  }
}
