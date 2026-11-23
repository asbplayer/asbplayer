---
sidebar_position: 7
---

import project from '@site/src/project';

# Kompatibilität {#compatibility}

## Website {#website}

### Browser und Audio-/Videoformate {#browsers-and-media-formats}

| Browser                     | `mp4`-Container | `mkv`-Container | `avi`-Container |                                        H.264                                         |                                      H.265/HEVC                                      | Dolby Digital / Digital Plus (AC-3 / E-AC-3) | DTS / Dolby TrueHD / MLP |
| --------------------------- | :-------------: | :-------------: | :-------------: | :----------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------: | :------------------------------------------: | :----------------------: |
| **Chromium-basierte Browser** |        ✓        |        ✓        |                 |                                          ✓                                           |         [Abhängig von Plattform/Decoder](https://www.chromium.org/audio-video/)         |                  ✓ (FFmpeg)                  |        ✓ (FFmpeg)        |
| **Firefox**                 |        ✓        |        ✓        |                 | [Abhängig von OS-Codecs](https://support.mozilla.org/en-US/kb/audio-and-video-firefox) | [Abhängig von OS-Codecs](https://support.mozilla.org/en-US/kb/audio-and-video-firefox) |                  ✓ (FFmpeg)                  |        ✓ (FFmpeg)        |
| **Safari**                  |        ✓        |                 |                 |                                          ✓                                           |                                          ✓                                           |                      ✓                       |        ✓ (FFmpeg)        |

Bei den Einträgen in der Tabelle mit `✓ (FFmpeg)` wandelt asbplayer den Ton automatisch in ein abspielbares Format um. Unterstützte Browser können die Wiedergabe starten, während die Umwandlung weiterläuft; dabei kann nur im bereits verfügbaren Audiobereich gespult werden. Andere Browser warten, bis die Umwandlung abgeschlossen ist. Die <a href={`${project.urls.repo}/blob/main/ffmpeg/README.md`}>für asbplayer kompilierte FFmpeg-Bibliothek</a> wird bei der ersten Verwendung heruntergeladen und für die Offline-Nutzung zwischengespeichert.

## Erweiterung {#extension}

### Browser und Funktionen {#browsers-and-features}

|                                  | Screenshots | Animiertes WebP (ohne DRM) | Audioaufnahme (ohne DRM) | Audioaufnahme (mit DRM) | Seitenleiste | WebSocket-Schnittstelle |
| -------------------------------- | :---------: | :-----------------------: | :-----------------------: | :-------------------: | :--------: | :-----------------: |
| **Die meisten Chromium-basierten Browser** |      ✓      |            ✓            |             ✓             |           ✓           |     ✓      |          ✓          |
| **Firefox**                      |      ✓      |                         |             ✓             |                       |     ✓      |          ✓          |
| **Firefox für Android**          |             |                         |             ✓             |                       |            |                     |
| **Kiwi Browser (Android)**       |             |                         |             ✓             |           ✓           |            |                     |
| **Edge Canary (Android)**        |      ✓      |                         |                           |                       |            |                     |

### Streamingdienste und Untertitelerkennung {#streaming-services-and-subtitle-detection}

:::tip
Für Streamingdienste, die unten nicht aufgeführt sind, kann asbplayer eine bestmögliche allgemeine Untertitelerkennung versuchen, die auf etwa 85 % der Websites funktioniert.

Sie können für jede Website einen eigenen Parser anfragen, auch wenn der allgemeine Parser Untertitel erkennt. Erstellen Sie dazu ein <a href={`${project.urls.repo}/issues`}>Issue</a> oder reichen Sie auf GitHub selbst eine Implementierung als <a href={`${project.urls.repo}/pulls`}>PR</a> ein.
:::

| Dienst             | Kompatibilität | Hinweise |
| ------------------ | :------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amazon Prime       | ✓ | Die Zeitangabe kann manchmal um 30 Sekunden abweichen |
| Bandai Channel     | ✓ | |
| BiliBili           | ✓ | Untertitel aus Festlandchina erfordern möglicherweise eine Anmeldung. Warten Sie, bis die Untertitel im Player angezeigt werden, bevor Sie den Untertitelauswahldialog von asbplayer öffnen. Ein VPN kann das Laden verzögern; wird der Dialog zu früh geöffnet, werden möglicherweise keine Spuren angezeigt. |
| Crunchyroll        | ✓ | |
| Disney Plus        | ✓ | |
| Dreaming           | ✓ | |
| Emby/Jellyfin      | ✓ | Konfigurieren Sie benutzerdefinierte Domains in den seitenspezifischen Einstellungen. |
| HBO Max            | ✓ | |
| Hulu               | ✓ | |
| Hulu JP            | ✓ | |
| iWantTFC           | ✓ | |
| Natural Japanese   | ✓ | |
| Netflix            | ✓ | |
| NRK TV             | ✓ | |
| OK Ru              | ✓ | |
| osnplus            | Die Kompatibilität mit osnplus ist derzeit unbekannt. Wenn Sie dazu Informationen haben, melden Sie sich bitte. | |
| Plex               | ✓ | Externe Untertitel werden unterstützt. Wählen Sie eingebettete Untertitel zuerst in der Plex-Oberfläche aus, damit sie in asbplayer auswählbar sind. Benutzerdefinierte Domains können Sie in den seitenspezifischen Einstellungen konfigurieren. |
| Rakuten Viki       | ✓ | |
| Rutube             | ✓ | |
| Stremio            | ✓ | |
| SVT Play           | ✓ | |
| TVer               | ✓ | |
| UR Play            | ✓ | |
| VK Video           | ✓ | |
| Yle Areena         | ✓ | |
| YouTube            | ✓ | |
| Alle anderen Websites | Allgemeine Untertitelerkennung mit bestmöglichem Ergebnis und einer Erfolgsquote von etwa 85 %. | |
