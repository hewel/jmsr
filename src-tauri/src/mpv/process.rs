//! MPV process detection and spawning.

use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ProcessError {
  #[error("MPV executable not found")]
  NotFound,
  #[error("Failed to spawn MPV: {0}")]
  SpawnFailed(#[from] std::io::Error),
}

/// Get the IPC socket/pipe path for MPV.
pub fn ipc_path() -> String {
  #[cfg(windows)]
  {
    r"\\.\pipe\jmsr-mpv".to_string()
  }
  #[cfg(not(windows))]
  {
    "/tmp/jmsr-mpv.sock".to_string()
  }
}

/// Find MPV executable in common locations.
pub fn find_mpv() -> Option<PathBuf> {
  // Check PATH first
  if let Ok(path) = which::which("mpv") {
    return Some(path);
  }

  // Platform-specific common locations
  #[cfg(windows)]
  {
    let common_paths = [
      r"C:\Program Files\mpv\mpv.exe",
      r"C:\Program Files (x86)\mpv\mpv.exe",
      r"C:\mpv\mpv.exe",
    ];
    for path in common_paths {
      let p = PathBuf::from(path);
      if p.exists() {
        return Some(p);
      }
    }
  }

  #[cfg(target_os = "macos")]
  {
    let common_paths = [
      "/usr/local/bin/mpv",
      "/opt/homebrew/bin/mpv",
      "/Applications/mpv.app/Contents/MacOS/mpv",
    ];
    for path in common_paths {
      let p = PathBuf::from(path);
      if p.exists() {
        return Some(p);
      }
    }
  }

  #[cfg(target_os = "linux")]
  {
    let common_paths = ["/usr/bin/mpv", "/usr/local/bin/mpv"];
    for path in common_paths {
      let p = PathBuf::from(path);
      if p.exists() {
        return Some(p);
      }
    }
  }

  None
}

/// Spawn MPV process with IPC server enabled.
pub fn spawn_mpv(mpv_path: Option<&PathBuf>, extra_args: &[String]) -> Result<Child, ProcessError> {
  let mpv_exe = mpv_path
    .cloned()
    .or_else(find_mpv)
    .ok_or(ProcessError::NotFound)?;

  let ipc = ipc_path();

  log::info!("Spawning MPV: {:?} with IPC: {}", mpv_exe, ipc);
  if !extra_args.is_empty() {
    log::info!("Extra MPV args: {:?}", extra_args);
  }

  let mut cmd = Command::new(&mpv_exe);
  cmd
    .arg(format!("--input-ipc-server={}", ipc))
    .arg("--idle")
    .arg("--force-window")
    .arg("--keep-open=no")
    .arg("--no-terminal");

  // Add user-specified extra arguments
  for arg in extra_args {
    cmd.arg(arg);
  }

  let child = cmd
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()?;

  Ok(child)
}

/// Kill MPV process and cleanup socket.
pub fn cleanup_ipc() {
  #[cfg(not(windows))]
  {
    let path = ipc_path();
    let _ = std::fs::remove_file(&path);
  }
  // Windows named pipes are cleaned up automatically
}
