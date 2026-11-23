---
sidebar_position: 5
---

import project from '@site/src/project';

# 자주 발생하는 문제 {#common-issues}

## 일반 {#general}

### 자막이 표시되지 않음 {#subtitles-arent-showing-up}

다음과 같은 방법으로 asbplayer에서 자막을 숨길 수 있습니다.

- [`자막 표시 전환`](./reference/settings.md#subtitles-keyboard-shortcuts) 키보드 단축키
- [`동영상의 자막 트랙 X 전환`](./reference/settings.md#subtitles-keyboard-shortcuts) 키보드 단축키
- `재생 > 재생 모드`의 [`자막 표시`](./reference/settings.md#show-subtitles) 옵션

### asbplayer가 Anki에 연결되지 않고 'Failed to fetch.' 등의 오류 메시지가 표시됨 {#anki-connection-failed}

광고 차단 프로그램 때문에 발생할 수 있습니다.

- Brave를 사용 중이라면 Shield가 asbplayer를 차단하지 않는지 확인합니다.
- 브라우저나 광고 차단 프로그램이 요청을 차단하고 있지 않은지 확인합니다. 브라우저 개발자 콘솔을 열어 오류를 확인하면 도움이 됩니다.

설정 오류일 수 있습니다.

- 웹사이트를 사용한다면 [여기](./getting-started/mining-subtitles.md)에 설명된 대로 AnkiConnect에서 asbplayer를 허용해야 합니다.

버그일 수도 있습니다.

- 현재 Experimental Web Platform features를 사용 설정하면 이 문제가 발생하는 것으로 알려져 있습니다. `chrome://flags`에서 이 플래그를 사용 중지해 보세요.
- 최신 버전의 macOS에서는 Anki가 백그라운드에 있을 때 AnkiConnect가 응답하지 않습니다([MacOS 사용자 참고 사항](https://git.sr.ht/~foosoft/anki-connect#notes-for-macos-users)).

### '마지막 카드 업데이트' 기능을 사용해도 Anki의 카드가 업데이트되지 않음 {#card-not-updating}

"마지막 카드 업데이트"를 사용할 때 Anki의 카드 브라우저를 닫아 두세요. 카드 브라우저가 열려 있으면 카드가 업데이트된 것처럼 표시되지 않는 [알려진 AnkiConnect 문제](https://github.com/FooSoft/anki-connect/issues/82)가 있습니다.

### 로컬 파일을 불러오면 검은 화면이 표시되거나 오디오가 재생되지 않음 {#local-video-playback-issues}

브라우저마다 동영상 및 오디오 형식의 디코딩 지원 여부가 다릅니다. [호환성 섹션](./compatibility.md#browsers-and-media-formats)을 참고하세요.

### 팝업 사전 확장 프로그램(예: Yomitan)이 사이드 패널에서 작동하지 않음 {#popup-dictionary-in-side-panel}

보안상의 이유로 브라우저는 확장 프로그램 스크립트를 다른 확장 프로그램 페이지에 삽입하지 못하게 하므로 이 문제를 해결할 방법은 없습니다. 다른 확장 프로그램으로 텍스트를 검색하려면 동영상 요소에 표시된 자막이나 asbplayer 웹사이트의 자막 목록을 사용해야 합니다.

### asbplayer가 스트리밍 동영상을 감지하지 못함 {#asbplayer-isnt-detecting-streaming-video}

확장 프로그램 세부정보에서 모든 사이트에 대한 액세스 권한이 있는지 확인합니다.

### 키보드 단축키가 작동하지 않음 {#keyboard-shortcuts-arent-working}

<a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>키보드 단축키 설정</a> 또는 [키보드 단축키 참고](./reference/settings.md#keyboard-shortcuts)를 확인합니다.

확장 프로그램을 사용하는 경우 다음도 확인합니다.

- Chrome에서는 `chrome://extensions/shortcuts`를 확인하고, Firefox에서는 `about:addons` → 톱니바퀴 아이콘 → `확장 프로그램 단축키 관리`를 확인합니다.
- 페이지를 새로고침한 뒤 자막을 다시 불러와 봅니다.
- 확장 프로그램을 제거하고 다시 설치한 다음 브라우저를 재시작해 봅니다.
- 확장 프로그램이 중복 설치되지 않았는지 확인합니다.

### asbplayer가 스트리밍 동영상의 스크린샷을 제대로 자르지 못함 {#screenshot-cropping-issues}

브라우저 확대/축소 설정이 100%인지 확인합니다. <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>확장 프로그램 설정</a>에서 자르기를 완전히 사용 중지할 수도 있습니다.

### JP 마이닝 노트로 카드를 만드는 데 문제가 있음 {#jp-mining-note-issues}

이 [이슈](https://github.com/asbplayer/asbplayer/issues/220#issuecomment-1501124166)를 참고하세요.

### asbplayer에서 오디오 녹음 권한을 계속 요청함 {#repeated-audio-permission-prompts}

현재 asbplayer는 Volume Master 확장 프로그램과 호환되지 않습니다. Volume Master를 사용 중지해야 합니다.

### 오디오 녹음이 왜곡되거나 잡음이 심하고 끊김 {#garbled-audio-recordings}

대개 CPU 성능이 부족해서 발생합니다. 노트북을 사용한다면 전원에 연결되어 있는지 확인합니다. 배터리 절약 모드 등으로 CPU 성능이 제한되지 않았는지도 확인하세요.

### 키보드 단축키로 스트리밍 동영상용 asbplayer를 열면 아무 일도 일어나지 않고 페이지가 응답하지 않음 {#streaming-shortcut-unresponsive}

`chrome://flags`에서 `Experimental Web Platform features`가 사용 설정되어 있으면 이 문제가 발생할 수 있습니다. 사용 중지한 다음 다시 시도하세요.

## 주석 {#annotation}

### 트랙의 주석 사용 또는 사용 중지 {#enable-or-disable-annotation-for-a-track}

다음 설정이 지정된 값으로 설정되어 있으면 주석이 사용 중지된 것으로 간주됩니다.

- [`설정 > 주석`](./reference/settings.md#annotation)에서:
-  [`알려진 단어에 따라 자막 색상 지정`](./reference/settings.md#colorize-subtitles-based-on-known-words): **끔**
-  [`통계 자동 생성`](./reference/settings.md#generate-statistics-automatically): **끔**
-  [`단어 읽는 법 표시`](./reference/settings.md#display-word-readings): _선택 항목 없음_ (빈 값)
-  [`단어 빈도 표시`](./reference/settings.md#display-word-frequency): _선택 항목 없음_ (빈 값)
-  [`피치 악센트 표시(일본어)`](./reference/settings.md#display-pitch-accent-japanese): _선택 항목 없음_ (빈 값)
-  [`단어 정의 표시`](./reference/settings.md#display-word-definitions): _선택 항목 없음_ (빈 값)
- [`설정 > 재생 > 주석`](./reference/settings.md#playback-annotation)에서:
  - [`일시 정지 시 첫 번째 일치 단어 선택`](./reference/settings.md#select-first-matching-word-on-pause): 사용 안 함
  - [`다음 단어가 포함된 자막 자동 일시 정지`](./reference/settings.md#auto-pause-subtitles-containing-these-words): 단어 필터 없음
  - [`다음 단어가 포함된 자막을 압축 모드로 재생`](./reference/settings.md#play-subtitles-containing-these-words-in-condensed-mode): 단어 필터 없음
  - [`다음 단어가 포함된 자막을 빨리 감기 모드에서 정상 속도로 재생`](./reference/settings.md#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode): 단어 필터 없음
  - [`다음 단어가 포함된 자막 반복`](./reference/settings.md#repeat-subtitles-containing-these-words): 단어 필터 없음
  - [`재생 중 다음 단어 표시`](./reference/settings.md#show-these-words-during-playback): 단어 필터 없음
  - [`이해도에 따라 빨리 감기 속도 조정`](./reference/settings.md#adjust-fast-forward-rate-by-comprehension): **끔**

트랙의 주석을 사용하려면 위 설정 중 하나 이상을 사용 중지 값이 아닌 값으로 설정합니다. 일부 주석은 [해당 설정을 적용한 경우](./reference/settings.md#only-display-word-color-on-hover) 마우스를 올렸을 때만 표시될 수 있습니다.

:::tip
위 설정에서 연동 기능을 활용하는 값을 지정하지 않으면 [`Anki 단어 데이터베이스 다시 만들기`](./reference/settings.md#re-build-anki-word-database) 및 [`WaniKani 단어 데이터베이스 다시 만들기`](./reference/settings.md#re-build-wanikani-word-database) 버튼이 비활성화됩니다.
:::

### Anki 단어 데이터베이스 지우기 {#clear-anki-word-database}

트랙의 Anki 단어 데이터베이스 항목을 지우려면 [`Anki 단어 필드`](./reference/settings.md#anki-word-fields)와 [`Anki 문장 필드`](./reference/settings.md#anki-sentence-fields)를 빈 값으로 설정한 다음 [`Anki 단어 데이터베이스 다시 만들기`](./reference/settings.md#re-build-anki-word-database) 버튼을 사용합니다. 버튼이 비활성화되어 있으면 먼저 [이 단계를 따라](#enable-or-disable-annotation-for-a-track) 트랙의 주석을 사용 설정합니다.

### WaniKani 단어 데이터베이스 지우기 {#clear-wanikani-word-database}

트랙의 WaniKani 단어 데이터베이스 항목을 지우려면 [WaniKani API 토큰](./reference/settings.md#wanikani-api-token)을 빈 값으로 설정한 다음 [`WaniKani 단어 데이터베이스 다시 만들기`](./reference/settings.md#re-build-wanikani-word-database) 버튼을 사용합니다. 버튼이 비활성화되어 있으면 먼저 [이 단계를 따라](#enable-or-disable-annotation-for-a-track) 트랙의 주석을 사용 설정합니다.

### 로컬에서 추적한 단어 삭제 {#delete-locally-tracked-words}

단어 위에 마우스를 올리고 [주석 키보드 단축키](./reference/settings.md#annotation-keyboard-shortcuts)를 사용해 상태를 **미수집**으로 설정하고, **무시됨** 상태가 설정되어 있다면 해제해 로컬에서 추적한 단어를 삭제할 수 있습니다.

로컬에서 추적한 단어를 일괄 삭제하려면 [`단어 브라우저`](./reference/settings.md#word-browser)에서 단어를 **미수집**으로 표시하고 상태를 제거합니다. [`단어 가져오기`](./reference/settings.md#import-words) 기능을 사용할 수도 있습니다.

### 모든 단어가 미수집으로 표시됨 {#everything-is-uncollected}

실수로 주석을 사용 설정했다면 [이 단계를 따라](#enable-or-disable-annotation-for-a-track) 사용 중지합니다.

단어 상태가 계속 **미수집**으로 표시된다면 다음을 확인합니다.

- 로컬 상태를 사용한다면 로컬 단어 데이터베이스로 단어를 가져오거나, 단어에 마우스를 올린 뒤 [주석 키보드 단축키](./reference/settings.md#annotation-keyboard-shortcuts)를 사용해 상태를 설정합니다.
- 상태 확인에 Anki를 사용한다면 Anki가 실행 중이고 **AnkiConnect URL**이 올바른지 확인합니다.
    - [`Anki 단어 필드`](./reference/settings.md#anki-word-fields)(권장) 및/또는 [`Anki 문장 필드`](./reference/settings.md#anki-sentence-fields)를 설정합니다.
    - [`Anki 단어 데이터베이스 다시 만들기`](./reference/settings.md#re-build-anki-word-database)를 실행합니다.
    - 데이터베이스를 만든 후에는 Anki를 계속 실행할 필요가 없지만, 재생 중에 Anki를 열어 두면 asbplayer가 동기화 상태를 유지합니다.
- 상태 확인에 WaniKani를 사용한다면 [`WaniKani API 토큰`](./reference/settings.md#wanikani-api-token)이 올바른지 확인합니다.
    - [`WaniKani 단어 데이터베이스 다시 만들기`](./reference/settings.md#re-build-wanikani-word-database)를 실행합니다.
    - asbplayer는 재생 중에 WaniKani와 자동으로 동기화됩니다.

### 빨간색 취소선 스타일이 표시됨 {#red-strikethrough-styling-appears}

실수로 주석을 사용 설정했다면 [이 단계를 따라](#enable-or-disable-annotation-for-a-track) 사용 중지합니다.

자막 처리 중 오류가 발생했음을 나타내며, 대개 Yomitan 연결 문제 때문입니다. 브라우저 콘솔에서 오류 메시지를 확인하고 해결할 수 없다면 asbplayer Discord에서 도움을 요청하세요.
