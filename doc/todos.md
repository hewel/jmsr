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

### Auto-Play Next Episode ✅
**Goal**: When an episode finishes playing naturally (EOF), automatically start the next episode in the series.

**Status**: ✅ Complete

#### Implementation Details
- [x] Added `EpisodesResponse` struct in `types.rs` for parsing episodes API
- [x] Added `get_next_episode()` method in `client.rs` using `/Shows/{seriesId}/Episodes` endpoint
- [x] Added `current_item: Option<MediaItem>` to `SessionState` to track what's playing
- [x] Added `start_mpv_event_listener()` in `session.rs` that:
  - Spawns background task listening to MPV events
  - Detects `end-file` events with `reason: "eof"` (natural end, not user stop)
  - Reports playback stopped to Jellyfin
  - Fetches and plays next episode automatically
- [x] Track preferences from series-based persistence apply to auto-played episodes

## Medium Priority

### Debug Web UI Pause Issue ✅
- [x] Investigate: "When I click play button on web, MPV stays paused"
- [x] Fixed: `PlayPause` handler now queries actual MPV pause state instead of internal state
- [x] Root cause: Internal state could get stale if user paused via MPV keyboard (spacebar)
- [x] Solution: Query `mpv.get_pause()` directly for `PlayPause` toggle commands

### NextTrack Command Support ✅
- [x] Added handler for `NextTrack` playstate command from Jellyfin web UI
- [x] Reports playback stop for current item, then fetches and plays next episode

### PreviousTrack Command Support ✅
- [x] Added `get_previous_episode()` method to `client.rs`
- [x] Added handler for `PreviousTrack` playstate command from Jellyfin web UI
- [x] Reports playback stop for current item, then fetches and plays previous episode

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
- [x] Auto-play next episode when current finishes naturally
