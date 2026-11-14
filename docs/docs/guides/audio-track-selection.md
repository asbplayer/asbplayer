---
sidebar_position: 10
---

# Audio track selection {#audio-track-selection}

For local video files, select an audio track at the top of the subtitle picker. The picker opens automatically when the file has multiple audio tracks. You can reopen it with the subtitle loading button.

With multiple audio tracks, the **Default** option keeps the browser's default audio behavior as asbplayer cannot reliably determine which track the browser selected. Choosing a specific track transcodes the audio to a universally playable format, even when the browser supports its original codec. The choice is saved when restoring the last file session.

With a single audio track, the browser plays it directly or asbplayer automatically converts unsupported audio without opening the picker.

When the browser exposes multiple audio tracks, the music-note/list button in the playback controls can switch between them directly. This native selector is available with the **Default** picker option and is hidden while asbplayer overrides the original audio with a converted track. Returning to **Default** restores access to the native selector when available.
