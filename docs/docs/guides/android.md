---
sidebar_position: 7.5
---

# Android

While the UX is worse, it's possible to use asbplayer on Android devices.

## Website

The website can be used as-is. The **Overlay UI** will be displayed instead of the default, desktop-optimized video controls.

### Add to home screen

As a progressive web app, the website can be added to the home screen of your Android device. From the browser menu, tap "add to home screen."

## Extension

:::warning
**Many features are missing**: the **side panel**, **screenshots**, and the **WebSocket interface**. See the [compatibility](../compatibility#browsers-and-features) section for a table of supported and unsupported features on each browser.
:::

As with the website, the primary way to interact with asbplayer extension is through the **Overlay UI**. The side panel is missing, so instead **subtitles are loaded by selecting the asbplayer button from the browser's extension menu.**. Using a (bluetooth) keyboard is not necessary but can be very useful for those who prefer to use keyboard shortcuts with the extension.

Below are Android browsers where asbplayer can be installed.

### Firefox for Android

Install asbplayer from the [AMO page](https://addons.mozilla.org/en-US/android/addon/asbplayer-android/). Firefox for Android suffers from the same limitations as Firefox - it's not possible to record audio from DRM-protected streams.

### Edge Canary

Edge Canary is another Chromium-based mobile browser that can run extensions. As of this writing, asbplayer on Edge Canary does not support audio recording.
To install asbplayer on Edge Canary:

1. Download the asbplayer `crx` file from the [releases page](https://github.com/asbplayer/asbplayer/releases/latest).
2. If not already, enable developer mode from the Edge Canary settings by going to "about Microsoft Edge" and tapping on the build version string several times.
3. From **Developer Options** tap **Extension install by crx** and select the `crx` file you just downloaded.

### Kiwi Browser (discontinued)

Kiwi Browser is a Chromium-based mobile browser that can run extensions. However, it's development has been discontinued and the only way to install it is from the [GitHub page](https://github.com/kiwibrowser/src.next/releases). Once Kiwi Browser is installed, asbplayer can be installed from the Chrome [web store](https://chromewebstore.google.com/detail/asbplayer-language-learni/hkledmpjpaehamkiehglnbelcpdflcab).

## Anki integration

Install [AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid) for Anki integration.
