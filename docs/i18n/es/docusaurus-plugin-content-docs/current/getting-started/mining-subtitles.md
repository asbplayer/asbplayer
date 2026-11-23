---
sidebar_position: 2
---

import project, { appOrigin } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Minar subtítulos {#mining-subtitles}

El **minado de oraciones** consiste en crear tarjetas de memoria a partir de oraciones. asbplayer permite crear tarjetas de oraciones de alta calidad al combinar vídeo, audio y subtítulos en una sola tarjeta. asbplayer se integra con **Anki**, una popular aplicación de tarjetas de memoria.

## Configurar Anki {#setup-anki}

1. Instala [Anki](https://apps.ankiweb.net/).
2. Añade [AnkiConnect](https://ankiweb.net/shared/info/2055492159) a Anki.
3. Si creas tarjetas a partir de archivos de vídeo, añade <code>{appOrigin}</code> a `webCorsOriginList` en los ajustes de AnkiConnect:

   <CodeBlock language="json">{JSON.stringify({
     apiKey: null,
     apiLogPath: null,
     ignoreOriginList: [],
     webBindAddress: project.services.ankiConnect.host,
     webBindPort: project.services.ankiConnect.port,
     webCorsOriginList: [appOrigin],
   }, null, 2)}</CodeBlock>

4. Añade un **mazo**.
5. Añade un **tipo de nota**.
   Te recomendamos crear tu propio tipo de nota o usar uno ya preparado. Si quieres empezar con uno básico, sigue estos pasos:
   1. Haz clic en Herramientas → Administrar tipos de nota.
   2. Añade un tipo de nota «Básico».
   3. Configura los **campos**:
      - Oración
      - Palabra
      - Definición
      - Imagen
      - Audio
      - Fuente
      - URL
   4. Configura la **tarjeta**:
      - Anverso:
        ```
        {{Sentence}}
        ```
      - Reverso:
        ```
        {{FrontSide}}
        <hr id=answer>
        {{Definition}}
        <p/>
        <div class="image">
        {{Image}}
        </div>
        <p/>
        {{Audio}}
        <p/>
        {{Source}}
        <p/>
        {{URL}}
        ```

## Configurar asbplayer {#configure-asbplayer}

1. Abre los <a href={new URL('?view=settings', project.urls.app).href}>ajustes de asbplayer</a>.
2. Selecciona el **mazo** y el **tipo de nota** que acabas de crear.
3. Para cada campo (**oración**, **definición**, **palabra**, **audio**, **imagen**, **fuente** y **URL**), selecciona el campo correspondiente del tipo de nota.

## Instalar una aplicación de diccionario {#install-a-dictionary-app}

asbplayer no incluye un diccionario. Te recomendamos instalar una aplicación de diccionario para rellenar fácilmente el campo **Definición** de las tarjetas. Estas son algunas opciones populares:

- [Yomitan](https://yomitan.wiki/) es una extensión del navegador que permite buscar palabras al pasar el cursor sobre ellas. Se creó originalmente para japonés, pero está empezando a admitir otros idiomas.
- [VocabSieve](https://docs.freelanguagetools.org/) es una aplicación independiente para aprender idiomas que admite lenguas europeas.

## Minar subtítulos {#mine-subtitles}

1. [Carga subtítulos](./loading-subtitles.md) en cualquier fuente de vídeo.
2. Haz clic en el botón **Crear tarjeta del subtítulo** <NoteAddIcon />.
3. Rellena el cuadro de diálogo y haz clic en **Exportar**.
