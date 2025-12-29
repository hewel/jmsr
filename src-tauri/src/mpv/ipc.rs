//! Async IPC connection to MPV.
//!
//! Handles platform-specific socket/pipe connections.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use async_channel::{Receiver, Sender};
use parking_lot::Mutex;
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::oneshot;
use tokio::task::JoinHandle;

use super::protocol::{MpvCommand, MpvEvent, MpvMessage, MpvResponse};

#[derive(Error, Debug)]
pub enum IpcError {
  #[error("Connection failed: {0}")]
  ConnectionFailed(String),
  #[error("Write failed: {0}")]
  WriteFailed(#[from] std::io::Error),
  #[error("Command timeout")]
  Timeout,
  #[error("MPV error: {0}")]
  MpvError(String),
  #[error("Disconnected")]
  Disconnected,
}

/// Pending request waiting for response.
type PendingRequest = oneshot::Sender<Result<MpvResponse, IpcError>>;

/// IPC connection state shared between writer and reader.
struct IpcState {
  pending: HashMap<i64, PendingRequest>,
}

/// Writer channel message.
enum WriteMessage {
  Command(Vec<u8>),
  Close,
}

/// MPV IPC connection.
pub struct MpvIpc {
  state: Arc<Mutex<IpcState>>,
  write_tx: async_channel::Sender<WriteMessage>,
  event_rx: Receiver<MpvEvent>,
  _reader_handle: JoinHandle<()>,
  _writer_handle: JoinHandle<()>,
}

impl MpvIpc {
  /// Connect to MPV IPC socket/pipe.
  pub async fn connect(path: &str, retry_count: u32) -> Result<Self, IpcError> {
    let mut last_error = None;

    for attempt in 0..retry_count {
      if attempt > 0 {
        tokio::time::sleep(Duration::from_millis(100 * (attempt as u64 + 1))).await;
      }

      match Self::try_connect(path).await {
        Ok(ipc) => return Ok(ipc),
        Err(e) => {
          log::debug!("IPC connect attempt {} failed: {}", attempt + 1, e);
          last_error = Some(e);
        }
      }
    }

    Err(last_error.unwrap_or_else(|| IpcError::ConnectionFailed("Unknown error".into())))
  }

  #[cfg(windows)]
  async fn try_connect(path: &str) -> Result<Self, IpcError> {
    use tokio::net::windows::named_pipe::ClientOptions;

    let client = ClientOptions::new()
      .open(path)
      .map_err(|e| IpcError::ConnectionFailed(format!("Failed to open pipe: {}", e)))?;

    let (reader, writer) = tokio::io::split(client);
    Self::setup(reader, writer).await
  }

  #[cfg(not(windows))]
  async fn try_connect(path: &str) -> Result<Self, IpcError> {
    use tokio::net::UnixStream;

    let stream = UnixStream::connect(path)
      .await
      .map_err(|e| IpcError::ConnectionFailed(e.to_string()))?;

    let (reader, writer) = tokio::io::split(stream);
    Self::setup(reader, writer).await
  }

  async fn setup<R, W>(reader: R, writer: W) -> Result<Self, IpcError>
  where
    R: tokio::io::AsyncRead + Send + Unpin + 'static,
    W: tokio::io::AsyncWrite + Send + Unpin + 'static,
  {
    let state = Arc::new(Mutex::new(IpcState {
      pending: HashMap::new(),
    }));

    let (event_tx, event_rx) = async_channel::unbounded();
    let (write_tx, write_rx) = async_channel::unbounded::<WriteMessage>();

    // Spawn reader task
    let reader_state = state.clone();
    let reader_handle = tokio::spawn(async move {
      Self::reader_loop(reader, reader_state, event_tx).await;
    });

    // Spawn writer task
    let writer_handle = tokio::spawn(async move {
      Self::writer_loop(writer, write_rx).await;
    });

    Ok(Self {
      state,
      write_tx,
      event_rx,
      _reader_handle: reader_handle,
      _writer_handle: writer_handle,
    })
  }

  async fn reader_loop<R: tokio::io::AsyncRead + Unpin>(
    reader: R,
    state: Arc<Mutex<IpcState>>,
    event_tx: Sender<MpvEvent>,
  ) {
    log::info!("MPV IPC reader loop started");
    let mut buf_reader = BufReader::new(reader);
    let mut line = String::new();

    loop {
      line.clear();
      match buf_reader.read_line(&mut line).await {
        Ok(0) => {
          log::info!("MPV IPC connection closed");
          break;
        }
        Ok(_) => {
          let trimmed = line.trim();
          if trimmed.is_empty() {
            continue;
          }

          match MpvMessage::parse(trimmed) {
            Ok(MpvMessage::Response(response)) => {
              log::info!(
                "MPV reader: received response for request_id={}",
                response.request_id
              );
              let mut state = state.lock();
              if let Some(tx) = state.pending.remove(&response.request_id) {
                let _ = tx.send(Ok(response));
              }
            }
            Ok(MpvMessage::Event(event)) => {
              log::info!("MPV reader: received event {:?}", event);
              let _ = event_tx.send(event).await;
            }
            Err(e) => {
              log::warn!("Failed to parse MPV message: {} - {}", e, trimmed);
            }
          }
        }
        Err(e) => {
          log::error!("MPV IPC read error: {}", e);
          break;
        }
      }
    }
  }

  async fn writer_loop<W: tokio::io::AsyncWrite + Unpin>(
    mut writer: W,
    write_rx: async_channel::Receiver<WriteMessage>,
  ) {
    log::info!("MPV IPC writer loop started");

    while let Ok(msg) = write_rx.recv().await {
      match msg {
        WriteMessage::Command(data) => {
          if let Err(e) = writer.write_all(&data).await {
            log::error!("MPV IPC write error: {}", e);
            break;
          }
          if let Err(e) = writer.write_all(b"\n").await {
            log::error!("MPV IPC write newline error: {}", e);
            break;
          }
          if let Err(e) = writer.flush().await {
            log::error!("MPV IPC flush error: {}", e);
            break;
          }
          log::info!("MPV command written to pipe");
        }
        WriteMessage::Close => {
          log::info!("MPV IPC writer closing");
          break;
        }
      }
    }
  }

  /// Send a command to MPV and wait for response.
  pub async fn send_command(&self, cmd: MpvCommand) -> Result<MpvResponse, IpcError> {
    let request_id = cmd.request_id;

    // Create response channel
    let (tx, rx) = oneshot::channel();

    // Register pending request
    {
      let mut state = self.state.lock();
      state.pending.insert(request_id, tx);
    }

    // Serialize and send
    let json = serde_json::to_string(&cmd).map_err(|e| IpcError::WriteFailed(e.into()))?;
    log::info!("Sending MPV command: {}", json);

    // Send to writer task
    self
      .write_tx
      .send(WriteMessage::Command(json.into_bytes()))
      .await
      .map_err(|_| IpcError::Disconnected)?;

    log::info!("MPV command queued, waiting for response...");

    // Wait for response with timeout
    match tokio::time::timeout(Duration::from_secs(5), rx).await {
      Ok(Ok(result)) => {
        log::info!("MPV response received: {:?}", result);
        result
      }
      Ok(Err(_)) => {
        log::error!("MPV IPC channel closed unexpectedly");
        Err(IpcError::Disconnected)
      }
      Err(_) => {
        // Remove pending request on timeout
        log::error!(
          "MPV command timeout after 5 seconds, request_id={}",
          request_id
        );
        let mut state = self.state.lock();
        state.pending.remove(&request_id);
        Err(IpcError::Timeout)
      }
    }
  }

  /// Get the event receiver for property changes and other events.
  pub fn events(&self) -> Receiver<MpvEvent> {
    self.event_rx.clone()
  }

  /// Close the connection.
  pub fn close(&self) {
    let _ = self.write_tx.send_blocking(WriteMessage::Close);
  }
}
