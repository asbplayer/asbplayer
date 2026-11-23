---
sidebar_position: 2
description: Referência técnica da interface externa do asbplayer e do servidor WebSocket que a implementa.
---

import project, { ankiConnectUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# API externa {#external-api}

Esta página é uma referência técnica da interface externa do asbplayer. Veja abaixo algumas formas de chamar a interface:

- O <a href={`${project.urls.repo}/tree/main/scripts/web-socket-server`}>servidor WebSocket incluído</a>. Consulte o [guia](../guides/web-socket-server.md) para saber como configurar o servidor WebSocket.
- (v1.23 ou posterior) Usando uma conexão entre extensões obtida por meio de [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect). Consulte o [guia](../guides/external-extensions.md) para saber como conectar outra extensão ao asbplayer.

## Comandos {#commands}

O asbplayer responde aos comandos a seguir, representados como mensagens JSON-RPC. O esquema OpenRPC está disponível [aqui](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json).

:::info
As extensões do asbplayer na v1.22 e anteriores aceitam o esquema `{ command, messageId, body }` em vez de `{ method, id, params }`.
:::

## `mine-subtitle` {#mine-subtitle}

Por padrão, minera o conteúdo da aba ativa. Defina `mediaId` como um ID retornado por [`get-bound-media`](#get-bound-media) para selecionar uma mídia específica. Se a mídia não for encontrada ou não tiver legendas, `published` será `false`.

Quando `postMineAction` é `2`, `noteId` seleciona a nota do Anki a ser atualizada. Se omitido, a última nota adicionada será atualizada. `noteId` se aplica somente a mídias em streaming e é ignorado para mídias locais.

> `mediaId` e `noteId` requerem a extensão v1.20.0 ou posterior.

### Solicitação {#mine-subtitle-request}

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

### Resposta {#mine-subtitle-response}

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

Por padrão, carrega os arquivos na mídia da aba ativa. Se a aba tiver mais de um vídeo, mostra o seletor de vídeo. Defina `mediaId` como um ID retornado por [`get-bound-media`](#get-bound-media) para carregar os arquivos diretamente nessa mídia.

> `mediaId` requer a extensão v1.23.0 ou posterior. As versões anteriores carregam os arquivos em todas as abas com um vídeo associado.

### Solicitação {#load-subtitles-request}

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

### Resposta {#load-subtitles-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "result": {}
}
```

## `seek-timestamp` {#seek-timestamp}

Por padrão, busca na mídia da aba ativa. Defina `mediaId` como um ID retornado por [`get-bound-media`](#get-bound-media) para selecionar uma mídia específica.

> `mediaId` requer a extensão v1.20.0 ou posterior. Para buscar em mídias locais, é necessária a extensão v1.23.0 ou posterior.

### Solicitação {#seek-timestamp-request}

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

### Resposta {#seek-timestamp-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "result": {}
}
```

## `get-bound-media` {#get-bound-media}

> Requer a extensão v1.20.0 ou posterior.

Retorna a mídia que o asbplayer está acompanhando no momento, incluindo mídias `streaming` e `local`.

### Solicitação {#get-bound-media-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "method": "get-bound-media",
    "params": {}
}
```

### Resposta {#get-bound-media-response}

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

> Requer a extensão v1.20.0 ou posterior.

Retorna as legendas carregadas no momento para uma mídia. Por padrão, seleciona a mídia da aba ativa; passe um `mediaId` de [`get-bound-media`](#get-bound-media) para selecionar uma mídia específica.
Retorna uma lista vazia se nenhuma mídia correspondente for encontrada ou se nenhuma legenda estiver carregada.

### Solicitação {#get-subtitles-request}

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

### Resposta {#get-subtitles-response}

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

Retorna informações do cliente asbplayer, como os protocolos compatíveis. As versões mais recentes do asbplayer aceitam JSON-RPC.

### Solicitação {#client-info-request}

```javascript
{
    "jsonrpc": "2.0",
    // Request id used to correlate the probe response
    "id": "e3b0c442-98fc-4c14-9b2c-1c5a2e9d7b6f",
    "method": "client-info",
    "params": {}
}
```

### Resposta {#client-info-response}

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

Retorna o documento OpenRPC da compilação em execução. Use-o para descobrir os nomes atuais dos métodos, parâmetros, resultados e rótulos de transporte em vez de codificá-los diretamente.

### Solicitação {#rpc-discover-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "5f2b9c4d-7e1a-4b8f-9d3c-6a0e2f7b1c84",
    "method": "rpc.discover",
    "params": {}
}
```

### Resposta {#rpc-discover-response}

Retorna o documento OpenRPC com a descrição dos métodos JSON-RPC compatíveis. Consulte [`external-api/openrpc.json`](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json) para ver o documento completo.

## Códigos de erro {#error-codes}

Os erros usam o objeto de erro JSON-RPC padrão:

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

| Código   | Significado      | Observações                                                     |
| -------- | ---------------- | --------------------------------------------------------------- |
| `-32700` | Erro de análise  | O quadro não é um JSON válido.                                  |
| `-32600` | Solicitação inválida | O quadro não é uma solicitação JSON-RPC válida.             |
| `-32601` | Método não encontrado | Método desconhecido ou indisponível nesse transporte.       |
| `-32602` | Parâmetros inválidos | Os parâmetros do método não passaram na validação do esquema. |
| `-32603` | Erro interno     | O manipulador falhou ou retornou um resultado que não passou na validação. |
| `-32000` | Tempo limite da solicitação | Um servidor não recebeu uma resposta do asbplayer a tempo. |
| `-32001` | Nenhum cliente   | Nenhum asbplayer está conectado ao servidor para encaminhar a solicitação. |
| `-32002` | Não aprovado     | Uma extensão externa enviou um comando antes de ser aprovada. |

Notificações nunca recebem resposta, inclusive quando o processamento falha. Uma solicitação com um `id` inutilizável recebe uma resposta de erro com `id: null`.

A ponte HTTP do servidor Go converte esses erros em códigos de status HTTP; consulte [`external-api/README.md`](https://github.com/asbplayer/asbplayer/blob/main/external-api/README.md#error-codes).
