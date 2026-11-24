---
sidebar_position: 1
---

import project from '@site/src/project';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Ajustes {#settings}

## <a href={new URL('?view=settings#anki-settings', project.urls.app).href}>Anki</a> {#anki}

### URL de AnkiConnect {#ankiconnect-url}

URL del servidor de AnkiConnect que se ejecuta como complemento dentro de Anki.

### Clave de API de AnkiConnect {#ankiconnect-api-key}

Clave de API configurada en AnkiConnect cuando la protección con clave de API está activada.

### Actualizar el explorador de tarjetas de Anki tras actualizar tarjetas {#refresh-anki-card-browser}

Cuando está activado, actualiza el explorador de tarjetas de Anki abierto después de que asbplayer actualice una tarjeta, para que sus campos muestren los valores actuales. Esto puede traer la ventana del explorador al primer plano. Este ajuste está desactivado de forma predeterminada.

### Mazo {#deck}

Mazo de Anki al que se envían las tarjetas.

### Tipo de nota {#note-type}

Tipo de nota de Anki que se usará para las tarjetas. Un tipo de nota define el «modelo» y la «vista» de las tarjetas; más concretamente, un conjunto de campos y una plantilla HTML que determina cómo se muestran en el anverso y el reverso.

### Campos de la tarjeta {#card-fields}

Cada ajuste de campo de tarjeta determina qué contenido se asigna a cada campo del tipo de nota configurado. La **etiqueta del campo** (Oración, Definición, Palabra, Imagen, Audio o URL) es el **contenido**, y el **valor del campo** es el **campo dentro del tipo de nota**.

Los campos aparecen en el **cuadro de diálogo de exportación a Anki** en el mismo orden que en los ajustes. Puedes cambiar el orden desde el **menú ⋮** → **Bajar** o **Subir**.

| Campo                 | Contenido                                          |
| --------------------- | -------------------------------------------------- |
| Oración (todas las pistas) | Todos los subtítulos en la marca de tiempo de la tarjeta |
| Definición            | Definición de la palabra proporcionada por el usuario |
| Palabra               | Palabra proporcionada por el usuario               |
| Audio                 | Audio grabado de la fuente de vídeo                |
| Imagen                | Captura de pantalla de la fuente de vídeo          |
| Fuente                | Archivo de subtítulos o nombre y marca de tiempo del vídeo |
| URL                   | URL actual si la tarjeta se creó a partir de un vídeo en streaming |
| Pista de subtítulos 1 | Subtítulos de la pista 1 en la marca de tiempo de la tarjeta |
| Pista de subtítulos 2 | Subtítulos de la pista 2 en la marca de tiempo de la tarjeta |
| Pista de subtítulos 3 | Subtítulos de la pista 3 en la marca de tiempo de la tarjeta |
| Campos personalizados | Valores proporcionados por el usuario             |

### Etiquetas {#tags}

Etiquetas predeterminadas que se incluirán en cada tarjeta.

## <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>Mining</a> {#mining}

### Acción predeterminada del botón de minado {#mining-button-default-action}

El «botón de minado» <NoteAddIcon/> es el botón situado más a la izquierda en la **interfaz superpuesta** y el que aparece junto a los subtítulos en la **lista de subtítulos**. Este ajuste define qué hacen esos botones.

| Ajuste                  | Comportamiento                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mostrar el cuadro de diálogo de Anki | Registra el subtítulo seleccionado en el historial de minado y muestra el **cuadro de diálogo de exportación a Anki** |
| Actualizar la última tarjeta | Registra el subtítulo seleccionado en el historial de minado y actualiza la última tarjeta del mazo configurado con todo el contenido proporcionado por asbplayer, excepto los campos de definición, palabra y campos personalizados proporcionados por el usuario |
| Mostrar el cuadro de diálogo para actualizar la tarjeta | Registra el subtítulo seleccionado en el historial de minado y muestra el cuadro de diálogo para actualizar la última tarjeta con el contenido proporcionado por asbplayer |
| Exportar tarjeta        | Registra el subtítulo seleccionado en el historial de minado y exporta una tarjeta _solo_ con el contenido proporcionado por asbplayer, excepto los campos de definición, palabra y campos personalizados proporcionados por el usuario |
| Ninguna                 | Registra el subtítulo seleccionado en el historial de minado |

### Estado de reproducción después del minado {#post-mining-playback-state}

Configura el estado de reproducción deseado después de activar una acción de minado.

### Copiar subtítulos minados al portapapeles {#copy-mined-subtitles-to-clipboard}

Si está activado, copia el subtítulo seleccionado al portapapeles cada vez que se activa una acción de minado.

### Usar siempre el texto de los subtítulos en el campo de oración {#always-use-subtitle-text-for-sentence-field}

Cuando está activado, rellena el campo Oración con el texto de los subtítulos minados de todas las pistas, aunque una aplicación externa proporcione un texto de oración diferente. Esto resulta útil al [minar con Yomitan](../guides/one-click-mining.md).

### Al actualizar la última tarjeta, actualizar también la oración de las tarjetas con el mismo texto de subtítulos {#update-sentence-for-cards-with-the-same-subtitle-text}

Cuando está activado, la acción de minado **Actualizar última tarjeta** también reemplaza el campo Oración y los campos configurados Pista de subtítulos 1–3 en las notas creadas consecutivamente cuya oración existente coincide con la oración exportada. La actualización intenta conservar el resaltado de cada nota. Los campos de pista sin texto exportado no cambian. Si un campo de subtítulos comparte un campo de Anki con uno que no es de subtítulos, como Definición, la actualización de la oración deja ese campo sin cambios en las notas anteriores.

Este ajuste copia la oración seleccionada para la exportación actual. Activa [**Usar siempre el texto de los subtítulos en el campo de oración**](#always-use-subtitle-text-for-sentence-field) para usar el texto completo de los subtítulos minados. La [actualización de imagen y audio](#update-all-cards-with-the-same-subtitle-text) es independiente.

La coincidencia se basa en el campo Oración principal, ignora el marcado de la oración y acepta que una oración esté contenida en la otra; así, una nota que solo contiene la primera línea puede coincidir con un subtítulo completo. La búsqueda incluye las notas añadidas durante los dos últimos días de Anki y se detiene en la primera oración distinta o ausente. Se necesita un campo de oración y una oración exportada no vacía, también al actualizar los campos de pista. Este ajuste está desactivado de forma predeterminada y no afecta a las actualizaciones de una tarjeta seleccionada específicamente.

### Al actualizar la última tarjeta, actualizar también la imagen y el audio de las tarjetas con el mismo texto de subtítulos {#update-all-cards-with-the-same-subtitle-text}

Cuando está activado, la acción de minado **Actualizar última tarjeta** también actualiza los campos de audio e imagen de las notas creadas consecutivamente a partir de la misma línea de subtítulos. Cada nota anterior conserva su palabra, definición y campos personalizados. Sus campos de subtítulos no cambian, salvo que también esté activada la [actualización de la oración](#update-sentence-for-cards-with-the-same-subtitle-text). Para buscar coincidencias se ignora el marcado de la oración y se permite que esta forme parte del contexto del subtítulo minado.

La búsqueda incluye las notas añadidas durante los dos últimos días de Anki y se detiene en la primera oración distinta o ausente. Debe haber un campo de oración configurado, y la oración exportada debe contener texto, no solo espacios en blanco o marcado. Este ajuste está desactivado de forma predeterminada y no afecta a las actualizaciones de una tarjeta seleccionada específicamente.

### Reproducir audio mientras se graba desde un vídeo local {#play-audio-while-recording-from-local-video}

asbplayer usa la API [MediaRecorder](https://developer.mozilla.org/ja/docs/Web/API/MediaRecorder) integrada en el navegador para grabar audio de archivos de vídeo locales. Este ajuste determina si el sonido debe reproducirse durante la grabación.

### Volver a codificar el audio como mp3 {#re-encode-audio-as-mp3}

De forma predeterminada, el audio grabado no se codifica como `mp3`. Este ajuste hace que el audio se vuelva a codificar como `mp3`. Por lo general, no hay motivo para desactivarlo, sobre todo si quieres repasar tus tarjetas en iOS.

### Margen inicial de audio {#audio-padding-start}

Cuántos milisegundos **antes** del subtítulo seleccionado debe empezar la grabación de audio.

### Margen final de audio {#audio-padding-end}

Cuántos milisegundos **después** del subtítulo seleccionado debe detenerse la grabación de audio.

### Formato de captura de imagen (solo en el sitio web) {#image-capture-format}

Especifica el formato de captura de imagen de las tarjetas minadas. Solo está disponible en el sitio web para archivos de vídeo locales, donde la única opción adicional es «clip de vídeo».

### Ancho y alto máximos de captura {#max-capture-dimensions}

Ancho y alto máximos de las capturas de pantalla en píxeles. `0` significa «sin límite».

### Recortar las barras negras de las capturas de pantalla {#trim-black-bars-from-screenshots}

Cuando está activado, elimina de las capturas de pantalla las barras negras añadidas para ajustar la relación de aspecto.

### Recorte inicial y final del clip {#clip-trim-start-end}

Especifica cuánto tiempo se recorta al principio y al final del intervalo de tiempo de un subtítulo al determinar el intervalo predeterminado del clip de vídeo. Solo está disponible cuando se selecciona el formato de captura de clip de vídeo.

### Duración máxima del clip {#max-clip-length}

Especifica la duración máxima del clip de vídeo. Solo está disponible cuando se selecciona el formato de captura de clip de vídeo.

### Retraso de captura de pantalla {#screenshot-capture-delay}

Cuánto tiempo esperar después de que aparezca el subtítulo seleccionado antes de tomar la captura de pantalla.

### Cantidad de subtítulos circundantes {#surrounding-subtitles-count-radius}

En la parte inferior del **cuadro de diálogo de exportación a Anki** hay un control deslizante para ajustar el intervalo de tiempo seleccionado. El control incluye subtítulos circundantes como contexto adicional. Este ajuste limita la cantidad de esos subtítulos.

### Intervalo de tiempo de los subtítulos circundantes {#surrounding-subtitles-time-radius}

En la parte inferior del **cuadro de diálogo de exportación a Anki** hay un control deslizante para ajustar el intervalo de tiempo seleccionado. El control incluye subtítulos circundantes como contexto adicional. Este ajuste determina el intervalo de tiempo permitido alrededor del subtítulo seleccionado para incluir esos subtítulos.

## <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>Apariencia de los subtítulos</a> {#subtitle-appearance}

### Pista de subtítulos {#subtitle-appearance-track}

asbplayer puede cargar varias pistas de subtítulos simultáneamente. En este menú desplegable puedes seleccionar las pistas a las que se aplicarán los ajustes siguientes. La selección predeterminada es «Todas». Si modificas un ajuste de apariencia con «Todas» seleccionado, se aplicará a todas las pistas. Cuando configures un valor específico para una pista, ese ajuste dejará de aparecer en la página «Todas».

### Vista previa de subtítulos {#subtitle-preview}

Previsualiza y edita el texto de los subtítulos que se usa para mostrar el efecto de los ajustes de apariencia.

### Estilo {#styling}

| Ajuste                            | Descripción                                                                          | Propiedad CSS               |
| --------------------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| Color de subtítulos               | Color                                                                                | `color`                     |
| Tamaño de subtítulos              | Tamaño en `px`                                                                       | `font-size`                 |
| Grosor de fuente de subtítulos   | Grosor de la fuente                                                                  | `font-weight`               |
| Color del contorno de subtítulos | Color del trazo                                                                      | `-webkit-text-stroke-color` |
| Grosor del contorno de subtítulos | Grosor del trazo                                                                    | `-webkit-text-stroke-width` |
| Color de la sombra de subtítulos | Color de la sombra                                                                   | `text-shadow`               |
| Grosor de la sombra de subtítulos | Grosor de la sombra                                                                 | `text-shadow`               |
| Color de fondo de subtítulos     | Color de fondo                                                                       | `background-color`          |
| Opacidad del fondo de subtítulos | Opacidad del fondo                                                                   | `background`                |
| Familia tipográfica de subtítulos | Fuente. Al conceder acceso a las fuentes locales, aparece un menú con las fuentes disponibles. | `font-family`         |
| CSS:\<style key\>                 | Valor de cadena de cualquier propiedad CSS personalizada añadida desde el menú **Añadir CSS personalizado**. | Propiedad personalizada |
| Desenfoque de subtítulos         | Aplica un efecto de desenfoque a los subtítulos. Se quita al pasar el cursor.         | `filter:blur(...)`          |
| Factor de escala de subtítulos de imagen | Escala los subtítulos basados en imágenes.                                     | —                           |

### Diseño {#layout}

| Ajuste                               | Descripción                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Alineación de subtítulos              | Indica si los subtítulos se colocan en la parte superior o inferior del elemento de vídeo. |
| Desfase desde la parte inferior       | Distancia desde la parte inferior del elemento de vídeo para todas las pistas de subtítulos inferiores. |
| Desfase desde la parte superior       | Distancia desde la parte superior del elemento de vídeo para todas las pistas de subtítulos superiores. |
| Ancho de subtítulos                   | Ancho del contenedor de subtítulos, en `%` o píxeles.                         |

## <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>Atajos de teclado</a> {#keyboard-shortcuts}

Puedes usar atajos de teclado para acceder a la mayoría de las funciones de asbplayer.

### Atajos de teclado para <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>subtítulos</a> {#subtitles-keyboard-shortcuts}

| Acción                                | Atajo predeterminado |
| ------------------------------------ | ---------------- |
| Seleccionar las pistas de subtítulos que se cargarán | Ctrl + Shift + F |
| Mostrar u ocultar subtítulos          | ↓                |
| Mostrar u ocultar la pista 1 del vídeo | 1               |
| Mostrar u ocultar la pista 2 del vídeo | 2               |
| Mostrar u ocultar la pista 3 del vídeo | 3               |
| Mostrar u ocultar la pista 1 de asbplayer | W + 1         |
| Mostrar u ocultar la pista 2 de asbplayer | W + 2         |
| Mostrar u ocultar la pista 3 de asbplayer | W + 3         |
| Quitar el desenfoque de la pista 1 de asbplayer | B + 1    |
| Quitar el desenfoque de la pista 2 de asbplayer | B + 2    |
| Quitar el desenfoque de la pista 3 de asbplayer | B + 3    |
| Subir los subtítulos inferiores       |                  |
| Bajar los subtítulos inferiores       |                  |
| Subir los subtítulos superiores       |                  |
| Bajar los subtítulos superiores       |                  |

### Atajos de teclado para <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>minar</a> {#mining-keyboard-shortcuts}

| Acción                                                                                | Atajo predeterminado       |
| ------------------------------------------------------------------------------------ | -------------------------- |
| Minar el subtítulo actual                                                            | Ctrl + Shift + Z (sitio web) |
| Minar el subtítulo actual y abrir el cuadro de diálogo de Anki                         | Ctrl + Shift + X           |
| Actualizar la última tarjeta de Anki creada con la captura de pantalla, el audio, etc. capturados por asbplayer | Ctrl + Shift + U |
| Exportar la tarjeta a Anki sin abrir el cuadro de diálogo.                             |                            |
| Tomar una captura de pantalla manualmente y reemplazar la que se toma automáticamente al minar | Ctrl + Shift + V (sitio web) |
| Iniciar o detener manualmente la grabación de audio, incluso si hay un archivo de subtítulos cargado. | Ctrl + Shift + R (sitio web) |

### Atajos de teclado para <a href={new URL('?view=settings#playback', project.urls.app).href}>reproducción</a> {#playback-keyboard-shortcuts}

| Acción                           | Atajo predeterminado |
| ------------------------------- | ---------------- |
| Abrir o cerrar el panel lateral  | \`               |
| Reproducir o pausar              | Espacio          |
| Activar o desactivar la pausa automática | Shift + P |
| Activar o desactivar la reproducción condensada | Shift + O |
| Activar o desactivar el avance rápido | Shift + F    |
| Activar o desactivar la repetición | Shift + R      |
| Alternar cuándo se muestran los subtítulos |             |
| Recorrer los modos de reanudación de pausa automática | |
| Recorrer las recetas hacia delante |                 |
| Recorrer las recetas hacia atrás  |                  |
| Activar o desactivar la receta 1  |                  |
| Activar o desactivar la receta 2  |                  |
| Activar o desactivar la receta 3  |                  |
| Activar o desactivar la receta 4  |                  |
| Activar o desactivar la receta 5  |                  |
| Activar o desactivar la receta 6  |                  |
| Activar o desactivar la receta 7  |                  |
| Activar o desactivar la receta 8  |                  |
| Activar o desactivar la receta 9  |                  |
| Activar o desactivar la receta 10 |                  |

### Atajos de teclado para <a href={new URL('?view=settings#playback', project.urls.app).href}>buscar</a> {#seek-keyboard-shortcuts}

| Acción                                                                     | Atajo predeterminado |
| ------------------------------------------------------------------------- | ---------------- |
| Retroceder (3 segundos de forma predeterminada, [configurable](#seek-interval-seconds)) | A |
| Avanzar (3 segundos de forma predeterminada, [configurable](#seek-interval-seconds)) | D |
| Ir al subtítulo anterior                                                   | ←                |
| Ir al subtítulo siguiente                                                  | →                |
| Ir al principio del subtítulo actual o anterior                           | ↑                |

### Atajos de teclado para la <a href={new URL('?view=settings#playback', project.urls.app).href}>velocidad de reproducción</a> {#playback-rate-keyboard-shortcuts}

| Acción                  | Atajo predeterminado |
| ---------------------- | ---------------- |
| Aumentar la velocidad de reproducción | Ctrl + Shift + ] |
| Reducir la velocidad de reproducción  | Ctrl + Shift + [ |

### Atajos de teclado para el <a href={new URL('?view=settings#playback', project.urls.app).href}>desfase de subtítulos</a> {#subtitle-offset-keyboard-shortcuts}

| Acción                                                                    | Atajo predeterminado |
| ------------------------------------------------------------------------ | ---------------- |
| Ajustar el desfase para que el subtítulo anterior coincida con la marca de tiempo actual | Ctrl + ← |
| Ajustar el desfase para que el subtítulo siguiente coincida con la marca de tiempo actual | Ctrl + → |
| Aumentar el desfase en 100 ms                                             | Ctrl + Shift + ← |
| Reducir el desfase en 100 ms                                              | Ctrl + Shift + → |
| Restablecer el desfase de subtítulos                                     | Ctrl + Shift + ↓ |

### Atajos de teclado para <a href={new URL('?view=settings#annotation', project.urls.app).href}>anotaciones</a> {#annotation-keyboard-shortcuts}

| Acción                             | Atajo predeterminado |
| --------------------------------- | ---------------- |
| Abrir estadísticas                 | Q + S            |
| Ir a la palabra siguiente          | Q + E            |
| Ir a la palabra anterior           | Q + W            |
| Marcar la palabra señalada como Madura | Q + 5         |
| Ir a la siguiente palabra Madura    |                  |
| Ir a la palabra Madura anterior     |                  |
| Marcar la palabra señalada como Joven | Q + 4          |
| Ir a la siguiente palabra Joven     |                  |
| Ir a la palabra Joven anterior      |                  |
| Marcar la palabra señalada como Graduada | Q + 3      |
| Ir a la siguiente palabra Graduada  |                  |
| Ir a la palabra Graduada anterior   |                  |
| Marcar la palabra señalada como En aprendizaje | Q + 2 |
| Ir a la siguiente palabra En aprendizaje |             |
| Ir a la palabra En aprendizaje anterior |              |
| Marcar la palabra señalada como Desconocida | Q + 1  |
| Ir a la siguiente palabra Desconocida |               |
| Ir a la palabra Desconocida anterior |                 |
| Marcar la palabra señalada como Sin recopilar | Q + 0 |
| Ir a la siguiente palabra Sin recopilar |            |
| Ir a la palabra Sin recopilar anterior |              |
| Alternar el estado Ignorada de la palabra señalada | Q + I |
| Ir a la siguiente palabra Ignorada |                  |
| Ir a la palabra Ignorada anterior  |                  |

### Intervalo de búsqueda (segundos) {#seek-interval-seconds}

Controla el intervalo que usan los [atajos de teclado para avanzar y retroceder](#seek-keyboard-shortcuts).

### Reproducir siempre después de «Ir al principio del subtítulo actual o anterior» {#always-play-on-subtitle-seek}

En lugar de conservar el estado de reproducción actual, siempre inicia la reproducción al usar el [atajo de teclado para avanzar o retroceder](#seek-keyboard-shortcuts) que va al principio del subtítulo actual o anterior. Así ahorras una pulsación.

### Incremento de ajuste de velocidad de reproducción {#playback-speed-adjust-step}

Incremento que se usa con los [atajos de teclado](#playback-rate-keyboard-shortcuts) para aumentar o reducir la velocidad de reproducción.

### Atajos de la extensión {#extension-shortcuts}

Cuando está instalada la extensión del navegador, algunos atajos de minado (por ejemplo, minar el subtítulo actual o minarlo y abrir el cuadro de diálogo de Anki) se implementan como comandos del navegador en lugar de como detectores de pulsaciones de teclas, y solo se pueden editar en el editor de atajos de extensiones del navegador.

- Chrome: `chrome://extensions/shortcuts`
- Firefox: `about:addons` → `Administrar atajos de extensiones`

## <a href={new URL('?view=settings#annotation', project.urls.app).href}>Anotaciones</a> {#annotation}

### Explorador de palabras {#word-browser}

:::info
Solo se pueden editar o eliminar las palabras locales. Las fuentes externas son de solo lectura y solo se actualizan mediante la [sincronización](#re-build-anki-word-database).
:::

Abre el explorador de palabras, donde puedes ver y administrar todas las palabras de tus bases de datos local y sincronizada con Anki.

:::tip
Puedes buscar palabras en cualquiera de los sistemas de escritura del idioma (por ejemplo, romaji, hiragana, katakana o kanji para el japonés).

También se aplican automáticamente otras sustituciones habituales para mejorar el uso, como `e -> é` o `ss -> ß`.
:::

### Importar palabras {#import-words}

Importa palabras a la **base de datos local de palabras** de asbplayer.

Las palabras importadas se consideran locales y tienen prioridad sobre las fuentes externas al determinar su estado.

El cuadro de diálogo de importación permite pegar cualquier texto (asbplayer lo dividirá en palabras) e importar archivos exportados anteriormente.

:::tip
Puedes pasar el cursor sobre las palabras y usar los [atajos de teclado para anotaciones](#annotation-keyboard-shortcuts) para cambiar su estado localmente.
:::

### Exportar palabras {#export-words}

Exporta la base de datos local de palabras para que puedas guardarla como copia de seguridad, trasladarla a otro dispositivo o compartirla entre el sitio web y la extensión.

### Reconstruir la base de datos de palabras de Anki {#re-build-anki-word-database}

Crea o reconstruye la caché local de información sobre el estado de las palabras obtenida de Anki.

:::tip
La caché también se actualiza automáticamente durante la reproducción cuando hay una pista activada y se puede conectar con Anki.

Este botón está desactivado a menos que tus ajustes de anotaciones [aprovechen la integración con Anki](../common-issues.md#enable-or-disable-annotation-for-a-track).

Para vaciar las entradas de una pista en la base de datos de palabras de Anki, [sigue estos pasos](../common-issues.md#clear-anki-word-database).
:::

### Reconstruir la base de datos de palabras de WaniKani {#re-build-wanikani-word-database}

Crea o reconstruye la caché local de información de vocabulario obtenida de WaniKani.

:::tip
La caché también se actualiza automáticamente durante la reproducción cuando hay una pista activada y se ha configurado un token.

Este botón está desactivado a menos que tus ajustes de anotaciones [aprovechen la integración con WaniKani](../common-issues.md#enable-or-disable-annotation-for-a-track).

Para vaciar las entradas de una pista en la base de datos de palabras de WaniKani, [sigue estos pasos](../common-issues.md#clear-wanikani-word-database).
:::

### Pista de subtítulos {#annotation-track}

Selecciona la pista de subtítulos a la que se aplican estos ajustes de anotaciones.

### Colorear subtítulos según las palabras conocidas {#colorize-subtitles-based-on-known-words}

Activa el estilo de palabras según su estado (sin recopilar, desconocidas, en aprendizaje, etc.). El estilo usa los ajustes configurados en [**Estilo de color de palabra**](#word-color-style) y [**Colores de estado de palabra**](#word-status-colors).

### Generar estadísticas automáticamente {#generate-statistics-automatically}

Genera automáticamente estadísticas para los elementos multimedia actuales al cargarlos. Esto también activa la superposición de estadísticas. El [atajo de teclado para abrir las estadísticas](#annotation-keyboard-shortcuts) está en el grupo Anotaciones.

### Mostrar lecturas de palabras {#display-word-readings}

Muestra las lecturas (por ejemplo, furigana) encima de las palabras según su estado y sus condiciones.

### Mostrar frecuencia de palabras {#display-word-frequency}

Muestra debajo de las palabras un valor de frecuencia basado en su rango, si está disponible, según su estado y sus condiciones. Esto ayuda a priorizar qué palabras merecen tiempo de estudio.

:::tip
La información de frecuencia requiere que tu instancia de Yomitan tenga disponible al menos un diccionario de frecuencia basado en rangos. Si un diccionario de frecuencia no declara su modo, asbplayer intentará deducir si se basa en rangos y lo usará como corresponda.

Si hay varios valores de frecuencia disponibles para una palabra, se usa el más bajo (el más frecuente).
:::

### Mostrar acento tonal (japonés) {#display-pitch-accent-japanese}

:::note
Para ver el acento tonal en el furigana, debes activarlo mediante [**Mostrar lecturas de palabras**](#display-word-readings).
:::

Muestra el acento tonal en el furigana o en el propio kana, según el estado y las condiciones.

:::info
Si los datos están disponibles, el acento tonal de la partícula que sigue a una palabra se determina según el de la palabra.

Normalmente, solo los kanji incluyen lecturas furigana. Sin embargo, con esta función activada, todos los caracteres de una palabra tendrán lecturas furigana si al menos uno de ellos es un kanji. Así es más fácil leer el acento tonal de las palabras compuestas.
:::

### Mostrar definiciones de palabras {#display-word-definitions}

Controla si se muestran definiciones o explicaciones breves de cada palabra según su estado y sus condiciones.

### Estrategia de búsqueda en el campo de palabra {#word-field-search-strategy}

Controla cómo compara asbplayer las palabras de los subtítulos con las palabras que conoces.

- **Forma exacta recopilada**: el campo debe contener la forma exacta del subtítulo (running -> running).
- **Lema recopilado**: debes haber recopilado el lema o la forma base (running -> run).
- **Lema o forma exacta recopilados**: la palabra se considera recopilada si coincide el lema o la forma exacta (cualquiera de las opciones anteriores).
- **Cualquier forma recopilada**: la palabra se considera recopilada si coincide cualquier forma relacionada (running -> run, ran, runs, etc.).

Al seleccionar **Lema recopilado**, **Lema o forma exacta recopilados** o **Cualquier forma recopilada**, [**Comparar entre sistemas de escritura**](#match-across-language-scripts) controla si la comparación basada en lemas puede cruzar entre distintos sistemas de escritura de un idioma (por ejemplo, kanji, hiragana y katakana).

### Prioridad al elegir una tarjeta {#card-choice-priority}

Si hay varias tarjetas de Anki que coinciden con una palabra, este ajuste determina cuál se usa para establecer su estado:

- **El campo contiene la forma exacta** (si hay varias, se usa la tarjeta que mejor conoces)
- **El campo contiene el lema** (si hay varias, se usa la tarjeta que mejor conoces)
- **La tarjeta que mejor conoces**
- **La tarjeta que menos conoces**

### Estrategia de búsqueda en el campo de oración {#sentence-field-search-strategy}

Controla cómo busca asbplayer en los [**campos de oración de Anki**](#anki-sentence-fields) que hayas configurado. Tiene las mismas opciones que la [**estrategia de búsqueda en el campo de palabra**](#word-field-search-strategy).

Al seleccionar **Lema recopilado**, **Lema o forma exacta recopilados** o **Cualquier forma recopilada**, [**Comparar entre sistemas de escritura**](#match-across-language-scripts) controla si la comparación basada en lemas puede cruzar entre distintos sistemas de escritura de un idioma (por ejemplo, kanji, hiragana y katakana).

:::tip
Como las oraciones contienen varias palabras, el estado de la tarjeta tiene menos relevancia para cada palabra por separado. Por eso, es mejor dejar **Forma exacta recopilada**, a menos que solo tengas tarjetas de oraciones.
:::

### Comparar entre sistemas de escritura {#match-across-language-scripts}

Controla si la comparación basada en lemas puede cruzar entre distintos sistemas de escritura de un idioma (por ejemplo, kanji, hiragana y katakana).

```
if true:
  - Kana subtitles can match kanji in collection, could be homophones but text processing can't handle it so we allow it.
  - Kanji subtitles only match with kanji in collection, prevents kana collected matches all kanji homophones.
if false:
  - Never match across scripts, downside is if kanji is collected kana will need to be collected too.
  - Essentially a strict mode where the you need to collect all script forms of a word.
```

### URL de la API de Yomitan {#yomitan-api-url}

URL del punto de conexión de la API de Yomitan. Si la URL no se puede alcanzar o no es válida, asbplayer mostrará un error.

:::tip
Necesitarás una instancia configurada de [Yomitan](https://yomitan.wiki/) y [yomitan-api](https://github.com/yomidevs/yomitan-api).
:::

### Analizador de Yomitan {#yomitan-parser}

Selecciona el analizador de Yomitan que se usará para dividir en palabras el texto de los subtítulos:

- **Analizador de escaneo (todos los idiomas)**: analizador interno de Yomitan que busca las palabras más largas de tus diccionarios.
- **MeCab (japonés)**: usa MeCab para analizar texto japonés. Requiere que Yomitan esté configurado para admitir MeCab, preferiblemente con al menos un diccionario UniDic.

### Longitud máxima de palabra {#max-word-length}

:::info
Este ajuste solo se aplica al analizador de escaneo.
:::

Limita la longitud máxima de las palabras que asbplayer intentará analizar y dividir para añadir anotaciones.

:::tip
Si estableces un valor demasiado bajo, no se detectarán las palabras más largas; si lo estableces demasiado alto, puede haber problemas de rendimiento.
:::

### Mazos de Anki (opcional) {#anki-decks}

Limita las búsquedas de Anki a los mazos seleccionados. Si lo dejas vacío, asbplayer busca en todos los mazos.

### Campos de palabras de Anki {#anki-word-fields}

Campos de las notas de Anki que contienen _solo_ la palabra objetivo. Es la forma recomendada de obtener de Anki información sobre el estado de las palabras.

### Campos de oraciones de Anki {#anki-sentence-fields}

Campos de las notas de Anki que contienen una oración (se usan normalmente en los mazos de oraciones). Se usarán como alternativa si no hay tarjetas con la palabra objetivo en los [**campos de palabras de Anki**](#anki-word-fields).

### Estabilidad o intervalo de las tarjetas maduras de Anki (días) {#mature-anki-stability-interval}

Controla el límite (en días) para determinar si una tarjeta de Anki es **Madura** o tiene un estado de madurez inferior.

- **Sin recopilar**: no se encuentra en Anki.
- **Desconocida**: se encuentra en Anki con `is:new`.
- **En aprendizaje**: se encuentra en Anki con `is:learn`.
- **Graduada**: se encuentra en Anki con `-is:new -is:learn prop:s<{ceil(cutoff / 2)}`.
- **Joven**: se encuentra en Anki con `-is:new -is:learn prop:s>=${ceil(cutoff / 2)} prop:s<${cutoff}`.
- **Madura**: se encuentra en Anki con `-is:new -is:learn prop:s>=${cutoff}`.

:::tip
Si se conoce la estabilidad FSRS de una tarjeta (la última vez que se repasó estaba activado FSRS), se usará en lugar del intervalo.

Para obtener más información sobre los estados de las palabras, consulta [**Colores de estado de palabra**](#word-status-colors).
:::

### Tratar las tarjetas suspendidas de Anki como {#treat-suspended-anki-cards-as}

Controla cómo se tratan las tarjetas **suspendidas** al crear estados de palabras a partir de Anki:

- **Normal**: usa el estado de Anki tal como está.
- También puedes elegir un estado específico de palabra (por ejemplo, **Madura**, **Desconocida**, etc.) para asignarlo a las tarjetas suspendidas.

:::tip
Si solo están suspendidas algunas tarjetas de una palabra, las tarjetas suspendidas se filtran y el estado de la palabra se determina a partir de las tarjetas no suspendidas.

Para obtener más información sobre los estados de las palabras, consulta [**Colores de estado de palabra**](#word-status-colors).
:::

### Token de API de WaniKani {#wanikani-api-token}

Usa el token de API de WaniKani para sincronizar las palabras que conoces desde WaniKani. Para configurarlo, sigue las instrucciones de la [guía de anotaciones](../guides/annotation.md#setup).

asbplayer solo usa los tipos de asignatura `vocabulary` y `kana_vocabulary` para determinar las palabras conocidas. Los estados se determinan según la etapa del SRS y el [sistema de repetición espaciada](https://docs.api.wanikani.com/20170710/#spaced-repetition-system) configurado para esa asignatura. Los estados de WaniKani se determinan de la siguiente manera:

- **Sin recopilar**: no se encuentra en WaniKani.
- **Desconocida**: se encuentra en WaniKani con una etapa del SRS anterior a `Starting stage`.
- **En aprendizaje**: se encuentra en WaniKani con una etapa del SRS igual o posterior a `Starting stage` y anterior a `Passing stage`.
- **Graduada**: se encuentra en WaniKani con una etapa del SRS dentro de la mitad inferior de las etapas entre `Passing stage` y `Burning stage`.
- **Joven**: se encuentra en WaniKani con una etapa del SRS dentro de la mitad superior de las etapas entre `Passing stage` y `Burning stage`.
- **Madura**: se encuentra en WaniKani con una etapa del SRS igual o posterior a `Burning stage`.

:::tip
Para obtener más información sobre los estados de las palabras, consulta [**Colores de estado de palabra**](#word-status-colors).
:::

### Estilo de color de palabra {#word-color-style}

Controla cómo se aplican los colores de estado a las palabras en [**Colorear subtítulos según las palabras conocidas**](#colorize-subtitles-based-on-known-words):

- **Texto**: cambia el color de la palabra.
- **Fondo**: cambia el color de fondo de la palabra.
- **Subrayado**: subraya la palabra con el color de su estado.
- **Línea superior**: dibuja una línea sobre la palabra con el color de su estado.
- **Contorno**: dibuja el contorno de la palabra con el color de su estado.

:::tip
Al usar **Contorno**, quizá tengas que establecer el [**grosor del contorno de los subtítulos**](#subtitle-appearance-track) en `0` para obtener mejores resultados.
:::

### Grosor {#thickness}

Controla el grosor (en píxeles) de los estilos **Subrayado**, **Línea superior** y **Contorno**.

### Resaltar palabras al pasar el cursor {#highlight-words-on-hover}

:::info
Este resaltado indica dónde está el foco que asbplayer necesita para registrar los atajos de teclado. Si no aparece, quizá tengas que hacer clic en el reproductor para enfocarlo. Los atajos de teclado solo funcionan en el vídeo o en la lista de subtítulos, pero no en ambos a la vez, según dónde esté el foco.

El resaltado sirve principalmente para que sepas qué palabra estás señalando para recopilarla. Por eso, solo aparece si señalas una palabra y tienes activada la opción de colorear.
:::

Si está activado, al señalar una palabra esta se resalta para que puedas ver cómo la ha dividido Yomitan.

### Mostrar el color de la palabra solo al pasar el cursor {#only-display-word-color-on-hover}

:::note
Este ajuste solo se aplica si está activada la opción [**Colorear subtítulos según las palabras conocidas**](#colorize-subtitles-based-on-known-words).
:::

Si se activa para el vídeo o la lista de subtítulos, los colores de las palabras se ocultan de forma predeterminada y solo aparecen al pasar el cursor sobre el texto de los subtítulos en el vídeo o en la lista, respectivamente.

### Mostrar la lectura de la palabra solo al pasar el cursor {#only-display-word-reading-on-hover}

:::note
Este ajuste solo se aplica si está activada la opción [**Mostrar lecturas de palabras**](#display-word-readings).
:::

Si se activa para el vídeo o la lista de subtítulos, las lecturas de las palabras se ocultan de forma predeterminada y solo aparecen al pasar el cursor sobre el texto de los subtítulos en el vídeo o en la lista, respectivamente.

### Mostrar la frecuencia de la palabra solo al pasar el cursor {#only-display-word-frequency-on-hover}

:::note
Este ajuste solo se aplica si está activada la opción [**Mostrar frecuencia de palabras**](#display-word-frequency).
:::

Si se activa para el vídeo o la lista de subtítulos, la frecuencia de las palabras se oculta de forma predeterminada y solo aparece al pasar el cursor sobre el texto de los subtítulos en el vídeo o en la lista, respectivamente.

### Mostrar las definiciones de palabras solo al pasar el cursor {#only-display-word-definitions-on-hover}

:::note
Este ajuste solo se aplica si está activada la opción [**Mostrar definiciones de palabras**](#display-word-definitions).
:::

Si se activa para el vídeo o la lista de subtítulos, las definiciones de las palabras se ocultan de forma predeterminada y solo aparecen al pasar el cursor sobre el texto de los subtítulos en el vídeo o en la lista, respectivamente.

### Mostrar el acento tonal solo al pasar el cursor {#only-display-pitch-accent-on-hover}

:::note
Este ajuste solo se aplica si está activada la opción [**Mostrar acento tonal (japonés)**](#display-pitch-accent-japanese).
:::

Si se activa para el vídeo o la lista de subtítulos, el acento tonal se oculta de forma predeterminada y solo aparece al pasar el cursor sobre el texto de los subtítulos en el vídeo o en la lista, respectivamente.

### Tamaño de lectura de palabras {#word-reading-size}

Controla el tamaño de las lecturas de palabras (furigana) en unidades em (% del tamaño de fuente de los subtítulos).

### Tamaño de la frecuencia de palabras {#word-frequency-size}

Controla el tamaño de la frecuencia de las palabras en unidades em (% del tamaño de fuente de los subtítulos).

### Tamaño de la definición de palabras {#word-definition-size}

Controla el tamaño de las definiciones de palabras en unidades em (% del tamaño de fuente de los subtítulos).

### Tamaño del acento tonal {#pitch-accent-size}

Controla el tamaño del acento tonal en unidades em (% del tamaño de fuente de los subtítulos).

### Colores de estado de palabra {#word-status-colors}

Cada estado tiene un color y una transparencia configurables que usa el [**estilo de color de palabra**](#word-color-style). Puedes activar o desactivar cada uno por separado.

- **Sin recopilar**: la palabra no está en tu base de datos de asbplayer.
- **Desconocida**: la palabra está presente, pero se considera desconocida.
- **En aprendizaje**: la palabra se está aprendiendo actualmente.
- **Graduada**: la palabra ha completado la etapa de aprendizaje.
- **Joven**: conoces la palabra, pero aún no es madura.
- **Madura**: conoces plenamente la palabra.

:::tip
Puedes desactivar los estilos de estado según tus preferencias; por ejemplo, desactiva **Madura** para reducir el desorden visual.

Puedes reutilizar colores (por ejemplo, para **Graduada** y **Joven**) si no quieres distinguir entre algunos estados.

Para saber cómo se determinan los estados de las tarjetas de Anki, consulta [**Estabilidad o intervalo de las tarjetas maduras de Anki (días)**](#mature-anki-stability-interval).
Para saber cómo se determinan los estados de WaniKani, consulta [**Token de API de WaniKani**](#wanikani-api-token).
:::

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Reproducción</a> {#playback}

### Pistas de subtítulos afectadas por los modos de reproducción y los atajos de teclado {#playback-subtitle-tracks}

Especifica qué pistas se tendrán en cuenta al usar los atajos de teclado para [subtítulos](#subtitles-keyboard-shortcuts) y [avanzar o retroceder](#seek-keyboard-shortcuts), o al usar los modos de reproducción. Por ejemplo, cuando está activada la reproducción condensada, se considera que cualquier parte de la línea de tiempo sin subtítulos en las pistas seleccionadas está vacía y debe omitirse automáticamente.

### Pausa automática al pasar el cursor sobre los subtítulos {#auto-pause-when-mousing-over-subtitles}

Comportamiento de la pausa automática al pasar el cursor sobre los subtítulos. «Activada con reanudación automática» significa que la reproducción se reanudará automáticamente al apartar el cursor de los subtítulos.

### Modos de reproducción {#playback-modes}

Puedes alternar los modos de reproducción con los [atajos de teclado para la reproducción](#playback-keyboard-shortcuts).

### Velocidad de reproducción {#playback-rate}

Controla la velocidad normal de reproducción, incluida la velocidad que se usa dentro de los subtítulos cuando el avance rápido está activado. Toda reproducción nueva empieza a esta velocidad. Usa los [atajos de teclado para la velocidad de reproducción](#playback-rate-keyboard-shortcuts) para ajustarla mientras miras el vídeo.

### Mostrar notificación de velocidad de reproducción {#show-playback-rate-notification}

Muestra una notificación cuando cambia la velocidad de reproducción fuera del modo de avance rápido.

### Preferencia de pausa automática {#auto-pause-preference}

Cuando la pausa automática está activada, determina si se pausa al principio, al final o en ambos extremos de los subtítulos. Si se activan ambos extremos y la repetición, se pausa al final antes de repetir, pero se omite la pausa inicial para evitar una doble pausa.

### Preferencia del número de repeticiones {#repeat-count-preference}

Controla cuántas veces se repite cada subtítulo antes de continuar la reproducción. El valor `0` repite indefinidamente.

### Repeticiones antes de mostrar los subtítulos {#repeats-before-showing-subtitles}

Oculta los subtítulos de un segmento repetido hasta que se haya repetido este número de veces. `0` no los oculta; `1` deja de ocultarlos en la primera repetición.

### Desfases inicial y final de los activadores de subtítulos {#subtitle-trigger-start-and-end-offsets}

Desplaza en milisegundos los activadores de inicio y fin de subtítulos que usan la pausa automática y la repetición. Estos desfases se aplican después del desfase global de subtítulos. Puedes configurar los desfases inicial y final por separado: los valores positivos activan los efectos de reproducción más tarde y los negativos, antes. Cada extremo desplazado está limitado por el contenido multimedia y los límites de los eventos de subtítulos adyacentes. Si los extremos desplazados se cruzan, se intercambian sus funciones cronológicas.

### Intervalo mínimo de omisión para el avance rápido {#fast-forward-minimum-skip-interval}

Avanza rápidamente durante todo el intervalo entre subtítulos cuando este dura al menos lo indicado. Los intervalos más cortos se reproducen a velocidad normal.

### Velocidad de reproducción del avance rápido {#fast-forward-playback-rate}

Velocidad del avance cuando está activado el modo de avance rápido.

### Intervalo mínimo de omisión para la reproducción condensada {#condensed-playback-minimum-skip-interval}

Cuando está activada la reproducción condensada, avanza al siguiente subtítulo solo si falta al menos este tiempo para que aparezca.

### Desfases inicial y final de los activadores de intervalos entre subtítulos {#subtitle-gap-trigger-start-and-end-offsets}

Desplaza los activadores de intervalos entre subtítulos que usan el avance rápido y la reproducción condensada. El desfase inicial del intervalo es cero o positivo y retrasa el activador respecto al momento en que termina el subtítulo; el desfase final es cero o negativo y adelanta el activador respecto al momento anterior al siguiente subtítulo. Cada intervalo está limitado por el contenido multimedia y los límites de los eventos de subtítulos adyacentes.

### Modo de reanudación de pausa automática {#auto-pause-resume-mode}

Controla cómo termina una pausa automática.

- **Manual**: la reproducción permanece pausada hasta que la reanudes.

- **Fija**: todas las pausas automáticas duran el mismo tiempo configurado.
  - Controla la [duración de pausa fija](#fixed-pause-duration) y el [retraso de reanudación tras la pausa automática](#resume-delay-after-auto-pause).

- **Duración del subtítulo**: la duración de la pausa se calcula según el número de caracteres del subtítulo. Solo se cuentan los subtítulos de las pistas en las que se puede avanzar o retroceder, así que una pista de traducción cargada junto a la del idioma que estás aprendiendo no alarga la pausa.
  - Controla la [duración mínima de pausa](#minimum-pause-duration), la [duración máxima de pausa](#maximum-pause-duration), el [tiempo de pausa por carácter](#pause-time-per-character) y el [retraso de reanudación tras la pausa automática](#resume-delay-after-auto-pause).

### Duración de pausa fija {#fixed-pause-duration}

Duración de una pausa automática en el modo **Fija**.

### Duración mínima de pausa {#minimum-pause-duration}

La pausa más corta permitida en el modo **Duración del subtítulo**, independientemente del número de caracteres del subtítulo.

### Duración máxima de pausa {#maximum-pause-duration}

La pausa más larga permitida en el modo **Duración del subtítulo**. El valor `0` significa que no hay límite máximo. Si el valor no es cero, no puede ser inferior a la duración mínima de pausa.

### Tiempo de pausa por carácter {#pause-time-per-character}

Número de milisegundos asignado a cada carácter en el modo **Duración del subtítulo**. El número de caracteres multiplicado por este valor se limita a la duración mínima y máxima de pausa.

### Retraso de reanudación tras la pausa automática {#resume-delay-after-auto-pause}

En los modos **Fija** y **Duración del subtítulo**, la pausa automática tiene dos fases: el subtítulo se muestra durante la pausa configurada y luego se oculta mientras la reproducción permanece pausada durante el retraso de reanudación. Este ajuste controla la duración de la segunda fase.

### Mostrar subtítulos {#show-subtitles}

- **Cuando corresponda**: los subtítulos aparecen durante el intervalo de tiempo que tienen asignado.

- **Al pausar**: los subtítulos aparecen solo cuando les corresponde y la reproducción está pausada.

- **Al pausar manualmente**: los subtítulos aparecen solo cuando les corresponde y la reproducción se ha pausado manualmente.

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Reproducción > Anotaciones</a> {#playback-annotation}

Estos ajustes usan los estados, las condiciones y las frecuencias de las palabras de [Anotaciones](#annotation) para la pista de subtítulos seleccionada. Las reglas de pausa automática, reproducción condensada, avance rápido y repetición se aplican cuando sus modos de reproducción están activados. **Sin filtro de palabras** significa que no hay estados ni condiciones seleccionados para esa pista. Las reglas se aplican por pista: una pista en la que se puede avanzar o retroceder y que no tenga estados o condiciones seleccionados para uno de esos modos conserva el comportamiento habitual de ese modo, aunque se reproduzca junto a una pista con reglas.

### Pista de subtítulos {#playback-annotation-track}

Selecciona la pista de subtítulos cuyos ajustes de reproducción de anotaciones estás editando. La pista seleccionada también se usa en la pestaña Anotaciones.

### Seleccionar la primera palabra coincidente al pausar {#select-first-matching-word-on-pause}

Selecciona la primera palabra que coincida con cualquiera de los estados o condiciones elegidos cada vez que se pausa la reproducción, incluidas las pausas manuales y después de avanzar o retroceder mientras está pausada. Deja la selección vacía para desactivar esta función. La palabra se selecciona en el reproductor de vídeo o, si no hay ningún vídeo cargado o conectado, en el reproductor de subtítulos.

Si la pausa se debe a una [regla de pausa automática basada en anotaciones](#auto-pause-subtitles-containing-these-words), se selecciona la palabra que coincide con ella. Este menú desplegable sigue controlando la selección en las pausas manuales.

Cada una de las reglas de palabras siguientes tiene su propia selección de estados y condiciones, límite de cantidad de palabras y límite de frecuencia. Una palabra debe tener un estado o condición seleccionado y cumplir ambos límites.

### Pausar automáticamente los subtítulos que contengan estas palabras {#auto-pause-subtitles-containing-these-words}

Cuando está activada la pausa automática, pausa solo los subtítulos que contengan una palabra coincidente y selecciona la primera palabra coincidente. En las pausas automáticas, esta opción tiene prioridad sobre [**Seleccionar la primera palabra coincidente al pausar**](#select-first-matching-word-on-pause); el menú desplegable sigue aplicándose en las pausas manuales.

### Repetir los subtítulos que contengan estas palabras {#repeat-subtitles-containing-these-words}

Cuando está activado el modo de repetición, repite solo los subtítulos que contengan una palabra coincidente.

### Reproducir en modo condensado los subtítulos que contengan estas palabras {#play-subtitles-containing-these-words-in-condensed-mode}

Cuando está activado el modo condensado, conserva en la línea de tiempo condensada los subtítulos que contengan una palabra coincidente. Omite los demás subtítulos.

### Reproducir a velocidad normal en modo de avance rápido los subtítulos que contengan estas palabras {#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode}

Cuando está activado el modo de avance rápido, reproduce a velocidad normal los subtítulos que contengan una palabra coincidente. Avanza rápidamente por los demás subtítulos.

### Ajustar la velocidad de avance rápido según la comprensión {#adjust-fast-forward-rate-by-comprehension}

Cuando está activado el modo de avance rápido, usa la puntuación de comprensión de la oración para elegir la velocidad dentro de un subtítulo.

Con una comprensión igual o inferior a [**Comprensión mínima**](#minimum-comprehension), usa la velocidad normal de reproducción; al 100 %, usa la velocidad configurada para el avance rápido. Las velocidades intermedias se interpolan.

Al cambiar la velocidad de un subtítulo controlado por la comprensión, se cambia la velocidad configurada para el avance rápido y luego se recalcula la velocidad aplicada según la comprensión. Esto también se aplica cuando la comprensión mantiene el subtítulo a velocidad normal. Los atajos de teclado y los controles de velocidad del reproductor funcionan igual; la velocidad normal no cambia.

### Comprensión mínima {#minimum-comprehension}

Establece el porcentaje a partir del cual empieza la aceleración (0–99 %; 60 % de forma predeterminada).

### Mostrar estas palabras durante la reproducción {#show-these-words-during-playback}

Selecciona los estados y condiciones de las palabras que deben permanecer visibles.

### Ocultar todo el subtítulo si se ocultaría al menos este porcentaje de palabras {#whole-subtitle-hidden-percentage}

Oculta todo el subtítulo si la regla de visualización ocultaría al menos este porcentaje de sus palabras. Por ejemplo, con un **80 %**, si se ocultarían cuatro palabras de un subtítulo de cinco, se oculta el subtítulo entero, incluida la palabra seleccionada para mostrarse. Los signos de puntuación y otros caracteres que no sean letras no cuentan.

### Ocultar individualmente las palabras que no coincidan {#hide-non-matching-words-individually}

Cuando está activado, las palabras que no cumplen la regla de visualización se ocultan individualmente mientras el subtítulo esté por debajo del umbral para ocultarlo entero. Cuando está desactivado, el subtítulo permanece completamente visible hasta alcanzar ese umbral.

### Número mínimo de palabras por categoría seleccionada {#minimum-words-per-selected-category}

Cada categoría seleccionada (como **Sin recopilar** o **Ignorada**) se cuenta por separado dentro de un subtítulo. Si su cantidad está por debajo de este límite, las palabras de esa categoría no activan la regla. `0` desactiva el límite.

### Número máximo de palabras por categoría seleccionada {#maximum-words-per-selected-category}

Cada categoría seleccionada (como **Sin recopilar** o **Ignorada**) se cuenta por separado dentro de un subtítulo. Si su cantidad supera este límite, las palabras de esa categoría no activan la regla. `0` desactiva el límite.

### Solo si la frecuencia de la palabra es como mínimo {#only-when-word-frequency-is-at-least}

La frecuencia de una palabra coincidente debe ser igual o superior a este valor. Si no hay datos de frecuencia, se cuenta como `1`. `0` desactiva el límite.

### Solo si la frecuencia de la palabra es como máximo {#only-when-word-frequency-is-at-most}

La frecuencia de una palabra coincidente debe ser igual o inferior a este valor. Si no hay datos de frecuencia, se cuenta como `1`. `0` desactiva el límite.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Vídeo en streaming</a> (solo extensión) {#streaming-video}

Los ajustes de vídeo en streaming solo están disponibles si está instalada la extensión del navegador.

### Al cargar subtítulos, abrir también la lista de subtítulos de la aplicación en otra pestaña {#open-subtitle-list-in-tab}

Cada vez que se cargan subtítulos en un elemento de vídeo, abre el sitio web en otra pestaña y sincroniza allí los subtítulos cargados.

### URL de la aplicación {#app-url}

Determina desde dónde obtiene la extensión algunos ajustes y qué URL abre al sincronizar los subtítulos con el sitio web en otra pestaña. En esencia, es la URL del sitio web.

### Activar la interfaz superpuesta de controles {#enable-controls-overlay}

Muestra la interfaz superpuesta en los elementos de vídeo con subtítulos cargados.

### Mostrar subtítulos {#display-subtitles}

Muestra los subtítulos cargados en los elementos de vídeo.

### Grabar audio al minar {#record-audio-when-mining}

Al minar un subtítulo, graba el audio que este abarca para incluirlo en la tarjeta.

### Tomar una captura de pantalla al minar {#take-screenshot-when-mining}

Al minar un subtítulo, toma una captura de pantalla para incluirla en la tarjeta.

### Limpiar la captura de pantalla al minar {#clean-screenshot-when-mining}

Al minar un subtítulo con las capturas de pantalla activadas, elimina los elementos HTML superpuestos al vídeo antes de tomar la captura para que quede «limpia».

### Recortar la captura de pantalla al minar {#crop-screenshot-when-mining}

Al minar un subtítulo, recorta la captura de pantalla al tamaño del elemento de vídeo.

### Formato de captura de imagen {#streaming-image-capture-format}

Especifica el formato de captura de imagen para las tarjetas minadas a partir de vídeos en streaming. La opción adicional es «WebP animado», que captura el vídeo que se reproduce en la pestaña durante el intervalo del subtítulo (incluido el margen de audio) y lo guarda como imagen animada en lugar de como una sola captura de pantalla.

WebP animado solo se usa cuando está activada la opción [Grabar audio al minar](#record-audio-when-mining); de lo contrario, se toma una captura de pantalla como siempre. Se aplica a todos los métodos de minado que graban contenido multimedia, incluida la grabación manual iniciada y detenida con el atajo de teclado para grabar, que captura todo hasta que se detiene la grabación (hasta 30 segundos). Solo puede haber una grabación activa a la vez. WebP animado no está disponible en Firefox y no se pueden capturar vídeos protegidos con DRM. La pestaña debe permanecer visible durante la captura del clip, ya que Chrome deja de procesar las pestañas ocultas.

### FPS de la imagen animada {#animated-image-fps}

Cuántos fotogramas por segundo se capturan para las imágenes WebP animadas. Los clips más largos usan automáticamente menos fotogramas para que la tarjeta no ocupe mucho. Solo está disponible al seleccionar el formato de captura de imagen WebP animado.

### Calidad de la imagen animada {#animated-image-quality}

Calidad de cada fotograma de las imágenes WebP animadas, de `0.1` a `1`. Un valor más alto mejora la imagen, pero genera un archivo más grande. Solo está disponible al seleccionar el formato de captura de imagen WebP animado.

### Permitir arrastrar y soltar archivos de subtítulos {#allow-subtitle-file-drag-and-drop}

Permite arrastrar archivos de subtítulos y soltarlos en elementos de vídeo.

### Cargar automáticamente los subtítulos detectados {#auto-load-detected-subtitles}

Si el sitio web actual admite la detección automática de subtítulos, los carga automáticamente. Si se detectan varias pistas, carga la del idioma preferido. Se considera preferido el idioma de la última pista cargada con la casilla «Recordar estas selecciones de pistas» marcada.

### Preguntar si falla la carga automática de los subtítulos detectados {#prompt-on-subtitle-autoload-failure}

Si falla la carga automática, pregunta antes de intentar cargar los subtítulos detectados.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Vídeo en streaming > Páginas</a> {#pages}

Ajustes para integraciones específicas de páginas como YouTube, Netflix, etc. asbplayer incluye ajustes predeterminados para cada página. En la sección Páginas puedes modificarlos.

### Códigos de idioma de destino para la traducción automática (solo YouTube) {#youtube-translation-languages}

Especifica los idiomas de destino que se usarán para la traducción automática de YouTube. Si indicas idiomas aquí, aparecerán pistas adicionales para cada uno en el selector de pistas de subtítulos.

## <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Varios</a> {#misc}

### Importar o exportar ajustes {#import-export-settings}

Importa o exporta los ajustes como un archivo `json`.

### Tema {#theme}

Muestra todo asbplayer con un tema claro u oscuro.

### Idioma {#language}

Idioma en el que se muestra la interfaz.

Nota: no se han localizado todas las cadenas en todos los idiomas que admite asbplayer. Las cadenas sin traducir se muestran en inglés. Puedes ayudar con la localización en el [proyecto de Crowdin](https://crowdin.com/project/asbplayer).

### Maximizar automáticamente el vídeo local {#auto-maximize-local-video}

Maximiza automáticamente el vídeo local al abrir el panel de subtítulos.

### Mostrar el botón de minado en la lista de subtítulos {#show-mining-button-in-subtitle-list}

Cuando está activado, muestra un botón de minado junto a cada subtítulo de la lista.

### Marcas de tiempo de la lista de subtítulos {#subtitle-list-timestamps}

Controla cómo se muestran las marcas de tiempo en la lista de subtítulos.

- **Ocultas**: no se muestran.
- **Inicio**: solo muestra la marca de tiempo inicial del subtítulo.
- **Inicio y fin**: muestra las marcas de tiempo inicial y final del subtítulo.

### Recordar el desfase de subtítulos {#remember-subtitle-offset}

Cuando está activado, el desfase de tiempo se mantiene. Los subtítulos se cargan con el último desfase usado.

### Recordar la última velocidad de reproducción {#remember-last-playback-rate}

Actualiza el ajuste de velocidad de reproducción cuando se cambia la velocidad de un vídeo. Si se desactiva, la reproducción sigue empezando a la velocidad configurada, pero los cambios realizados mientras miras el vídeo son temporales.

### Recordar los últimos modos de reproducción {#remember-last-playback-modes}

Restaura los últimos modos de reproducción activados al volver a cargar la reproducción. Si se desactiva, la reproducción empieza en modo normal.

### Copiar automáticamente el subtítulo actual al portapapeles {#auto-copy-current-subtitle-to-clipboard}

Copia automáticamente el subtítulo al portapapeles cuando aparece en pantalla. Resulta útil para enviar subtítulos a aplicaciones que pueden supervisar el portapapeles.

### Pistas de subtítulos que se pueden copiar automáticamente {#subtitle-tracks-eligible-for-auto-copy}

Especifica qué pistas se copiarán automáticamente cuando esté activado el ajuste [Copiar automáticamente el subtítulo actual al portapapeles](#auto-copy-current-subtitle-to-clipboard).

### Mostrar miniaturas de vista previa {#show-preview-thumbnails}

Muestra miniaturas de vista previa en la lista de subtítulos.

### Subtítulo encima de la miniatura {#subtitle-above-thumbnail}

Muestra el subtítulo encima de la miniatura de vista previa en la lista.

### Filtro regex de subtítulos {#subtitle-regex-filter}

Las subcadenas que coincidan con esta expresión regular se reemplazarán por el valor de [Texto de reemplazo del filtro regex de subtítulos](#subtitle-regex-filter-text-replacement).

### Texto de reemplazo del filtro regex de subtítulos {#subtitle-regex-filter-text-replacement}

Las subcadenas que coinciden con la expresión regular anterior se reemplazan con el valor de este ajuste. Si se deja vacío, las subcadenas coincidentes simplemente se eliminan.

### HTML de subtítulos {#subtitle-html}

Cómo se procesa el HTML que aparece en los archivos de subtítulos.

### Detectar y mostrar ruby {#detect-and-display-ruby}

Cuando está activado, asbplayer detecta automáticamente las lecturas de palabras al estilo de Netflix y las muestra con etiquetas `ruby`. Estas lecturas aparecen con frecuencia en los subtítulos japoneses y tienen el formato `花子（はなこ）`, en el que una lectura entre paréntesis sigue a una palabra.

### Activar el cliente WebSocket {#enable-websocket-client}

Activa el cliente WebSocket. Permite controlar asbplayer mediante la interfaz WebSocket.

### URL del servidor WebSocket {#websocket-server-url}

URL del servidor WebSocket al que se conecta el cliente cuando está activado. Normalmente será una instancia local del [servidor WebSocket incluido](../guides/web-socket-server.md).

### Límite de almacenamiento del historial de minado {#mining-history-storage-limit}

Limita la cantidad de tarjetas que se pueden guardar en el historial de minado.

### Nombre de la pestaña {#name-of-the-tab}

Nombre que se usará para la pestaña de la aplicación.

## Perfiles {#profiles}

Un perfil de ajustes es un conjunto de valores completamente distinto. Puedes cambiar el perfil de ajustes activo desde la interfaz de ajustes o desde los cuadros de diálogo **Cargar subtítulos** y **Exportar a Anki**.
