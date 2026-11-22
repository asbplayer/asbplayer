---
sidebar_position: 2
description: Référence technique de l’interface externe d’asbplayer et du serveur WebSocket qui la met en œuvre.
---

import project, { ankiConnectUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# API externe {#external-api}

Cette page est une référence technique sur l’interface externe d’asbplayer. Voici les différentes manières d’appeler cette interface :

- Le <a href={`${project.urls.repo}/tree/main/scripts/web-socket-server`}>serveur WebSocket fourni</a>. Consultez le [guide](../guides/web-socket-server.md) pour savoir comment configurer le serveur WebSocket.
- (v1.23 et ultérieures) Une connexion entre extensions obtenue avec [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect). Consultez le [guide](../guides/external-extensions.md) pour savoir comment connecter asbplayer à une autre extension.

## Commandes {#commands}

asbplayer répond aux commandes suivantes, représentées sous forme de messages JSON-RPC. Vous trouverez le schéma OpenRPC [ici](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json).

:::info
Les extensions asbplayer en version 1.22 et antérieures utilisent le schéma `{ command, messageId, body }` plutôt que `{ method, id, params }`.
:::

## `mine-subtitle` {#mine-subtitle}

Par défaut, cette commande extrait le sous-titre de l’onglet actif. Définissez `mediaId` sur un identifiant renvoyé par [`get-bound-media`](#get-bound-media) pour cibler un média précis. Si le média est introuvable ou ne contient aucun sous-titre, `published` vaut `false`.

Lorsque `postMineAction` vaut `2`, `noteId` désigne la note Anki à mettre à jour. Si ce paramètre est omis, la dernière note ajoutée est mise à jour. `noteId` ne concerne que les médias en streaming et est ignoré pour les médias locaux.

> `mediaId` et `noteId` nécessitent la version 1.20.0 ou ultérieure de l’extension.

### Requête {#mine-subtitle-request}

    ```javascript
    {
        "jsonrpc": "2.0",
        "id": "10281760-d787-4356-8572-f698d8ff3884",
        "method": "mine-subtitle",
        "params": {
            // 0 = "None", 1 = "Show Anki dialog", 2 = "Update last card", 3 = "Export card", 4 = "Show update card dialog"
            "postMineAction": 1,
            // Key-value pairs corresponding to an Anki note type
            "fields": {
                "key1": "value1",
                "key2": "value2"
            },
            // Optional media id from `get-bound-media`
            "mediaId": "a1b2c3d4e5f6",
            // Optional Anki note id to update when postMineAction is 2 (streaming media only)
            "noteId": 1752856898044
        }
    }
    ```

### Réponse {#mine-subtitle-response}

    ```javascript
    {
        "jsonrpc": "2.0",
        // Same id received in request
        "id": "10281760-d787-4356-8572-f698d8ff3884",
        "result": {
            // Whether the command was successfully published to an asbplayer client
            "published": true
        }
    }
    ```

## `load-subtitles` {#load-subtitles}

Par défaut, cette commande charge les fichiers dans le média de l’onglet actif et affiche le sélecteur vidéo si l’onglet contient plusieurs vidéos. Définissez `mediaId` sur un identifiant renvoyé par [`get-bound-media`](#get-bound-media) pour charger les fichiers directement dans ce média.

> `mediaId` nécessite la version 1.23.0 ou ultérieure de l’extension. Les versions précédentes chargent les fichiers dans tous les onglets associés à une vidéo.

### Requête {#load-subtitles-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "method": "load-subtitles",
    "params": {
        "files": [{
            // Name of the file, including its extension
            "name": "some-file.srt",
            // Base64-encoded file contents
            "base64": "Zm9vYmFyY..."
        }],
        // Optional media id from `get-bound-media`
        "mediaId": "a1b2c3d4e5f6"
    }
}
```

### Réponse {#load-subtitles-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "result": {}
}
```

## `seek-timestamp` {#seek-timestamp}

Par défaut, cette commande déplace la lecture dans le média de l’onglet actif. Définissez `mediaId` sur un identifiant renvoyé par [`get-bound-media`](#get-bound-media) pour cibler un média précis.

> `mediaId` nécessite la version 1.20.0 ou ultérieure de l’extension. Le déplacement dans un média local nécessite la version 1.23.0 ou ultérieure.

### Requête {#seek-timestamp-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "method": "seek-timestamp",
    "params": {
        //The timestamp to seek in seconds
        "timestamp": 30.5,
        // Optional media id from `get-bound-media`
        "mediaId": "a1b2c3d4e5f6"
    }
}
```

### Réponse {#seek-timestamp-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "result": {}
}
```

## `get-bound-media` {#get-bound-media}

> Nécessite la version 1.20.0 ou ultérieure de l’extension.

Renvoie les médias actuellement suivis par asbplayer, qu’ils soient `streaming` ou `local`.

### Requête {#get-bound-media-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "method": "get-bound-media",
    "params": {}
}
```

### Réponse {#get-bound-media-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "result": {
        "media": [{
            // Identifier for the media
            "id": "a1b2c3d4e5f6",
            // Type of media: "streaming" or "local"
            "type": "streaming",
            // Display title for the media, if available
            "title": "Title of the Video",
            // Favicon of the tab containing the media, if available
            "faviconUrl": "https://example.com/favicon.ico",
            // Subtitle tracks currently loaded for this media. Empty if none are loaded.
            "loadedSubtitles": [{
                // Track number
                "trackNumber": 0,
                // File name of the subtitle track
                "fileName": "subtitles.srt"
            }],
            // Whether the media's tab is the active tab of its window
            "active": true
        }]
    }
}
```

## `get-subtitles` {#get-subtitles}

> Nécessite la version 1.20.0 ou ultérieure de l’extension.

Renvoie les sous-titres actuellement chargés pour un média. Par défaut, la commande cible le média de l’onglet actif ; indiquez un `mediaId` renvoyé par [`get-bound-media`](#get-bound-media) pour cibler un média précis.
Renvoie une liste vide si aucun média correspondant n’est trouvé ou qu’aucun sous-titre n’est chargé.

### Requête {#get-subtitles-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "2d7e8a1b-9c4f-4e3a-8b6d-1f0c5a2e9d7b",
    "method": "get-subtitles",
    "params": {
        // Optional media id from `get-bound-media`. Defaults to the active tab when omitted.
        "mediaId": "a1b2c3d4e5f6",
        // Optional track numbers from `get-bound-media`. Returns all loaded tracks when omitted.
        "trackNumbers": [0]
    }
}
```

### Réponse {#get-subtitles-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "2d7e8a1b-9c4f-4e3a-8b6d-1f0c5a2e9d7b",
    "result": {
        // Loaded subtitles. `start`/`end` are in milliseconds; `track` is the loaded track number.
        "subtitles": [
            { "text": "Hello", "start": 1000, "end": 2000, "track": 0 }
        ]
    }
}
```

## `client-info` {#client-info}

Renvoie des informations sur le client asbplayer, comme les protocoles pris en charge. Les versions récentes d’asbplayer prennent en charge JSON-RPC.

### Requête {#client-info-request}

```javascript
{
    "jsonrpc": "2.0",
    // Request id used to correlate the probe response
    "id": "e3b0c442-98fc-4c14-9b2c-1c5a2e9d7b6f",
    "method": "client-info",
    "params": {}
}
```

### Réponse {#client-info-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "e3b0c442-98fc-4c14-9b2c-1c5a2e9d7b6f",
    "result": {
        "protocols": ["jsonrpc-2.0"]
    }
}
```

## `rpc.discover` {#rpc-discover}

Renvoie le document OpenRPC de la version en cours. Utilisez-le pour connaître les noms des méthodes, les paramètres, les résultats et les balises de transport actuels plutôt que de les coder en dur.

### Requête {#rpc-discover-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "5f2b9c4d-7e1a-4b8f-9d3c-6a0e2f7b1c84",
    "method": "rpc.discover",
    "params": {}
}
```

### Réponse {#rpc-discover-response}

Renvoie le document OpenRPC qui décrit les méthodes JSON-RPC prises en charge. Consultez [`external-api/openrpc.json`](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json) pour obtenir le document complet.

## Codes d’erreur {#error-codes}

Les erreurs utilisent l’objet d’erreur JSON-RPC standard :

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request, or null when the request id is unusable
    "id": "10281760-d787-4356-8572-f698d8ff3884",
    "error": {
        "code": -32602,
        "message": "Invalid params",
        // Optional additional details
        "data": []
    }
}
```

| Code     | Signification    | Notes                                                           |
| -------- | ---------------- | --------------------------------------------------------------- |
| `-32700` | Erreur d’analyse | La trame n’est pas un JSON valide.                              |
| `-32600` | Requête invalide | La trame n’est pas une requête JSON-RPC valide.                 |
| `-32601` | Méthode introuvable | Méthode inconnue ou indisponible sur ce transport.          |
| `-32602` | Paramètres invalides | Les paramètres de la méthode ne respectent pas le schéma. |
| `-32603` | Erreur interne   | Le gestionnaire a échoué ou a renvoyé un résultat non valide.  |
| `-32000` | Délai dépassé    | Le serveur n’a pas reçu de réponse d’asbplayer à temps.         |
| `-32001` | Aucun client     | Aucun asbplayer n’est connecté au serveur pour recevoir la requête. |
| `-32002` | Non autorisé     | Une extension externe a envoyé une commande avant son autorisation. |

Les notifications ne reçoivent jamais de réponse, même lorsque leur traitement échoue. Une requête dont l’`id` est inutilisable reçoit une réponse d’erreur avec `id: null`.

Le pont HTTP du serveur Go associe ces erreurs à des statuts HTTP ; consultez [`external-api/README.md`](https://github.com/asbplayer/asbplayer/blob/main/external-api/README.md#error-codes).
