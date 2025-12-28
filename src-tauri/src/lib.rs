use std::sync::Arc;

mod command;
mod jellyfin;
mod mpv;

use command::{JellyfinState, MpvState};
use jellyfin::JellyfinClient;
use mpv::MpvClient;

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
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      builder.mount_events(app);
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
