---
sidebar_position: 3
---

import project from '@site/src/project';

import CodeBlock from '@theme/CodeBlock'; // Empty fenced code blocks lose their title and copy button; CodeBlock preserves both.

# Filtrowanie tekstu napisów {#subtitle-text-filtering}

Jeśli chcesz odfiltrować określone fragmenty tekstu napisów, możesz użyć wyrażenia regularnego (regexu). asbplayer dopasowuje sekwencje zgodne z podanym wzorcem i usuwa dopasowania.

## Konfiguracja filtra wyrażeń regularnych {#configure-the-regex-filter}

W sekcji <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Różne</a> ustawień asbplayera znajdź pole „Filtr napisów wyrażeniem regularnym” i wpisz regex filtrujący wybraną treść.
Możesz zastąpić odfiltrowaną treść, wpisując tekst w polu „Tekst zastępujący w filtrze napisów”. Jeśli pozostawisz je puste, treść zostanie usunięta.

### Usuwanie imion i nazwisk mówiących {#remove-speaker-names}

Usuń imiona i nazwiska mówiących zapisane w nawiasach (np. „**（山田）**　元気ですか？”).

<details>
<summary>Użyj tego filtra</summary>

```text title="Subtitle regex filter"
([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Zachowywanie japońskich odczytów {#preserve-japanese-readings}

Usuń nazwy lub opisy w nawiasach, zachowując japońskie odczyty bezpośrednio po japońskim tekście. Na przykład `（山田）漢字(かんじ)を読む。` zmienia się w `漢字(かんじ)を読む。`. Zarówno `(かんじ)`, jak i `（かんじ）` zostają zachowane, jeśli poprzedza je znak z zakresu kanji, hiragany lub katakany wskazanego w regexie.

To heurystyka: zachowuje również opisy bezpośrednio po japońskim tekście, takie jak `こんにちは（笑）`, a usuwa odczyty oddzielone spacją od tekstu podstawowego. Nie obsługuje zagnieżdżonych nawiasów. Pozostaw pole „Tekst zastępujący w filtrze napisów” puste.

<details>
<summary>Użyj tego filtra</summary>

```text title="Subtitle regex filter"
(?<![一-龯ぁ-ゟ゠-ヿ])[\(（][^\)）]*[\)）]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Łączenie wierszy napisów {#merge-subtitle-lines}

Niektóre napisy są podzielone na kilka wierszy. Ten regex łączy je w jeden wiersz. Aby filtr działał, wpisz również `$1 $2` w polu „Tekst zastępujący w filtrze napisów”.

Jeśli łączysz ten wzorzec z innymi, umieść go na końcu, aby bardziej szczegółowa alternatywa mogła najpierw dopasować ten sam fragment. Alternatywy nie są stosowane w osobnych przebiegach filtra. Każde dopasowanie używa tego samego tekstu zastępczego, a dodanie grup przechwytujących w innych alternatywach zmienia numery wymagane w `$1 $2`.

<details>
<summary>Użyj tego filtra</summary>

```text title="Subtitle regex filter"
(.*)\n+(?!-)(.*)
```

```text title="Subtitle regex filter text replacement"
$1 $2
```

</details>

### Usuwanie znaków nowej linii {#remove-newlines}

Usuń wszystkie znaki nowej linii bez wstawiania spacji. Na przykład dwa wiersze zawierające `こんにちは` i `世界` zmienią się w `こんにちは世界`. Pozostaw pole „Tekst zastępujący w filtrze napisów” puste. Aby zamiast tego wstawić spację między wierszami, użyj [przykładu łączenia wierszy napisów](#merge-subtitle-lines).

<details>
<summary>Użyj tego filtra</summary>

```text title="Subtitle regex filter"
\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Usuwanie opisów w nawiasach kwadratowych {#remove-bracketed-descriptions}

Usuń zapisy w nawiasach kwadratowych opisujące odtwarzany dźwięk lub muzykę (np. „**\[PLAYFUL MUSIC]**” lub „**\-[GASPS]**”).

<details>
<summary>Użyj tego filtra</summary>

```text title="Subtitle regex filter"
-?\[.*\]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Usuwanie opisów zapisanych wielkimi literami {#remove-uppercase-descriptions}

Zamiast powyższego możesz odfiltrować opisy zapisane wielkimi literami, ale bez nawiasów kwadratowych (np. „**PLAYFUL MUSIC**”). Jeśli Twój język zawiera dodatkowe litery ze znakami diakrytycznymi, możesz je dodać do tej listy.

<details>
<summary>Użyj tego filtra</summary>

```text title="Subtitle regex filter"
^[\-\(\)\.\s\p{Lu}]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Usuwanie symboli muzycznych {#remove-music-symbols}

Dowolna kombinacja symboli muzycznych bez dodatkowego tekstu (np. `♪♬♪`).

<details>
<summary>Użyj tego filtra</summary>

```text title="Subtitle regex filter"
[♪♬#～〜]+
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Usuwanie opisów efektów dźwiękowych {#remove-sound-effect-cues}

Usuń napisy zawierające wyłącznie opis w nawiasach lub symbole muzyczne, takie jak `[THUNDER RUMBLING]`, `-[GASPS]` lub `♪♬♪`. Kotwice `^` i `$` wymagają dopasowania całego tekstu napisu, dlatego dialogi takie jak `Hello [GASPS]` lub `♪ Hello ♪` pozostają. Pozostaw pole „Tekst zastępujący w filtrze napisów” puste.

<details>
<summary>Użyj tego filtra</summary>

```text title="Subtitle regex filter"
^-?\[.+\]$|^[♪♬#～〜]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Usuwanie znaków od lewej do prawej {#remove-left-to-right-marks}

Usuń U+200E, niewidoczny znak od lewej do prawej (LRM). Na przykład tekst zawierający `Hello`, LRM i `world` zmieni się w `Helloworld`. Wpisz dosłowny ciąg ucieczki `\u200E` w polu regexu, a pole „Tekst zastępujący w filtrze napisów” pozostaw puste.

<details>
<summary>Użyj tego filtra</summary>

```text title="Subtitle regex filter"
\u200E
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Usuwanie znaków sterujących dwukierunkowością {#remove-bidi-controls}

Usuń wszystkie znaki Unicode sterujące dwukierunkowością, w tym znak od lewej do prawej (U+200E), znak od prawej do lewej (U+200F) oraz znaki osadzania, nadpisywania i izolowania. Pozostaw pole „Tekst zastępujący w filtrze napisów” puste. Znaki te mogą wpływać na kolejność wyświetlania tekstu pisanego od prawej do lewej lub tekstu o mieszanym kierunku, dlatego używaj tego filtra tylko wtedy, gdy chcesz je usunąć.

<details>
<summary>Użyj tego filtra</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Łączenie regexów {#combining-regexes}

Wyrażenia regularne można łączyć znakiem `|` (spacje nie są potrzebne). Na przykład, aby użyć dwóch regexów z powyższej listy, wpisz `-?\[.*\]|[♪♬#～〜]+`. W ten sposób możesz połączyć dowolną liczbę wyrażeń regularnych.

### Usuwanie tekstu w nawiasach i znaków nowej linii {#remove-parenthesized-text-and-newlines}

Aby jednocześnie usunąć tekst w nawiasach i wszystkie znaki nowej linii, użyj:

Pozostaw pole „Tekst zastępujący w filtrze napisów” puste. Na przykład `（山田）こんにちは`, po którym następuje znak nowej linii i `世界`, zmieni się w `こんにちは世界`. Filtr usuwa nawiasy ASCII i nawiasy pełnej szerokości wraz z zawartością, w tym japońskimi odczytami, a następnie łączy wiersze bez wstawiania spacji. Nie obsługuje zagnieżdżonych nawiasów; w takim przypadku użyj [przykładu usuwania imion i nazwisk mówiących](#remove-speaker-names).

<details>
<summary>Użyj tego filtra</summary>

```text title="Subtitle regex filter"
[\(（][^\)）]*[\)）]|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Łączenie wszystkich filtrów usuwających {#combine-all-removal-filters}

Aby dodatkowo usunąć znaki sterujące dwukierunkowością, imiona i nazwiska mówiących w nawiasach (również zagnieżdżonych), opisy w nawiasach kwadratowych i symbole muzyczne, użyj:

Pozostaw pole „Tekst zastępujący w filtrze napisów” puste. Ten filtr łączy powyższe przykłady i scala wiersze bez wstawiania spacji. Usuwa również japońskie odczyty; jeśli chcesz je zachować, użyj [przykładu zachowywania odczytów](#preserve-japanese-readings).

<details>
<summary>Użyj tego filtra</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}|([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])|-?\[.*\]|[♪♬#～〜]+|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

## Niewidoczne znaki i puste napisy {#invisible-characters}

Pozornie pusty napis może zawierać niewidoczne znaki, takie jak LRM. Po parsowaniu i filtrowaniu asbplayer usuwa napisy zawierające wyłącznie białe znaki, znaki sterujące lub znaki Unicode domyślnie ignorowane. Znaki kierunku w treści zawierającej tekst są zachowywane, chyba że regex jawnie je usuwa.

Niewidoczne znaki na początku lub końcu napisu mogą uniemożliwić dopasowanie wzorca z kotwicami, takiego jak `^\[.+\]$`. Jeśli wzorzec nie pasuje, asbplayer ponawia próbę bez otaczających białych znaków i niewidocznych znaków sterujących, ale usuwa napis tylko wtedy, gdy po tej próbie nie pozostanie żadna znacząca treść. Na przykład `[THUNDER]` zakończone znakiem LRM zostanie usunięte przez ten wzorzec z pustym tekstem zastępczym. Ponowiona próba zachowuje oryginalny napis, jeśli tekst zastępczy zawierałby znaczącą treść.

Łącząc wzorzec z kotwicami z alternatywą usuwającą znaki dwukierunkowości, pamiętaj, że zamiany odbywają się w jednym przebiegu. Na przykład zastosowanie `^\[.+\]$|\u200E` do `[THUNDER]` zakończonego znakiem LRM usunie LRM, ale nie ponowi potem dopasowania opisu w nawiasach. Aby usunąć oba elementy w jednym przebiegu, użyj wzorca bez kotwic `\[.+\]|\p{Bidi_Control}` i pustego tekstu zastępczego. Usunie on także opisy w nawiasach występujące w dialogach.

## Nauka {#learn}

Dowiedz się, jak pisać i testować własne wyrażenia regularne w [Regex Learn - Playground](https://regexlearn.com/playground).
