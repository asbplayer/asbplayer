---
sidebar_position: 9.5
---

import project from '@site/src/project';

# 외부 확장 프로그램 {#external-extensions}

v1.23부터 다른 브라우저 확장 프로그램이 asbplayer와 통신할 수 있습니다. [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect)를 통해 asbplayer에 연결하고 사용자의 승인을 받은 확장 프로그램은 연결을 통해 [명령](../reference/external-api.md)을 보낼 수 있습니다.

이 방식으로 asbplayer와 연동하는 확장 프로그램의 템플릿 구현은 <a href={`${project.urls.externalExtensionTemplateRepo}`}>여기</a>에서 확인할 수 있습니다.

## 연결 및 사용자 승인 받기

asbplayer와 통신하려는 확장 프로그램은 먼저 아래와 같은 코드로 연결해야 합니다. asbplayer의 확장 프로그램 ID는 브라우저의 확장 프로그램 관리자에서 확인할 수 있습니다(Chrome에서는 `chrome://extensions`, Firefox에서는 `about:addons`).

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>, {
    name: 'asbplayer-external-v1', // Must match this string exactly
});
```

현재 상태를 즉시 반환하는 `initialize`로 승인을 요청합니다.

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

확장 프로그램이 아직 승인되지 않았다면 asbplayer는 연결을 대기 상태로 등록하고 사용자에게 확인을 요청한 다음 다음과 같이 응답합니다.

```json
{
    "jsonrpc": "2.0",
    "id": "<the id from the initialize request>",
    "result": { "state": "pending" }
}
```

`approval-state`를 확인해 사용자가 연결 요청을 승인했는지 확인합니다.

```json
{
    "jsonrpc": "2.0",
    "id": "<request id>",
    "method": "approval-state",
    "params": {}
}
```

승인되면 `approval-state`가 `{ "state": "approved" }`를 반환하고 연결을 통해 명령을 보낼 수 있습니다. 거부되면 `approval-state`가 `{ "state": "denied" }`를 한 번 반환한 뒤 asbplayer가 포트를 닫습니다. 거부된 확장 프로그램은 24시간 동안 다시 승인을 요청할 수 없습니다.

명령은 [문서에 설명된 방식](../reference/external-api.md)으로 보낼 수 있습니다. 예를 들면 다음과 같습니다.

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'get-bound-media',
    params: {},
});
```

성공하면 asbplayer는 `{ jsonrpc, id, result }`로 응답하고, 실패하면 `{ jsonrpc, id, error }`로 응답합니다.
