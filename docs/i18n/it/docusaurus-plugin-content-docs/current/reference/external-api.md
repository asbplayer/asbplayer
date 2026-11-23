---
sidebar_position: 2
description: Riferimento tecnico all'interfaccia esterna di asbplayer e al server WebSocket che la implementa.
---

import project, { ankiConnectUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# API esterna {#external-api}

Questa pagina è un riferimento tecnico all'interfaccia esterna di asbplayer. Ecco i modi per richiamarla:

- Il <a href={`${project.urls.repo}/tree/main/scripts/web-socket-server`}>server WebSocket preconfigurato</a>. Consulta la [guida](../guides/web-socket-server.md) per configurare il server WebSocket.
- (v1.23 e successive) Tramite una connessione tra estensioni ottenuta con [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect). Consulta la [guida](../guides/external-extensions.md) per collegarti ad asbplayer da un'altra estensione.

## Comandi {#commands}

asbplayer risponde ai seguenti comandi, rappresentati come messaggi JSON-RPC. Lo schema OpenRPC è disponibile [qui](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json).

:::info
Le estensioni di asbplayer v1.22 e precedenti supportano lo schema `{ command, messageId, body }` invece di `{ method, id, params }`.
:::

## `mine-subtitle` {#mine-subtitle}

Per impostazione predefinita, estrae il sottotitolo dalla scheda attiva. Imposta `mediaId` su un ID restituito da [`get-bound-media`](#get-bound-media) per selezionare un contenuto specifico. Se il contenuto non viene trovato o non ha sottotitoli, `published` è `false`.

Quando `postMineAction` è `2`, `noteId` seleziona la nota Anki da aggiornare. Se omesso, viene aggiornata l'ultima nota aggiunta. `noteId` si applica solo ai contenuti in streaming e viene ignorato per quelli locali.

> `mediaId` e `noteId` richiedono la versione 1.20.0 o successiva dell'estensione.

### Richiesta {#mine-subtitle-request}

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

### Risposta {#mine-subtitle-response}

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

Per impostazione predefinita, carica i file nel contenuto della scheda attiva; se la scheda contiene più video, mostra il selettore dei video. Imposta `mediaId` su un ID restituito da [`get-bound-media`](#get-bound-media) per caricare i file direttamente nel contenuto corrispondente.

> `mediaId` richiede la versione 1.23.0 o successiva dell'estensione. Le versioni precedenti caricano i file in tutte le schede associate a un video.

### Richiesta {#load-subtitles-request}

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

### Risposta {#load-subtitles-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "result": {}
}
```

## `seek-timestamp` {#seek-timestamp}

Per impostazione predefinita, sposta la riproduzione del contenuto nella scheda attiva. Imposta `mediaId` su un ID restituito da [`get-bound-media`](#get-bound-media) per selezionare un contenuto specifico.

> `mediaId` richiede la versione 1.20.0 o successiva dell'estensione. Per spostare la riproduzione dei contenuti locali è necessaria la versione 1.23.0 o successiva.

### Richiesta {#seek-timestamp-request}

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

### Risposta {#seek-timestamp-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "result": {}
}
```

## `get-bound-media` {#get-bound-media}

> Richiede la versione 1.20.0 o successiva dell'estensione.

Restituisce i contenuti che asbplayer sta monitorando, sia `streaming` sia `local`.

### Richiesta {#get-bound-media-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "method": "get-bound-media",
    "params": {}
}
```

### Risposta {#get-bound-media-response}

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

> Richiede la versione 1.20.0 o successiva dell'estensione.

Restituisce i sottotitoli attualmente caricati per un contenuto. Per impostazione predefinita, seleziona il contenuto della scheda attiva; passa un `mediaId` ottenuto da [`get-bound-media`](#get-bound-media) per selezionarne uno specifico.
Restituisce un elenco vuoto se non trova contenuti corrispondenti o se non sono caricati sottotitoli.

### Richiesta {#get-subtitles-request}

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

### Risposta {#get-subtitles-response}

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

Restituisce informazioni sul client asbplayer, ad esempio i protocolli supportati. Le versioni più recenti di asbplayer supportano JSON-RPC.

### Richiesta {#client-info-request}

```javascript
{
    "jsonrpc": "2.0",
    // Request id used to correlate the probe response
    "id": "e3b0c442-98fc-4c14-9b2c-1c5a2e9d7b6f",
    "method": "client-info",
    "params": {}
}
```

### Risposta {#client-info-response}

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

Restituisce il documento OpenRPC della build in esecuzione. Usalo per scoprire i nomi correnti dei metodi, i parametri, i risultati e i tag di trasporto invece di inserirli direttamente nel codice.

### Richiesta {#rpc-discover-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "5f2b9c4d-7e1a-4b8f-9d3c-6a0e2f7b1c84",
    "method": "rpc.discover",
    "params": {}
}
```

### Risposta {#rpc-discover-response}

Restituisce il documento OpenRPC che descrive i metodi JSON-RPC supportati. Per il documento completo, consulta [`external-api/openrpc.json`](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json).

## Codici di errore {#error-codes}

Gli errori usano l'oggetto di errore JSON-RPC standard:

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

| Codice   | Significato       | Note                                                            |
| -------- | ---------------- | --------------------------------------------------------------- |
| `-32700` | Errore di parsing | Il frame non è JSON valido.                                     |
| `-32600` | Richiesta non valida | Il frame non è una richiesta JSON-RPC valida.                |
| `-32601` | Metodo non trovato | Metodo sconosciuto o non disponibile su quel trasporto.       |
| `-32602` | Parametri non validi | I parametri del metodo non hanno superato la convalida dello schema. |
| `-32603` | Errore interno    | Il gestore non ha funzionato o ha restituito un risultato non valido. |
| `-32000` | Timeout richiesta | Un server non ha ricevuto la risposta di asbplayer in tempo.   |
| `-32001` | Nessun client     | Un server non ha client asbplayer a cui inoltrare la richiesta. |
| `-32002` | Non approvato     | Un'estensione esterna ha inviato un comando prima di essere approvata. |

Le notifiche non ricevono mai risposta, neanche se si verifica un errore durante l'elaborazione. Una richiesta con un `id` inutilizzabile riceve una risposta di errore con `id: null`.

Il bridge HTTP del server Go associa questi errori ai codici di stato HTTP; consulta [`external-api/README.md`](https://github.com/asbplayer/asbplayer/blob/main/external-api/README.md#error-codes).
