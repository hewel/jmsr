# AGENTS.md — src-tauri

Rust backend for Tauri v2 desktop app. Controls external MPV player via JSON IPC.

## Structure

```
src-tauri/
├── src/
│   ├── main.rs       # Entry point, windows_subsystem attr
│   ├── lib.rs        # Tauri app builder, specta bindings export
│   └── command.rs    # Tauri commands (add new commands here)
├── Cargo.toml        # Dependencies
├── tauri.conf.json   # Tauri app config
├── build.rs          # Build script (codegen)
└── rustfmt.toml      # 2-space indent
```

## Where to Look

| Task | Location | Notes |
|------|----------|-------|
| Add command | `src/command.rs` | `#[tauri::command]` + `#[specta]` |
| Register command | `src/lib.rs` | Add to `collect_commands![]` macro |
| Change app config | `tauri.conf.json` | Window size, title, CSP, icons |
| Add Rust dependency | `cargo add` | Do not edit `Cargo.toml` directly |

## Commands

```bash
cargo build           # Build Rust backend
cargo check           # Type-check without building
cargo fmt             # Format with 2-space indent
cargo clippy          # Lint
cargo add             # Add dependency

# From project root:
bunx tauri dev        # Hot-reload dev mode
bunx tauri build      # Production build
```

## Conventions

- **2-space indent** (rustfmt.toml: `tab_spaces = 2`)
- **All commands need `#[specta]`** for TypeScript binding generation
- **Bindings export on debug only** (`#[cfg(debug_assertions)]` in lib.rs)
- **Entry via lib.rs**: main.rs just calls `app_lib::run()`

## Anti-Patterns

- **Embedding libmpv**: Project spawns external MPV process, NOT libmpv
- **Missing specta attr**: Every `#[tauri::command]` MUST have `#[specta]`
- **Forgetting collect_commands**: New commands must be registered in lib.rs

## Key Dependencies

- `tauri` v2.9 — Desktop app framework
- `tauri-specta` v2 — Type-safe Rust↔TS bindings
- `specta` + `specta-typescript` — Type generation
- `serde` + `serde_json` — Serialization
- `tauri-plugin-log` — Logging (debug builds)
- `tokio` — Async runtime
- `reqwest` + `tokio-tungstenite` — Jellyfin communication
- `tokio::net` — IPC with MPV

## Notes

- Bindings exported to `../src/bindings.ts` on debug builds
- Window title: "jellyfin-mpv-shim-rust" (tauri.conf.json)
- CSP disabled (`null`) for development flexibility
- When edit finished, use @oracle to review changes
