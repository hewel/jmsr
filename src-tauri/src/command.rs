use specta::specta;

#[tauri::command]
#[specta]
pub fn hello_world(my_name: String) -> String {
  format!("Hello, {my_name}! You've been greeted from Rust!")
}
