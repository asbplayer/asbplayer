---
sidebar_position: 7.5
---

import project from '@site/src/project';

# Android {#android}

사용 환경은 다소 불편하지만 Android 기기에서도 asbplayer를 사용할 수 있습니다.

## 웹사이트 {#website}

웹사이트는 별도 설정 없이 사용할 수 있습니다. 기본 데스크톱용 동영상 컨트롤 대신 **오버레이 UI**가 표시됩니다.

### 홈 화면에 추가 {#add-to-home-screen}

웹사이트는 프로그레시브 웹 앱이므로 Android 기기의 홈 화면에 추가할 수 있습니다. 브라우저 메뉴에서 "홈 화면에 추가"를 탭합니다.

## 확장 프로그램 {#extension}

:::warning
**여러 기능을 사용할 수 없습니다**: **사이드 패널**, **스크린샷**, **WebSocket 인터페이스**가 지원되지 않습니다. 브라우저별 지원 여부는 [호환성](../compatibility.md#browsers-and-features) 섹션의 표를 참고하세요.
:::

웹사이트와 마찬가지로 확장 프로그램에서는 주로 **오버레이 UI**를 사용합니다. 사이드 패널이 없으므로 브라우저의 확장 프로그램 메뉴에서 asbplayer 버튼을 선택해 **자막을 불러옵니다**. 키보드 사용은 필수가 아니지만, 확장 프로그램에서 [키보드 단축키](../reference/settings.md#keyboard-shortcuts)를 사용하려면 (Bluetooth) 키보드가 유용합니다.

asbplayer를 설치할 수 있는 Android 브라우저는 다음과 같습니다.

### Firefox for Android {#firefox-for-android}

<a href={project.extension.firefoxAndroid.storeUrl}>AMO 페이지</a>에서 asbplayer를 설치합니다. Firefox for Android는 Firefox와 같은 제한이 있어 DRM으로 보호된 스트림에서는 오디오를 녹음할 수 없습니다.

### Edge Canary {#edge-canary}

Edge Canary는 확장 프로그램을 실행할 수 있는 또 다른 Chromium 기반 모바일 브라우저입니다. 현재 Edge Canary용 asbplayer에서는 오디오 녹음을 지원하지 않습니다.
Edge Canary에 asbplayer를 설치하려면 다음 단계를 따릅니다.

1. Download the asbplayer `crx` file from the <a href={`${project.urls.repo}/releases/latest`}>releases page</a>.
2. 아직 사용 설정하지 않았다면 Edge Canary 설정에서 "Microsoft Edge 정보"로 이동한 다음 빌드 버전 문자열을 여러 번 탭해 개발자 모드를 사용 설정합니다.
3. **개발자 옵션**에서 **CRX로 확장 프로그램 설치**를 탭하고 방금 다운로드한 `crx` 파일을 선택합니다.

### Kiwi Browser (개발 중단) {#kiwi-browser-discontinued}

Kiwi Browser는 확장 프로그램을 실행할 수 있는 Chromium 기반 모바일 브라우저입니다. 다만 개발이 중단되어 [GitHub 페이지](https://github.com/kiwibrowser/src.next/releases)에서만 설치할 수 있습니다. Kiwi Browser를 설치한 다음 Chrome <a href={project.extension.chrome.storeUrl}>웹 스토어</a>에서 asbplayer를 설치할 수 있습니다.

## Anki 연동 {#anki-integration}

Anki와 연동하려면 [AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid)를 설치합니다.
