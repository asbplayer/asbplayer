---
sidebar_position: 2
description: Технический справочник по внешнему интерфейсу asbplayer и реализующему его серверу WebSocket.
---

import project, { ankiConnectUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# Внешний API {#external-api}

На этой странице приведён технический справочник по внешнему интерфейсу asbplayer. Ниже описаны способы вызова интерфейса:

- <a href={`${project.urls.repo}/tree/main/scripts/web-socket-server`}>Готовый сервер WebSocket</a>. Инструкции по его настройке см. в [руководстве](../guides/web-socket-server.md).
- (v1.23 и новее) Соединение между расширениями, полученное через [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect). О подключении к asbplayer из другого расширения см. [руководство](../guides/external-extensions.md).

## Команды {#commands}

asbplayer отвечает на следующие команды, передаваемые в виде сообщений JSON-RPC. Схема OpenRPC доступна [здесь](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json).

:::info
Расширения asbplayer версии v1.22 и ниже поддерживают схему `{ command, messageId, body }` вместо `{ method, id, params }`.
:::

## `mine-subtitle` {#mine-subtitle}

По умолчанию майнит из активной вкладки. Чтобы выбрать определённый медиафайл, задайте `mediaId` равным идентификатору, полученному от [`get-bound-media`](#get-bound-media). Если медиафайл не найден или в нём нет субтитров, значение `published` будет `false`.

Если `postMineAction` имеет значение `2`, параметр `noteId` указывает заметку Anki для обновления. Если он не задан, обновляется последняя добавленная заметка. `noteId` используется только для потокового медиа и игнорируется для локальных файлов.

> Для `mediaId` и `noteId` требуется расширение версии v1.20.0 или новее.

### Запрос {#mine-subtitle-request}

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

### Ответ {#mine-subtitle-response}

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

По умолчанию загружает файлы в медиафайл активной вкладки. Если на вкладке несколько видео, показывается их список. Чтобы загрузить файлы в определённый медиафайл, задайте `mediaId` равным идентификатору, полученному от [`get-bound-media`](#get-bound-media).

> Для `mediaId` требуется расширение версии v1.23.0 или новее. В более ранних версиях файлы загружаются во все вкладки с привязанным видео.

### Запрос {#load-subtitles-request}

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

### Ответ {#load-subtitles-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "result": {}
}
```

## `seek-timestamp` {#seek-timestamp}

По умолчанию перематывает медиафайл активной вкладки. Чтобы выбрать определённый медиафайл, задайте `mediaId` равным идентификатору, полученному от [`get-bound-media`](#get-bound-media).

> Для `mediaId` требуется расширение версии v1.20.0 или новее. Для перемотки локальных медиафайлов требуется версия v1.23.0 или новее.

### Запрос {#seek-timestamp-request}

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

### Ответ {#seek-timestamp-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "result": {}
}
```

## `get-bound-media` {#get-bound-media}

> Требуется расширение версии v1.20.0 или новее.

Возвращает медиафайлы, которые сейчас отслеживает asbplayer, включая потоковые (`streaming`) и локальные (`local`).

### Запрос {#get-bound-media-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "method": "get-bound-media",
    "params": {}
}
```

### Ответ {#get-bound-media-response}

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

> Требуется расширение версии v1.20.0 или новее.

Возвращает субтитры, загруженные для медиафайла. По умолчанию выбирается медиафайл активной вкладки; чтобы указать конкретный файл, передайте `mediaId` из [`get-bound-media`](#get-bound-media).
Если подходящий медиафайл не найден или субтитры не загружены, возвращается пустой список.

### Запрос {#get-subtitles-request}

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

### Ответ {#get-subtitles-response}

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

Возвращает сведения о клиенте asbplayer, например поддерживаемые протоколы. Последние версии asbplayer поддерживают JSON-RPC.

### Запрос {#client-info-request}

```javascript
{
    "jsonrpc": "2.0",
    // Request id used to correlate the probe response
    "id": "e3b0c442-98fc-4c14-9b2c-1c5a2e9d7b6f",
    "method": "client-info",
    "params": {}
}
```

### Ответ {#client-info-response}

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

Возвращает документ OpenRPC для запущенной сборки. Используйте его, чтобы получить актуальные названия методов, параметры, результаты и метки транспорта, не прописывая их вручную.

### Запрос {#rpc-discover-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "5f2b9c4d-7e1a-4b8f-9d3c-6a0e2f7b1c84",
    "method": "rpc.discover",
    "params": {}
}
```

### Ответ {#rpc-discover-response}

Возвращает документ OpenRPC с описанием поддерживаемых методов JSON-RPC. Полный документ см. в [`external-api/openrpc.json`](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json).

## Коды ошибок {#error-codes}

Для ошибок используется стандартный объект JSON-RPC:

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

| Код | Значение | Примечания |
| -------- | ---------------- | --------------------------------------------------------------- |
| `-32700` | Ошибка разбора | Сообщение не является допустимым JSON. |
| `-32600` | Недопустимый запрос | Сообщение не является допустимым запросом JSON-RPC. |
| `-32601` | Метод не найден | Неизвестный метод или метод, недоступный для этого транспорта. |
| `-32602` | Недопустимые параметры | Параметры метода не прошли проверку по схеме. |
| `-32603` | Внутренняя ошибка | Обработчик завершился с ошибкой или вернул результат, не прошедший проверку. |
| `-32000` | Истекло время ожидания | Сервер не получил ответ от asbplayer вовремя. |
| `-32001` | Нет клиентов | К серверу не подключён asbplayer, которому можно переслать запрос. |
| `-32002` | Не одобрено | Внешнее расширение отправило команду до получения одобрения. |

На уведомления ответы не отправляются, даже если обработка завершилась ошибкой. На запрос с недопустимым `id` возвращается сообщение об ошибке с `id: null`.

HTTP-мост сервера Go сопоставляет этим ошибкам статусы HTTP; см. [`external-api/README.md`](https://github.com/asbplayer/asbplayer/blob/main/external-api/README.md#error-codes).
