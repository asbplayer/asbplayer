---
sidebar_position: 2
---

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Mining subtitles

**Sentence mining** is the act of creating flashcards out of sentences. asbplayer allows you to create high-quality sentence flashcards by combining video, audio, and subtitles into a single card. asbplayer integrates with **Anki**, a popular flashcard application.

## Setup Anki

1. Install [Anki](https://apps.ankiweb.net/).
2. Add [AnkiConnect](https://ankiweb.net/shared/info/2055492159) to Anki.
3. If mining from video files, add `https://app.asbplayer.dev` to the `webCorsOriginList` in AnkiConnect's settings:
   ```json
   {
     "apiKey": null,
     "apiLogPath": null,
     "ignoreOriginList": [],
     "webBindAddress": "127.0.0.1",
     "webBindPort": 8765,
     "webCorsOriginList": [
       "https://app.asbplayer.dev" // <-- Make sure this line is here
     ]
   }
   ```
4. Add a **Deck**.
5. Add a **Note Type**.
   We encourage you to create your own note type or use a pre-made one. But if you'd like to just get started follow the steps below to create a basic note type:
   1. Click Tools → Manage Note Types.
   2. Add a "Basic" note type.
   3. Configure **Fields**:
      - Sentence
      - Word
      - Definition
      - Image
      - Audio
      - Source
      - URL
   4. Configure **Card**:
      - Front:
        ```
        {{Sentence}}
        ```
      - Back:
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

## Configure asbplayer

1. Open [asbplayer's settings](https://app.asbplayer.dev/?view=settings).
2. Select the **Deck** and **Note Type** you just created.
3. For each of the **Sentence**, **Definition**, **Word**, **Audio**, **Image**, **Source**, and **URL** fields, select the corresponding field in the note type.

## Install a dictionary app

asbplayer does not have a built-in dictionary. We recommend installing a dictionary app to make it easy to fill out the **Definition** field of cards. Below are a couple popular ones:

- [Yomitan](https://yomitan.wiki/) is a browser extension that allows you to lookup words by hovering over them. It was originally made for Japanese, but is beginning to support other languages as well.
- [VocabSieve](https://docs.freelanguagetools.org/) is a standalone language-learning app with support for European languages.

## Mine subtitles

1. [Load subtitles](loading-subtitles) onto any video source.
2. Click the **Mine Subtitle** <NoteAddIcon /> button .
3. Fill out the dialog that appears and click **Export**.
