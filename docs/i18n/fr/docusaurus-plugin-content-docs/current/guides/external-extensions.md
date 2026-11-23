---
sidebar_position: 9.5
---

import project from '@site/src/project';

# Extensions externes {#external-extensions}

Depuis la version 1.23, asbplayer permet à d’autres extensions de navigateur de communiquer avec lui. Toute extension qui se connecte à asbplayer via [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect) et reçoit l’autorisation de l’utilisateur peut envoyer des [commandes](../reference/external-api.md) par cette connexion.

Un modèle d’extension intégrée à asbplayer de cette manière est disponible <a href={`${project.urls.externalExtensionTemplateRepo}`}>ici</a>.

## Se connecter et obtenir l’autorisation de l’utilisateur

Toute extension qui souhaite communiquer avec asbplayer doit d’abord se connecter à l’aide d’un code semblable à celui ci-dessous. Vous trouverez l’identifiant de l’extension asbplayer dans le gestionnaire d’extensions du navigateur (dans Chrome, `chrome://extensions` ; dans Firefox, `about:addons`).

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>, {
    name: 'asbplayer-external-v1', // Must match this string exactly
});
```

Demandez l’autorisation avec `initialize`. La réponse indique immédiatement l’état actuel.

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

Si l’extension n’est pas encore autorisée, asbplayer enregistre la connexion comme étant en attente, demande l’approbation de l’utilisateur, puis répond :

```json
{
    "jsonrpc": "2.0",
    "id": "<the id from the initialize request>",
    "result": { "state": "pending" }
}
```

Interrogez `approval-state` pour savoir si l’utilisateur a approuvé la demande de connexion.

```json
{
    "jsonrpc": "2.0",
    "id": "<request id>",
    "method": "approval-state",
    "params": {}
}
```

Une fois la connexion autorisée, `approval-state` renvoie `{ "state": "approved" }` et la connexion peut envoyer des commandes. En cas de refus, `approval-state` renvoie une fois `{ "state": "denied"}`, puis asbplayer ferme le port. Après un refus, l’extension ne peut pas redemander l’autorisation pendant 24 heures.

Les commandes peuvent être envoyées comme [décrit dans la documentation](../reference/external-api.md). Par exemple :

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'get-bound-media',
    params: {},
});
```

En cas de réussite, asbplayer répond avec `{ jsonrpc, id, result }` ; en cas d’échec, il répond avec `{ jsonrpc, id, error }`.
