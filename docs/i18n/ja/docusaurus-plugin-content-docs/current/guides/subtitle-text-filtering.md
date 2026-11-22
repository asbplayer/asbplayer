---
sidebar_position: 3
---

import project from '@site/src/project';

import CodeBlock from '@theme/CodeBlock'; // Empty fenced code blocks lose their title and copy button; CodeBlock preserves both.

# 字幕テキストのフィルタリング {#subtitle-text-filtering}

字幕テキスト内の特定の文字列を除外するには、正規表現（regex）を使う方法があります。asbplayerは指定した正規表現パターンに一致する文字列を見つけ、削除できます。

## 正規表現フィルターの設定 {#configure-the-regex-filter}

asbplayerの設定にある<a href={new URL('?view=settings#misc-settings', project.urls.app).href}>その他</a>セクションで、「字幕の正規表現フィルター」テキストボックスを見つけます。除外する内容に合った正規表現を入力します。
「字幕の正規表現フィルターによるテキスト置換」テキストボックスに文字列を入力すると、フィルターに一致した内容を置き換えることもできます。空欄の場合は内容が削除されます。

### 話者名を削除 {#remove-speaker-names}

話者を示す括弧で囲まれた名前を削除します（例: 「**（山田）**　元気ですか？」）。

<details>
<summary>このフィルターを使う</summary>

```text title="Subtitle regex filter"
([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 日本語の読みを保持 {#preserve-japanese-readings}

日本語テキストの直後にある読みは残し、括弧で囲まれた名前や説明を削除します。たとえば、`（山田）漢字(かんじ)を読む。`は`漢字(かんじ)を読む。`になります。正規表現に示した漢字、ひらがな、カタカナの範囲にある文字が直前にある場合、`(かんじ)`と`（かんじ）`のどちらも残ります。

これは経験則による処理です。`こんにちは（笑）`のように日本語テキストの直後にある説明も残し、基本形との間に空白がある読みは削除します。括弧の入れ子には対応していません。「字幕の正規表現フィルターによるテキスト置換」は空欄にしてください。

<details>
<summary>このフィルターを使う</summary>

```text title="Subtitle regex filter"
(?<![一-龯ぁ-ゟ゠-ヿ])[\(（][^\)）]*[\)）]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 字幕行を結合 {#merge-subtitle-lines}

字幕によっては複数行に分割されています。この正規表現で1行にまとめられます。このフィルターを動作させるには、「字幕の正規表現フィルターによるテキスト置換」欄に`$1 $2`も入力してください。

このパターンを他のパターンと組み合わせる場合、より具体的な選択肢が同じ位置で先に一致するよう、最後に置いてください。選択肢ごとに個別のフィルタリング処理が実行されるわけではありません。すべての一致に同じ置換テキストが使われます。また、他の選択肢にキャプチャグループを追加すると、`$1 $2`に必要な番号が変わります。

<details>
<summary>このフィルターを使う</summary>

```text title="Subtitle regex filter"
(.*)\n+(?!-)(.*)
```

```text title="Subtitle regex filter text replacement"
$1 $2
```

</details>

### 改行を削除 {#remove-newlines}

スペースを挿入せず、すべての改行文字を削除します。たとえば、`こんにちは`と`世界`を含む2行は`こんにちは世界`になります。「字幕の正規表現フィルターによるテキスト置換」は空欄にしてください。行間にスペースを挿入する場合は、[字幕行の結合例](#merge-subtitle-lines)を使ってください。

<details>
<summary>このフィルターを使う</summary>

```text title="Subtitle regex filter"
\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 角括弧で囲まれた説明を削除 {#remove-bracketed-descriptions}

再生中の音や音楽を示す角括弧で囲まれた表記を削除します（例: 「**\[PLAYFUL MUSIC]**」、「**\-[GASPS]**」）。

<details>
<summary>このフィルターを使う</summary>

```text title="Subtitle regex filter"
-?\[.*\]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 大文字の説明を削除 {#remove-uppercase-descriptions}

上記の代わりに、角括弧のない大文字で書かれた説明（例: 「**PLAYFUL MUSIC**」）を除外します。お使いの言語に追加のダイアクリティカルマーク付き文字がある場合は、リストに追加してください。

<details>
<summary>このフィルターを使う</summary>

```text title="Subtitle regex filter"
^[\-\(\)\.\s\p{Lu}]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 音楽記号を削除 {#remove-music-symbols}

音楽の再生を表す記号だけの組み合わせ（例: `♪♬♪`）を削除します。

<details>
<summary>このフィルターを使う</summary>

```text title="Subtitle regex filter"
[♪♬#～〜]+
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 効果音の字幕を削除 {#remove-sound-effect-cues}

`[THUNDER RUMBLING]`、`-[GASPS]`、`♪♬♪`のように、角括弧の説明や音楽記号だけで構成された字幕を削除します。`^`と`$`のアンカーは字幕テキスト全体の一致を必要とするため、`Hello [GASPS]`や`♪ Hello ♪`のような会話は残ります。「字幕の正規表現フィルターによるテキスト置換」は空欄にしてください。

<details>
<summary>このフィルターを使う</summary>

```text title="Subtitle regex filter"
^-?\[.+\]$|^[♪♬#～〜]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 左から右へのマークを削除 {#remove-left-to-right-marks}

不可視の左から右へのマーク（LRM）であるU+200Eを削除します。たとえば、`Hello`、LRM、`world`を含むテキストは`Helloworld`になります。正規表現欄にエスケープ文字列`\u200E`をそのまま入力し、「字幕の正規表現フィルターによるテキスト置換」は空欄にしてください。

<details>
<summary>このフィルターを使う</summary>

```text title="Subtitle regex filter"
\u200E
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 双方向制御文字を削除 {#remove-bidi-controls}

左から右へのマーク（U+200E）、右から左へのマーク（U+200F）、埋め込み、オーバーライド、分離制御文字など、Unicodeの双方向制御文字をすべて削除します。「字幕の正規表現フィルターによるテキスト置換」は空欄にしてください。これらの文字は右から左に読むテキストや混在方向のテキストの表示順に影響することがあるため、削除したい場合にのみこのフィルターを使ってください。

<details>
<summary>このフィルターを使う</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 正規表現の組み合わせ {#combining-regexes}

正規表現は`|`記号で組み合わせられます（間にスペースは不要です）。たとえば、上のリストにある2つの正規表現を使う場合は、`-?\[.*\]|[♪♬#～〜]+`とします。この方法で任意の数の正規表現を組み合わせられます。

### 括弧内のテキストと改行を削除 {#remove-parenthesized-text-and-newlines}

括弧内のテキストとすべての改行を一緒に削除するには、次を使います。

「字幕の正規表現フィルターによるテキスト置換」は空欄にしてください。たとえば、改行を挟んだ`（山田）こんにちは`と`世界`は`こんにちは世界`になります。半角と全角の括弧、およびその中身（日本語の読みを含む）を削除し、スペースを追加せず行を結合します。括弧の入れ子には対応していません。入れ子の場合は[話者名の例](#remove-speaker-names)を使ってください。

<details>
<summary>このフィルターを使う</summary>

```text title="Subtitle regex filter"
[\(（][^\)）]*[\)）]|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### すべての削除フィルターを組み合わせる {#combine-all-removal-filters}

双方向制御文字、括弧で囲まれた話者名（括弧の入れ子を含む）、角括弧で囲まれた説明、音楽記号も削除するには、次を使います。

「字幕の正規表現フィルターによるテキスト置換」は空欄にしてください。上記の削除例を組み合わせ、スペースを追加せずに行を結合します。日本語の読みも削除されるため、読みを残す場合は[読みを保持する例](#preserve-japanese-readings)を使ってください。

<details>
<summary>このフィルターを使う</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}|([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])|-?\[.*\]|[♪♬#～〜]+|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

## 不可視文字と空の字幕 {#invisible-characters}

空に見える字幕にLRMなどの不可視文字が含まれていることがあります。asbplayerは解析とフィルタリングの後、空白文字、制御文字、またはUnicodeの既定で無視可能な文字だけを含むテキストキューを破棄します。意味のあるテキスト内の方向マークは、正規表現で明示的に削除しない限り保持されます。

キューの先頭または末尾に不可視文字があると、`^\[.+\]$`のようなアンカー付きパターンが一致しないことがあります。パターンが一致しない場合、asbplayerは前後の空白文字と不可視制御文字を除いて再試行します。ただし、その再試行後に意味のあるテキストが残らない場合のみキューを破棄します。たとえば、`[THUNDER]`の後にLRMがある場合、このパターンと空の置換で削除されます。置換後に意味のあるテキストが残る場合、再試行では元のキューが保持されます。

アンカー付きパターンと双方向制御文字を削除する選択肢を組み合わせる場合、置換は1回の処理で行われることに注意してください。たとえば、LRMの後に続く`[THUNDER]`に`^\[.+\]$|\u200E`を適用すると、LRMは削除されますが、角括弧の説明は再試行されません。同じ処理で両方を削除するには、空の置換とアンカーなしの`\[.+\]|\p{Bidi_Control}`を使います。この正規表現では会話内の角括弧で囲まれた説明も削除されます。

## 学習 {#learn}

[Regex Learn - Playground](https://regexlearn.com/playground)でカスタム正規表現の作成とテスト方法を学べます。
