---
sidebar_position: 1.5
title: Рецепты
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

# Рецепты

Рецепты объединяют режимы и настройки воспроизведения, чтобы переключаться между занятиями. Выберите рецепт в разделе **Настройки > Воспроизведение**, рядом с режимами воспроизведения в элементах управления проигрывателя или в мобильном наложении. Выберите **Отключено**, чтобы вернуться к основным настройкам. Пока рецепт активен, сохранённые настройки воспроизведения, скорость и режимы остаются прежними.

## Создание и изменение рецепта

На вкладке «Воспроизведение» выберите **Изменить рецепт**. Если рецепт выбран, редактирование начнётся с него; в противном случае — с текущих настроек воспроизведения. Выберите режимы воспроизведения и измените нужные настройки. До сохранения изменения остаются в черновике и не влияют на воспроизведение.

Выберите **Сохранить рецепт**, проверьте настройки и введите название длиной до 100 символов. В окне предварительного просмотра можно убрать отдельные настройки; для отсутствующих в рецепте настроек используются основные значения. Режимы воспроизведения всегда задаются полным набором.

При изменении существующего рецепта оставьте его название без изменений, чтобы обновить его. Ввод в поле названия создаёт новый рецепт, даже если в итоге вы вернётесь к прежнему названию. Выберите **Отмена**, чтобы удалить черновик.

## Импорт и обмен

Выберите **Импортировать рецепт**, вставьте JSON рецепта, проверьте настройки и подтвердите импорт. Перед импортом можно изменить название и удалить настройки. Импортированные рецепты добавляются в конец списка и выбираются. Неизвестные настройки и недопустимые значения игнорируются. Название и режимы воспроизведения должны быть допустимыми.

Можно также открыть ссылку для импорта. Веб-приложение откроется на вкладке «Воспроизведение» с подготовленным окном предварительного просмотра; рецепт вступит в силу после подтверждения импорта.

Откройте предварительный просмотр рецепта из выпадающего списка, чтобы скопировать его JSON или поделиться ссылкой для импорта. Там же можно удалить рецепт после подтверждения. Перемещайте рецепты кнопками вверх/вниз или перетаскивайте их в списке. При перемещении выбранным остаётся тот же рецепт; удаление выбранного рецепта отключает рецепты.

## Сочетания клавиш

В разделе **Сочетания клавиш > Воспроизведение** настройте команды **Переключить на следующий рецепт**, **Переключить на предыдущий рецепт** и **Включить/выключить рецепт № 1–10**. Повторное включение активного рецепта отключает рецепты. Переключение следует порядку списка и включает пункт **Отключено**. Пока активен рецепт, сочетания клавиш для настроек и режимов воспроизведения показывают уведомление; чтобы изменить настройки, отредактируйте или отключите рецепт.

## Примеры рецептов

Ниже приведены полезные рецепты для распространённых занятий. Если вы хотите поделиться своим рецептом или вам не хватает функции для создания подходящего рецепта, напишите нам в <a href={project.urls.discord}>Discord</a> или на <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>.

### Обычный режим

Используйте обычные настройки воспроизведения без автоматического учебного режима. Рекомендуем оставить основные настройки как можно проще, чтобы пункт `Отключено` соответствовал обычному воспроизведению.

### Внимание на диалоги

Сосредоточьтесь на диалогах, сочетая сжатое и ускоренное воспроизведение. Пропускайте паузы длительностью не менее 5 секунд, а остальные подходящие паузы ускоряйте в 3 раза при минимальном интервале 1 секунда. Сохраняйте контекст по 150 мс с каждой стороны паузы; диалоги воспроизводятся с основной скоростью.

<RecipePreset
  recipe={{
    ...dialogueFocusRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...dialogueFocusRecipe.settings,
    },
  }}
/>

### Ускорение пауз

Смотрите видео целиком, ускоряя подходящие паузы в 3 раза при минимальном интервале 1 секунда. Сохраняйте контекст по 150 мс с каждой стороны паузы; диалоги воспроизводятся с основной скоростью.

<RecipePreset
  recipe={{
    ...gapFastForwardRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...gapFastForwardRecipe.settings,
    },
  }}
/>

### Режим чтения

Останавливайтесь в начале каждого субтитра, чтобы прочитать его и посмотреть слова в словаре, а затем вручную продолжайте воспроизведение и слушайте аудио с видимыми субтитрами. Если во время воспроизведения навести указатель на субтитры, видео также приостановится; когда указатель убран, воспроизведение продолжится.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Режим чтения',
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

### Режим аудирования

Слушайте без субтитров. В конце каждого субтитра воспроизведение автоматически приостанавливается, текст появляется на экране, и вы можете проверить, насколько хорошо поняли услышанное. Продолжайте вручную, когда будете готовы.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Режим аудирования',
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

### Только аудио

Слушайте непрерывно, скрыв субтитры во время воспроизведения. Если нужна подсказка, вручную поставьте видео на паузу, чтобы увидеть текущий субтитр.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Только аудио',
    playbackModes: [1],
    settings: {
      ...nonAnnotationPlaybackSettings,
      subtitleVisibility: 'whileManuallyPaused',
    },
  }}
/>

### Интенсивное аудирование

Прослушивайте каждый субтитр трижды, делая паузу на 1 секунду после каждого прохода. В первых двух проходах субтитры скрыты, а при последнем повторе появляются, чтобы вы могли проверить понимание. После паузы воспроизведение продолжается автоматически; при необходимости измените её длительность.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Интенсивное аудирование',
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

### Подготовленное аудирование

Приостанавливайтесь в начале каждого субтитра, чтобы прочитать его на родном языке. Затем субтитр исчезает, и вы слушаете аудио без текста. Время чтения — 80 мс на символ, минимум 1 секунда и максимум 6 секунд. После исчезновения текста воспроизведение остаётся на паузе ещё 500 мс, затем автоматически продолжается. Эти интервалы можно изменить при редактировании рецепта.

Выберите дорожки, по которым рассчитывается время чтения, в параметре **Дорожки субтитров, на которые влияют режимы воспроизведения и сочетания клавиш**.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Подготовленное аудирование',
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

### Чтение вслух

Прочитайте каждый субтитр вслух до прослушивания оригинальной аудиодорожки, а затем сравните произношение и ритм. В начале субтитра воспроизведение приостанавливается и показывает текст, а затем автоматически продолжается через 80 мс на символ (от 1 до 6 секунд). Каждый субтитр повторяется один раз. Настройте длительность паузы, чтобы успевать говорить.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Чтение вслух',
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

### Повторение за диктором

Говорите одновременно с оригинальной аудиодорожкой или немного отставая от неё, повторяя ритм и произношение. Субтитры остаются видимыми. Каждый субтитр повторяется один раз; после каждого прохода воспроизведение автоматически приостанавливается на 1 секунду.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Повторение за диктором',
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

### Воспроизведение по памяти

Прослушайте аудио, а затем повторите реплику по памяти во время автоматической паузы в её конце. Во время воспроизведения и автоматических пауз субтитры скрыты. На произнесение отводится 80 мс на символ, от 1 до 6 секунд. Каждый субтитр повторяется один раз. При необходимости настройте длительность паузы; если нужна подсказка, вручную поставьте повтор на паузу, чтобы показать текст.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Воспроизведение по памяти',
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

## Рецепты с аннотациями

Для этих рецептов нужно включить [аннотации](./annotation.md), данные которых они используют. Если вы хотите поделиться рецептом или вам не хватает функции для создания подходящего рецепта, напишите нам в <a href={project.urls.discord}>Discord</a> или на <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>.

Загрузите субтитры на изучаемом языке как **Дорожку 1**. Эти рецепты используют её для воспроизведения и выбора слов. **Незнакомое** означает **Не собрано** или **Неизвестно**. Для других параметров отображения аннотаций, например чтения и цветов, используются основные настройки.

### Помощь с незнакомыми словами

Смотрите видео с включёнными субтитрами. Если в строке есть незнакомое слово, в конце строки воспроизведение приостанавливается на 1 секунду, а затем строка повторяется один раз. Остальные строки воспроизводятся без пауз. Во время паузы выбирается первое незнакомое слово, чтобы посмотреть его в словаре. Если нужно больше времени, измените длительность паузы.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Помощь с незнакомыми словами',
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

### Майнинг i+1

Сосредоточьтесь на субтитрах, содержащих ровно одно слово со статусом «Не собрано». Сжатое воспроизведение пропускает остальные строки. В конце каждой подходящей строки воспроизведение приостанавливается до вашего действия; слово «Не собрано» выбирается для просмотра или майнинга.

Так находятся примеры i+1, но это не гарантирует, что все остальные слова известны: строка может также содержать неизвестные слова, а повторные вхождения одного и того же слова со статусом «Не собрано» считаются отдельно. Майнинг по-прежнему выполняется вручную.

<RecipePreset
  recipe={{
    name: 'Майнинг i+1',
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

### Подсказки для незнакомых слов

Слушайте аудио, показывая незнакомые слова и скрывая знакомые. Если в строке есть незнакомые слова, в её конце воспроизведение приостанавливается на 1 секунду и показывает полный текст. Затем строка повторяется один раз, снова со скрытыми знакомыми словами. Во время паузы выбирается первое незнакомое слово, чтобы посмотреть его в словаре. Если все слова распознаны, строки без незнакомых слов не отображаются.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Подсказки для незнакомых слов',
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

### Пропуски для незнакомых слов

Читайте знакомые части каждого субтитра, пока незнакомые слова скрыты, и попробуйте восстановить пропуски по аудио и контексту. В конце строки с незнакомыми словами воспроизведение приостанавливается на 1 секунду и показывает полный текст; затем строка повторяется один раз с восстановленными пропусками. Игнорируемые слова остаются видимыми.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Пропуски для незнакомых слов',
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

### Адаптивная скорость аудирования

Воспроизводите диалоги со скоростью 1×, если предполагаемое понимание составляет 60% или ниже. По мере повышения этого показателя скорость постепенно увеличивается до 1,8× при 100%. Сжатое воспроизведение пропускает паузы длительностью не менее 1 секунды, сохраняя контекст по 150 мс с каждой стороны. Оставшиеся подходящие паузы воспроизводятся со скоростью 1,8×.

При изменении рецепта настройте основную скорость и скорость ускоренного воспроизведения, причём последняя должна быть выше основной.

<RecipePreset
  recipe={{
    name: 'Адаптивная скорость аудирования',
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
