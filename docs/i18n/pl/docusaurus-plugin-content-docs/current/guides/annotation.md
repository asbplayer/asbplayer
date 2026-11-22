---
sidebar_position: 1
---

import project from '@site/src/project';

# Adnotacje {#annotation}

asbplayer może dodawać adnotacje do napisów, aby ułatwić naukę języka. Funkcje adnotacji obejmują:

- **Stylizacja słów**: zmiana koloru, podkreślenie, obramowanie i inne efekty zależne od statusu słowa
    - status znajomości słów można pobierać i synchronizować z Anki lub WaniKani, a także śledzić lokalnie w asbplayerze (dostępne są funkcje importowania i eksportowania, które ułatwiają uzupełnianie znanych słów)
- **Adnotacje odczytu**: odczyty wyświetlane nad każdym słowem lub zależnie od jego statusu
- **Adnotacje częstotliwości**: częstotliwość oparta na rankingu wyświetlana pod każdym słowem lub zależnie od jego statusu (wymaga co najmniej jednego słownika częstotliwości opartego na rankingu)
- **Adnotacje akcentu wyrazowego**: wzorce akcentu wyświetlane nad furiganą lub słowami zapisanymi kana (wymaga co najmniej jednego słownika akcentu wyrazowego)
- **Adnotacje glosariusza**: krótkie definicje lub objaśnienia wyświetlane przy każdym słowie
- **Statystyki i rozumienie**: informacje o znanych Ci słowach w bieżącym materiale.
- **Adaptacyjne odtwarzanie**: wykorzystuje tryby odtwarzania i dane adnotacji, aby dostosować naukę.
- **Przeglądarka słów**: zarządzanie słowami lokalnymi i przeglądanie słów synchronizowanych ze źródeł zewnętrznych.
- **Wiele kolejnych funkcji w przyszłych wydaniach!**

:::info
Adnotacje wymagają skonfigurowanej instancji [Yomitan](https://yomitan.wiki/) oraz [yomitan-api](https://github.com/yomidevs/yomitan-api).

Jeśli korzystasz z **lokalnej bazy słów**, zalecamy zainstalowanie rozszerzenia przeglądarki asbplayer, aby ograniczyć ryzyko usunięcia zapisanych słów przez przeglądarkę. Jeśli nie możesz zainstalować rozszerzenia, rozważ regularne eksportowanie ustawień lub lokalnych słów jako kopii zapasowej.
:::

## Konfiguracja {#setup}

1. Otwórz **ustawienia** asbplayera.
2. Przejdź do sekcji **Adnotacje**.
3. Wybierz ścieżkę, którą chcesz skonfigurować.
4. Skonfiguruj **URL Yomitan** dla tej ścieżki.
    - Potrzebujesz skonfigurowanej instancji [Yomitan](https://yomitan.wiki/) i [yomitan-api](https://github.com/yomidevs/yomitan-api).
    - Jeśli URL jest nieprawidłowy lub niedostępny, asbplayer wyświetli błąd obok ustawienia.
    - Informacje o częstotliwości wymagają dostępności w Yomitanie co najmniej jednego słownika częstotliwości opartego na rankingu.
5. (Użytkownicy Anki) Skonfiguruj, z których kart pobierać informacje o statusie znajomości słów.
    - Zazwyczaj pole [`Talie Anki`](../reference/settings.md#anki-decks) należy pozostawić puste, aby uwzględnić wszystkie talie. Filtrowanie według pól zwykle wystarczy.
    - [`Pola słów Anki`](../reference/settings.md#anki-word-fields) wskazują pole notatki Anki zawierające wyłącznie dane słowo.
    - [`Pola zdań Anki`](../reference/settings.md#anki-sentence-fields) należy stosować tylko w notatkach Anki bez osobnego pola słowa (np. w taliach ze zdaniami). Słowa z tych pól są używane zapasowo, gdy słowa nie ma w polach słów Anki.
    - Aby wypełnić bazę, po skonfigurowaniu tych pól użyj opcji [`Odbuduj bazę słów Anki`](../reference/settings.md#re-build-anki-word-database).
6. (Użytkownicy WaniKani) Otwórz [WaniKani > Ustawienia > Tokeny API](https://www.wanikani.com/settings/personal_access_tokens), aby utworzyć token dla asbplayera.
    - W polu `Token Description` wpisz `asbplayer`, a wszystkie opcje `Permissions` pozostaw niezaznaczone. asbplayer potrzebuje tylko dostępu do odczytu Twojego konta WaniKani.
    - Kliknij `Generate token` i wklej wygenerowany token w polu [`Token API WaniKani`](../reference/settings.md#wanikani-api-token).
    - Aby wypełnić bazę, po skonfigurowaniu tokenu API użyj opcji [`Odbuduj bazę słów WaniKani`](../reference/settings.md#re-build-wanikani-word-database).
7. Włącz wybrane funkcje adnotacji dla tej ścieżki (stylizację, odczyt, częstotliwość, akcent wyrazowy itp.). Dostosuj pozostałe ustawienia według potrzeb.
8. Szczegółowe objaśnienia opcji znajdziesz w sekcji [Adnotacje](../reference/settings.md#annotation) dokumentacji ustawień. Skróty klawiszowe wymieniono w grupie [Skróty klawiszowe adnotacji](../reference/settings.md#annotation-keyboard-shortcuts).

## Rozwiązywanie problemów {#troubleshooting}

Informacje o rozwiązywaniu problemów z adnotacjami znajdziesz w sekcji [częstych problemów](../common-issues.md#annotation). Jeśli nie ma tam rozwiązania, skontaktuj się z nami na <a href={project.urls.discord}>Discordzie</a> lub prześlij <a href={`${project.urls.repo}/issues`}>zgłoszenie błędu</a> z jego szczegółowym opisem i krokami pozwalającymi go odtworzyć.
