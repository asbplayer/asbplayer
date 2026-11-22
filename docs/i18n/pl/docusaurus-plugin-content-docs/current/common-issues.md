---
sidebar_position: 5
---

import project from '@site/src/project';

# Częste problemy {#common-issues}

## Ogólne {#general}

### Nie widać napisów {#subtitles-arent-showing-up}

Napisy w asbplayerze można ukryć na kilka sposobów:

- Za pomocą skrótu klawiszowego [`Przełącz napisy`](./reference/settings.md#subtitles-keyboard-shortcuts).
- Za pomocą skrótów klawiszowych [`Przełącz ścieżkę napisów X w wideo`](./reference/settings.md#subtitles-keyboard-shortcuts).
- Za pomocą opcji [`Wyświetl napisy`](./reference/settings.md#show-subtitles) w sekcji `Odtwarzanie > Tryby odtwarzania`

### asbplayer nie może połączyć się z Anki. Wyświetla błąd, np. „Failed to fetch”. {#anki-connection-failed}

Przyczyną mogą być blokery reklam:

- Jeśli używasz Brave, sprawdź, czy funkcja Shield nie blokuje asbplayera.
- Sprawdź, czy przeglądarka lub bloker reklam nie blokuje żądania. Zacznij od otwarcia konsoli programisty przeglądarki i sprawdzenia, czy są w niej błędy.

Nieprawidłowa konfiguracja:

- Jeśli korzystasz ze strony, upewnij się, że AnkiConnect zezwala asbplayerowi na połączenie, zgodnie z instrukcjami [tutaj](./getting-started/mining-subtitles.md).

Możliwe są też błędy:

- W chwili pisania tego tekstu wiadomo, że włączenie flagi Experimental Web Platform features może powodować ten problem. Spróbuj ją wyłączyć na stronie `chrome://flags`.
- W nowszych wersjach macOS AnkiConnect nie odpowiada, gdy Anki działa w tle ([informacje dla użytkowników Maca](https://git.sr.ht/~foosoft/anki-connect#notes-for-macos-users)).

### Karta nie aktualizuje się w Anki po użyciu funkcji „Zaktualizuj ostatnią kartę”. {#card-not-updating}

Przed użyciem funkcji „Zaktualizuj ostatnią kartę” zamknij przeglądarkę kart Anki. W AnkiConnect występuje [znany problem](https://github.com/FooSoft/anki-connect/issues/82), który powoduje, że przy otwartej przeglądarce kart aktualizacje nie są widoczne.

### Po wczytaniu pliku lokalnego asbplayer wyświetla czarny ekran lub nie odtwarza dźwięku. {#local-video-playback-issues}

Przeglądarki różnią się obsługą formatów wideo i dźwięku. Zobacz sekcję [zgodności](./compatibility.md#browsers-and-media-formats).

### Moje wyskakujące rozszerzenie słownikowe (np. Yomitan) nie działa w panelu bocznym {#popup-dictionary-in-side-panel}

Ze względów bezpieczeństwa przeglądarki nie pozwalają wstrzykiwać skryptów rozszerzeń na strony innych rozszerzeń, więc nie da się tego naprawić. Jeśli chcesz skanować tekst za pomocą innych rozszerzeń, użyj napisów wyświetlanych na elemencie wideo albo listy napisów na stronie asbplayera.

### asbplayer nie wykrywa wideo strumieniowego. {#asbplayer-isnt-detecting-streaming-video}

W szczegółach rozszerzenia upewnij się, że ma ono dostęp do wszystkich stron.

### Skróty klawiszowe nie działają. {#keyboard-shortcuts-arent-working}

Sprawdź <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>ustawienia skrótów klawiszowych</a> lub [dokumentację skrótów klawiszowych](./reference/settings.md#keyboard-shortcuts).

Jeśli korzystasz z rozszerzenia:

- Sprawdź `chrome://extensions/shortcuts` w Chrome lub w Firefoxie przejdź do `about:addons` → ikona koła zębatego → `Zarządzaj skrótami rozszerzeń`.
- Odśwież stronę i spróbuj ponownie wczytać napisy.
- Spróbuj odinstalować i ponownie zainstalować rozszerzenie oraz uruchomić przeglądarkę ponownie.
- Upewnij się, że rozszerzenie nie zostało zainstalowane dwukrotnie.

### asbplayer nieprawidłowo przycina zrzuty ekranu z wideo strumieniowego. {#screenshot-cropping-issues}

Upewnij się, że powiększenie przeglądarki wynosi 100%. Przycinanie można całkowicie wyłączyć w <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>ustawieniach rozszerzenia</a>.

### Mam problem z tworzeniem fiszek przy użyciu notatki JP mining. {#jp-mining-note-issues}

Zobacz to [zgłoszenie](https://github.com/asbplayer/asbplayer/issues/220#issuecomment-1501124166).

### asbplayer ciągle prosi o zgodę na nagrywanie dźwięku {#repeated-audio-permission-prompts}

asbplayer nie jest obecnie zgodny z rozszerzeniem Volume Master. Trzeba je wyłączyć.

### Nagrania dźwięku są zniekształcone, trzaskają lub zanikają {#garbled-audio-recordings}

Zwykle przyczyną jest niewystarczająca moc procesora. Jeśli używasz laptopa, podłącz go do zasilania. Upewnij się też, że tryb oszczędzania energii nie ogranicza wydajności procesora.

### Po użyciu skrótu klawiszowego do otwarcia asbplayera dla wideo strumieniowego nic się nie dzieje, a strona przestaje odpowiadać. {#streaming-shortcut-unresponsive}

Może się tak dziać, gdy na stronie `chrome://flags` włączono `Experimental Web Platform features`. Wyłącz tę flagę i spróbuj ponownie.

## Adnotacje {#annotation}

### Włączanie i wyłączanie adnotacji dla ścieżki {#enable-or-disable-annotation-for-a-track}

Adnotacje są wyłączone, gdy poniższe ustawienia mają wskazane wartości:

- W sekcji [`Ustawienia > Adnotacje`](./reference/settings.md#annotation):
  - [`Koloruj napisy na podstawie znanych słów`](./reference/settings.md#colorize-subtitles-based-on-known-words): **Wył.**
  - [`Automatycznie generuj statystyki`](./reference/settings.md#generate-statistics-automatically): **Wył.**
  - [`Wyświetlaj odczyty słów`](./reference/settings.md#display-word-readings): _Nic nie wybrano_ (pusta wartość)
  - [`Wyświetlaj częstotliwość słów`](./reference/settings.md#display-word-frequency): _Nic nie wybrano_ (pusta wartość)
  - [`Wyświetlaj akcent wyrazowy (japoński)`](./reference/settings.md#display-pitch-accent-japanese): _Nic nie wybrano_ (pusta wartość)
  - [`Wyświetlaj definicje słów`](./reference/settings.md#display-word-definitions): _Nic nie wybrano_ (pusta wartość)
- W sekcji [`Ustawienia > Odtwarzanie > Adnotacje`](./reference/settings.md#playback-annotation):
  - [`Zaznacz pierwsze pasujące słowo po wstrzymaniu`](./reference/settings.md#select-first-matching-word-on-pause): Nigdy
  - [`Wstrzymuj automatycznie napisy zawierające te słowa`](./reference/settings.md#auto-pause-subtitles-containing-these-words): Brak filtra słów
  - [`Odtwarzaj napisy zawierające te słowa w trybie skondensowanym`](./reference/settings.md#play-subtitles-containing-these-words-in-condensed-mode): Brak filtra słów
  - [`Odtwarzaj napisy zawierające te słowa z normalną prędkością w trybie przyspieszonym`](./reference/settings.md#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode): Brak filtra słów
  - [`Powtarzaj napisy zawierające te słowa`](./reference/settings.md#repeat-subtitles-containing-these-words): Brak filtra słów
  - [`Pokazuj te słowa podczas odtwarzania`](./reference/settings.md#show-these-words-during-playback): Brak filtra słów
  - [`Dostosuj prędkość przewijania do przodu do poziomu rozumienia`](./reference/settings.md#adjust-fast-forward-rate-by-comprehension): **Wył.**

Aby włączyć adnotacje dla ścieżki, zmień co najmniej jedno z powyższych ustawień z wartości wyłączonej. Niektóre adnotacje mogą pojawiać się tylko po najechaniu kursorem, jeśli [skonfigurujesz je w ten sposób](./reference/settings.md#only-display-word-color-on-hover).

:::tip
Przyciski [`Odbuduj bazę słów Anki`](./reference/settings.md#re-build-anki-word-database) i [`Odbuduj bazę słów WaniKani`](./reference/settings.md#re-build-wanikani-word-database) są nieaktywne, jeśli powyższe ustawienia nie korzystają z integracji z tymi usługami.
:::

### Czyszczenie bazy słów Anki {#clear-anki-word-database}

Aby usunąć wpisy ścieżki z bazy słów Anki, ustaw puste wartości w polach [`Pola słów Anki`](./reference/settings.md#anki-word-fields) i [`Pola zdań Anki`](./reference/settings.md#anki-sentence-fields), a następnie kliknij [`Odbuduj bazę słów Anki`](./reference/settings.md#re-build-anki-word-database). Jeśli przycisk jest nieaktywny, najpierw [wykonaj te kroki](#enable-or-disable-annotation-for-a-track), aby włączyć adnotacje dla ścieżki.

### Czyszczenie bazy słów WaniKani {#clear-wanikani-word-database}

Aby usunąć wpisy ścieżki z bazy słów WaniKani, usuń wartość z pola [Token API WaniKani](./reference/settings.md#wanikani-api-token), a następnie kliknij [`Odbuduj bazę słów WaniKani`](./reference/settings.md#re-build-wanikani-word-database). Jeśli przycisk jest nieaktywny, najpierw [wykonaj te kroki](#enable-or-disable-annotation-for-a-track), aby włączyć adnotacje dla ścieżki.

### Usuwanie słów śledzonych lokalnie {#delete-locally-tracked-words}

Aby usunąć słowo śledzone lokalnie, najedź na nie kursorem i za pomocą [skrótów klawiszowych adnotacji](./reference/settings.md#annotation-keyboard-shortcuts) ustaw jego status na **Niezebrane** oraz wyłącz **Zignorowane**, jeśli było włączone.

Aby zbiorczo usunąć słowa śledzone lokalnie, użyj [`Przeglądarki słów`](./reference/settings.md#word-browser), ustaw ich status na **Niezebrane** i usuń ich stany. Możesz też skorzystać z funkcji [`Importuj słowa`](./reference/settings.md#import-words).

### Wszystkie słowa mają status „Niezebrane” {#everything-is-uncollected}

Jeśli adnotacje zostały włączone przypadkowo, [wykonaj te kroki](#enable-or-disable-annotation-for-a-track), aby je wyłączyć.

Jeśli status słów nigdy nie zmienia się z **Niezebrane**:

- Jeśli korzystasz z lokalnych statusów, zaimportuj słowa do lokalnej bazy słów albo najedź na nie i ustaw status za pomocą [skrótów klawiszowych adnotacji](./reference/settings.md#annotation-keyboard-shortcuts).
- Jeśli statusy pobierasz z Anki, upewnij się, że Anki jest uruchomione, a **URL AnkiConnect** jest prawidłowy.
    - Skonfiguruj [`Pola słów Anki`](./reference/settings.md#anki-word-fields) (zalecane) lub [`Pola zdań Anki`](./reference/settings.md#anki-sentence-fields).
    - Użyj opcji [`Odbuduj bazę słów Anki`](./reference/settings.md#re-build-anki-word-database).
    - Po zbudowaniu bazy nie musisz pozostawiać Anki uruchomionego, ale otwarte Anki podczas odtwarzania pozwoli asbplayerowi utrzymywać synchronizację.
- Jeśli statusy pobierasz z WaniKani, upewnij się, że [`token API WaniKani`](./reference/settings.md#wanikani-api-token) jest prawidłowy.
    - Użyj opcji [`Odbuduj bazę słów WaniKani`](./reference/settings.md#re-build-wanikani-word-database).
    - asbplayer będzie automatycznie synchronizować dane z WaniKani podczas odtwarzania.

### Pojawia się czerwone przekreślenie {#red-strikethrough-styling-appears}

Jeśli adnotacje zostały włączone przypadkowo, [wykonaj te kroki](#enable-or-disable-annotation-for-a-track), aby je wyłączyć.

Oznacza to, że wystąpił błąd podczas przetwarzania napisów, najprawdopodobniej z powodu problemu z połączeniem z Yomitanem. Sprawdź komunikaty o błędach w konsoli przeglądarki. Jeśli nie uda Ci się rozwiązać problemu, poproś o pomoc na Discordzie asbplayera.
