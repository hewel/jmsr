use std::sync::Arc;

use specta_typescript::Typescript;
use tauri_specta::{collect_commands, Builder};

mod command;
mod mpv;

use command::MpvState;
use mpv::MpvClient;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = command::command_builder();

  // Create MPV client state
  let mpv_client = MpvState(Arc::new(MpvClient::new(None)));

  tauri::Builder::default()
  .manage(mpv_client)
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
