//! High-level MPV client with command methods.

use std::path::PathBuf;
use std::process::Child;
use std::sync::Arc;
use std::time::Duration;

use async_channel::Receiver;
use parking_lot::Mutex;
use thiserror::Error;

use super::ipc::{IpcError, MpvIpc};
use super::process::{cleanup_ipc, ipc_path, spawn_mpv, ProcessError};
use super::protocol::{MpvCommand, MpvEvent, MpvResponse, PropertyValue};

#[derive(Error, Debug)]
pub enum MpvError {
  #[error("Process error: {0}")]
  Process(#[from] ProcessError),
  #[error("IPC error: {0}")]
  Ipc(#[from] IpcError),
  #[error("MPV command failed: {0}")]
  CommandFailed(String),
  #[error("Not connected")]
  NotConnected,
}

/// High-level MPV client.
pub struct MpvClient {
  mpv_path: Option<PathBuf>,
  process: Arc<Mutex<Option<Child>>>,
  ipc: Arc<Mutex<Option<Arc<MpvIpc>>>>,
}

impl MpvClient {
  /// Create a new MPV client.
  pub fn new(mpv_path: Option<PathBuf>) -> Self {
    Self {
      mpv_path,
      process: Arc::new(Mutex::new(None)),
      ipc: Arc::new(Mutex::new(None)),
    }
  }

  /// Start MPV and connect to IPC.
  pub async fn start(&self) -> Result<(), MpvError> {
    // Cleanup any existing socket
    cleanup_ipc();

    // Spawn MPV process
    let child = spawn_mpv(self.mpv_path.as_ref())?;
    {
      let mut process = self.process.lock();
      *process = Some(child);
    }

    // Wait a bit for MPV to create the socket
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Connect to IPC with retries
    let ipc_conn = MpvIpc::connect(&ipc_path(), 10).await?;
    {
      let mut ipc = self.ipc.lock();
      *ipc = Some(Arc::new(ipc_conn));
    }

    log::info!("MPV client connected");
    Ok(())
  }

  /// Stop MPV and disconnect.
  pub fn stop(&self) {
    // Close IPC first
    {
      let mut ipc = self.ipc.lock();
      if let Some(conn) = ipc.take() {
        conn.close();
      }
    }

    // Kill process
    {
      let mut process = self.process.lock();
      if let Some(mut child) = process.take() {
        let _ = child.kill();
        let _ = child.wait();
      }
    }

    cleanup_ipc();
    log::info!("MPV client stopped");
  }

  /// Check if connected.
  pub fn is_connected(&self) -> bool {
    self.ipc.lock().is_some()
  }

  /// Get a clone of the IPC connection.
  fn get_ipc(&self) -> Result<Arc<MpvIpc>, MpvError> {
    let guard = self.ipc.lock();
    guard.clone().ok_or(MpvError::NotConnected)
  }

  /// Send a command to MPV.
  async fn send(&self, cmd: MpvCommand) -> Result<MpvResponse, MpvError> {
    let ipc = self.get_ipc()?;
    let response = ipc.send_command(cmd).await?;

    if !response.is_success() {
      return Err(MpvError::CommandFailed(response.error));
    }

    Ok(response)
  }

  /// Load a file for playback.
  pub async fn loadfile(&self, url: &str) -> Result<(), MpvError> {
    self.send(MpvCommand::loadfile(url)).await?;
    Ok(())
  }

  /// Seek to absolute position in seconds.
  pub async fn seek(&self, time: f64) -> Result<(), MpvError> {
    self.send(MpvCommand::seek(time)).await?;
    Ok(())
  }

  /// Set pause state.
  pub async fn set_pause(&self, paused: bool) -> Result<(), MpvError> {
    self.send(MpvCommand::set_pause(paused)).await?;
    Ok(())
  }

  /// Set volume (0-100).
  pub async fn set_volume(&self, volume: f64) -> Result<(), MpvError> {
    self.send(MpvCommand::set_volume(volume)).await?;
    Ok(())
  }

  /// Set audio track by ID.
  pub async fn set_audio_track(&self, id: i64) -> Result<(), MpvError> {
    self.send(MpvCommand::set_audio_track(id)).await?;
    Ok(())
  }

  /// Set subtitle track by ID.
  pub async fn set_subtitle_track(&self, id: i64) -> Result<(), MpvError> {
    self.send(MpvCommand::set_subtitle_track(id)).await?;
    Ok(())
  }

  /// Get a property value.
  pub async fn get_property(&self, name: &str) -> Result<PropertyValue, MpvError> {
    let response = self.send(MpvCommand::get_property(name)).await?;
    Ok(response.data.map(PropertyValue::from).unwrap_or(PropertyValue::Null))
  }

  /// Get current time position in seconds.
  pub async fn get_time_pos(&self) -> Result<f64, MpvError> {
    match self.get_property("time-pos").await? {
      PropertyValue::Number(n) => Ok(n),
      _ => Ok(0.0),
    }
  }

  /// Get current pause state.
  pub async fn get_pause(&self) -> Result<bool, MpvError> {
    match self.get_property("pause").await? {
      PropertyValue::Bool(b) => Ok(b),
      _ => Ok(true),
    }
  }

  /// Get current volume.
  pub async fn get_volume(&self) -> Result<f64, MpvError> {
    match self.get_property("volume").await? {
      PropertyValue::Number(n) => Ok(n),
      _ => Ok(100.0),
    }
  }

  /// Start observing a property.
  pub async fn observe_property(&self, id: i64, name: &str) -> Result<(), MpvError> {
    self.send(MpvCommand::observe_property(id, name)).await?;
    Ok(())
  }

  /// Stop observing a property.
  pub async fn unobserve_property(&self, id: i64) -> Result<(), MpvError> {
    self.send(MpvCommand::unobserve_property(id)).await?;
    Ok(())
  }

  /// Quit MPV gracefully.
  pub async fn quit(&self) -> Result<(), MpvError> {
    let _ = self.send(MpvCommand::quit()).await;
    self.stop();
    Ok(())
  }

  /// Get event receiver for property changes and other events.
  pub fn events(&self) -> Option<Receiver<MpvEvent>> {
    let guard = self.ipc.lock();
    guard.as_ref().map(|ipc| ipc.events())
  }
}

impl Drop for MpvClient {
  fn drop(&mut self) {
    self.stop();
  }
}

// Need to implement Clone manually because Child doesn't implement Clone
impl Clone for MpvClient {
  fn clone(&self) -> Self {
    Self {
      mpv_path: self.mpv_path.clone(),
      process: self.process.clone(),
      ipc: self.ipc.clone(),
    }
  }
}
