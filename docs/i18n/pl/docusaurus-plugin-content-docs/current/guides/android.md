---
sidebar_position: 7.5
---

import project from '@site/src/project';

# Android {#android}

Korzystanie z asbplayera na urządzeniach z Androidem jest możliwe, choć obsługa jest mniej wygodna.

## Strona {#website}

Ze strony można korzystać bez dodatkowej konfiguracji. Zamiast domyślnych elementów sterujących wideo zoptymalizowanych pod komputery wyświetli się **nakładka sterowania**.

### Dodawanie do ekranu głównego {#add-to-home-screen}

Stronę można dodać do ekranu głównego urządzenia z Androidem jako progresywną aplikację internetową. W menu przeglądarki wybierz „Dodaj do ekranu głównego”.

## Rozszerzenie {#extension}

:::warning
**Brakuje wielu funkcji**: **panelu bocznego**, **zrzutów ekranu** i **interfejsu WebSocket**. Zobacz sekcję [zgodności](../compatibility.md#browsers-and-features), w której wymieniono funkcje obsługiwane i nieobsługiwane przez poszczególne przeglądarki.
:::

Podobnie jak na stronie, z rozszerzeniem asbplayer można korzystać głównie za pomocą **nakładki sterowania**. Ponieważ nie ma panelu bocznego, **napisy wczytuje się, wybierając przycisk asbplayer w menu rozszerzeń przeglądarki**. Klawiatura (Bluetooth) nie jest konieczna, ale może się przydać osobom, które wolą używać [skrótów klawiszowych](../reference/settings.md#keyboard-shortcuts) rozszerzenia.

Poniżej wymieniono przeglądarki na Androida, w których można zainstalować asbplayer.

### Firefox na Androida {#firefox-for-android}

Zainstaluj asbplayer ze <a href={project.extension.firefoxAndroid.storeUrl}>strony AMO</a>. Firefox na Androida ma te same ograniczenia co Firefox — nie można nagrywać dźwięku ze strumieni chronionych DRM.

### Edge Canary {#edge-canary}

Edge Canary to kolejna mobilna przeglądarka oparta na Chromium, która obsługuje rozszerzenia. W chwili pisania tego tekstu asbplayer w Edge Canary nie obsługuje nagrywania dźwięku.
Aby zainstalować asbplayer w Edge Canary:

1. Pobierz plik `crx` asbplayera ze <a href={`${project.urls.repo}/releases/latest`}>strony wydań</a>.
2. Jeśli tryb programisty nie jest jeszcze włączony, otwórz ustawienia Edge Canary, przejdź do „Informacje o Microsoft Edge” i kilka razy dotknij numeru kompilacji.
3. W **Opcjach programisty** wybierz **Instalacja rozszerzenia z pliku crx** i wskaż pobrany plik `crx`.

### Kiwi Browser (projekt zakończony) {#kiwi-browser-discontinued}

Kiwi Browser to mobilna przeglądarka oparta na Chromium, która obsługuje rozszerzenia. Jej rozwój został jednak zakończony, a przeglądarkę można zainstalować tylko ze [strony GitHub](https://github.com/kiwibrowser/src.next/releases). Po zainstalowaniu Kiwi Browser można zainstalować asbplayera z <a href={project.extension.chrome.storeUrl}>Chrome Web Store</a>.

## Integracja z Anki {#anki-integration}

Aby zintegrować asbplayera z Anki, zainstaluj [AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid).
