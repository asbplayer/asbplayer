---
sidebar_position: 1.5
title: レシピ
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

# レシピ

レシピはプレイバックモードと再生設定を組み合わせ、学習活動を切り替えられるようにします。**設定 > プレイバック**、プレーヤーコントロールのプレイバックモードの横、またはモバイルオーバーレイからレシピを選択します。元の設定に戻すには**無効**を選択します。レシピが有効な間も、保存した再生設定、記憶した再生速度、プレイバックモードは保持されます。

## レシピの作成と編集

プレイバックタブで**レシピを編集**を選択します。レシピが選択されている場合はそのレシピから、そうでない場合は現在の再生設定から始めます。プレイバックモードを選び、含めたい設定を変更します。変更は下書きに保存され、保存するまで再生には反映されません。

**レシピを保存**を選択して設定を確認し、100文字以内の名前を入力します。プレビューから個々の設定を削除できます。省略した設定には元の設定が使われます。プレイバックモードは常に組み合わせ全体を指定します。

既存のレシピを編集するとき、名前を変更しなければそのレシピが更新されます。名前欄に入力すると、元の名前に戻した場合でも新しいレシピが作成されます。下書きを破棄するには**キャンセル**を選択します。

## インポートと共有

**レシピをインポート**を選択し、レシピのJSONを貼り付け、設定を確認して確定します。インポート前に名前を変更したり、設定を削除したりできます。インポートしたレシピはリストの末尾に追加され、選択されます。不明な設定と無効な設定値は無視されます。名前とプレイバックモードは有効である必要があります。

インポートリンクを開くこともできます。ウェブアプリがプレイバックタブとインポートプレビューを表示した状態で開き、インポートを確定するとレシピが反映されます。

ドロップダウンでレシピのプレビューアイコンを開くと、JSONをコピーしたりインポートURLを共有したりできます。同じプレビューから、確認後にレシピを削除できます。上下ボタンまたはドロップダウン内のドラッグでレシピを並べ替えます。レシピを移動すると選択状態もそのレシピに追従します。選択中のレシピを削除するとレシピが無効になります。

## キーボードショートカット

**キーボードショートカット > プレイバック**で、**レシピを順方向に切り替え**、**レシピを逆方向に切り替え**、**レシピ1を切り替え**から**レシピ10を切り替え**までを設定します。有効なレシピを切り替えると、レシピが無効になります。切り替えはリスト順で、**無効**も含みます。レシピが有効な間に再生設定やモードのショートカットを使うと通知が表示されます。これらの設定を変更するには、レシピを編集するか無効にしてください。

## よく使うレシピ

以下に、よくある学習活動に役立つプリセットレシピをいくつか紹介します。共有したいレシピがある場合や、理想のレシピに必要な機能がない場合は、<a href={project.urls.discord}>Discord</a>または<a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>でリクエストしてください。

### 通常モード

自動学習モードを使わず、通常の再生設定を使います。**無効**が通常の再生動作になるように、レシピ以外の設定はできるだけ標準的な状態にすることをおすすめします。

### 会話に集中

短縮プレイバックと早送りを組み合わせて会話に集中します。最小スキップ間隔を5秒にして区間をスキップし、条件を満たす残りの間隔は最小間隔1秒で3倍速にします。各間隔の前後に150msの文脈を残し、会話は元の再生速度で再生します。

<RecipePreset
  recipe={{
    ...dialogueFocusRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...dialogueFocusRecipe.settings,
    },
  }}
/>

### 無音区間を早送り

動画全体を見ながら、条件を満たす間隔を最小間隔1秒で3倍速にします。各間隔の前後に150msの文脈を残し、会話は元の再生速度で再生します。

<RecipePreset
  recipe={{
    ...gapFastForwardRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...gapFastForwardRecipe.settings,
    },
  }}
/>

### 読書モード

各字幕の開始時に一時停止して読み、単語を調べます。その後、手動で再開して字幕を表示したまま音声を聞きます。再生中に字幕にカーソルを合わせても動画が一時停止し、カーソルを離すと再開します。

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

### リスニングモード

字幕なしで聞き、各字幕の終了時に自動一時停止してテキストを表示し、理解度を確認します。準備ができたら手動で再開します。

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

### 音声のみ

再生中は字幕を隠して、音声を続けて聞きます。字幕を確認したいときは手動で一時停止すると、現在の字幕が表示されます。

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

### 集中的なリスニング

各字幕を3回聞き、1回ごとに1秒間一時停止します。最初の2回は字幕を隠し、最後のリプレイで字幕を表示して理解度を確認します。一時停止後、再生は自動的に再開されます。必要に応じて1秒の一時停止時間を調整してください。

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

### 予習リスニング

各字幕の開始時に一時停止し、母語で読んで字幕が消えるのを待ってから、字幕なしで音声を聞きます。読む時間は1文字あたり80msで、最短1秒、最長6秒です。字幕が消えた後、さらに500ms一時停止してから自動的に再開します。レシピの編集時にこれらの時間を調整できます。

読む時間の計算に使うトラックは、**プレイバックモードとキーボードショートカットの対象となる字幕トラック**で選択してください。

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

### 音読

元の音声を聞く前に各字幕を声に出して読み、発音やリズムを比べます。字幕を表示した状態で開始時に一時停止し、1文字あたり80ms、最短1秒から最長6秒の範囲で自動的に再開します。各字幕を1回リピートします。十分に話す時間が取れるよう、一時停止時間を調整してください。

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

### シャドーイング

字幕を表示した状態で、元の音声に合わせるか少し遅れて発話し、リズムと発音をまねます。各字幕を1回リピートし、再生ごとに終了時点で1秒一時停止してから自動的に再開します。

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

### 想起

音声を聞き、終了時の自動一時停止中に記憶を頼りに文を声に出して再現します。再生中と自動一時停止中は字幕が隠れます。発話時間は1文字あたり80msで、最短1秒から最長6秒です。各字幕を1回リピートします。必要に応じて一時停止時間を調整してください。再生中に助けが必要な場合は、手動で一時停止すると字幕が表示されます。

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

## アノテーションレシピ

これらのプリセットはアノテーションのデータを使うため、[アノテーション](./annotation.md)を有効にする必要があります。共有したいものがある場合や、理想のレシピに必要な機能がない場合は、<a href={project.urls.discord}>Discord</a>または<a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>でリクエストしてください。

学習対象言語の字幕を**字幕トラック1**として読み込みます。これらのプリセットは、そのトラックを再生と単語選択に使います。**未習得**は**未収集**または**新規**を意味します。読みや色など、その他のアノテーション表示設定には元の設定が使われます。

### 未習得単語を救済

字幕を表示して視聴します。文に未習得単語が含まれている場合、文の終わりで1秒一時停止してから1回リプレイします。それ以外の文は止まらずに再生されます。一時停止中に最初の未習得単語が選択され、検索できます。時間が必要な場合は一時停止時間を調整してください。

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

### i+1マイニング

未収集トークンをちょうど1つ含む字幕に集中します。短縮プレイバックで条件に合う文の間をスキップし、各文の終わりで手動で再開するまで一時停止します。一時停止中は未収集トークンが選択され、確認やマイニングに使えます。

i+1の候補を見つけますが、他のすべての単語が既知だと保証するわけではありません。文に新規の単語が含まれる場合があり、同じ未収集単語が繰り返し出現する場合は別々に数えます。マイニングは引き続き手動で行います。

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

### 未習得単語のヒント

未習得単語を表示し、既知の単語を隠して聞きます。未習得単語を含む文は終了時に1秒一時停止し、全文を表示してからヒントを元に戻して1回リプレイします。一時停止中に最初の未習得単語が選択され、検索できます。単語分割が完全にできている場合、未習得単語のない文には字幕が表示されません。

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

### 未習得単語の穴埋め

未習得単語を隠したまま字幕の既知部分を読み、音声や文脈から隠れた単語を補ってみます。未習得単語を含む文は終了時に1秒一時停止して全文を表示し、穴を戻して1回リプレイします。無視された単語は表示されます。

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

### 適応型リスニング速度

推定理解度が60%以下の会話は1倍速で再生し、100%では1.8倍速になるよう徐々に速度を上げます。短縮プレイバックは最小間隔を1秒にして区間をスキップし、前後に150msの文脈を残します。条件を満たして残った間隔は1.8倍速で再生されます。

レシピを編集するときに基本速度と早送り速度を調整してください。早送り速度は基本速度より高く設定します。

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
