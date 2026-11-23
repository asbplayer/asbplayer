---
sidebar_position: 9.5
---

import project from '@site/src/project';

# Externe Erweiterungen {#external-extensions}

Seit Version 1.23 bietet asbplayer anderen Browsererweiterungen eine Möglichkeit zur Kommunikation. Jede Erweiterung, die über [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect) eine Verbindung zu asbplayer herstellt und die Zustimmung des Nutzers erhält, kann über diese Verbindung [Befehle](../reference/external-api.md) senden.

Eine Beispielimplementierung für eine Erweiterung, die auf diese Weise mit asbplayer zusammenarbeitet, finden Sie <a href={`${project.urls.externalExtensionTemplateRepo}`}>hier</a>.

## Verbindung herstellen und Zustimmung einholen

Eine Erweiterung, die mit asbplayer kommunizieren möchte, muss zunächst mit Code wie dem folgenden eine Verbindung herstellen. Die Erweiterungs-ID von asbplayer finden Sie in der Erweiterungsverwaltung des Browsers (in Chrome unter `chrome://extensions`, in Firefox unter `about:addons`).

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>, {
    name: 'asbplayer-external-v1', // Must match this string exactly
});
```

Fordern Sie mit `initialize` die Zustimmung an. Die Antwort enthält sofort den aktuellen Status.

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

Wenn die Erweiterung noch nicht genehmigt wurde, registriert asbplayer die Verbindung als ausstehend, fragt den Nutzer und antwortet:

```json
{
    "jsonrpc": "2.0",
    "id": "<the id from the initialize request>",
    "result": { "state": "pending" }
}
```

Fragen Sie mit `approval-state` ab, ob der Nutzer der Verbindungsanfrage zugestimmt hat.

```json
{
    "jsonrpc": "2.0",
    "id": "<request id>",
    "method": "approval-state",
    "params": {}
}
```

Nach der Genehmigung gibt `approval-state` `{ "state": "approved" }` zurück und die Verbindung kann Befehle senden. Bei einer Ablehnung gibt `approval-state` einmal `{ "state": "denied" }` zurück. Danach schließt asbplayer den Port. Nach einer Ablehnung kann die Erweiterung 24 Stunden lang keine neue Genehmigung anfordern.

Befehle können wie [hier dokumentiert](../reference/external-api.md) gesendet werden. Beispiel:

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'get-bound-media',
    params: {},
});
```

Bei Erfolg antwortet asbplayer mit `{ jsonrpc, id, result }`, bei einem Fehler mit `{ jsonrpc, id, error }`.
