# asbplayer external API

This directory contains the OpenRPC document (`openrpc.json`) describing asbplayer's external
JSON-RPC 2.0 API, which is spoken by

- the external **WebSocket** servers - the Go server in `scripts/web-socket-server` and the Anki
  addon server in `plugins/anki/asbplayer-addon/server/websocket_server.py`, and
- the external **extension** API - `browser.runtime` ports named `asbplayer-external-v1`
  (extension ⇄ external extension).

asbplayer's _internal_ messaging (Chrome extension messaging, `window.postMessage`,
`BroadcastChannel`) is deliberately **not** part of this document.

## Regeneration and licensing

`openrpc.json` is **generated** - do not edit it by hand. It is produced from the zod schemas and
method registry in [`common/external-commands/external-api.ts`](../common/external-commands/external-api.ts)
by [`scripts/generate-openrpc.ts`](../scripts/generate-openrpc.ts):

```
pnpm run generate:external-api   # regenerate
pnpm run check:external-api      # verify the committed document matches the schemas (runs in CI)
```

> SPDX-License-Identifier: Unlicense

The contents of this directory (`openrpc.json` and this README) are dedicated to the public domain
under the [Unlicense](https://unlicense.org/), so that third parties can consume the contract
without licensing obligations. The zod schemas and the generator script that produce it, like the
rest of the repository, are licensed **AGPL-3.0-or-later** - the generated document embeds only
schema data and prose descriptions, never GPL source text.

`openrpc.json` cannot carry comments (it must remain valid JSON, since `rpc.discover` serves it
verbatim), so the license is declared through its `info.license` field and this README.

## Error codes

Standard JSON-RPC 2.0 codes plus server-defined codes in the `-32000..-32099` range:

| Code     | Name             | Meaning                                                                                          | HTTP status (Go server bridge)      |
| -------- | ---------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `-32700` | Parse error      | Frame was not valid JSON                                                                         | n/a (bridge builds requests itself) |
| `-32600` | Invalid request  | Frame violated the envelope rules (e.g. missing `jsonrpc: "2.0"`)                                | n/a                                 |
| `-32601` | Method not found | Unknown method **request**, or an `external-extension-only` method invoked on a WebSocket server | n/a                                 |
| `-32602` | Invalid params   | Params failed schema validation                                                                  | n/a                                 |
| `-32603` | Internal error   | Unexpected failure while handling a valid request                                                | 500                                 |
| `-32000` | Request timeout  | No asbplayer answered before the server's request timeout                                        | 503                                 |
| `-32001` | No clients       | The server has no connected asbplayers to forward to                                             | 503                                 |
| `-32002` | Not approved     | External extension sent a command before being approved                                          | n/a (external extension API only)   |

The HTTP bridge (`/asbplayer/*` endpoints and the AnkiConnect `addNote` interception in the Go
server) never speaks JSON-RPC to HTTP callers: it maps the JSON-RPC error to a status code as in
the table above.

## Semantics the OpenRPC document cannot express

- **Keepalive.** WebSocket servers use application-level `PING`/`PONG` _text frames_, which are
  not JSON-RPC and are not listed as methods. Browser WebSocket clients cannot send protocol
  control frames, so this stays app-level.
- **Notifications.** A request sent without an `id` is a notification: it must **never** be
  answered, not even with an error. The fire-and-forget `mine-subtitle` publish
  (`postMineAction == 2` path) is a notification.
- **Unknown methods.** An unknown method sent as a _request_ gets `-32601`; sent as a
  _notification_ it is silently ignored. Responses with late or unrecognized `id`s are dropped
  silently.
- **Envelope version.** Every new-format frame must carry `jsonrpc: "2.0"`. Frames missing it are
  treated as legacy `{command, messageId, body}` frames during the migration.
- **`mine-subtitle` ack semantics.** The response `{published: true}` means the mining flow was
  _accepted_ (dispatched), not that a card was completed - the user may still be interacting with
  the Anki dialog long after the response.
- **Broadcast, first-response-wins.** The WebSocket servers publish commands to _all_ connected
  asbplayers and settle on the **first** response that arrives; later duplicate responses for the
  same `id` are dropped. There is no one-to-one targeting.
- **Ids.** Correlation ids are uuid **strings**. Clients must only match responses to ids they
  sent themselves.
- **Approval flow (`hello`/`approval-state`, external extension only).** `hello` returns the
  current state immediately. When not yet approved, the client polls `approval-state` (roughly
  every second) until it reads `approved`. Denial returns `denied` once and then the connection is
  closed; approval revocation is a transport-level close with no message. These two methods do not
  exist on the WebSocket servers; invoking them there answers `-32601`.
- **`postMineAction`.** Valid values are `0`–`4`, matching asbplayer's `PostMineAction` enum
  (`none`, `showAnkiDialog`, `updateLastCard`, `exportCard`, `showUpdateCardDialog`). Invalid
  values are rejected with `-32602`.

## Transports

| Transport                   | Frame                                                   | Notes                                      |
| --------------------------- | ------------------------------------------------------- | ------------------------------------------ |
| Go WebSocket server (`/ws`) | One JSON-RPC message per text frame                     | `PING`/`PONG` keepalive as raw text frames |
| Anki addon WebSocket server | One JSON-RPC message per text frame                     | Same; single asbplayer client at a time    |
| External extension API      | One JSON-RPC message per `browser.runtime` port message | Port name `asbplayer-external-v1`          |

During the migration the WebSocket servers also accept the legacy framing
(`{command, messageId, body}` requests and `{command: 'response', messageId, body}` responses).
Frames are routed by the `jsonrpc` field.

The Go server switches a connection from legacy to JSON-RPC when the client sends any JSON-RPC
frame. The Anki add-on probes each client with `rpc.discover` and switches after receiving a
JSON-RPC response. The external extension API is JSON-RPC-only.

## Discovery

`rpc.discover` returns this document. Asbplayer serves it on the WebSocket command endpoint and
the external extension port. The Go server and Anki add-on only call asbplayer's methods, so they
answer `-32601`.

The document is generated from the same zod registry used for validation and reflects the
running build. `external-extension-only` tags mark transport-specific methods.
