---
sidebar_position: 11
---

import project from '@site/src/project';

# Napisy online {#online-subtitles}

Zamiast ręcznie szukać plików z napisami, możesz wyszukać je i wczytać bezpośrednio z asbplayera. Napisy udostępnia [Jimaku](https://jimaku.cc), społecznościowy serwis z napisami, głównie do anime i japońskich seriali.

## Użycie {#usage}

1. Otwórz panel boczny na stronie z wideo i kliknij **Wczytaj napisy**.
2. Kliknij **Wyszukaj napisy online** (ta opcja jest też dostępna na liście ścieżek napisów).
3. Pole wyszukiwania zostanie wstępnie wypełnione tytułem strony. W razie potrzeby zmień go, wybierz **Anime** lub **Dramat** i rozpocznij wyszukiwanie.
4. Kliknij wynik wyszukiwania, aby zobaczyć pliki z napisami, a następnie kliknij plik, aby go wczytać.

Wyświetlane są tylko pliki `.srt` i `.ass`. Ostatnio otwierane tytuły pojawiają się w sekcji **Ostatnie**, więc przy kolejnym użyciu możesz pominąć wyszukiwanie.

## Uzyskiwanie klucza API Jimaku {#api-key}

Wyszukiwanie i pobieranie z Jimaku wymaga klucza API.

1. Utwórz konto w serwisie [jimaku.cc](https://jimaku.cc) i zaloguj się.
2. Otwórz [stronę konta](https://jimaku.cc/account) i wygeneruj klucz API.
3. Wklej klucz w pole **Klucz API Jimaku** w oknie wyszukiwania.

Klucz zostanie zapisany automatycznie, więc wystarczy wykonać te czynności raz. Domyślnie jest ukryty; kliknij ikonę oka, aby go wyświetlić.

## Automatyczne wykrywanie odcinka {#episode-detection}

W przypadku seriali asbplayer próbuje odczytać numer odcinka z tytułu strony (na przykład `S01E05`, `EP05` albo `第5話`/`第五集`). Jeśli go znajdzie:

- usuwa oznaczenie odcinka z wyszukiwanego hasła, dzięki czemu wyszukiwana jest sama nazwa serialu;
- filtruje listę plików do tego odcinka, wyświetlanego jako etykieta **EP N**. Kliknij ✕ na etykiecie, aby zobaczyć wszystkie pliki.

Jeśli dla wybranego odcinka nie ma użytecznych plików z napisami, wyświetli się pełna lista.

### Niestandardowe wyrażenie regularne odcinka {#episode-regex}

Niektóre strony stosują formaty tytułów, których wbudowane reguły nie rozpoznają. W takiej sytuacji odcinek nie zostaje wykryty i wyświetlane są wszystkie pliki serialu. Niestandardowe wyrażenie regularne pozwala asbplayerowi rozpoznawać odcinki na tych stronach.

Po otwarciu serialu kliknij ikonę koła zębatego obok nagłówka listy plików, aby wyświetlić pole **Niestandardowe wyrażenie regularne odcinka**. Ikona jest podświetlona, gdy ustawiono wyrażenie.

- **Grupa przechwytująca 1** musi zawierać numer odcinka (działają zarówno cyfry arabskie, jak i kanji).
- Najpierw sprawdzane jest Twoje wyrażenie. Jeśli jest puste, nieprawidłowe lub nie pasuje, używane są zwykłe wbudowane reguły, więc niestandardowe wyrażenie może jedynie zwiększyć zakres wykrywania.
- Naciśnij **Enter**, aby ponownie odfiltrować bieżący serial. Zmienione wyrażenie zostanie zastosowane do wyszukiwanego hasła przy następnym otwarciu okna.

:::tip
Wbudowane reguły przetestowano tylko na kilku stronach używanych przez autora tej funkcji. Jeśli format tytułu na danej stronie nie jest rozpoznawany, <a href={`${project.urls.repo}/issues`}>zgłoś problem</a> i podaj przykładowy tytuł strony (lub utwórz PR zmieniający `common/subtitle-sources/jimaku-episode-patterns.ts`), aby można było rozszerzyć wbudowane reguły.
:::

Na przykład jeśli strona nadaje tytuły w formacie `Some Show - Chapter 07 | SiteName`, użyj:

```
Chapter (\d+)
```

## Podziękowania {#jimaku-acknowledgements}

Wielkie podziękowania dla [Rapptz](https://github.com/Rapptz), autora i opiekuna [Jimaku](https://github.com/Rapptz/jimaku), który udostępnia API umożliwiające działanie tej funkcji. Jeśli jest dla Ciebie przydatna, rozważ wsparcie serwisu i przesłanie własnych napisów.
