---
sidebar_position: 3
---

import CodeBlock from '@theme/CodeBlock'; // Empty fenced code blocks lose their title and copy button; CodeBlock preserves both.

# Subtitle text filtering {#subtitle-text-filtering}

If you'd like to filter out specific instances subtitle text, one way to do so is by using a regular expression (regex). asbplayer can match any sequence following a specified regex pattern and remove the matches.

## Configure the regex filter {#configure-the-regex-filter}

Under the [misc](https://app.asbplayer.dev/?view=settings#misc-settings) section in asbplayer settings, locate the "Subtitle regex filter" textbox. Enter an appropriate regex to filter desired content.
You can replace filtered content similarly by entering a string into the "Subtitle regex filter text replacement" textbox. Leaving this blank will simply remove the content.

### Remove speaker names {#remove-speaker-names}

Remove names enclosed by parenthesis to indicate speakers (e.g. "**（山田）**　元気ですか？")

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Preserve Japanese readings {#preserve-japanese-readings}

Remove parenthesized names or descriptions while keeping Japanese readings immediately after Japanese text. For example, `（山田）漢字(かんじ)を読む。` becomes `漢字(かんじ)を読む。`. Both `(かんじ)` and `（かんじ）` are preserved when immediately preceded by a character in the kanji, hiragana, or katakana ranges shown in the regex.

This is a heuristic: it also keeps descriptions immediately after Japanese text, such as `こんにちは（笑）`, and removes readings separated from their base text by a space. It does not handle nested parentheses. Leave "Subtitle regex filter text replacement" blank.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
(?<![一-龯ぁ-ゟ゠-ヿ])[\(（][^\)）]*[\)）]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Merge subtitle lines {#merge-subtitle-lines}

Some subtitles are split in several lines and this regex forces them into a single line. For this filter to work, you must also put `$1 $2` in the "Subtitle regex filter text replacement" field.

When combining this pattern with others, keep it last so a more specific alternative can match first at the same position. Alternatives do not run as separate filtering passes. Every match uses the same replacement text, and adding capturing groups in other alternatives changes the numbers needed in `$1 $2`.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
(.*)\n+(?!-)(.*)
```

```text title="Subtitle regex filter text replacement"
$1 $2
```

</details>

### Remove newlines {#remove-newlines}

Remove all newline characters without inserting spaces. For example, two lines containing `こんにちは` and `世界` become `こんにちは世界`. Leave "Subtitle regex filter text replacement" blank. To insert a space between lines instead, use the [merge subtitle lines example](#merge-subtitle-lines).

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Remove bracketed descriptions {#remove-bracketed-descriptions}

Remove indications enclosed by square brackets that sound or music that is playing (e.g. "**\[PLAYFUL MUSIC]**" or "**\-[GASPS]**")

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
-?\[.*\]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Remove uppercase descriptions {#remove-uppercase-descriptions}

As an alternative to the above, filter out descriptions written in capital letters, but without the square brackets (e.g. "**PLAYFUL MUSIC**"). If your language has additional letters with diacritics, you feel free to add them to this list.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
^[\-\(\)\.\s\p{Lu}]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Remove music symbols {#remove-music-symbols}

Any combination of symbols on their own that represent playing music (e.g. `♪♬♪`)

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
[♪♬#～〜]+
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Remove sound effect cues {#remove-sound-effect-cues}

Remove subtitle cues consisting entirely of a bracketed description or music symbols, such as `[THUNDER RUMBLING]`, `-[GASPS]`, or `♪♬♪`. The `^` and `$` anchors require the entire subtitle text to match, so dialogue such as `Hello [GASPS]` or `♪ Hello ♪` is kept. Leave "Subtitle regex filter text replacement" blank.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
^-?\[.+\]$|^[♪♬#～〜]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Remove left-to-right marks {#remove-left-to-right-marks}

Remove U+200E, the invisible left-to-right mark (LRM). For example, text containing `Hello`, an LRM, and `world` becomes `Helloworld`. Enter the literal escape `\u200E` in the regex field and leave "Subtitle regex filter text replacement" blank.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\u200E
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Remove bidirectional controls {#remove-bidi-controls}

Remove all Unicode bidirectional control characters, including the left-to-right mark (U+200E), right-to-left mark (U+200F), and embedding, override, and isolate controls. Leave "Subtitle regex filter text replacement" blank. These characters can affect the display order of right-to-left or mixed-direction text, so use this filter only when you want to remove them.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Combining regexes {#combining-regexes}

Regular expressions can be combined with the character `|` (no spaces needed inbetween). E.g., if you want to use the two regexes from the list above, you can use `-?\[.*\]|[♪♬#～〜]+`. You can combine as many regexes as you wish this way.

### Remove parenthesized text and newlines {#remove-parenthesized-text-and-newlines}

To remove parenthesized text and all newlines together, use:

Leave "Subtitle regex filter text replacement" blank. For example, `（山田）こんにちは` followed by a newline and `世界` becomes `こんにちは世界`. This removes both ASCII and full-width parentheses and their contents, including Japanese readings, and joins lines without adding spaces. It does not handle nested parentheses; use the [speaker names example](#remove-speaker-names) for those.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
[\(（][^\)）]*[\)）]|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Combine all removal filters {#combine-all-removal-filters}

To also remove bidi controls, parenthesized speaker names (including nested parentheses), bracketed descriptions, and music symbols, use:

Leave "Subtitle regex filter text replacement" blank. This combines the removal examples above and joins lines without adding spaces. It removes Japanese readings too; use the [reading-preserving example](#preserve-japanese-readings) if you want to keep them.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}|([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])|-?\[.*\]|[♪♬#～〜]+|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

## Invisible characters and blank subtitles {#invisible-characters}

An apparently empty subtitle can contain invisible characters such as an LRM. asbplayer drops text cues containing only whitespace, control characters, or default-ignorable Unicode characters after parsing and filtering. Direction marks within meaningful text are preserved unless your regex explicitly removes them.

Invisible characters at the beginning or end of a cue can prevent an anchored pattern such as `^\[.+\]$` from matching. If the pattern does not match, asbplayer retries it without surrounding whitespace and invisible controls, but only drops the cue if that retry leaves no meaningful text. For example, `[THUNDER]` followed by an LRM is removed with this pattern and an empty replacement. The retry preserves the original cue when its replacement would contain meaningful text.

When combining an anchored pattern with a bidi-removal alternative, remember that replacements happen in one pass. For example, `^\[.+\]$|\u200E` applied to `[THUNDER]` followed by an LRM removes the LRM, but does not retry the bracketed description afterward. To remove both in the same pass, use the unanchored `\[.+\]|\p{Bidi_Control}` with an empty replacement. This also removes bracketed descriptions within dialogue.

## Learn {#learn}

Learn how to write and test custom regular expressions at [Regex Learn - Playground](https://regexlearn.com/playground).
