---
sidebar_position: 9
---

import project, { webSocketHttpUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# Servidor WebSocket {#websocket-server}

asbplayer aprovecha la comunicación bidireccional de las conexiones WebSocket para ofrecer una interfaz accesible desde fuera del navegador.

En este diseño, asbplayer es un **cliente WebSocket** que mantiene una conexión con un **servidor WebSocket** que se ejecuta localmente en el ordenador del usuario. El servidor ofrece una interfaz HTTP que activa comandos en asbplayer, el cliente. Puedes consultar la referencia técnica del servidor incluido [aquí](../reference/external-api.md).

El servidor se creó originalmente para permitir un flujo de minado con un clic que enriquece las solicitudes `addNote` de AnkiConnect con contenido multimedia proporcionado por asbplayer. Por eso, una de sus funciones principales también es actuar como **proxy de AnkiConnect**.

:::note
La forma recomendada de minar con un clic es usar el [complemento de Anki de asbplayer](./one-click-mining.md#install-the-asbplayer-anki-add-on). El proxy de AnkiConnect que se describe a continuación es una alternativa.
:::

## Ejecutar el servidor {#run-the-server}

1. Clona el <a href={project.urls.repo}>repositorio de asbplayer</a>.

    <CodeBlock language="bash">{`git clone ${project.urls.repo}.git asbplayer`}</CodeBlock>

2. Si aún no está instalado, instala [Golang](https://go.dev/dl/).
3. Ejecuta el servidor:

    ```
    cd asbplayer/scripts/web-socket-server
    go run .
    ```

El proxy consume muy pocos recursos, así que puedes dejarlo ejecutándose en segundo plano. En Windows, puedes usar [RBTray](https://github.com/benbuck/rbtray) para minimizarlo en la bandeja del sistema.

## Conectar asbplayer al servidor {#connect-asbplayer-to-the-server}

Configura y activa el cliente WebSocket de asbplayer desde los <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>ajustes varios</a>. De forma predeterminada, asbplayer ya está configurado con la dirección IP y el puerto predeterminados del servidor WebSocket, así que normalmente solo hace falta activar el cliente WebSocket.

## Minar con un clic mediante el proxy de AnkiConnect {#one-click-mining-with-the-ankiconnect-proxy}

Sigue las instrucciones del [sitio web de Yomitan](https://yomitan.wiki/) para instalarlo y configurarlo con un diccionario para el idioma que estás aprendiendo.

Después, configura Yomitan:

- La URL de AnkiConnect debe apuntar al proxy de AnkiConnect, no directamente a AnkiConnect. La URL predeterminada del proxy es <code>{webSocketHttpUrl}</code>.
- Yomitan debe usar el mismo **tipo de nota** que asbplayer.

Al minar oraciones con Yomitan, las tarjetas ya incluirán la definición de la palabra, la imagen y el audio. Para minar de verdad con un clic, configura `POST_MINE_ACTION` del proxy en `2` (actualizar la última tarjeta). Consulta la [configuración del servidor](#server-configuration) para obtener más información.

Para usar siempre el texto de los subtítulos de asbplayer en el campo Oración, activa [**Usar siempre el texto de los subtítulos en el campo de oración**](../reference/settings.md#always-use-subtitle-text-for-sentence-field) en los ajustes de **minado**. Esto reemplaza el texto de la oración proporcionado por Yomitan con el texto minado de todas las pistas.

## Referencia de la API {#api-reference}

Consulta la [referencia técnica](../reference/external-api.md#commands) para ver una descripción de los comandos admitidos que se pueden enviar a asbplayer mediante la conexión WebSocket.

## API basada en HTTP {#http-based-api}

El servidor WebSocket implementa una API basada en HTTP que activa los comandos descritos anteriormente.

- `POST asbplayer/load-subtitles` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/load-subtitles`}>script</a>)
- `POST asbplayer/seek` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/seek`}>script</a>)
- `GET asbplayer/bound-media` (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/bound-media`}>script</a>)
- `GET asbplayer/subtitles` (optional `?mediaId=...&trackNumbers=0,1`) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/subtitles`}>script</a>)

## Proxy de AnkiConnect {#ankiconnect-proxy}

El servidor WebSocket también funciona como proxy de AnkiConnect. Permite enriquecer las solicitudes `addNote` con contexto proporcionado por asbplayer, como audio y capturas de pantalla.

El proxy transmite sin cambios todas las solicitudes de AnkiConnect, excepto `addNote`. El comportamiento específico del proxy para `addNote` depende del valor de `POST_MINE_ACTION` en la configuración que se describe a continuación.

## Configuración del servidor {#server-configuration}

El servidor se configura con un archivo `.env` en el mismo directorio. A continuación se muestra un archivo de ejemplo con una explicación.

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
