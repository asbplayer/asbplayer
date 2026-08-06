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

When a local file has audio in a Dolby-patented format the browser cannot decode, asbplayer offers to convert that track so it can be played. The converted audio is used both for playback and for audio on mined cards. Conversion runs once per file and takes a while for long videos. The converter is downloaded the first time it is used, so an Internet connection is needed for that first conversion.

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

| Service                 |                                                                                      Compatibility                                                                                       |
| ----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| Netflix                 |                                                                                            ✓                                                                                             |
| YouTube                 |                                                                                            ✓                                                                                             |
| Disney Plus             |                                                                                            ✓                                                                                             |
| Hulu                    |                                                                                            ✓                                                                                             |
| Hulu JP                 |                                                                                            ✓                                                                                             |
| TVer                    |                                                                                            ✓                                                                                             |
| Bandai Channel          |                                                                                            ✓                                                                                             |
| Amazon Prime            |                                                                            Timing sometimes off by 30 seconds                                                                            |
| Emby/Jellyfin           |                                                                Configure custom domains from the page-specific settings.                                                                 |
| Rakuten Viki            |                                                                                            ✓                                                                                             |
| osnplus                 |                                             Compatibility with osnplus is currently unknown. Reach out if you have more information on this.                                             |
| Plex                    | Supports external subtitles. As for internal subtitles, first select them from Plex UI to make them selectable from asbplayer. Configure custom domains from the page-specific settings. |
| BiliBili                |                                                                                            ✓                                                                                             |
| NRK TV                  |                                                                                            ✓                                                                                             |
| HBO Max                 |                                                             See [issue](https://github.com/asbplayer/asbplayer/issues/1006)                                                              |
| Yle Areena              |                                                                                            ✓                                                                                             |
| iWantTFC                |                                                                                            ✓                                                                                             |
| Stemio                  |                                                              See [issue](https://github.com/asbplayer/asbplayer/issues/800)                                                              |
| Comprehensible Japanese |                                                                                            ✓                                                                                             |
| SVT Play                |                                                                                            ✓                                                                                             |
| UR Play                 |                                                                                            ✓                                                                                             |
