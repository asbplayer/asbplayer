---
sidebar_position: 3
---

import project from '@site/src/project';

import CodeBlock from '@theme/CodeBlock'; // Empty fenced code blocks lose their title and copy button; CodeBlock preserves both.

# Filtrar el texto de los subtítulos {#subtitle-text-filtering}

Si quieres filtrar ciertos fragmentos del texto de los subtítulos, puedes usar una expresión regular (regex). asbplayer puede buscar cualquier secuencia que coincida con el patrón especificado y eliminarla.

## Configurar el filtro regex {#configure-the-regex-filter}

En la sección <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Varios</a> de los ajustes de asbplayer, busca el cuadro de texto «Filtro regex de subtítulos». Introduce una expresión regular adecuada para filtrar el contenido deseado.
También puedes reemplazar el contenido filtrado introduciendo una cadena en el cuadro de texto «Texto de reemplazo del filtro regex de subtítulos». Si lo dejas vacío, el contenido simplemente se elimina.

### Eliminar nombres de hablantes {#remove-speaker-names}

Elimina los nombres de los hablantes escritos entre paréntesis (por ejemplo, «**（山田）**　元気ですか？»).

<details>
<summary>Usa este filtro</summary>

```text title="Subtitle regex filter"
([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Conservar las lecturas japonesas {#preserve-japanese-readings}

Elimina nombres o descripciones entre paréntesis y conserva las lecturas japonesas que aparecen inmediatamente después del texto japonés. Por ejemplo, `（山田）漢字(かんじ)を読む。` se convierte en `漢字(かんじ)を読む。`. Se conservan tanto `(かんじ)` como `（かんじ）` si van precedidos inmediatamente por un carácter de los rangos de kanji, hiragana o katakana que aparecen en la expresión regular.

Es una heurística: también conserva descripciones que aparecen inmediatamente después del texto japonés, como `こんにちは（笑）`, y elimina las lecturas separadas del texto base por un espacio. No admite paréntesis anidados. Deja vacío el campo «Texto de reemplazo del filtro regex de subtítulos».

<details>
<summary>Usa este filtro</summary>

```text title="Subtitle regex filter"
(?<![一-龯ぁ-ゟ゠-ヿ])[\(（][^\)）]*[\)）]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Unir líneas de subtítulos {#merge-subtitle-lines}

Algunos subtítulos están divididos en varias líneas. Esta expresión regular las une en una sola. Para que el filtro funcione, también debes escribir `$1 $2` en el campo «Texto de reemplazo del filtro regex de subtítulos».

Si combinas este patrón con otros, colócalo al final para que una alternativa más específica pueda coincidir primero en la misma posición. Las alternativas no se aplican como pasadas de filtrado independientes. Todas las coincidencias usan el mismo texto de reemplazo, y añadir grupos de captura en otras alternativas cambia los números que necesitas en `$1 $2`.

<details>
<summary>Usa este filtro</summary>

```text title="Subtitle regex filter"
(.*)\n+(?!-)(.*)
```

```text title="Subtitle regex filter text replacement"
$1 $2
```

</details>

### Eliminar saltos de línea {#remove-newlines}

Elimina todos los caracteres de salto de línea sin insertar espacios. Por ejemplo, dos líneas con `こんにちは` y `世界` se convierten en `こんにちは世界`. Deja vacío el campo «Texto de reemplazo del filtro regex de subtítulos». Para insertar un espacio entre las líneas, usa el [ejemplo para unir líneas de subtítulos](#merge-subtitle-lines).

<details>
<summary>Usa este filtro</summary>

```text title="Subtitle regex filter"
\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Eliminar descripciones entre corchetes {#remove-bracketed-descriptions}

Elimina las indicaciones entre corchetes que describen sonidos o música (por ejemplo, «**\[MÚSICA ANIMADA]**» o «**\-[Jadeos]**»).

<details>
<summary>Usa este filtro</summary>

```text title="Subtitle regex filter"
-?\[.*\]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Eliminar descripciones en mayúsculas {#remove-uppercase-descriptions}

Como alternativa a lo anterior, filtra las descripciones escritas en mayúsculas y sin corchetes (por ejemplo, «**MÚSICA ANIMADA**»). Si tu idioma tiene letras adicionales con diacríticos, puedes añadirlas a esta lista.

<details>
<summary>Usa este filtro</summary>

```text title="Subtitle regex filter"
^[\-\(\)\.\s\p{Lu}]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Eliminar símbolos de música {#remove-music-symbols}

Cualquier combinación de símbolos que, por sí solos, indiquen que hay música (por ejemplo, `♪♬♪`).

<details>
<summary>Usa este filtro</summary>

```text title="Subtitle regex filter"
[♪♬#～〜]+
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Eliminar indicaciones de efectos de sonido {#remove-sound-effect-cues}

Elimina las indicaciones de subtítulos que contengan únicamente una descripción entre corchetes o símbolos de música, como `[TRUENOS]`, `-[JADEOS]` o `♪♬♪`. Los anclajes `^` y `$` exigen que coincida todo el texto del subtítulo, así que se conserva un diálogo como `Hola [JADEOS]` o `♪ Hola ♪`. Deja vacío el campo «Texto de reemplazo del filtro regex de subtítulos».

<details>
<summary>Usa este filtro</summary>

```text title="Subtitle regex filter"
^-?\[.+\]$|^[♪♬#～〜]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Eliminar marcas de izquierda a derecha {#remove-left-to-right-marks}

Elimina U+200E, la marca invisible de izquierda a derecha (LRM). Por ejemplo, un texto con `Hola`, una LRM y `mundo` se convierte en `Holamundo`. Introduce la secuencia de escape literal `\u200E` en el campo de expresión regular y deja vacío el campo «Texto de reemplazo del filtro regex de subtítulos».

<details>
<summary>Usa este filtro</summary>

```text title="Subtitle regex filter"
\u200E
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Eliminar controles bidireccionales {#remove-bidi-controls}

Elimina todos los caracteres de control bidireccional Unicode, incluidas la marca de izquierda a derecha (U+200E), la marca de derecha a izquierda (U+200F) y los controles de inserción, anulación y aislamiento. Deja vacío el campo «Texto de reemplazo del filtro regex de subtítulos». Estos caracteres pueden afectar al orden de visualización del texto escrito de derecha a izquierda o en ambas direcciones, así que usa este filtro solo si quieres eliminarlos.

<details>
<summary>Usa este filtro</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Combinar expresiones regulares {#combining-regexes}

Puedes combinar expresiones regulares con el carácter `|` (sin necesidad de espacios). Por ejemplo, para usar dos de las expresiones anteriores, puedes escribir `-?\[.*\]|[♪♬#～〜]+`. Puedes combinar tantas expresiones regulares como quieras de esta manera.

### Eliminar texto entre paréntesis y saltos de línea {#remove-parenthesized-text-and-newlines}

Para eliminar a la vez el texto entre paréntesis y todos los saltos de línea, usa:

Deja vacío el campo «Texto de reemplazo del filtro regex de subtítulos». Por ejemplo, `（山田）こんにちは`, seguido de un salto de línea y `世界`, se convierte en `こんにちは世界`. Esto elimina los paréntesis ASCII y de ancho completo, junto con su contenido (incluidas las lecturas japonesas), y une las líneas sin añadir espacios. No admite paréntesis anidados; para esos casos, usa el [ejemplo de nombres de hablantes](#remove-speaker-names).

<details>
<summary>Usa este filtro</summary>

```text title="Subtitle regex filter"
[\(（][^\)）]*[\)）]|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Combinar todos los filtros de eliminación {#combine-all-removal-filters}

Para eliminar también controles bidireccionales, nombres de hablantes entre paréntesis (incluidos los paréntesis anidados), descripciones entre corchetes y símbolos de música, usa:

Deja vacío el campo «Texto de reemplazo del filtro regex de subtítulos». Esto combina los ejemplos de eliminación anteriores y une las líneas sin añadir espacios. También elimina las lecturas japonesas; si quieres conservarlas, usa el [ejemplo que las conserva](#preserve-japanese-readings).

<details>
<summary>Usa este filtro</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}|([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])|-?\[.*\]|[♪♬#～〜]+|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

## Caracteres invisibles y subtítulos vacíos {#invisible-characters}

Un subtítulo que parece vacío puede contener caracteres invisibles, como una LRM. Después de analizar y filtrar los subtítulos, asbplayer descarta las indicaciones de texto que solo contienen espacios en blanco, caracteres de control o caracteres Unicode ignorables de forma predeterminada. Las marcas de dirección dentro de un texto significativo se conservan, a menos que la expresión regular las elimine explícitamente.

Los caracteres invisibles al principio o al final de una indicación pueden impedir que coincida un patrón anclado como `^\[.+\]$`. Si el patrón no coincide, asbplayer vuelve a intentarlo sin los espacios en blanco ni los controles invisibles que lo rodean, pero solo descarta la indicación si el nuevo intento no deja texto significativo. Por ejemplo, con este patrón y un reemplazo vacío se elimina `[TRUENOS]` seguido de una LRM. El segundo intento conserva la indicación original si el reemplazo contiene texto significativo.

Al combinar un patrón anclado con una alternativa que elimina controles bidireccionales, recuerda que los reemplazos se aplican en una sola pasada. Por ejemplo, al aplicar `^\[.+\]$|\u200E` a `[TRUENOS]` seguido de una LRM, se elimina la LRM, pero no se vuelve a intentar eliminar después la descripción entre corchetes. Para eliminar ambos en la misma pasada, usa `\[.+\]|\p{Bidi_Control}` sin anclajes y con un reemplazo vacío. Esto también elimina las descripciones entre corchetes que aparecen en medio del diálogo.

## Más información {#learn}

Aprende a escribir y probar expresiones regulares personalizadas en [Regex Learn - Playground](https://regexlearn.com/playground).
