//! Application configuration with persistence.

use serde::{Deserialize, Serialize};
use specta::Type;

/// Application configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
  /// Custom MPV executable path (None = auto-detect).
  #[serde(default)]
  pub mpv_path: Option<String>,

  /// Additional MPV command-line arguments.
  #[serde(default)]
  pub mpv_args: Vec<String>,

  /// Device name shown in Jellyfin cast menu.
  #[serde(default = "default_device_name")]
  pub device_name: String,

  /// Progress reporting interval in seconds.
  #[serde(default = "default_progress_interval")]
  pub progress_interval: u32,

  /// Start minimized to system tray.
  #[serde(default)]
  pub start_minimized: bool,

  /// Keybinding for next episode in MPV.
  #[serde(default = "default_keybind_next")]
  pub keybind_next: String,

  /// Keybinding for previous episode in MPV.
  #[serde(default = "default_keybind_prev")]
  pub keybind_prev: String,
}

fn default_device_name() -> String {
  "JMSR".to_string()
}

fn default_progress_interval() -> u32 {
  5
}

fn default_keybind_next() -> String {
  "Shift+n".to_string()
}

fn default_keybind_prev() -> String {
  "Shift+p".to_string()
}

impl Default for AppConfig {
  fn default() -> Self {
    Self {
      mpv_path: None,
      mpv_args: Vec::new(),
      device_name: default_device_name(),
      progress_interval: default_progress_interval(),
      start_minimized: false,
      keybind_next: default_keybind_next(),
      keybind_prev: default_keybind_prev(),
    }
  }
}

impl AppConfig {
  /// Validate configuration values.
  pub fn validate(&self) -> Result<(), String> {
    if self.device_name.trim().is_empty() {
      return Err("Device name cannot be empty".to_string());
    }
    if self.progress_interval < 1 || self.progress_interval > 60 {
      return Err("Progress interval must be between 1 and 60 seconds".to_string());
    }
    if self.keybind_next.trim().is_empty() {
      return Err("Next episode keybinding cannot be empty".to_string());
    }
    if self.keybind_prev.trim().is_empty() {
      return Err("Previous episode keybinding cannot be empty".to_string());
    }
    Ok(())
  }
}
