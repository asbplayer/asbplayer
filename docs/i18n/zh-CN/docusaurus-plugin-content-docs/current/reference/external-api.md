---
sidebar_position: 2
description: asbplayer 外部接口及其 WebSocket 服务器的技术参考。
---

import project, { ankiConnectUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# 外部 API {#external-api}

本页是 asbplayer 外部接口的技术参考。可以通过以下方式调用该接口：

- <a href={`${project.urls.repo}/tree/main/scripts/web-socket-server`}>预打包的 WebSocket 服务器</a>。如何设置 WebSocket 服务器，请参阅[指南](../guides/web-socket-server.md)。
- （v1.23 及以上版本）使用通过 [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect) 建立的扩展间连接。如何从其他扩展连接到 asbplayer，请参阅[指南](../guides/external-extensions.md)。

## 命令 {#commands}

asbplayer 会响应以下以 JSON-RPC 消息表示的命令。OpenRPC 架构见[此处](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json)。

:::info
asbplayer 扩展 v1.22 及以下版本使用 `{ command, messageId, body }` 架构，而不是 `{ method, id, params }`。
:::

## `mine-subtitle` {#mine-subtitle}

默认从活动标签页挖掘。将 `mediaId` 设为 [`get-bound-media`](#get-bound-media) 返回的 ID，即可指定媒体。如果找不到媒体或媒体没有字幕，`published` 会是 `false`。

当 `postMineAction` 为 `2` 时，`noteId` 用于选择要更新的 Anki 笔记。省略该参数时，会更新最近添加的笔记。`noteId` 仅适用于流媒体；对于本地媒体会被忽略。

> `mediaId` 和 `noteId` 需要扩展 v1.20.0 或更高版本。

### 请求 {#mine-subtitle-request}

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

### 响应 {#mine-subtitle-response}

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

默认将文件加载到活动标签页的媒体中；如果标签页中有多个视频，则会显示视频选择器。将 `mediaId` 设为 [`get-bound-media`](#get-bound-media) 返回的 ID，可将文件直接加载到指定媒体。

> `mediaId` 需要扩展 v1.23.0 或更高版本。更早版本会将文件加载到所有已绑定视频的标签页中。

### 请求 {#load-subtitles-request}

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

### 响应 {#load-subtitles-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "result": {}
}
```

## `seek-timestamp` {#seek-timestamp}

默认在活动标签页的媒体中定位。将 `mediaId` 设为 [`get-bound-media`](#get-bound-media) 返回的 ID，即可指定媒体。

> `mediaId` 需要扩展 v1.20.0 或更高版本。定位本地媒体需要扩展 v1.23.0 或更高版本。

### 请求 {#seek-timestamp-request}

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

### 响应 {#seek-timestamp-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "result": {}
}
```

## `get-bound-media` {#get-bound-media}

> 需要扩展 v1.20.0 或更高版本。

返回 asbplayer 当前正在追踪的媒体，包括 `streaming` 和 `local` 媒体。

### 请求 {#get-bound-media-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "method": "get-bound-media",
    "params": {}
}
```

### 响应 {#get-bound-media-response}

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

> 需要扩展 v1.20.0 或更高版本。

返回当前为某个媒体加载的字幕。默认使用活动标签页的媒体；传入 [`get-bound-media`](#get-bound-media) 返回的 `mediaId` 可指定媒体。
找不到匹配的媒体或没有加载字幕时，会返回空列表。

### 请求 {#get-subtitles-request}

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

### 响应 {#get-subtitles-response}

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

返回 asbplayer 客户端信息，例如支持的协议。最新版 asbplayer 支持 JSON-RPC。

### 请求 {#client-info-request}

```javascript
{
    "jsonrpc": "2.0",
    // Request id used to correlate the probe response
    "id": "e3b0c442-98fc-4c14-9b2c-1c5a2e9d7b6f",
    "method": "client-info",
    "params": {}
}
```

### 响应 {#client-info-response}

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

返回当前运行版本的 OpenRPC 文档。可以使用它获取当前的方法名称、参数、结果和传输标签，而不必将这些内容硬编码。

### 请求 {#rpc-discover-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "5f2b9c4d-7e1a-4b8f-9d3c-6a0e2f7b1c84",
    "method": "rpc.discover",
    "params": {}
}
```

### 响应 {#rpc-discover-response}

返回介绍受支持 JSON-RPC 方法的 OpenRPC 文档。完整文档见 [`external-api/openrpc.json`](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json)。

## Error codes {#error-codes}

错误使用标准的 JSON-RPC 错误对象：

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

| 代码     | 含义       | 说明                                                           |
| -------- | ---------- | -------------------------------------------------------------- |
| `-32700` | 解析错误   | 消息帧不是有效的 JSON。                                         |
| `-32600` | 请求无效   | 消息帧不是有效的 JSON-RPC 请求。                                |
| `-32601` | 找不到方法 | 未知方法，或该传输方式不支持此方法。                             |
| `-32602` | 参数无效   | 方法的参数未通过架构验证。                                      |
| `-32603` | 内部错误   | 处理程序执行失败，或返回的结果未通过验证。                      |
| `-32000` | 请求超时   | 服务器未能及时收到 asbplayer 的响应。                           |
| `-32001` | 没有客户端 | 没有已连接的 asbplayer 可供服务器转发请求。                     |
| `-32002` | 未获批准   | 外部扩展在获得批准前发送了命令。                                |

通知不会收到响应，即使处理失败也是如此。对于 `id` 不可用的请求，错误响应中的 `id` 为 `null`。

Go 服务器的 HTTP 桥接会将这些错误映射为 HTTP 状态码；请参阅 [`external-api/README.md`](https://github.com/asbplayer/asbplayer/blob/main/external-api/README.md#error-codes)。
