# asbplayer external API

This directory contains the OpenRPC document (`openrpc.json`) describing asbplayer's external
JSON-RPC 2.0 API.

## Regeneration and licensing

`openrpc.json` is **generated** - do not edit it by hand. It is produced from the zod schemas and
method registry in [`common/external-commands/external-api.ts`](../common/external-commands/external-api.ts)
by [`scripts/generate-openrpc.ts`](../scripts/generate-openrpc.ts):

```
pnpm run generate:external-api   # regenerate
pnpm run check:external-api      # verify the committed document matches the schemas (runs in CI)
```

The package and document are Unlicense; the generator code remains AGPL.

> SPDX-License-Identifier: Unlicense

The contents of this directory (`openrpc.json`, `package.json`, this README, and `LICENSE.md`) are
dedicated to the public domain under the [Unlicense](https://unlicense.org/), so that third parties
can consume the contract without licensing obligations. The full text is in
[`LICENSE.md`](LICENSE.md). The zod schemas and the generator script that produce it, like the rest
of the repository, are licensed **AGPL-3.0-or-later** - the generated document embeds only schema
data and prose descriptions, never GPL source text.

## Error codes

Standard JSON-RPC 2.0 codes plus server-defined codes in the `-32000..-32099` range:

| Code     | Name             | Meaning                                                                                          | HTTP status (Go server bridge)      |
| -------- | ---------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `-32700` | Parse error      | Frame was not valid JSON (WebSocket servers and asbplayer's WebSocket client)                    | n/a (bridge builds requests itself) |
| `-32600` | Invalid request  | A `jsonrpc: "2.0"` frame violated the envelope rules (e.g. a non-string `id`)                    | n/a                                 |
| `-32601` | Method not found | Unknown method **request**, or an `external-extension-only` method invoked on a WebSocket server | n/a                                 |
| `-32602` | Invalid params   | Params failed schema validation                                                                  | n/a                                 |
| `-32603` | Internal error   | Unexpected failure while handling a valid request                                                | 500                                 |
| `-32000` | Request timeout  | No asbplayer answered before the server's request timeout                                        | 503                                 |
| `-32001` | No clients       | The server has no connected asbplayers to forward to                                             | 503                                 |
| `-32002` | Not approved     | External extension sent a command before being approved                                          | n/a (external extension API only)   |

Error responses use `"id": null` when the id cannot be determined, as JSON-RPC 2.0 requires for
parse errors and for requests whose id is unusable (asbplayer only supports string ids).
