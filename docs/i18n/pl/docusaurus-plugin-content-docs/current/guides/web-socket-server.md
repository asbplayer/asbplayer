---
sidebar_position: 9
---

import project, { webSocketHttpUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# Serwer WebSocket {#websocket-server}

asbplayer wykorzystuje dwukierunkowe połączenia WebSocket, aby udostępnić interfejs dostępny spoza przeglądarki.

W tym rozwiązaniu asbplayer jest **klientem WebSocket**, który utrzymuje połączenie z **serwerem WebSocket** działającym lokalnie na komputerze użytkownika. Serwer udostępnia interfejs HTTP, który wysyła polecenia do klienta asbplayer. Dokumentacja techniczna dołączonego serwera znajduje się [tutaj](../reference/external-api.md).

Serwer powstał, aby umożliwić kopanie jednym kliknięciem: uzupełnia żądania `addNote` wysyłane do AnkiConnect o materiały dostarczane przez asbplayera. Dlatego jedną z jego głównych funkcji jest także działanie jako **serwer proxy AnkiConnect**.

:::note
Zalecanym sposobem kopania jednym kliknięciem jest użycie [dodatku Anki asbplayera](./one-click-mining.md#install-the-asbplayer-anki-add-on). Opisany poniżej serwer proxy AnkiConnect stanowi alternatywę.
:::

## Uruchamianie serwera {#run-the-server}

1. Sklonuj <a href={project.urls.repo}>repozytorium asbplayera</a>.

    <CodeBlock language="bash">{`git clone ${project.urls.repo}.git asbplayer`}</CodeBlock>

2. Jeśli jeszcze tego nie zrobiono, zainstaluj [Golang](https://go.dev/dl/).
3. Uruchom serwer:

    ```
    cd asbplayer/scripts/web-socket-server
    go run .
    ```

Serwer proxy zużywa niewiele zasobów, więc można pozostawić go uruchomionego w tle. W systemie Windows można zminimalizować go do zasobnika systemowego za pomocą [RBTray](https://github.com/benbuck/rbtray).

## Łączenie asbplayera z serwerem {#connect-asbplayer-to-the-server}

Skonfiguruj i włącz klienta WebSocket asbplayera w <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>pozostałych ustawieniach</a>. Domyślnie asbplayer korzysta już z domyślnego adresu IP i portu serwera WebSocket, więc zwykle wystarczy włączyć klienta WebSocket.

## Kopanie jednym kliknięciem przez serwer proxy AnkiConnect {#one-click-mining-with-the-ankiconnect-proxy}

Postępuj zgodnie z instrukcjami na [stronie Yomitan](https://yomitan.wiki/), aby zainstalować aplikację i skonfigurować słownik dla języka, którego się uczysz.

Następnie skonfiguruj Yomitan:

- URL AnkiConnect powinien wskazywać serwer proxy AnkiConnect zamiast samego AnkiConnect. Domyślny URL proxy to <code>{webSocketHttpUrl}</code>.
- Yomitan powinien używać tego samego **typu notatki** co asbplayer.

Kopanie zdań za pomocą Yomitan od razu uzupełnia definicję słowa, obraz i dźwięk. Aby tworzyć fiszki jednym kliknięciem, ustaw `POST_MINE_ACTION` serwera proxy na `2` (aktualizacja ostatniej karty). Szczegóły znajdziesz w sekcji [konfiguracji serwera](#server-configuration).

Aby zawsze używać tekstu napisów asbplayera w polu Zdanie, włącz w ustawieniach **Kopania** opcję [**Zawsze używaj tekstu napisów w polu zdania**](../reference/settings.md#always-use-subtitle-text-for-sentence-field). Zastąpi ona tekst zdania z Yomitan tekstem napisu ze wszystkich ścieżek, z którego tworzysz fiszkę.

## Dokumentacja API {#api-reference}

Opis poleceń, które można wysyłać do asbplayera przez połączenie WebSocket, znajdziesz w [dokumentacji technicznej](../reference/external-api.md#commands).

## API oparte na HTTP {#http-based-api}

Serwer WebSocket udostępnia API oparte na HTTP, które uruchamia opisane powyżej polecenia.

- `POST asbplayer/load-subtitles` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/load-subtitles`}>script</a>)
- `POST asbplayer/seek` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/seek`}>script</a>)
- `GET asbplayer/bound-media` (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/bound-media`}>script</a>)
- `GET asbplayer/subtitles` (optional `?mediaId=...&trackNumbers=0,1`) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/subtitles`}>script</a>)

## Serwer proxy AnkiConnect {#ankiconnect-proxy}

Serwer WebSocket działa również jako serwer proxy AnkiConnect, który umożliwia uzupełnianie żądań `addNote` o kontekst dostarczany przez asbplayera, na przykład dźwięk i zrzuty ekranu.

Serwer proxy przekazuje wszystkie żądania AnkiConnect bez zmian, z wyjątkiem `addNote`. Jego działanie w przypadku `addNote` zależy od wartości `POST_MINE_ACTION` w opisanej poniżej konfiguracji.

## Konfiguracja serwera {#server-configuration}

Konfigurację serwera określa plik `.env` umieszczony w tym samym katalogu co serwer. Poniżej znajduje się przykładowy plik z objaśnieniami.

```
# Port that the proxy will listen on
PORT=8766

# AnkiConnect URL
ANKI_CONNECT_URL=http://127.0.0.1:8765

# Action for asbplayer to take when the proxy receives an addNote request
# 0 = 'None'
# 1 = 'Open Anki dialog'
# 2 = 'Update last card' (updates last card with asbplayer media AFTER passing through original addNote request)
# 3 = 'Export card'
POST_MINE_ACTION=2
```
