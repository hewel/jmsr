# JMSR - Next Steps

## High Priority

### Config Persistence to Disk ✅
- [x] Add `tauri-plugin-store` for file-based config storage
- [x] Load config on app startup (in lib.rs setup)
- [x] Save config when user clicks "Save Settings"
- [x] Store in platform-appropriate location (handled by tauri-plugin-store)

### Apply Config Changes Live ✅
- [x] When device name changes, re-register Jellyfin session capabilities
- [x] When MPV path/args change, update MpvClient state (applies on next spawn)
- [x] Config applied at startup from stored values

### Series-based Track Persistence ✅
**Goal**: Automatically select audio and subtitle tracks for TV series based on the user's last manual selection for that series. (e.g., If user selects "Japanese" audio for S01E01, S01E02 should automatically start with Japanese audio).

**Status**: ✅ Complete (in-memory + disk persistence)

#### Implementation Details
- [x] `TrackPreference` struct in `types.rs` with `audio_language`, `subtitle_language`, `is_subtitle_enabled`
- [x] `find_stream_by_lang()` helper in `types.rs`
- [x] `series_preferences: HashMap<String, TrackPreference>` in `SessionState`
- [x] `current_series_id` and `current_media_streams` tracking in `SessionState`
- [x] Apply preferences in `handle_play()` when playing series episodes
- [x] Save preferences in `handle_general_command()` for `SetAudioStreamIndex` and `SetSubtitleStreamIndex`
- [x] `MpvAction::SetAudioTrack` and `MpvAction::SetSubtitleTrack` variants
- [x] `SessionManager::new()` accepts `AppHandle` for store access
- [x] `load_preferences_from_store()` loads from `preferences.json` on init
- [x] `save_preferences_static()` saves to disk when user changes tracks

## Medium Priority

### Debug Web UI Pause Issue
- [ ] Investigate: "When I click play button on web, MPV stays paused"
- [ ] Check logs for `handle_playstate` and `Processing Unpause command`
- [ ] Verify WebSocket messages are being received
- [ ] Test with different Jellyfin clients (web, mobile, TV)

### Error Handling Improvements
- [ ] Show user-friendly error messages in UI when commands fail
- [ ] Handle MPV connection loss gracefully (auto-reconnect or notify user)
- [ ] Handle Jellyfin session timeout/disconnect

## Low Priority

### Code Cleanup
- [ ] Remove unused Rust imports (jellyfin/mod.rs, mpv/mod.rs)
- [ ] Remove dead code warnings (unused methods in session.rs, client.rs)
- [ ] Add doc comments to public Rust APIs

### Testing
- [ ] Add frontend tests for SettingsPage form validation
- [ ] Add Rust unit tests for config validation
- [ ] Add integration tests for MPV IPC

### Future Features
- [ ] System tray controls (play/pause, next, volume)
- [ ] Keyboard shortcuts for playback control
- [ ] Multiple server support
- [ ] Playlist/queue display in UI
- [ ] Transcoding settings UI

## Completed

- [x] Core playback (titles, tracks, pause sync)
- [x] AppConfig struct with validation
- [x] Config Tauri commands (get/set/default/detect)
- [x] Configurable MPV path and extra args
- [x] Configurable device name
- [x] Settings UI with @tanstack/solid-form
- [x] PlayPause toggle command support
- [x] Config persistence to disk (tauri-plugin-store)
- [x] Apply config changes live (MPV path/args, device name)
- [x] Series-based track persistence (audio/subtitle preferences per series)
