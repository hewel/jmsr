# JMSR - Jellyfin MPV Shim Rust

[![Rust](https://img.shields.io/badge/Rust-1.70+-orange?logo=rust)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://v2.tauri.app/)
[![Solid.js](https://img.shields.io/badge/Solid.js-1.x-blue?logo=solid)](https://www.solidjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A high-performance Jellyfin cast receiver that controls an external MPV player. Built with Tauri v2, Solid.js, and Rust.

## Overview

JMSR allows you to cast media from any Jellyfin client (web, mobile, TV) to your desktop, where it plays in MPV with full support for your custom configurations, shaders, and scripts.

**Key Philosophy**: JMSR does NOT embed libmpv. It spawns and controls a standalone MPV process via JSON IPC, preserving your `mpv.conf`, shader packs (Anime4K, FSR, etc.), and all customizations.

## Features

- **Cast Target**: Appears as a controllable device in Jellyfin's cast menu
- **External MPV**: Full compatibility with your MPV configuration and shaders
- **Cross-Platform**: Windows, macOS, and Linux support
- **Type-Safe**: 100% type-safe Rust-to-TypeScript communication via tauri-specta
- **System Tray**: Runs in background, minimizes to tray
- **Persistent Auth**: Login once, stay connected

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (or npm/yarn)
- [Rust](https://rustup.rs/) (latest stable)
- [MPV](https://mpv.io/) installed and in PATH
- Tauri CLI: `bun add -g @tauri-apps/cli`

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/jmsr.git
cd jmsr

# Install dependencies
bun install

# Run in development mode
bunx tauri dev
```

### Usage

1. Launch JMSR
2. Enter your Jellyfin server URL and credentials
3. JMSR registers as a cast target named "JMSR"
4. From any Jellyfin client, click the cast icon and select "JMSR"
5. Media plays in MPV on your desktop

## Architecture

JMSR follows a three-actor architecture:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Sentinel     │     │     Bridge      │     │     Player      │
│   (Tauri GUI)   │───▶│   (Rust IPC)    │───▶│  (External MPV) │
│                 │     │                 │     │                 │
│ - Settings UI   │     │ - Command       │     │ - mpv.exe       │
│ - System Tray   │     │   Translation   │     │ - User configs  │
│ - WebSocket     │     │ - JSON IPC      │     │ - Shaders       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        │         Jellyfin Server                       │
        │    ┌──────────────────────┐                   │
        └──▶│  WebSocket + REST    │◀─────────────────┘
             │  - Cast commands     │    Progress reports
             │  - Playback state    │
             └──────────────────────┘
```

## Project Structure

```
jmsr/
├── src/                    # Solid.js frontend
│   ├── index.tsx          # Entry point
│   ├── App.tsx            # Root component
│   ├── bindings.ts        # Auto-generated (DO NOT EDIT)
│   └── components/        # UI components
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── lib.rs         # Tauri setup
│   │   ├── command.rs     # Tauri commands
│   │   ├── tray.rs        # System tray
│   │   ├── jellyfin/      # Jellyfin client
│   │   └── mpv/           # MPV IPC driver
│   └── tauri.conf.json
├── tests/                 # Frontend tests
└── doc/PRD.md            # Product requirements
```

## Development

### Commands

```bash
# Frontend development
bun run dev              # Start dev server (port 3000)
bun run build            # Production build
bun run test             # Run tests
bun run check            # Lint and format

# Tauri
bunx tauri dev           # Full app with hot reload
bunx tauri build         # Production build

# Rust (from src-tauri/)
cargo check              # Type-check
cargo fmt                # Format
cargo clippy             # Lint
```

### Code Conventions

- **TypeScript**: Single quotes, Biome formatting
- **Rust**: 2-space indent (rustfmt.toml)
- **IPC**: Always use typed `commands.*` from bindings, never raw `invoke()`
- **Solid.js**: Use `createSignal`, `createResource` - NOT React hooks

### Adding a Tauri Command

1. Add function in `src-tauri/src/command.rs` with `#[tauri::command]` and `#[specta]`
2. Register in `src-tauri/src/lib.rs` in `collect_commands![]`
3. Run `bunx tauri dev` to regenerate `src/bindings.ts`
4. Import from `commands` in TypeScript

## Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Tauri v2 |
| Frontend | Solid.js + TypeScript |
| Backend | Rust |
| Bundler | Rsbuild |
| Styling | TailwindCSS |
| Type Bindings | tauri-specta |
| Package Manager | Bun |
| Linting | Biome |
| Testing | Rstest |

## How It Works

1. **Authentication**: User logs into Jellyfin, receives access token
2. **Registration**: JMSR posts capabilities to `/Sessions/Capabilities/Full`
3. **WebSocket**: Connects to Jellyfin WebSocket for real-time commands
4. **Cast**: When user casts, Jellyfin sends `Play` command via WebSocket
5. **MPV Control**: JMSR spawns MPV (if needed) and sends JSON IPC commands
6. **Progress**: Every 5 seconds, JMSR reports playback position to Jellyfin
7. **Controls**: Pause/seek/volume commands flow from Jellyfin to MPV

## Troubleshooting

### JMSR doesn't appear as cast target

- Ensure you're logged in (check Settings page shows "Connected")
- Refresh the Jellyfin web page after JMSR connects
- Check Jellyfin Dashboard > Activity for the JMSR session

### MPV doesn't start

- Verify MPV is installed: `mpv --version`
- Check MPV is in PATH
- On Windows, ensure no firewall blocking named pipes

### Video doesn't play

- Check Jellyfin transcoding settings
- Verify network connectivity to Jellyfin server
- Check JMSR console for error messages

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Follow existing code conventions
4. Run `bun run check` before committing
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [jellyfin-mpv-shim](https://github.com/jellyfin/jellyfin-mpv-shim) - Original Python implementation
- [Tauri](https://tauri.app/) - Desktop app framework
- [Solid.js](https://www.solidjs.com/) - Reactive UI library
- [MPV](https://mpv.io/) - The best media player
