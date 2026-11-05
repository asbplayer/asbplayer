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

See the [technical reference](../reference/external-api#http-based-api) for a description of the API.
