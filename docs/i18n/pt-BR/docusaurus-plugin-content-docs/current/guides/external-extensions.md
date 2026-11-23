---
sidebar_position: 9.5
---

import project from '@site/src/project';

# Extensões externas {#external-extensions}

Desde a v1.23, o asbplayer permite que outras extensões de navegador se comuniquem com ele. Qualquer extensão que se conecte ao asbplayer por meio de [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect) e receba aprovação do usuário poderá enviar [comandos](../reference/external-api.md) pela conexão.

<a href={`${project.urls.externalExtensionTemplateRepo}`}>Aqui</a> está disponível uma implementação de modelo de extensão que se integra dessa forma ao asbplayer.

## Conectar e obter aprovação do usuário

Qualquer extensão que queira se comunicar com o asbplayer deve primeiro se conectar usando um código como o abaixo. O ID da extensão do asbplayer pode ser encontrado no gerenciador de extensões do navegador (no Chrome, `chrome://extensions`; no Firefox, `about:addons`).

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>, {
    name: 'asbplayer-external-v1', // Must match this string exactly
});
```

Solicite aprovação com `initialize`, que responde imediatamente com o estado atual.

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

Se a extensão não tiver sido aprovada, o asbplayer registra a conexão como pendente, solicita a aprovação do usuário e responde:

```json
{
    "jsonrpc": "2.0",
    "id": "<the id from the initialize request>",
    "result": { "state": "pending" }
}
```

Consulte `approval-state` para verificar se o usuário aprovou a solicitação de conexão.

```json
{
    "jsonrpc": "2.0",
    "id": "<request id>",
    "method": "approval-state",
    "params": {}
}
```

Depois da aprovação, `approval-state` retorna `{ "state": "approved" }` e a conexão pode enviar comandos. Se a solicitação for negada, `approval-state` retorna `{ "state": "denied" }` uma vez, e então o asbplayer fecha a porta. Após uma negativa, a extensão solicitante não pode pedir aprovação novamente por 24 horas.

Os comandos podem ser enviados conforme [documentado](../reference/external-api.md). Por exemplo:

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'get-bound-media',
    params: {},
});
```

Em caso de sucesso, o asbplayer responde com `{ jsonrpc, id, result }`; em caso de falha, responde com `{ jsonrpc, id, error }`.
