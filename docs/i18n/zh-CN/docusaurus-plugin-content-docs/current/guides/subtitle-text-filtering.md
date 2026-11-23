---
sidebar_position: 3
---

import project from '@site/src/project';

import CodeBlock from '@theme/CodeBlock'; // Empty fenced code blocks lose their title and copy button; CodeBlock preserves both.

# 筛选字幕文本 {#subtitle-text-filtering}

如果想筛除特定字幕文本，可以使用正则表达式（regex）。asbplayer 可以匹配符合指定正则表达式的任意字符序列，并移除匹配内容。

## 配置正则表达式筛选器 {#configure-the-regex-filter}

在 asbplayer 设置的<a href={new URL('?view=settings#misc-settings', project.urls.app).href}>杂项</a>部分，找到“字幕正则筛选器”文本框。输入合适的正则表达式，以筛除所需内容。
也可以在“字幕正则筛选器文本替换”文本框中输入字符串，替换筛选出的内容。留空则会直接移除内容。

### 移除说话人姓名 {#remove-speaker-names}

移除用括号标出的说话人姓名（例如“**（山田）**　元気ですか？”）

<details>
<summary>使用此筛选器</summary>

```text title="Subtitle regex filter"
([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 保留日语读音 {#preserve-japanese-readings}

移除括号中的姓名或描述，同时保留紧跟在日语文本后的日语读音。例如，`（山田）漢字(かんじ)を読む。` 会变为 `漢字(かんじ)を読む。`。当 `(かんじ)` 和 `（かんじ）` 前面紧邻正则表达式所示范围内的汉字、平假名或片假名时，二者都会保留。

这是一种启发式规则：它也会保留紧跟在日语文本后的描述，例如 `こんにちは（笑）`，并移除与原文之间隔有空格的读音。它无法处理嵌套括号。请将“字幕正则筛选器文本替换”留空。

<details>
<summary>使用此筛选器</summary>

```text title="Subtitle regex filter"
(?<![一-龯ぁ-ゟ゠-ヿ])[\(（][^\)）]*[\)）]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 合并字幕行 {#merge-subtitle-lines}

有些字幕被拆分成多行，此正则表达式可以将它们合并为一行。要使用此筛选器，还必须在“字幕正则筛选器文本替换”字段中填入 `$1 $2`。

将此模式与其他模式组合时，请将其放在最后，以便同一位置上更具体的分支优先匹配。各分支不会分开执行筛选。所有匹配都使用相同的替换文本，而且在其他分支中添加捕获组会改变 `$1 $2` 中需要使用的编号。

<details>
<summary>使用此筛选器</summary>

```text title="Subtitle regex filter"
(.*)\n+(?!-)(.*)
```

```text title="Subtitle regex filter text replacement"
$1 $2
```

</details>

### 移除换行符 {#remove-newlines}

移除所有换行符，不插入空格。例如，包含 `こんにちは` 和 `世界` 的两行会变为 `こんにちは世界`。请将“字幕正则筛选器文本替换”留空。若要在行与行之间插入空格，请使用[合并字幕行示例](#merge-subtitle-lines)。

<details>
<summary>使用此筛选器</summary>

```text title="Subtitle regex filter"
\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 移除方括号描述 {#remove-bracketed-descriptions}

移除方括号内表示声音或音乐的提示（例如“**\[PLAYFUL MUSIC]**”或“**\-[GASPS]**”）。

<details>
<summary>使用此筛选器</summary>

```text title="Subtitle regex filter"
-?\[.*\]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 移除大写描述 {#remove-uppercase-descriptions}

作为上述方法的替代方案，筛除未使用方括号、但以大写字母书写的描述（例如“**PLAYFUL MUSIC**”）。如果你的语言有带附加符号的字母，也可以将它们添加到此列表。

<details>
<summary>使用此筛选器</summary>

```text title="Subtitle regex filter"
^[\-\(\)\.\s\p{Lu}]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 移除音乐符号 {#remove-music-symbols}

移除单独出现、表示正在播放音乐的任意符号组合（例如 `♪♬♪`）。

<details>
<summary>使用此筛选器</summary>

```text title="Subtitle regex filter"
[♪♬#～〜]+
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 移除音效提示 {#remove-sound-effect-cues}

移除完全由方括号描述或音乐符号组成的字幕提示，例如 `[THUNDER RUMBLING]`、`-[GASPS]` 或 `♪♬♪`。`^` 和 `$` 锚点要求整个字幕文本都匹配，因此 `Hello [GASPS]` 或 `♪ Hello ♪` 这样的对话会保留。请将“字幕正则筛选器文本替换”留空。

<details>
<summary>使用此筛选器</summary>

```text title="Subtitle regex filter"
^-?\[.+\]$|^[♪♬#～〜]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 移除从左到右标记 {#remove-left-to-right-marks}

移除 U+200E，即不可见的从左到右标记（LRM）。例如，包含 `Hello`、LRM 和 `world` 的文本会变为 `Helloworld`。在正则表达式字段中输入字面转义序列 `\u200E`，并将“字幕正则筛选器文本替换”留空。

<details>
<summary>使用此筛选器</summary>

```text title="Subtitle regex filter"
\u200E
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 移除双向文本控制字符 {#remove-bidi-controls}

移除所有 Unicode 双向文本控制字符，包括从左到右标记（U+200E）、从右到左标记（U+200F），以及嵌入、覆盖和隔离控制字符。请将“字幕正则筛选器文本替换”留空。这些字符可能影响从右到左或混合方向文本的显示顺序，因此只有在你确实要移除它们时才使用此筛选器。

<details>
<summary>使用此筛选器</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 组合正则表达式 {#combining-regexes}

可以使用字符 `|` 组合正则表达式（之间无需空格）。例如，若要使用上面列表中的两个正则表达式，可以输入 `-?\[.*\]|[♪♬#～〜]+`。可以按需组合任意数量的正则表达式。

### 移除括号文本和换行符 {#remove-parenthesized-text-and-newlines}

要同时移除括号文本和所有换行符，请使用：

请将“字幕正则筛选器文本替换”留空。例如，`（山田）こんにちは` 后面跟着换行符和 `世界`，结果会变为 `こんにちは世界`。此模式会移除半角和全角括号及其中的内容（包括日语读音），并将各行直接连接，不添加空格。它无法处理嵌套括号；遇到这种情况请使用[说话人姓名示例](#remove-speaker-names)。

<details>
<summary>使用此筛选器</summary>

```text title="Subtitle regex filter"
[\(（][^\)）]*[\)）]|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 合并所有移除筛选器 {#combine-all-removal-filters}

要同时移除双向文本控制字符、括号中的说话人姓名（包括嵌套括号）、方括号描述和音乐符号，请使用：

请将“字幕正则筛选器文本替换”留空。此模式组合了上面的移除示例，并将各行直接连接，不添加空格。它也会移除日语读音；如果要保留读音，请使用[保留日语读音示例](#preserve-japanese-readings)。

<details>
<summary>使用此筛选器</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}|([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])|-?\[.*\]|[♪♬#～〜]+|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

## 不可见字符和空白字幕 {#invisible-characters}

看似空白的字幕可能包含 LRM 等不可见字符。解析和筛选后，asbplayer 会丢弃只包含空白、控制字符或默认可忽略 Unicode 字符的文本提示。除非正则表达式明确移除方向标记，否则有实际内容的文本中的方向标记会保留。

提示开头或结尾的不可见字符可能会导致 `^\[.+\]$` 这样的锚定模式无法匹配。如果模式不匹配，asbplayer 会移除前后空白和不可见控制字符后重试，但只有重试后不剩有意义的文本时才丢弃提示。例如，`[THUNDER]` 后面跟着 LRM 时，使用此模式和空替换文本即可移除该提示。如果替换结果会留下有意义的文本，重试则会保留原始提示。

将锚定模式与移除双向控制字符的分支组合时，请记住替换只会执行一轮。例如，对后接 LRM 的 `[THUNDER]` 使用 `^\[.+\]$|\u200E` 会移除 LRM，但之后不会再次匹配方括号描述。若要在同一轮中移除两者，请使用非锚定模式 `\[.+\]|\p{Bidi_Control}`，并将替换文本留空。此模式也会移除对话中的方括号描述。

## 学习 {#learn}

请在 [Regex Learn - Playground](https://regexlearn.com/playground) 学习如何编写和测试自定义正则表达式。
