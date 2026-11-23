---
sidebar_position: 1
---

import project from '@site/src/project';

# 주석 {#annotation}

asbplayer는 언어 학습을 돕기 위해 자막에 주석을 표시할 수 있습니다. 주석 기능은 다음과 같습니다.

- **단어 스타일**: 단어 상태에 따라 색상, 밑줄, 윤곽선 등을 표시합니다.
    - 단어 상태는 Anki, WaniKani와 연동하거나 asbplayer에 로컬로 기록할 수 있습니다. 알려진 단어를 추가하기 위한 가져오기 및 내보내기 기능도 제공됩니다.
- **읽기 주석**: 각 단어 위에 읽는 법을 표시하거나 상태에 따라 표시합니다.
- **빈도 주석**: 순위 기반 빈도를 각 단어 아래에 표시하거나 상태에 따라 표시합니다. 순위 기반 빈도 사전이 하나 이상 필요합니다.
- **피치 악센트 주석**: 후리가나 또는 가나 단어에 악센트 패턴을 표시합니다. 피치 악센트 사전이 하나 이상 필요합니다.
- **용어집 주석**: 각 단어에 간단한 정의나 설명을 표시합니다.
- **통계 및 이해도**: 현재 미디어에서 알고 있는 단어에 관한 정보를 제공합니다.
- **적응형 재생**: 재생 모드와 주석 데이터를 활용해 학습 경험을 최적화합니다.
- **단어 브라우저**: 로컬 단어를 관리하고 외부 소스와 동기화된 단어를 확인합니다.
- **앞으로 더 많은 기능이 추가될 예정입니다.**

:::info
주석 기능을 사용하려면 [Yomitan](https://yomitan.wiki/) 인스턴스와 [yomitan-api](https://github.com/yomidevs/yomitan-api)를 설정해야 합니다.

**로컬 단어 데이터베이스**를 사용한다면 브라우저가 저장된 단어를 삭제할 가능성을 줄이기 위해 asbplayer 브라우저 확장 프로그램을 설치하는 것이 좋습니다. 확장 프로그램을 설치할 수 없다면 설정 및 로컬 단어를 주기적으로 내보내 백업하세요.
:::

## 설정 {#setup}

1. asbplayer **설정**을 엽니다.
2. **주석** 섹션으로 이동합니다.
3. 설정할 트랙을 선택합니다.
4. 해당 트랙의 **Yomitan URL**을 설정합니다.
    - [Yomitan](https://yomitan.wiki/) 인스턴스와 [yomitan-api](https://github.com/yomidevs/yomitan-api)를 설정해야 합니다.
    - URL이 잘못되었거나 연결할 수 없으면 asbplayer가 설정 옆에 오류를 표시합니다.
    - 빈도 정보를 사용하려면 Yomitan 인스턴스에 순위 기반 빈도 사전이 하나 이상 있어야 합니다.
5. (Anki 사용자) 알려진 상태 정보를 가져올 카드를 설정합니다.
    - 보통 [`Anki 덱`](../reference/settings.md#anki-decks)은 비워 두어 모든 덱에서 가져오고, 필드로 필터링하면 충분합니다.
    - [`Anki 단어 필드`](../reference/settings.md#anki-word-fields)는 Anki 노트에서 대상 단어만 포함하는 필드입니다.
    - [`Anki 문장 필드`](../reference/settings.md#anki-sentence-fields)는 전용 단어 필드가 없는 Anki 노트(예: 문장 덱)에만 사용합니다. Anki 단어 필드에 단어가 없으면 이 필드의 단어를 대체 값으로 사용합니다.
    - 필드를 설정한 다음 [`Anki 단어 데이터베이스 다시 만들기`](../reference/settings.md#re-build-anki-word-database)를 사용해 데이터베이스를 채웁니다.
6. (WaniKani 사용자) [WaniKani > 설정 > API 토큰](https://www.wanikani.com/settings/personal_access_tokens)으로 이동해 asbplayer용 토큰을 만듭니다.
    - `Token Description` 필드에 `asbplayer`를 입력하고 모든 `Permissions`를 선택 해제합니다. asbplayer에는 WaniKani 계정의 읽기 권한만 필요합니다.
    - `Generate token`을 클릭한 다음 생성된 토큰을 [`WaniKani API 토큰`](../reference/settings.md#wanikani-api-token)에 붙여 넣습니다.
    - API 토큰을 설정한 다음 [`WaniKani 단어 데이터베이스 다시 만들기`](../reference/settings.md#re-build-wanikani-word-database)를 사용해 데이터베이스를 채웁니다.
7. 해당 트랙에서 원하는 주석 기능(스타일, 읽기, 빈도, 피치 악센트 등)을 사용 설정합니다. 필요에 따라 다른 설정도 조정합니다.
8. 각 옵션에 관한 자세한 설명은 설정 참고의 [주석](../reference/settings.md#annotation) 섹션을 참조하세요. 키보드 동작은 [주석 키보드 단축키](../reference/settings.md#annotation-keyboard-shortcuts) 그룹에 나와 있습니다.

## 문제 해결 {#troubleshooting}

주석 문제 해결 방법은 문서의 [일반적인 문제](../common-issues.md#annotation) 섹션을 참고하세요. 해결 방법을 찾을 수 없다면 <a href={project.urls.discord}>Discord</a>에 문의하거나 문제와 재현 단계에 관한 자세한 정보를 포함해 <a href={`${project.urls.repo}/issues`}>버그 보고서</a>를 제출하세요.
