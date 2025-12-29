//! Session manager - coordinates Jellyfin commands with MPV player.

use parking_lot::RwLock;
use std::sync::Arc;
use tokio::sync::mpsc;

use super::client::JellyfinClient;
use super::error::JellyfinError;
use super::types::*;
use super::websocket::{JellyfinCommand, JellyfinWebSocket};
use crate::mpv::MpvClient;

/// Callback for MPV commands from Jellyfin.
pub type MpvCommandCallback = Box<dyn Fn(MpvAction) + Send + Sync>;

/// Actions to perform on MPV.
#[derive(Debug, Clone)]
pub enum MpvAction {
  /// Load and play a URL.
  Play { url: String, start_position: f64 },
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
}

/// Session manager state.
struct SessionState {
  playback: Option<PlaybackSession>,
  last_report_time: std::time::Instant,
}

/// Manages the session between Jellyfin and MPV.
pub struct SessionManager {
  client: Arc<JellyfinClient>,
  websocket: Arc<JellyfinWebSocket>,
  mpv: Arc<MpvClient>,
  state: Arc<RwLock<SessionState>>,
  action_tx: mpsc::Sender<MpvAction>,
  action_rx: Arc<RwLock<Option<mpsc::Receiver<MpvAction>>>>,
}

impl SessionManager {
  /// Create a new session manager.
  pub fn new(client: Arc<JellyfinClient>, mpv: Arc<MpvClient>) -> Self {
    let (action_tx, action_rx) = mpsc::channel(32);

    Self {
      client,
      websocket: Arc::new(JellyfinWebSocket::new()),
      mpv,
      state: Arc::new(RwLock::new(SessionState {
        playback: None,
        last_report_time: std::time::Instant::now(),
      })),
      action_tx,
      action_rx: Arc::new(RwLock::new(Some(action_rx))),
    }
  }

  /// Start the session (connect WebSocket and begin listening).
  pub async fn start(&self) -> Result<(), JellyfinError> {
    log::info!(
      "Starting session with Device ID: {}",
      self.client.device_id()
    );

    // DOUBLE REPORT STRATEGY:
    // 1. First, report capabilities via HTTP and capture the payload
    // 2. Connect WebSocket, passing the payload for a second report via WS
    //
    // This ensures Jellyfin sees us as a cast target regardless of which
    // registration path it checks (HTTP session or WebSocket session).

    // Step 1: Report capabilities via HTTP (returns the JSON payload)
    let caps_payload = self.client.report_capabilities().await?;
    log::info!("Reported capabilities via HTTP");

    // Step 2: Connect WebSocket with capabilities for second report
    let ws_url = self.client.websocket_url()?;
    log::info!("Connecting to WebSocket: {}", ws_url);
    self.websocket.connect(&ws_url, Some(caps_payload)).await?;
    log::info!("Connected to WebSocket and reported capabilities via WS");

    // Take the command receiver and start processing
    if let Some(mut command_rx) = self.websocket.take_command_receiver() {
      let client = self.client.clone();
      let state = self.state.clone();
      let action_tx = self.action_tx.clone();

      tokio::spawn(async move {
        while let Some(cmd) = command_rx.recv().await {
          if let Err(e) = Self::handle_command(&client, &state, &action_tx, cmd).await {
            log::error!("Failed to handle Jellyfin command: {}", e);
          }
        }
      });
    }

    // Start MPV action consumer
    self.start_action_consumer();

    // Start progress reporting loop
    self.start_progress_reporting();

    Ok(())
  }

  /// Start the MPV action consumer task.
  fn start_action_consumer(&self) {
    if let Some(mut action_rx) = self.action_rx.write().take() {
      let mpv = self.mpv.clone();

      tokio::spawn(async move {
        while let Some(action) = action_rx.recv().await {
          log::debug!("Processing MPV action: {:?}", action);

          match action {
            MpvAction::Play {
              url,
              start_position,
            } => {
              // Start MPV if not already running
              if !mpv.is_connected() {
                if let Err(e) = mpv.start().await {
                  log::error!("Failed to start MPV: {}", e);
                  continue;
                }
              }

              // Load the file
              if let Err(e) = mpv.loadfile(&url).await {
                log::error!("Failed to load file: {}", e);
                continue;
              }

              // Seek to start position if specified
              if start_position > 0.0 {
                // Wait a bit for file to load before seeking
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                if let Err(e) = mpv.seek(start_position).await {
                  log::warn!("Failed to seek to start position: {}", e);
                }
              }

              log::info!("Started playback: {}", url);
            }
            MpvAction::Pause => {
              if let Err(e) = mpv.set_pause(true).await {
                log::error!("Failed to pause: {}", e);
              }
            }
            MpvAction::Resume => {
              if let Err(e) = mpv.set_pause(false).await {
                log::error!("Failed to resume: {}", e);
              }
            }
            MpvAction::Seek(position) => {
              if let Err(e) = mpv.seek(position).await {
                log::error!("Failed to seek: {}", e);
              }
            }
            MpvAction::Stop => {
              mpv.stop();
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
    cmd: JellyfinCommand,
  ) -> Result<(), JellyfinError> {
    match cmd {
      JellyfinCommand::Play(request) => {
        Self::handle_play(client, state, action_tx, request).await?;
      }
      JellyfinCommand::Playstate(request) => {
        Self::handle_playstate(state, action_tx, request).await?;
      }
      JellyfinCommand::GeneralCommand(request) => {
        Self::handle_general_command(action_tx, request).await?;
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
    // Get the first item ID
    let item_id = request
      .item_ids
      .first()
      .ok_or(JellyfinError::SessionNotFound)?;

    // Get playback info
    let playback_info = client
      .get_playback_info(
        item_id,
        request.audio_stream_index,
        request.subtitle_stream_index,
      )
      .await?;

    // Get the best media source
    let media_source = playback_info
      .media_sources
      .first()
      .ok_or(JellyfinError::SessionNotFound)?;

    // Build stream URL
    let url = client
      .build_stream_url(item_id, media_source)
      .ok_or(JellyfinError::NotConnected)?;

    // Calculate start position
    let start_position = request
      .start_position_ticks
      .map(ticks_to_seconds)
      .unwrap_or(0.0);

    // Store playback session
    {
      let mut s = state.write();
      s.playback = Some(PlaybackSession {
        item_id: item_id.clone(),
        media_source_id: Some(media_source.id.clone()),
        play_session_id: playback_info.play_session_id.clone(),
        position_ticks: request.start_position_ticks.unwrap_or(0),
        is_paused: false,
        volume: 100,
        audio_stream_index: request.audio_stream_index,
        subtitle_stream_index: request.subtitle_stream_index,
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
      audio_stream_index: request.audio_stream_index,
      subtitle_stream_index: request.subtitle_stream_index,
      play_method: if media_source.supports_direct_play {
        "DirectPlay".to_string()
      } else if media_source.supports_direct_stream {
        "DirectStream".to_string()
      } else {
        "Transcode".to_string()
      },
    };
    client.report_playback_start(&start_info).await?;

    // Send action to MPV
    let _ = action_tx
      .send(MpvAction::Play {
        url,
        start_position,
      })
      .await;

    Ok(())
  }

  /// Handle Playstate command.
  async fn handle_playstate(
    state: &RwLock<SessionState>,
    action_tx: &mpsc::Sender<MpvAction>,
    request: PlaystateRequest,
  ) -> Result<(), JellyfinError> {
    match request.command.as_str() {
      "Pause" => {
        {
          let mut s = state.write();
          if let Some(ref mut playback) = s.playback {
            playback.is_paused = true;
          }
        }
        let _ = action_tx.send(MpvAction::Pause).await;
      }
      "Unpause" => {
        {
          let mut s = state.write();
          if let Some(ref mut playback) = s.playback {
            playback.is_paused = false;
          }
        }
        let _ = action_tx.send(MpvAction::Resume).await;
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
        {
          let mut s = state.write();
          s.playback = None;
        }
        let _ = action_tx.send(MpvAction::Stop).await;
      }
      _ => {
        log::warn!("Unhandled playstate command: {}", request.command);
      }
    }
    Ok(())
  }

  /// Handle GeneralCommand.
  async fn handle_general_command(
    action_tx: &mpsc::Sender<MpvAction>,
    request: GeneralCommand,
  ) -> Result<(), JellyfinError> {
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
      _ => {
        log::debug!("Unhandled general command: {}", request.name);
      }
    }
    Ok(())
  }

  /// Start periodic progress reporting.
  fn start_progress_reporting(&self) {
    let client = self.client.clone();
    let mpv = self.mpv.clone();
    let state = self.state.clone();

    tokio::spawn(async move {
      let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));

      loop {
        interval.tick().await;

        // Get current playback session
        let session = {
          let s = state.read();
          s.playback.clone()
        };

        if let Some(session) = session {
          // Get current position from MPV
          if let Ok(position) = mpv.get_time_pos().await {
            let position_ticks = seconds_to_ticks(position);

            // Update state
            {
              let mut s = state.write();
              if let Some(ref mut playback) = s.playback {
                playback.position_ticks = position_ticks;
              }
            }

            // Report progress
            let progress = PlaybackProgressInfo {
              item_id: session.item_id,
              media_source_id: session.media_source_id,
              play_session_id: session.play_session_id,
              position_ticks: Some(position_ticks),
              is_paused: session.is_paused,
              is_muted: false,
              volume_level: session.volume,
              audio_stream_index: session.audio_stream_index,
              subtitle_stream_index: session.subtitle_stream_index,
              play_method: "DirectPlay".to_string(),
            };

            if let Err(e) = client.report_playback_progress(&progress).await {
              log::error!("Failed to report playback progress: {}", e);
            }
          }
        }
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
