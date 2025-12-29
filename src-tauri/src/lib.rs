use std::sync::Arc;

mod command;
mod jellyfin;
mod mpv;
mod tray;

use command::{JellyfinState, MpvState};
use jellyfin::JellyfinClient;
use mpv::MpvClient;
use tauri::WindowEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = command::command_builder();

  // Create MPV client state
  let mpv_client = Arc::new(MpvClient::new(None));
  let mpv_state = MpvState(mpv_client.clone());

  // Create Jellyfin client state
  let jellyfin_client = Arc::new(JellyfinClient::new());
  let jellyfin_state = JellyfinState::new(jellyfin_client, mpv_client);

  tauri::Builder::default()
    .manage(mpv_state)
    .manage(jellyfin_state)
    .invoke_handler(builder.invoke_handler())
    .setup(move |app| {
      // Setup logging in debug builds
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

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
    .plugin(tauri_plugin_store::Builder::new().build())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
