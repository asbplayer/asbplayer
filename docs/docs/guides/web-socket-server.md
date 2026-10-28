---
sidebar_position: 9
---

import project, { webSocketHttpUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# WebSocket server {#websocket-server}

asbplayer takes advantage of the two-way nature of WebSocket connections in order to expose an interface accessible from outside of the browser.

In this design, asbplayer is a **WebSocket client** that maintains a connection with a **WebSocket server** that runs locally on the user's computer. The server then exposes an HTTP interface that triggers commands to asbplayer, the client. A technical reference on the pre-packaged server is [here](../reference/external-api).

The server was originally written to enable a one-click mining flow that enriches AnkiConnect `addNote` requests with asbplayer-supplied media, and so one of its primary functions is also as an **AnkiConnect proxy**.

:::note
The preferred way to do one-click mining is with the [asbplayer Anki add-on](./one-click-mining#install-the-asbplayer-anki-add-on). The AnkiConnect proxy described below is an alternative.
:::

## Run the server {#run-the-server}

1. Clone the <a href={project.urls.repo}>asbplayer repo</a>.

    <CodeBlock language="bash">{`git clone ${project.urls.repo}.git asbplayer`}</CodeBlock>

2. If not already installed, install [Golang](https://go.dev/dl/).
3. Run the server:

    ```
    cd asbplayer/scripts/web-socket-server
    go run .
    ```

The proxy is very lightweight, so it's fine to leave it running in the background. On Windows, [RBTray](https://github.com/benbuck/rbtray) can be used to minimise it to the taskbar.

## Connect asbplayer to the server {#connect-asbplayer-to-the-server}

Configure and enable asbplayer's WebSocket client from the <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>misc settings</a>. By default, asbplayer is already pointed at the WebSocket server's default IP address and port, and so in general all that's required is to enable the WebSocket client.

## One-click mining with the AnkiConnect proxy {#one-click-mining-with-the-ankiconnect-proxy}

Follow the directions on [Yomitan's website](https://yomitan.wiki/) to install Yomitan and configure it with a dictionary for your target language.

Then configure Yomitan:

- The AnkiConnect URL should point at the AnkiConnect proxy rather than AnkiConnect. The default proxy URL is <code>{webSocketHttpUrl}</code>.
- Yomitan should be using the same **Note Type** as asbplayer.

Mining sentences using Yomitan will create cards with word definition, image, and audio already provided. A truly one-click mining flow can be achieved if the proxy's `POST_MINE_ACTION` is `2` (update last card). See the [server configuration](../reference/external-api#server-configuration) for details.

To always use asbplayer's subtitle text for the Sentence field, enable [**Always use subtitle text for sentence field**](../reference/settings#always-use-subtitle-text-for-sentence-field) under **Mining** settings. This replaces the sentence text supplied by Yomitan with the mined subtitle text from all tracks.

## API reference {#api-reference}

See the [technical reference](../reference/external-api#external-api) for a description of supported commands that can be sent to asbplayer over the WebSocket connection.

## HTTP-based API {#http-based-api}

The WebSocket server implements an HTTP-based API which triggers the documented [commands](../reference/external-api#external-api).

- `POST asbplayer/load-subtitles` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/load-subtitles`}>script</a>)
- `POST asbplayer/mine-subtitle` (argument specified as JSON `{ fields, postMineAction, mediaId?, noteId?, asbplayerCardId? }`) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/mine-subtitle`}>script</a>)
- `POST asbplayer/seek` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/seek`}>script</a>)
- `GET asbplayer/bound-media` (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/bound-media`}>script</a>)
- `GET asbplayer/subtitles` (optional `?mediaId=...&trackNumbers=0,1`) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/subtitles`}>script</a>)
- `GET asbplayer/mining-history` (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/mining-history`}>script</a>)

## AnkiConnect proxy {#ankiconnect-proxy}

The WebSocket server also functions as an AnkiConnect proxy that allows `addNote` requests to be enriched with asbplayer-provided context, such as audio and screenshots.

The proxy passes through all AnkiConnect requests as-is except for `addNote`. The proxy's specific behavior in the case of `addNote` depends on the value of `POST_MINE_ACTION` in the configuration documented below.

## Server configuration {#server-configuration}

The server is configured with an `.env` file placed next to it in the same directory. Below is an example file with explanation.

```
# Port that the proxy will listen on
PORT=8766

# AnkiConnect URL
ANKI_CONNECT_URL=http://127.0.0.1:8765

# Action for asbplayer to take when the proxy receives an addNote request
# 0 = 'None'
# 1 = 'Open Anki dialog'
# 2 = 'Update last card' (updates last card with asbplayer media AFTER passing through original addNote request)
# 3 = 'Export card'
POST_MINE_ACTION=2
```
