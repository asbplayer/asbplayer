---
sidebar_position: 9.5
---

import project from '@site/src/project';

# Внешние расширения {#external-extensions}

Начиная с версии v1.23, другие расширения браузера могут взаимодействовать с asbplayer. Любое расширение, подключившееся к asbplayer через [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect) и получившее одобрение пользователя, может отправлять через это соединение [команды](../reference/external-api.md).

<a href={`${project.urls.externalExtensionTemplateRepo}`}>Здесь</a> доступен шаблон расширения, интегрированного с asbplayer таким способом.

## Подключение и получение одобрения пользователя

Чтобы взаимодействовать с asbplayer, расширение должно сначала подключиться с помощью кода, приведённого ниже. Идентификатор расширения asbplayer можно найти в менеджере расширений браузера (в Chrome — `chrome://extensions`, в Firefox — `about:addons`).

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>, {
    name: 'asbplayer-external-v1', // Must match this string exactly
});
```

Запросите одобрение с помощью `initialize`. В ответ сразу придёт текущее состояние.

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

Если расширение не одобрено, asbplayer помечает соединение как ожидающее, показывает запрос пользователю и отправляет ответ:

```json
{
    "jsonrpc": "2.0",
    "id": "<the id from the initialize request>",
    "result": { "state": "pending" }
}
```

Периодически запрашивайте `approval-state`, чтобы узнать, одобрил ли пользователь подключение.

```json
{
    "jsonrpc": "2.0",
    "id": "<request id>",
    "method": "approval-state",
    "params": {}
}
```

После одобрения `approval-state` вернёт `{ "state": "approved" }`, и соединение сможет отправлять команды. При отказе `approval-state` один раз вернёт `{ "state": "denied" }`, после чего asbplayer закроет порт. После отказа расширение не сможет повторно запросить одобрение в течение 24 часов.

Команды можно отправлять, как описано в [документации](../reference/external-api.md). Например:

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'get-bound-media',
    params: {},
});
```

При успехе asbplayer отвечает `{ jsonrpc, id, result }`, при ошибке — `{ jsonrpc, id, error }`.
