// Tauri 2.x entry point — supports desktop and (future) mobile targets via
// the `mobile_entry_point` macro.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Dialog plugin: native open/save file pickers (used for "Add files to set"
        // as a fallback when the File System Access API isn't available).
        .plugin(tauri_plugin_dialog::init())
        // FS plugin: scoped filesystem access for future Rust-side operations
        // (currently the app reads files directly from JS via File System Access API).
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running Cosvault");
}
