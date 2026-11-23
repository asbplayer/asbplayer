---
sidebar_position: 2
---

import project, { appOrigin } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# 자막에서 카드 만들기 {#mining-subtitles}

**문장 마이닝**은 문장으로 플래시카드를 만드는 작업입니다. asbplayer에서는 동영상, 오디오, 자막을 하나의 카드로 결합해 고품질 문장 플래시카드를 만들 수 있습니다. asbplayer는 널리 쓰이는 플래시카드 앱 **Anki**와 연동됩니다.

## Anki 설정하기 {#setup-anki}

1. [Anki](https://apps.ankiweb.net/)를 설치합니다.
2. Anki에 [AnkiConnect](https://ankiweb.net/shared/info/2055492159)를 추가합니다.
3. 동영상 파일에서 카드를 만들려면 AnkiConnect 설정의 `webCorsOriginList`에 <code>{appOrigin}</code>을 추가합니다.

   <CodeBlock language="json">{JSON.stringify({
     apiKey: null,
     apiLogPath: null,
     ignoreOriginList: [],
     webBindAddress: project.services.ankiConnect.host,
     webBindPort: project.services.ankiConnect.port,
     webCorsOriginList: [appOrigin],
   }, null, 2)}</CodeBlock>

4. **덱**을 추가합니다.
5. **노트 유형**을 추가합니다.
   직접 노트 유형을 만들거나 미리 준비된 유형을 사용할 수 있습니다. 먼저 기본 노트 유형으로 시작하려면 다음 단계를 따릅니다.
   1. 도구 → 노트 유형 관리 를 클릭합니다.
   2. "기본" 노트 유형을 추가합니다.
   3. **필드**를 설정합니다.
      - Sentence
      - Word
      - Definition
      - Image
      - Audio
      - Source
      - URL
   4. **카드**를 설정합니다.
      - 앞면:
        ```
        {{Sentence}}
        ```
      - 뒷면:
        ```
        {{FrontSide}}
        <hr id=answer>
        {{Definition}}
        <p/>
        <div class="image">
        {{Image}}
        </div>
        <p/>
        {{Audio}}
        <p/>
        {{Source}}
        <p/>
        {{URL}}
        ```

## asbplayer 설정하기 {#configure-asbplayer}

1. <a href={new URL('?view=settings', project.urls.app).href}>asbplayer 설정</a>을 엽니다.
2. 방금 만든 **덱**과 **노트 유형**을 선택합니다.
3. **문장**, **정의**, **단어**, **오디오**, **이미지**, **출처**, **URL** 필드마다 노트 유형의 해당 필드를 선택합니다.

## 사전 앱 설치하기 {#install-a-dictionary-app}

asbplayer에는 내장 사전이 없습니다. 카드의 **정의** 필드를 쉽게 채우려면 사전 앱을 설치하는 것이 좋습니다. 많이 사용하는 앱은 다음과 같습니다.

- [Yomitan](https://yomitan.wiki/)은 단어 위에 마우스를 올려 뜻을 찾아볼 수 있는 브라우저 확장 프로그램입니다. 처음에는 일본어용으로 만들어졌으며, 다른 언어도 지원하기 시작했습니다.
- [VocabSieve](https://docs.freelanguagetools.org/)는 유럽 언어를 지원하는 독립형 언어 학습 앱입니다.

## 자막에서 카드 만들기 {#mine-subtitles}

1. 동영상에 [자막을 불러옵니다](./loading-subtitles.md).
2. **자막 마이닝** <NoteAddIcon /> 버튼을 클릭합니다.
3. 표시되는 대화상자를 작성한 다음 **내보내기**를 클릭합니다.
