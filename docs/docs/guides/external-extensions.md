---
sidebar_position: 9.5
---

import project, { ankiConnectUrl } from '@site/src/project';

# External extensions {#external-extensions}

As of v1.23, asbplayer exposes a way for other browser extensions to communicate with it. Any extension that connects to asbplayer via [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect), and receives user approval, can issue [commands](../reference/external-api) through the connection.

A template implementation of an extension that integrates with asbplayer in this way is provided <a href={`${project.urls.externalExtensionTemplateRepo}`}>here</a>.

## Connecting and obtaining user approval

Any extension wishing to communicate with asbplayer must first connect using code like below. asbplayer's extension ID can be obtained from the browser's extension manager (on Chrome `chrome://extensions`, on Firefox `about:addons`).

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>);
```

The port speaks [JSON-RPC 2.0](https://www.jsonrpc.org/specification). Approval can then be requested by issuing the `hello` method. It answers immediately with the current approval state, so no request ever waits for the user.

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'hello',
    params: {
        name: 'external-extension-name', // Self-reported name
        version: '1.2.3', // Self-reported version
    },
});
```

If the extension hasn't been approved yet, asbplayer registers the connection as pending, prompts the user to approve it, and responds:

```json
{
    "jsonrpc": "2.0",
    "id": "<the id from the hello request>",
    "result": { "state": "pending" }
}
```

While pending, poll `approval-state` (roughly once per second). It is a pure read and never triggers another prompt:

```json
{
    "jsonrpc": "2.0",
    "id": "<request id>",
    "method": "approval-state",
    "params": {}
}
```

Once the user approves, the next poll returns `{ "state": "approved" }` and the same connection can issue [commands](../reference/external-api). If the user denies the request, `approval-state` returns `{ "state": "denied" }` once and asbplayer closes the port. Revoking an approved extension also closes the port.

After approval, send commands as JSON-RPC requests using the same method names and payloads documented in the [external API reference](../reference/external-api), for example:

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'get-bound-media',
    params: {},
});
```

asbplayer answers with `{ jsonrpc, id, result }` on success or `{ jsonrpc, id, error }` on failure. Unknown methods fail with `-32601`, invalid params with `-32602`, and commands sent before approval with `-32002`. See the [external API reference](../reference/external-api) for the full command set.
