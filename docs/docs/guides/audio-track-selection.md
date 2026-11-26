---
sidebar_position: 10
---

# Audio track selection {#audio-track-selection}

## Subtitle picker

When you open a local video with multiple audio tracks, the subtitle picker opens automatically. You can reopen it with **Load Subtitles** in the playback controls. Choose an audio track at the top of the picker.

- **Default** lets your browser choose the audio track. If it can't play any of the tracks, asbplayer can convert one automatically.
- When you choose a specific track, asbplayer converts it for playback and remembers your choice when you restore your last session.

If the file has one audio track, it appears as the only choice whenever you open the picker. A single audio track never opens the picker on its own.

## Playback controls

With **Default** selected in the subtitle picker, look for the music-note **Select Audio Track** button. It appears when your browser offers at least two tracks and asbplayer doesn't need to convert the audio.

:::warning
In Chrome, the playback button requires **Experimental Web Platform features** in `chrome://flags`. Enabling this setting can cause many issues with Chrome on various websites. The subtitle picker works with this setting off.
:::
