---
sidebar_position: 9.5
---

import project from '@site/src/project';

# Estensioni esterne {#external-extensions}

A partire dalla v1.23, asbplayer permette ad altre estensioni del browser di comunicare con esso. Qualsiasi estensione che si connette ad asbplayer tramite [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect) e riceve l'approvazione dell'utente può inviare [comandi](../reference/external-api.md) tramite la connessione.

È disponibile <a href={`${project.urls.externalExtensionTemplateRepo}`}>qui</a> un'implementazione modello di un'estensione che si integra con asbplayer in questo modo.

## Connessione e approvazione dell'utente

Qualsiasi estensione che desideri comunicare con asbplayer deve prima connettersi usando codice come il seguente. L'ID dell'estensione di asbplayer si trova nel gestore delle estensioni del browser (in Chrome `chrome://extensions`, in Firefox `about:addons`).

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>, {
    name: 'asbplayer-external-v1', // Must match this string exactly
});
```

Richiedi l'approvazione con `initialize`, che risponde immediatamente con lo stato corrente.

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

Se l'estensione non è approvata, asbplayer registra la connessione come in sospeso, avvisa l'utente e risponde:

```json
{
    "jsonrpc": "2.0",
    "id": "<the id from the initialize request>",
    "result": { "state": "pending" }
}
```

Interroga `approval-state` per sapere se l'utente ha approvato la richiesta di connessione.

```json
{
    "jsonrpc": "2.0",
    "id": "<request id>",
    "method": "approval-state",
    "params": {}
}
```

Una volta approvata, `approval-state` restituisce `{ "state": "approved" }` e la connessione può inviare comandi. Se la richiesta è negata, `approval-state` restituisce `{ "state": "denied" }` una sola volta. A quel punto asbplayer chiude la porta. Dopo una richiesta negata, l'estensione richiedente non può chiedere di nuovo l'approvazione per 24 ore.

I comandi possono essere inviati come [descritto](../reference/external-api.md). Ad esempio:

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'get-bound-media',
    params: {},
});
```

In caso di successo, asbplayer risponde con `{ jsonrpc, id, result }`; in caso di errore, con `{ jsonrpc, id, error }`.
