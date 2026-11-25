---
sidebar_position: 1
---

import project from '@site/src/project';
import Screenshot from '@site/src/components/Screenshot';

# Loading subtitles {#loading-subtitles}

The first step to using asbplayer is to load subtitles onto a video source.

## Streaming video {#streaming-video}

### Chrome (or other Chromium-based browsers) {#chromium}

1. Install the Chrome extension from Google's <a href={project.extension.chrome.storeUrl}>web store</a> or from the <a href={`${project.urls.repo}/releases/latest`}>GitHub release</a>.
2. Click 🧩 icon in browser toolbar → asbplayer → **Open Side Panel**
3. Click **Load Subtitles** to load subtitles onto any video on the current page.

<div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
    <Screenshot
        src="/img/generated/side-panel-load-subtitles.png"
        alt="The asbplayer side panel with the Load Subtitles button selected"
        width={220}
    />
    <Screenshot
        src="/img/generated/subtitle-file-dialog.png"
        alt="The asbplayer subtitle dialog opened over a video, with a detected subtitle track selected"
        width={460}
    />
</div>

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
