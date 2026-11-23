---
sidebar_position: 9
---

import project, { webSocketHttpUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# Servidor WebSocket {#websocket-server}

O asbplayer aproveita a comunicação bidirecional das conexões WebSocket para disponibilizar uma interface acessível de fora do navegador.

Nesse modelo, o asbplayer é um **cliente WebSocket** que mantém uma conexão com um **servidor WebSocket** executado localmente no computador do usuário. O servidor disponibiliza uma interface HTTP que aciona comandos no asbplayer, o cliente. A referência técnica do servidor incluído está [aqui](../reference/external-api.md).

O servidor foi criado originalmente para viabilizar um fluxo de mineração com um clique, enriquecendo as solicitações `addNote` do AnkiConnect com conteúdo de mídia fornecido pelo asbplayer. Por isso, uma de suas principais funções também é atuar como **proxy do AnkiConnect**.

:::note
A forma recomendada de minerar com um clique é usar o [complemento do Anki do asbplayer](./one-click-mining.md#install-the-asbplayer-anki-add-on). O proxy do AnkiConnect descrito abaixo é uma alternativa.
:::

## Executar o servidor {#run-the-server}

1. Clone o <a href={project.urls.repo}>repositório do asbplayer</a>.

    <CodeBlock language="bash">{`git clone ${project.urls.repo}.git asbplayer`}</CodeBlock>

2. Se ainda não estiver instalado, instale o [Golang](https://go.dev/dl/).
3. Execute o servidor:

    ```
    cd asbplayer/scripts/web-socket-server
    go run .
    ```

O proxy é bem leve, então pode ser deixado em execução em segundo plano. No Windows, você pode usar o [RBTray](https://github.com/benbuck/rbtray) para minimizá-lo na barra de tarefas.

## Conectar o asbplayer ao servidor {#connect-asbplayer-to-the-server}

Configure e ative o cliente WebSocket do asbplayer nas <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>configurações diversas</a>. Por padrão, o asbplayer já está apontado para o endereço IP e a porta padrão do servidor WebSocket; em geral, basta ativar o cliente WebSocket.

## Mineração com um clique pelo proxy do AnkiConnect {#one-click-mining-with-the-ankiconnect-proxy}

Siga as instruções no [site do Yomitan](https://yomitan.wiki/) para instalá-lo e configurá-lo com um dicionário para o idioma que está aprendendo.

Em seguida, configure o Yomitan:

- O URL do AnkiConnect deve apontar para o proxy do AnkiConnect, não para o AnkiConnect. O URL padrão do proxy é <code>{webSocketHttpUrl}</code>.
- O Yomitan deve usar o mesmo **tipo de nota** que o asbplayer.

Ao minerar frases com o Yomitan, os cartões já serão criados com a definição da palavra, a imagem e o áudio. Para ter um fluxo de mineração com um clique, defina `POST_MINE_ACTION` do proxy como `2` (atualizar último cartão). Consulte a [configuração do servidor](#server-configuration) para saber mais.

Para sempre usar o texto das legendas do asbplayer no campo Sentence, ative [**Sempre usar o texto das legendas no campo da frase**](../reference/settings.md#always-use-subtitle-text-for-sentence-field) nas configurações de **Mineração**. Isso substitui o texto da frase fornecido pelo Yomitan pelo texto minerado das legendas em todas as faixas.

## Referência da API {#api-reference}

Consulte a [referência técnica](../reference/external-api.md#commands) para ver uma descrição dos comandos compatíveis que podem ser enviados ao asbplayer pela conexão WebSocket.

## API baseada em HTTP {#http-based-api}

O servidor WebSocket implementa uma API baseada em HTTP que aciona os comandos documentados acima.

- `POST asbplayer/load-subtitles` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/load-subtitles`}>script</a>)
- `POST asbplayer/seek` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/seek`}>script</a>)
- `GET asbplayer/bound-media` (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/bound-media`}>script</a>)
- `GET asbplayer/subtitles` (optional `?mediaId=...&trackNumbers=0,1`) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/subtitles`}>script</a>)

## Proxy do AnkiConnect {#ankiconnect-proxy}

O servidor WebSocket também funciona como proxy do AnkiConnect, permitindo enriquecer solicitações `addNote` com conteúdo fornecido pelo asbplayer, como áudio e capturas de tela.

O proxy encaminha todas as solicitações do AnkiConnect sem alterações, exceto `addNote`. O comportamento específico do proxy para `addNote` depende do valor de `POST_MINE_ACTION` na configuração descrita abaixo.

## Configuração do servidor {#server-configuration}

O servidor é configurado por um arquivo `.env` colocado no mesmo diretório. Abaixo está um exemplo de arquivo com explicações.

```
# Port that the proxy will listen on
PORT=8766

# AnkiConnect URL
ANKI_CONNECT_URL=http://127.0.0.1:8765

# Action for asbplayer to take when the proxy receives an addNote request
# 0 = 'None'
# 1 = 'Open Anki dialog'
# 2 = 'Update last card' (updates last card with asbplayer media AFTER passing through original addNote request)
# 3 = 'Export card'
POST_MINE_ACTION=2
```
