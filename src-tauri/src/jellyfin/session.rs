//! Session manager - coordinates Jellyfin commands with MPV player.

use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use tokio::sync::mpsc;

use super::client::JellyfinClient;
use super::error::JellyfinError;
use super::types::*;
use super::websocket::{JellyfinCommand, JellyfinWebSocket};
use crate::mpv::MpvClient;

const PREFERENCES_STORE_FILE: &str = "preferences.json";
const SERIES_PREFERENCES_KEY: &str = "series_track_preferences";

/// Callback for MPV commands from Jellyfin.
pub type MpvCommandCallback = Box<dyn Fn(MpvAction) + Send + Sync>;

/// Actions to perform on MPV.
#[derive(Debug, Clone)]
pub enum MpvAction {
  /// Load and play a URL.
  Play {
    url: String,
    start_position: f64,
    title: String,
    audio_index: Option<i32>,
    subtitle_index: Option<i32>,
  },
  /// Pause playback.
  Pause,
  /// Resume playback.
  Resume,
  /// Seek to position (seconds).
  Seek(f64),
  /// Stop playback.
  Stop,
  /// Set volume (0-100).
  SetVolume(i32),
  /// Toggle mute.
  ToggleMute,
  /// Set audio track by stream index.
  SetAudioTrack(i32),
  /// Set subtitle track by stream index (-1 to disable).
  SetSubtitleTrack(i32),
}

/// Session manager state.
struct SessionState {
  playback: Option<PlaybackSession>,
  last_report_time: std::time::Instant,
  /// Current series ID being played (for track preference saving).
  current_series_id: Option<String>,
  /// Current item being played (for next episode lookup).
  current_item: Option<MediaItem>,
  /// Current media streams (for looking up track languages).
  current_media_streams: Vec<MediaStream>,
  /// Track preferences per series (key: series_id).
  series_preferences: HashMap<String, TrackPreference>,
}

/// Manages the session between Jellyfin and MPV.
pub struct SessionManager {
  client: Arc<JellyfinClient>,
  websocket: Arc<JellyfinWebSocket>,
  mpv: Arc<MpvClient>,
  app_handle: AppHandle,
  state: Arc<RwLock<SessionState>>,
  action_tx: mpsc::Sender<MpvAction>,
  action_rx: Arc<RwLock<Option<mpsc::Receiver<MpvAction>>>>,
}

impl SessionManager {
  /// Create a new session manager.
  pub fn new(client: Arc<JellyfinClient>, mpv: Arc<MpvClient>, app_handle: AppHandle) -> Self {
    let (action_tx, action_rx) = mpsc::channel(32);

    // Load series preferences from disk
    let series_preferences = Self::load_preferences_from_store(&app_handle);

    Self {
      client,
      websocket: Arc::new(JellyfinWebSocket::new()),
      mpv,
      app_handle,
      state: Arc::new(RwLock::new(SessionState {
        playback: None,
        last_report_time: std::time::Instant::now(),
        current_series_id: None,
        current_item: None,
        current_media_streams: Vec::new(),
        series_preferences,
      })),
      action_tx,
      action_rx: Arc::new(RwLock::new(Some(action_rx))),
    }
  }

  /// Load series preferences from disk.
  fn load_preferences_from_store(app_handle: &AppHandle) -> HashMap<String, TrackPreference> {
    log::info!("Attempting to load series preferences from store...");
    match app_handle.store(PREFERENCES_STORE_FILE) {
      Ok(store) => {
        log::info!("Store opened successfully, checking for key: {}", SERIES_PREFERENCES_KEY);
        if let Some(value) = store.get(SERIES_PREFERENCES_KEY) {
          log::info!("Found stored value: {:?}", value);
          match serde_json::from_value::<HashMap<String, TrackPreference>>(value.clone()) {
            Ok(prefs) => {
              log::info!("Loaded {} series track preferences from disk", prefs.len());
              return prefs;
            }
            Err(e) => {
              log::warn!("Failed to parse stored preferences: {}", e);
            }
          }
        } else {
          log::info!("No stored track preferences found (key not present)");
        }
      }
      Err(e) => {
        log::warn!("Failed to open preferences store: {}", e);
      }
    }
    HashMap::new()
  }

  /// Save series preferences to disk.
  fn save_preferences_to_store(&self) {
    let prefs = {
      let s = self.state.read();
      s.series_preferences.clone()
    };

    match self.app_handle.store(PREFERENCES_STORE_FILE) {
      Ok(store) => {
        match serde_json::to_value(&prefs) {
          Ok(value) => {
            store.set(SERIES_PREFERENCES_KEY.to_string(), value);
            if let Err(e) = store.save() {
              log::error!("Failed to save preferences to disk: {}", e);
            } else {
              log::debug!("Saved {} series track preferences to disk", prefs.len());
            }
          }
          Err(e) => {
            log::error!("Failed to serialize preferences: {}", e);
          }
        }
      }
      Err(e) => {
        log::error!("Failed to open preferences store for writing: {}", e);
      }
    }
  }

  /// Start the session (connect WebSocket and begin listening).
  pub async fn start(&self) -> Result<(), JellyfinError> {
    log::info!(
      "Starting session with Device ID: {}",
      self.client.device_id()
    );

    let ws_url = self.client.websocket_url()?;
    self.websocket.connect(&ws_url, None).await?;

    let _caps_payload = self.client.report_capabilities().await?;

    if let Err(e) = self.client.validate_session().await {
      log::warn!("Session validation failed: {} - cast may not work", e);
    } else {
      log::info!("Session validated - we should appear as cast target");
    }

    // Take the command receiver and start processing
    if let Some(mut command_rx) = self.websocket.take_command_receiver() {
      let client = self.client.clone();
      let state = self.state.clone();
      let action_tx = self.action_tx.clone();
      let app_handle = self.app_handle.clone();
      let mpv = self.mpv.clone();

      tokio::spawn(async move {
        while let Some(cmd) = command_rx.recv().await {
          if let Err(e) = Self::handle_command(&client, &state, &action_tx, &app_handle, &mpv, cmd).await {
            log::error!("Failed to handle Jellyfin command: {}", e);
          }
        }
      });
    }

    // Start MPV action consumer
    self.start_action_consumer();

    // Start progress reporting loop
    self.start_progress_reporting();

    // Start MPV event listener for end-of-file detection
    self.start_mpv_event_listener();

    Ok(())
  }

  /// Start the MPV action consumer task.
  fn start_action_consumer(&self) {
    if let Some(mut action_rx) = self.action_rx.write().take() {
      let mpv = self.mpv.clone();

      tokio::spawn(async move {
        log::info!("MPV action consumer started, waiting for actions...");
        while let Some(action) = action_rx.recv().await {
          log::info!("Processing MPV action: {:?}", action);

          match action {
            MpvAction::Play {
              url,
              start_position,
              title,
              audio_index,
              subtitle_index,
            } => {
              log::info!("MpvAction::Play received, url={}, title={}", url, title);
              // Start MPV if not already running
              if !mpv.is_connected() {
                log::info!("MPV not connected, starting...");
                if let Err(e) = mpv.start().await {
                  log::error!("Failed to start MPV: {}", e);
                  continue;
                }
                log::info!("MPV started successfully");
              }

              // Load the file
              log::info!("Loading file into MPV: {}", url);
              if let Err(e) = mpv.loadfile(&url).await {
                log::error!("Failed to load file: {}", e);
                continue;
              }
              log::info!("File loaded successfully");

              // Set the media title (shown in MPV window)
              if let Err(e) = mpv.set_property_string("force-media-title", &title).await {
                log::warn!("Failed to set media title: {}", e);
              }

              // Set subtitle track (already converted to MPV 1-based index)
              match subtitle_index {
                Some(-1) => {
                  // -1 means disable subtitles
                  if let Err(e) = mpv.disable_track("sid").await {
                    log::warn!("Failed to disable subtitles: {}", e);
                  }
                }
                Some(idx) => {
                  // idx is already MPV's 1-based track ID
                  if let Err(e) = mpv.set_subtitle_track(idx as i64).await {
                    log::warn!("Failed to set subtitle track: {}", e);
                  }
                }
                None => {
                  // Keep default behavior
                }
              }

              // Set audio track (already converted to MPV 1-based index)
              if let Some(idx) = audio_index {
                // idx is already MPV's 1-based track ID
                if let Err(e) = mpv.set_audio_track(idx as i64).await {
                  log::warn!("Failed to set audio track: {}", e);
                }
              }

              // Seek to start position if specified
              if start_position > 0.0 {
                log::info!("Seeking to position: {} seconds", start_position);
                // Wait a bit for file to load before seeking
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                if let Err(e) = mpv.seek(start_position).await {
                  log::warn!("Failed to seek to start position: {}", e);
                }
              }

              log::info!("Started playback: {} - {}", title, url);
            }
            MpvAction::Pause => {
              log::info!("MpvAction::Pause - setting pause=true");
              if let Err(e) = mpv.set_pause(true).await {
                log::error!("Failed to pause: {}", e);
              } else {
                log::info!("MPV paused successfully");
              }
            }
            MpvAction::Resume => {
              log::info!("MpvAction::Resume - setting pause=false");
              if let Err(e) = mpv.set_pause(false).await {
                log::error!("Failed to resume: {}", e);
              } else {
                log::info!("MPV resumed successfully");
              }
            }
            MpvAction::Seek(position) => {
              if let Err(e) = mpv.seek(position).await {
                log::error!("Failed to seek: {}", e);
              }
            }
            MpvAction::Stop => {
              log::info!("MpvAction::Stop - quitting MPV gracefully");
              if let Err(e) = mpv.quit().await {
                log::warn!("Failed to quit MPV gracefully: {}, forcing stop", e);
                mpv.stop();
              }
            }
            MpvAction::SetVolume(volume) => {
              if let Err(e) = mpv.set_volume(volume as f64).await {
                log::error!("Failed to set volume: {}", e);
              }
            }
            MpvAction::ToggleMute => {
              if let Err(e) = mpv.toggle_mute().await {
                log::error!("Failed to toggle mute: {}", e);
              }
            }
            MpvAction::SetAudioTrack(index) => {
              // index is already MPV's 1-based track ID
              if let Err(e) = mpv.set_audio_track(index as i64).await {
                log::error!("Failed to set audio track: {}", e);
              }
            }
            MpvAction::SetSubtitleTrack(index) => {
              if index == -1 {
                // Disable subtitles
                if let Err(e) = mpv.disable_track("sid").await {
                  log::error!("Failed to disable subtitles: {}", e);
                }
              } else {
                // index is already MPV's 1-based track ID
                if let Err(e) = mpv.set_subtitle_track(index as i64).await {
                  log::error!("Failed to set subtitle track: {}", e);
                }
              }
            }
          }
        }
      });
    }
  }

  /// Handle a Jellyfin command.
  async fn handle_command(
    client: &JellyfinClient,
    state: &RwLock<SessionState>,
    action_tx: &mpsc::Sender<MpvAction>,
    app_handle: &AppHandle,
    mpv: &MpvClient,
    cmd: JellyfinCommand,
  ) -> Result<(), JellyfinError> {
    match cmd {
      JellyfinCommand::Play(request) => {
        Self::handle_play(client, state, action_tx, request).await?;
      }
      JellyfinCommand::Playstate(request) => {
        Self::handle_playstate(client, state, action_tx, mpv, request).await?;
      }
      JellyfinCommand::GeneralCommand(request) => {
        Self::handle_general_command(state, action_tx, app_handle, request).await?;
      }
    }
    Ok(())
  }

  /// Handle Play command.
  async fn handle_play(
    client: &JellyfinClient,
    state: &RwLock<SessionState>,
    action_tx: &mpsc::Sender<MpvAction>,
    request: PlayRequest,
  ) -> Result<(), JellyfinError> {
    log::info!("handle_play called with request: {:?}", request);

    // Get the first item ID
    let item_id = request
      .item_ids
      .first()
      .ok_or(JellyfinError::SessionNotFound)?;
    log::info!("Playing item_id: {}", item_id);

    // Fetch media item metadata for title
    let item = client.get_item(item_id).await?;
    let title = Self::format_title(&item);
    log::info!("Media title: {}", title);

    // Get playback info
    let playback_info = client
      .get_playback_info(
        item_id,
        request.audio_stream_index,
        request.subtitle_stream_index,
      )
      .await?;
    log::info!(
      "Got playback info, media_sources count: {}",
      playback_info.media_sources.len()
    );

    // Get the best media source
    let media_source = playback_info
      .media_sources
      .first()
      .ok_or(JellyfinError::SessionNotFound)?;
    log::info!(
      "Using media_source: id={}, protocol={:?}",
      media_source.id,
      media_source.protocol
    );

    // Apply series track preferences if available
    let mut audio_index = request.audio_stream_index;
    let mut subtitle_index = request.subtitle_stream_index;

    if let Some(ref series_id) = item.series_id {
      let s = state.read();
      log::info!(
        "Looking up preferences for series_id={}, available prefs: {:?}",
        series_id,
        s.series_preferences.keys().collect::<Vec<_>>()
      );
      if let Some(pref) = s.series_preferences.get(series_id) {
        log::info!("Found track preference for series {}: {:?}", series_id, pref);

        // Apply audio preference if not explicitly set in request
        if audio_index.is_none() {
          if let Some(ref lang) = pref.audio_language {
            if let Some(idx) = find_stream_by_lang(&media_source.media_streams, "Audio", lang) {
              log::info!("Applying preferred audio language '{}' -> index {}", lang, idx);
              audio_index = Some(idx);
            }
          }
        }

        // Apply subtitle preference if not explicitly set in request
        if subtitle_index.is_none() {
          if pref.is_subtitle_enabled {
            if let Some(ref lang) = pref.subtitle_language {
              if let Some(idx) = find_stream_by_lang(&media_source.media_streams, "Subtitle", lang) {
                log::info!("Applying preferred subtitle language '{}' -> index {}", lang, idx);
                subtitle_index = Some(idx);
              }
            }
          } else {
            // User previously disabled subtitles for this series
            log::info!("Disabling subtitles based on preference");
            subtitle_index = Some(-1);
          }
        }
      }
    }

    // Build stream URL
    let url = client
      .build_stream_url(item_id, media_source)
      .ok_or(JellyfinError::NotConnected)?;
    log::info!("Built stream URL: {}", url);

    // Calculate start position
    let start_position = request
      .start_position_ticks
      .map(ticks_to_seconds)
      .unwrap_or(0.0);

    // Store playback session and current series
    {
      let mut s = state.write();
      s.current_series_id = item.series_id.clone();
      s.current_item = Some(item.clone());
      s.current_media_streams = media_source.media_streams.clone();
      s.playback = Some(PlaybackSession {
        item_id: item_id.clone(),
        media_source_id: Some(media_source.id.clone()),
        play_session_id: playback_info.play_session_id.clone(),
        position_ticks: request.start_position_ticks.unwrap_or(0),
        is_paused: false,
        volume: 100,
        audio_stream_index: audio_index,
        subtitle_stream_index: subtitle_index,
      });
      s.last_report_time = std::time::Instant::now();
    }

    // Report playback started
    let start_info = PlaybackStartInfo {
      item_id: item_id.clone(),
      media_source_id: Some(media_source.id.clone()),
      play_session_id: playback_info.play_session_id.clone(),
      position_ticks: request.start_position_ticks,
      is_paused: false,
      is_muted: false,
      volume_level: 100,
      audio_stream_index: audio_index,
      subtitle_stream_index: subtitle_index,
      play_method: if media_source.supports_direct_play {
        "DirectPlay".to_string()
      } else if media_source.supports_direct_stream {
        "DirectStream".to_string()
      } else {
        "Transcode".to_string()
      },
      can_seek: true,
    };
    client.report_playback_start(&start_info).await?;

    // Convert Jellyfin indices to MPV indices before sending
    let mpv_audio_index = audio_index.map(|idx| {
      if idx < 0 {
        idx // -1 means disable
      } else {
        jellyfin_to_mpv_track_index(&media_source.media_streams, "Audio", idx)
      }
    });
    let mpv_subtitle_index = subtitle_index.map(|idx| {
      if idx < 0 {
        idx // -1 means disable
      } else {
        jellyfin_to_mpv_track_index(&media_source.media_streams, "Subtitle", idx)
      }
    });

    // Send action to MPV with converted indices
    log::info!(
      "Sending MpvAction::Play: audio_index {:?} (Jellyfin) -> {:?} (MPV), subtitle_index {:?} (Jellyfin) -> {:?} (MPV)",
      audio_index, mpv_audio_index, subtitle_index, mpv_subtitle_index
    );
    let _ = action_tx
      .send(MpvAction::Play {
        url,
        start_position,
        title,
        audio_index: mpv_audio_index,
        subtitle_index: mpv_subtitle_index,
      })
      .await;
    log::info!("MpvAction::Play sent successfully");

    Ok(())
  }

  /// Format media title for display in MPV.
  fn format_title(item: &MediaItem) -> String {
    match item.item_type.as_str() {
      "Episode" => {
        let series = item.series_name.as_deref().unwrap_or("Unknown");
        let season = item.parent_index_number.unwrap_or(1);
        let episode = item.index_number.unwrap_or(1);
        format!("{} - S{:02}E{:02} - {}", series, season, episode, item.name)
      }
      _ => item.name.clone(),
    }
  }

  /// Handle Playstate command.
  async fn handle_playstate(
    client: &JellyfinClient,
    state: &RwLock<SessionState>,
    action_tx: &mpsc::Sender<MpvAction>,
    mpv: &MpvClient,
    request: PlaystateRequest,
  ) -> Result<(), JellyfinError> {
    log::info!("handle_playstate: command={}", request.command);
    match request.command.as_str() {
      "Pause" => {
        log::info!("Processing Pause command");
        {
          let mut s = state.write();
          if let Some(ref mut playback) = s.playback {
            playback.is_paused = true;
          }
        }
        let _ = action_tx.send(MpvAction::Pause).await;
      }
      "Unpause" => {
        log::info!("Processing Unpause command");
        {
          let mut s = state.write();
          if let Some(ref mut playback) = s.playback {
            playback.is_paused = false;
          }
        }
        let _ = action_tx.send(MpvAction::Resume).await;
      }
      "PlayPause" => {
        // Query actual MPV state to handle cases where user paused via MPV keyboard
        let is_paused = match mpv.get_pause().await {
          Ok(paused) => paused,
          Err(e) => {
            log::warn!("Failed to get pause state from MPV: {}, using internal state", e);
            let s = state.read();
            s.playback.as_ref().map(|p| p.is_paused).unwrap_or(false)
          }
        };
        log::info!(
          "Processing PlayPause command, MPV paused={}",
          is_paused
        );
        if is_paused {
          {
            let mut s = state.write();
            if let Some(ref mut playback) = s.playback {
              playback.is_paused = false;
            }
          }
          let _ = action_tx.send(MpvAction::Resume).await;
        } else {
          {
            let mut s = state.write();
            if let Some(ref mut playback) = s.playback {
              playback.is_paused = true;
            }
          }
          let _ = action_tx.send(MpvAction::Pause).await;
        }
      }
      "Seek" => {
        if let Some(ticks) = request.seek_position_ticks {
          let position = ticks_to_seconds(ticks);
          {
            let mut s = state.write();
            if let Some(ref mut playback) = s.playback {
              playback.position_ticks = ticks;
            }
          }
          let _ = action_tx.send(MpvAction::Seek(position)).await;
        }
      }
      "Stop" => {
        log::info!("Processing Stop command");
        {
          let mut s = state.write();
          s.playback = None;
        }
        let _ = action_tx.send(MpvAction::Stop).await;
      }
      "NextTrack" => {
        log::info!("Processing NextTrack command");
        // Get current item for next episode lookup
        let current_item = {
          let s = state.read();
          s.current_item.clone()
        };

        if let Some(item) = current_item {
          // Report playback stopped for current item
          {
            let session = {
              let mut s = state.write();
              s.playback.take()
            };

            if let Some(session) = session {
              let stop_info = PlaybackStopInfo {
                item_id: session.item_id,
                media_source_id: session.media_source_id,
                play_session_id: session.play_session_id,
                position_ticks: Some(session.position_ticks),
              };
              if let Err(e) = client.report_playback_stop(&stop_info).await {
                log::error!("Failed to report playback stop: {}", e);
              }
            }
          }

          // Try to get next episode
          match client.get_next_episode(&item).await {
            Ok(Some(next_item)) => {
              log::info!(
                "Playing next episode: {} - S{:02}E{:02}",
                next_item.series_name.as_deref().unwrap_or("Unknown"),
                next_item.parent_index_number.unwrap_or(0),
                next_item.index_number.unwrap_or(0)
              );

              // Create a synthetic PlayRequest for the next episode
              let play_request = PlayRequest {
                item_ids: vec![next_item.id.clone()],
                start_position_ticks: None,
                play_command: "PlayNow".to_string(),
                media_source_id: None,
                audio_stream_index: None,
                subtitle_stream_index: None,
              };

              // Handle the play request
              if let Err(e) = Self::handle_play(client, state, action_tx, play_request).await {
                log::error!("Failed to play next episode: {}", e);
              }
            }
            Ok(None) => {
              log::info!("No next episode available");
              // Clear current item
              let mut s = state.write();
              s.current_item = None;
              s.current_series_id = None;
            }
            Err(e) => {
              log::error!("Failed to get next episode: {}", e);
            }
          }
        } else {
          log::warn!("NextTrack: No current item to get next episode from");
        }
      }
      "PreviousTrack" => {
        log::info!("Processing PreviousTrack command");
        // Get current item for previous episode lookup
        let current_item = {
          let s = state.read();
          s.current_item.clone()
        };

        if let Some(item) = current_item {
          // Report playback stopped for current item
          {
            let session = {
              let mut s = state.write();
              s.playback.take()
            };

            if let Some(session) = session {
              let stop_info = PlaybackStopInfo {
                item_id: session.item_id,
                media_source_id: session.media_source_id,
                play_session_id: session.play_session_id,
                position_ticks: Some(session.position_ticks),
              };
              if let Err(e) = client.report_playback_stop(&stop_info).await {
                log::error!("Failed to report playback stop: {}", e);
              }
            }
          }

          // Try to get previous episode
          match client.get_previous_episode(&item).await {
            Ok(Some(prev_item)) => {
              log::info!(
                "Playing previous episode: {} - S{:02}E{:02}",
                prev_item.series_name.as_deref().unwrap_or("Unknown"),
                prev_item.parent_index_number.unwrap_or(0),
                prev_item.index_number.unwrap_or(0)
              );

              // Create a synthetic PlayRequest for the previous episode
              let play_request = PlayRequest {
                item_ids: vec![prev_item.id.clone()],
                start_position_ticks: None,
                play_command: "PlayNow".to_string(),
                media_source_id: None,
                audio_stream_index: None,
                subtitle_stream_index: None,
              };

              // Handle the play request
              if let Err(e) = Self::handle_play(client, state, action_tx, play_request).await {
                log::error!("Failed to play previous episode: {}", e);
              }
            }
            Ok(None) => {
              log::info!("No previous episode available");
              // Clear current item
              let mut s = state.write();
              s.current_item = None;
              s.current_series_id = None;
            }
            Err(e) => {
              log::error!("Failed to get previous episode: {}", e);
            }
          }
        } else {
          log::warn!("PreviousTrack: No current item to get previous episode from");
        }
      }
      _ => {
        log::warn!("Unhandled playstate command: {}", request.command);
      }
    }
    Ok(())
  }

  /// Handle GeneralCommand.
  async fn handle_general_command(
    state: &RwLock<SessionState>,
    action_tx: &mpsc::Sender<MpvAction>,
    app_handle: &AppHandle,
    request: GeneralCommand,
  ) -> Result<(), JellyfinError> {
    let mut should_save_prefs = false;
    
    match request.name.as_str() {
      "SetVolume" => {
        if let Some(args) = request.arguments {
          if let Some(volume) = args.get("Volume").and_then(|v| v.as_i64()) {
            let _ = action_tx.send(MpvAction::SetVolume(volume as i32)).await;
          }
        }
      }
      "ToggleMute" => {
        let _ = action_tx.send(MpvAction::ToggleMute).await;
      }
      "SetAudioStreamIndex" => {
        if let Some(args) = &request.arguments {
          // Index can be a string or number depending on Jellyfin client
          let index = args.get("Index").and_then(|v| {
            v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
          });
          if let Some(index) = index {
            log::info!("SetAudioStreamIndex: {} (Jellyfin index)", index);
            // Update playback state and save series preference
            let mpv_index = {
              let mut s = state.write();
              if let Some(ref mut playback) = s.playback {
                playback.audio_stream_index = Some(index as i32);
              }
              // Save preference for series (clone to avoid borrow issues)
              let series_id = s.current_series_id.clone();
              if let Some(series_id) = series_id {
                // Find the language of the selected track
                let lang = s.current_media_streams
                  .iter()
                  .find(|stream| stream.stream_type == "Audio" && stream.index == index as i32)
                  .and_then(|stream| stream.language.clone());
                
                if let Some(lang) = lang {
                  log::info!("Saving audio preference for series {}: {}", series_id, lang);
                  let pref = s.series_preferences.entry(series_id).or_default();
                  pref.audio_language = Some(lang);
                  should_save_prefs = true;
                }
              }
              // Convert Jellyfin stream index to MPV track index
              jellyfin_to_mpv_track_index(&s.current_media_streams, "Audio", index as i32)
            };
            // Send to MPV with converted index
            log::info!("SetAudioStreamIndex: {} (MPV index)", mpv_index);
            let _ = action_tx.send(MpvAction::SetAudioTrack(mpv_index)).await;
          }
        }
      }
      "SetSubtitleStreamIndex" => {
        if let Some(args) = &request.arguments {
          // Index can be -1 to disable subtitles, and can be string or number
          let index = args.get("Index").and_then(|v| {
            v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
          });
          if let Some(index) = index {
            log::info!("SetSubtitleStreamIndex: {} (Jellyfin index)", index);
            // Update playback state and save series preference
            let mpv_index = {
              let mut s = state.write();
              if let Some(ref mut playback) = s.playback {
                playback.subtitle_stream_index = Some(index as i32);
              }
              // Save preference for series (clone to avoid borrow issues)
              let series_id = s.current_series_id.clone();
              if let Some(series_id) = series_id {
                if index == -1 {
                  // User disabled subtitles
                  log::info!("Saving subtitle disabled preference for series {}", series_id);
                  let pref = s.series_preferences.entry(series_id).or_default();
                  pref.is_subtitle_enabled = false;
                  pref.subtitle_language = None;
                  should_save_prefs = true;
                } else {
                  // Find the language of the selected subtitle track
                  let lang = s.current_media_streams
                    .iter()
                    .find(|stream| stream.stream_type == "Subtitle" && stream.index == index as i32)
                    .and_then(|stream| stream.language.clone());
                  
                  let pref = s.series_preferences.entry(series_id.clone()).or_default();
                  if let Some(lang) = lang {
                    log::info!("Saving subtitle preference for series {}: {}", series_id, lang);
                    pref.is_subtitle_enabled = true;
                    pref.subtitle_language = Some(lang);
                  } else {
                    // Track selected but no language - just enable subtitles
                    pref.is_subtitle_enabled = true;
                  }
                  should_save_prefs = true;
                }
              }
              // Convert Jellyfin stream index to MPV track index (or -1 to disable)
              if index == -1 {
                -1
              } else {
                jellyfin_to_mpv_track_index(&s.current_media_streams, "Subtitle", index as i32)
              }
            };
            // Send to MPV with converted index
            log::info!("SetSubtitleStreamIndex: {} (MPV index)", mpv_index);
            let _ = action_tx.send(MpvAction::SetSubtitleTrack(mpv_index)).await;
          }
        }
      }
      _ => {
        log::debug!("Unhandled general command: {}", request.name);
      }
    }
    
    // Persist preferences to disk if changed
    if should_save_prefs {
      Self::save_preferences_static(state, app_handle);
    }
    
    Ok(())
  }

  /// Save preferences to disk (static version for use in async contexts).
  fn save_preferences_static(state: &RwLock<SessionState>, app_handle: &AppHandle) {
    let prefs = {
      let s = state.read();
      s.series_preferences.clone()
    };

    match app_handle.store(PREFERENCES_STORE_FILE) {
      Ok(store) => {
        match serde_json::to_value(&prefs) {
          Ok(value) => {
            store.set(SERIES_PREFERENCES_KEY.to_string(), value);
            if let Err(e) = store.save() {
              log::error!("Failed to save preferences to disk: {}", e);
            } else {
              log::debug!("Saved {} series track preferences to disk", prefs.len());
            }
          }
          Err(e) => {
            log::error!("Failed to serialize preferences: {}", e);
          }
        }
      }
      Err(e) => {
        log::error!("Failed to open preferences store for writing: {}", e);
      }
    }
  }

  /// Start periodic progress reporting.
  fn start_progress_reporting(&self) {
    let client = self.client.clone();
    let mpv = self.mpv.clone();
    let state = self.state.clone();

    tokio::spawn(async move {
      let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));
      log::info!("Progress reporting loop started");

      loop {
        interval.tick().await;

        // Get current playback session
        let session = {
          let s = state.read();
          s.playback.clone()
        };

        if let Some(session) = session {
          // Get current position from MPV
          let position_result = mpv.get_time_pos().await;
          // Get actual pause state from MPV (syncs web UI pause button)
          let pause_result = mpv.get_pause().await;

          match (position_result, pause_result) {
            (Ok(position), Ok(is_paused)) => {
              let position_ticks = seconds_to_ticks(position);

              // Update state with actual MPV state
              {
                let mut s = state.write();
                if let Some(ref mut playback) = s.playback {
                  playback.position_ticks = position_ticks;
                  playback.is_paused = is_paused;
                }
              }

              // Report progress with actual MPV state
              let progress = PlaybackProgressInfo {
                item_id: session.item_id.clone(),
                media_source_id: session.media_source_id.clone(),
                play_session_id: session.play_session_id.clone(),
                position_ticks: Some(position_ticks),
                is_paused,
                is_muted: false,
                volume_level: session.volume,
                audio_stream_index: session.audio_stream_index,
                subtitle_stream_index: session.subtitle_stream_index,
                play_method: "DirectPlay".to_string(),
                can_seek: true,
              };

              log::debug!("Progress payload: {:?}", progress);

              if let Err(e) = client.report_playback_progress(&progress).await {
                log::error!("Failed to report playback progress: {}", e);
              }
            }
            (Err(e), _) => {
              log::warn!("Failed to get time position from MPV: {}", e);
            }
            (_, Err(e)) => {
              log::warn!("Failed to get pause state from MPV: {}", e);
            }
          }
        }
      }
    });
  }

  /// Start MPV event listener for end-of-file detection and auto-play next episode.
  fn start_mpv_event_listener(&self) {
    let mpv = self.mpv.clone();
    let client = self.client.clone();
    let state = self.state.clone();
    let action_tx = self.action_tx.clone();

    tokio::spawn(async move {
      log::info!("MPV event listener started");

      // Wait a bit for MPV to connect before trying to get events
      tokio::time::sleep(std::time::Duration::from_secs(1)).await;

      loop {
        // Try to get the event receiver
        let event_rx = match mpv.events() {
          Some(rx) => rx,
          None => {
            // MPV not connected yet, wait and retry
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            continue;
          }
        };

        log::info!("Got MPV event receiver, listening for events...");

        // Process events
        while let Ok(event) = event_rx.recv().await {
          if event.event == "end-file" {
            // Check if playback ended naturally (not due to error or stop command)
            // The reason field is at the top level of the event (not in data)
            let reason = event.reason.as_deref().unwrap_or("");

            log::info!("MPV end-file event, reason: {}", reason);

            // "eof" means natural end of file, "stop" means user stopped
            if reason == "eof" {
              // Get current item for next episode lookup
              let current_item = {
                let s = state.read();
                s.current_item.clone()
              };

              if let Some(item) = current_item {
                log::info!("Playback ended naturally, checking for next episode...");

                // Report playback stopped to Jellyfin
                {
                  let session = {
                    let mut s = state.write();
                    s.playback.take()
                  };

                  if let Some(session) = session {
                    let stop_info = PlaybackStopInfo {
                      item_id: session.item_id,
                      media_source_id: session.media_source_id,
                      play_session_id: session.play_session_id,
                      position_ticks: Some(session.position_ticks),
                    };
                    if let Err(e) = client.report_playback_stop(&stop_info).await {
                      log::error!("Failed to report playback stop: {}", e);
                    }
                  }
                }

                // Try to get next episode
                match client.get_next_episode(&item).await {
                  Ok(Some(next_item)) => {
                    log::info!(
                      "Auto-playing next episode: {} - S{:02}E{:02}",
                      next_item.series_name.as_deref().unwrap_or("Unknown"),
                      next_item.parent_index_number.unwrap_or(0),
                      next_item.index_number.unwrap_or(0)
                    );

                    // Create a synthetic PlayRequest for the next episode
                    let play_request = PlayRequest {
                      item_ids: vec![next_item.id.clone()],
                      start_position_ticks: None,
                      play_command: "PlayNow".to_string(),
                      media_source_id: None,
                      audio_stream_index: None,
                      subtitle_stream_index: None,
                    };

                    // Handle the play request
                    if let Err(e) = Self::handle_play(&client, &state, &action_tx, play_request).await {
                      log::error!("Failed to auto-play next episode: {}", e);
                    }
                  }
                  Ok(None) => {
                    log::info!("No next episode available, playback complete");
                    // Clear current item
                    let mut s = state.write();
                    s.current_item = None;
                    s.current_series_id = None;
                  }
                  Err(e) => {
                    log::error!("Failed to get next episode: {}", e);
                  }
                }
              }
            }
          }
        }

        log::info!("MPV event receiver closed, waiting for reconnection...");
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
      }
    });
  }

  /// Stop the session.
  pub async fn stop(&self) -> Result<(), JellyfinError> {
    // Report playback stopped if there's an active session
    let session = {
      let mut s = self.state.write();
      s.playback.take()
    };

    if let Some(session) = session {
      let stop_info = PlaybackStopInfo {
        item_id: session.item_id,
        media_source_id: session.media_source_id,
        play_session_id: session.play_session_id,
        position_ticks: Some(session.position_ticks),
      };
      self.client.report_playback_stop(&stop_info).await?;
    }

    self.websocket.disconnect().await;
    Ok(())
  }

  /// Take the action receiver (can only be called once).
  pub fn take_action_receiver(&self) -> Option<mpsc::Receiver<MpvAction>> {
    self.action_rx.write().take()
  }

  /// Check if there's an active playback session.
  pub fn has_active_playback(&self) -> bool {
    self.state.read().playback.is_some()
  }

  /// Update playback state from MPV.
  pub fn update_playback_state(&self, position: f64, is_paused: bool, volume: i32) {
    let mut s = self.state.write();
    if let Some(ref mut playback) = s.playback {
      playback.position_ticks = seconds_to_ticks(position);
      playback.is_paused = is_paused;
      playback.volume = volume;
    }
  }

  /// End current playback session.
  pub async fn end_playback(&self) -> Result<(), JellyfinError> {
    let session = {
      let mut s = self.state.write();
      s.playback.take()
    };

    if let Some(session) = session {
      let stop_info = PlaybackStopInfo {
        item_id: session.item_id,
        media_source_id: session.media_source_id,
        play_session_id: session.play_session_id,
        position_ticks: Some(session.position_ticks),
      };
      self.client.report_playback_stop(&stop_info).await?;
    }

    Ok(())
  }
}

/// Convert Jellyfin stream index to MPV track index.
/// Jellyfin uses absolute indices across all streams (video, audio, subtitle combined).
/// MPV uses 1-based indices within each track type (audio, subtitle).
fn jellyfin_to_mpv_track_index(streams: &[MediaStream], stream_type: &str, jellyfin_index: i32) -> i32 {
  // Count how many tracks of this type come before and including the target index
  let mut mpv_index = 0;
  for stream in streams {
    if stream.stream_type == stream_type {
      mpv_index += 1;
      if stream.index == jellyfin_index {
        return mpv_index;
      }
    }
  }
  // Fallback: return 1 (first track of type) if not found
  1
}
