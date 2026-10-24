---
sidebar_position: 9.5
---

# External extensions {#external-extensions}

As of v1.23, asbplayer exposes a way for other browser extensions to communicate with it. Any extension that connects to asbplayer via [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect), and receives user approval, can issue [commands](../reference/external-api) through the connection.

A sample implementation of an extension that integrates with asbplayer in this way is provided [here](https://github.com/asbplayer/asbplayer/tree/main/samples/external-extension).

## Connecting and obtaining user approval

Any extension wishing to communicate with asbplayer must first connect using code like below. asbplayer's extension ID can be obtained from the browser's extension manager (on Chrome `chrome://extensions`, on Firefox `about:addons`).

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>);
```

Approval can then be obtained by issuing the `hello` command.

```typescript
port.postMessage({
    type: 'asbplayer-external-hello',
    name: 'external-extension-name', // Self-reported name
    version: '1.2.3', // Self-reported version
});
```

If the extension hasn't been approved yet, then asbplayer will prompt the user to approve the extension. Once the user approves, asbplayer will send a message like below through the port.

```json
{
    "type": "asbplayer-external-approval",
    "approved": true
}
```

If the user has already approved the extension, then the message is sent immediately. Following approval, asbplayer will respond to any [commands](../reference/external-api) sent through the port.
