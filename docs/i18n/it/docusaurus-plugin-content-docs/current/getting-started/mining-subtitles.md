---
sidebar_position: 2
---

import project, { appOrigin } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Creare flashcard da sottotitoli {#mining-subtitles}

La **creazione di flashcard da frasi** consiste nel creare carte a partire da frasi. asbplayer consente di creare flashcard di alta qualità combinando video, audio e sottotitoli in un'unica carta. asbplayer si integra con **Anki**, una popolare applicazione per le flashcard.

## Configurare Anki {#setup-anki}

1. Installa [Anki](https://apps.ankiweb.net/).
2. Aggiungi [AnkiConnect](https://ankiweb.net/shared/info/2055492159) ad Anki.
3. Se crei flashcard da file video, aggiungi <code>{appOrigin}</code> a `webCorsOriginList` nelle impostazioni di AnkiConnect:

   <CodeBlock language="json">{JSON.stringify({
     apiKey: null,
     apiLogPath: null,
     ignoreOriginList: [],
     webBindAddress: project.services.ankiConnect.host,
     webBindPort: project.services.ankiConnect.port,
     webCorsOriginList: [appOrigin],
   }, null, 2)}</CodeBlock>

4. Aggiungi un **Mazzo**.
5. Aggiungi un **Tipo di nota**.
   Ti consigliamo di creare un tipo di nota personalizzato o di usarne uno già pronto. Se vuoi iniziare subito, segui questi passaggi per creare un tipo di nota di base:
   1. Fai clic su Strumenti → Gestisci tipi di nota.
   2. Aggiungi un tipo di nota «Base».
   3. Configura i **Campi**:
      - Sentence
      - Word
      - Definition
      - Image
      - Audio
      - Source
      - URL
   4. Configura la **Carta**:
      - Fronte:
        ```
        {{Sentence}}
        ```
      - Retro:
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

## Configurare asbplayer {#configure-asbplayer}

1. Apri le <a href={new URL('?view=settings', project.urls.app).href}>impostazioni di asbplayer</a>.
2. Seleziona il **Mazzo** e il **Tipo di nota** appena creati.
3. Per ciascuno dei campi **Sentence**, **Definition**, **Word**, **Audio**, **Image**, **Source** e **URL**, seleziona il campo corrispondente nel tipo di nota.

## Installare un'app di dizionario {#install-a-dictionary-app}

asbplayer non include un dizionario. Ti consigliamo di installare un'app di dizionario per compilare facilmente il campo **Definition** delle carte. Eccone alcune molto usate:

- [Yomitan](https://yomitan.wiki/) è un'estensione per browser che permette di cercare le parole passandoci sopra con il puntatore. Inizialmente era stata creata per il giapponese, ma sta iniziando a supportare anche altre lingue.
- [VocabSieve](https://docs.freelanguagetools.org/) è un'app autonoma per l'apprendimento delle lingue che supporta quelle europee.

## Creare flashcard da sottotitoli {#mine-subtitles}

1. [Carica i sottotitoli](./loading-subtitles.md) su una sorgente video.
2. Fai clic sul pulsante **Estrai sottotitolo** <NoteAddIcon />.
3. Compila la finestra di dialogo e fai clic su **Esporta**.
