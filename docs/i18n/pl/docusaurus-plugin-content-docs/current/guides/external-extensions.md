---
sidebar_position: 9.5
---

import project from '@site/src/project';

# Zewnętrzne rozszerzenia {#external-extensions}

Od wersji v1.23 inne rozszerzenia przeglądarki mogą komunikować się z asbplayerem. Rozszerzenie, które połączy się z asbplayerem za pomocą [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect) i uzyska zgodę użytkownika, może wysyłać przez to połączenie [polecenia](../reference/external-api.md).

<a href={`${project.urls.externalExtensionTemplateRepo}`}>Tutaj</a> znajdziesz przykładowe rozszerzenie integrujące się z asbplayerem w ten sposób.

## Łączenie i uzyskiwanie zgody użytkownika

Rozszerzenie, które chce komunikować się z asbplayerem, musi najpierw nawiązać połączenie za pomocą kodu podobnego do poniższego. Identyfikator rozszerzenia asbplayer można znaleźć w menedżerze rozszerzeń przeglądarki (w Chrome: `chrome://extensions`, w Firefoxie: `about:addons`).

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>, {
    name: 'asbplayer-external-v1', // Must match this string exactly
});
```

Poproś o zgodę za pomocą `initialize`. Odpowiedź z bieżącym stanem nadejdzie od razu.

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

Jeśli rozszerzenie nie zostało zatwierdzone, asbplayer oznacza połączenie jako oczekujące, prosi użytkownika o decyzję i odpowiada:

```json
{
    "jsonrpc": "2.0",
    "id": "<the id from the initialize request>",
    "result": { "state": "pending" }
}
```

Sprawdzaj `approval-state`, aby dowiedzieć się, czy użytkownik zaakceptował prośbę o połączenie.

```json
{
    "jsonrpc": "2.0",
    "id": "<request id>",
    "method": "approval-state",
    "params": {}
}
```

Po zaakceptowaniu `approval-state` zwróci `{ "state": "approved" }` i połączenie będzie mogło wysyłać polecenia. Po odmowie `approval-state` zwróci raz `{ "state": "denied" }`, a następnie asbplayer zamknie port. Rozszerzenie, któremu odmówiono, nie może ponowić prośby o zgodę przez 24 godziny.

Polecenia można wysyłać zgodnie z [dokumentacją](../reference/external-api.md). Na przykład:

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'get-bound-media',
    params: {},
});
```

W razie powodzenia asbplayer odpowiada `{ jsonrpc, id, result }`, a w razie niepowodzenia — `{ jsonrpc, id, error }`.
