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

:::tip
For streaming services not listed below, asbplayer can attempt a best-effort generic subtitle detection which works for ~85% of websites.

You can always request a dedicated parser for any website, even if the generic parser detects subtitles, through an [issue](https://github.com/asbplayer/asbplayer/issues) or submit your own implementation in a [PR](https://github.com/asbplayer/asbplayer/pulls) on GitHub.
:::

| Service                 |                                                                                      Compatibility                                                                                       |
| ----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| Amazon Prime            |                                                                            Timing sometimes off by 30 seconds                                                                            |
| Bandai Channel          |                                                                                            ✓                                                                                             |
| BiliBili                |                                                                                            ✓                                                                                             |
| Crunchyroll             |                                                                                            ✓                                                                                             |
| Disney Plus             |                                                                                            ✓                                                                                             |
| Emby/Jellyfin           |                                                                Configure custom domains from the page-specific settings.                                                                 |
| HBO Max                 |                                                             See [issue](https://github.com/asbplayer/asbplayer/issues/1006)                                                              |
| Hulu                    |                                                                                            ✓                                                                                             |
| Hulu JP                 |                                                                                            ✓                                                                                             |
| iWantTFC                |                                                                                            ✓                                                                                             |
| Natural Japanese        |                                                                                            ✓                                                                                             |
| Netflix                 |                                                                                            ✓                                                                                             |
| NRK TV                  |                                                                                            ✓                                                                                             |
| osnplus                 |                                             Compatibility with osnplus is currently unknown. Reach out if you have more information on this.                                             |
| Plex                    | Supports external subtitles. As for internal subtitles, first select them from Plex UI to make them selectable from asbplayer. Configure custom domains from the page-specific settings. |
| Rakuten Viki            |                                                                                            ✓                                                                                             |
| Stremio                 |                                                                                            ✓                                                                                             |
| SVT Play                |                                                                                            ✓                                                                                             |
| TVer                    |                                                                                            ✓                                                                                             |
| UR Play                 |                                                                                            ✓                                                                                             |
| Yle Areena              |                                                                                            ✓                                                                                             |
| YouTube                 |                                                                                            ✓                                                                                             |
| All Other Websites      |                                                                Best-effort generic subtitle detection with ~85% efficacy.                                                                |