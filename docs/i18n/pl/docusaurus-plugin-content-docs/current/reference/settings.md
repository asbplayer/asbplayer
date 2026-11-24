---
sidebar_position: 1
---

import project from '@site/src/project';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Ustawienia {#settings}

## <a href={new URL('?view=settings#anki-settings', project.urls.app).href}>Anki</a> {#anki}

### URL AnkiConnect {#ankiconnect-url}

Adres URL serwera AnkiConnect działającego jako dodatek w Anki.

### Klucz API AnkiConnect {#ankiconnect-api-key}

Klucz API skonfigurowany w AnkiConnect, gdy włączono ochronę kluczem API.

### Odświeżanie przeglądarki kart Anki po ich aktualizacji {#refresh-anki-card-browser}

Po włączeniu tej opcji otwarta przeglądarka kart Anki zostaje odświeżona po aktualizacji karty przez asbplayera, dzięki czemu pola wyświetlają aktualne wartości. Okno przeglądarki kart może zostać przeniesione na pierwszy plan. Domyślnie ta opcja jest wyłączona.

### Talia {#deck}

Talia Anki, do której są wysyłane karty.

### Typ notatki {#note-type}

Typ notatki Anki używany dla kart. Określa on „model” i „widok” kart, a dokładniej zestaw pól oraz szablon HTML decydujący o sposobie wyświetlania tych pól na przodzie i odwrocie karty.

### Pola karty {#card-fields}

Każde ustawienie pola karty określa, jaka treść trafia do danego pola skonfigurowanego typu notatki. **Etykieta pola** — Zdanie, Definicja, Słowo, Obraz, Dźwięk lub URL — oznacza **treść**, a **wartość pola** to **pole w typie notatki**.

Pola pojawią się w **oknie dialogowym Eksport Anki** w takiej kolejności, w jakiej występują w ustawieniach. Możesz zmienić ich kolejność za pomocą **menu ⋮** → **Przenieś w dół** lub **Przenieś w górę**.

| Pole                  | Zawartość                                          |
| --------------------- | -------------------------------------------------- |
| Zdanie (wszystkie ścieżki) | Wszystkie napisy z chwili kopania fiszki       |
| Definicja             | Definicja słowa podana przez użytkownika            |
| Słowo                 | Słowo podane przez użytkownika                     |
| Dźwięk                | Dźwięk nagrany ze źródła wideo                     |
| Obraz                 | Zrzut ekranu ze źródła wideo                       |
| Źródło                | Plik z napisami lub nazwa i znacznik czasu wideo   |
| URL                   | Bieżący URL, jeśli fiszka pochodzi z wideo strumieniowego |
| Ścieżka napisów 1     | Napisy ze ścieżki 1 z chwili kopania fiszki      |
| Ścieżka napisów 2     | Napisy ze ścieżki 2 z chwili kopania fiszki      |
| Ścieżka napisów 3     | Napisy ze ścieżki 3 z chwili kopania fiszki      |
| Pola niestandardowe   | Wartości podane przez użytkownika                  |

### Tagi {#tags}

Domyślne tagi dodawane do każdej karty.

## <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>Kopanie</a> {#mining}

### Domyślna czynność przycisku kopania {#mining-button-default-action}

„Przycisk kopania fiszki” <NoteAddIcon/> oznacza skrajny lewy przycisk w **nakładce sterowania** oraz przycisk obok napisów na **liście napisów**. To ustawienie określa działanie tych przycisków.

| Ustawienie             | Działanie                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pokaż okno Anki        | Zapisz wybrany napis w historii kopania i wyświetl **okno dialogowe Eksport Anki**                                                                                                                               |
| Zaktualizuj ostatnią kartę | Zapisz wybrany napis w historii i uzupełnij ostatnią kartę w wybranej talii o kontekst z asbplayera — wszystkie pola poza definicją, słowem i polami niestandardowymi podanymi przez użytkownika |
| Pokaż okno aktualizacji karty | Zapisz wybrany napis w historii i wyświetl okno aktualizacji ostatniej karty o kontekst z asbplayera                                                                                |
| Eksportuj kartę         | Zapisz wybrany napis w historii i wyeksportuj kartę _tylko_ z kontekstem asbplayera — wszystkimi polami poza definicją, słowem i polami niestandardowymi podanymi przez użytkownika                            |
| Brak                   | Zapisz wybrany napis w historii kopania                                                                                                                                                               |

### Stan odtwarzania po utworzeniu fiszki {#post-mining-playback-state}

Określa żądany stan odtwarzania po uruchomieniu czynności kopania.

### Kopiowanie napisów do schowka podczas kopania {#copy-mined-subtitles-to-clipboard}

Po włączeniu tej opcji wybrany napis jest kopiowany do schowka przy każdym uruchomieniu czynności kopania.

### Zawsze używaj tekstu napisów w polu zdania {#always-use-subtitle-text-for-sentence-field}

Po włączeniu tej opcji pole Zdanie jest wypełniane tekstem napisu ze wszystkich ścieżek, z którego tworzysz fiszkę, nawet jeśli aplikacja zewnętrzna dostarczy inny tekst zdania. Przydaje się to podczas [kopania z Yomitanem](../guides/one-click-mining.md).

### Podczas aktualizowania ostatniej karty aktualizuj też zdanie na kartach z tym samym tekstem napisów {#update-sentence-for-cards-with-the-same-subtitle-text}

Po włączeniu tej opcji czynność **Zaktualizuj ostatnią kartę** zastępuje również pole Zdanie i skonfigurowane pola Ścieżka napisów 1–3 w kolejnych notatkach, których dotychczasowe zdanie jest zgodne ze zdaniem eksportowanym. Aktualizacja próbuje zachować wyróżnienia każdej notatki. Pola ścieżek bez eksportowanego tekstu pozostają bez zmian. Jeśli pole napisów korzysta z tego samego pola Anki co pole niezwiązane z napisami, np. Definicja, aktualizacja zdania pozostawia to pole bez zmian we wcześniejszych notatkach.

To ustawienie kopiuje zdanie wybrane do bieżącego eksportu. Włącz [**Zawsze używaj tekstu napisów w polu zdania**](#always-use-subtitle-text-for-sentence-field), aby używać pełnego tekstu wydobytych napisów. [Aktualizacja obrazu i dźwięku](#update-all-cards-with-the-same-subtitle-text) działa niezależnie.

Dopasowanie korzysta z głównego pola Zdanie, ignoruje jego znaczniki i uznaje dopasowanie, gdy jedno zdanie zawiera się w drugim. Dlatego notatka zawierająca tylko pierwszy wiersz może pasować do całych napisów. Wyszukiwanie obejmuje notatki dodane w ciągu ostatnich dwóch dni Anki i kończy się na pierwszym innym lub brakującym zdaniu. Do aktualizacji pól ścieżek również wymagane jest skonfigurowane pole zdania i niepuste zdanie eksportowane. Domyślnie ta opcja jest wyłączona i nie wpływa na aktualizację konkretnej, wybranej karty.

### Przy aktualizacji ostatniej karty aktualizuj też obraz i dźwięk kart z tym samym tekstem napisu {#update-all-cards-with-the-same-subtitle-text}

Po włączeniu tej opcji czynność **Zaktualizuj ostatnią kartę** aktualizuje również pola dźwięku i obrazu w kolejnych notatkach utworzonych na podstawie tego samego wiersza napisów. Każda wcześniejsza notatka zachowuje swoje słowo, definicję i pola niestandardowe. Jej pola napisów pozostają bez zmian, chyba że włączono też [aktualizację zdania](#update-sentence-for-cards-with-the-same-subtitle-text). Podczas dopasowywania pomijane jest formatowanie zdania, a samo zdanie może stanowić część kontekstu napisu użytego do ukopania fiszki.

Wyszukiwanie obejmuje notatki dodane w ciągu ostatnich dwóch dni Anki i kończy się na pierwszym innym lub brakującym zdaniu. Pole zdania musi być skonfigurowane, a eksportowane zdanie musi zawierać tekst, nie tylko białe znaki lub znaczniki. Domyślnie ta opcja jest wyłączona i nie wpływa na aktualizację konkretnej, wybranej karty.

### Odtwarzaj dźwięk podczas nagrywania z lokalnego wideo {#play-audio-while-recording-from-local-video}

asbplayer używa wbudowanego w przeglądarkę interfejsu API [MediaRecorder](https://developer.mozilla.org/ja/docs/Web/API/MediaRecorder) do nagrywania dźwięku z lokalnych plików wideo. To ustawienie określa, czy dźwięk ma być odtwarzany podczas nagrywania.

### Ponownie koduj dźwięk do formatu mp3 {#re-encode-audio-as-mp3}

Domyślnie nagrany dźwięk nie jest kodowany jako `mp3`. To ustawienie powoduje ponowne zakodowanie dźwięku do formatu `mp3`. Zwykle nie ma powodu, aby je wyłączać, zwłaszcza jeśli chcesz przeglądać karty na iOS.

### Początkowy margines dźwięku {#audio-padding-start}

Ile milisekund **przed** wybranym napisem należy rozpocząć nagrywanie dźwięku.

### Końcowy margines dźwięku {#audio-padding-end}

Ile milisekund **po** wybranym napisie należy zakończyć nagrywanie dźwięku.

### Format przechwytywanego obrazu (tylko strona) {#image-capture-format}

Określa format obrazu przechwytywanego do tworzonych fiszek. Dostępne tylko na stronie dla lokalnych plików wideo. Jedyną dodatkową opcją jest „klip wideo”.

### Maksymalna szerokość/wysokość przechwytywania {#max-capture-dimensions}

Maksymalna szerokość i wysokość zrzutów ekranu w pikselach. `0` oznacza „bez limitu”.

### Przycinaj czarne pasy na zrzutach ekranu {#trim-black-bars-from-screenshots}

Po włączeniu tej opcji zrzuty ekranu są przycinane, aby usunąć czarne pasy dodane przy letterboxingu.

### Przycinanie początku/końca klipu {#clip-trim-start-end}

Określa, ile czasu odjąć od początku i końca przedziału czasowego napisu przy ustalaniu domyślnego czasu trwania klipu wideo. Dostępne tylko po wybraniu klipu wideo jako formatu przechwytywanego obrazu.

### Maksymalna długość klipu {#max-clip-length}

Określa maksymalną długość klipu wideo. Dostępne tylko po wybraniu klipu wideo jako formatu przechwytywanego obrazu.

### Opóźnienie wykonywania zrzutu ekranu {#screenshot-capture-delay}

Jak długo odczekać od pojawienia się wybranego napisu do wykonania zrzutu ekranu.

### Promień liczby sąsiednich napisów {#surrounding-subtitles-count-radius}

U dołu **okna eksportu Anki** znajduje się suwak do zmiany wybranego przedziału czasu. Suwak uwzględnia sąsiednie napisy jako dodatkowy kontekst. To ustawienie określa maksymalną liczbę tych napisów.

### Promień czasu sąsiednich napisów {#surrounding-subtitles-time-radius}

U dołu **okna eksportu Anki** znajduje się suwak do zmiany wybranego przedziału czasu. Suwak uwzględnia sąsiednie napisy jako dodatkowy kontekst. To ustawienie określa dopuszczalny przedział czasu wokół wybranego napisu dla tych napisów.

## <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>Wygląd napisów</a> {#subtitle-appearance}

### Ścieżka napisów {#subtitle-appearance-track}

asbplayer może wczytać jednocześnie kilka ścieżek napisów. Ta lista pozwala wybrać ścieżkę lub ścieżki, do których będą stosowane poniższe ustawienia. Domyślnie wybrane są „Wszystkie”. Zmiana ustawienia wyglądu przy wybranej opcji „Wszystkie” modyfikuje je dla wszystkich ścieżek jednocześnie. Gdy ustawisz wartość dla konkretnej ścieżki, to ustawienie zniknie ze strony „Wszystkie”.

### Podgląd napisów {#subtitle-preview}

Wyświetl podgląd i edytuj tekst używany do prezentacji ustawień wyglądu napisów.

### Stylizacja {#styling}

| Ustawienie                        | Opis                                                                                 | Właściwość CSS              |
| --------------------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| Kolor napisów                     | Kolor                                                                                | `color`                     |
| Rozmiar napisów                   | Rozmiar w `px`                                                                         | `font-size`                 |
| Grubość czcionki napisów          | Grubość czcionki                                                                       | `font-weight`               |
| Kolor obramowania napisów         | Kolor obrysu                                                                  | `-webkit-text-stroke-color` |
| Grubość obramowania napisów       | Grubość obrysu                                                              | `-webkit-text-stroke-width` |
| Kolor cienia napisów              | Kolor cienia                                                                  | `text-shadow`               |
| Grubość cienia napisów            | Grubość cienia                                                              | `text-shadow`               |
| Kolor tła napisów                 | Kolor tła                                                                     | `background-color`          |
| Krycie tła napisów                | Krycie tła                                                                   | `background`                |
| Krój czcionki napisów             | Czcionka. Lista dostępnych czcionek pojawia się po przyznaniu dostępu do czcionek lokalnych.       | `font-family`               |
| CSS:\<style key\>              | Wartość tekstowa niestandardowej właściwości CSS dodanej za pomocą listy **Dodaj własny CSS**. | Właściwość niestandardowa  |
| Rozmycie napisów                  | Rozmywa napisy. Najechanie kursorem usuwa rozmycie.                                | `filter:blur(...)`          |
| Współczynnik skali napisów obrazowych | Zmienia skalę napisów obrazowych.                                                        | —                           |

### Układ {#layout}

| Ustawienie                           | Opis                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Wyrównanie napisów                  | Określa, czy napisy umieścić u góry, czy u dołu elementu wideo.        |
| Przesunięcie napisów od dołu        | Odległość wszystkich dolnych ścieżek napisów od dołu elementu wideo. |
| Przesunięcie napisów od góry        | Odległość wszystkich górnych ścieżek napisów od góry elementu wideo.       |
| Szerokość napisów                   | Szerokość kontenera napisów w `%` lub pikselach.                               |

## <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>Skróty klawiszowe</a> {#keyboard-shortcuts}

Skróty klawiszowe umożliwiają korzystanie z większości funkcji asbplayera.

### <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>Napisy</a> — skróty klawiszowe {#subtitles-keyboard-shortcuts}

| Działanie                            | Domyślny skrót     |
| ------------------------------------ | ---------------- |
| Wybierz ścieżki napisów do wczytania. | Ctrl + Shift + F |
| Przełącz napisy                      | ↓                |
| Przełącz ścieżkę napisów 1 w wideo   | 1                |
| Przełącz ścieżkę napisów 2 w wideo   | 2                |
| Przełącz ścieżkę napisów 3 w wideo   | 3                |
| Przełącz ścieżkę napisów 1 w asbplayerze | W + 1         |
| Przełącz ścieżkę napisów 2 w asbplayerze | W + 2         |
| Przełącz ścieżkę napisów 3 w asbplayerze | W + 3         |
| Usuń rozmycie ścieżki napisów 1 w asbplayerze | B + 1    |
| Usuń rozmycie ścieżki napisów 2 w asbplayerze | B + 2    |
| Usuń rozmycie ścieżki napisów 3 w asbplayerze | B + 3    |
| Przesuń dolne napisy w górę           |                  |
| Przesuń dolne napisy w dół            |                  |
| Przesuń górne napisy w górę           |                  |
| Przesuń górne napisy w dół            |                  |

### <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>Kopanie</a> — skróty klawiszowe {#mining-keyboard-shortcuts}

| Działanie                                                                            | Domyślny skrót              |
| ------------------------------------------------------------------------------------ | -------------------------- |
| Wykop bieżący napis                                                    | Ctrl + Shift + Z (strona)   |
| Wykop bieżący napis i otwórz okno Anki                                 | Ctrl + Shift + X            |
| Zaktualizuj ostatnią kartę Anki o zrzut ekranu, dźwięk itp. z asbplayera            | Ctrl + Shift + U            |
| Wyeksportuj kartę do Anki bez otwierania okna dialogowego.                          |                             |
| Ręcznie wykonaj zrzut ekranu zamiast zrzutu tworzonego automatycznie przy fiszce    | Ctrl + Shift + V (strona)   |
| Ręcznie rozpocznij/zakończ nagrywanie dźwięku, nawet gdy wczytano plik z napisami.  | Ctrl + Shift + R (strona)   |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Odtwarzanie</a> — skróty klawiszowe {#playback-keyboard-shortcuts}

| Działanie                       | Domyślny skrót    |
| ------------------------------- | ---------------- |
| Przełącz panel boczny           | \`               |
| Odtwórz/wstrzymaj               | Spacja            |
| Przełącz automatyczną pauzę     | Shift + P         |
| Przełącz odtwarzanie skondensowane | Shift + O      |
| Przełącz przyspieszone odtwarzanie | Shift + F      |
| Przełącz tryb powtarzania       | Shift + R         |
| Przełącz wyświetlanie napisów   |                   |
| Zmień tryb wznawiania po automatycznej pauzie |       |
| Przejdź do następnego przepisu  |                   |
| Przejdź do poprzedniego przepisu |                  |
| Przełącz przepis 1              |                   |
| Przełącz przepis 2              |                   |
| Przełącz przepis 3              |                   |
| Przełącz przepis 4              |                   |
| Przełącz przepis 5              |                   |
| Przełącz przepis 6              |                   |
| Przełącz przepis 7              |                   |
| Przełącz przepis 8              |                   |
| Przełącz przepis 9              |                   |
| Przełącz przepis 10             |                   |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Przewijanie</a> — skróty klawiszowe {#seek-keyboard-shortcuts}

| Działanie                                                                 | Domyślny skrót    |
| ------------------------------------------------------------------------- | ---------------- |
| Przewiń wstecz (domyślnie 3 sekundy, [konfigurowalne](#seek-interval-seconds)) | A             |
| Przewiń do przodu (domyślnie 3 sekundy, [konfigurowalne](#seek-interval-seconds)) | D          |
| Przejdź do poprzedniego napisu                                             | ←                |
| Przejdź do następnego napisu                                               | →                |
| Przejdź do początku bieżącego/poprzedniego napisu                            | ↑                |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Prędkość odtwarzania</a> — skróty klawiszowe {#playback-rate-keyboard-shortcuts}

| Działanie              | Domyślny skrót    |
| ---------------------- | ---------------- |
| Zwiększ prędkość odtwarzania | Ctrl + Shift + ] |
| Zmniejsz prędkość odtwarzania | Ctrl + Shift + [ |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Przesunięcie napisów</a> — skróty klawiszowe {#subtitle-offset-keyboard-shortcuts}

| Działanie                                                                | Domyślny skrót    |
| ------------------------------------------------------------------------ | ---------------- |
| Dopasuj przesunięcie, aby poprzedni napis odpowiadał bieżącemu znacznikowi czasu | Ctrl + ← |
| Dopasuj przesunięcie, aby następny napis odpowiadał bieżącemu znacznikowi czasu  | Ctrl + → |
| Zwiększ przesunięcie napisów o +100ms                                     | Ctrl + Shift + ← |
| Zmniejsz przesunięcie napisów o -100ms                                     | Ctrl + Shift + → |
| Wyzeruj przesunięcie napisów                                              | Ctrl + Shift + ↓ |

### <a href={new URL('?view=settings#annotation', project.urls.app).href}>Adnotacje</a> — skróty klawiszowe {#annotation-keyboard-shortcuts}

| Działanie                         | Domyślny skrót    |
| --------------------------------- | ---------------- |
| Otwórz statystyki                  | Q + S             |
| Przejdź do następnego słowa         | Q + E             |
| Przejdź do poprzedniego słowa       | Q + W             |
| Oznacz wskazane słowo jako Dojrzałe | Q + 5             |
| Przejdź do następnego Dojrzałego słowa |                |
| Przejdź do poprzedniego Dojrzałego słowa |              |
| Oznacz wskazane słowo jako Młode   | Q + 4             |
| Przejdź do następnego Młodego słowa |                 |
| Przejdź do poprzedniego Młodego słowa |               |
| Oznacz wskazane słowo jako Ukończone | Q + 3           |
| Przejdź do następnego Ukończonego słowa |              |
| Przejdź do poprzedniego Ukończonego słowa |            |
| Oznacz wskazane słowo jako W trakcie nauki | Q + 2       |
| Przejdź do następnego słowa W trakcie nauki |             |
| Przejdź do poprzedniego słowa W trakcie nauki |           |
| Oznacz wskazane słowo jako Nieznane | Q + 1           |
| Przejdź do następnego Nieznanego słowa |               |
| Przejdź do poprzedniego Nieznanego słowa |             |
| Oznacz wskazane słowo jako Niezebrane | Q + 0          |
| Przejdź do następnego Niezebranego słowa |              |
| Przejdź do poprzedniego Niezebranego słowa |            |
| Przełącz status wskazanego słowa na Zignorowane | Q + I  |
| Przejdź do następnego Zignorowanego słowa |              |
| Przejdź do poprzedniego Zignorowanego słowa |            |

### Odstęp przewijania (sekundy) {#seek-interval-seconds}

Określa odstęp używany przez [skróty klawiszowe przewijania](#seek-keyboard-shortcuts).

### Zawsze odtwarzaj po użyciu opcji „Przejdź do początku bieżącego/poprzedniego napisu” {#always-play-on-subtitle-seek}

Po użyciu [skrótu przewijania](#seek-keyboard-shortcuts), który przechodzi do początku bieżącego lub poprzedniego napisu, zawsze rozpoczyna odtwarzanie zamiast zachowywać bieżący stan. Pozwala to oszczędzić jedno naciśnięcie klawisza.

### Krok zmiany prędkości odtwarzania {#playback-speed-adjust-step}

Wartość zmiany prędkości używana przez [skróty klawiszowe](#playback-rate-keyboard-shortcuts) „Zwiększ/zmniejsz prędkość odtwarzania”.

### Skróty rozszerzenia {#extension-shortcuts}

Po zainstalowaniu rozszerzenia przeglądarki niektóre skróty kopania (np. kopanie fiszki z bieżącego napisu lub otwieranie okna Anki) są realizowane jako polecenia przeglądarki, a nie zwykłe nasłuchiwanie zdarzeń klawiatury. Można je edytować tylko w edytorze skrótów rozszerzeń przeglądarki.

- Chrome: `chrome://extensions/shortcuts`
- Firefox: `about:addons` → `Zarządzaj skrótami rozszerzeń`

## <a href={new URL('?view=settings#annotation', project.urls.app).href}>Adnotacje</a> {#annotation}

### Przeglądarka słów {#word-browser}

:::info
Można edytować i usuwać tylko słowa lokalne. Źródła zewnętrzne są tylko do odczytu i można je aktualizować wyłącznie przez [synchronizację](#re-build-anki-word-database).
:::

Otwiera przeglądarkę słów, w której można wyświetlać słowa z lokalnej bazy i bazy synchronizowanej z Anki oraz nimi zarządzać.

:::tip
Możesz wyszukiwać słowa zapisane dowolnym pismem używanym w danym języku (np. romaji, hiraganą, katakaną lub kanji w języku japońskim).

Automatycznie wykonywane są też popularne zamiany poprawiające wygodę, takie jak `e -> é` lub `ss -> ß`.
:::

### Importowanie słów {#import-words}

Importuje słowa do **lokalnej bazy słów** asbplayera.

Zaimportowane słowa są traktowane jako lokalne i podczas określania statusu mają pierwszeństwo przed źródłami zewnętrznymi.

Okno importowania umożliwia wklejenie dowolnego tekstu (asbplayer podzieli go na słowa) oraz zaimportowanie wcześniej wyeksportowanych plików.

:::tip
Możesz najechać kursorem na słowa i zmienić ich lokalny status za pomocą [skrótów klawiszowych adnotacji](#annotation-keyboard-shortcuts).
:::

### Eksportowanie słów {#export-words}

Eksportuje lokalną bazę słów, aby można ją było zarchiwizować, przenieść na inne urządzenie lub współdzielić między stroną a rozszerzeniem.

### Odbuduj bazę słów Anki {#re-build-anki-word-database}

Tworzy lub odbudowuje lokalną pamięć podręczną statusów słów pobranych z Anki.

:::tip
Pamięć podręczna jest też automatycznie aktualizowana podczas odtwarzania, jeśli ścieżka jest włączona i można połączyć się z Anki.

Ten przycisk jest nieaktywny, chyba że ustawienia adnotacji [korzystają z integracji z Anki](../common-issues.md#enable-or-disable-annotation-for-a-track).

Aby usunąć wpisy ścieżki z bazy słów Anki, [wykonaj te kroki](../common-issues.md#clear-anki-word-database).
:::

### Odbuduj bazę słów WaniKani {#re-build-wanikani-word-database}

Tworzy lub odbudowuje lokalną pamięć podręczną słownictwa pobranego z WaniKani.

:::tip
Pamięć podręczna jest też automatycznie aktualizowana podczas odtwarzania, jeśli ścieżka jest włączona i skonfigurowano token.

Ten przycisk jest nieaktywny, chyba że ustawienia adnotacji [korzystają z integracji z WaniKani](../common-issues.md#enable-or-disable-annotation-for-a-track).

Aby usunąć wpisy ścieżki z bazy słów WaniKani, [wykonaj te kroki](../common-issues.md#clear-wanikani-word-database).
:::

### Ścieżka napisów {#annotation-track}

Wybiera ścieżkę napisów, do której odnoszą się te ustawienia adnotacji.

### Koloruj napisy na podstawie znanych słów {#colorize-subtitles-based-on-known-words}

Włącza stylizację zależną od statusu słów (niezebrane, nieznane, w trakcie nauki itp.). Stylizacja korzysta z ustawień [**Styl koloru słów**](#word-color-style) i [**Kolory statusów słów**](#word-status-colors).

### Automatycznie generuj statystyki {#generate-statistics-automatically}

Automatycznie generuje statystyki bieżących multimediów po ich wczytaniu. Włącza też nakładkę statystyk. Skrót klawiszowy [Otwórz statystyki](#annotation-keyboard-shortcuts) znajduje się w grupie Adnotacje.

### Wyświetlaj odczyty słów {#display-word-readings}

Wyświetla nad słowami odczyty (np. furiganę) zależnie od ich statusów i stanów.

### Wyświetlaj częstotliwość słów {#display-word-frequency}

Wyświetla pod słowami wartość częstotliwości opartą na rankingu (jeśli jest dostępna), zależnie od statusów i stanów. Pomaga to ustalić, których słów warto uczyć się w pierwszej kolejności.

:::tip
Informacje o częstotliwości wymagają co najmniej jednego słownika częstotliwości opartego na rankingu w instancji Yomitan. Jeśli słownik nie określa swojego trybu, asbplayer spróbuje ustalić, czy jest oparty na rankingu, i odpowiednio go użyje.

Jeśli dla słowa dostępnych jest kilka wartości częstotliwości, używana jest najniższa (czyli najczęściej występujące słowo).
:::

### Wyświetlaj akcent wyrazowy (japoński) {#display-pitch-accent-japanese}

:::note
Aby zobaczyć akcent wyrazowy przy furiganie, włącz opcję [**Wyświetlaj odczyty słów**](#display-word-readings).
:::

Wyświetla akcent wyrazowy na furiganie lub samych znakach kana, zależnie od statusów i stanów.

:::info
Jeśli dane są dostępne, akcent wyrazowy partykuły dołączonej do słowa jest określany na podstawie akcentu tego słowa.

Zazwyczaj furiganę otrzymują tylko znaki kanji, ale po włączeniu tej funkcji furiganę otrzymają wszystkie znaki słowa, jeśli przynajmniej jeden z nich jest kanji. Ułatwia to odczyt akcentu wyrazowego w złożonych słowach.
:::

### Wyświetlaj definicje słów {#display-word-definitions}

Określa, czy przy każdym słowie wyświetlać krótką definicję lub objaśnienie zależnie od jego statusu i stanów.

### Strategia wyszukiwania w polu słowa {#word-field-search-strategy}

Określa, jak asbplayer dopasowuje słowa z napisów do słów uznawanych za znane.

- **Zebrana dokładna forma**: pole musi zawierać dokładną formę widoczną w napisach (running -> running).
- **Zebrana forma podstawowa**: musi być zebrana forma podstawowa (running -> run).
- **Zebrana forma podstawowa lub dokładna**: słowo uznaje się za zebrane, jeśli pasuje forma podstawowa lub dokładna (dowolna z powyższych).
- **Zebrana dowolna forma**: słowo uznaje się za zebrane, jeśli pasuje dowolna powiązana forma (running -> run, ran, runs itp.).

Po wybraniu **Zebrana forma podstawowa**, **Zebrana forma podstawowa lub dokładna** albo **Zebrana dowolna forma** ustawienie [**Dopasowuj między systemami pisma**](#match-across-language-scripts) określa, czy dopasowanie na podstawie formy podstawowej może obejmować różne systemy pisma danego języka (np. kanji, hiraganę i katakanę).

### Priorytet wyboru karty {#card-choice-priority}

Jeśli do słowa pasuje kilka kart Anki, to ustawienie określa, która karta zostanie użyta do ustalenia statusu słowa:

- **Pole zawiera dokładną formę** (jeśli jest ich kilka, użyj karty o najwyższym statusie)
- **Pole zawiera formę podstawową** (jeśli jest ich kilka, użyj karty o najwyższym statusie)
- **Karta o najwyższym statusie**
- **Karta o najniższym statusie**

### Strategia wyszukiwania w polu zdania {#sentence-field-search-strategy}

Określa sposób wyszukiwania przez asbplayera w skonfigurowanych [**polach zdań Anki**](#anki-sentence-fields). Dostępne opcje są takie same jak w ustawieniu [**Strategia wyszukiwania w polu słowa**](#word-field-search-strategy).

Po wybraniu **Zebrana forma podstawowa**, **Zebrana forma podstawowa lub dokładna** albo **Zebrana dowolna forma** ustawienie [**Dopasowuj między systemami pisma**](#match-across-language-scripts) określa, czy dopasowanie na podstawie formy podstawowej może obejmować różne systemy pisma danego języka (np. kanji, hiraganę i katakanę).

:::tip
Ponieważ zdania zawierają wiele słów, status karty ma mniejsze znaczenie dla każdego z nich. Najlepiej pozostawić opcję **Zebrana dokładna forma**, chyba że masz wyłącznie karty ze zdaniami.
:::

### Dopasowuj między systemami pisma {#match-across-language-scripts}

Określa, czy dopasowanie na podstawie formy podstawowej może obejmować różne systemy pisma danego języka (np. kanji, hiraganę i katakanę).

```
if true:
  - Kana subtitles can match kanji in collection, could be homophones but text processing can't handle it so we allow it.
  - Kanji subtitles only match with kanji in collection, prevents kana collected matches all kanji homophones.
if false:
  - Never match across scripts, downside is if kanji is collected kana will need to be collected too.
  - Essentially a strict mode where the you need to collect all script forms of a word.
```

### URL API Yomitan {#yomitan-api-url}

URL punktu końcowego API Yomitan. Jeśli URL jest nieprawidłowy lub niedostępny, asbplayer wyświetli błąd.

:::tip
Potrzebujesz skonfigurowanej instancji [Yomitan](https://yomitan.wiki/) i [yomitan-api](https://github.com/yomidevs/yomitan-api).
:::

### Parser Yomitan {#yomitan-parser}

Wybiera parser Yomitan używany do dzielenia tekstu napisów na tokeny:

- **Parser skanujący (wszystkie języki)**: wewnętrzny parser Yomitan dopasowujący najdłuższe słowa ze słowników.
- **MeCab (japoński)**: używa MeCab do analizowania japońskiego tekstu. Wymaga skonfigurowania obsługi MeCab w Yomitanie, najlepiej z co najmniej jednym słownikiem UniDic.

### Maksymalna długość słowa {#max-word-length}

:::info
To ustawienie dotyczy tylko parsera skanującego.
:::

Ogranicza maksymalną długość słowa, które asbplayer będzie próbował skanować lub tokenizować na potrzeby adnotacji.

:::tip
Zbyt niska wartość sprawi, że dłuższe słowa zostaną pominięte, a zbyt wysoka może obniżyć wydajność.
:::

### Talie Anki (opcjonalnie) {#anki-decks}

Ogranicza wyszukiwanie w Anki do wybranych talii. Jeśli pole pozostanie puste, asbplayer przeszuka wszystkie talie.

### Pola słów Anki {#anki-word-fields}

Pola notatek Anki zawierające _wyłącznie_ dane słowo. To zalecany sposób pobierania z Anki informacji o statusie znajomości słów.

### Pola zdań Anki {#anki-sentence-fields}

Pola notatek Anki zawierające zdania (często używane w taliach ze zdaniami). Są używane zapasowo, gdy w [**polach słów Anki**](#anki-word-fields) nie ma kart z danym słowem.

### Stabilność/odstęp dojrzałej karty Anki (dni) {#mature-anki-stability-interval}

Określa próg (w dniach), od którego karta Anki otrzymuje status **Dojrzała**, zamiast niższego statusu.

- **Niezebrane**: nie znaleziono w Anki.
- **Nieznane**: znaleziono w Anki z `is:new`.
- **W trakcie nauki**: znaleziono w Anki z `is:learn`.
- **Ukończone**: znaleziono w Anki z `-is:new -is:learn prop:s<{ceil(cutoff / 2)}`.
- **Młode**: znaleziono w Anki z `-is:new -is:learn prop:s>=${ceil(cutoff / 2)} prop:s<${cutoff}`.
- **Dojrzałe**: znaleziono w Anki z `-is:new -is:learn prop:s>=${cutoff}`.

:::tip
Jeśli dostępna jest stabilność FSRS karty (ostatnią powtórkę wykonano przy włączonym FSRS), zostanie użyta zamiast odstępu.

Więcej informacji o statusach słów znajdziesz w sekcji [**Kolory statusów słów**](#word-status-colors).
:::

### Traktuj zawieszone karty Anki jako {#treat-suspended-anki-cards-as}

Określa, jak traktować **zawieszone** karty przy ustalaniu statusu słów na podstawie Anki:

- **Normalnie**: użyj statusu z Anki bez zmian.
- Możesz też wybrać konkretny status słowa (np. **Dojrzałe**, **Nieznane** itd.), aby przypisać go zawieszonym kartom.

:::tip
Jeśli zawieszona jest tylko część kart danego słowa, zawieszone karty zostaną odfiltrowane, a status słowa będzie ustalany na podstawie pozostałych kart.

Więcej informacji o statusach słów znajdziesz w sekcji [**Kolory statusów słów**](#word-status-colors).
:::

### Token API WaniKani {#wanikani-api-token}

Użyj tokenu API WaniKani, aby synchronizować znane słowa z WaniKani. Instrukcję konfiguracji znajdziesz w [przewodniku po adnotacjach](../guides/annotation.md#setup).

asbplayer używa wyłącznie typów elementów `vocabulary` i `kana_vocabulary` do określania znanych słów. Statusy są ustalane na podstawie etapu SRS danego elementu zgodnie ze skonfigurowanym [systemem powtórek interwałowych](https://docs.api.wanikani.com/20170710/#spaced-repetition-system). Statusy WaniKani są przypisywane w następujący sposób:

- **Niezebrane**: nie znaleziono w WaniKani.
- **Nieznane**: znaleziono w WaniKani na etapie SRS poniżej `Starting stage`.
- **W trakcie nauki**: znaleziono w WaniKani na etapie SRS równym lub wyższym niż `Starting stage`, ale niższym niż `Passing stage`.
- **Ukończone**: znaleziono w WaniKani na etapie SRS w dolnej połowie etapów między `Passing stage` i `Burning stage`.
- **Młode**: znaleziono w WaniKani na etapie SRS w górnej połowie etapów między `Passing stage` i `Burning stage`.
- **Dojrzałe**: znaleziono w WaniKani na etapie SRS równym lub wyższym niż `Burning stage`.

:::tip
Więcej informacji o statusach słów znajdziesz w sekcji [**Kolory statusów słów**](#word-status-colors).
:::

### Styl koloru słów {#word-color-style}

Określa sposób stosowania kolorów statusów do słów w funkcji [**Koloruj napisy na podstawie znanych słów**](#colorize-subtitles-based-on-known-words):

- **Tekst**: zmienia się kolor słowa.
- **Tło**: zmienia się kolor tła słowa.
- **Podkreślenie**: podkreśla słowo kolorem statusu.
- **Nadkreślenie**: dodaje nad słowem linię w kolorze statusu.
- **Obramowanie**: dodaje wokół słowa obramowanie w kolorze statusu.

:::tip
Aby uzyskać najlepszy efekt przy opcji **Obramowanie**, może być konieczne ustawienie wartości `0` w polu [**Grubość obramowania napisów**](#subtitle-appearance-track).
:::

### Grubość {#thickness}

Określa grubość (w pikselach) stylów **Podkreślenie**, **Nadkreślenie** i **Obramowanie**.

### Podświetlaj słowa po najechaniu kursorem {#highlight-words-on-hover}

:::info
Podświetlenie wskazuje, czy asbplayer ma fokus potrzebny do obsługi skrótów klawiszowych. Jeśli się nie pojawia, kliknij odtwarzacz, aby ustawić na nim fokus. Skróty klawiszowe działają w danej chwili dla wideo albo listy napisów, zależnie od tego, który element ma fokus.

Podświetlenie pomaga rozpoznać słowo wskazane kursorem w celu oznaczenia go jako znane. Wymaga, aby kursor wskazywał słowo i aby kolorowanie było włączone.
:::

Po włączeniu tej opcji wskazanie słowa kursorem podświetli je, pomagając zrozumieć, jak Yomitan podzielił je na tokeny.

### Pokazuj kolor słowa tylko po najechaniu kursorem {#only-display-word-color-on-hover}

:::note
To ustawienie działa tylko wtedy, gdy włączono opcję [**Koloruj napisy na podstawie znanych słów**](#colorize-subtitles-based-on-known-words).
:::

Po włączeniu tej opcji kolory słów są domyślnie ukryte i pojawiają się po najechaniu kursorem na tekst napisów w wideo lub na liście napisów.

### Pokazuj odczyt słowa tylko po najechaniu kursorem {#only-display-word-reading-on-hover}

:::note
To ustawienie działa tylko wtedy, gdy włączono opcję [**Wyświetlaj odczyty słów**](#display-word-readings).
:::

Po włączeniu tej opcji odczyty słów są domyślnie ukryte i pojawiają się po najechaniu kursorem na tekst napisów w wideo lub na liście napisów.

### Pokazuj częstotliwość słowa tylko po najechaniu kursorem {#only-display-word-frequency-on-hover}

:::note
To ustawienie działa tylko wtedy, gdy włączono opcję [**Wyświetlaj częstotliwość słów**](#display-word-frequency).
:::

Po włączeniu tej opcji częstotliwość słów jest domyślnie ukryta i pojawia się po najechaniu kursorem na tekst napisów w wideo lub na liście napisów.

### Pokazuj definicje słów tylko po najechaniu kursorem {#only-display-word-definitions-on-hover}

:::note
To ustawienie działa tylko wtedy, gdy włączono opcję [**Wyświetlaj definicje słów**](#display-word-definitions).
:::

Po włączeniu tej opcji definicje słów są domyślnie ukryte i pojawiają się po najechaniu kursorem na tekst napisów w wideo lub na liście napisów.

### Pokazuj akcent wyrazowy tylko po najechaniu kursorem {#only-display-pitch-accent-on-hover}

:::note
To ustawienie działa tylko wtedy, gdy włączono opcję [**Wyświetlaj akcent wyrazowy (japoński)**](#display-pitch-accent-japanese).
:::

Po włączeniu tej opcji akcent wyrazowy jest domyślnie ukryty i pojawia się po najechaniu kursorem na tekst napisów w wideo lub na liście napisów.

### Rozmiar odczytu słów {#word-reading-size}

Określa rozmiar odczytów słów (furigany) w jednostkach em (procent rozmiaru czcionki napisów).

### Rozmiar częstotliwości słów {#word-frequency-size}

Określa rozmiar informacji o częstotliwości słów w jednostkach em (procent rozmiaru czcionki napisów).

### Rozmiar definicji słów {#word-definition-size}

Określa rozmiar definicji słów w jednostkach em (procent rozmiaru czcionki napisów).

### Rozmiar akcentu wyrazowego {#pitch-accent-size}

Określa rozmiar akcentu wyrazowego w jednostkach em (procent rozmiaru czcionki napisów).

### Kolory statusów słów {#word-status-colors}

Każdy status ma konfigurowalny kolor i przezroczystość używane przez [**Styl koloru słów**](#word-color-style). Każdy status można włączyć lub wyłączyć osobno.

- **Niezebrane**: słowa nie ma w bazie asbplayera.
- **Nieznane**: słowo znajduje się w bazie, ale jest uznawane za nieznane.
- **W trakcie nauki**: słowo jest obecnie przyswajane.
- **Ukończone**: słowo zakończyło etap nauki.
- **Młode**: słowo jest znane, ale nie jest jeszcze dojrzałe.
- **Dojrzałe**: słowo jest w pełni znane (dojrzałe).

:::tip
Możesz wyłączyć stylizację wybranych statusów, na przykład **Dojrzałe**, aby ograniczyć liczbę oznaczeń.

Możesz używać tych samych kolorów dla różnych statusów (np. **Ukończone** i **Młode**), jeśli nie chcesz ich rozróżniać.

Informacje o sposobie ustalania statusów kart Anki znajdziesz w sekcji [**Stabilność/odstęp dojrzałej karty Anki (dni)**](#mature-anki-stability-interval).
Informacje o sposobie ustalania statusów WaniKani znajdziesz w sekcji [**Token API WaniKani**](#wanikani-api-token).
:::

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Odtwarzanie</a> {#playback}

### Ścieżki napisów używane przez tryby odtwarzania i skróty klawiszowe {#playback-subtitle-tracks}

Określa, które ścieżki są uwzględniane przy używaniu skrótów klawiszowych [Napisów](#subtitles-keyboard-shortcuts) i [Przewijania](#seek-keyboard-shortcuts) oraz trybów odtwarzania. Na przykład w trybie skondensowanym pomijane są fragmenty osi czasu bez napisów na wybranych tu ścieżkach.

### Wstrzymuj automatycznie po najechaniu kursorem na napisy {#auto-pause-when-mousing-over-subtitles}

Określa działanie automatycznej pauzy po najechaniu kursorem na napisy. „Włączone z automatycznym wznowieniem” oznacza, że odtwarzanie zostanie wznowione po przesunięciu kursora poza napisy.

### Tryby odtwarzania {#playback-modes}

Tryby odtwarzania można przełączać za pomocą [skrótów klawiszowych odtwarzania](#playback-keyboard-shortcuts).

### Prędkość odtwarzania {#playback-rate}

Określa normalną prędkość odtwarzania multimediów, także prędkość używaną podczas wyświetlania napisów w trybie przyspieszonym. Odtwarzanie zawsze rozpoczyna się z tą prędkością. Możesz ją zmienić podczas oglądania za pomocą [skrótów klawiszowych prędkości odtwarzania](#playback-rate-keyboard-shortcuts).

### Pokazuj powiadomienie o prędkości odtwarzania {#show-playback-rate-notification}

Wyświetla powiadomienie, gdy prędkość odtwarzania zmieni się poza trybem przyspieszonym.

### Preferencje automatycznej pauzy {#auto-pause-preference}

Określa, czy przy włączonej automatycznej pauzie zatrzymywać odtwarzanie na początku, końcu czy obu granicach napisu. Jeśli wybrano obie granice i włączono powtarzanie, odtwarzanie zatrzymuje się na końcu przed powtórzeniem, ale pomija pauzę na początku, aby nie wstrzymywać go dwukrotnie.

### Liczba powtórzeń {#repeat-count-preference}

Określa, ile razy powtórzyć każdy napis przed wznowieniem odtwarzania. Wartość `0` oznacza powtarzanie bez końca.

### Liczba powtórzeń przed wyświetleniem napisów {#repeats-before-showing-subtitles}

Ukrywa napisy w powtarzanym fragmencie do momentu, gdy zostanie on powtórzony wskazaną liczbę razy. `0` nie ukrywa napisów, a `1` pokazuje je już przy pierwszym powtórzeniu.

### Przesunięcie początku i końca wyzwalania napisów {#subtitle-trigger-start-and-end-offsets}

Przesuwa w milisekundach wyzwalacze początku i końca napisów używane przez automatyczną pauzę i powtarzanie. Przesunięcia są stosowane po globalnym przesunięciu napisów. Początek i koniec można skonfigurować niezależnie: wartości dodatnie opóźniają efekty odtwarzania, a ujemne przyspieszają je. Przesunięte granice ograniczają granice multimediów i sąsiednich zdarzeń napisów. Jeśli przesunięty początek i koniec się zamienią miejscami, zamieniane są też ich role chronologiczne.

### Minimalny odstęp pomijania w trybie przyspieszonym {#fast-forward-minimum-skip-interval}

Przyspiesza cały odstęp między napisami, jeśli jest co najmniej tak długi. Krótsze odstępy są odtwarzane z normalną prędkością.

### Prędkość odtwarzania w trybie przyspieszonym {#fast-forward-playback-rate}

Określa prędkość odtwarzania po włączeniu trybu przyspieszonego.

### Minimalny odstęp pomijania w trybie skondensowanym {#condensed-playback-minimum-skip-interval}

W trybie skondensowanym przechodzi do następnego napisu tylko wtedy, gdy dzieli go od bieżącego co najmniej określony tu odstęp czasu.

### Przesunięcie początku i końca wyzwalania przerw między napisami {#subtitle-gap-trigger-start-and-end-offsets}

Przesuwa wyzwalacze przerw między napisami używane w trybie przyspieszonym i skondensowanym. Przesunięcie początku przerwy jest nieujemne i opóźnia wyzwalacz względem końca napisu. Przesunięcie końca przerwy jest niedodatnie i przyspiesza wyzwalacz względem chwili przed następnym napisem. Każdą przerwę ograniczają granice multimediów i sąsiednich zdarzeń napisów.

### Tryb wznawiania po automatycznej pauzie {#auto-pause-resume-mode}

Określa sposób zakończenia automatycznej pauzy.

- **Ręczny**: odtwarzanie pozostaje wstrzymane do momentu wznowienia.

- **Stały**: każda automatyczna pauza trwa tyle samo.
  - Używa ustawień [Stały czas pauzy](#fixed-pause-duration) i [Opóźnienie wznowienia po automatycznej pauzie](#resume-delay-after-auto-pause).

- **Długość napisu**: czas pauzy jest obliczany na podstawie liczby znaków w napisie. Uwzględniane są tylko napisy ze ścieżek, po których można przewijać, więc ścieżka z tłumaczeniem wczytana obok języka docelowego nie wydłuża pauzy.
  - Używa ustawień [Minimalny czas pauzy](#minimum-pause-duration), [Maksymalny czas pauzy](#maximum-pause-duration), [Czas pauzy na znak](#pause-time-per-character) i [Opóźnienie wznowienia po automatycznej pauzie](#resume-delay-after-auto-pause).

### Stały czas pauzy {#fixed-pause-duration}

Czas trwania automatycznej pauzy w trybie **Stałym**.

### Minimalny czas pauzy {#minimum-pause-duration}

Najkrótsza pauza dozwolona w trybie **Długość napisu**, niezależnie od liczby znaków w napisie.

### Maksymalny czas pauzy {#maximum-pause-duration}

Najdłuższa pauza dozwolona w trybie **Długość napisu**. Wartość `0` oznacza brak górnego limitu. Niezerowa wartość maksymalna nie może być mniejsza od minimalnego czasu pauzy.

### Czas pauzy na znak {#pause-time-per-character}

Liczba milisekund przypisana każdemu znakowi w trybie **Długość napisu**. Iloczyn liczby znaków i tej wartości jest ograniczany do przedziału między minimalnym a maksymalnym czasem pauzy.

### Opóźnienie wznowienia po automatycznej pauzie {#resume-delay-after-auto-pause}

W trybach **Stały** i **Długość napisu** automatyczna pauza składa się z dwóch etapów: napisy są widoczne przez ustawiony czas pauzy, a następnie znikają, podczas gdy odtwarzanie pozostaje wstrzymane przez czas opóźnienia wznowienia. To ustawienie określa długość drugiego etapu.

### Wyświetlaj napisy {#show-subtitles}

- **Gdy przypada ich czas**: napisy są wyświetlane w okresie, w którym powinny być widoczne.

- **Podczas pauzy**: napisy są wyświetlane tylko wtedy, gdy przypada ich czas i odtwarzanie jest wstrzymane.

- **Podczas ręcznej pauzy**: napisy są wyświetlane tylko wtedy, gdy przypada ich czas i odtwarzanie zostało ręcznie wstrzymane.

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Odtwarzanie > Adnotacje</a> {#playback-annotation}

Te ustawienia wykorzystują statusy, stany i częstotliwości słów z sekcji [Adnotacje](#annotation) dla wybranej ścieżki napisów. Reguły automatycznej pauzy, odtwarzania skondensowanego, przyspieszonego i powtarzania obowiązują, gdy włączono odpowiednie tryby. **Brak filtra słów** oznacza, że dla tej ścieżki nie wybrano żadnych statusów ani stanów. Reguły są stosowane osobno do każdej ścieżki: ścieżka z możliwością przewijania, dla której nie wybrano statusów ani stanów w danym trybie, zachowuje zwykłe działanie tego trybu, nawet jeśli jest odtwarzana razem ze ścieżką mającą reguły.

### Ścieżka napisów {#playback-annotation-track}

Wybiera ścieżkę napisów, której dotyczą edytowane ustawienia odtwarzania adnotacji. Wybrana ścieżka jest wspólna z kartą Adnotacje.

### Zaznacz pierwsze pasujące słowo po wstrzymaniu {#select-first-matching-word-on-pause}

Zaznacza pierwsze słowo pasujące do wybranego statusu lub stanu za każdym razem, gdy odtwarzanie zostanie wstrzymane, również ręcznie, a także po przewinięciu przy wstrzymanym odtwarzaniu. Pozostaw wybór pusty, aby wyłączyć tę funkcję. Słowo jest zaznaczane w odtwarzaczu wideo lub, jeśli nie wczytano ani nie podłączono wideo, w odtwarzaczu napisów.

Jeśli pauzę spowodowała [reguła automatycznej pauzy oparta na adnotacjach](#auto-pause-subtitles-containing-these-words), zaznaczane jest pasujące do niej słowo. Ta lista nadal określa, co zaznaczać przy ręcznym wstrzymaniu.

Każda z poniższych reguł słów ma osobne ustawienia wyboru statusu i stanu, limitu liczby słów oraz limitu częstotliwości. Słowo musi mieć wybrany status lub stan i spełniać oba limity.

### Wstrzymuj automatycznie napisy zawierające te słowa {#auto-pause-subtitles-containing-these-words}

Gdy włączono tryb automatycznej pauzy, zatrzymuje odtwarzanie tylko na napisach zawierających pasujące słowo i zaznacza pierwsze z nich. Przy automatycznej pauzie ma to pierwszeństwo przed opcją [**Zaznacz pierwsze pasujące słowo po wstrzymaniu**](#select-first-matching-word-on-pause). Ta lista nadal obowiązuje przy ręcznej pauzie.

### Powtarzaj napisy zawierające te słowa {#repeat-subtitles-containing-these-words}

Gdy włączono tryb powtarzania, powtarza tylko napisy zawierające pasujące słowo.

### Odtwarzaj napisy zawierające te słowa w trybie skondensowanym {#play-subtitles-containing-these-words-in-condensed-mode}

Gdy włączono tryb skondensowany, zachowuje w skróconej osi czasu napisy zawierające pasujące słowo. Pozostałe napisy są pomijane.

### Odtwarzaj napisy zawierające te słowa z normalną prędkością w trybie przyspieszonym {#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode}

Gdy włączono tryb przyspieszony, odtwarza napisy zawierające pasujące słowo z normalną prędkością. Pozostałe napisy są odtwarzane szybciej.

### Dostosuj prędkość przewijania do przodu do poziomu rozumienia {#adjust-fast-forward-rate-by-comprehension}

W trybie przyspieszonym dobiera prędkość wewnątrz napisu na podstawie wyniku rozumienia zdania.

Przy wartości równej [**Minimalnemu poziomowi rozumienia**](#minimum-comprehension) lub niższej używa normalnej prędkości odtwarzania, a przy 100% — skonfigurowanej prędkości przyspieszonej. Wartości pośrednie są interpolowane.

Zmiana prędkości w napisie sterowanym poziomem rozumienia zmienia skonfigurowaną prędkość przyspieszoną, po czym ponownie oblicza stosowaną prędkość na podstawie rozumienia. Działa to również wtedy, gdy poziom rozumienia utrzymuje napis przy normalnej prędkości. Skróty klawiszowe i elementy sterujące prędkością w odtwarzaczu działają tak samo; normalna prędkość pozostaje bez zmian.

### Minimalny poziom rozumienia {#minimum-comprehension}

Określa wartość procentową, od której rozpoczyna się przyspieszanie (0–99%, domyślnie 60%).

### Pokazuj te słowa podczas odtwarzania {#show-these-words-during-playback}

Wybiera statusy i stany słów, które mają pozostać widoczne.

### Ukryj cały napis, gdy ta wartość procentowa słów byłaby ukryta {#whole-subtitle-hidden-percentage}

Ukrywa cały napis, gdy reguła wyświetlania ukryłaby co najmniej określony procent zawartych w nim słów. Na przykład przy wartości **80%** w pięciowyrazowym napisie ukryte zostaną cztery słowa, więc zniknie cały napis, także jedno słowo wybrane do wyświetlania. Znaki interpunkcyjne i inne znaki niebędące literami nie są liczone.

### Ukrywaj osobno niepasujące słowa {#hide-non-matching-words-individually}

Po włączeniu tej opcji słowa niespełniające reguły wyświetlania są ukrywane pojedynczo, dopóki napis nie osiągnie progu ukrycia w całości. Po wyłączeniu napis pozostaje w pełni widoczny do osiągnięcia tego progu.

### Minimalna liczba słów w wybranej kategorii {#minimum-words-per-selected-category}

Każda wybrana kategoria (np. **Niezebrane** lub **Zignorowane**) jest liczona osobno w obrębie napisu. Jeśli liczba słów w kategorii jest niższa niż ten limit, nie uruchamiają one reguły. `0` wyłącza limit.

### Maksymalna liczba słów w wybranej kategorii {#maximum-words-per-selected-category}

Każda wybrana kategoria (np. **Niezebrane** lub **Zignorowane**) jest liczona osobno w obrębie napisu. Jeśli liczba słów w kategorii przekracza ten limit, nie uruchamiają one reguły. `0` wyłącza limit.

### Tylko gdy częstotliwość słowa wynosi co najmniej {#only-when-word-frequency-is-at-least}

Częstotliwość pasującego słowa musi być równa tej wartości lub wyższa. Brak danych o częstotliwości jest traktowany jako `1`. `0` wyłącza limit.

### Tylko gdy częstotliwość słowa wynosi najwyżej {#only-when-word-frequency-is-at-most}

Częstotliwość pasującego słowa musi być równa tej wartości lub niższa. Brak danych o częstotliwości jest traktowany jako `1`. `0` wyłącza limit.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Wideo strumieniowe</a> (tylko rozszerzenie) {#streaming-video}

Ustawienia wideo strumieniowego są dostępne tylko po zainstalowaniu rozszerzenia przeglądarki.

### Podczas wczytywania napisów otwieraj też ich listę w osobnej karcie aplikacji {#open-subtitle-list-in-tab}

Za każdym razem, gdy napisy zostaną wczytane do elementu wideo, otwiera stronę w osobnej karcie i synchronizuje z nią napisy.

### URL aplikacji {#app-url}

Określa, skąd rozszerzenie pobiera część konfiguracji oraz jaki adres otworzyć podczas synchronizowania napisów ze stroną w osobnej karcie. Zasadniczo jest to adres URL strony.

### Włącz nakładkę sterowania {#enable-controls-overlay}

Wyświetla nakładkę sterowania na elementach wideo z wczytanymi napisami.

### Wyświetlaj napisy {#display-subtitles}

Wyświetla wczytane napisy na elementach wideo.

### Nagrywaj dźwięk podczas kopania {#record-audio-when-mining}

Podczas kopania fiszki nagrywa dźwięk z okresu objętego napisem, aby dodać go do fiszki.

### Wykonuj zrzut ekranu podczas kopania {#take-screenshot-when-mining}

Podczas kopania fiszki wykonuje zrzut ekranu, aby dodać go do fiszki.

### Oczyść zrzut ekranu podczas kopania {#clean-screenshot-when-mining}

Podczas kopania fiszki i przy włączonych zrzutach ekranu usuwa elementy HTML nałożone na wideo, aby zrzut był „czysty”.

### Przycinaj zrzut ekranu podczas kopania {#crop-screenshot-when-mining}

Podczas kopania fiszki przycina zrzut ekranu do elementu wideo.

### Format przechwytywanego obrazu {#streaming-image-capture-format}

Określa format obrazu dla fiszek tworzonych z wideo strumieniowego. Dodatkową opcją jest „Animowany WebP”, który przechwytuje wideo odtwarzane na karcie przez czas trwania napisu — wraz z marginesem dźwięku — i zapisuje je jako animowany obraz zamiast pojedynczego zrzutu ekranu.

Animowany WebP jest używany tylko wtedy, gdy włączono opcję [Nagrywaj dźwięk podczas kopania](#record-audio-when-mining); w przeciwnym razie wykonywany jest zwykły zrzut ekranu. Dotyczy wszystkich sposobów kopania, które nagrywają multimedia, w tym ręcznego nagrywania rozpoczętego i zatrzymanego skrótem klawiszowym. Nagranie obejmuje cały materiał do chwili zatrzymania (maksymalnie 30 sekund). Jednocześnie może trwać tylko jedno nagranie. Animowany WebP nie jest dostępny w Firefoxie i nie można przechwytywać wideo chronionego DRM. Karta musi pozostać widoczna podczas przechwytywania klipu, ponieważ Chrome przestaje renderować ukryte karty.

### Liczba klatek na sekundę animowanego obrazu {#animated-image-fps}

Liczba klatek na sekundę przechwytywanych do animowanych obrazów WebP. Dłuższe klipy automatycznie używają mniejszej liczby klatek, aby ograniczyć rozmiar karty. Dostępne tylko po wybraniu formatu Animowany WebP.

### Jakość animowanego obrazu {#animated-image-quality}

Jakość każdej klatki animowanego obrazu WebP, od `0.1` do `1`. Wyższa wartość poprawia wygląd, ale zwiększa rozmiar pliku. Dostępne tylko po wybraniu formatu Animowany WebP.

### Zezwalaj na przeciąganie i upuszczanie plików z napisami {#allow-subtitle-file-drag-and-drop}

Pozwala przeciągać pliki z napisami i upuszczać je na elementy wideo.

### Automatycznie wczytuj wykryte napisy {#auto-load-detected-subtitles}

Jeśli bieżąca strona obsługuje automatyczne wykrywanie napisów, wczytuje je automatycznie. Jeśli wykryto kilka ścieżek, wczytuje ścieżkę w preferowanym języku. Preferowany jest język ostatnio wczytany przy zaznaczonej opcji „Zapamiętaj wybrane ścieżki”.

### Pytaj, gdy automatyczne wczytywanie wykrytych napisów się nie powiedzie {#prompt-on-subtitle-autoload-failure}

Jeśli automatyczne wczytanie napisów się nie powiedzie, przed próbą wczytania wykrytych napisów wyświetla pytanie.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Wideo strumieniowe > Strony</a> {#pages}

Ustawienia integracji z konkretnymi stronami, takimi jak YouTube czy Netflix. asbplayer ma wstępnie skonfigurowane ustawienia domyślne dla każdej strony. W sekcji Strony można je zmienić.

### Kody języków docelowych tłumaczenia maszynowego (tylko YouTube) {#youtube-translation-languages}

Określa języki docelowe tłumaczenia maszynowego YouTube. Po wskazaniu języków w selektorze ścieżek napisów pojawią się dodatkowe ścieżki dla każdego z nich.

## <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Różne</a> {#misc}

### Importowanie/eksportowanie ustawień {#import-export-settings}

Importuje lub eksportuje ustawienia jako plik `json`.

### Motyw {#theme}

Wyświetla asbplayera w jasnym lub ciemnym motywie.

### Język {#language}

Język interfejsu użytkownika.

Uwaga: nie wszystkie teksty zostały przetłumaczone na każdy obsługiwany przez asbplayer język. Nieprzetłumaczone teksty będą wyświetlane po angielsku. Możesz pomóc w tłumaczeniu w [projekcie Crowdin](https://crowdin.com/project/asbplayer).

### Automatycznie maksymalizuj lokalne wideo {#auto-maximize-local-video}

Automatycznie maksymalizuje lokalne wideo po otwarciu panelu napisów.

### Pokazuj przycisk kopania na liście napisów {#show-mining-button-in-subtitle-list}

Po włączeniu tej opcji obok każdego napisu na liście pojawia się przycisk kopania.

### Znaczniki czasu na liście napisów {#subtitle-list-timestamps}

Określa sposób wyświetlania znaczników czasu na liście napisów.

- **Ukryte**: nie są wyświetlane.
- **Początek**: wyświetla tylko początkowy znacznik czasu napisu.
- **Początek i koniec**: wyświetla początkowy i końcowy znacznik czasu napisu.

### Zapamiętuj przesunięcie napisów {#remember-subtitle-offset}

Po włączeniu tej opcji przesunięcie czasu jest zapamiętywane. Napisy są wczytywane z ostatnio użytym przesunięciem.

### Zapamiętuj ostatnią prędkość odtwarzania {#remember-last-playback-rate}

Aktualizuje ustawienie prędkości odtwarzania po jej zmianie w trakcie odtwarzania wideo. Gdy opcja jest wyłączona, odtwarzanie nadal rozpoczyna się z ustawioną prędkością, ale zmiany wprowadzone podczas oglądania są tymczasowe.

### Zapamiętuj ostatnie tryby odtwarzania {#remember-last-playback-modes}

Przy ponownym wczytaniu odtwarzania przywraca ostatnio włączone tryby odtwarzania. Gdy opcja jest wyłączona, odtwarzanie rozpoczyna się w trybie normalnym.

### Automatycznie kopiuj bieżący napis do schowka {#auto-copy-current-subtitle-to-clipboard}

Automatycznie kopiuje napis do schowka, gdy pojawi się na ekranie. Przydatne do przesyłania napisów do aplikacji monitorujących schowek.

### Ścieżki napisów kopiowane automatycznie {#subtitle-tracks-eligible-for-auto-copy}

Określa, które ścieżki będą kopiowane automatycznie po włączeniu opcji [Automatycznie kopiuj bieżący napis do schowka](#auto-copy-current-subtitle-to-clipboard).

### Pokazuj miniatury podglądu {#show-preview-thumbnails}

Wyświetla miniatury podglądu na liście napisów.

### Napis nad miniaturą {#subtitle-above-thumbnail}

Wyświetla napis nad miniaturą podglądu na liście napisów.

### Filtr napisów wyrażeniem regularnym {#subtitle-regex-filter}

Fragmenty tekstu pasujące do tego wyrażenia regularnego zostaną zastąpione wartością ustawienia [Tekst zastępujący w filtrze napisów](#subtitle-regex-filter-text-replacement).

### Tekst zastępujący w filtrze napisów {#subtitle-regex-filter-text-replacement}

Fragmenty pasujące do powyższego wyrażenia regularnego zostaną zastąpione wartością tego ustawienia. Jeśli pole pozostanie puste, pasujące fragmenty zostaną usunięte.

### HTML w napisach {#subtitle-html}

Określa sposób obsługi kodu HTML występującego w plikach z napisami.

### Wykrywaj i wyświetlaj ruby {#detect-and-display-ruby}

Po włączeniu tej opcji asbplayer automatycznie wykrywa odczyty słów w stylu Netflixa i formatuje je za pomocą znaczników `ruby`. Często występują one w japońskich napisach w formie `花子（はなこ）`, gdzie odczyt w nawiasie następuje po słowie.

### Włącz klienta WebSocket {#enable-websocket-client}

Włącza klienta WebSocket. Umożliwia sterowanie asbplayerem przez interfejs WebSocket.

### URL serwera WebSocket {#websocket-server-url}

Adres URL serwera WebSocket, z którym łączy się klient po włączeniu. Zazwyczaj jest to lokalnie uruchomiona instancja [dołączonego serwera WebSocket](../guides/web-socket-server.md).

### Limit historii kopania {#mining-history-storage-limit}

Ogranicza liczbę kart zapisywanych w historii kopania.

### Nazwa karty {#name-of-the-tab}

Nazwa wyświetlana na karcie aplikacji.

## Profile {#profiles}

Profil ustawień to osobny zestaw wartości ustawień. Aktywny profil można zmienić w interfejsie ustawień albo w oknach **Wczytaj napisy** i **Eksport Anki**.
