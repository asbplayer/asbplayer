---
sidebar_position: 3
---

import project from '@site/src/project';

import CodeBlock from '@theme/CodeBlock'; // Empty fenced code blocks lose their title and copy button; CodeBlock preserves both.

# Untertiteltext filtern {#subtitle-text-filtering}

Wenn Sie bestimmte Teile des Untertiteltexts herausfiltern möchten, können Sie dafür einen regulären Ausdruck (Regex) verwenden. asbplayer kann jede Zeichenfolge finden, die einem angegebenen Regex-Muster entspricht, und die Treffer entfernen.

## Regex-Filter konfigurieren {#configure-the-regex-filter}

Suchen Sie in den asbplayer-Einstellungen im Abschnitt <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Sonstiges</a> das Textfeld „Regex-Filter für Untertitel“. Geben Sie einen passenden Regex ein, um den gewünschten Inhalt herauszufiltern.
Sie können den herausgefilterten Inhalt ersetzen, indem Sie eine Zeichenfolge in das Textfeld „Ersatztext für Regex-Filter“ eingeben. Wenn Sie es leer lassen, wird der Inhalt einfach entfernt.

### Sprechernamen entfernen {#remove-speaker-names}

Entfernt Namen in Klammern, die Sprecher kennzeichnen (z. B. „**（山田）**　元気ですか？“).

<details>
<summary>Diesen Filter verwenden</summary>

```text title="Subtitle regex filter"
([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Japanische Lesungen beibehalten {#preserve-japanese-readings}

Entfernt Namen oder Beschreibungen in Klammern, behält aber direkt auf japanischen Text folgende japanische Lesungen bei. Zum Beispiel wird `（山田）漢字(かんじ)を読む。` zu `漢字(かんじ)を読む。`. Sowohl `(かんじ)` als auch `（かんじ）` bleiben erhalten, wenn ihnen unmittelbar ein Zeichen aus den im Regex angegebenen Kanji-, Hiragana- oder Katakana-Bereichen vorausgeht.

Dies ist eine Näherung: Sie behält auch Beschreibungen direkt nach japanischem Text bei, etwa `こんにちは（笑）`, und entfernt Lesungen, die durch ein Leerzeichen von ihrem Grundtext getrennt sind. Verschachtelte Klammern werden nicht verarbeitet. Lassen Sie „Ersatztext für Regex-Filter“ leer.

<details>
<summary>Diesen Filter verwenden</summary>

```text title="Subtitle regex filter"
(?<![一-龯ぁ-ゟ゠-ヿ])[\(（][^\)）]*[\)）]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Untertitelzeilen zusammenführen {#merge-subtitle-lines}

Einige Untertitel sind auf mehrere Zeilen verteilt. Dieser Regex führt sie zu einer einzigen Zeile zusammen. Damit der Filter funktioniert, müssen Sie außerdem `$1 $2` in das Feld „Ersatztext für Regex-Filter“ eingeben.

Wenn Sie dieses Muster mit anderen kombinieren, setzen Sie es ans Ende, damit eine spezifischere Alternative an derselben Stelle zuerst passen kann. Alternativen werden nicht in getrennten Filterdurchläufen angewendet. Für jeden Treffer wird derselbe Ersatztext verwendet. Wenn Sie in anderen Alternativen Erfassungsgruppen hinzufügen, ändern sich die Nummern, die in `$1 $2` verwendet werden müssen.

<details>
<summary>Diesen Filter verwenden</summary>

```text title="Subtitle regex filter"
(.*)\n+(?!-)(.*)
```

```text title="Subtitle regex filter text replacement"
$1 $2
```

</details>

### Zeilenumbrüche entfernen {#remove-newlines}

Entfernt alle Zeilenumbruchzeichen, ohne Leerzeichen einzufügen. So werden beispielsweise zwei Zeilen mit `こんにちは` und `世界` zu `こんにちは世界`. Lassen Sie „Ersatztext für Regex-Filter“ leer. Um stattdessen ein Leerzeichen zwischen den Zeilen einzufügen, verwenden Sie das Beispiel zum [Zusammenführen von Untertitelzeilen](#merge-subtitle-lines).

<details>
<summary>Diesen Filter verwenden</summary>

```text title="Subtitle regex filter"
\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Beschreibungen in eckigen Klammern entfernen {#remove-bracketed-descriptions}

Entfernt in eckigen Klammern stehende Hinweise auf Geräusche oder Musik (z. B. „**\[FRÖHLICHE MUSIK]**“ oder „**\-[KEUCHEN]**“).

<details>
<summary>Diesen Filter verwenden</summary>

```text title="Subtitle regex filter"
-?\[.*\]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Beschreibungen in Großbuchstaben entfernen {#remove-uppercase-descriptions}

Als Alternative zum obigen Filter können Sie Beschreibungen in Großbuchstaben herausfiltern, die nicht in eckigen Klammern stehen (z. B. „**FRÖHLICHE MUSIK**“). Wenn Ihre Sprache weitere Buchstaben mit diakritischen Zeichen verwendet, können Sie diese der Liste hinzufügen.

<details>
<summary>Diesen Filter verwenden</summary>

```text title="Subtitle regex filter"
^[\-\(\)\.\s\p{Lu}]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Musikzeichen entfernen {#remove-music-symbols}

Entfernt einzelne Zeichenkombinationen, die Musik darstellen (z. B. `♪♬♪`).

<details>
<summary>Diesen Filter verwenden</summary>

```text title="Subtitle regex filter"
[♪♬#～〜]+
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Geräuschhinweise entfernen {#remove-sound-effect-cues}

Entfernt Untertitel, die vollständig aus einer Beschreibung in Klammern oder Musikzeichen bestehen, etwa `[DONNERGROLLEN]`, `-[KEUCHEN]` oder `♪♬♪`. Die Anker `^` und `$` erfordern eine Übereinstimmung mit dem gesamten Untertiteltext. Dialoge wie `Hallo [KEUCHEN]` oder `♪ Hallo ♪` bleiben daher erhalten. Lassen Sie „Ersatztext für Regex-Filter“ leer.

<details>
<summary>Diesen Filter verwenden</summary>

```text title="Subtitle regex filter"
^-?\[.+\]$|^[♪♬#～〜]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Links-nach-rechts-Zeichen entfernen {#remove-left-to-right-marks}

Entfernt U+200E, das unsichtbare Links-nach-rechts-Zeichen (LRM). So wird Text mit `Hallo`, einem LRM und `Welt` zu `HalloWelt`. Geben Sie im Regex-Feld die Escape-Sequenz `\u200E` ein und lassen Sie „Ersatztext für Regex-Filter“ leer.

<details>
<summary>Diesen Filter verwenden</summary>

```text title="Subtitle regex filter"
\u200E
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Bidirektionale Steuerzeichen entfernen {#remove-bidi-controls}

Entfernt alle bidirektionalen Unicode-Steuerzeichen, einschließlich des Links-nach-rechts-Zeichens (U+200E), des Rechts-nach-links-Zeichens (U+200F) sowie der Einbettungs-, Überschreibungs- und Isolierungssteuerzeichen. Lassen Sie „Ersatztext für Regex-Filter“ leer. Diese Zeichen können die Anzeigereihenfolge von rechts-nach-links geschriebenem Text oder Text mit gemischter Schreibrichtung beeinflussen. Verwenden Sie diesen Filter daher nur, wenn Sie sie entfernen möchten.

<details>
<summary>Diesen Filter verwenden</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Regexe kombinieren {#combining-regexes}

Reguläre Ausdrücke lassen sich mit dem Zeichen `|` kombinieren (Leerzeichen sind nicht erforderlich). Wenn Sie beispielsweise die beiden obigen Regexe verwenden möchten, können Sie `-?\[.*\]|[♪♬#～〜]+` eingeben. Auf diese Weise können Sie beliebig viele Regexe kombinieren.

### Text in Klammern und Zeilenumbrüche entfernen {#remove-parenthesized-text-and-newlines}

Um Text in Klammern und alle Zeilenumbrüche gleichzeitig zu entfernen, verwenden Sie:

Lassen Sie „Ersatztext für Regex-Filter“ leer. So werden beispielsweise `（山田）こんにちは`, ein Zeilenumbruch und `世界` zu `こんにちは世界`. Der Filter entfernt normale und japanische Klammern samt Inhalt, einschließlich japanischer Lesungen, und fügt Zeilen ohne Leerzeichen zusammen. Verschachtelte Klammern werden nicht verarbeitet. Verwenden Sie dafür das Beispiel zum [Entfernen von Sprechernamen](#remove-speaker-names).

<details>
<summary>Diesen Filter verwenden</summary>

```text title="Subtitle regex filter"
[\(（][^\)）]*[\)）]|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Alle Filter zum Entfernen kombinieren {#combine-all-removal-filters}

Um zusätzlich bidirektionale Steuerzeichen, Sprechernamen in Klammern (einschließlich verschachtelter Klammern), Beschreibungen in eckigen Klammern und Musikzeichen zu entfernen, verwenden Sie:

Lassen Sie „Ersatztext für Regex-Filter“ leer. Dieser Filter kombiniert die obigen Beispiele und fügt Zeilen ohne Leerzeichen zusammen. Er entfernt auch japanische Lesungen. Wenn Sie sie beibehalten möchten, verwenden Sie das Beispiel zum [Beibehalten japanischer Lesungen](#preserve-japanese-readings).

<details>
<summary>Diesen Filter verwenden</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}|([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])|-?\[.*\]|[♪♬#～〜]+|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

## Unsichtbare Zeichen und leere Untertitel {#invisible-characters}

Ein scheinbar leerer Untertitel kann unsichtbare Zeichen wie ein LRM enthalten. asbplayer verwirft nach dem Parsen und Filtern Textanzeigen, die nur aus Leerraum, Steuerzeichen oder standardmäßig ignorierbaren Unicode-Zeichen bestehen. Richtungszeichen in sinnvoll lesbarem Text bleiben erhalten, sofern Ihr Regex sie nicht ausdrücklich entfernt.

Unsichtbare Zeichen am Anfang oder Ende einer Anzeige können verhindern, dass ein verankertes Muster wie `^\[.+\]$` passt. Wenn das Muster nicht passt, versucht asbplayer es erneut, nachdem Leerraum und unsichtbare Steuerzeichen am Rand entfernt wurden. Die Anzeige wird jedoch nur verworfen, wenn bei diesem Versuch kein sinnvoll lesbarer Text übrig bleibt. Beispielsweise wird `[DONNER]` mit einem nachfolgenden LRM durch dieses Muster und einen leeren Ersatz entfernt. Ergibt der Ersatztext sinnvollen Inhalt, bleibt die ursprüngliche Anzeige erhalten.

Wenn Sie ein verankertes Muster mit einer Alternative zum Entfernen bidirektionaler Steuerzeichen kombinieren, bedenken Sie, dass Ersetzungen in einem einzigen Durchlauf erfolgen. Auf `[DONNER]` mit einem nachfolgenden LRM angewendet, entfernt `^\[.+\]$|\u200E` zwar das LRM, versucht danach aber nicht erneut, die Beschreibung in Klammern zu entfernen. Um beides im selben Durchlauf zu entfernen, verwenden Sie das nicht verankerte Muster `\[.+\]|\p{Bidi_Control}` mit einem leeren Ersatz. Dadurch werden auch Beschreibungen in Klammern innerhalb von Dialogen entfernt.

## Lernen {#learn}

Wie Sie eigene reguläre Ausdrücke schreiben und testen, erfahren Sie unter [Regex Learn – Playground](https://regexlearn.com/playground).
