---
sidebar_position: 2
description: asbplayerの外部インターフェースと、それを実装するWebSocketサーバーの技術リファレンスです。
---

import project, { ankiConnectUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# 外部API {#external-api}

このページでは、asbplayerの外部インターフェースについて技術的に説明します。インターフェースの呼び出し方法は次のとおりです。

- <a href={`${project.urls.repo}/tree/main/scripts/web-socket-server`}>パッケージに含まれるWebSocketサーバー</a>。WebSocketサーバーのセットアップ方法は[ガイド](../guides/web-socket-server.md)を参照してください。
- （v1.23以降）[browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect)から取得した拡張機能間接続を使用する方法。他の拡張機能からasbplayerに接続する方法は[ガイド](../guides/external-extensions.md)を参照してください。

## コマンド {#commands}

asbplayerはJSON-RPCメッセージで表された次のコマンドに応答します。OpenRPCスキーマは[こちら](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json)で確認できます。

:::info
asbplayer拡張機能v1.22以前では、`{ method, id, params }`ではなく`{ command, messageId, body }`のスキーマをサポートします。
:::

## `mine-subtitle` {#mine-subtitle}

初期状態では、アクティブなタブからカードをマイニングします。特定のメディアを対象にするには、`mediaId`に[`get-bound-media`](#get-bound-media)が返すIDを設定します。メディアが見つからない場合、または字幕がない場合は、`published`が`false`になります。

`postMineAction`が`2`の場合、`noteId`で更新するAnkiノートを選択します。省略すると、最後に追加されたノートが更新されます。`noteId`はストリーミングメディアにのみ適用され、ローカルメディアでは無視されます。

> `mediaId`と`noteId`には拡張機能v1.20.0以降が必要です。

### リクエスト {#mine-subtitle-request}

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

### レスポンス {#mine-subtitle-response}

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

初期状態では、ファイルをアクティブなタブのメディアに読み込みます。タブに動画が複数ある場合は、動画セレクターが表示されます。ファイルを特定のメディアに直接読み込むには、`mediaId`に[`get-bound-media`](#get-bound-media)が返すIDを設定します。

> `mediaId`には拡張機能v1.23.0以降が必要です。それ以前のバージョンでは、動画が紐付いたすべてのタブにファイルが読み込まれます。

### リクエスト {#load-subtitles-request}

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

### レスポンス {#load-subtitles-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "result": {}
}
```

## `seek-timestamp` {#seek-timestamp}

初期状態では、アクティブなタブのメディア内をシークします。特定のメディアを対象にするには、`mediaId`に[`get-bound-media`](#get-bound-media)が返すIDを設定します。

> `mediaId`には拡張機能v1.20.0以降が必要です。ローカルメディアのシークには拡張機能v1.23.0以降が必要です。

### リクエスト {#seek-timestamp-request}

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

### レスポンス {#seek-timestamp-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "result": {}
}
```

## `get-bound-media` {#get-bound-media}

> 拡張機能v1.20.0以降が必要です。

`streaming`と`local`の両方を含む、asbplayerが現在追跡しているメディアを返します。

### リクエスト {#get-bound-media-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "method": "get-bound-media",
    "params": {}
}
```

### レスポンス {#get-bound-media-response}

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

> 拡張機能v1.20.0以降が必要です。

メディアに現在読み込まれている字幕を返します。初期状態ではアクティブなタブのメディアが対象です。特定のメディアを対象にするには、[`get-bound-media`](#get-bound-media)から取得した`mediaId`を渡します。
一致するメディアが見つからない場合、または字幕が読み込まれていない場合は、空のリストを返します。

### リクエスト {#get-subtitles-request}

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

### レスポンス {#get-subtitles-response}

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

サポートされるプロトコルなど、asbplayerクライアントの情報を返します。最新バージョンのasbplayerはJSON-RPCに対応しています。

### リクエスト {#client-info-request}

```javascript
{
    "jsonrpc": "2.0",
    // Request id used to correlate the probe response
    "id": "e3b0c442-98fc-4c14-9b2c-1c5a2e9d7b6f",
    "method": "client-info",
    "params": {}
}
```

### レスポンス {#client-info-response}

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

実行中のビルドのOpenRPCドキュメントを返します。メソッド名、パラメーター、結果、トランスポートタグをコードに固定せず、ここから現在の値を取得できます。

### リクエスト {#rpc-discover-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "5f2b9c4d-7e1a-4b8f-9d3c-6a0e2f7b1c84",
    "method": "rpc.discover",
    "params": {}
}
```

### レスポンス {#rpc-discover-response}

サポートされているJSON-RPCメソッドを説明するOpenRPCドキュメントを返します。ドキュメント全体は[`external-api/openrpc.json`](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json)を参照してください。

## エラーコード {#error-codes}

エラーには標準のJSON-RPCエラーオブジェクトを使います。

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

| コード     | 意味          | 備考                                                           |
| -------- | ---------------- | --------------------------------------------------------------- |
| `-32700` | 解析エラー      | フレームが有効なJSONではありません。                                    |
| `-32600` | 無効なリクエスト  | フレームが有効なJSON-RPCリクエストではありません。                      |
| `-32601` | メソッドが見つからない | 不明なメソッド、またはそのトランスポートで利用できないメソッドです。      |
| `-32602` | 無効なパラメーター   | メソッドのパラメーターがスキーマ検証に失敗しました。                   |
| `-32603` | 内部エラー   | ハンドラーが失敗したか、返された結果が検証に失敗しました。 |
| `-32000` | リクエストのタイムアウト  | サーバーが時間内にasbplayerから応答を受け取りませんでした。     |
| `-32001` | クライアントなし       | リクエストを転送できるasbplayerがサーバーに接続されていません。  |
| `-32002` | 未承認     | 外部拡張機能が承認前にコマンドを送信しました。     |

通知には、処理に失敗した場合も含め、応答は返されません。使用できない`id`を含むリクエストには、`id: null`のエラー応答が返されます。

GoサーバーのHTTPブリッジはこれらのエラーをHTTPステータスに対応付けます。[`external-api/README.md`](https://github.com/asbplayer/asbplayer/blob/main/external-api/README.md#error-codes)を参照してください。
