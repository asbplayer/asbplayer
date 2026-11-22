---
sidebar_position: 1.5
title: 学习方案
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

# 学习方案

学习方案将播放模式和播放设置组合在一起，方便你在不同学习活动之间切换。可以在**设置 > 播放**、播放器控制栏的播放模式旁，或移动端悬浮界面中选择方案。选择**已禁用**可恢复到底层设置。方案启用期间，你保存的播放设置、记忆的播放速度和记忆的播放模式都会保留。

## 创建和编辑方案

在“播放”选项卡中选择**编辑方案**。如果已选中方案，就从该方案开始编辑；否则从当前播放设置开始。选择播放模式并修改要包含的设置。这些修改会保留在草稿中，保存后才会影响播放。

选择**保存方案**以检查设置并输入名称，最多 100 个字符。你可以在预览中移除单项设置；未包含的设置会使用底层设置。播放模式始终以完整组合的形式指定。

编辑现有方案时，保留原名称即可更新该方案。在名称字段中输入内容会创建新方案，即使之后将名称改回原来的名称也是如此。选择**取消**可丢弃草稿。

## 导入和分享

选择**导入方案**，粘贴方案的 JSON，检查设置并确认。导入前可以更改名称和移除设置。导入的方案会添加到列表末尾并自动选中。未知设置和无效的设置值会被忽略。名称和播放模式必须有效。

你也可以打开导入链接。链接会打开 Web 应用，并显示“播放”选项卡和导入预览；确认导入后方案才会生效。

点击下拉菜单中方案旁的预览图标，可以复制其 JSON 或分享导入 URL。在同一预览中也可以确认后删除方案。使用上下按钮或在下拉菜单中拖动即可移动方案。方案移动后仍会保持选中；删除当前选中的方案会禁用所有方案。

## 键盘快捷键

在**键盘快捷键 > 播放**中配置**向前循环切换方案**、**向后循环切换方案**和**切换方案 #1** 至 **#10**。切换当前方案会禁用所有方案。循环顺序与列表一致，并包含**已禁用**。方案启用时，播放设置和播放模式快捷键会显示通知；要更改这些设置，请编辑或禁用方案。

## 常用方案

以下是适用于常见学习活动的一些实用预设方案。如果你有想分享的方案，或需要某项功能来创建理想方案，可以在 <a href={project.urls.discord}>Discord</a> 或 <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a> 上提出。

### 正常模式

使用常规播放设置，不启用自动学习模式。建议尽量简化方案之外的设置，这样 `Disabled` 就对应正常播放行为。

### 对话专注

结合紧凑模式和快进模式来专注于对话。以 5 秒为最小跳过间隔跳过空白，并以 3× 倍速快进其余符合条件的空白，最小间隔为 1 秒。每段空白前后各保留 150 ms 的上下文，对话则按底层播放速度播放。

<RecipePreset
  recipe={{
    ...dialogueFocusRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...dialogueFocusRecipe.settings,
    },
  }}
/>

### 空白快进

完整观看视频，同时以 3× 倍速快进符合条件的空白，最小间隔为 1 秒。每段空白前后各保留 150 ms 的上下文，对话则按底层播放速度播放。

<RecipePreset
  recipe={{
    ...gapFastForwardRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...gapFastForwardRecipe.settings,
    },
  }}
/>

### 阅读模式

在每条字幕开始时暂停，以便阅读和查词；然后手动继续播放，在字幕可见时听音频。播放期间将鼠标悬停在字幕上也会暂停视频；移开鼠标后恢复播放。

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

### 听力模式

不显示字幕进行聆听，然后在每条字幕结束时自动暂停并显示文本，以检查理解情况。准备好后手动继续播放。

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

### 仅音频

连续聆听，播放时隐藏字幕。需要帮助时手动暂停，即可显示当前字幕。

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

### 精听

每条字幕听三遍，每遍结束后暂停 1 秒。前两遍隐藏字幕，最后一遍重播时显示字幕，以检查理解情况。每次暂停后都会自动继续播放；可按需调整 1 秒的暂停时长。

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

### 预读听力

在每条字幕开始时暂停，用母语阅读字幕；字幕消失后，再不看字幕聆听音频。阅读时间按每个字符 80 ms 计算，最短 1 秒，最长 6 秒。文本消失后还会继续暂停 500 ms，然后自动恢复播放。编辑方案时可以调整这些时间。

在**受播放模式和键盘快捷键影响的字幕轨道**中选择用于计算阅读时间的轨道。

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

### 朗读

先大声读出每条字幕，再听原始音频，对比自己的发音和节奏。播放会在字幕开始时暂停并显示字幕，然后按每个字符 80 ms 自动恢复，时长限制在 1–6 秒。每条字幕重复一次。调整暂停时间，为自己留出足够的朗读时间。

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

### 跟读

字幕可见时，跟随原始音频或稍微滞后地朗读，模仿其节奏和发音。每条字幕重复一次，每遍结束后暂停 1 秒，再自动继续播放。

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

### 回忆

聆听音频，然后在句末自动暂停时凭记忆大声复述。播放和自动暂停期间都会隐藏字幕。朗读时间按每个字符 80 ms 计算，限制在 1–6 秒；每条字幕重复一次。按需调整暂停时间；需要帮助时，可在重播期间手动暂停以显示文本。

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

## 字幕词汇标注方案

这些预设会使用[字幕词汇标注](./annotation.md)数据，因此需要先启用该功能。如果你有想分享的方案，或需要某项功能来创建理想方案，可以在 <a href={project.urls.discord}>Discord</a> 或 <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a> 上提出。

将目标语言字幕加载为**轨道 1**。这些预设会使用该轨道进行播放和单词选择。**不熟悉**指**未收集**或**未知**。其他标注显示偏好（例如读音和颜色）使用底层设置。

### 生词补救

观看时显示字幕。含有不熟悉单词的字幕会在末尾暂停 1 秒，然后重播一次。其他字幕会连续播放。暂停期间会选中第一个不熟悉的单词，供你查询。如果需要更多时间，可以调整暂停时长。

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

### i+1 挖掘

专注于恰好包含一个未收集词元的字幕。紧凑模式会在符合条件的字幕之间跳过空白，并在每条字幕结束时暂停，直到你手动继续播放；同时选中该未收集词元，供你查看或挖掘。

此方案用于寻找 i+1 候选句，并不保证其他所有单词都已知：同一条字幕也可能包含未知单词，同一个未收集单词的重复出现会分别计数。挖掘仍需手动操作。

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

### 生词提示

聆听时显示不熟悉的单词并隐藏熟悉的单词。含有不熟悉单词的字幕会在末尾暂停 1 秒并显示完整文本，然后恢复提示并重播一次。暂停期间会选中第一个不熟悉的单词，供你查询。完成分词后，不含不熟悉单词的字幕不会显示字幕文本。

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

### 生词填空

阅读每条字幕中熟悉的部分，同时根据音频和上下文尝试补出隐藏的不熟悉单词。含有不熟悉单词的字幕会在末尾暂停 1 秒并显示完整文本，然后恢复填空效果并重播一次。已忽略的单词仍会显示。

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

### 自适应听力速度

对话的全文理解度估算不高于 60% 时以 1× 倍速播放，估算升至 100% 时逐渐加速至 1.8×。紧凑模式以 1 秒为最小间隔跳过空白，并在空白前后各保留 150 ms 的上下文。其余符合条件的空白以 1.8× 倍速播放。

编辑方案时可以调整基础速度和快进速度，但快进速度应高于基础速度。

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
