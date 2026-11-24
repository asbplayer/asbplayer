---
sidebar_position: 8
---

import project, { ankiConnectUrl, webSocketUrl } from '@site/src/project';

# Minado con un clic {#one-click-mining}

asbplayer permite conectar subtítulos y vídeos con AnkiConnect, pero por sí solo no puede proporcionar automáticamente las definiciones de las palabras. Por eso, la mayoría de los flujos de minado de oraciones requieren dos o tres acciones con el ratón o el teclado.

Es posible minar con un clic si se combina asbplayer con otra aplicación que:

- proporcione la información que falta sobre la definición de las palabras; y
- ya se integre con AnkiConnect.

[Yomitan](https://yomitan.wiki/) es un ejemplo de este tipo de aplicación.

## Instalar y configurar Yomitan {#install-and-configure-yomitan}

Sigue las instrucciones del [sitio web de Yomitan](https://yomitan.wiki/) para instalarlo y configurarlo con un diccionario para el idioma que estás aprendiendo. Si aún no lo has hecho, también tendrás que añadir [AnkiConnect](https://ankiweb.net/shared/info/2055492159) a Anki.

En los ajustes de Anki de Yomitan:

- La dirección del servidor de AnkiConnect debe ser la predeterminada (<code>{ankiConnectUrl}</code>).
- Yomitan debe usar el mismo **tipo de nota** que asbplayer.

## Instalar el complemento de Anki de asbplayer {#install-the-asbplayer-anki-add-on}

El complemento requiere Anki 25.02 como mínimo. Aún no está disponible en AnkiWeb, así que hay que instalarlo desde un archivo:

1. Descarga el archivo `.ankiaddon` más reciente desde la <a href={`${project.urls.repo}/releases?q=${encodeURIComponent(project.releases.ankiAddon.releaseTitlePrefix)}`}>página de versiones</a>.
2. Abre el archivo y pulsa **Sí** en la ventana emergente.
3. Reinicia Anki.

## Conectar asbplayer con el complemento {#connect-asbplayer-to-the-add-on}

Activa el cliente de WebSocket en los <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>ajustes varios</a> de la extensión de asbplayer (casi al final). Mantén la URL predeterminada del servidor WebSocket (<code>{webSocketUrl}</code>), que coincide con la del complemento.

## Minar con **Yomitan** como siempre {#mine-with-yomitan-as-usual}

Al minar oraciones con Yomitan, las tarjetas ya incluirán la definición, la imagen y el audio de la palabra.

Para usar siempre el texto de los subtítulos de asbplayer en el campo Oración, activa [**Usar siempre el texto de los subtítulos en el campo de oración**](../reference/settings.md#always-use-subtitle-text-for-sentence-field) en los ajustes de **creación de tarjetas**. Esto reemplaza el texto de la oración proporcionado por Yomitan con el texto de los subtítulos usados de todas las pistas.

Si minas varias palabras del mismo subtítulo, **Actualizar última tarjeta** también puede actualizar tarjetas coincidentes anteriores. Activa [**actualizaciones de oración**](../reference/settings.md#update-sentence-for-cards-with-the-same-subtitle-text) para compartir la oración y las pistas de subtítulos configuradas, o [**actualizaciones de imagen y audio**](../reference/settings.md#update-all-cards-with-the-same-subtitle-text) para compartir la captura de pantalla y el clip de audio.

## Ajustes del complemento

Puedes cambiar los ajustes del complemento en Anki desde **Herramientas > Complementos**. Selecciona el complemento y pulsa **Configurar**. `postMineAction` es la acción que realiza asbplayer después de que Yomitan añada una tarjeta (valor predeterminado: <code>{project.services.webSocket.postMineAction}</code>). Para crear tarjetas con un clic, establécelo en `2` (actualizar la última tarjeta). Si cambias `port`, también tendrás que cambiar la URL del servidor WebSocket de asbplayer para que coincida.
