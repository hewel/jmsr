//! System tray implementation for JMSR.
//!
//! Provides a tray icon with menu items:
//! - Show Settings: Opens/focuses the main window
//! - Quit: Exits the application

use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  Manager, Runtime,
};

/// Menu item IDs
const MENU_SHOW: &str = "show_settings";
const MENU_QUIT: &str = "quit";

/// Sets up the system tray icon with menu.
///
/// # Menu Items
/// - **Show Settings**: Shows and focuses the main window
/// - **Quit**: Exits the application
///
/// # Tray Click Behavior
/// - Left-click: Shows and focuses the main window
pub fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
  // Create menu items
  let show_item = MenuItem::with_id(app, MENU_SHOW, "Show Settings", true, None::<&str>)?;
  let quit_item = MenuItem::with_id(app, MENU_QUIT, "Quit", true, None::<&str>)?;

  // Build the menu
  let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

  // Create tray icon
  let _tray = TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .tooltip("JMSR - Jellyfin MPV Shim")
    .show_menu_on_left_click(false) // Left-click shows window, right-click shows menu
    .on_menu_event(|app, event| {
      match event.id.as_ref() {
        MENU_SHOW => {
          if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
          }
        }
        MENU_QUIT => {
          app.exit(0);
        }
        _ => {}
      }
    })
    .on_tray_icon_event(|tray, event| {
      // Left-click on tray icon shows/focuses the window
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.show();
          let _ = window.set_focus();
        }
      }
    })
    .build(app)?;

  Ok(())
}
