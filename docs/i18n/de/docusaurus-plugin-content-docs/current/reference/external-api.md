---
sidebar_position: 2
description: Technische Referenz zur externen Schnittstelle von asbplayer und dem WebSocket-Server, der sie bereitstellt.
---

import project, { ankiConnectUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# Externe API {#external-api}

Diese Seite ist als technische Referenz zur externen Schnittstelle von asbplayer gedacht. Die Schnittstelle kann auf folgende Weise aufgerufen werden:

- Der <a href={`${project.urls.repo}/tree/main/scripts/web-socket-server`}>mitgelieferte WebSocket-Server</a>. Eine Anleitung zum Einrichten des WebSocket-Servers finden Sie im [Leitfaden](../guides/web-socket-server.md).
- (Ab Version 1.23) Über eine Erweiterungsverbindung, die mit [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect) hergestellt wird. Im [Leitfaden](../guides/external-extensions.md) erfahren Sie, wie Sie asbplayer von einer anderen Erweiterung aus verbinden.

## Befehle {#commands}

asbplayer verarbeitet die folgenden Befehle, die als JSON-RPC-Nachrichten dargestellt werden. Das OpenRPC-Schema finden Sie [hier](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json).

:::info
asbplayer-Erweiterungen bis einschließlich Version 1.22 unterstützen anstelle von `{ method, id, params }` das Schema `{ command, messageId, body }`.
:::

## `mine-subtitle` {#mine-subtitle}

Standardmäßig wird der Inhalt im aktiven Tab ausgewertet. Setzen Sie `mediaId` auf eine von [`get-bound-media`](#get-bound-media) zurückgegebene ID, um ein bestimmtes Medium auszuwählen. Wird das Medium nicht gefunden oder enthält es keine Untertitel, ist `published` gleich `false`.

Wenn `postMineAction` den Wert `2` hat, legt `noteId` fest, welche Anki-Notiz aktualisiert wird. Wird der Wert weggelassen, wird die zuletzt hinzugefügte Notiz aktualisiert. `noteId` gilt nur für Streaming-Medien und wird bei lokalen Medien ignoriert.

> `mediaId` und `noteId` erfordern Version 1.20.0 oder höher der Erweiterung.

### Anfrage {#mine-subtitle-request}

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

### Antwort {#mine-subtitle-response}

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

Lädt die Dateien standardmäßig in das Medium des aktiven Tabs. Enthält der Tab mehrere Videos, wird die Videoauswahl angezeigt. Setzen Sie `mediaId` auf eine von [`get-bound-media`](#get-bound-media) zurückgegebene ID, um die Dateien direkt in dieses Medium zu laden.

> `mediaId` erfordert Version 1.23.0 oder höher der Erweiterung. Ältere Versionen laden die Dateien in jeden Tab mit einem zugeordneten Video.

### Anfrage {#load-subtitles-request}

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

### Antwort {#load-subtitles-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "result": {}
}
```

## `seek-timestamp` {#seek-timestamp}

Spult standardmäßig im Medium des aktiven Tabs. Setzen Sie `mediaId` auf eine von [`get-bound-media`](#get-bound-media) zurückgegebene ID, um ein bestimmtes Medium auszuwählen.

> `mediaId` erfordert Version 1.20.0 oder höher der Erweiterung. Das Spulen in lokalen Medien erfordert Version 1.23.0 oder höher.

### Anfrage {#seek-timestamp-request}

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

### Antwort {#seek-timestamp-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "result": {}
}
```

## `get-bound-media` {#get-bound-media}

> Requires extension v1.20.0+

Gibt die Medien zurück, die asbplayer derzeit verfolgt, einschließlich `streaming`- und `local`-Medien.

### Anfrage {#get-bound-media-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "method": "get-bound-media",
    "params": {}
}
```

### Antwort {#get-bound-media-response}

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

> Requires extension v1.20.0+

Gibt die Untertitel zurück, die derzeit für ein Medium geladen sind. Standardmäßig gilt die Anfrage für das Medium des aktiven Tabs. Geben Sie eine `mediaId` aus [`get-bound-media`](#get-bound-media) an, um ein bestimmtes Medium auszuwählen.
Wenn kein passendes Medium gefunden wurde oder keine Untertitel geladen sind, wird eine leere Liste zurückgegeben.

### Anfrage {#get-subtitles-request}

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

### Antwort {#get-subtitles-response}

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

Gibt Informationen zum asbplayer-Client zurück, etwa die unterstützten Protokolle. Die neuesten asbplayer-Versionen unterstützen JSON-RPC.

### Anfrage {#client-info-request}

```javascript
{
    "jsonrpc": "2.0",
    // Request id used to correlate the probe response
    "id": "e3b0c442-98fc-4c14-9b2c-1c5a2e9d7b6f",
    "method": "client-info",
    "params": {}
}
```

### Antwort {#client-info-response}

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

Gibt das OpenRPC-Dokument des laufenden Builds zurück. Ermitteln Sie damit die aktuellen Methodennamen, Parameter, Ergebnisse und Transport-Tags, statt diese fest zu codieren.

### Anfrage {#rpc-discover-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "5f2b9c4d-7e1a-4b8f-9d3c-6a0e2f7b1c84",
    "method": "rpc.discover",
    "params": {}
}
```

### Antwort {#rpc-discover-response}

Gibt das OpenRPC-Dokument mit den unterstützten JSON-RPC-Methoden zurück. Das vollständige Dokument finden Sie unter [`external-api/openrpc.json`](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json).

## Fehlercodes {#error-codes}

Fehler verwenden das standardmäßige JSON-RPC-Fehlerobjekt:

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

| Code     | Bedeutung        | Hinweise                                                        |
| -------- | ---------------- | --------------------------------------------------------------- |
| `-32700` | Parsefehler      | Der Frame enthält kein gültiges JSON.                           |
| `-32600` | Ungültige Anfrage | Der Frame ist keine gültige JSON-RPC-Anfrage.                   |
| `-32601` | Methode nicht gefunden | Unbekannte Methode oder eine auf diesem Transport nicht verfügbare Methode. |
| `-32602` | Ungültige Parameter | Die Parameter der Methode haben die Schemaüberprüfung nicht bestanden. |
| `-32603` | Interner Fehler  | Der Handler ist fehlgeschlagen oder hat ein Ergebnis zurückgegeben, das die Überprüfung nicht bestanden hat. |
| `-32000` | Zeitüberschreitung | Ein Server hat nicht rechtzeitig eine Antwort von asbplayer erhalten. |
| `-32001` | Keine Clients    | Ein Server hat keine verbundene asbplayer-Instanz, an die er die Anfrage weiterleiten kann. |
| `-32002` | Nicht genehmigt  | Eine externe Erweiterung hat vor ihrer Genehmigung einen Befehl gesendet. |

Benachrichtigungen erhalten nie eine Antwort, auch dann nicht, wenn ihre Verarbeitung fehlschlägt. Eine Anfrage mit einer nicht verwendbaren `id` erhält eine Fehlerantwort mit `id: null`.

Die HTTP-Brücke des Go-Servers ordnet diese Fehler HTTP-Statuscodes zu. Siehe [`external-api/README.md`](https://github.com/asbplayer/asbplayer/blob/main/external-api/README.md#error-codes).
