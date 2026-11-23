---
sidebar_position: 3
---

import project from '@site/src/project';

import CodeBlock from '@theme/CodeBlock'; // Empty fenced code blocks lose their title and copy button; CodeBlock preserves both.

# 자막 텍스트 필터링 {#subtitle-text-filtering}

자막 텍스트에서 특정 내용을 걸러내려면 정규 표현식(Regex)을 사용할 수 있습니다. asbplayer는 지정한 Regex 패턴과 일치하는 문자열을 찾아 제거할 수 있습니다.

## Regex 필터 설정 {#configure-the-regex-filter}

asbplayer 설정의 <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>기타</a> 섹션에서 "자막 Regex 필터" 텍스트 상자를 찾습니다. 걸러낼 내용에 맞는 Regex를 입력합니다.
"자막 Regex 필터 텍스트 대체" 텍스트 상자에 문자열을 입력해 필터링한 내용을 대체할 수도 있습니다. 비워 두면 내용을 제거합니다.

### 화자 이름 제거 {#remove-speaker-names}

화자를 나타내는 괄호 안의 이름을 제거합니다(예: "**（山田）**　元気ですか？").

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 일본어 읽는 법 유지 {#preserve-japanese-readings}

일본어 텍스트 바로 뒤에 오는 일본어 읽는 법은 유지하고 괄호 안의 이름이나 설명을 제거합니다. 예를 들어 `（山田）漢字(かんじ)を読む。`는 `漢字(かんじ)を読む。`가 됩니다. Regex에 표시된 한자, 히라가나 또는 가타카나 범위의 문자가 바로 앞에 있으면 `(かんじ)`와 `（かんじ）`를 모두 유지합니다.

이 방식은 경험적 규칙이므로 `こんにちは（笑）`처럼 일본어 텍스트 바로 뒤의 설명도 유지하며, 기본 텍스트와 공백으로 분리된 읽는 법은 제거합니다. 중첩 괄호는 처리하지 않습니다. "자막 Regex 필터 텍스트 대체"는 비워 둡니다.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
(?<![一-龯ぁ-ゟ゠-ヿ])[\(（][^\)）]*[\)）]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 자막 줄 병합 {#merge-subtitle-lines}

일부 자막은 여러 줄로 나뉘어 있습니다. 이 Regex는 해당 줄을 한 줄로 합칩니다. 필터를 사용하려면 "자막 Regex 필터 텍스트 대체" 필드에도 `$1 $2`를 입력해야 합니다.

이 패턴을 다른 패턴과 결합할 때는 더 구체적인 대안이 같은 위치에서 먼저 일치하도록 마지막에 둡니다. 각 대안은 별도의 필터링 단계로 실행되지 않습니다. 모든 일치 항목에 같은 대체 텍스트를 사용하며, 다른 대안에 캡처 그룹을 추가하면 `$1 $2`에 필요한 번호가 바뀝니다.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
(.*)\n+(?!-)(.*)
```

```text title="Subtitle regex filter text replacement"
$1 $2
```

</details>

### 줄바꿈 제거 {#remove-newlines}

공백을 추가하지 않고 모든 줄바꿈 문자를 제거합니다. 예를 들어 `こんにちは`와 `世界`가 각각 있는 두 줄은 `こんにちは世界`가 됩니다. "자막 Regex 필터 텍스트 대체"를 비워 둡니다. 줄 사이에 공백을 넣으려면 [자막 줄 병합 예시](#merge-subtitle-lines)를 사용합니다.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 대괄호로 묶인 설명 제거 {#remove-bracketed-descriptions}

재생 중인 소리나 음악을 나타내는 대괄호 안의 문구를 제거합니다(예: "**\[PLAYFUL MUSIC]**" 또는 "**\-[GASPS]**").

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
-?\[.*\]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 대문자로 된 설명 제거 {#remove-uppercase-descriptions}

위 방법의 대안으로 대괄호 없이 대문자로 작성된 설명을 필터링합니다(예: "**PLAYFUL MUSIC**"). 사용하는 언어에 발음 구별 부호가 있는 문자가 더 있다면 목록에 추가해도 됩니다.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
^[\-\(\)\.\s\p{Lu}]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 음악 기호 제거 {#remove-music-symbols}

음악 재생을 나타내는 기호만 단독으로 조합된 문자열을 제거합니다(예: `♪♬♪`).

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
[♪♬#～〜]+
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 효과음 표시 제거 {#remove-sound-effect-cues}

`[THUNDER RUMBLING]`, `-[GASPS]`, `♪♬♪`처럼 대괄호로 묶인 설명이나 음악 기호만으로 이루어진 자막 항목을 제거합니다. `^`와 `$` 앵커는 자막 텍스트 전체가 일치해야 하므로 `Hello [GASPS]` 또는 `♪ Hello ♪`와 같은 대사는 유지됩니다. "자막 Regex 필터 텍스트 대체"를 비워 둡니다.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
^-?\[.+\]$|^[♪♬#～〜]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 왼쪽에서 오른쪽 표시 제거 {#remove-left-to-right-marks}

보이지 않는 왼쪽에서 오른쪽 표시(LRM)인 U+200E를 제거합니다. 예를 들어 `Hello`, LRM, `world`가 포함된 텍스트는 `Helloworld`가 됩니다. Regex 필드에 이스케이프 문자 `\u200E`를 입력하고 "자막 Regex 필터 텍스트 대체"를 비워 둡니다.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\u200E
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 양방향 제어 문자 제거 {#remove-bidi-controls}

왼쪽에서 오른쪽 표시(U+200E), 오른쪽에서 왼쪽 표시(U+200F), 삽입, 재정의, 분리 제어 문자를 포함한 모든 유니코드 양방향 제어 문자를 제거합니다. "자막 Regex 필터 텍스트 대체"를 비워 둡니다. 이 문자는 오른쪽에서 왼쪽으로 표시되는 텍스트나 혼합 방향 텍스트의 표시 순서에 영향을 줄 수 있으므로 제거하려는 경우에만 이 필터를 사용하세요.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Regex 결합 {#combining-regexes}

정규 표현식은 `|` 문자로 결합할 수 있습니다(사이에 공백을 넣지 않아도 됨). 예를 들어 위 목록에서 Regex 두 개를 사용하려면 `-?\[.*\]|[♪♬#～〜]+`를 입력합니다. 이 방식으로 원하는 만큼 Regex를 결합할 수 있습니다.

### 괄호 안 텍스트와 줄바꿈 제거 {#remove-parenthesized-text-and-newlines}

괄호 안 텍스트와 모든 줄바꿈을 함께 제거하려면 다음을 사용합니다.

"자막 Regex 필터 텍스트 대체"를 비워 둡니다. 예를 들어 `（山田）こんにちは` 뒤에 줄바꿈과 `世界`가 있으면 `こんにちは世界`가 됩니다. 일본어 읽는 법을 포함해 ASCII 및 전각 괄호와 그 안의 내용을 제거하고 공백 없이 줄을 합칩니다. 중첩 괄호는 처리하지 않으므로 [화자 이름 예시](#remove-speaker-names)를 사용하세요.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
[\(（][^\)）]*[\)）]|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### 모든 제거 필터 결합 {#combine-all-removal-filters}

양방향 제어 문자, 괄호로 묶인 화자 이름(중첩 괄호 포함), 대괄호 안의 설명, 음악 기호도 제거하려면 다음을 사용합니다.

"자막 Regex 필터 텍스트 대체"를 비워 둡니다. 위의 제거 예시를 결합하고 공백 없이 줄을 합칩니다. 일본어 읽는 법도 제거하므로 유지하려면 [읽는 법 유지 예시](#preserve-japanese-readings)를 사용하세요.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}|([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])|-?\[.*\]|[♪♬#～〜]+|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

## 보이지 않는 문자와 빈 자막 {#invisible-characters}

비어 있는 것처럼 보이는 자막에 LRM 같은 보이지 않는 문자가 포함될 수 있습니다. asbplayer는 분석 및 필터링 후 공백, 제어 문자 또는 기본 무시 유니코드 문자만 포함된 텍스트 자막을 제거합니다. 의미 있는 텍스트 안의 방향 표시는 Regex에서 명시적으로 제거하지 않는 한 유지됩니다.

자막 항목의 시작이나 끝에 보이지 않는 문자가 있으면 `^\[.+\]$`와 같은 앵커 패턴이 일치하지 않을 수 있습니다. 패턴이 일치하지 않으면 asbplayer는 앞뒤 공백과 보이지 않는 제어 문자를 제거한 상태로 다시 시도하지만, 의미 있는 텍스트가 남지 않을 때만 항목을 제거합니다. 예를 들어 `[THUNDER]` 뒤에 LRM이 있는 경우 이 패턴과 빈 대체 문자열을 사용하면 제거됩니다. 대체 결과에 의미 있는 텍스트가 남으면 다시 시도해도 원래 자막 항목을 유지합니다.

앵커 패턴을 양방향 제어 문자 제거 대안과 결합할 때는 대체가 한 번만 실행된다는 점에 유의하세요. 예를 들어 `[THUNDER]` 뒤에 LRM이 있을 때 `^\[.+\]$|\u200E`를 적용하면 LRM은 제거되지만 이후 대괄호 안의 설명을 다시 검사하지는 않습니다. 한 번에 모두 제거하려면 앵커가 없는 `\[.+\]|\p{Bidi_Control}` 패턴과 빈 대체 문자열을 사용합니다. 이 경우 대사 속 대괄호 설명도 제거됩니다.

## 더 알아보기 {#learn}

[Regex Learn - Playground](https://regexlearn.com/playground)에서 사용자 지정 정규 표현식을 작성하고 테스트하는 방법을 알아보세요.
