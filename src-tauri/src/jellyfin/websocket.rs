//! WebSocket handler for Jellyfin remote control.

use futures_util::{SinkExt, StreamExt};
use parking_lot::RwLock;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tokio_util::sync::CancellationToken;

use super::error::JellyfinError;
use super::types::*;

/// Commands that can be received from Jellyfin.
#[derive(Debug, Clone)]
pub enum JellyfinCommand {
  /// Play media items.
  Play(PlayRequest),
  /// Playstate command (pause, unpause, seek, stop).
  Playstate(PlaystateRequest),
  /// General command (volume, mute, etc.).
  GeneralCommand(GeneralCommand),
}

/// Internal state for channel management.
struct ChannelState {
  command_tx: mpsc::Sender<JellyfinCommand>,
  command_rx: Option<mpsc::Receiver<JellyfinCommand>>,
}

/// WebSocket connection to Jellyfin server.
pub struct JellyfinWebSocket {
  channel: Arc<RwLock<ChannelState>>,
  connected: Arc<RwLock<bool>>,
  cancel_token: Arc<RwLock<Option<CancellationToken>>>,
  task_handle: Arc<RwLock<Option<JoinHandle<()>>>>,
}

impl JellyfinWebSocket {
  /// Create a new WebSocket handler.
  pub fn new() -> Self {
    let (command_tx, command_rx) = mpsc::channel(32);
    Self {
      channel: Arc::new(RwLock::new(ChannelState {
        command_tx,
        command_rx: Some(command_rx),
      })),
      connected: Arc::new(RwLock::new(false)),
      cancel_token: Arc::new(RwLock::new(None)),
      task_handle: Arc::new(RwLock::new(None)),
    }
  }

  /// Reset channels for a fresh connection.
  /// This creates new tx/rx pairs, allowing the receiver to be taken again.
  pub fn reset_channels(&self) {
    let (command_tx, command_rx) = mpsc::channel(32);
    let mut channel = self.channel.write();
    channel.command_tx = command_tx;
    channel.command_rx = Some(command_rx);
  }

  /// Connect to Jellyfin WebSocket.
  /// Accepts optional capabilities JSON to send via WebSocket (Double Report Strategy).
  pub async fn connect(
    &self,
    url: &str,
  ) -> Result<(), JellyfinError> {
    // Cancel any existing connection
    self.disconnect().await;

    // Reset channels for fresh receiver
    self.reset_channels();

    let (ws_stream, _) = connect_async(url).await?;
    let (mut write, mut read) = ws_stream.split();

    *self.connected.write() = true;

    // Create cancellation token
    let cancel_token = CancellationToken::new();
    *self.cancel_token.write() = Some(cancel_token.clone());

    let connected = self.connected.clone();
    let command_tx = self.channel.read().command_tx.clone();

    // Spawn WebSocket reader task
    let handle = tokio::spawn(async move {
      // FIX 1: "1000,1000" tells the server we are an ACTIVE client
      let session_start = serde_json::json!({
        "MessageType": "SessionsStart",
        "Data": "1000,1000"
      });
      if let Err(e) = write
        .send(Message::Text(session_start.to_string().into()))
        .await
      {
        log::error!("Failed to send SessionsStart: {}", e);
        *connected.write() = false;
        return;
      }

      // Keep-alive interval
      let mut keepalive_interval = tokio::time::interval(std::time::Duration::from_secs(30));

      loop {
        tokio::select! {
          _ = cancel_token.cancelled() => {
            log::info!("WebSocket shutdown requested via cancellation");
            let _ = write.close().await;
            break;
          }
          msg = read.next() => {
            match msg {
              Some(Ok(Message::Text(text))) => {
                if let Err(e) = Self::handle_message(&text, &command_tx).await {
                  log::error!("Failed to handle WebSocket message: {}", e);
                }
              }
              Some(Ok(Message::Close(_))) => {
                log::info!("WebSocket closed by server");
                break;
              }
              Some(Err(e)) => {
                log::error!("WebSocket error: {}", e);
                break;
              }
              None => {
                log::info!("WebSocket stream ended");
                break;
              }
              _ => {}
            }
          }
          _ = keepalive_interval.tick() => {
            let keepalive = serde_json::json!({
              "MessageType": "KeepAlive"
            });
            if let Err(e) = write.send(Message::Text(keepalive.to_string().into())).await {
              log::error!("Failed to send keepalive: {}", e);
              break;
            }
          }
        }
      }

      *connected.write() = false;
    });

    *self.task_handle.write() = Some(handle);

    Ok(())
  }

  /// Handle incoming WebSocket message.
  async fn handle_message(
    text: &str,
    command_tx: &mpsc::Sender<JellyfinCommand>,
  ) -> Result<(), JellyfinError> {
    let msg: WsMessage = serde_json::from_str(text)?;

    match msg.message_type.as_str() {
      "Play" => {
        if let Some(data) = msg.data {
          let play_request: PlayRequest = serde_json::from_value(data)?;
          log::info!("Received Play command: {:?}", play_request);
          let _ = command_tx.send(JellyfinCommand::Play(play_request)).await;
        }
      }
      "Playstate" => {
        if let Some(data) = msg.data {
          let playstate: PlaystateRequest = serde_json::from_value(data)?;
          log::info!("Received Playstate command: {:?}", playstate);
          let _ = command_tx.send(JellyfinCommand::Playstate(playstate)).await;
        }
      }
      "GeneralCommand" => {
        if let Some(data) = msg.data {
          let command: GeneralCommand = serde_json::from_value(data)?;
          log::info!("Received GeneralCommand: {:?}", command);
          let _ = command_tx
            .send(JellyfinCommand::GeneralCommand(command))
            .await;
        }
      }
      "ForceKeepAlive" | "KeepAlive" => {
        // Ignore keepalive messages
      }
      _ => {
        log::debug!("Unhandled WebSocket message type: {}", msg.message_type);
      }
    }

    Ok(())
  }

  /// Disconnect from WebSocket.
  pub async fn disconnect(&self) {
    // Cancel the task via token
    if let Some(token) = self.cancel_token.write().take() {
      token.cancel();
    }

    // Take the handle without holding the lock across await
    let handle = self.task_handle.write().take();
    if let Some(handle) = handle {
      let _ = tokio::time::timeout(std::time::Duration::from_secs(2), handle).await;
    }

    *self.connected.write() = false;
  }

  /// Check if connected.
  #[allow(dead_code)]
  pub fn is_connected(&self) -> bool {
    *self.connected.read()
  }

  /// Take the command receiver (can be called after each connect).
  pub fn take_command_receiver(&self) -> Option<mpsc::Receiver<JellyfinCommand>> {
    self.channel.write().command_rx.take()
  }
}

impl Default for JellyfinWebSocket {
  fn default() -> Self {
    Self::new()
  }
}
