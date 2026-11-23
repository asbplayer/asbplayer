---
sidebar_position: 2
description: Dokumentacja techniczna interfejsu zewnętrznego asbplayera i serwera WebSocket, który go udostępnia.
---

import project, { ankiConnectUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# Zewnętrzne API {#external-api}

Ta strona zawiera dokumentację techniczną interfejsu zewnętrznego asbplayera. Interfejsu można używać na następujące sposoby:

- Za pomocą <a href={`${project.urls.repo}/tree/main/scripts/web-socket-server`}>dołączonego serwera WebSocket</a>. Instrukcję konfiguracji znajdziesz w [przewodniku](../guides/web-socket-server.md).
- (Od wersji v1.23) Za pomocą połączenia między rozszerzeniami uzyskanego przez [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect). Zobacz [przewodnik](../guides/external-extensions.md), aby dowiedzieć się, jak połączyć się z asbplayerem z innego rozszerzenia.

## Polecenia {#commands}

asbplayer obsługuje poniższe polecenia, przekazywane jako komunikaty JSON-RPC. Schemat OpenRPC znajduje się [tutaj](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json).

:::info
Rozszerzenia asbplayer w wersji v1.22 i starszych obsługują schemat `{ command, messageId, body }` zamiast `{ method, id, params }`.
:::

## `mine-subtitle` {#mine-subtitle}

Domyślnie tworzy fiszkę z napisów na aktywnej karcie. Ustaw `mediaId` na identyfikator zwrócony przez [`get-bound-media`](#get-bound-media), aby wskazać konkretne multimedia. Jeśli multimedia nie zostaną znalezione lub nie mają napisów, `published` przyjmuje wartość `false`.

Gdy `postMineAction` ma wartość `2`, `noteId` wskazuje notatkę Anki do zaktualizowania. Jeśli go nie podano, aktualizowana jest ostatnio dodana notatka. `noteId` dotyczy tylko multimediów strumieniowych i jest ignorowane dla lokalnych.

> `mediaId` i `noteId` wymagają rozszerzenia w wersji v1.20.0 lub nowszej.

### Żądanie {#mine-subtitle-request}

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

### Odpowiedź {#mine-subtitle-response}

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

Domyślnie wczytuje pliki do multimediów na aktywnej karcie. Jeśli karta zawiera więcej niż jedno wideo, wyświetla selektor wideo. Ustaw `mediaId` na identyfikator zwrócony przez [`get-bound-media`](#get-bound-media), aby wczytać pliki bezpośrednio do wybranych multimediów.

> `mediaId` wymaga rozszerzenia w wersji v1.23.0 lub nowszej. Starsze wersje wczytują pliki na każdej karcie z przypisanym wideo.

### Żądanie {#load-subtitles-request}

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

### Odpowiedź {#load-subtitles-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "result": {}
}
```

## `seek-timestamp` {#seek-timestamp}

Domyślnie przewija multimedia na aktywnej karcie. Ustaw `mediaId` na identyfikator zwrócony przez [`get-bound-media`](#get-bound-media), aby wskazać konkretne multimedia.

> `mediaId` wymaga rozszerzenia w wersji v1.20.0 lub nowszej. Przewijanie lokalnych multimediów wymaga wersji v1.23.0 lub nowszej.

### Żądanie {#seek-timestamp-request}

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

### Odpowiedź {#seek-timestamp-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "result": {}
}
```

## `get-bound-media` {#get-bound-media}

> Wymaga rozszerzenia w wersji v1.20.0 lub nowszej.

Zwraca multimedia śledzone obecnie przez asbplayera, zarówno `streaming`, jak i `local`.

### Żądanie {#get-bound-media-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "method": "get-bound-media",
    "params": {}
}
```

### Odpowiedź {#get-bound-media-response}

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

> Wymaga rozszerzenia w wersji v1.20.0 lub nowszej.

Zwraca napisy wczytane obecnie do multimediów. Domyślnie dotyczy multimediów na aktywnej karcie; przekaż `mediaId` z [`get-bound-media`](#get-bound-media), aby wskazać konkretne multimedia.
Jeśli nie znaleziono pasujących multimediów lub nie wczytano napisów, zwracana jest pusta lista.

### Żądanie {#get-subtitles-request}

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

### Odpowiedź {#get-subtitles-response}

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

Zwraca informacje o kliencie asbplayer, takie jak obsługiwane protokoły. Najnowsze wersje asbplayera obsługują JSON-RPC.

### Żądanie {#client-info-request}

```javascript
{
    "jsonrpc": "2.0",
    // Request id used to correlate the probe response
    "id": "e3b0c442-98fc-4c14-9b2c-1c5a2e9d7b6f",
    "method": "client-info",
    "params": {}
}
```

### Odpowiedź {#client-info-response}

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

Zwraca dokument OpenRPC dla uruchomionej kompilacji. Użyj go, aby poznać bieżące nazwy metod, parametry, wyniki i tagi transportu, zamiast wpisywać je na stałe.

### Żądanie {#rpc-discover-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "5f2b9c4d-7e1a-4b8f-9d3c-6a0e2f7b1c84",
    "method": "rpc.discover",
    "params": {}
}
```

### Odpowiedź {#rpc-discover-response}

Zwraca dokument OpenRPC opisujący obsługiwane metody JSON-RPC. Pełny dokument znajdziesz w pliku [`external-api/openrpc.json`](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json).

## Kody błędów {#error-codes}

Błędy używają standardowego obiektu błędu JSON-RPC:

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

| Kod      | Znaczenie        | Uwagi                                                           |
| -------- | ---------------- | --------------------------------------------------------------- |
| `-32700` | Błąd parsowania | Ramka nie zawiera prawidłowego JSON-a.                         |
| `-32600` | Nieprawidłowe żądanie | Ramka nie jest prawidłowym żądaniem JSON-RPC.             |
| `-32601` | Nie znaleziono metody | Nieznana metoda lub metoda niedostępna w tym transporcie. |
| `-32602` | Nieprawidłowe parametry | Parametry metody nie przeszły walidacji schematu.       |
| `-32603` | Błąd wewnętrzny | Obsługa żądania nie powiodła się lub zwróciła wynik, który nie przeszedł walidacji. |
| `-32000` | Przekroczono limit czasu żądania | Serwer nie otrzymał na czas odpowiedzi od asbplayera. |
| `-32001` | Brak klientów | Serwer nie ma połączonego klienta asbplayer, któremu mógłby przekazać żądanie. |
| `-32002` | Brak zgody | Zewnętrzne rozszerzenie wysłało polecenie przed uzyskaniem zgody. |

Powiadomienia nigdy nie otrzymują odpowiedzi, nawet jeśli ich obsługa się nie powiedzie. Żądanie z nieprawidłowym `id` otrzymuje odpowiedź o błędzie z `id: null`.

Mostek HTTP serwera Go mapuje te błędy na kody statusu HTTP; zobacz [`external-api/README.md`](https://github.com/asbplayer/asbplayer/blob/main/external-api/README.md#error-codes).
