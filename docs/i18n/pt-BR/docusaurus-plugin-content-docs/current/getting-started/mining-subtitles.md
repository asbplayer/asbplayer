---
sidebar_position: 2
---

import project, { appOrigin } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Minerar legendas {#mining-subtitles}

**Mineração de frases** é o processo de criar cartões de memorização a partir de frases. O asbplayer permite criar cartões de frases de alta qualidade combinando vídeo, áudio e legendas em um único cartão. O asbplayer se integra ao **Anki**, um aplicativo popular de cartões de memorização.

## Configurar o Anki {#setup-anki}

1. Instale o [Anki](https://apps.ankiweb.net/).
2. Adicione o [AnkiConnect](https://ankiweb.net/shared/info/2055492159) ao Anki.
3. Se for minerar a partir de arquivos de vídeo, adicione <code>{appOrigin}</code> a `webCorsOriginList` nas configurações do AnkiConnect:

   <CodeBlock language="json">{JSON.stringify({
     apiKey: null,
     apiLogPath: null,
     ignoreOriginList: [],
     webBindAddress: project.services.ankiConnect.host,
     webBindPort: project.services.ankiConnect.port,
     webCorsOriginList: [appOrigin],
   }, null, 2)}</CodeBlock>

4. Adicione um **baralho**.
5. Adicione um **tipo de nota**.
   Recomendamos criar seu próprio tipo de nota ou usar um já pronto. Para começar rapidamente, siga as etapas abaixo para criar um tipo de nota básico:
   1. Clique em Ferramentas → Gerenciar tipos de nota.
   2. Adicione um tipo de nota "Básico".
   3. Configure os **campos**:
      - Sentence
      - Word
      - Definition
      - Image
      - Audio
      - Source
      - URL
   4. Configure o **cartão**:
      - Frente:
        ```
        {{Sentence}}
        ```
      - Verso:
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

## Configurar o asbplayer {#configure-asbplayer}

1. Abra as <a href={new URL('?view=settings', project.urls.app).href}>configurações do asbplayer</a>.
2. Selecione o **baralho** e o **tipo de nota** que acabou de criar.
3. Para cada campo — **Sentence**, **Definition**, **Word**, **Audio**, **Image**, **Source** e **URL** — selecione o campo correspondente no tipo de nota.

## Instalar um aplicativo de dicionário {#install-a-dictionary-app}

O asbplayer não tem um dicionário integrado. Recomendamos instalar um aplicativo de dicionário para facilitar o preenchimento do campo **Definition** dos cartões. Veja alguns aplicativos populares:

- [Yomitan](https://yomitan.wiki/) é uma extensão para navegador que permite consultar palavras ao passar o cursor sobre elas. Foi criado originalmente para japonês, mas está começando a oferecer suporte a outros idiomas.
- [VocabSieve](https://docs.freelanguagetools.org/) é um aplicativo independente para aprender idiomas, com suporte a idiomas europeus.

## Minerar legendas {#mine-subtitles}

1. [Carregue legendas](./loading-subtitles.md) em qualquer fonte de vídeo.
2. Clique no botão **Minerar legenda** <NoteAddIcon />.
3. Preencha a caixa de diálogo que aparecer e clique em **Exportar**.
