//! Async IPC connection to MPV.
//!
//! Handles platform-specific socket/pipe connections.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::sync::Arc;
use std::time::Duration;

use async_channel::{Receiver, Sender};
use parking_lot::Mutex;
use thiserror::Error;
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

/// MPV IPC connection.
pub struct MpvIpc {
  state: Arc<Mutex<IpcState>>,
  writer: Arc<Mutex<Option<Box<dyn Write + Send>>>>,
  event_rx: Receiver<MpvEvent>,
  _reader_handle: JoinHandle<()>,
}

impl MpvIpc {
  /// Connect to MPV IPC socket/pipe.
  pub async fn connect(path: &str, retry_count: u32) -> Result<Self, IpcError> {
    let mut last_error = None;

    for attempt in 0..retry_count {
      if attempt > 0 {
        tokio::time::sleep(Duration::from_millis(100 * (attempt as u64 + 1))).await;
      }

      match Self::try_connect(path) {
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
  fn try_connect(path: &str) -> Result<Self, IpcError> {
    use std::fs::OpenOptions;

    let pipe = OpenOptions::new()
      .read(true)
      .write(true)
      .open(path)
      .map_err(|e| IpcError::ConnectionFailed(e.to_string()))?;

    let reader = pipe.try_clone().map_err(|e| IpcError::ConnectionFailed(e.to_string()))?;
    let writer: Box<dyn Write + Send> = Box::new(pipe);

    Self::setup(reader, writer)
  }

  #[cfg(not(windows))]
  fn try_connect(path: &str) -> Result<Self, IpcError> {
    use std::os::unix::net::UnixStream;

    let stream =
      UnixStream::connect(path).map_err(|e| IpcError::ConnectionFailed(e.to_string()))?;

    let reader = stream.try_clone().map_err(|e| IpcError::ConnectionFailed(e.to_string()))?;
    let writer: Box<dyn Write + Send> = Box::new(stream);

    Self::setup(reader, writer)
  }

  fn setup<R: std::io::Read + Send + 'static>(
    reader: R,
    writer: Box<dyn Write + Send>,
  ) -> Result<Self, IpcError> {
    let state = Arc::new(Mutex::new(IpcState {
      pending: HashMap::new(),
    }));

    let (event_tx, event_rx) = async_channel::unbounded();
    let writer = Arc::new(Mutex::new(Some(writer)));

    let reader_state = state.clone();
    let reader_handle = tokio::task::spawn_blocking(move || {
      Self::reader_loop(reader, reader_state, event_tx);
    });

    Ok(Self {
      state,
      writer,
      event_rx,
      _reader_handle: reader_handle,
    })
  }

  fn reader_loop<R: std::io::Read>(
    reader: R,
    state: Arc<Mutex<IpcState>>,
    event_tx: Sender<MpvEvent>,
  ) {
    let mut buf_reader = BufReader::new(reader);
    let mut line = String::new();

    loop {
      line.clear();
      match buf_reader.read_line(&mut line) {
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
              let mut state = state.lock();
              if let Some(tx) = state.pending.remove(&response.request_id) {
                let _ = tx.send(Ok(response));
              }
            }
            Ok(MpvMessage::Event(event)) => {
              let _ = event_tx.send_blocking(event);
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

    {
      let mut writer_guard = self.writer.lock();
      let writer = writer_guard.as_mut().ok_or(IpcError::Disconnected)?;
      writer.write_all(json.as_bytes())?;
      writer.write_all(b"\n")?;
      writer.flush()?;
    }

    // Wait for response with timeout
    match tokio::time::timeout(Duration::from_secs(5), rx).await {
      Ok(Ok(result)) => result,
      Ok(Err(_)) => Err(IpcError::Disconnected),
      Err(_) => {
        // Remove pending request on timeout
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
    let mut writer = self.writer.lock();
    *writer = None;
  }
}
