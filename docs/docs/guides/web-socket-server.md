---
sidebar_position: 9
---

# WebSocket server

asbplayer takes advantage of the two-way nature of WebSocket connections in order to expose an interface accessible from outside of the browser.

In this design, asbplayer is a **WebSocket client** that maintains a connection with a **WebSocket server** that runs locally on the user's computer. The server then exposes an HTTP interface that triggers commands to asbplayer, the client. A technical reference on the pre-packaged server is [here](../reference/external-api).

The server was originally written to enable a one-click mining flow that enriches AnkiConnect `addNote` requests with asbplayer-supplied media, and so one of its primary functions is also as an **AnkiConnect proxy**.

## Run the server

1. Clone the [asbplayer repo](https://github.com/asbplayer/asbplayer).
   ```
   git clone git@github.com:asbplayer/asbplayer
   ```
2. If not already installed, install [Golang](https://go.dev/dl/).
3. Run the server:

   ```
   cd asbplayer/scripts/web-socket-server
   go run main.go
   ```

The proxy is very lightweight, so it's fine to leave it running in the background. On Windows, [RBTray](https://github.com/benbuck/rbtray) can be used to minimise it to the taskbar.

## Connect asbplayer to the server

Configure and enable asbplayer's WebSocket client from the [misc settings](https://app.asbplayer.dev/?view=settings#misc-settings). By default, asbplayer is already pointed at the WebSocket server's default IP address and port, and so in general all that's required is to enable the WebSocket client.

## Use the server

See the [one-click mining guide](./one-click-mining) for how to enable a one-click mining flow using this server. See the [techncal reference](../reference/external-api#http-based-api) for a description of the API.
