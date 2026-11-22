---
sidebar_position: 9.5
---

import project from '@site/src/project';

# Extensiones externas {#external-extensions}

Desde la versión 1.23, asbplayer permite que otras extensiones del navegador se comuniquen con él. Cualquier extensión que se conecte a asbplayer mediante [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect) y reciba la aprobación del usuario puede enviar [comandos](../reference/external-api.md) a través de la conexión.

<a href={`${project.urls.externalExtensionTemplateRepo}`}>Aquí</a> encontrarás una implementación de plantilla de una extensión que se integra con asbplayer de esta manera.

## Conectarse y obtener la aprobación del usuario

Toda extensión que quiera comunicarse con asbplayer debe conectarse primero con un código como el siguiente. Puedes obtener el ID de la extensión de asbplayer desde el administrador de extensiones del navegador (en Chrome, `chrome://extensions`; en Firefox, `about:addons`).

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>, {
    name: 'asbplayer-external-v1', // Must match this string exactly
});
```

Solicita la aprobación con `initialize`, que responde de inmediato con el estado actual.

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

Si la extensión no está aprobada, asbplayer registra la conexión como pendiente, avisa al usuario y responde:

```json
{
    "jsonrpc": "2.0",
    "id": "<the id from the initialize request>",
    "result": { "state": "pending" }
}
```

Consulta `approval-state` para saber si el usuario ha aprobado la solicitud de conexión.

```json
{
    "jsonrpc": "2.0",
    "id": "<request id>",
    "method": "approval-state",
    "params": {}
}
```

Una vez aprobada, `approval-state` devuelve `{ "state": "approved" }` y la conexión puede enviar comandos. Si se deniega, `approval-state` devuelve `{ "state": "denied" }` una vez y asbplayer cierra el puerto. Después de denegarla, la extensión solicitante no puede volver a pedir aprobación durante 24 horas.

Los comandos se pueden enviar tal como se [documenta aquí](../reference/external-api.md). Por ejemplo:

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'get-bound-media',
    params: {},
});
```

asbplayer responde con `{ jsonrpc, id, result }` si la operación se realiza correctamente o con `{ jsonrpc, id, error }` si falla.
