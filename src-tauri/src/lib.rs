use std::sync::Arc;

mod command;
mod config;
mod jellyfin;
mod mpv;
mod tray;

pub use config::AppConfig;
use command::{ConfigState, JellyfinState, MpvState};
use jellyfin::JellyfinClient;
use mpv::MpvClient;
use parking_lot::RwLock;
use tauri::WindowEvent;
use tauri_plugin_log::{Target, TargetKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = command::command_builder();

  // Create config state with defaults (will be updated in setup after store is available)
  let config = Arc::new(RwLock::new(AppConfig::default()));
  let config_state = ConfigState(config.clone());
  let config_for_setup = config.clone();

  // Create MPV client state
  let mpv_client = Arc::new(MpvClient::new(None));
  let mpv_state = MpvState(mpv_client.clone());

  // Create Jellyfin client state
  let jellyfin_client = Arc::new(JellyfinClient::new());
  let jellyfin_state = JellyfinState::new(jellyfin_client, mpv_client);

  tauri::Builder::default()
    .manage(config_state)
    .manage(mpv_state)
    .manage(jellyfin_state)
    .invoke_handler(builder.invoke_handler())
    .plugin(tauri_plugin_store::Builder::new().build())
    .setup(move |app| {
      // Setup logging with webview target for in-app log viewing
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::Webview),
          ])
          .build(),
      )?;

      // Load config from disk (store plugin is now available)
      let loaded_config = command::load_config_from_store(app.handle());
      *config_for_setup.write() = loaded_config;

      // Setup system tray
      if let Err(e) = tray::setup_tray(app) {
        log::error!("Failed to setup system tray: {}", e);
      }

      builder.mount_events(app);
      Ok(())
    })
    .on_window_event(|window, event| {
      // Hide window to tray on close instead of quitting
      if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
