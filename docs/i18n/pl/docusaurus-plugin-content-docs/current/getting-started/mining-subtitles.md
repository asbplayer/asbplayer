---
sidebar_position: 2
---

import project, { appOrigin } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Kopanie napisów {#mining-subtitles}

**Kopanie zdań** polega na przygotowywaniu fiszek na podstawie zdań. asbplayer pozwala tworzyć wysokiej jakości fiszki ze zdaniami, łącząc wideo, dźwięk i napisy na jednej karcie. asbplayer integruje się z **Anki**, popularną aplikacją do nauki z fiszkami.

## Konfiguracja Anki {#setup-anki}

1. Zainstaluj [Anki](https://apps.ankiweb.net/).
2. Dodaj [AnkiConnect](https://ankiweb.net/shared/info/2055492159) do Anki.
3. Jeśli tworzysz fiszki z plików wideo, dodaj <code>{appOrigin}</code> do pola `webCorsOriginList` w ustawieniach AnkiConnect:

   <CodeBlock language="json">{JSON.stringify({
     apiKey: null,
     apiLogPath: null,
     ignoreOriginList: [],
     webBindAddress: project.services.ankiConnect.host,
     webBindPort: project.services.ankiConnect.port,
     webCorsOriginList: [appOrigin],
   }, null, 2)}</CodeBlock>

4. Dodaj **talię**.
5. Dodaj **typ notatki**.
   Zachęcamy do utworzenia własnego typu notatki lub użycia gotowego. Aby szybko zacząć, wykonaj poniższe kroki i utwórz podstawowy typ notatki:
   1. Kliknij **Narzędzia → Zarządzaj typami notatek**.
   2. Dodaj typ notatki „Podstawowy”.
   3. Skonfiguruj **pola**:
      - Zdanie
      - Słowo
      - Definicja
      - Obraz
      - Dźwięk
      - Źródło
      - URL
   4. Skonfiguruj **kartę**:
      - Przód:
        ```
        {{Sentence}}
        ```
      - Tył:
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

## Konfiguracja asbplayera {#configure-asbplayer}

1. Otwórz <a href={new URL('?view=settings', project.urls.app).href}>ustawienia asbplayera</a>.
2. Wybierz utworzoną **talię** i **typ notatki**.
3. Dla pól **Zdanie**, **Definicja**, **Słowo**, **Dźwięk**, **Obraz**, **Źródło** i **URL** wybierz odpowiadające im pola w typie notatki.

## Instalacja aplikacji słownikowej {#install-a-dictionary-app}

asbplayer nie ma wbudowanego słownika. Zalecamy zainstalowanie aplikacji słownikowej, która ułatwi uzupełnianie pola **Definicja** na kartach. Oto kilka popularnych aplikacji:

- [Yomitan](https://yomitan.wiki/) to rozszerzenie przeglądarki, które pozwala wyszukiwać słowa po najechaniu na nie kursorem. Powstało z myślą o języku japońskim, ale zaczyna obsługiwać także inne języki.
- [VocabSieve](https://docs.freelanguagetools.org/) to samodzielna aplikacja do nauki języków, obsługująca języki europejskie.

## Kopanie napisów {#mine-subtitles}

1. [Wczytaj napisy](./loading-subtitles.md) do dowolnego źródła wideo.
2. Kliknij przycisk **Wykop napis** <NoteAddIcon />.
3. Wypełnij wyświetlone okno dialogowe i kliknij **Eksportuj**.
