---
sidebar_position: 9.5
---

import project from '@site/src/project';

# 外部拡張機能 {#external-extensions}

v1.23以降、asbplayerは他のブラウザー拡張機能と通信する方法を提供しています。[browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect)を使ってasbplayerに接続し、ユーザーの承認を得た拡張機能は、その接続を通じて[コマンド](../reference/external-api.md)を実行できます。

この方法でasbplayerと連携する拡張機能のテンプレート実装は<a href={`${project.urls.externalExtensionTemplateRepo}`}>こちら</a>で公開されています。

## 接続とユーザー承認の取得

asbplayerと通信したい拡張機能は、まず以下のようなコードで接続する必要があります。asbplayerの拡張機能IDは、ブラウザーの拡張機能マネージャー（Chromeでは`chrome://extensions`、Firefoxでは`about:addons`）で確認できます。

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>, {
    name: 'asbplayer-external-v1', // Must match this string exactly
});
```

`initialize`で承認を要求すると、現在の状態がすぐに返されます。

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

拡張機能がまだ承認されていない場合、asbplayerは接続を保留中として登録し、ユーザーに確認を求めて、次のように応答します。

```json
{
    "jsonrpc": "2.0",
    "id": "<the id from the initialize request>",
    "result": { "state": "pending" }
}
```

`approval-state`をポーリングして、ユーザーが接続要求を承認したか確認します。

```json
{
    "jsonrpc": "2.0",
    "id": "<request id>",
    "method": "approval-state",
    "params": {}
}
```

承認されると、`approval-state`は`{ "state": "approved" }`を返し、その接続を通じてコマンドを実行できるようになります。拒否された場合は、`approval-state`が一度だけ`{ "state": "denied" }`を返し、その後asbplayerはポートを閉じます。拒否後24時間は、要求元の拡張機能から再度承認を要求できません。

[ドキュメント](../reference/external-api.md)に記載されているコマンドを実行できます。例:

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'get-bound-media',
    params: {},
});
```

成功時は`{ jsonrpc, id, result }`、失敗時は`{ jsonrpc, id, error }`を返します。
