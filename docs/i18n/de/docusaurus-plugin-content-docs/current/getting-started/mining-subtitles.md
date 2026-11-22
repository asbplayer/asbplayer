---
sidebar_position: 2
---

import project, { appOrigin } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Untertitel auswerten {#mining-subtitles}

Beim **Sentence Mining** werden aus Sätzen Lernkarten erstellt. Mit asbplayer können Sie hochwertige Satzkarten erstellen, indem Sie Video, Audio und Untertitel auf einer Karte kombinieren. asbplayer lässt sich in **Anki**, ein beliebtes Lernkartenprogramm, integrieren.

## Anki einrichten {#setup-anki}

1. Installieren Sie [Anki](https://apps.ankiweb.net/).
2. Fügen Sie [AnkiConnect](https://ankiweb.net/shared/info/2055492159) zu Anki hinzu.
3. Wenn Sie Videos aus Dateien auswerten, fügen Sie <code>{appOrigin}</code> in den AnkiConnect-Einstellungen zur Liste `webCorsOriginList` hinzu:

   <CodeBlock language="json">{JSON.stringify({
     apiKey: null,
     apiLogPath: null,
     ignoreOriginList: [],
     webBindAddress: project.services.ankiConnect.host,
     webBindPort: project.services.ankiConnect.port,
     webCorsOriginList: [appOrigin],
   }, null, 2)}</CodeBlock>

4. Fügen Sie ein **Deck** hinzu.
5. Fügen Sie einen **Notiztyp** hinzu.
   Wir empfehlen, einen eigenen Notiztyp zu erstellen oder einen vorgefertigten zu verwenden. Wenn Sie direkt loslegen möchten, folgen Sie diesen Schritten, um einen einfachen Notiztyp anzulegen:
   1. Klicken Sie auf Werkzeuge → Notiztypen verwalten.
   2. Fügen Sie den Notiztyp „Einfach“ hinzu.
   3. Richten Sie die **Felder** ein:
      - Satz
      - Wort
      - Definition
      - Bild
      - Audio
      - Quelle
      - URL
   4. Richten Sie die **Karte** ein:
      - Vorderseite:
        ```
        {{Sentence}}
        ```
      - Rückseite:
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

## asbplayer konfigurieren {#configure-asbplayer}

1. Öffnen Sie die <a href={new URL('?view=settings', project.urls.app).href}>Einstellungen von asbplayer</a>.
2. Wählen Sie das **Deck** und den **Notiztyp**, die Sie gerade erstellt haben.
3. Wählen Sie für jedes Feld **Satz**, **Definition**, **Wort**, **Audio**, **Bild**, **Quelle** und **URL** das entsprechende Feld im Notiztyp aus.

## Wörterbuch-App installieren {#install-a-dictionary-app}

asbplayer enthält kein integriertes Wörterbuch. Wir empfehlen, eine Wörterbuch-App zu installieren, damit Sie das Feld **Definition** auf Karten leicht ausfüllen können. Beliebte Optionen sind:

- [Yomitan](https://yomitan.wiki/) ist eine Browsererweiterung, mit der Sie Wörter untersuchen können, indem Sie mit dem Mauszeiger darüberfahren. Sie wurde ursprünglich für Japanisch entwickelt und unterstützt inzwischen auch andere Sprachen.
- [VocabSieve](https://docs.freelanguagetools.org/) ist eine eigenständige Sprachlern-App mit Unterstützung für europäische Sprachen.

## Untertitel auswerten {#mine-subtitles}

1. [Laden Sie Untertitel](./loading-subtitles.md) für eine beliebige Videoquelle.
2. Klicken Sie auf die Schaltfläche **Untertitel auswerten** <NoteAddIcon />.
3. Füllen Sie den angezeigten Dialog aus und klicken Sie auf **Exportieren**.
