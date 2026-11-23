---
sidebar_position: 3
---

import NoteAddIcon from '@site/src/components/NoteAddIcon';
import ImageIcon from '@site/src/components/ImageIcon';

# Minado en profundidad {#mining-in-depth}

Con asbplayer puedes minar oraciones de varias formas, según tus necesidades y preferencias.

## Abrir el cuadro de diálogo de exportación a Anki {#opening-the-anki-export-dialog}

Hay varias formas de abrir el **cuadro de diálogo de exportación a Anki**:

1. El botón **Minar subtítulo** <NoteAddIcon /> de la **lista de subtítulos** del **panel lateral** o del sitio web.
2. El botón **Minar subtítulo** <NoteAddIcon /> de la **interfaz superpuesta** en vídeos en streaming o en el sitio web para móviles.
3. El [atajo de teclado para minar](../reference/settings.md#mining-keyboard-shortcuts) **Minar subtítulo actual y abrir el cuadro de diálogo de Anki** (de forma predeterminada, `Ctrl + Shift + X`).
4. En un vídeo en streaming, haz clic con el botón derecho → asbplayer → **Minar subtítulo**.

:::info
Los métodos 1 y 2 solo abren el cuadro de diálogo si la [acción predeterminada del botón de minado](../reference/settings#mining-button-default-action) está configurada como «Mostrar el cuadro de diálogo de Anki».  
:::

:::info
Cuando se carga una pista de subtítulos _vacía_ y la grabación de audio está activada, todas las acciones anteriores empiezan a grabar audio la primera vez que se activan y abren el cuadro de diálogo de Anki la segunda.
:::

## Ajustar tarjetas {#adjusting-cards}

Antes de exportarlas, puedes ajustar las tarjetas desde el cuadro de diálogo.

### Intervalo de tiempo seleccionado {#selected-time-range}

Puedes cambiar el intervalo de tiempo seleccionado con el **control deslizante** de la parte inferior del cuadro de diálogo.

- El **campo Oración** se actualiza automáticamente para coincidir con el intervalo seleccionado, siempre que no lo hayas editado manualmente.
- En los archivos locales, el clip de audio también se actualiza automáticamente.
- En los vídeos en streaming, puedes volver a grabar el clip de audio con el intervalo seleccionado.

### Campo Audio {#audio-field}

El **campo Audio** muestra el clip de audio grabado y ofrece tres botones de acción:

- **Reproducir/Pausar**: previsualiza el clip de audio directamente en el cuadro de diálogo.
- **Volver a grabar**: graba de nuevo el audio usando el intervalo de tiempo seleccionado (solo para vídeos en streaming; se muestra cuando hay una función de volver a grabar disponible).
- **Descargar**: descarga el clip de audio como archivo en tu dispositivo.

### Campos de texto {#text-fields}

Puedes editar cualquiera de los campos de texto: oración, definición, palabra, campos personalizados, fuente, URL y etiquetas. Normalmente se usa una aplicación de diccionario independiente para rellenar el campo de definición.

### Campo Imagen {#image-field}

En los archivos locales, puedes hacer clic en el **botón de vista previa** <ImageIcon /> del **campo Imagen** para cambiar la marca de tiempo del vídeo de la que se extrae la captura de pantalla.

## Exportar tarjetas {#exporting-cards}

Usa los botones de la parte inferior del cuadro de diálogo para exportar la tarjeta. Hay tres opciones:

1. **Exportar**: exporta una tarjeta con el contenido del cuadro de diálogo.
2. **Actualizar la última tarjeta**: actualiza la última tarjeta de tu mazo de Anki con el contenido del cuadro de diálogo.
3. **Abrir en Anki**: abre el creador de tarjetas de Anki con el contenido del cuadro de diálogo ya rellenado.

## Flujos de creación de tarjetas sin cuadro de diálogo {#dialog-less-mining-flows}

Puedes crear tarjetas sin abrir el cuadro de diálogo de Anki e incluir la definición de la palabra si combinas asbplayer con una aplicación de diccionario que también se integre con Anki. Actualmente, la aplicación de diccionario más popular con esta función es [Yomitan](https://yomitan.wiki/).

### Actualizar la última tarjeta {#update-last-card}

Un flujo para crear tarjetas sin cuadro de diálogo con Yomitan sería así:

1. Con Yomitan, selecciona en los subtítulos la palabra a partir de la que quieras crear una tarjeta.
2. Usa el botón de creación de tarjetas de Yomitan.
3. Inmediatamente después, usa el [atajo de teclado para minar](../reference/settings.md#mining-keyboard-shortcuts) de asbplayer **Actualizar la última tarjeta** (`Ctrl + Shift + U`) para actualizar la tarjeta con el contenido de asbplayer.

La desventaja de este flujo es que, al omitir el cuadro de diálogo, también pierdes la oportunidad de modificar la tarjeta. Sin embargo, puedes evitarlo de estas maneras:

- En lugar de actualizar directamente la última tarjeta en el paso final, puedes usar `Ctrl + Shift + X` para abrir el cuadro de diálogo, ajustar la tarjeta y, por último, **actualizar la última tarjeta** desde la interfaz del cuadro. Así sigues usando el cuadro de diálogo y aprovechas la definición de la palabra que proporciona Yomitan automáticamente.
- También puedes abrir el **cuadro de diálogo de exportación a Anki** _después_ de crear la tarjeta con el [atajo de teclado para minar](../reference/settings.md#mining-keyboard-shortcuts) **Tomar captura de pantalla manualmente** (de forma predeterminada, `Ctrl + Shift + V`).

### Minado con un clic {#one-click}

Consulta la guía de [minado con un clic](./one-click-mining.md).
