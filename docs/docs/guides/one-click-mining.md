---
sidebar_position: 8
---

import project, { ankiConnectUrl, webSocketUrl } from '@site/src/project';

# One-click mining {#one-click-mining}

asbplayer is great at connecting subtitle and video content to AnkiConnect, but is not able to automatically provide word definitions on its own. For this reason, most sentence mining flows require at two or three mouse or keyboard inputs from the user.

One-click mining is possible if asbplayer is combined with another application that:

- supplies the missing word definition information, and
- already integrates with AnkiConnect.

[Yomitan](https://yomitan.wiki/) is an example of one such application.

## Install and configure Yomitan {#install-and-configure-yomitan}

Follow the directions on [Yomitan's website](https://yomitan.wiki/) to install Yomitan and configure it with a dictionary for your target language. You will also need to add [AnkiConnect](https://ankiweb.net/shared/info/2055492159) to Anki if you haven't done so already.

In Yomitan's Anki settings:

- The AnkiConnect server address should be the default (<code>{ankiConnectUrl}</code>).
- Yomitan should be using the same **Note Type** as asbplayer.

## Install the asbplayer Anki add-on {#install-the-asbplayer-anki-add-on}

The add-on requires at least Anki 25.02. It is not yet available on AnkiWeb, so it has to be installed from a file:

1. Download the latest `.ankiaddon` file from the <a href={`${project.urls.repo}/releases?q=${encodeURIComponent(project.artifacts.ankiAddon.tagPrefix)}`}>releases page</a>.
2. Open the file and press **Yes** on the popup.
3. Restart Anki.

## Connect asbplayer to the add-on {#connect-asbplayer-to-the-add-on}

Enable the WebSocket client in the <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>misc settings</a> of the asbplayer extension (near the bottom). Keep the default WebSocket server URL (<code>{webSocketUrl}</code>), which matches the add-on's default.

## Mine with **Yomitan** as usual {#mine-with-yomitan-as-usual}

Mining sentences using Yomitan will create cards with word definition, image, and audio already provided.

To always use asbplayer's subtitle text for the Sentence field, enable [**Always use subtitle text for sentence field**](../reference/settings#always-use-subtitle-text-for-sentence-field) under **Mining** settings. This replaces the sentence text supplied by Yomitan with the mined subtitle text from all tracks.

## Add-on Settings

The add-on's settings can be changed in Anki from **Tools > Add-ons** by selecting the add-on and pressing **Config**. `postMineAction` is the action asbplayer takes after Yomitan adds a card (default: <code>{project.services.webSocket.postMineAction}</code>). Set it to `2` (update last card) for the one-click mining flow. If `port` is changed, asbplayer's WebSocket server URL needs to be changed to match.
