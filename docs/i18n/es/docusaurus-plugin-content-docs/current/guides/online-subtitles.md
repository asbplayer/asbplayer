---
sidebar_position: 11
---

import project from '@site/src/project';

# Subtítulos en línea {#online-subtitles}

En lugar de buscar archivos de subtítulos manualmente, puedes buscarlos y cargarlos directamente desde asbplayer. Los subtítulos los proporciona [Jimaku](https://jimaku.cc), un sitio comunitario que contiene sobre todo subtítulos de anime y dramas japoneses.

## Uso {#usage}

1. Abre el panel lateral en una página con un vídeo y haz clic en **Cargar subtítulos**.
2. Haz clic en **Buscar subtítulos en línea** (también está disponible en el menú desplegable de pistas de subtítulos).
3. El término de búsqueda se completa con el título de la página. Modifícalo si es necesario, elige **Anime** o **Drama** y busca.
4. Haz clic en un resultado para ver sus archivos de subtítulos y, después, en un archivo para cargarlo.

Solo se muestran archivos `.srt` y `.ass`. Las obras que hayas abierto recientemente aparecen en **Recientes**, para que puedas omitir la búsqueda la próxima vez.

## Obtener una clave de API de Jimaku {#api-key}

Jimaku requiere una clave de API para buscar y descargar.

1. Crea una cuenta en [jimaku.cc](https://jimaku.cc) e inicia sesión.
2. Abre la [página de tu cuenta](https://jimaku.cc/account) y genera una clave de API.
3. Pega la clave en el campo **Clave de API de Jimaku** del cuadro de búsqueda.

La clave se guarda automáticamente, así que solo tienes que hacerlo una vez. Está oculta de forma predeterminada; pulsa el icono del ojo para mostrarla.

## Detección automática de episodios {#episode-detection}

En el caso de las series, asbplayer intenta leer el número del episodio en el título de la página (por ejemplo, `S01E05`, `EP05` o `第5話`/`第五集`). Si encuentra uno:

- elimina el indicador del episodio del término de búsqueda, así que solo se busca el nombre de la serie;
- filtra la lista de archivos para mostrar ese episodio, indicado con una etiqueta **EP N**. Haz clic en la ✕ de la etiqueta para ver todos los archivos.

Si el episodio seleccionado no tiene archivos de subtítulos válidos, se muestra la lista completa.

### Expresión regular personalizada para episodios {#episode-regex}

Algunos sitios web usan formatos de título que las reglas integradas no reconocen. En ese caso, no se detecta ningún episodio y se muestran todos los archivos de la serie. Una expresión regular personalizada permite a asbplayer leer el episodio en esos sitios.

Después de abrir una serie, haz clic en el icono de engranaje junto al encabezado de la lista de archivos para mostrar el campo **Expresión regular personalizada para episodios**. El engranaje se resalta cuando hay una expresión regular configurada.

- El **grupo de captura 1** debe contener el número del episodio (se aceptan números arábigos y kanji).
- La expresión regular se prueba primero. Si está vacía, no es válida o no coincide, se usan las reglas integradas habituales; por tanto, solo puede ampliar la cobertura.
- Pulsa **Enter** para volver a filtrar la serie actual. El término de búsqueda incorporará el cambio la próxima vez que abras el cuadro de diálogo.

:::tip
Las reglas integradas solo se probaron en los pocos sitios web que usa quien creó esta función. Si no se reconoce el formato del título de un sitio, <a href={`${project.urls.repo}/issues`}>abre una incidencia</a> con un ejemplo del título de una página (o un PR para `common/subtitle-sources/jimaku-episode-patterns.ts`) para ampliar las reglas integradas.
:::

Por ejemplo, si un sitio titula sus páginas `Some Show - Chapter 07 | SiteName`, usa:

```
Chapter (\d+)
```

## Agradecimientos {#jimaku-acknowledgements}

Muchas gracias a [Rapptz](https://github.com/Rapptz), quien creó y mantiene [Jimaku](https://github.com/Rapptz/jimaku) y proporciona la API que hace posible esta función. Si te resulta útil, considera apoyar el sitio y subir tus propios subtítulos.
