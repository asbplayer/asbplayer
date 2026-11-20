---
sidebar_position: 1
---

import project from '@site/src/project';

# Loading subtitles {#loading-subtitles}

The first step to using asbplayer is to load subtitles onto a video source.

## Streaming video {#streaming-video}

### Chrome (or other Chromium-based browsers) {#chromium}

1. Install the Chrome extension from Google's <a href={project.extension.chrome.storeUrl}>web store</a> or from the <a href={`${project.urls.repo}/releases/latest`}>GitHub release</a>.
2. Click 🧩 icon in browser toolbar → asbplayer → **Open Side Panel**
3. Click **Load Subtitles** to load subtitles onto any video on the current page.

To load Dutch subtitles generated from the dub audio, see [Local Whisper subtitles and Anki lookups](../guides/local-whisper.md).

#### Generate Dutch subtitles with Whisper

With the local Whisper server running, select the Dutch audio in the streaming player and position playback where you want the subtitles to start. Open **Load Subtitles** and choose **Transcribe this episode**.

Keep playback at 1×. Pauses are fine, but seeking or changing speed discards the recording. At the end, asbplayer sends the tab audio to local Whisper and loads **Nederlands (Whisper)** when it is ready. For a short test, reopen **Load Subtitles** after a minute and choose **Finish and transcribe**.

### Firefox {#firefox}

:::warning
asbplayer is missing some features on Firefox. See the [Compatibility](../compatibility.md#extension) section.  
:::

1. Install the the Firefox addon from the Mozilla <a href={project.extension.firefox.storeUrl}>addon store</a> or from the <a href={`${project.urls.repo}/releases/latest`}>GitHub release</a>.
2. Click 🧩 icon in browser toolbar → asbplayer → **Open Side Panel**
3. Click **Load Subtitles** to load subtitles onto any video on the current page.

### Android {#android}

See the [Android guide](../guides/android.md).

## Video files {#video-files}

1. Open the <a href={project.urls.app}>website</a>.
2. Drag-and-drop video and subtitle files into the website.
