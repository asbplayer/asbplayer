---
sidebar_position: 9.5
---

import project from '@site/src/project';

# 外部扩展 {#external-extensions}

从 v1.23 开始，asbplayer 提供了与其他浏览器扩展通信的方式。任何通过 [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect) 连接到 asbplayer 并获得用户批准的扩展，都可以通过连接发送[命令](../reference/external-api.md)。

<a href={`${project.urls.externalExtensionTemplateRepo}`}>此处</a>提供了一个以这种方式与 asbplayer 集成的扩展示例模板。

## 连接并取得用户批准

希望与 asbplayer 通信的扩展必须先使用类似以下代码建立连接。可以在浏览器的扩展管理器中查看 asbplayer 的扩展 ID（Chrome 中为 `chrome://extensions`，Firefox 中为 `about:addons`）。

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>, {
    name: 'asbplayer-external-v1', // Must match this string exactly
});
```

使用 `initialize` 请求批准，该方法会立即返回当前状态。

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

如果扩展尚未获批，asbplayer 会将连接登记为待处理、提示用户，并返回：

```json
{
    "jsonrpc": "2.0",
    "id": "<the id from the initialize request>",
    "result": { "state": "pending" }
}
```

轮询 `approval-state`，查看用户是否已批准连接请求。

```json
{
    "jsonrpc": "2.0",
    "id": "<request id>",
    "method": "approval-state",
    "params": {}
}
```

获批后，`approval-state` 会返回 `{ "state": "approved" }`，连接即可发送命令。如果请求被拒绝，`approval-state` 会返回一次 `{ "state": "denied" }`，随后 asbplayer 会关闭端口。请求被拒绝后，该扩展在 24 小时内不能再次请求批准。

可以按[文档说明](../reference/external-api.md)发送命令。例如：

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'get-bound-media',
    params: {},
});
```

成功时，asbplayer 会返回 `{ jsonrpc, id, result }`；失败时则返回 `{ jsonrpc, id, error }`。
