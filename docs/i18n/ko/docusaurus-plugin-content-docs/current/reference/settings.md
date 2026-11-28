---
sidebar_position: 1
---

import project from '@site/src/project';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# 설정 {#settings}

## <a href={new URL('?view=settings#anki-settings', project.urls.app).href}>Anki</a> {#anki}

### AnkiConnect URL {#ankiconnect-url}

Anki 내부의 추가 기능으로 실행 중인 AnkiConnect 서버의 URL입니다.

### AnkiConnect API 키 {#ankiconnect-api-key}

API 키 보호를 사용 설정했을 때 AnkiConnect에 구성한 API 키입니다.

### 카드 업데이트 후 Anki 카드 브라우저 새로고침 {#refresh-anki-card-browser}

사용 설정하면 asbplayer가 카드를 업데이트한 후 열려 있는 Anki 카드 브라우저를 새로고침해 현재 필드 값을 표시합니다. 카드 브라우저 창이 앞으로 표시될 수 있습니다. 기본적으로 사용 중지되어 있습니다.

### 덱 {#deck}

카드를 보낼 Anki 덱입니다.

### 노트 유형 {#note-type}

카드에 사용할 Anki 노트 유형입니다. 노트 유형은 카드의 "모델"과 "보기"를 정의합니다. 구체적으로는 카드 필드 모음과 카드 앞면 및 뒷면에서 필드를 표시하는 방식을 정하는 HTML 템플릿을 말합니다.

### 카드 필드 {#card-fields}

각 카드 필드 설정은 어떤 내용을 구성된 노트 유형의 어떤 필드에 연결할지 정합니다. **필드 레이블**(문장, 정의, 단어, 이미지, 오디오 또는 URL)은 **콘텐츠**를 지정하고, **필드 값**은 **노트 유형 안의 필드**를 지정합니다.

필드는 설정에 표시된 순서대로 **Anki 내보내기 대화상자**에 나타납니다. **⋮ 메뉴** → **아래로 이동** 또는 **위로 이동**을 사용해 순서를 바꿀 수 있습니다.

| 필드                 | 콘텐츠                                            |
| --------------------- | -------------------------------------------------- |
| 문장 (모든 트랙) | 마이닝한 타임스탬프의 모든 자막               |
| 정의            | 사용자가 입력한 단어 정의                  |
| 단어                  | 사용자가 입력한 단어                             |
| 오디오                 | 동영상 소스에서 녹음한 오디오                   |
| 이미지                 | 동영상 소스의 스크린샷                         |
| 출처                | 자막 파일 또는 동영상 이름과 타임스탬프          |
| URL                   | 스트리밍 동영상에서 마이닝한 경우 현재 URL |
| 자막 트랙 1      | 마이닝한 타임스탬프의 트랙 1 자막      |
| 자막 트랙 2      | 마이닝한 타임스탬프의 트랙 2 자막      |
| 자막 트랙 3      | 마이닝한 타임스탬프의 트랙 3 자막      |
| 사용자 지정 필드         | 사용자가 입력한 값                               |

### 태그 {#tags}

각 카드에 기본으로 추가할 태그입니다.

## <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>마이닝</a> {#mining}

### 마이닝 버튼 기본 동작 {#mining-button-default-action}

"마이닝 버튼" <NoteAddIcon/>은 **오버레이 UI**에 표시되는 가장 왼쪽 버튼과 **자막 목록**에서 자막 옆에 표시되는 버튼을 가리킵니다. 이 설정에서 버튼의 동작을 지정합니다.

| 설정                 | 동작                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Anki 대화상자 표시        | 대상 자막을 마이닝 기록에 저장하고 **Anki 내보내기 대화상자** 표시                                                                                                                               |
| 마지막 카드 업데이트        | 대상 자막을 마이닝 기록에 저장하고 구성된 덱의 마지막 카드에 asbplayer가 제공하는 문맥을 반영해 업데이트합니다(사용자가 입력한 정의, 단어 및 사용자 지정 필드는 제외). |
| 카드 업데이트 대화상자 표시 | 대상 자막을 마이닝 기록에 저장하고 asbplayer가 제공하는 문맥으로 마지막 카드를 업데이트하는 대화상자 표시                                                                                |
| 카드 내보내기             | 대상 자막을 마이닝 기록에 저장하고 asbplayer가 제공하는 문맥만으로 카드를 내보냅니다(사용자가 입력한 정의, 단어 및 사용자 지정 필드는 제외).                            |
| 없음                    | 대상 자막을 마이닝 기록에 저장                                                                                                                                                               |

### 마이닝 후 재생 상태 {#post-mining-playback-state}

마이닝 동작을 실행한 후의 재생 상태를 설정합니다.

### 마이닝한 자막을 클립보드에 복사 {#copy-mined-subtitles-to-clipboard}

사용 설정하면 마이닝 동작을 실행할 때마다 대상 자막을 클립보드에 복사합니다.

### 문장 필드에 항상 자막 텍스트 사용 {#always-use-subtitle-text-for-sentence-field}

사용 설정하면 외부 앱에서 다른 문장 텍스트를 제공하더라도 모든 트랙에서 마이닝한 자막 텍스트를 문장 필드에 입력합니다. [Yomitan으로 마이닝](../guides/one-click-mining.md)할 때 유용합니다.

### 이전 카드 업데이트 시 같은 자막 텍스트가 있는 카드의 문장도 업데이트 {#update-sentence-for-cards-with-the-same-subtitle-text}

사용 설정하면 **이전 카드 업데이트** 자막 추출 작업이 기존 문장이 내보낸 문장과 일치하는 연이어 만든 노트의 문장 필드와 구성된 자막 트랙 1~3 필드도 바꿉니다. 각 노트의 강조 표시는 가능한 한 유지합니다. 내보낸 텍스트가 없는 트랙 필드는 변경하지 않습니다. 자막 필드가 정의처럼 자막이 아닌 필드와 같은 Anki 필드를 공유하면 이전 노트의 해당 필드는 문장 업데이트에서 변경하지 않습니다.

이 설정은 현재 내보내기에 선택한 문장을 복사합니다. 추출한 전체 자막 텍스트를 사용하려면 [**문장 필드에 항상 자막 텍스트 사용**](#always-use-subtitle-text-for-sentence-field)을 사용 설정하세요. [이미지/오디오 업데이트](#update-all-cards-with-the-same-subtitle-text)는 이 설정과 별개입니다.

일치 여부는 기본 문장 필드를 기준으로 확인하며 문장 마크업은 무시합니다. 한 문장이 다른 문장에 포함되어도 일치하므로 첫 번째 줄만 포함된 노트도 전체 자막과 일치할 수 있습니다. 최근 Anki 기준 2일 이내에 추가한 노트를 검색하며 문장이 다르거나 없으면 검색을 중단합니다. 트랙 필드를 업데이트할 때도 문장 필드를 구성해야 하고 내보낸 문장이 비어 있으면 안 됩니다. 기본적으로 사용 중지되어 있으며 특정 카드를 선택해 업데이트할 때는 영향을 주지 않습니다.

### 이전 카드 업데이트 시 같은 자막 텍스트가 있는 카드의 이미지/오디오도 업데이트 {#update-all-cards-with-the-same-subtitle-text}

사용 설정하면 **이전 카드 업데이트** 자막 추출 작업이 같은 자막 대사에서 연이어 만든 노트의 오디오 및 이미지 필드도 업데이트합니다. 앞서 만든 각 노트의 단어, 정의 및 사용자 지정 필드는 유지됩니다. [문장 업데이트](#update-sentence-for-cards-with-the-same-subtitle-text)도 사용 설정하지 않으면 자막 필드는 변경하지 않습니다. 문장 마크업은 일치 여부에 반영되지 않으며 문장이 추출한 자막 문맥의 일부여도 일치하는 것으로 처리됩니다.

최근 Anki 기준 2일 이내에 추가한 노트를 검색하며 문장이 다르거나 없으면 검색을 중단합니다. 문장 필드를 구성해야 하며 내보낸 문장에는 공백이나 마크업만이 아닌 텍스트가 있어야 합니다. 기본적으로 사용 중지되어 있으며 특정 카드를 선택해 업데이트할 때는 영향을 주지 않습니다.

### 로컬 동영상 녹음 중 오디오 재생 {#play-audio-while-recording-from-local-video}

asbplayer는 브라우저에 내장된 [MediaRecorder](https://developer.mozilla.org/ja/docs/Web/API/MediaRecorder) API를 사용해 로컬 동영상 파일의 오디오를 녹음합니다. 이 설정은 녹음 중 소리를 재생할지 지정합니다.

### 오디오를 mp3로 다시 인코딩 {#re-encode-audio-as-mp3}

녹음한 오디오는 기본적으로 `mp3`로 인코딩되지 않습니다. 이 설정을 사용하면 오디오를 `mp3`로 다시 인코딩합니다. 특히 iOS에서 카드를 복습하려면 이 설정을 사용 중지할 이유가 거의 없습니다.

### 오디오 앞쪽 패딩 {#audio-padding-start}

대상 자막보다 **앞서** 오디오 녹음을 시작할 시간(밀리초)입니다.

### 오디오 뒤쪽 패딩 {#audio-padding-end}

대상 자막이 끝난 뒤 오디오 녹음을 중지할 시간(밀리초)입니다.

### 이미지 캡처 형식(웹사이트 전용) {#image-capture-format}

마이닝한 카드의 이미지 캡처 형식을 지정합니다. 웹사이트에서 로컬 동영상 파일을 사용할 때만 제공되며 추가 옵션은 "동영상 클립"뿐입니다.

### 최대 캡처 너비/높이 {#max-capture-dimensions}

스크린샷의 최대 너비/높이(픽셀)입니다. `0`은 "제한 없음"을 뜻합니다.

### 스크린샷에서 검은 여백 자르기 {#trim-black-bars-from-screenshots}

사용 설정하면 레터박스로 생긴 검은 여백을 스크린샷에서 잘라냅니다.

### 클립 시작/끝 자르기 {#clip-trim-start-end}

동영상 클립의 기본 시간 범위를 정할 때 자막 시간 범위의 시작과 끝에서 잘라낼 시간을 지정합니다. 동영상 클립 이미지 캡처 형식을 선택했을 때만 사용할 수 있습니다.

### 최대 클립 길이 {#max-clip-length}

동영상 클립의 최대 길이를 지정합니다. 동영상 클립 이미지 캡처 형식을 선택했을 때만 사용할 수 있습니다.

### 스크린샷 캡처 지연 시간 {#screenshot-capture-delay}

대상 자막이 표시된 후 스크린샷을 찍기까지 기다릴 시간입니다.

### 주변 자막 개수 범위 {#surrounding-subtitles-count-radius}

**Anki 내보내기 대화상자** 아래쪽의 슬라이더로 선택한 시간 범위를 조정할 수 있습니다. 슬라이더에는 문맥을 위해 주변 자막도 포함됩니다. 이 설정은 주변 자막의 개수를 제한합니다.

### 주변 자막 시간 범위 {#surrounding-subtitles-time-radius}

**Anki 내보내기 대화상자** 아래쪽의 슬라이더로 선택한 시간 범위를 조정할 수 있습니다. 슬라이더에는 문맥을 위해 주변 자막도 포함됩니다. 이 설정은 대상 자막 주변에서 허용할 시간 범위를 지정합니다.

## <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>자막 모양</a> {#subtitle-appearance}

### 자막 트랙 {#subtitle-appearance-track}

asbplayer는 여러 자막 트랙을 동시에 불러올 수 있습니다. 이 드롭다운에서 아래 설정을 적용할 트랙을 선택합니다. 기본 선택은 "모두"입니다. "모두"를 선택한 상태에서 모양 설정을 변경하면 모든 트랙에 동시에 적용됩니다. 특정 트랙에 대한 설정 값을 지정하면 해당 설정은 "모두" 페이지에서 사라집니다.

### 자막 미리보기 {#subtitle-preview}

모양 설정의 효과를 미리 볼 자막 텍스트를 확인하고 수정합니다.

### 스타일 {#styling}

| 설정                           | 설명                                                                          | CSS 속성                |
| --------------------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| 자막 색상                    | 색상                                                                                | `color`                     |
| 자막 크기                     | `px` 단위 크기                                                                         | `font-size`                 |
| 자막 글꼴 두께           | 글꼴 두께                                                                       | `font-weight`               |
| 자막 윤곽선 색상            | 획 색상                                                                  | `-webkit-text-stroke-color` |
| 자막 윤곽선 두께        | 획 두께                                                              | `-webkit-text-stroke-width` |
| 자막 그림자 색상             | 그림자 색상                                                                  | `text-shadow`               |
| 자막 그림자 두께         | 그림자 두께                                                              | `text-shadow`               |
| 자막 배경색         | 배경색                                                                     | `background-color`          |
| 자막 배경 불투명도       | 배경 불투명도                                                                   | `background`                |
| 자막 글꼴              | 글꼴. 로컬 글꼴 액세스 권한을 부여하면 사용 가능한 글꼴 드롭다운이 표시됩니다.       | `font-family`               |
| CSS:\<style key\>                 | **사용자 지정 CSS 추가** 드롭다운에서 추가한 사용자 지정 CSS 속성의 문자열 값입니다. | 사용자 지정 속성             |
| 자막 흐리게                     | 자막을 흐리게 표시합니다. 마우스를 올리면 선명해집니다.                                | `filter:blur(...)`          |
| 이미지 기반 자막 크기 조정 | 이미지 기반 자막의 크기를 조정합니다.                                                        | —                           |

### 레이아웃 {#layout}

| 설정                              | 설명                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| 자막 정렬                   | 동영상 요소의 위 또는 아래에 자막을 배치할지 정합니다.        |
| 아래쪽 자막 위치 오프셋 | 아래쪽에 표시되는 모든 자막 트랙과 동영상 요소 하단 사이의 거리입니다. |
| 위쪽 자막 위치 오프셋    | 위쪽에 표시되는 모든 자막 트랙과 동영상 요소 상단 사이의 거리입니다.       |
| 자막 너비                      | 자막 컨테이너의 너비입니다(`%` 또는 픽셀).                               |

## <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>키보드 단축키</a> {#keyboard-shortcuts}

키보드 단축키로 asbplayer의 대부분 기능에 접근할 수 있습니다.

### <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>자막</a> 키보드 단축키 {#subtitles-keyboard-shortcuts}

| 동작                             | 기본 단축키 |
| ------------------------------------ | ---------------- |
| 불러올 자막 트랙 선택      | Ctrl + Shift + F |
| 자막 표시 전환                     | ↓                |
| 동영상의 자막 트랙 1 전환     | 1                |
| 동영상의 자막 트랙 2 전환     | 2                |
| 동영상의 자막 트랙 3 전환     | 3                |
| asbplayer의 자막 트랙 1 전환 | W + 1            |
| asbplayer의 자막 트랙 2 전환 | W + 2            |
| asbplayer의 자막 트랙 3 전환 | W + 3            |
| asbplayer의 자막 트랙 1 흐리게 해제 | B + 1            |
| asbplayer의 자막 트랙 2 흐리게 해제 | B + 2            |
| asbplayer의 자막 트랙 3 흐리게 해제 | B + 3            |
| 아래쪽 자막 위로 이동             |                  |
| 아래쪽 자막 아래로 이동           |                  |
| 위쪽 자막 위로 이동                |                  |
| 위쪽 자막 아래로 이동              |                  |
| 현재 자막 복사 |                  |

### <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>마이닝</a> 키보드 단축키 {#mining-keyboard-shortcuts}

| 동작                                                                             | 기본 단축키           |
| ------------------------------------------------------------------------------------ | -------------------------- |
| 현재 자막 마이닝                                                                | Ctrl + Shift + Z (website) |
| 현재 자막을 마이닝하고 Anki 대화상자 열기                                           | Ctrl + Shift + X           |
| asbplayer가 캡처한 스크린샷, 오디오 등으로 마지막 Anki 카드 업데이트        | Ctrl + Shift + U           |
| 대화상자를 건너뛰고 Anki로 카드 내보내기                                               |                            |
| 마이닝 시 자동 촬영되는 스크린샷 대신 직접 스크린샷 촬영 | Ctrl + Shift + V (website) |
| 자막 파일을 불러온 경우에도 오디오 녹음 직접 시작/중지            | Ctrl + Shift + R (website) |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>재생</a> 키보드 단축키 {#playback-keyboard-shortcuts}

| 동작                        | 기본 단축키 |
| ------------------------------- | ---------------- |
| 사이드 패널 전환               | \`               |
| 재생/일시 정지                      | Space            |
| 자동 일시 정지 전환               | Shift + P        |
| 압축 재생 전환       | Shift + O        |
| 빨리 감기 재생 전환    | Shift + F        |
| 반복 모드 전환              | Shift + R        |
| 자막 표시 시점 전환 |                  |
| 자동 일시 정지 재개 모드 순환    |                  |
| 레시피 순방향 순환   |                  |
| 레시피 역방향 순환  |                  |
| 레시피 1 전환                 |                  |
| 레시피 2 전환                 |                  |
| 레시피 3 전환                 |                  |
| 레시피 4 전환                 |                  |
| 레시피 5 전환                 |                  |
| 레시피 6 전환                 |                  |
| 레시피 7 전환                 |                  |
| 레시피 8 전환                 |                  |
| 레시피 9 전환                 |                  |
| 레시피 10 전환                |                  |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>탐색</a> 키보드 단축키 {#seek-keyboard-shortcuts}

| 동작                                                                  | 기본 단축키 |
| ------------------------------------------------------------------------- | ---------------- |
| 뒤로 탐색(기본값 3초, [설정 가능](#seek-interval-seconds)) | A                |
| 앞으로 탐색(기본값 3초, [설정 가능](#seek-interval-seconds))  | D                |
| 이전 자막으로 이동                                                 | ←                |
| 다음 자막으로 이동                                                     | →                |
| 현재/이전 자막의 시작 부분으로 이동                            | ↑                |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>재생 속도</a> 키보드 단축키 {#playback-rate-keyboard-shortcuts}

| 동작               | 기본 단축키 |
| ---------------------- | ---------------- |
| 재생 속도 높이기 | Ctrl + Shift + ] |
| 재생 속도 낮추기 | Ctrl + Shift + [ |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>자막 오프셋</a> 키보드 단축키 {#subtitle-offset-keyboard-shortcuts}

| 동작                                                                 | 기본 단축키 |
| ------------------------------------------------------------------------ | ---------------- |
| 이전 자막이 현재 타임스탬프에 오도록 자막 오프셋 조정 | Ctrl + ←         |
| 다음 자막이 현재 타임스탬프에 오도록 자막 오프셋 조정     | Ctrl + →         |
| 자막 오프셋을 +100ms 조정                                         | Ctrl + Shift + ← |
| 자막 오프셋을 -100ms 조정                                         | Ctrl + Shift + → |
| 자막 오프셋 재설정                                                    | Ctrl + Shift + ↓ |

### <a href={new URL('?view=settings#annotation', project.urls.app).href}>주석</a> 키보드 단축키 {#annotation-keyboard-shortcuts}

| 동작                          | 기본 단축키 |
| --------------------------------- | ---------------- |
| 통계 열기                   | Q + S            |
| 다음 단어로 이동                 | Q + E            |
| 이전 단어로 이동             | Q + W            |
| 마우스를 올린 단어를 성숙으로 표시       | Q + 5            |
| 다음 성숙 단어로 이동          |                  |
| 이전 성숙 단어로 이동      |                  |
| 마우스를 올린 단어를 청년으로 표시        | Q + 4            |
| 다음 청년 단어로 이동           |                  |
| 이전 청년 단어로 이동       |                  |
| 마우스를 올린 단어를 졸업으로 표시    | Q + 3            |
| 다음 졸업 단어로 이동       |                  |
| 이전 졸업 단어로 이동   |                  |
| 마우스를 올린 단어를 학습 중으로 표시     | Q + 2            |
| 다음 학습 중 단어로 이동        |                  |
| 이전 학습 중 단어로 이동    |                  |
| 마우스를 올린 단어를 알 수 없음으로 표시      | Q + 1            |
| 다음 알 수 없음 단어로 이동         |                  |
| 이전 알 수 없음 단어로 이동     |                  |
| 마우스를 올린 단어를 미수집으로 표시  | Q + 0            |
| 다음 미수집 단어로 이동     |                  |
| 이전 미수집 단어로 이동 |                  |
| 마우스를 올린 단어 무시 전환    | Q + I            |
| 다음 무시 단어로 이동         |                  |
| 이전 무시 단어로 이동     |                  |

### 탐색 간격(초) {#seek-interval-seconds}

[탐색 키보드 단축키](#seek-keyboard-shortcuts)에서 사용할 간격을 지정합니다.

### '현재/이전 자막 시작 부분으로 이동' 실행 후 항상 재생 {#always-play-on-subtitle-seek}

현재 재생 상태를 유지하는 대신 [탐색 키보드 단축키](#seek-keyboard-shortcuts)로 현재/이전 자막의 시작 부분으로 이동할 때 항상 재생합니다. 키 입력을 한 번 줄일 수 있습니다.

### 재생 속도 조정 단위 {#playback-speed-adjust-step}

"재생 속도 높이기/낮추기" [키보드 단축키](#playback-rate-keyboard-shortcuts)를 사용할 때 적용할 증감 값입니다.

### 확장 프로그램 단축키 {#extension-shortcuts}

브라우저 확장 프로그램이 설치되어 있으면 일부 마이닝 단축키(예: 현재 자막 마이닝, 현재 자막을 마이닝하고 Anki 대화상자 열기)는 일반 키 이벤트 리스너가 아니라 브라우저 명령으로 구현됩니다. 이 단축키는 브라우저의 확장 프로그램 단축키 편집기에서만 수정할 수 있습니다.

- Chrome: `chrome://extensions/shortcuts`
- Firefox: `about:addons` → `Manage Extension Shortcuts`

## <a href={new URL('?view=settings#annotation', project.urls.app).href}>주석</a> {#annotation}

### 단어 브라우저 {#word-browser}

:::info
로컬 단어만 수정하거나 삭제할 수 있습니다. 외부 소스의 단어는 읽기 전용이며 [동기화](#re-build-anki-word-database)로만 업데이트할 수 있습니다.
:::

단어 브라우저를 열어 로컬 및 Anki 동기화 단어 데이터베이스의 모든 단어를 확인하고 관리합니다.

:::tip
해당 언어의 모든 문자 체계로 단어를 검색할 수 있습니다(예: 일본어의 로마자/히라가나/가타카나/한자).

`e -> é` 또는 `ss -> ß`와 같은 일반적인 편의 치환도 자동으로 적용됩니다.
:::

### 단어 가져오기 {#import-words}

asbplayer의 **로컬 단어 데이터베이스**로 단어를 가져옵니다.

가져온 단어는 로컬 단어로 간주되며 단어 상태를 판단할 때 외부 소스보다 우선합니다.

가져오기 대화상자에 임의의 텍스트를 붙여 넣거나 이전에 내보낸 파일을 가져올 수 있습니다. 텍스트는 asbplayer가 토큰으로 분리합니다.

:::tip
단어 위에 마우스를 올리고 [주석 키보드 단축키](#annotation-keyboard-shortcuts)를 사용해 로컬 상태를 변경할 수 있습니다.
:::

### 단어 내보내기 {#export-words}

로컬 단어 데이터베이스를 내보내 백업하거나 다른 기기로 옮기고, 웹사이트와 확장 프로그램 간에 공유할 수 있습니다.

### Anki 단어 데이터베이스 다시 만들기 {#re-build-anki-word-database}

Anki에서 가져온 단어 상태 정보의 로컬 캐시를 만들거나 다시 만듭니다.

:::tip
트랙을 사용 설정했고 Anki에 연결할 수 있으면 재생 중에도 캐시가 자동으로 업데이트됩니다.

주석 설정이 [Anki 연동을 활용하는 경우](../common-issues.md#enable-or-disable-annotation-for-a-track)에만 이 버튼을 사용할 수 있습니다.

트랙의 Anki 단어 데이터베이스 항목을 지우려면 [이 단계를 따르세요](../common-issues.md#clear-anki-word-database).
:::

### WaniKani 단어 데이터베이스 다시 만들기 {#re-build-wanikani-word-database}

WaniKani에서 가져온 어휘 정보의 로컬 캐시를 만들거나 다시 만듭니다.

:::tip
트랙을 사용 설정하고 토큰을 구성하면 재생 중에도 캐시가 자동으로 업데이트됩니다.

주석 설정이 [WaniKani 연동을 활용하는 경우](../common-issues.md#enable-or-disable-annotation-for-a-track)에만 이 버튼을 사용할 수 있습니다.

트랙의 WaniKani 단어 데이터베이스 항목을 지우려면 [이 단계를 따르세요](../common-issues.md#clear-wanikani-word-database).
:::

### 자막 트랙 {#annotation-track}

이 주석 설정을 적용할 자막 트랙을 선택합니다.

### 알고 있는 단어에 따라 자막 색상 지정 {#colorize-subtitles-based-on-known-words}

단어 상태(미수집/알 수 없음/학습 중 등)에 따른 스타일을 사용합니다. 스타일에는 구성된 [**단어 색상 스타일**](#word-color-style)과 [**단어 상태 색상**](#word-status-colors)을 사용합니다.

### 통계 자동 생성 {#generate-statistics-automatically}

현재 미디어를 불러올 때 통계를 자동으로 생성하고 통계 오버레이도 사용 설정합니다. [통계 열기 키보드 단축키](#annotation-keyboard-shortcuts)는 주석 그룹에 있습니다.

### 단어 읽는 법 표시 {#display-word-readings}

단어 상태와 상태값에 따라 단어 위에 읽는 법(예: 후리가나)을 표시합니다.

### 단어 빈도 표시 {#display-word-frequency}

상태 및 상태값에 따라 단어 아래에 순위 기반 빈도 값을 표시합니다(사용 가능한 경우). 학습에 시간을 들일 가치가 있는 단어의 우선순위를 정하는 데 유용합니다.

:::tip
빈도 정보를 사용하려면 Yomitan 인스턴스에 순위 기반 빈도 사전이 하나 이상 있어야 합니다. 빈도 사전에 모드가 지정되어 있지 않으면 asbplayer가 순위 기반인지 추정해 적용합니다.

단어에 여러 빈도 값이 있으면 가장 낮은 값(가장 자주 사용됨)을 사용합니다.
:::

### 피치 악센트 표시(일본어) {#display-pitch-accent-japanese}

:::note
후리가나에 피치 악센트를 표시하려면 [**단어 읽는 법 표시**](#display-word-readings)를 사용 설정해야 합니다.
:::

상태와 상태값에 따라 후리가나 또는 가나 자체에 피치 악센트를 표시합니다.

:::info
단어 뒤에 붙는 조사에는 데이터가 있는 경우 해당 단어의 피치 악센트를 적용합니다.

보통 한자에만 후리가나를 표시하지만 이 기능을 사용하면 단어에 한자가 하나 이상 있을 때 모든 문자에 후리가나를 표시합니다. 복합어의 피치 악센트를 더 쉽게 읽을 수 있습니다.
:::

### 단어 정의 표시 {#display-word-definitions}

단어 상태와 상태값에 따라 각 단어의 간단한 정의나 설명을 표시할지 지정합니다.

### 단어 필드 검색 전략 {#word-field-search-strategy}

asbplayer가 자막의 단어를 알고 있는 단어와 어떻게 일치시킬지 지정합니다.

- **정확한 형태 수집됨**: 필드에 자막의 표면형이 정확히 포함되어야 합니다(running -> running).
- **표제어 형태 수집됨**: 표제어/기본형을 수집해야 합니다(running -> run).
- **표제어 또는 정확한 형태 수집됨**: 둘 중 하나가 일치하면 단어를 수집된 것으로 처리합니다(위 두 옵션).
- **모든 형태 수집됨**: 관련된 형태 중 하나라도 일치하면 단어를 수집된 것으로 처리합니다(running -> run, ran, runs 등).

**표제어 형태 수집됨**, **표제어 또는 정확한 형태 수집됨**, **모든 형태 수집됨**을 선택하면 [**언어 문자 체계 간 일치 허용**](#match-across-language-scripts)에서 표제어 기반 일치가 한 언어의 문자 체계(예: 한자, 히라가나, 가타카나)를 넘나들 수 있는지 지정합니다.

### 카드 선택 우선순위 {#card-choice-priority}

Anki 카드 여러 개가 단어와 일치하면 단어 상태를 판정할 때 사용할 카드를 지정합니다.

- **필드에 정확한 형태 포함**(여러 개면 가장 잘 아는 카드 사용)
- **필드에 표제어 포함**(여러 개면 가장 잘 아는 카드 사용)
- **가장 잘 아는 카드**
- **가장 덜 아는 카드**

### 문장 필드 검색 전략 {#sentence-field-search-strategy}

구성된 [**Anki 문장 필드**](#anki-sentence-fields)를 asbplayer가 검색하는 방식을 지정합니다. [**단어 필드 검색 전략**](#word-field-search-strategy)과 같은 옵션을 제공합니다.

**표제어 형태 수집됨**, **표제어 또는 정확한 형태 수집됨**, **모든 형태 수집됨**을 선택하면 [**언어 문자 체계 간 일치 허용**](#match-across-language-scripts)에서 표제어 기반 일치가 한 언어의 문자 체계(예: 한자, 히라가나, 가타카나)를 넘나들 수 있는지 지정합니다.

:::tip
문장에는 여러 단어가 포함되므로 카드 상태와 개별 단어의 관련성이 낮아질 수 있습니다. 문장 카드만 사용하는 경우가 아니라면 **정확한 형태 수집됨**을 유지하는 것이 좋습니다.
:::

### 언어 문자 체계 간 일치 허용 {#match-across-language-scripts}

표제어 기반 일치가 한 언어의 서로 다른 문자 체계(예: 한자, 히라가나, 가타카나)를 넘나들 수 있는지 지정합니다.

```
if true:
  - Kana subtitles can match kanji in collection, could be homophones but text processing can't handle it so we allow it.
  - Kanji subtitles only match with kanji in collection, prevents kana collected matches all kanji homophones.
if false:
  - Never match across scripts, downside is if kanji is collected kana will need to be collected too.
  - Essentially a strict mode where the you need to collect all script forms of a word.
```

### Yomitan API URL {#yomitan-api-url}

Yomitan API 엔드포인트의 URL입니다. URL에 연결할 수 없거나 잘못된 경우 asbplayer가 오류를 표시합니다.

:::tip
[Yomitan](https://yomitan.wiki/) 인스턴스와 [yomitan-api](https://github.com/yomidevs/yomitan-api)를 설정해야 합니다.
:::

### Yomitan 파서 {#yomitan-parser}

자막 텍스트를 토큰으로 분리할 때 사용할 Yomitan 파서를 선택합니다.

- **스캐닝 파서(모든 언어)**: 사전에서 가장 긴 단어를 찾는 Yomitan 내부 파서입니다.
- **MeCab(일본어)**: MeCab을 사용해 일본어 텍스트를 분석합니다. Yomitan에서 MeCab 지원을 설정해야 하며 UniDic 사전이 하나 이상 있는 것이 좋습니다.

### 최대 단어 길이 {#max-word-length}

:::info
이 설정은 스캐닝 파서에만 적용됩니다.
:::

주석 처리를 위해 asbplayer가 스캔하거나 토큰으로 분리할 단어의 최대 길이를 제한합니다.

:::tip
값이 너무 낮으면 긴 단어를 놓치고, 너무 높으면 성능 문제가 발생할 수 있습니다.
:::

### Anki 덱(선택 사항) {#anki-decks}

Anki 검색을 선택한 덱으로 제한합니다. 비워 두면 asbplayer가 모든 덱을 검색합니다.

### Anki 단어 필드 {#anki-word-fields}

대상 단어만 _포함하는_ Anki 노트 필드입니다. Anki에서 알고 있는 상태 정보를 가져오는 데 권장되는 방법입니다.

### Anki 문장 필드 {#anki-sentence-fields}

문장이 포함된 Anki 노트 필드입니다(주로 문장 덱에서 사용). [**Anki 단어 필드**](#anki-word-fields)에 대상 단어가 있는 카드가 없으면 대체 항목으로 사용합니다.

### 성숙한 Anki 카드 안정성/간격(일) {#mature-anki-stability-interval}

Anki 카드를 **성숙**으로 간주할 기준 일수를 지정합니다. 이보다 낮은 성숙도 상태도 구분됩니다.

- **미수집**: Anki에서 찾을 수 없습니다.
- **알 수 없음**: `is:new`로 Anki에서 찾았습니다.
- **학습 중**: `is:learn`으로 Anki에서 찾았습니다.
- **졸업**: `-is:new -is:learn prop:s<{ceil(cutoff / 2)}`로 Anki에서 찾았습니다.
- **초기**: `-is:new -is:learn prop:s>=${ceil(cutoff / 2)} prop:s<${cutoff}`로 Anki에서 찾았습니다.
- **성숙**: `-is:new -is:learn prop:s>=${cutoff}`로 Anki에서 찾았습니다.

:::tip
카드의 FSRS 안정성 정보를 사용할 수 있으면(마지막 복습 시 FSRS가 사용 설정된 경우) 간격 대신 이 값을 사용합니다.

단어 상태에 관한 자세한 내용은 [**단어 상태 색상**](#word-status-colors)을 참고하세요.
:::

### 정지된 Anki 카드를 다음과 같이 처리 {#treat-suspended-anki-cards-as}

Anki에서 단어 상태를 만들 때 **정지된** 카드를 처리하는 방식을 지정합니다.

- **기본값**: Anki 상태를 그대로 사용합니다.
- 또는 특정 단어 상태(예: **성숙**, **알 수 없음**)를 선택해 정지된 카드를 해당 상태로 처리합니다.

:::tip
단어에 해당하는 카드 중 일부만 정지된 경우 정지된 카드는 필터링되고 정지되지 않은 카드로 단어 상태를 판정합니다.

단어 상태에 관한 자세한 내용은 [**단어 상태 색상**](#word-status-colors)을 참고하세요.
:::

### WaniKani API 토큰 {#wanikani-api-token}

WaniKani API 토큰을 사용해 WaniKani에서 알고 있는 단어를 동기화합니다. 설정 방법은 [주석 안내](../guides/annotation.md#setup)를 참고하세요.

asbplayer는 알고 있는 단어를 판정할 때 `vocabulary` 및 `kana_vocabulary` 항목 유형만 사용합니다. 상태는 해당 항목에 구성된 [간격 반복 시스템](https://docs.api.wanikani.com/20170710/#spaced-repetition-system)의 SRS 단계에 따라 판정합니다. WaniKani 상태는 다음과 같습니다.

- **미수집**: WaniKani에서 찾을 수 없습니다.
- **알 수 없음**: WaniKani에서 찾았지만 SRS 단계가 `Starting stage`보다 낮습니다.
- **학습 중**: WaniKani에서 찾았으며 SRS 단계가 `Starting stage` 이상이고 `Passing stage` 미만입니다.
- **졸업**: WaniKani에서 찾았으며 SRS 단계가 `Passing stage`와 `Burning stage` 사이 단계의 하위 절반에 속합니다.
- **초기**: WaniKani에서 찾았으며 SRS 단계가 `Passing stage`와 `Burning stage` 사이 단계의 상위 절반에 속합니다.
- **성숙**: WaniKani에서 찾았으며 SRS 단계가 `Burning stage` 이상입니다.

:::tip
단어 상태에 관한 자세한 내용은 [**단어 상태 색상**](#word-status-colors)을 참고하세요.
:::

### 단어 색상 스타일 {#word-color-style}

 [**알고 있는 단어에 따라 자막 색상 지정**](#colorize-subtitles-based-on-known-words)에서 단어에 상태 색상을 적용하는 방식을 지정합니다.

- **텍스트**: 단어 색상을 변경합니다.
- **배경**: 단어 뒤의 색상을 변경합니다.
- **밑줄**: 상태 색상으로 단어에 밑줄을 긋습니다.
- **윗줄**: 상태 색상으로 단어 위에 줄을 긋습니다.
- **윤곽선**: 상태 색상으로 단어 윤곽선을 표시합니다.

:::tip
**윤곽선**을 사용할 때는 최상의 결과를 위해 [**자막 윤곽선 두께**](#subtitle-appearance-track)를 `0`으로 설정해야 할 수 있습니다.
:::

### 두께 {#thickness}

**밑줄**, **윗줄**, **윤곽선** 스타일의 두께(픽셀)를 지정합니다.

### 마우스를 올렸을 때 단어 강조 표시 {#highlight-words-on-hover}

:::info
이 강조 표시는 키보드 단축키를 인식하는 asbplayer의 포커스 상태를 나타냅니다. 강조 표시가 나타나지 않으면 플레이어를 클릭해 포커스를 맞춰야 할 수 있습니다. 포커스 위치에 따라 키보드 단축키는 동영상 또는 자막 목록 중 한 곳에서만 작동합니다(두 곳에서 동시에 작동하지 않음).

강조 표시는 주로 수집할 단어 위에 마우스가 놓였는지 확인하기 위한 기능입니다. 따라서 마우스를 올린 대상이 단어여야 하고 색상 표시를 사용 설정해야 합니다.
:::

사용 설정하면 단어 위에 마우스를 올릴 때 해당 단어가 강조되어 Yomitan이 텍스트를 어떻게 토큰화했는지 확인할 수 있습니다.

### 마우스를 올렸을 때만 단어 색상 표시 {#only-display-word-color-on-hover}

:::note
이 설정은 [**알고 있는 단어에 따라 자막 색상 지정**](#colorize-subtitles-based-on-known-words)을 사용 설정한 경우에만 적용됩니다.
:::

동영상 또는 자막 목록에 사용 설정하면 기본적으로 단어 색상을 숨기고, 각각 동영상 또는 자막 목록의 자막 텍스트 위에 마우스를 올렸을 때만 표시합니다.

### 마우스를 올렸을 때만 단어 읽는 법 표시 {#only-display-word-reading-on-hover}

:::note
이 설정은 [**단어 읽는 법 표시**](#display-word-readings)를 사용 설정한 경우에만 적용됩니다.
:::

동영상 또는 자막 목록에 사용 설정하면 기본적으로 단어 읽는 법을 숨기고, 각각 동영상 또는 자막 목록의 자막 텍스트 위에 마우스를 올렸을 때만 표시합니다.

### 마우스를 올렸을 때만 단어 빈도 표시 {#only-display-word-frequency-on-hover}

:::note
이 설정은 [**단어 빈도 표시**](#display-word-frequency)를 사용 설정한 경우에만 적용됩니다.
:::

동영상 또는 자막 목록에 사용 설정하면 기본적으로 단어 빈도를 숨기고, 각각 동영상 또는 자막 목록의 자막 텍스트 위에 마우스를 올렸을 때만 표시합니다.

### 마우스를 올렸을 때만 단어 정의 표시 {#only-display-word-definitions-on-hover}

:::note
이 설정은 [**단어 정의 표시**](#display-word-definitions)를 사용 설정한 경우에만 적용됩니다.
:::

동영상 또는 자막 목록에 사용 설정하면 기본적으로 단어 정의를 숨기고, 각각 동영상 또는 자막 목록의 자막 텍스트 위에 마우스를 올렸을 때만 표시합니다.

### 마우스를 올렸을 때만 피치 악센트 표시 {#only-display-pitch-accent-on-hover}

:::note
이 설정은 [**피치 악센트 표시(일본어)**](#display-pitch-accent-japanese)를 사용 설정한 경우에만 적용됩니다.
:::

동영상 또는 자막 목록에 사용 설정하면 기본적으로 피치 악센트를 숨기고, 각각 동영상 또는 자막 목록의 자막 텍스트 위에 마우스를 올렸을 때만 표시합니다.

### 단어 읽는 법 크기 {#word-reading-size}

단어 읽는 법(후리가나)의 크기를 em 단위(자막 글꼴 크기의 %)로 지정합니다.

### 단어 빈도 크기 {#word-frequency-size}

단어 빈도 표시 크기를 em 단위(자막 글꼴 크기의 %)로 지정합니다.

### 단어 정의 크기 {#word-definition-size}

단어 정의 크기를 em 단위(자막 글꼴 크기의 %)로 지정합니다.

### 피치 악센트 크기 {#pitch-accent-size}

피치 악센트 크기를 em 단위(자막 글꼴 크기의 %)로 지정합니다.

### 단어 상태 색상 {#word-status-colors}

각 상태에 설정 가능한 색상과 투명도가 있으며 [**단어 색상 스타일**](#word-color-style)에 사용됩니다. 상태별로 사용 여부를 설정할 수 있습니다.

- **미수집**: asbplayer 데이터베이스에 단어가 없습니다.
- **알 수 없음**: 단어는 있지만 알 수 없는 것으로 간주됩니다.
- **학습 중**: 단어를 학습하고 있습니다.
- **졸업**: 단어가 학습 단계를 마쳤습니다.
- **초기**: 단어를 알고 있지만 아직 성숙하지 않았습니다.
- **성숙**: 단어를 완전히 알고 있습니다.

:::tip
원하는 상태 스타일을 사용 중지할 수 있습니다. 예를 들어 **성숙** 스타일을 사용 중지하면 화면을 덜 복잡하게 만들 수 있습니다.

특정 상태를 구분하지 않으려면 **졸업**과 **초기**처럼 같은 색상을 사용할 수 있습니다.

Anki 카드 상태 판정 방법은 [**성숙한 Anki 카드 안정성/간격(일)**](#mature-anki-stability-interval)을 참고하세요.
WaniKani 상태 판정 방법은 [**WaniKani API 토큰**](#wanikani-api-token)을 참고하세요.
:::

## <a href={new URL('?view=settings#playback', project.urls.app).href}>재생</a> {#playback}

### 재생 모드 및 키보드 단축키의 영향을 받는 자막 트랙 {#playback-subtitle-tracks}

[자막](#subtitles-keyboard-shortcuts) 및 [탐색](#seek-keyboard-shortcuts) 키보드 단축키나 재생 모드에서 고려할 트랙을 지정합니다. 예를 들어 압축 모드를 사용하면 이 옵션에서 선택한 트랙에 자막이 없는 타임라인 구간을 자동으로 건너뜁니다.

### 자막 위에 마우스를 올리면 자동 일시 정지 {#auto-pause-when-mousing-over-subtitles}

자막 위에 마우스를 올렸을 때 자동 일시 정지 동작을 지정합니다. "자동 재개 사용"은 자막에서 마우스를 옮기면 재생이 자동으로 재개됨을 뜻합니다.

### 재생 모드 {#playback-modes}

[재생 키보드 단축키](#playback-keyboard-shortcuts)로 재생 모드를 전환할 수 있습니다.

### 재생 속도 {#playback-rate}

미디어의 일반 재생 속도를 지정합니다. 빨리 감기를 사용할 때 자막 안에서 재생되는 속도도 포함됩니다. 재생은 항상 이 속도로 시작합니다. 시청 중 속도를 조정하려면 [재생 속도 키보드 단축키](#playback-rate-keyboard-shortcuts)를 사용합니다.

### 재생 속도 알림 표시 {#show-playback-rate-notification}

빨리 감기 재생 외의 상황에서 재생 속도가 바뀌면 알림을 표시합니다.

### 자동 일시 정지 설정 {#auto-pause-preference}

자동 일시 정지를 사용할 때 자막의 시작, 끝 또는 양쪽 경계에서 일시 정지할지 지정합니다. 양쪽 경계와 반복을 모두 사용하면 반복 전에 끝에서 일시 정지하지만, 두 번 멈추지 않도록 시작 부분의 일시 정지는 건너뜁니다.

### 반복 횟수 설정 {#repeat-count-preference}

재생을 계속하기 전에 각 자막을 반복할 횟수를 지정합니다. `0`은 무한 반복을 뜻합니다.

### 자막을 표시하기 전 반복 횟수 {#repeats-before-showing-subtitles}

반복 구간에서 지정한 횟수만큼 반복하기 전까지 자막을 숨깁니다. `0`은 숨기지 않으며 `1`은 첫 번째 반복부터 자막을 표시합니다.

### 자막 트리거 시작 및 종료 오프셋 {#subtitle-trigger-start-and-end-offsets}

자동 일시 정지 및 반복에 사용하는 자막 시작/종료 트리거를 밀리초 단위로 조정합니다. 이 오프셋은 전역 자막 오프셋을 적용한 후 적용됩니다. 시작 및 종료 오프셋은 별도로 설정할 수 있습니다. 양수는 재생 동작을 늦추고 음수는 앞당깁니다. 이동한 각 경계는 미디어 및 인접 자막 이벤트의 경계를 넘지 않습니다. 이동한 시작과 종료가 서로 교차하면 시간 순서에 따라 역할을 바꿉니다.

### 빨리 감기 최소 건너뛰기 간격 {#fast-forward-minimum-skip-interval}

자막 사이 간격이 이 값 이상이면 전체 구간을 빨리 감습니다. 더 짧은 간격은 일반 재생 속도로 유지합니다.

### 빨리 감기 재생 속도 {#fast-forward-playback-rate}

빨리 감기 모드를 사용할 때의 재생 속도입니다.

### 압축 재생 최소 건너뛰기 간격 {#condensed-playback-minimum-skip-interval}

압축 재생을 사용할 때 다음 자막까지의 간격이 이 값 이상인 경우에만 다음 자막으로 건너뜁니다.

### 자막 사이 구간 트리거 시작 및 종료 오프셋 {#subtitle-gap-trigger-start-and-end-offsets}

빨리 감기 및 압축 재생에서 사용하는 자막 사이 구간 트리거를 조정합니다. 구간 시작 오프셋은 음수가 아니며 자막이 끝난 시점에서 트리거를 늦춥니다. 구간 종료 오프셋은 양수가 아니며 다음 자막 직전 시점에서 트리거를 앞당깁니다. 각 구간은 미디어 및 인접 자막 이벤트의 경계를 넘지 않습니다.

### 자동 일시 정지 재개 모드 {#auto-pause-resume-mode}

자동 일시 정지의 종료 방식을 지정합니다.

- **수동**: 직접 재개할 때까지 일시 정지 상태를 유지합니다.

- **고정**: 모든 자동 일시 정지가 같은 시간 동안 지속됩니다.
  - [고정 일시 정지 시간](#fixed-pause-duration)과 [자동 일시 정지 후 재개 지연](#resume-delay-after-auto-pause) 설정을 사용합니다.

- **자막 길이**: 자막의 문자 수로 일시 정지 시간을 계산합니다. 탐색 가능한 트랙의 자막만 계산하므로 학습 언어와 함께 불러온 번역 트랙은 일시 정지 시간을 늘리지 않습니다.
  - [최소 일시 정지 시간](#minimum-pause-duration), [최대 일시 정지 시간](#maximum-pause-duration), [문자당 일시 정지 시간](#pause-time-per-character), [자동 일시 정지 후 재개 지연](#resume-delay-after-auto-pause) 설정을 사용합니다.

### 고정 일시 정지 시간 {#fixed-pause-duration}

**고정** 모드에서 자동 일시 정지가 지속되는 시간입니다.

### 최소 일시 정지 시간 {#minimum-pause-duration}

자막 문자 수와 관계없이 **자막 길이** 모드에 적용할 수 있는 가장 짧은 일시 정지 시간입니다.

### 최대 일시 정지 시간 {#maximum-pause-duration}

**자막 길이** 모드에 적용할 수 있는 가장 긴 일시 정지 시간입니다. `0`은 상한이 없음을 뜻합니다. 0이 아닌 최대값은 최소 일시 정지 시간보다 낮을 수 없습니다.

### 문자당 일시 정지 시간 {#pause-time-per-character}

**자막 길이** 모드에서 문자마다 할당할 시간(밀리초)입니다. 문자 수에 이 값을 곱한 결과는 최소 및 최대 일시 정지 시간 사이로 제한됩니다.

### 자동 일시 정지 후 재개 지연 {#resume-delay-after-auto-pause}

**고정** 및 **자막 길이** 모드에서는 자동 일시 정지가 두 단계로 진행됩니다. 먼저 설정된 일시 정지 시간 동안 자막을 표시한 다음 자막을 숨기고 재개 지연 시간 동안 일시 정지 상태를 유지합니다. 이 설정은 두 번째 단계의 길이를 지정합니다.

### 자막 표시 {#show-subtitles}

- **표시 시간 동안**: 자막 표시 시간이 활성 상태일 때 자막을 표시합니다.

- **일시 정지 중**: 자막 표시 시간 중에 재생이 일시 정지된 경우에만 자막을 표시합니다.

- **수동 일시 정지 중**: 자막 표시 시간 중에 재생을 직접 일시 정지한 경우에만 자막을 표시합니다.

## <a href={new URL('?view=settings#playback', project.urls.app).href}>재생 > 주석</a> {#playback-annotation}

이 설정은 선택한 자막 트랙의 [주석](#annotation)에서 단어 상태, 상태값 및 빈도 정보를 사용합니다. 자동 일시 정지, 압축, 빨리 감기, 반복 규칙은 해당 재생 모드가 켜져 있을 때 적용됩니다. **단어 필터 없음**은 해당 트랙에서 상태나 상태값을 선택하지 않았다는 뜻입니다. 규칙은 트랙별로 적용됩니다. 특정 모드의 상태나 상태값을 선택하지 않은 탐색 가능 트랙은 규칙이 있는 트랙과 함께 재생되더라도 해당 모드의 기본 동작을 유지합니다.

### 자막 트랙 {#playback-annotation-track}

주석 재생 설정을 수정할 자막 트랙을 선택합니다. 선택한 트랙은 주석 탭과 공유됩니다.

### 일시 정지 시 첫 번째 일치 단어 선택 {#select-first-matching-word-on-pause}

재생이 일시 정지될 때마다(직접 일시 정지하거나 일시 정지 상태에서 탐색한 경우 포함) 선택한 상태나 상태값과 일치하는 첫 번째 단어를 선택합니다. 이 동작을 사용하지 않으려면 선택 항목을 비워 둡니다. 동영상 플레이어에서 단어를 선택하며, 동영상이 불러와지지 않았거나 연결되지 않은 경우 자막 플레이어에서 선택합니다.

일시 정지가 [주석 기반 자동 일시 정지 규칙](#auto-pause-subtitles-containing-these-words)에 따른 경우에는 해당 규칙과 일치하는 단어를 선택합니다. 직접 일시 정지했을 때의 선택은 이 드롭다운 설정을 계속 따릅니다.

아래의 각 단어 규칙에는 상태 및 상태값 선택, 단어 수 제한, 빈도 제한이 각각 있습니다. 단어는 선택한 상태 또는 상태값에 해당하고 두 제한을 모두 만족해야 합니다.

### 다음 단어가 포함된 자막 자동 일시 정지 {#auto-pause-subtitles-containing-these-words}

자동 일시 정지 모드가 켜져 있으면 일치하는 단어가 포함된 자막에서만 일시 정지하고 첫 번째 일치 단어를 선택합니다. 자동 일시 정지에서는 [**일시 정지 시 첫 번째 일치 단어 선택**](#select-first-matching-word-on-pause)보다 이 설정이 우선합니다. 직접 일시 정지할 때는 해당 드롭다운 설정을 적용합니다.

### 다음 단어가 포함된 자막 반복 {#repeat-subtitles-containing-these-words}

반복 모드가 켜져 있을 때 일치하는 단어가 포함된 자막만 반복합니다.

### 다음 단어가 포함된 자막을 압축 모드로 재생 {#play-subtitles-containing-these-words-in-condensed-mode}

압축 모드가 켜져 있으면 일치하는 단어가 포함된 자막을 압축 타임라인에 유지하고 다른 자막은 건너뜁니다.

### 빨리 감기 모드에서 다음 단어가 포함된 자막을 정상 속도로 재생 {#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode}

빨리 감기 모드가 켜져 있으면 일치하는 단어가 포함된 자막을 일반 재생 속도로 재생하고 다른 자막은 빨리 감습니다.

### 이해도에 따라 빨리 감기 속도 조정 {#adjust-fast-forward-rate-by-comprehension}

빨리 감기 모드가 켜져 있을 때 문장 이해도 점수에 따라 자막 구간 내 재생 속도를 정합니다.

[**최소 이해도**](#minimum-comprehension) 이하에서는 일반 재생 속도를 사용하고, 100%에서는 설정된 빨리 감기 속도를 사용합니다. 그 사이의 속도는 비례 계산됩니다.

이해도에 따라 속도가 제어되는 자막에서 속도를 변경하면 설정된 빨리 감기 속도가 바뀌고 이해도를 바탕으로 적용 속도를 다시 계산합니다. 이해도에 따라 자막이 일반 속도로 유지되는 경우에도 마찬가지입니다. 키보드 단축키와 플레이어의 속도 컨트롤도 같은 방식으로 작동하며 일반 속도는 바뀌지 않습니다.

### 최소 이해도 {#minimum-comprehension}

가속을 시작할 이해도 비율을 설정합니다(0~99%, 기본값 60%).

### 재생 중 다음 단어 표시 {#show-these-words-during-playback}

단어를 계속 표시할 상태 및 상태값을 선택합니다.

### 단어의 지정된 비율 이상이 숨겨질 경우 자막 전체 숨기기 {#whole-subtitle-hidden-percentage}

표시 규칙에 따라 자막 단어의 지정된 비율 이상이 숨겨지면 자막 전체를 숨깁니다. 예를 들어 **80%**로 설정하면 다섯 단어 중 네 단어가 숨겨질 자막에서 표시 대상으로 선택된 한 단어를 포함해 자막 전체가 숨겨집니다. 문장 부호와 기타 문자가 아닌 항목은 계산하지 않습니다.

### 일치하지 않는 단어를 개별적으로 숨기기 {#hide-non-matching-words-individually}

사용 설정하면 자막 전체 숨기기 기준에 도달하기 전 표시 규칙을 충족하지 않는 단어를 개별적으로 숨깁니다. 사용 중지하면 기준에 도달할 때까지 자막 전체를 표시합니다.

### 선택한 범주별 최소 단어 수 {#minimum-words-per-selected-category}

자막 내에서 선택한 각 범주(예: **미수집**, **무시됨**)를 별도로 계산합니다. 해당 범주의 단어 수가 이 제한보다 적으면 그 범주의 단어는 규칙을 실행하지 않습니다. `0`은 제한을 사용하지 않습니다.

### 선택한 범주별 최대 단어 수 {#maximum-words-per-selected-category}

자막 내에서 선택한 각 범주(예: **미수집**, **무시됨**)를 별도로 계산합니다. 해당 범주의 단어 수가 이 제한보다 많으면 그 범주의 단어는 규칙을 실행하지 않습니다. `0`은 제한을 사용하지 않습니다.

### 단어 빈도가 다음 값 이상인 경우에만 {#only-when-word-frequency-is-at-least}

일치하는 단어의 빈도가 이 값 이상이어야 합니다. 빈도 정보가 없으면 `1`로 계산합니다. `0`은 제한을 사용하지 않습니다.

### 단어 빈도가 다음 값 이하인 경우에만 {#only-when-word-frequency-is-at-most}

일치하는 단어의 빈도가 이 값 이하여야 합니다. 빈도 정보가 없으면 `1`로 계산합니다. `0`은 제한을 사용하지 않습니다.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>스트리밍 동영상</a> (확장 프로그램 전용) {#streaming-video}

스트리밍 동영상 설정은 브라우저 확장 프로그램을 설치한 경우에만 사용할 수 있습니다.

### 자막을 불러올 때 별도 탭에서 앱으로 자막 목록도 열기 {#open-subtitle-list-in-tab}

동영상 요소에 자막을 불러올 때마다 웹사이트를 열고 불러온 자막을 별도 탭의 웹사이트와 동기화합니다.

### 앱 URL {#app-url}

확장 프로그램이 일부 설정을 가져올 위치와 별도 탭에서 실행 중인 웹사이트와 자막을 동기화할 때 열 URL을 지정합니다. 기본적으로 웹사이트 URL입니다.

### 컨트롤 오버레이 사용 설정 {#enable-controls-overlay}

자막을 불러온 동영상 요소에 오버레이 UI를 표시합니다.

### 자막 표시 {#display-subtitles}

불러온 자막을 동영상 요소에 표시합니다.

### 마이닝 시 오디오 녹음 {#record-audio-when-mining}

자막을 마이닝할 때 해당 자막에 포함된 오디오를 녹음해 플래시카드에 추가합니다.

### 마이닝 시 스크린샷 촬영 {#take-screenshot-when-mining}

자막을 마이닝할 때 스크린샷을 촬영해 플래시카드에 추가합니다.

### 마이닝 시 스크린샷 정리 {#clean-screenshot-when-mining}

자막을 마이닝하고 스크린샷을 사용 설정한 경우 스크린샷을 찍기 전에 동영상 요소 위의 HTML 요소를 제거해 스크린샷을 "깔끔하게" 만듭니다.

### 마이닝 시 스크린샷 자르기 {#crop-screenshot-when-mining}

자막을 마이닝할 때 스크린샷을 동영상 요소 크기에 맞춰 자릅니다.

### 이미지 캡처 형식 {#streaming-image-capture-format}

스트리밍 동영상에서 마이닝한 카드의 이미지 캡처 형식을 지정합니다. 추가 옵션인 "애니메이션 WebP"는 단일 스크린샷 대신 자막 시간 범위(오디오 패딩 포함) 동안 탭에서 재생되는 동영상을 캡처해 애니메이션 이미지로 저장합니다.

애니메이션 WebP는 [마이닝 시 오디오 녹음](#record-audio-when-mining)을 사용 설정했을 때만 사용되며, 그렇지 않으면 평소처럼 스크린샷을 촬영합니다. 녹화 키보드 단축키로 시작하고 중지하는 수동 녹화를 포함해 미디어를 녹음하는 모든 마이닝 방식에 적용되며, 녹화를 중지할 때까지(최대 30초) 캡처합니다. 한 번에 하나의 녹음만 진행할 수 있습니다. Firefox에서는 애니메이션 WebP를 사용할 수 없으며 DRM 보호 동영상은 캡처할 수 없습니다. Chrome은 숨겨진 탭의 렌더링을 중단하므로 클립을 캡처하는 동안 탭이 표시되어 있어야 합니다.

### 애니메이션 이미지 FPS {#animated-image-fps}

애니메이션 WebP 이미지의 초당 캡처 프레임 수입니다. 클립이 길수록 카드 크기를 줄이기 위해 프레임 수가 자동으로 감소합니다. 애니메이션 WebP 이미지 캡처 형식을 선택했을 때만 사용할 수 있습니다.

### 애니메이션 이미지 품질 {#animated-image-quality}

애니메이션 WebP 이미지의 각 프레임 품질입니다(`0.1`~`1`). 값이 높을수록 화질이 좋아지지만 파일 크기도 커집니다. 애니메이션 WebP 이미지 캡처 형식을 선택했을 때만 사용할 수 있습니다.

### 자막 파일 끌어다 놓기 허용 {#allow-subtitle-file-drag-and-drop}

자막 파일을 동영상 요소에 끌어다 놓을 수 있도록 허용합니다.

### 감지된 자막 자동 불러오기 {#auto-load-detected-subtitles}

현재 웹사이트에서 자막 자동 감지를 지원하면 자막을 자동으로 불러옵니다. 여러 트랙이 감지되면 기본 설정 언어의 트랙을 불러옵니다. 기본 설정 언어는 "트랙 선택 기억" 상자를 선택한 상태에서 마지막으로 불러온 언어입니다.

### 감지된 자막 자동 불러오기에 실패하면 확인 요청 {#prompt-on-subtitle-autoload-failure}

자막 자동 불러오기에 실패하면 감지된 자막을 불러오기 전에 확인을 요청합니다.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>스트리밍 동영상 > 페이지</a> {#pages}

YouTube, Netflix 등 페이지별 연동을 설정합니다. asbplayer에는 각 페이지의 기본 설정이 미리 구성되어 있으며 페이지 섹션에서 기본값을 변경할 수 있습니다.

### 기계 번역 대상 언어 코드(YouTube 전용) {#youtube-translation-languages}

YouTube 기계 번역에 사용할 대상 언어를 지정합니다. 언어를 지정하면 자막 트랙 선택기에 대상 언어별 트랙이 추가로 표시됩니다.

## <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>기타</a> {#misc}

### 설정 가져오기/내보내기 {#import-export-settings}

설정을 `json` 파일로 가져오거나 내보냅니다.

### 테마 {#theme}

asbplayer 전체를 밝은 테마 또는 어두운 테마로 표시합니다.

### 언어 {#language}

UI를 표시할 언어입니다.

참고: asbplayer가 지원하는 모든 언어로 모든 문자열이 번역된 것은 아닙니다. 번역되지 않은 문자열은 영어로 표시됩니다. [Crowdin 프로젝트](https://crowdin.com/project/asbplayer)에서 번역에 참여할 수 있습니다.

### 로컬 동영상 자동 최대화 {#auto-maximize-local-video}

자막 패널을 열 때 로컬 동영상을 자동으로 최대화합니다.

### 자막 목록에 마이닝 버튼 표시 {#show-mining-button-in-subtitle-list}

사용 설정하면 자막 목록의 각 자막 옆에 마이닝 버튼을 표시합니다.

### 자막 목록 타임스탬프 {#subtitle-list-timestamps}

자막 목록에서 타임스탬프를 표시하는 방식을 지정합니다.

- **숨김**: 표시하지 않습니다.
- **시작**: 자막 시작 타임스탬프만 표시합니다.
- **시작 및 종료**: 자막 시작 및 종료 타임스탬프를 모두 표시합니다.

### 자막 오프셋 기억 {#remember-subtitle-offset}

사용 설정하면 타이밍 오프셋이 유지됩니다. 자막을 마지막으로 사용한 오프셋으로 불러옵니다.

### 마지막 재생 속도 기억 {#remember-last-playback-rate}

동영상의 재생 속도를 변경하면 재생 속도 설정을 업데이트합니다. 사용 중지하면 재생은 구성된 속도로 시작하지만 시청 중 변경한 값은 임시로만 적용됩니다.

### 마지막 재생 모드 기억 {#remember-last-playback-modes}

다시 재생을 불러올 때 마지막으로 사용한 재생 모드를 복원합니다. 사용 중지하면 일반 모드로 재생을 시작합니다.

### 현재 자막을 클립보드에 자동 복사 {#auto-copy-current-subtitle-to-clipboard}

자막이 화면에 나타날 때 클립보드에 자동으로 복사합니다. 클립보드를 모니터링하는 앱으로 자막을 보낼 때 유용합니다.

### 자동 복사할 자막 트랙 {#subtitle-tracks-eligible-for-auto-copy}

[현재 자막을 클립보드에 자동 복사](#auto-copy-current-subtitle-to-clipboard)를 사용 설정했을 때 자동 복사할 트랙을 지정합니다.

### 미리보기 썸네일 표시 {#show-preview-thumbnails}

자막 목록에 미리보기 썸네일을 표시합니다.

### 썸네일 위에 자막 표시 {#subtitle-above-thumbnail}

자막 목록의 미리보기 썸네일 위에 자막을 표시합니다.

### 자막 Regex 필터 {#subtitle-regex-filter}

이 Regex와 일치하는 부분 문자열은 [자막 Regex 필터 텍스트 대체](#subtitle-regex-filter-text-replacement)에 지정한 값으로 바뀝니다.

### 자막 Regex 필터 텍스트 대체 {#subtitle-regex-filter-text-replacement}

위 Regex와 일치하는 부분 문자열을 이 설정의 값으로 바꿉니다. 비워 두면 일치하는 부분 문자열을 제거합니다.

### 자막 HTML {#subtitle-html}

자막 파일에 포함된 HTML을 처리하는 방식을 지정합니다.

### 루비 자동 감지 및 표시 {#detect-and-display-ruby}

사용 설정하면 asbplayer가 Netflix 방식의 단어 읽는 법을 자동으로 감지하고 `ruby` 태그를 사용해 스타일을 적용해 표시합니다. Netflix 방식의 읽는 법은 일본어 자막에 자주 나타나며 `花子（はなこ）`처럼 단어 뒤에 괄호로 읽는 법이 붙습니다.

### WebSocket 클라이언트 사용 {#enable-websocket-client}

WebSocket 클라이언트를 사용합니다. WebSocket 인터페이스로 asbplayer를 제어할 수 있습니다.

### WebSocket 서버 URL {#websocket-server-url}

WebSocket 클라이언트를 사용할 때 연결할 서버의 URL입니다. 일반적으로 [사전 패키징된 WebSocket 서버](../guides/web-socket-server.md)를 로컬에서 실행한 인스턴스입니다.

### 마이닝 기록 저장 한도 {#mining-history-storage-limit}

마이닝 기록에 저장할 수 있는 카드 수를 제한합니다.

### 탭 이름 {#name-of-the-tab}

앱 탭에 표시할 이름입니다.

## 프로필 {#profiles}

설정 프로필은 서로 다른 설정 값 모음입니다. 설정 UI 또는 **자막 불러오기** 및 **Anki 내보내기** 대화상자에서 활성 설정 프로필을 변경할 수 있습니다.
