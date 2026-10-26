---
sidebar_position: 9.5
---

import project from '@site/src/project';

# External extensions {#external-extensions}

As of v1.23, asbplayer exposes a way for other browser extensions to communicate with it. Any extension that connects to asbplayer via [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect), and receives user approval, can issue [commands](../reference/external-api) through the connection.

A template implementation of an extension that integrates with asbplayer in this way is provided <a href={`${project.urls.externalExtensionTemplateRepo}`}>here</a>.

## Connecting and obtaining user approval

Any extension wishing to communicate with asbplayer must first connect using code like below. asbplayer's extension ID can be obtained from the browser's extension manager (on Chrome `chrome://extensions`, on Firefox `about:addons`).

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>, {
    name: 'asbplayer-external-v1', // Must match this string exactly
});
```

Request approval with `initialize`, which answers immediately with the current state.

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'initialize',
    params: {
        name: 'external-extension-name', // Self-reported name
        version: '1.2.3', // Self-reported version
    },
});
```

If the extension is not approved, asbplayer registers the connection as pending, prompts the user, and responds:

```json
{
    "jsonrpc": "2.0",
    "id": "<the id from the initialize request>",
    "result": { "state": "pending" }
}
```

Poll `approval-state` to see if the user has approved the connection request.

```json
{
    "jsonrpc": "2.0",
    "id": "<request id>",
    "method": "approval-state",
    "params": {}
}
```

Once approved, `approval-state` will return `{ "state": "approved" }` and the connection can issue commands. If denied, `approval-state` returns `{ "state": "denied" }` once. asbplayer then closes the port. Once denied, the requesting extension cannot request approval for 24 hours, or until the browser is restarted.

Commands can be issued as [documented](../reference/external-api). For example:

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'get-bound-media',
    params: {},
});
```

asbplayer answers with `{ jsonrpc, id, result }` on success or `{ jsonrpc, id, error }` on failure.
