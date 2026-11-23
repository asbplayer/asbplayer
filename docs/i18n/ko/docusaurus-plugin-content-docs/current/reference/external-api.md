---
sidebar_position: 2
description: asbplayer의 외부 인터페이스와 이를 구현하는 WebSocket 서버에 관한 기술 참고 자료입니다.
---

import project, { ankiConnectUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# 외부 API {#external-api}

이 페이지에서는 asbplayer의 외부 인터페이스에 관한 기술 정보를 설명합니다. 인터페이스를 호출하는 방법은 다음과 같습니다.

- <a href={`${project.urls.repo}/tree/main/scripts/web-socket-server`}>사전 패키징된 WebSocket 서버</a>. 서버 설정 방법은 [안내](../guides/web-socket-server.md)를 참고하세요.
- (v1.23 이상) [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect)로 확장 프로그램 간 연결을 사용합니다. 다른 확장 프로그램에서 asbplayer에 연결하는 방법은 [안내](../guides/external-extensions.md)를 참고하세요.

## 명령 {#commands}

asbplayer는 JSON-RPC 메시지로 표현된 다음 명령에 응답합니다. OpenRPC 스키마는 [여기](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json)에서 확인할 수 있습니다.

:::info
asbplayer 확장 프로그램 v1.22 이하에서는 `{ method, id, params }` 대신 `{ command, messageId, body }` 스키마를 지원합니다.
:::

## `mine-subtitle` {#mine-subtitle}

기본적으로 활성 탭에서 마이닝합니다. 특정 미디어를 대상으로 하려면 `mediaId`를 [`get-bound-media`](#get-bound-media)가 반환한 ID로 설정합니다. 미디어를 찾을 수 없거나 자막이 없으면 `published`는 `false`입니다.

`postMineAction`이 `2`이면 `noteId`로 업데이트할 Anki 노트를 선택합니다. 생략하면 마지막으로 추가된 노트가 업데이트됩니다. `noteId`는 스트리밍 미디어에만 적용되며 로컬 미디어에서는 무시됩니다.

> `mediaId`와 `noteId`를 사용하려면 확장 프로그램 v1.20.0 이상이 필요합니다.

### 요청 {#mine-subtitle-request}

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

### 응답 {#mine-subtitle-response}

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

기본적으로 활성 탭의 미디어에 파일을 불러옵니다. 탭에 동영상이 여러 개 있으면 동영상 선택기가 표시됩니다. 파일을 특정 미디어에 바로 불러오려면 `mediaId`를 [`get-bound-media`](#get-bound-media)가 반환한 ID로 설정합니다.

> `mediaId`를 사용하려면 확장 프로그램 v1.23.0 이상이 필요합니다. 이전 버전에서는 연결된 동영상이 있는 모든 탭에 파일을 불러옵니다.

### 요청 {#load-subtitles-request}

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

### 응답 {#load-subtitles-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "result": {}
}
```

## `seek-timestamp` {#seek-timestamp}

기본적으로 활성 탭의 미디어를 탐색합니다. 특정 미디어를 대상으로 하려면 `mediaId`를 [`get-bound-media`](#get-bound-media)가 반환한 ID로 설정합니다.

> `mediaId`를 사용하려면 확장 프로그램 v1.20.0 이상이 필요합니다. 로컬 미디어를 탐색하려면 확장 프로그램 v1.23.0 이상이 필요합니다.

### 요청 {#seek-timestamp-request}

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

### 응답 {#seek-timestamp-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "result": {}
}
```

## `get-bound-media` {#get-bound-media}

> 확장 프로그램 v1.20.0 이상이 필요합니다.

현재 asbplayer가 추적 중인 미디어를 반환합니다. `streaming` 및 `local` 미디어가 모두 포함됩니다.

### 요청 {#get-bound-media-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "method": "get-bound-media",
    "params": {}
}
```

### 응답 {#get-bound-media-response}

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

> 확장 프로그램 v1.20.0 이상이 필요합니다.

미디어에 현재 불러온 자막을 반환합니다. 기본적으로 활성 탭의 미디어를 대상으로 합니다. 특정 미디어를 대상으로 하려면 [`get-bound-media`](#get-bound-media)가 반환한 `mediaId`를 전달합니다.
일치하는 미디어를 찾을 수 없거나 불러온 자막이 없으면 빈 목록을 반환합니다.

### 요청 {#get-subtitles-request}

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

### 응답 {#get-subtitles-response}

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

지원 프로토콜과 같은 asbplayer 클라이언트 정보를 반환합니다. 최신 버전의 asbplayer는 JSON-RPC를 지원합니다.

### 요청 {#client-info-request}

```javascript
{
    "jsonrpc": "2.0",
    // Request id used to correlate the probe response
    "id": "e3b0c442-98fc-4c14-9b2c-1c5a2e9d7b6f",
    "method": "client-info",
    "params": {}
}
```

### 응답 {#client-info-response}

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

현재 실행 중인 빌드의 OpenRPC 문서를 반환합니다. 메서드 이름, 매개변수, 결과, 전송 태그를 코드에 직접 지정하는 대신 이 문서에서 확인할 수 있습니다.

### 요청 {#rpc-discover-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "5f2b9c4d-7e1a-4b8f-9d3c-6a0e2f7b1c84",
    "method": "rpc.discover",
    "params": {}
}
```

### 응답 {#rpc-discover-response}

지원되는 JSON-RPC 메서드를 설명하는 OpenRPC 문서를 반환합니다. 전체 문서는 [`external-api/openrpc.json`](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json)을 참고하세요.

## 오류 코드 {#error-codes}

오류는 표준 JSON-RPC 오류 객체를 사용합니다.

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

| 코드     | 의미          | 참고                                                           |
| -------- | ---------------- | --------------------------------------------------------------- |
| `-32700` | 구문 분석 오류      | 프레임이 올바른 JSON이 아닙니다.                                    |
| `-32600` | 잘못된 요청  | 프레임이 올바른 JSON-RPC 요청이 아닙니다.                      |
| `-32601` | 메서드를 찾을 수 없음 | 알 수 없는 메서드이거나 해당 전송 방식에서 사용할 수 없는 메서드입니다.      |
| `-32602` | 잘못된 매개변수   | 메서드의 매개변수가 스키마 검증을 통과하지 못했습니다.                   |
| `-32603` | 내부 오류   | 핸들러가 실패했거나 검증에 실패한 결과를 반환했습니다. |
| `-32000` | 요청 시간 초과  | 서버가 제한 시간 내에 asbplayer의 응답을 받지 못했습니다.     |
| `-32001` | 클라이언트 없음       | 요청을 전달할 연결된 asbplayer가 서버에 없습니다.  |
| `-32002` | 승인되지 않음     | 외부 확장 프로그램이 승인되기 전에 명령을 보냈습니다.     |

처리에 실패하더라도 알림에는 응답하지 않습니다. 사용할 수 없는 `id`가 포함된 요청에는 `id: null`인 오류 응답을 반환합니다.

Go 서버의 HTTP 브리지는 이러한 오류를 HTTP 상태 코드에 대응시킵니다. 자세한 내용은 [`external-api/README.md`](https://github.com/asbplayer/asbplayer/blob/main/external-api/README.md#error-codes)를 참고하세요.
