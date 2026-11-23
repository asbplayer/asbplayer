---
sidebar_position: 2
description: Referencia técnica de la interfaz externa de asbplayer y del servidor WebSocket que la implementa.
---

import project, { ankiConnectUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# API externa {#external-api}

Esta página es una referencia técnica de la interfaz externa de asbplayer. A continuación se describen las formas de llamar a la interfaz:

- El <a href={`${project.urls.repo}/tree/main/scripts/web-socket-server`}>servidor WebSocket incluido</a>. Consulta la [guía](../guides/web-socket-server.md) para saber cómo configurar el servidor WebSocket.
- (Versión 1.23 y posteriores) Una conexión entre extensiones obtenida mediante [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect). Consulta la [guía](../guides/external-extensions.md) para saber cómo conectarte a asbplayer desde otra extensión.

## Comandos {#commands}

asbplayer responde a los siguientes comandos, representados como mensajes JSON-RPC. Puedes consultar el esquema OpenRPC [aquí](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json).

:::info
Las extensiones de asbplayer de la versión 1.22 y anteriores admiten el esquema `{ command, messageId, body }` en lugar de `{ method, id, params }`.
:::

## `mine-subtitle` {#mine-subtitle}

De forma predeterminada, crea una tarjeta a partir de los subtítulos de la pestaña activa. Establece `mediaId` en un ID devuelto por [`get-bound-media`](#get-bound-media) para seleccionar un elemento multimedia específico. Si no se encuentra el elemento multimedia o no tiene subtítulos, `published` será `false`.

Cuando `postMineAction` es `2`, `noteId` selecciona la nota de Anki que se actualizará. Si se omite, se actualiza la última nota añadida. `noteId` solo se aplica a los elementos multimedia en streaming y se ignora para los locales.

> `mediaId` y `noteId` requieren la versión 1.20.0 o posterior de la extensión.

### Solicitud {#mine-subtitle-request}

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

### Respuesta {#mine-subtitle-response}

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

De forma predeterminada, carga los archivos en el elemento multimedia de la pestaña activa. Si hay más de un vídeo en la pestaña, muestra el selector de vídeo. Establece `mediaId` en un ID devuelto por [`get-bound-media`](#get-bound-media) para cargar los archivos directamente en ese elemento multimedia.

> `mediaId` requiere la versión 1.23.0 o posterior de la extensión. Las versiones anteriores cargan los archivos en todas las pestañas vinculadas a un vídeo.

### Solicitud {#load-subtitles-request}

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

### Respuesta {#load-subtitles-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "result": {}
}
```

## `seek-timestamp` {#seek-timestamp}

De forma predeterminada, cambia la posición del elemento multimedia de la pestaña activa. Establece `mediaId` en un ID devuelto por [`get-bound-media`](#get-bound-media) para seleccionar un elemento multimedia específico.

> `mediaId` requiere la versión 1.20.0 o posterior de la extensión. Para avanzar o retroceder en contenido multimedia local, se requiere la versión 1.23.0 o posterior.

### Solicitud {#seek-timestamp-request}

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

### Respuesta {#seek-timestamp-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "result": {}
}
```

## `get-bound-media` {#get-bound-media}

> Requiere la versión 1.20.0 o posterior de la extensión.

Devuelve los elementos multimedia que asbplayer está siguiendo actualmente, tanto `streaming` como `local`.

### Solicitud {#get-bound-media-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "method": "get-bound-media",
    "params": {}
}
```

### Respuesta {#get-bound-media-response}

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

> Requiere la versión 1.20.0 o posterior de la extensión.

Devuelve los subtítulos cargados actualmente para un elemento multimedia. De forma predeterminada, selecciona el elemento multimedia de la pestaña activa; pasa un `mediaId` de [`get-bound-media`](#get-bound-media) para seleccionar un elemento específico.
Devuelve una lista vacía si no se encuentra ningún elemento multimedia coincidente o no hay subtítulos cargados.

### Solicitud {#get-subtitles-request}

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

### Respuesta {#get-subtitles-response}

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

Devuelve información del cliente de asbplayer, como los protocolos admitidos. Las versiones más recientes de asbplayer admiten JSON-RPC.

### Solicitud {#client-info-request}

```javascript
{
    "jsonrpc": "2.0",
    // Request id used to correlate the probe response
    "id": "e3b0c442-98fc-4c14-9b2c-1c5a2e9d7b6f",
    "method": "client-info",
    "params": {}
}
```

### Respuesta {#client-info-response}

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

Devuelve el documento OpenRPC de la compilación en ejecución. Úsalo para consultar los nombres actuales de los métodos, los parámetros, los resultados y las etiquetas de transporte en lugar de escribirlos directamente en el código.

### Solicitud {#rpc-discover-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "5f2b9c4d-7e1a-4b8f-9d3c-6a0e2f7b1c84",
    "method": "rpc.discover",
    "params": {}
}
```

### Respuesta {#rpc-discover-response}

Devuelve el documento OpenRPC que describe los métodos JSON-RPC admitidos. Consulta [`external-api/openrpc.json`](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json) para ver el documento completo.

## Códigos de error {#error-codes}

Los errores usan el objeto de error estándar de JSON-RPC:

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

| Código   | Significado      | Notas                                                           |
| -------- | ---------------- | --------------------------------------------------------------- |
| `-32700` | Error de análisis | El mensaje no es JSON válido.                                    |
| `-32600` | Solicitud no válida | El mensaje no es una solicitud JSON-RPC válida.                  |
| `-32601` | Método no encontrado | Método desconocido o no disponible en ese transporte.       |
| `-32602` | Parámetros no válidos | Los parámetros del método no superaron la validación del esquema. |
| `-32603` | Error interno    | El controlador falló o devolvió un resultado que no superó la validación. |
| `-32000` | Tiempo de espera de la solicitud | El servidor no recibió una respuesta de asbplayer a tiempo. |
| `-32001` | No hay clientes  | No hay ningún asbplayer conectado al servidor al que reenviar la solicitud. |
| `-32002` | No aprobado      | Una extensión externa envió un comando antes de recibir aprobación. |

Las notificaciones nunca reciben respuesta, incluso si falla su procesamiento. Las solicitudes con un `id` no utilizable reciben una respuesta de error con `id: null`.

El puente HTTP del servidor Go asigna estos errores a códigos de estado HTTP; consulta [`external-api/README.md`](https://github.com/asbplayer/asbplayer/blob/main/external-api/README.md#error-codes).
