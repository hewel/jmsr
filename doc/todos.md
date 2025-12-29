# JMSR - Next Steps

## High Priority

### Config Persistence to Disk
- [ ] Add `tauri-plugin-store` or implement file-based config storage
- [ ] Load config on app startup
- [ ] Save config when user clicks "Save Settings"
- [ ] Store in platform-appropriate location (AppData on Windows, ~/.config on Linux)

### Apply Config Changes Live
- [ ] When device name changes, re-register Jellyfin session capabilities
- [ ] When MPV path/args change, update MpvClient state (applies on next spawn)
- [ ] Consider showing "restart required" notice for certain settings

### Series-based Track Persistence
**Goal**: Automatically select audio and subtitle tracks for TV series based on the user's last manual selection for that series. (e.g., If user selects "Japanese" audio for S01E01, S01E02 should automatically start with Japanese audio).

**Context**: We currently have `MpvAction::Play` which accepts `audio_index` and `subtitle_index`. We need to intercept the play logic to override these indices if a preference exists for the target Series.

#### Step 1: Define TrackPreference struct
Location: `src-tauri/src/jellyfin/types.rs` or `config.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
pub struct TrackPreference {
    pub audio_language: Option<String>,   // e.g., "jpn"
    pub subtitle_language: Option<String>, // e.g., "chi"
    pub is_subtitle_enabled: bool,
}
```

- [ ] Define `TrackPreference` struct
- [ ] Add `series_preferences: HashMap<String, TrackPreference>` to `SavedSession` (key: SeriesId)
- [ ] Or create dedicated `PreferenceManager` with file-based persistence

#### Step 2: Apply Preference in `handle_play`
Location: `src-tauri/src/jellyfin/session.rs`

- [ ] Create helper: `find_stream_by_lang(streams, stream_type, lang) -> Option<i32>`
- [ ] In `handle_play`, check if `item.series_id` exists
- [ ] Look up `series_preferences.get(&series_id)`
- [ ] If preference exists:
  - Find stream matching `audio_language` → override `audio_index`
  - If `is_subtitle_enabled`, find stream matching `subtitle_language` → override `subtitle_index`
  - If `!is_subtitle_enabled`, set `subtitle_index = Some(-1)` to disable

```rust
// Pseudo-code for handle_play
let series_id = item.series_id.clone();
let mut audio_index = request.audio_stream_index;
let mut subtitle_index = request.subtitle_stream_index;

if let Some(sid) = &series_id {
    if let Some(pref) = self.get_series_preference(sid) {
        if let Some(lang) = &pref.audio_language {
            if let Some(idx) = find_stream_by_lang(&media_streams, "Audio", lang) {
                audio_index = Some(idx);
            }
        }
        if pref.is_subtitle_enabled {
            if let Some(lang) = &pref.subtitle_language {
                if let Some(idx) = find_stream_by_lang(&media_streams, "Subtitle", lang) {
                    subtitle_index = Some(idx);
                }
            }
        } else {
            subtitle_index = Some(-1);
        }
    }
}
```

#### Step 3: Save Preference on Track Change
Location: `src-tauri/src/jellyfin/session.rs`

- [ ] Extend `MpvClient` to observe `aid`, `sid`, and `track-list` properties
- [ ] In `SessionManager`, listen to MPV property change events
- [ ] When `aid` or `sid` changes:
  - Get new track ID
  - Get `track-list` property
  - Find language of selected track
  - Save to `series_preferences` if currently playing a Series
- [ ] Debounce save operation (don't save if user is rapidly cycling tracks)
- [ ] Persist preferences to disk

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
