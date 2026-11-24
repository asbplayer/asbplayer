---
sidebar_position: 8
---

import project, { ankiConnectUrl, webSocketUrl } from '@site/src/project';

# 원클릭 마이닝 {#one-click-mining}

asbplayer는 자막과 동영상 콘텐츠를 AnkiConnect에 연결하지만, 단어 정의를 자동으로 제공하지는 않습니다. 따라서 대부분의 문장 마이닝 과정에서는 마우스나 키보드 입력이 두세 번 필요합니다.

다음 기능을 갖춘 다른 앱을 asbplayer와 함께 사용하면 원클릭 마이닝을 할 수 있습니다.

- 누락된 단어 정의 정보를 제공하고
- AnkiConnect와 이미 연동되어 있어야 합니다.

[Yomitan](https://yomitan.wiki/)이 그 예입니다.

## Yomitan 설치 및 설정 {#install-and-configure-yomitan}

[Yomitan 웹사이트](https://yomitan.wiki/)의 안내에 따라 Yomitan을 설치하고 학습하려는 언어의 사전을 설정합니다. 아직 추가하지 않았다면 Anki에 [AnkiConnect](https://ankiweb.net/shared/info/2055492159)도 추가해야 합니다.

Yomitan의 Anki 설정에서 다음을 확인합니다.

- AnkiConnect 서버 주소는 기본값(<code>{ankiConnectUrl}</code>)이어야 합니다.
- Yomitan과 asbplayer에서 같은 **노트 유형**을 사용해야 합니다.

## asbplayer Anki 추가 기능 설치 {#install-the-asbplayer-anki-add-on}

이 추가 기능을 사용하려면 Anki 25.02 이상이 필요합니다. 아직 AnkiWeb에서 제공하지 않으므로 파일에서 설치해야 합니다.

1. <a href={`${project.urls.repo}/releases?q=${encodeURIComponent(project.releases.ankiAddon.releaseTitlePrefix)}`}>릴리스 페이지</a>에서 최신 `.ankiaddon` 파일을 다운로드합니다.
2. 파일을 열고 팝업에서 **예**를 누릅니다.
3. Anki를 다시 시작합니다.

## asbplayer를 추가 기능에 연결 {#connect-asbplayer-to-the-add-on}

asbplayer 확장 프로그램의 <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>기타 설정</a> 아래쪽에서 WebSocket 클라이언트를 사용 설정합니다. 추가 기능의 기본값과 일치하는 기본 WebSocket 서버 URL(<code>{webSocketUrl}</code>)을 그대로 사용합니다.

## 평소처럼 **Yomitan**으로 마이닝 {#mine-with-yomitan-as-usual}

Yomitan으로 문장을 마이닝하면 단어 정의, 이미지, 오디오가 이미 포함된 카드가 만들어집니다.

문장 필드에 항상 asbplayer의 자막 텍스트를 사용하려면 **마이닝** 설정에서 [**문장 필드에 항상 자막 텍스트 사용**](../reference/settings.md#always-use-subtitle-text-for-sentence-field)을 사용 설정합니다. 그러면 Yomitan이 제공한 문장 텍스트가 모든 트랙에서 마이닝한 자막 텍스트로 바뀝니다.

같은 자막에서 여러 단어를 추출하면 **이전 카드 업데이트**로 이전에 일치한 카드도 업데이트할 수 있습니다. [**문장 업데이트**](../reference/settings.md#update-sentence-for-cards-with-the-same-subtitle-text)를 사용 설정하면 문장과 구성된 자막 트랙을 공유하고, [**이미지/오디오 업데이트**](../reference/settings.md#update-all-cards-with-the-same-subtitle-text)를 사용 설정하면 스크린샷과 오디오 클립을 공유합니다.

## 추가 기능 설정

Anki의 **도구 > 추가 기능**에서 해당 추가 기능을 선택하고 **설정**을 눌러 설정을 변경할 수 있습니다. `postMineAction`은 Yomitan이 카드를 추가한 뒤 asbplayer가 수행할 동작입니다(기본값: <code>{project.services.webSocket.postMineAction}</code>). 원클릭 마이닝을 사용하려면 `2`(마지막 카드 업데이트)로 설정합니다. `port`를 변경했다면 asbplayer의 WebSocket 서버 URL도 이에 맞게 변경해야 합니다.
