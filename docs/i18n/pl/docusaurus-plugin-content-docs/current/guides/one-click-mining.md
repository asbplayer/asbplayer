---
sidebar_position: 8
---

import project, { ankiConnectUrl, webSocketUrl } from '@site/src/project';

# Kopanie jednym kliknięciem {#one-click-mining}

asbplayer świetnie łączy napisy i obraz wideo z AnkiConnect, ale sam nie potrafi automatycznie pobierać definicji słów. Dlatego większość sposobów kopania ze zdań wymaga dwóch lub trzech działań myszą lub klawiaturą.

Kopanie jednym kliknięciem jest możliwe, jeśli połączysz asbplayera z aplikacją, która:

- dostarcza brakujące definicje słów, and
- jest już zintegrowana z AnkiConnect.

Przykładem takiej aplikacji jest [Yomitan](https://yomitan.wiki/).

## Instalacja i konfiguracja Yomitan {#install-and-configure-yomitan}

Postępuj zgodnie z instrukcjami na [stronie Yomitan](https://yomitan.wiki/), aby zainstalować aplikację i skonfigurować słownik dla języka, którego się uczysz. Jeśli jeszcze tego nie zrobiono, dodaj też [AnkiConnect](https://ankiweb.net/shared/info/2055492159) do Anki.

W ustawieniach Anki w Yomitan:

- Adres serwera AnkiConnect powinien pozostać domyślny (<code>{ankiConnectUrl}</code>).
- Yomitan powinien używać tego samego **typu notatki** co asbplayer.

## Instalacja dodatku Anki asbplayera {#install-the-asbplayer-anki-add-on}

Dodatek wymaga Anki w wersji co najmniej 25.02. Nie jest jeszcze dostępny w AnkiWeb, dlatego trzeba zainstalować go z pliku:

1. Pobierz najnowszy plik `.ankiaddon` ze <a href={`${project.urls.repo}/releases?q=${encodeURIComponent(project.releases.ankiAddon.releaseTitlePrefix)}`}>strony wydań</a>.
2. Otwórz plik i kliknij **Tak** w wyskakującym oknie.
3. Uruchom Anki ponownie.

## Łączenie asbplayera z dodatkiem {#connect-asbplayer-to-the-add-on}

Włącz klienta WebSocket w <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>pozostałych ustawieniach</a> rozszerzenia asbplayer (na dole strony). Pozostaw domyślny adres URL serwera WebSocket (<code>{webSocketUrl}</code>), zgodny z ustawieniem dodatku.

## Kopanie w zwykły sposób za pomocą **Yomitan** {#mine-with-yomitan-as-usual}

Kopanie zdań za pomocą Yomitan od razu uzupełni definicję słowa, obraz i dźwięk.

Aby zawsze używać tekstu napisów asbplayera w polu Zdanie, włącz w ustawieniach **Tworzenia fiszek** opcję [**Zawsze używaj tekstu napisów w polu zdania**](../reference/settings#always-use-subtitle-text-for-sentence-field). Zastąpi ona tekst zdania dostarczony przez Yomitan tekstem napisu z wszystkich ścieżek, z którego tworzysz fiszkę.

## Ustawienia dodatku

Ustawienia dodatku można zmienić w Anki, wybierając **Narzędzia > Dodatki**, a następnie dodatek i **Konfiguruj**. `postMineAction` określa działanie asbplayera po dodaniu karty przez Yomitan (domyślnie: <code>{project.services.webSocket.postMineAction}</code>). Aby tworzyć fiszki jednym kliknięciem, ustaw `2` (aktualizacja ostatniej karty). Jeśli zmienisz `port`, zmień odpowiednio adres URL serwera WebSocket asbplayera.
