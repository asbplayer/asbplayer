---
sidebar_position: 1.5
title: 레시피
---

import project from '@site/src/project';

import RecipePreset, { dialogueFocusRecipe, gapFastForwardRecipe } from '@site/src/components/RecipePreset';

export const nonAnnotationPlaybackSettings = {
  dictionaryTracks: Array.from({ length: 3 }, () => ({
    dictionaryPlaybackConfig: Object.fromEntries(
      ['autoPause', 'repeat', 'condensed', 'fastForward', 'wordVisibility'].map((feature) => [
        feature,
        {
          onStatuses: Array.from({ length: 6 }, () => ({ enabled: false })),
          onStates: [{ enabled: false }],
          ...(feature === 'fastForward' ? { rateByComprehension: { enabled: false } } : {}),
        },
      ])
    ),
  })),
};

export const annotationPlaybackRule = (statuses, rules = {}) => ({
  rules: { minWords: 0, maxWords: 0, minFrequency: 0, maxFrequency: 0, ...rules },
  onStatuses: Array.from({ length: 6 }, (_, status) => ({ enabled: statuses.includes(status) })),
  onStates: [{ enabled: false }],
});

export const annotationPlaybackSelection = (statuses) => ({
  onStatuses: Array.from({ length: 6 }, (_, status) => ({ enabled: statuses.includes(status) })),
  onStates: [{ enabled: false }],
});

export const annotationPlaybackSettings = (playbackConfig) => ({
  seekableTracks: 1,
  dictionaryTracks: nonAnnotationPlaybackSettings.dictionaryTracks.map((track, index) => ({
    dictionaryPlaybackConfig: {
      ...Object.fromEntries(
        Object.entries(track.dictionaryPlaybackConfig).map(([feature, config]) => [
          feature,
          { ...config, ...(index === 0 ? playbackConfig[feature] : {}) },
        ])
      ),
      ...(index === 0 && playbackConfig.selectOnPause !== undefined
        ? { selectOnPause: playbackConfig.selectOnPause }
        : {}),
    },
  })),
});

export const unfamiliarWordPlaybackConfig = {
  autoPause: annotationPlaybackRule([0, 1]),
  repeat: annotationPlaybackRule([0, 1]),
};

export const unfamiliarWordRepeatSettings = {
  autoPausePreference: 2,
  autoPauseResumeMode: 'fixed',
  autoPauseFixedDurationMs: 1000,
  autoPauseResumeDelayMs: 0,
  repeatCountPreference: 1,
  repeatsBeforeShowingSubtitles: 0,
  subtitleVisibility: 'whenDue',
  subtitleTriggerStartOffset: 0,
  subtitleTriggerEndOffset: 0,
};

# 레시피

레시피는 재생 모드와 재생 설정을 결합해 학습 활동 사이를 전환할 수 있게 합니다. **설정 > 재생**, 플레이어 컨트롤의 재생 모드 옆, 또는 모바일 오버레이에서 레시피를 선택합니다. 기본 설정으로 돌아가려면 **사용 안 함**을 선택합니다. 레시피가 활성화된 동안에도 저장된 재생 설정, 기억된 재생 속도와 모드는 유지됩니다.

## 레시피 만들기 및 수정

재생 탭에서 **레시피 수정**을 선택합니다. 레시피가 선택된 상태라면 해당 레시피를 바탕으로 시작하고, 선택된 레시피가 없으면 현재 재생 설정을 바탕으로 시작합니다. 포함할 재생 모드를 선택하고 설정을 변경합니다. 변경 사항은 임시 초안으로 저장되며 저장하기 전까지 재생에 적용되지 않습니다.

**레시피 저장**을 선택해 설정을 검토하고 최대 100자까지 이름을 입력합니다. 미리보기에서 개별 설정을 제거할 수 있으며, 제거한 설정에는 기본 설정이 적용됩니다. 재생 모드는 항상 전체 조합으로 지정됩니다.

기존 레시피를 수정할 때 이름을 변경하지 않으면 해당 레시피가 업데이트됩니다. 이름 필드에 입력하면 원래 이름으로 되돌리더라도 새 레시피가 만들어집니다. 초안을 버리려면 **취소**를 선택합니다.

## 가져오기 및 공유

**레시피 가져오기**를 선택하고 레시피 JSON을 붙여 넣은 뒤 설정을 검토하고 확인합니다. 가져오기 전에 이름을 바꾸거나 설정을 제거할 수 있습니다. 가져온 레시피는 목록 끝에 추가되고 선택됩니다. 알 수 없는 설정과 잘못된 설정 값은 무시됩니다. 이름과 재생 모드는 유효해야 합니다.

가져오기 링크를 열 수도 있습니다. 웹 앱의 재생 탭에 가져오기 미리보기가 표시되며, 가져오기를 확인하면 레시피가 적용됩니다.

드롭다운에서 레시피의 미리보기 아이콘을 열어 JSON을 복사하거나 가져오기 URL을 공유합니다. 같은 미리보기에서 확인 후 레시피를 삭제할 수 있습니다. 위/아래 버튼을 사용하거나 드롭다운에서 끌어 레시피 순서를 바꿉니다. 레시피를 이동하면 선택 상태도 따라가며, 선택된 레시피를 삭제하면 레시피 기능이 사용 중지됩니다.

## 키보드 단축키

**키보드 단축키 > 재생**에서 **레시피 순방향 순환**, **레시피 역방향 순환**, **레시피 #1 전환**부터 **#10**까지 설정합니다. 활성 레시피를 전환하면 레시피 기능이 사용 중지됩니다. 순환은 목록 순서를 따르며 **사용 안 함**도 포함합니다. 레시피가 활성화된 동안 재생 설정 및 모드 단축키를 사용하면 알림이 표시됩니다. 해당 설정을 바꾸려면 레시피를 수정하거나 사용 중지합니다.

## 일반 레시피

아래에는 자주 하는 학습 활동에 유용한 레시피 프리셋이 있습니다. 공유하고 싶은 레시피가 있거나 원하는 레시피를 만들 기능이 필요하다면 <a href={project.urls.discord}>Discord</a> 또는 <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>에서 요청할 수 있습니다.

### 일반 모드

자동 학습 모드 없이 평소 재생 설정을 사용합니다. **사용 안 함**이 일반 재생 동작과 일치하도록 레시피 외부의 설정은 가능한 한 단순하게 유지하는 것이 좋습니다.

### 대화 집중

압축 재생과 빨리 감기를 함께 사용해 대화에 집중합니다. 건너뛸 구간의 최소 간격을 5초로 설정하고, 조건에 맞는 나머지 구간은 최소 간격 1초로 3배속 재생합니다. 각 구간의 앞뒤 문맥을 150ms씩 유지하고 대화는 기본 재생 속도로 재생합니다.

<RecipePreset
  recipe={{
    ...dialogueFocusRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...dialogueFocusRecipe.settings,
    },
  }}
/>

### 구간 빨리 감기

동영상 전체를 보면서 조건에 맞는 구간을 최소 간격 1초로 3배속 재생합니다. 각 구간의 앞뒤 문맥을 150ms씩 유지하고 대화는 기본 재생 속도로 재생합니다.

<RecipePreset
  recipe={{
    ...gapFastForwardRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...gapFastForwardRecipe.settings,
    },
  }}
/>

### 읽기 모드

각 자막이 시작될 때 일시 정지해 읽고 단어를 찾아본 다음, 직접 재개해 자막을 보면서 오디오를 듣습니다. 재생 중 자막 위에 마우스를 올려도 동영상이 일시 정지되며, 마우스를 옮기면 다시 재생됩니다.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Reading mode',
    playbackModes: [3],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 1,
      autoPauseResumeMode: 'manual',
      pauseOnHoverMode: 1,
      subtitleVisibility: 'whenDue',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### 듣기 모드

자막 없이 듣고 각 자막 끝에서 자동으로 일시 정지해 텍스트를 확인하고 이해했는지 살펴봅니다. 준비가 되면 직접 재개합니다.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Listening mode',
    playbackModes: [3],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 2,
      autoPauseResumeMode: 'manual',
      subtitleVisibility: 'whilePaused',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### 오디오만

재생 중 자막을 숨긴 채 계속 듣습니다. 도움이 필요하면 직접 일시 정지해 현재 자막을 표시합니다.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Audio only',
    playbackModes: [1],
    settings: {
      ...nonAnnotationPlaybackSettings,
      subtitleVisibility: 'whileManuallyPaused',
    },
  }}
/>

### 집중 듣기

각 자막을 세 번씩 듣고 매번 재생한 뒤 1초간 일시 정지합니다. 처음 두 번은 자막을 숨기고 마지막 반복에서 자막을 표시해 이해했는지 확인합니다. 일시 정지 후 재생은 자동으로 재개됩니다. 필요에 따라 1초의 일시 정지 시간을 조정하세요.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Intensive listening',
    playbackModes: [3, 5],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 2,
      autoPauseResumeMode: 'fixed',
      autoPauseFixedDurationMs: 1000,
      autoPauseResumeDelayMs: 0,
      repeatCountPreference: 2,
      repeatsBeforeShowingSubtitles: 2,
      subtitleVisibility: 'whenDue',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### 예습 후 듣기

각 자막이 시작될 때 일시 정지해 모국어로 읽고, 자막이 사라진 뒤 자막 없이 오디오를 듣습니다. 글자당 읽기 시간은 80ms이며 최소 1초, 최대 6초입니다. 텍스트가 사라진 후에도 500ms 동안 일시 정지한 뒤 자동으로 재생을 재개합니다. 레시피를 수정할 때 이 시간을 조정할 수 있습니다.

읽기 시간을 계산할 트랙은 **재생 모드 및 키보드 단축키의 영향을 받는 자막 트랙**에서 선택합니다.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Primed listening',
    playbackModes: [3],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 1,
      autoPauseResumeMode: 'subtitleLength',
      autoPauseMinimumDurationMs: 1000,
      autoPauseMaximumDurationMs: 6000,
      autoPauseTimePerCharacterMs: 80,
      autoPauseResumeDelayMs: 500,
      subtitleVisibility: 'whilePaused',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### 소리 내어 읽기

원본 오디오를 듣기 전에 각 자막을 소리 내어 읽고 발음과 리듬을 비교합니다. 자막을 표시한 채 각 자막의 시작 부분에서 일시 정지하며, 글자당 80ms 후 자동으로 재생을 재개합니다(1~6초 범위). 각 자막은 한 번 반복됩니다. 충분히 말할 수 있도록 일시 정지 시간을 조정하세요.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Read aloud',
    playbackModes: [3, 5],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 1,
      autoPauseResumeMode: 'subtitleLength',
      autoPauseMinimumDurationMs: 1000,
      autoPauseMaximumDurationMs: 6000,
      autoPauseTimePerCharacterMs: 80,
      autoPauseResumeDelayMs: 0,
      repeatCountPreference: 1,
      repeatsBeforeShowingSubtitles: 0,
      subtitleVisibility: 'whenDue',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### 섀도잉

자막을 보면서 원본 오디오와 동시에 또는 약간 늦게 말해 리듬과 발음을 따라 합니다. 각 자막은 한 번 반복되며, 반복을 마칠 때마다 1초간 일시 정지한 뒤 자동으로 재생을 재개합니다.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Shadowing',
    playbackModes: [3, 5],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 2,
      autoPauseResumeMode: 'fixed',
      autoPauseFixedDurationMs: 1000,
      autoPauseResumeDelayMs: 0,
      repeatCountPreference: 1,
      repeatsBeforeShowingSubtitles: 0,
      subtitleVisibility: 'whenDue',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### 회상

오디오를 들은 뒤 끝에서 자동으로 일시 정지할 때 기억을 떠올려 대사를 소리 내어 말합니다. 재생 및 자동 일시 정지 중에는 자막이 숨겨집니다. 말하기 시간은 글자당 80ms이며 1~6초 범위이고, 각 자막은 한 번 반복됩니다. 필요에 따라 일시 정지 시간을 조정하고, 도움이 필요하면 반복 재생 중 직접 일시 정지해 텍스트를 표시합니다.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Recall',
    playbackModes: [3, 5],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 2,
      autoPauseResumeMode: 'subtitleLength',
      autoPauseMinimumDurationMs: 1000,
      autoPauseMaximumDurationMs: 6000,
      autoPauseTimePerCharacterMs: 80,
      autoPauseResumeDelayMs: 0,
      repeatCountPreference: 1,
      subtitleVisibility: 'whileManuallyPaused',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

## 주석 레시피

이 프리셋은 주석 데이터를 사용하므로 [주석](./annotation.md)을 사용 설정해야 합니다. 공유하고 싶은 레시피가 있거나 원하는 레시피를 만들 기능이 필요하다면 <a href={project.urls.discord}>Discord</a> 또는 <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>에서 요청할 수 있습니다.

학습할 언어의 자막을 **트랙 1**로 불러옵니다. 이 프리셋은 해당 트랙에서 재생하고 단어를 선택합니다. **낯선 단어**는 **미수집** 또는 **알 수 없음** 상태를 뜻합니다. 읽는 법과 색상 등 나머지 주석 표시 설정에는 기본 설정이 사용됩니다.

### 낯선 단어 복습

자막을 표시한 채 시청합니다. 낯선 단어가 포함된 대사는 끝에서 1초간 일시 정지한 뒤 한 번 반복 재생합니다. 그 밖의 대사는 멈추지 않고 계속 재생됩니다. 일시 정지 중에는 찾아볼 수 있도록 첫 번째 낯선 단어를 선택합니다. 시간이 더 필요하면 일시 정지 시간을 조정하세요.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Unfamiliar-word rescue',
    playbackModes: [3, 5],
    settings: {
      ...unfamiliarWordRepeatSettings,
      ...annotationPlaybackSettings({
        ...unfamiliarWordPlaybackConfig,
        selectOnPause: annotationPlaybackSelection([0, 1]),
      }),
    },
  }}
/>

### i+1 마이닝

미수집 토큰이 정확히 하나 포함된 자막에 집중합니다. 압축 재생은 조건에 맞는 대사 사이를 건너뛰며, 각 대사의 끝에서 직접 재개할 때까지 일시 정지하고 확인하거나 마이닝할 수 있도록 미수집 토큰을 선택합니다.

i+1에 해당할 수 있는 후보를 찾는 기능이며 다른 모든 단어를 알고 있다고 보장하지는 않습니다. 대사에 알 수 없음 상태의 단어가 포함될 수 있고, 같은 미수집 단어가 반복되면 각각 별도로 계산됩니다. 마이닝은 직접 수행해야 합니다.

<RecipePreset
  recipe={{
    name: 'i+1 mining',
    playbackModes: [2, 3],
    settings: {
      ...annotationPlaybackSettings({
        autoPause: annotationPlaybackRule([0], { minWords: 1, maxWords: 1 }),
        condensed: annotationPlaybackRule([0], { minWords: 1, maxWords: 1 }),
        selectOnPause: annotationPlaybackSelection([0]),
      }),
      autoPausePreference: 2,
      autoPauseResumeMode: 'manual',
      subtitleVisibility: 'whenDue',
      streamingCondensedPlaybackMinimumSkipIntervalMs: 0,
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
      subtitleTriggerGapStartOffset: 0,
      subtitleTriggerGapEndOffset: 0,
    },
  }}
/>

### 낯선 단어 힌트

낯선 단어는 표시하고 익숙한 단어는 숨긴 채 듣습니다. 낯선 단어가 포함된 대사는 끝에서 1초간 일시 정지해 전체 텍스트를 표시한 다음 힌트를 다시 표시해 한 번 반복 재생합니다. 일시 정지 중에는 찾아볼 수 있도록 첫 번째 낯선 단어를 선택합니다. 토큰 분석이 완료되었고 낯선 단어가 없는 대사에는 자막이 표시되지 않습니다.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Unfamiliar-word hints',
    playbackModes: [3, 5],
    settings: {
      ...unfamiliarWordRepeatSettings,
      ...annotationPlaybackSettings({
        ...unfamiliarWordPlaybackConfig,
        selectOnPause: annotationPlaybackSelection([0, 1]),
        wordVisibility: {
          ...annotationPlaybackRule([0, 1]),
          hideWordsIndividuallyUntilThreshold: true,
          wholeSubtitleMatchThreshold: 1,
        },
      }),
    },
  }}
/>

### 낯선 단어 빈칸 채우기

낯선 단어를 숨긴 채 자막의 익숙한 부분을 읽고 오디오와 문맥을 바탕으로 빠진 단어를 맞혀 봅니다. 낯선 단어가 포함된 대사는 끝에서 1초간 일시 정지해 전체 텍스트를 표시한 다음 빈칸을 다시 적용해 한 번 반복 재생합니다. 무시됨 상태의 단어는 계속 표시됩니다.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Unfamiliar-word cloze',
    playbackModes: [3, 5],
    settings: {
      ...unfamiliarWordRepeatSettings,
      ...annotationPlaybackSettings({
        ...unfamiliarWordPlaybackConfig,
        wordVisibility: {
          ...annotationPlaybackRule([2, 3, 4, 5]),
          onStates: [{ enabled: true }],
          hideWordsIndividuallyUntilThreshold: true,
          wholeSubtitleMatchThreshold: 1,
        },
      }),
    },
  }}
/>

### 적응형 듣기 속도

예상 이해도가 60% 이하인 대화는 1배속으로 재생하고, 이해도가 100%일 때는 1.8배속까지 점차 속도를 높입니다. 압축 재생은 최소 간격 1초로 공백을 건너뛰며 앞뒤 문맥을 150ms씩 유지합니다. 조건에 맞지만 건너뛰지 않은 구간은 1.8배속으로 재생됩니다.

레시피를 수정할 때 기본 속도와 빨리 감기 속도를 조정합니다. 빨리 감기 속도는 기본 속도보다 높게 설정해야 합니다.

<RecipePreset
  recipe={{
    name: 'Adaptive listening pace',
    playbackModes: [2, 4],
    settings: {
      ...annotationPlaybackSettings({ fastForward: { rateByComprehension: { enabled: true } } }),
      playbackRate: 1,
      fastForwardModePlaybackRate: 1.8,
      fastForwardPlaybackMinimumSkipIntervalMs: 1000,
      streamingCondensedPlaybackMinimumSkipIntervalMs: 1000,
      subtitleTriggerGapStartOffset: 150,
      subtitleTriggerGapEndOffset: -150,
    },
  }}
/>
