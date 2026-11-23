---
sidebar_position: 7.5
---

import project from '@site/src/project';

# Android {#android}

Aunque la experiencia de uso es menos fluida, es posible usar asbplayer en dispositivos Android.

## Sitio web {#website}

El sitio web se puede usar tal cual. En lugar de los controles de vídeo predeterminados, optimizados para ordenadores, se mostrará la **interfaz superpuesta**.

### Añadir a la pantalla de inicio {#add-to-home-screen}

Como aplicación web progresiva, puedes añadir el sitio web a la pantalla de inicio de tu dispositivo Android. En el menú del navegador, pulsa «Añadir a la pantalla de inicio».

## Extension {#extension}

:::warning
**Faltan muchas funciones**: el **panel lateral**, las **capturas de pantalla** y la **interfaz de WebSocket**. Consulta la sección de [compatibilidad](../compatibility.md#browsers-and-features) para ver una tabla de las funciones admitidas y no admitidas en cada navegador.
:::

Al igual que en el sitio web, la principal forma de interactuar con la extensión de asbplayer es mediante la **interfaz superpuesta**. Como no hay panel lateral, **los subtítulos se cargan seleccionando el botón de asbplayer en el menú de extensiones del navegador**. No es necesario usar un teclado (Bluetooth), pero puede ser muy útil si prefieres usar los [atajos de teclado](../reference/settings.md#keyboard-shortcuts) con la extensión.

A continuación se indican los navegadores para Android en los que se puede instalar asbplayer.

### Firefox for Android {#firefox-for-android}

Instala asbplayer desde la <a href={project.extension.firefoxAndroid.storeUrl}>página de AMO</a>. Firefox para Android tiene las mismas limitaciones que Firefox: no es posible grabar audio de transmisiones protegidas con DRM.

### Edge Canary {#edge-canary}

Edge Canary es otro navegador móvil basado en Chromium que puede ejecutar extensiones. En el momento de escribir esto, asbplayer en Edge Canary no admite la grabación de audio.
Para instalar asbplayer en Edge Canary:

1. Descarga el archivo `crx` de asbplayer desde la <a href={`${project.urls.repo}/releases/latest`}>página de versiones</a>.
2. Si aún no está activado, habilita el modo de desarrollador en los ajustes de Edge Canary: ve a «Acerca de Microsoft Edge» y pulsa varias veces la cadena de la versión de compilación.
3. En **Opciones de desarrollador**, pulsa **Instalar extensión mediante crx** y selecciona el archivo `crx` que acabas de descargar.

### Kiwi Browser (discontinued) {#kiwi-browser-discontinued}

Kiwi Browser es un navegador móvil basado en Chromium que puede ejecutar extensiones. Sin embargo, su desarrollo se ha discontinuado y solo se puede instalar desde la [página de GitHub](https://github.com/kiwibrowser/src.next/releases). Una vez instalado Kiwi Browser, puedes instalar asbplayer desde la <a href={project.extension.chrome.storeUrl}>tienda web</a> de Chrome.

## Anki integration {#anki-integration}

Para integrar Anki, instala [AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid).
