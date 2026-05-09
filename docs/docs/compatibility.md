---
sidebar_position: 7
---

# Compatibility

## Website

### Browsers and audio/video formats

|                                                                               |                                     H.264                                     |                                  H.265/HEVC                                   | `mp4` container | `mkv` container | Dolby-patented audio codecs like AC3/DTS |
| ----------------------------------------------------------------------------- | :---------------------------------------------------------------------------: | :---------------------------------------------------------------------------: | :-------------: | :-------------: | ---------------------------------------- |
| **Chromium-based browsers with modern GPU and hardware acceleration enabled** |                                       ✓                                       |                                       ✓                                       |        ✓        |        ✓        |                                          |
| **Chromium-based browsers**                                                   |                                       ✓                                       |                                                                               |        ✓        |        ✓        |                                          |
| **Firefox**                                                                   | [Depends](https://support.mozilla.org/en-US/kb/html5-audio-and-video-firefox) | [Depends](https://support.mozilla.org/en-US/kb/html5-audio-and-video-firefox) |        ✓        |                 |

## Extension

### Browsers and features

|                                  | Screenshots | Audio Recording (non-DRM) | Audio Recording (DRM) | Side Panel | WebSocket Interface |
| -------------------------------- | :---------: | :-----------------------: | :-------------------: | :--------: | :-----------------: |
| **Most Chromium-based browsers** |      ✓      |             ✓             |           ✓           |     ✓      |          ✓          |
| **Firefox**                      |      ✓      |             ✓             |                       |     ✓      |          ✓          |
| **Firefox for Android**          |             |             ✓             |                       |            |                     |
| **Kiwi Browser (Android)**       |             |             ✓             |           ✓           |            |                     |
| **Edge Canary (Android)**        |      ✓      |                           |                       |            |                     |

### Streaming services and subtitle detection

| Service        |                                                                                      Compatibility                                                                                       |
| -------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| Netflix        |                                                                                            ✓                                                                                             |
| YouTube        |                                                                                            ✓                                                                                             |
| Disney Plus    |                                           Seeking/timing is completely broken ([issue](https://github.com/asbplayer/asbplayer/issues/576))                                            |
| Hulu           |                                                                                            ✓                                                                                             |
| TVer           |                                                                                            ✓                                                                                             |
| Bandai Channel |                                                                                            ✓                                                                                             |
| Amazon Prime   |                                                                            Timing sometimes off by 30 seconds                                                                            |
| Emby/Jellyfin  |                                                                Configure custom domains from the page-specific settings.                                                                 |
| Rakuten Viki   |                                                                                            ✓                                                                                             |
| osnplus        |                                             Compatibility with osnplus is currently unknown. Reach out if you have more information on this.                                             |
| Plex           | Supports external subtitles. As for internal subtitles, first select them from Plex UI to make them selectable from asbplayer. Configure custom domains from the page-specific settings. |
| BiliBili       |                                                                                            ✓                                                                                             |
| NRK TV         |                                                                                            ✓                                                                                             |
| HBO Max        |                                                                                            ✓                                                                                             |
| Yle Areena     |                                                                                            ✓                                                                                             |
