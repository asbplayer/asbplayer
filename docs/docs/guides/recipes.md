---
sidebar_position: 1.5
title: Recipes
---

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

export const annotationPlaybackSettings = (playbackConfig) => ({
  seekableTracks: 1,
  dictionaryTracks: nonAnnotationPlaybackSettings.dictionaryTracks.map((track, index) => ({
    dictionaryPlaybackConfig: Object.fromEntries(
      Object.entries(track.dictionaryPlaybackConfig).map(([feature, config]) => [
        feature,
        { ...config, ...(index === 0 ? playbackConfig[feature] : {}) },
      ])
    ),
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

# Recipes

Recipes combine playback modes and playback settings so you can switch between learning activities. Choose a recipe in **Settings > Playback**, beside the playback modes in the player controls, or in the mobile overlay. Choose **Disabled** to return to your underlying settings. Your saved playback settings, remembered playback rate, and remembered modes are preserved while a recipe is active.

## Create and edit a recipe

Select **Edit Recipe** in the Playback tab. If a recipe is selected, you start with that recipe; otherwise you start with your current playback settings. Choose the playback modes and change the settings you want to include. These changes stay in a draft and do not affect playback until saved.

Select **Save Recipe** to review the settings and enter a name of up to 100 characters. You can remove individual settings from the preview; omitted settings use your underlying settings. Playback modes are always specified as a complete combination.

When editing an existing recipe, leaving its name untouched updates it. Typing in the name field creates a new recipe, even if you return to the original name. Select **Cancel** to discard the draft.

## Import and share

Select **Import Recipe**, paste the recipe's JSON, review its settings, and confirm. You can change its name and remove settings before importing. Imported recipes are appended to your list and selected. Unknown settings and invalid setting values are ignored. The name and playback modes must be valid.

You can also open an import link. It opens the web app with the Playback tab and import preview ready; the recipe takes effect after you confirm the import.

Open a recipe's preview icon in the dropdown to copy its JSON or share its import URL. The same preview lets you delete the recipe with confirmation. Move recipes with the up/down buttons or drag them in the dropdown. Selection follows a recipe when it moves; deleting the selected recipe disables recipes.

## Keyboard shortcuts

Configure **Cycle through recipes forward**, **Cycle through recipes backwards**, **Disable recipe**, and **Select recipe #1** through **#10** under **Keyboard Shortcuts > Playback**. Cycling follows the list order and includes **Disabled**. Playback setting and mode shortcuts show a notification while a recipe is active; edit or disable the recipe to change those settings.

## Common recipes

These contain some useful preset recipes for common learning activities. If you have any that you want to share or need a missing feature to create the perfect recipe, you can request them on [Discord](https://discord.gg/ad7VAQru7m) or on [GitHub](https://github.com/asbplayer/asbplayer/issues/new/choose).

### Normal mode

Use your usual playback settings without an automatic learning mode. We recommend keeping your non-recipe settings as plain as possible so that `Disabled` maps to normal playback behavior.

### Dialogue focus

Focus on dialogue by combining condensed playback with fast-forward. Skip gaps using a 5-second minimum skip interval and fast-forward remaining qualifying gaps at 3× with a 1-second minimum interval. Keep 150 ms of context on either side of each gap, with dialogue at your underlying playback speed.

<RecipePreset
  recipe={{
    ...dialogueFocusRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...dialogueFocusRecipe.settings,
    },
  }}
/>

### Gap fast-forward

Watch the entire video while fast-forwarding qualifying gaps at 3× with a 1-second minimum interval. Keep 150 ms of context on either side of each gap, with dialogue at your underlying playback speed.

<RecipePreset
  recipe={{
    ...gapFastForwardRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...gapFastForwardRecipe.settings,
    },
  }}
/>

### Reading mode

Pause at the start of each subtitle to read and look up words, then resume manually to hear the audio with subtitles visible. Hovering over subtitles during playback also pauses the video; moving away resumes it.

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

### Listening mode

Listen without subtitles, then pause automatically at the end of each subtitle to reveal the text and check your understanding. Resume manually when ready.

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

### Audio only

Listen continuously with subtitles hidden during playback. Manually pause to reveal the current subtitle when you need help.

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

### Intensive listening

Listen to each subtitle three times, with a 1-second pause after each pass. Subtitles stay hidden for the first two passes and appear on the final replay to check your understanding. Playback resumes automatically after each pause, customize the 1s pause duration as needed.

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

### Primed listening

Pause at the start of each subtitle to read it in your native language, let it disappear, then listen to the audio without subtitles. Reading time is 80 ms per character, with a minimum of 1 second and a maximum of 6 seconds. After the text disappears, playback stays paused for another 500 ms before resuming automatically. You can adjust these timings when editing the recipe.

Choose the tracks used to calculate reading time under **Subtitle tracks affected by playback modes and keyboard shortcuts**.

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

### Read aloud

Read each subtitle aloud before hearing the original audio, then compare your pronunciation and rhythm. Playback pauses at the start with subtitles visible and resumes automatically after 80 ms per character, bounded to 1–6 seconds. Each subtitle repeats once. Adjust the pause timings to give yourself enough speaking time.

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

### Shadowing

Speak alongside or slightly behind the original audio, matching its rhythm and pronunciation with subtitles visible. Each subtitle repeats once, with a 1-second pause at the end of each pass before playback resumes automatically.

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

### Recall

Listen to the audio, then reproduce the line aloud from memory during the automatic pause at its end. Subtitles stay hidden during playback and automatic pauses. Speaking time is 80 ms per character, bounded to 1–6 seconds, and each subtitle repeats once. Adjust the pause timings as needed; manually pause during a replay to reveal the text when you need help.

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

## Annotation Recipes

These presets require [Annotation](./annotation.md) to be enabled as they use its data. If you have any that you want to share or need a missing feature to create the perfect recipe, you can request them on [Discord](https://discord.gg/ad7VAQru7m) or on [GitHub](https://github.com/asbplayer/asbplayer/issues/new/choose).

Load your target-language subtitles as **Track 1**. These presets use that track for playback and word selection. **Unfamiliar** means **Uncollected** or **Unknown**. Other annotation display preferences, such as readings and colors, use your underlying settings.

### Unfamiliar-word rescue

Watch with subtitles visible. When a line contains an unfamiliar word, pause for 1 second at its end, then replay it once. Other lines continue uninterrupted. Use the pause to inspect the unfamiliar vocabulary, and adjust the pause duration if you need more time.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Unfamiliar-word rescue',
    playbackModes: [3, 5],
    settings: {
      ...unfamiliarWordRepeatSettings,
      ...annotationPlaybackSettings(unfamiliarWordPlaybackConfig),
    },
  }}
/>

### i+1 mining

Focus on subtitles containing exactly one Uncollected token. Condensed playback skips between qualifying lines, and playback pauses at each line's end until you resume manually, giving you time to inspect or mine it.

This finds i+1 candidates rather than guaranteeing that every other word is known: a line can also contain Unknown words, and repeated occurrences of the same Uncollected word count separately. Mining remains a manual action.

<RecipePreset
  recipe={{
    name: 'i+1 mining',
    playbackModes: [2, 3],
    settings: {
      ...annotationPlaybackSettings({
        autoPause: annotationPlaybackRule([0], { minWords: 1, maxWords: 1 }),
        condensed: annotationPlaybackRule([0], { minWords: 1, maxWords: 1 }),
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

### Unfamiliar-word hints

Listen with unfamiliar words visible and familiar words hidden. Lines containing unfamiliar words pause for 1 second at their end, revealing the full text, then replay once with the hints restored. Lines with no unfamiliar words have no caption when fully tokenized.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Unfamiliar-word hints',
    playbackModes: [3, 5],
    settings: {
      ...unfamiliarWordRepeatSettings,
      ...annotationPlaybackSettings({
        ...unfamiliarWordPlaybackConfig,
        wordVisibility: {
          ...annotationPlaybackRule([0, 1]),
          hideWordsIndividuallyUntilThreshold: true,
          wholeSubtitleMatchThreshold: 1,
        },
      }),
    },
  }}
/>

### Unfamiliar-word cloze

Read the familiar parts of each subtitle while unfamiliar words remain hidden, and try supplying the missing words from the audio and context. Lines containing unfamiliar words pause for 1 second at their end to reveal the full text, then replay once with the gaps restored. Ignored words remain visible.

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

### Adaptive listening pace

Play dialogue at 1× when its estimated comprehension is 60% or lower, increasing gradually to 1.8× at 100%. Condensed playback skips gaps using a 1-second minimum interval, keeping 150 ms of context on either side. Qualifying gaps that remain play at 1.8×.

Adjust the base and fast-forward speeds when editing the recipe, keeping the fast-forward speed higher than the base speed.

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
