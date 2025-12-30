//! WebSocket handler for Jellyfin remote control.

use futures_util::{SinkExt, StreamExt};
use parking_lot::RwLock;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};

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

/// WebSocket connection to Jellyfin server.
pub struct JellyfinWebSocket {
  command_tx: mpsc::Sender<JellyfinCommand>,
  command_rx: Arc<RwLock<Option<mpsc::Receiver<JellyfinCommand>>>>,
  connected: Arc<RwLock<bool>>,
  shutdown_tx: Arc<RwLock<Option<mpsc::Sender<()>>>>,
}

impl JellyfinWebSocket {
  /// Create a new WebSocket handler.
  pub fn new() -> Self {
    let (command_tx, command_rx) = mpsc::channel(32);
    Self {
      command_tx,
      command_rx: Arc::new(RwLock::new(Some(command_rx))),
      connected: Arc::new(RwLock::new(false)),
      shutdown_tx: Arc::new(RwLock::new(None)),
    }
  }

  /// Connect to Jellyfin WebSocket.
  /// Accepts optional capabilities JSON to send via WebSocket (Double Report Strategy).
  pub async fn connect(
    &self,
    url: &str,
    capabilities: Option<serde_json::Value>,
  ) -> Result<(), JellyfinError> {
    let (ws_stream, _) = connect_async(url).await?;
    let (mut write, mut read) = ws_stream.split();

    *self.connected.write() = true;

    // Create shutdown channel
    let (shutdown_tx, mut shutdown_rx) = mpsc::channel::<()>(1);
    *self.shutdown_tx.write() = Some(shutdown_tx);

    let connected = self.connected.clone();
    let command_tx = self.command_tx.clone();

    // Spawn WebSocket reader task
    tokio::spawn(async move {
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

      // FIX 2: Send Capabilities via WebSocket (Double Report Strategy)
      if let Some(caps) = capabilities {
        let report_caps = serde_json::json!({
          "MessageType": "ReportCapabilities",
          "Data": caps
        });
        log::info!("Reporting capabilities via WebSocket");
        if let Err(e) = write
          .send(Message::Text(report_caps.to_string().into()))
          .await
        {
          log::error!("Failed to send ReportCapabilities via WS: {}", e);
        }
      }

      // Keep-alive interval
      let mut keepalive_interval = tokio::time::interval(std::time::Duration::from_secs(30));

      loop {
        tokio::select! {
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
          _ = shutdown_rx.recv() => {
            log::info!("WebSocket shutdown requested");
            let _ = write.close().await;
            break;
          }
        }
      }

      *connected.write() = false;
    });

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
    // Take the sender without holding lock across await
    let tx = self.shutdown_tx.write().take();
    if let Some(tx) = tx {
      let _ = tx.send(()).await;
    }
    *self.connected.write() = false;
  }

  /// Take the command receiver (can only be called once).
  pub fn take_command_receiver(&self) -> Option<mpsc::Receiver<JellyfinCommand>> {
    self.command_rx.write().take()
  }
}

impl Default for JellyfinWebSocket {
  fn default() -> Self {
    Self::new()
  }
}
