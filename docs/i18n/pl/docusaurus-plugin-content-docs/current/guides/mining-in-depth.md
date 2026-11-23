---
sidebar_position: 3
---

import NoteAddIcon from '@site/src/components/NoteAddIcon';
import ImageIcon from '@site/src/components/ImageIcon';

# Kopanie — szczegóły {#mining-in-depth}

Za pomocą asbplayera możesz tworzyć fiszki ze zdań na różne sposoby, zależnie od swoich potrzeb i preferencji.

## Otwieranie okna eksportu Anki {#opening-the-anki-export-dialog}

**Okno eksportu Anki** można otworzyć na kilka sposobów:

1. Przycisk **Wykop napis** <NoteAddIcon /> dostępny na **liście napisów** w **panelu bocznym** lub na stronie.
2. Przycisk **Wykop napis** <NoteAddIcon /> w **nakładce sterowania** podczas odtwarzania wideo strumieniowego lub na stronie mobilnej.
3. Skrót klawiszowy [Wykop bieżący napis i otwórz okno Anki](../reference/settings.md#mining-keyboard-shortcuts) — domyślnie `Ctrl + Shift + X`.
4. Kliknij prawym przyciskiem myszy wideo strumieniowe i wybierz **asbplayer → Wykop napis**.

:::info
Sposoby 1 i 2 otworzą okno tylko wtedy, gdy [domyślna czynność przycisku kopania](../reference/settings#mining-button-default-action) jest ustawiona na „Pokaż okno Anki”.
:::

:::info
Jeśli wczytano _pustą_ ścieżkę napisów i włączono nagrywanie dźwięku, pierwsze użycie każdej z powyższych czynności rozpocznie nagrywanie dźwięku, a drugie otworzy okno Anki.
:::

## Edytowanie fiszek {#adjusting-cards}

Przed wyeksportowaniem fiszkę można zmienić w oknie dialogowym.

### Wybrany zakres czasu {#selected-time-range}

Suwak u dołu okna pozwala zmienić wybrany zakres czasu.

- Jeśli pole **Zdanie** nie zostało wcześniej zmienione ręcznie, jego zawartość zostanie automatycznie dopasowana do wybranego zakresu czasu.
- W przypadku plików lokalnych klip dźwiękowy również zostanie zaktualizowany automatycznie.
- W przypadku wideo strumieniowego można ponownie nagrać klip dźwiękowy dla wybranego zakresu czasu.

### Pole dźwięku {#audio-field}

W polu **Dźwięk** wyświetla się nagrany klip. Dostępne są trzy przyciski:

- **Odtwórz/Wstrzymaj** — odsłuchaj klip bezpośrednio w oknie dialogowym.
- **Nagraj ponownie** — nagraj dźwięk ponownie dla wybranego zakresu czasu (tylko wideo strumieniowe; przycisk pojawia się, gdy ponowne nagranie jest dostępne).
- **Pobierz** — pobierz klip dźwiękowy na urządzenie.

### Pola tekstowe {#text-fields}

Możesz edytować dowolne pole tekstowe: zdanie, definicję, słowo, pola niestandardowe, źródło, URL i tagi. Do uzupełniania definicji zwykle używa się osobnej aplikacji słownikowej.

### Pole obrazu {#image-field}

W przypadku plików lokalnych kliknięcie **przycisku podglądu** <ImageIcon /> w polu **Obraz** pozwala zmienić znacznik czasu wideo, z którego zostanie pobrany zrzut ekranu.

## Eksportowanie fiszek {#exporting-cards}

Aby wyeksportować fiszkę, użyj przycisków u dołu okna. Dostępne są trzy sposoby:

1. **Eksportuj**: wyeksportuj fiszkę z zawartością okna dialogowego.
2. **Zaktualizuj ostatnią kartę**: zaktualizuj ostatnią kartę w talii Anki, używając zawartości okna dialogowego.
3. **Otwórz w Anki**: otwórz w Anki kreator kart z wypełnionymi polami.

## Kopanie bez okna dialogowego {#dialog-less-mining-flows}

Możesz tworzyć fiszki z definicją słowa bez otwierania okna Anki, łącząc asbplayera z aplikacją słownikową zintegrowaną z Anki. Obecnie najpopularniejszą taką aplikacją jest [Yomitan](https://yomitan.wiki/).

### Aktualizowanie ostatniej karty {#update-last-card}

Proces kopania fiszki bez okna dialogowego z użyciem Yomitan wygląda tak:

1. Zaznacz w napisach za pomocą Yomitan słowo, z którego chcesz utworzyć fiszkę.
2. Utwórz kartę za pomocą przycisku tworzenia kart w Yomitan.
3. Od razu użyj w asbplayerze skrótu [do aktualizacji ostatniej karty](../reference/settings.md#mining-keyboard-shortcuts) — `Ctrl + Shift + U` — aby uzupełnić ją treścią dostarczoną przez asbplayera.

Wadą tego sposobu jest brak możliwości zmiany karty w oknie dialogowym. Można to jednak obejść na dwa sposoby:

- Zamiast od razu aktualizować ostatnią kartę, użyj `Ctrl + Shift + X`, aby otworzyć okno, zmienić kartę, a następnie kliknij **Zaktualizuj ostatnią kartę**. W ten sposób nadal korzystasz z okna dialogowego, zachowując automatycznie dodaną definicję słowa z Yomitan.
- **Okno eksportu Anki** można też otworzyć _po_ utworzeniu karty, używając skrótu [ręcznego wykonywania zrzutu ekranu](../reference/settings.md#mining-keyboard-shortcuts) — domyślnie `Ctrl + Shift + V`.

### Jedno kliknięcie {#one-click}

Zobacz przewodnik [kopania jednym kliknięciem](./one-click-mining.md).
