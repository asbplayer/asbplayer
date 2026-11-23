---
sidebar_position: 3
---

import project from '@site/src/project';

import CodeBlock from '@theme/CodeBlock'; // Empty fenced code blocks lose their title and copy button; CodeBlock preserves both.

# Filtrar texto das legendas {#subtitle-text-filtering}

Se quiser remover trechos específicos do texto das legendas, uma forma de fazer isso é usar uma expressão regular (regex). O asbplayer pode encontrar sequências que correspondam ao padrão regex especificado e removê-las.

## Configurar o filtro regex {#configure-the-regex-filter}

Na seção <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Diversas</a> das configurações do asbplayer, localize o campo "Filtro regex das legendas". Insira um regex adequado para filtrar o conteúdo desejado.
Para substituir o conteúdo filtrado, insira um texto no campo "Substituição de texto do filtro regex das legendas". Se deixá-lo em branco, o conteúdo será removido.

### Remover nomes de falantes {#remove-speaker-names}

Remove nomes entre parênteses que identificam os falantes (por exemplo, "**（山田）**　元気ですか？").

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Preservar leituras em japonês {#preserve-japanese-readings}

Remove nomes ou descrições entre parênteses e mantenha as leituras em japonês que aparecem imediatamente depois de um texto japonês. Por exemplo, `（山田）漢字(かんじ)を読む。` passa a ser `漢字(かんじ)を読む。`. Tanto `(かんじ)` quanto `（かんじ）` são preservados quando imediatamente precedidos por um caractere dos intervalos de kanji, hiragana ou katakana indicados no regex.

Essa é uma heurística: ela também mantém descrições logo após o texto japonês, como `こんにちは（笑）`, e remove leituras separadas do texto base por um espaço. Ela não lida com parênteses aninhados. Deixe "Substituição de texto do filtro regex das legendas" em branco.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
(?<![一-龯ぁ-ゟ゠-ヿ])[\(（][^\)）]*[\)）]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Unir linhas de legenda {#merge-subtitle-lines}

Algumas legendas são divididas em várias linhas. Este regex as reúne em uma única linha. Para que o filtro funcione, também é necessário inserir `$1 $2` no campo "Substituição de texto do filtro regex das legendas".

Ao combinar esse padrão com outros, deixe-o por último para que uma alternativa mais específica possa corresponder primeiro na mesma posição. As alternativas não são executadas em etapas de filtragem separadas. Todas as correspondências usam o mesmo texto de substituição, e adicionar grupos de captura em outras alternativas altera os números necessários em `$1 $2`.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
(.*)\n+(?!-)(.*)
```

```text title="Subtitle regex filter text replacement"
$1 $2
```

</details>

### Remover quebras de linha {#remove-newlines}

Remove todos os caracteres de quebra de linha sem inserir espaços. Por exemplo, duas linhas com `こんにちは` e `世界` passam a ser `こんにちは世界`. Deixe "Substituição de texto do filtro regex das legendas" em branco. Para inserir um espaço entre as linhas, use o [exemplo de união de linhas de legenda](#merge-subtitle-lines).

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Remover descrições entre colchetes {#remove-bracketed-descriptions}

Remove indicações entre colchetes que descrevem sons ou músicas em reprodução (por exemplo, "**\[MÚSICA ANIMADA]**" ou "**\-[SUSPIROS]**").

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
-?\[.*\]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Remover descrições em maiúsculas {#remove-uppercase-descriptions}

Como alternativa ao exemplo acima, remova descrições escritas em letras maiúsculas, mas sem colchetes (por exemplo, "**MÚSICA ANIMADA**"). Se seu idioma tiver letras adicionais com sinais diacríticos, você pode incluí-las nesta lista.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
^[\-\(\)\.\s\p{Lu}]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Remover símbolos musicais {#remove-music-symbols}

Qualquer combinação isolada de símbolos que represente música em reprodução (por exemplo, `♪♬♪`).

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
[♪♬#～〜]+
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Remover indicações de efeitos sonoros {#remove-sound-effect-cues}

Remove indicações de legenda que consistam inteiramente em uma descrição entre colchetes ou símbolos musicais, como `[TROVÕES]`, `-[SUSPIROS]` ou `♪♬♪`. Os marcadores `^` e `$` exigem que todo o texto da legenda corresponda, então falas como `Hello [GASPS]` ou `♪ Hello ♪` são mantidas. Deixe "Substituição de texto do filtro regex das legendas" em branco.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
^-?\[.+\]$|^[♪♬#～〜]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Remover marcas da esquerda para a direita {#remove-left-to-right-marks}

Remove U+200E, a marca invisível da esquerda para a direita (LRM). Por exemplo, um texto contendo `Hello`, uma LRM e `world` passa a ser `Helloworld`. Insira o escape literal `\u200E` no campo regex e deixe "Substituição de texto do filtro regex das legendas" em branco.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\u200E
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Remover controles bidirecionais {#remove-bidi-controls}

Remove todos os caracteres de controle bidirecional do Unicode, incluindo as marcas da esquerda para a direita (U+200E) e da direita para a esquerda (U+200F), além dos controles de incorporação, substituição e isolamento. Deixe "Substituição de texto do filtro regex das legendas" em branco. Esses caracteres podem afetar a ordem de exibição de textos da direita para a esquerda ou com direções mistas; use este filtro somente se quiser removê-los.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Combinar regexes {#combining-regexes}

É possível combinar expressões regulares com o caractere `|` (sem espaços entre elas). Por exemplo, para usar os dois regexes da lista acima, você pode usar `-?\[.*\]|[♪♬#～〜]+`. Você pode combinar quantos regexes quiser dessa forma.

### Remover texto entre parênteses e quebras de linha {#remove-parenthesized-text-and-newlines}

Para remover texto entre parênteses e todas as quebras de linha de uma vez, use:

Deixe "Substituição de texto do filtro regex das legendas" em branco. Por exemplo, `（山田）こんにちは` seguido de uma quebra de linha e `世界` passa a ser `こんにちは世界`. Isso remove parênteses ASCII e de largura completa e seu conteúdo, incluindo leituras japonesas, e une as linhas sem adicionar espaços. O padrão não lida com parênteses aninhados; para esses casos, use o [exemplo de nomes de falantes](#remove-speaker-names).

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
[\(（][^\)）]*[\)）]|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Combinar todos os filtros de remoção {#combine-all-removal-filters}

Para remover também controles bidirecionais, nomes de falantes entre parênteses (inclusive parênteses aninhados), descrições entre colchetes e símbolos musicais, use:

Deixe "Substituição de texto do filtro regex das legendas" em branco. Isso combina os exemplos de remoção acima e une as linhas sem adicionar espaços. As leituras japonesas também são removidas; para mantê-las, use o [exemplo que preserva leituras](#preserve-japanese-readings).

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}|([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])|-?\[.*\]|[♪♬#～〜]+|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

## Caracteres invisíveis e legendas vazias {#invisible-characters}

Uma legenda aparentemente vazia pode conter caracteres invisíveis, como uma LRM. Depois de analisar e filtrar as legendas, o asbplayer descarta indicações de texto que contenham somente espaços em branco, caracteres de controle ou caracteres Unicode ignoráveis por padrão. Marcas direcionais dentro de texto significativo são preservadas, a menos que seu regex as remova explicitamente.

Caracteres invisíveis no início ou no fim de uma indicação podem impedir a correspondência com um padrão ancorado, como `^\[.+\]$`. Se o padrão não corresponder, o asbplayer tenta novamente sem os espaços em branco ao redor e os controles invisíveis, mas só descarta a indicação se a nova tentativa não deixar texto significativo. Por exemplo, `[THUNDER]` seguido de uma LRM é removido com esse padrão e uma substituição vazia. A nova tentativa preserva a indicação original quando a substituição resultaria em texto significativo.

Ao combinar um padrão ancorado com uma alternativa que remove controles bidirecionais, lembre-se de que as substituições são feitas em uma única passagem. Por exemplo, aplicar `^\[.+\]$|\u200E` a `[THUNDER]` seguido de uma LRM remove a LRM, mas não tenta novamente remover a descrição entre colchetes. Para remover ambos na mesma passagem, use `\[.+\]|\p{Bidi_Control}` sem âncoras e com uma substituição vazia. Isso também remove descrições entre colchetes dentro de falas.

## Aprender {#learn}

Aprenda a escrever e testar expressões regulares personalizadas no [Regex Learn - Playground](https://regexlearn.com/playground).
