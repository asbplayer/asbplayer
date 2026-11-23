---
sidebar_position: 9
---

import project, { webSocketHttpUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# WebSocket 서버 {#websocket-server}

asbplayer는 WebSocket 연결의 양방향 통신을 활용해 브라우저 외부에서 접근할 수 있는 인터페이스를 제공합니다.

이 구조에서 asbplayer는 사용자의 컴퓨터에서 실행되는 **WebSocket 서버**에 연결을 유지하는 **WebSocket 클라이언트**입니다. 서버는 클라이언트인 asbplayer에 명령을 전달하는 HTTP 인터페이스를 제공합니다. 사전 패키징된 서버에 관한 기술 정보는 [여기](../reference/external-api.md)에서 확인할 수 있습니다.

이 서버는 원래 AnkiConnect `addNote` 요청에 asbplayer가 제공하는 미디어를 추가해 원클릭 마이닝을 지원하기 위해 작성되었습니다. 따라서 주요 기능 중 하나는 **AnkiConnect 프록시**이기도 합니다.

:::note
원클릭 마이닝에는 [asbplayer Anki 추가 기능](./one-click-mining.md#install-the-asbplayer-anki-add-on)을 사용하는 것이 좋습니다. 아래에 설명된 AnkiConnect 프록시도 사용할 수 있습니다.
:::

## 서버 실행 {#run-the-server}

1. <a href={project.urls.repo}>asbplayer 저장소</a>를 복제합니다.

    <CodeBlock language="bash">{`git clone ${project.urls.repo}.git asbplayer`}</CodeBlock>

2. 아직 설치하지 않았다면 [Golang](https://go.dev/dl/)을 설치합니다.
3. 서버를 실행합니다.

    ```
    cd asbplayer/scripts/web-socket-server
    go run .
    ```

프록시는 매우 가벼우므로 백그라운드에서 계속 실행해도 괜찮습니다. Windows에서는 [RBTray](https://github.com/benbuck/rbtray)를 사용해 작업 표시줄로 최소화할 수 있습니다.

## asbplayer를 서버에 연결 {#connect-asbplayer-to-the-server}

<a href={new URL('?view=settings#misc-settings', project.urls.app).href}>기타 설정</a>에서 asbplayer의 WebSocket 클라이언트를 구성하고 사용 설정합니다. 기본적으로 asbplayer는 WebSocket 서버의 기본 IP 주소와 포트를 사용하므로 보통 WebSocket 클라이언트를 사용 설정하기만 하면 됩니다.

## AnkiConnect 프록시로 원클릭 마이닝 {#one-click-mining-with-the-ankiconnect-proxy}

 [Yomitan 웹사이트](https://yomitan.wiki/)의 안내에 따라 Yomitan을 설치하고 학습하려는 언어의 사전을 설정합니다.

그런 다음 Yomitan을 다음과 같이 설정합니다.

- AnkiConnect URL은 AnkiConnect가 아니라 AnkiConnect 프록시를 가리켜야 합니다. 프록시 URL 기본값은 <code>{webSocketHttpUrl}</code>입니다.
- Yomitan과 asbplayer에서 같은 **노트 유형**을 사용해야 합니다.

Yomitan으로 문장을 마이닝하면 단어 정의, 이미지, 오디오가 이미 포함된 카드가 만들어집니다. 프록시의 `POST_MINE_ACTION`을 `2`(마지막 카드 업데이트)로 설정하면 완전한 원클릭 마이닝을 할 수 있습니다. 자세한 내용은 [서버 설정](#server-configuration)을 참고하세요.

문장 필드에 항상 asbplayer의 자막 텍스트를 사용하려면 **마이닝** 설정에서 [**문장 필드에 항상 자막 텍스트 사용**](../reference/settings.md#always-use-subtitle-text-for-sentence-field)을 사용 설정합니다. 그러면 Yomitan이 제공한 문장 텍스트가 모든 트랙에서 마이닝한 자막 텍스트로 바뀝니다.

## API 참고 {#api-reference}

WebSocket 연결을 통해 asbplayer에 보낼 수 있는 명령은 [기술 참고](../reference/external-api.md#commands)에 설명되어 있습니다.

## HTTP 기반 API {#http-based-api}

WebSocket 서버는 위에 설명된 명령을 실행하는 HTTP 기반 API를 구현합니다.

- `POST asbplayer/load-subtitles` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/load-subtitles`}>script</a>)
- `POST asbplayer/seek` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/seek`}>script</a>)
- `GET asbplayer/bound-media` (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/bound-media`}>script</a>)
- `GET asbplayer/subtitles` (optional `?mediaId=...&trackNumbers=0,1`) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/subtitles`}>script</a>)

## AnkiConnect 프록시 {#ankiconnect-proxy}

WebSocket 서버는 AnkiConnect 프록시로도 작동해 `addNote` 요청에 오디오 및 스크린샷 같은 asbplayer 제공 문맥을 추가합니다.

프록시는 `addNote`를 제외한 모든 AnkiConnect 요청을 그대로 전달합니다. `addNote` 요청을 처리하는 방식은 아래 설정에 설명된 `POST_MINE_ACTION` 값에 따라 달라집니다.

## 서버 설정 {#server-configuration}

서버와 같은 디렉터리에 `.env` 파일을 두어 서버를 설정합니다. 아래는 설명이 포함된 설정 파일 예시입니다.

```
# Port that the proxy will listen on
PORT=8766

# AnkiConnect URL
ANKI_CONNECT_URL=http://127.0.0.1:8765

# Action for asbplayer to take when the proxy receives an addNote request
# 0 = 'None'
# 1 = 'Open Anki dialog'
# 2 = 'Update last card' (updates last card with asbplayer media AFTER passing through original addNote request)
# 3 = 'Export card'
POST_MINE_ACTION=2
```
