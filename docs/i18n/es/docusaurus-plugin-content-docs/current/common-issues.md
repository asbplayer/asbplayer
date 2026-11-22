---
sidebar_position: 5
---

import project from '@site/src/project';

# Problemas frecuentes {#common-issues}

## General {#general}

### No aparecen los subtítulos {#subtitles-arent-showing-up}

Hay varias formas de ocultar los subtítulos en asbplayer:

- El atajo de teclado [`Mostrar u ocultar subtítulos`](./reference/settings.md#subtitles-keyboard-shortcuts).
- Los atajos de teclado [`Mostrar u ocultar la pista de subtítulos X del vídeo`](./reference/settings.md#subtitles-keyboard-shortcuts).
- La opción [`Mostrar subtítulos`](./reference/settings.md#show-subtitles) en `Reproducción > Modos de reproducción`.

### asbplayer no puede conectarse a Anki y muestra un error como «Failed to fetch» {#anki-connection-failed}

Esto puede deberse a los bloqueadores de anuncios:

- Si usas Brave, asegúrate de que Shield no esté bloqueando asbplayer.
- Comprueba que el navegador o el bloqueador de anuncios no esté bloqueando la solicitud. Puedes empezar abriendo la consola de desarrollador del navegador y buscando errores.

Una configuración incorrecta:

- Si usas el sitio web, comprueba que AnkiConnect permita el acceso de asbplayer, como se explica [aquí](./getting-started/mining-subtitles.md).

O errores:

- En el momento de escribir esto, se sabe que activar las funciones experimentales de la plataforma web causa este problema. Prueba a desactivar esta marca en `chrome://flags`.
- En versiones recientes de macOS, AnkiConnect no responde cuando Anki está en segundo plano ([Notas para usuarios de macOS](https://git.sr.ht/~foosoft/anki-connect#notes-for-macos-users)).

### La tarjeta no se actualiza en Anki al usar «Actualizar la última tarjeta» {#card-not-updating}

Asegúrate de que el explorador de tarjetas de Anki esté cerrado cuando uses «Actualizar la última tarjeta». Hay un [problema conocido](https://github.com/FooSoft/anki-connect/issues/82) de AnkiConnect que impide que las tarjetas parezcan actualizarse mientras el explorador está abierto.

### Al cargar un archivo local, asbplayer muestra una pantalla negra o no reproduce el audio {#local-video-playback-issues}

La capacidad de los navegadores para decodificar ciertos formatos de vídeo y audio varía. Consulta la [sección de compatibilidad](./compatibility.md#browsers-and-media-formats).

### Mi extensión emergente de diccionario (por ejemplo, Yomitan) no funciona en el panel lateral {#popup-dictionary-in-side-panel}

Por motivos de seguridad, los navegadores no permiten inyectar scripts de extensiones en páginas de otras extensiones, así que no hay forma de solucionarlo. Si quieres analizar texto con otras extensiones, tendrás que hacerlo desde los subtítulos que aparecen en el elemento de vídeo o desde la lista de subtítulos del sitio web de asbplayer.

### asbplayer no detecta el vídeo en streaming {#asbplayer-isnt-detecting-streaming-video}

Comprueba en los detalles de la extensión que tenga acceso a todos los sitios.

### Los atajos de teclado no funcionan {#keyboard-shortcuts-arent-working}

Comprueba los <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>ajustes de los atajos de teclado</a> o consulta la [referencia de atajos de teclado](./reference/settings.md#keyboard-shortcuts).

Si usas la extensión, también puedes probar lo siguiente:

- En Chrome, comprueba `chrome://extensions/shortcuts`; en Firefox, ve a `about:addons` → icono de engranaje → `Administrar atajos de extensiones`.
- Actualiza la página e intenta cargar los subtítulos de nuevo.
- Desinstala y vuelve a instalar la extensión, y reinicia el navegador.
- Asegúrate de no haber instalado la extensión dos veces.

### asbplayer no recorta correctamente las capturas de pantalla de vídeos en streaming {#screenshot-cropping-issues}

Comprueba que el zoom del navegador esté al 100 %. Puedes desactivar el recorte en los <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>ajustes de la extensión</a>.

### Tengo problemas para crear tarjetas con la nota de minado japonés {#jp-mining-note-issues}

Consulta esta [incidencia](https://github.com/asbplayer/asbplayer/issues/220#issuecomment-1501124166).

### asbplayer sigue pidiendo permiso para grabar audio {#repeated-audio-permission-prompts}

asbplayer no es compatible actualmente con la extensión Volume Master, así que tendrás que desactivarla.

### Las grabaciones de audio se oyen distorsionadas, con ruido o entrecortadas {#garbled-audio-recordings}

Esto suele deberse a que la CPU no tiene suficiente capacidad. Si usas un portátil, asegúrate de que esté conectado a la corriente. En general, comprueba que el modo de ahorro de batería u otra opción no esté limitando la CPU.

### Al usar un atajo de teclado para abrir asbplayer con un vídeo en streaming, no ocurre nada y la página deja de responder {#streaming-shortcut-unresponsive}

Esto puede ocurrir si `Experimental Web Platform features` está activado en `chrome://flags`. Comprueba que esté desactivado e inténtalo de nuevo.

## Anotaciones {#annotation}

### Activar o desactivar las anotaciones de una pista {#enable-or-disable-annotation-for-a-track}

Las anotaciones se consideran desactivadas si los siguientes ajustes tienen estos valores:

- En [`Ajustes > Anotaciones`](./reference/settings.md#annotation):
  - [`Colorear subtítulos según las palabras conocidas`](./reference/settings.md#colorize-subtitles-based-on-known-words): **Desactivado**
  - [`Generar estadísticas automáticamente`](./reference/settings.md#generate-statistics-automatically): **Desactivado**
  - [`Mostrar lecturas de palabras`](./reference/settings.md#display-word-readings): _Nada seleccionado_ (valor vacío)
  - [`Mostrar frecuencia de palabras`](./reference/settings.md#display-word-frequency): _Nada seleccionado_ (valor vacío)
  - [`Mostrar acento tonal (japonés)`](./reference/settings.md#display-pitch-accent-japanese): _Nada seleccionado_ (valor vacío)
  - [`Mostrar definiciones de palabras`](./reference/settings.md#display-word-definitions): _Nada seleccionado_ (valor vacío)
- En [`Ajustes > Reproducción > Anotaciones`](./reference/settings.md#playback-annotation):
  - [`Seleccionar la primera palabra coincidente al pausar`](./reference/settings.md#select-first-matching-word-on-pause): Nunca
  - [`Pausar automáticamente los subtítulos que contengan estas palabras`](./reference/settings.md#auto-pause-subtitles-containing-these-words): Sin filtro de palabras
  - [`Reproducir en modo condensado los subtítulos que contengan estas palabras`](./reference/settings.md#play-subtitles-containing-these-words-in-condensed-mode): Sin filtro de palabras
  - [`Reproducir a velocidad normal en modo de avance rápido los subtítulos que contengan estas palabras`](./reference/settings.md#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode): Sin filtro de palabras
  - [`Repetir los subtítulos que contengan estas palabras`](./reference/settings.md#repeat-subtitles-containing-these-words): Sin filtro de palabras
  - [`Mostrar estas palabras durante la reproducción`](./reference/settings.md#show-these-words-during-playback): Sin filtro de palabras
  - [`Ajustar la velocidad de avance rápido según la comprensión`](./reference/settings.md#adjust-fast-forward-rate-by-comprehension): **Desactivado**

Para activar las anotaciones de una pista, cambia al menos uno de los ajustes anteriores a un valor distinto del valor desactivado. Algunas anotaciones solo aparecen al pasar el cursor si así se [configuraron](./reference/settings.md#only-display-word-color-on-hover).

:::tip
Los botones [`Reconstruir la base de datos de palabras de Anki`](./reference/settings.md#re-build-anki-word-database) y [`Reconstruir la base de datos de palabras de WaniKani`](./reference/settings.md#re-build-wanikani-word-database) estarán desactivados a menos que los ajustes anteriores tengan valores que aprovechen su integración.
:::

### Vaciar la base de datos de palabras de Anki {#clear-anki-word-database}

Para vaciar las entradas de una pista en la base de datos de palabras de Anki, deja vacíos [`Campos de palabras de Anki`](./reference/settings.md#anki-word-fields) y [`Campos de oraciones de Anki`](./reference/settings.md#anki-sentence-fields) y usa el botón [`Reconstruir la base de datos de palabras de Anki`](./reference/settings.md#re-build-anki-word-database). Si el botón está desactivado, [sigue estos pasos](#enable-or-disable-annotation-for-a-track) para activar primero las anotaciones de la pista.

### Vaciar la base de datos de palabras de WaniKani {#clear-wanikani-word-database}

Para vaciar las entradas de una pista en la base de datos de palabras de WaniKani, deja vacío el [token de API de WaniKani](./reference/settings.md#wanikani-api-token) y usa el botón [`Reconstruir la base de datos de palabras de WaniKani`](./reference/settings.md#re-build-wanikani-word-database). Si el botón está desactivado, [sigue estos pasos](#enable-or-disable-annotation-for-a-track) para activar primero las anotaciones de la pista.

### Eliminar palabras guardadas localmente {#delete-locally-tracked-words}

Puedes eliminar una palabra guardada localmente al pasar el cursor sobre ella y usar los [atajos de teclado para anotaciones](./reference/settings.md#annotation-keyboard-shortcuts) para cambiar su estado a **Sin recopilar** y desactivar **Ignorada**, si estaba activada.

Para eliminar en bloque las palabras guardadas localmente, usa el [`Explorador de palabras`](./reference/settings.md#word-browser) para marcar las palabras como **Sin recopilar** y quitar sus estados. También puedes usar la función [`Importar palabras`](./reference/settings.md#import-words).

### Todo aparece como «Sin recopilar» {#everything-is-uncollected}

Si activaste las anotaciones por accidente, [sigue estos pasos](#enable-or-disable-annotation-for-a-track) para desactivarlas.

Si el estado de las palabras nunca cambia de **Sin recopilar**:

- Si usas estados locales, importa palabras a la base de datos local o pasa el cursor sobre ellas y usa los [atajos de teclado para anotaciones](./reference/settings.md#annotation-keyboard-shortcuts) para establecer sus estados.
- Si usas Anki para determinar el estado, asegúrate de que Anki esté en ejecución y que la **URL de AnkiConnect** sea correcta.
    - Configura [`Campos de palabras de Anki`](./reference/settings.md#anki-word-fields) (recomendado) o [`Campos de oraciones de Anki`](./reference/settings.md#anki-sentence-fields), o ambos.
    - Ejecuta [`Reconstruir la base de datos de palabras de Anki`](./reference/settings.md#re-build-anki-word-database).
    - No hace falta mantener Anki en ejecución después de crear la base de datos, pero si lo dejas abierto durante la reproducción, asbplayer se mantendrá sincronizado.
- Si usas WaniKani para determinar el estado, asegúrate de que el [`token de API de WaniKani`](./reference/settings.md#wanikani-api-token) sea correcto.
    - Ejecuta [`Reconstruir la base de datos de palabras de WaniKani`](./reference/settings.md#re-build-wanikani-word-database).
    - asbplayer se sincroniza automáticamente con WaniKani durante la reproducción.

### Aparece un tachado rojo {#red-strikethrough-styling-appears}

Si activaste las anotaciones por accidente, [sigue estos pasos](#enable-or-disable-annotation-for-a-track) para desactivarlas.

Esto indica que se produjo un error al procesar los subtítulos, probablemente por un problema al conectar con Yomitan. Revisa si hay mensajes de error en la consola del navegador y pide ayuda en el Discord de asbplayer si no puedes resolverlo.
