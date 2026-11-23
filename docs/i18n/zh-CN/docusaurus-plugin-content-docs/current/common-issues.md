---
sidebar_position: 5
---

import project from '@site/src/project';

# 常见问题 {#common-issues}

## 一般问题 {#general}

### 字幕没有显示 {#subtitles-arent-showing-up}

可以通过以下几种方式在 asbplayer 中隐藏字幕：

- [`显示/隐藏字幕`](./reference/settings.md#subtitles-keyboard-shortcuts)键盘快捷键。
- [`切换视频中的字幕轨道 X`](./reference/settings.md#subtitles-keyboard-shortcuts)键盘快捷键。
- `播放 > 播放模式`中的[`显示字幕`](./reference/settings.md#show-subtitles)选项。

### asbplayer 无法连接 Anki，显示“Failed to fetch”等错误消息 {#anki-connection-failed}

这可能是广告拦截器导致的：

- 如果你使用 Brave，请确认 Shield 没有拦截 asbplayer。
- 检查浏览器或广告拦截器是否拦截了请求。可以先打开浏览器的开发者控制台查看错误。

配置错误：

- 如果使用网站，请按[此处](./getting-started/mining-subtitles.md)所述，确保 AnkiConnect 允许 asbplayer 连接。

或者是程序问题：

- 截至本文撰写时，已知启用 Experimental Web Platform features 会导致此问题。尝试在 `chrome://flags` 中禁用此标志。
- 在较新版本的 macOS 上，如果 Anki 在后台运行，AnkiConnect 将不会响应（[macOS 用户须知](https://git.sr.ht/~foosoft/anki-connect#notes-for-macos-users)）。

### 使用“更新上一张卡片”功能时，Anki 中的卡片没有更新 {#card-not-updating}

使用“更新上一张卡片”时，请确保 Anki 浏览器已关闭。AnkiConnect 存在一个[已知问题](https://github.com/FooSoft/anki-connect/issues/82)：浏览器打开时，卡片看起来不会更新。

### 加载本地文件时，asbplayer 显示黑屏或没有声音 {#local-video-playback-issues}

不同浏览器对某些视频和音频格式的解码能力不同。请参阅[兼容性](./compatibility.md#browsers-and-media-formats)部分。

### 弹出式词典扩展（例如 Yomitan）在侧边栏中无法使用 {#popup-dictionary-in-side-panel}

出于安全原因，浏览器不允许将扩展脚本注入其他扩展页面，因此无法解决此问题。如果要使用其他扩展扫描文本，需要扫描视频元素中显示的字幕，或 asbplayer 网站上的字幕列表。

### asbplayer 没有检测到流媒体视频 {#asbplayer-isnt-detecting-streaming-video}

请在扩展详情中确认该扩展可以访问所有网站。

### 键盘快捷键无法使用 {#keyboard-shortcuts-arent-working}

检查<a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>键盘快捷键设置</a>或[键盘快捷键参考](./reference/settings.md#keyboard-shortcuts)。

如果使用扩展，也请检查以下事项：

- 在 Chrome 中检查 `chrome://extensions/shortcuts`；在 Firefox 中前往 `about:addons` → 齿轮图标 → `管理扩展快捷键`。
- 尝试刷新页面并重新加载字幕。
- 尝试卸载并重新安装扩展，然后重启浏览器。
- 确认扩展没有重复安装。

### asbplayer 无法正确裁剪流媒体视频的截图 {#screenshot-cropping-issues}

确认浏览器缩放比例为 100%。也可以在<a href={new URL('?view=settings#misc-settings', project.urls.app).href}>扩展设置</a>中完全禁用裁剪。

### 使用 JP mining note 制卡时遇到问题 {#jp-mining-note-issues}

请参阅此[问题](https://github.com/asbplayer/asbplayer/issues/220#issuecomment-1501124166)。

### asbplayer 不断请求录音权限 {#repeated-audio-permission-prompts}

asbplayer 目前与 Volume Master 扩展不兼容，因此需要禁用 Volume Master。

### 录制的音频失真、有杂音或断断续续 {#garbled-audio-recordings}

这通常是 CPU 性能不足导致的。如果使用笔记本电脑，请确认已连接电源。一般来说，请确保 CPU 没有受到省电模式等功能的限制。

### 使用键盘快捷键为流媒体视频打开 asbplayer 时没有反应，页面也停止响应 {#streaming-shortcut-unresponsive}

这可能是因为在 `chrome://flags` 中启用了 `Experimental Web Platform features`。确认已禁用该标志，然后重试。

## 字幕词汇标注 {#annotation}

### 为轨道启用或禁用字幕词汇标注 {#enable-or-disable-annotation-for-a-track}

以下设置均为对应值时，字幕词汇标注会被视为已禁用：

- 在[`设置 > 字幕词汇标注`](./reference/settings.md#annotation)中：
  - [`根据已知单词为字幕着色`](./reference/settings.md#colorize-subtitles-based-on-known-words)：**关**
  - [`自动生成统计数据`](./reference/settings.md#generate-statistics-automatically)：**关**
  - [`显示单词读音`](./reference/settings.md#display-word-readings)：_未选择任何项_（空值）
  - [`显示单词词频`](./reference/settings.md#display-word-frequency)：_未选择任何项_（空值）
  - [`显示音高重音（日语）`](./reference/settings.md#display-pitch-accent-japanese)：_未选择任何项_（空值）
  - [`显示单词释义`](./reference/settings.md#display-word-definitions)：_未选择任何项_（空值）
- 在[`设置 > 播放 > 字幕词汇标注`](./reference/settings.md#playback-annotation)中：
  - [`暂停时选中首个匹配单词`](./reference/settings.md#select-first-matching-word-on-pause)：从不
  - [`自动暂停含有这些单词的字幕`](./reference/settings.md#auto-pause-subtitles-containing-these-words)：无单词筛选器
  - [`在紧凑模式下播放含有这些单词的字幕`](./reference/settings.md#play-subtitles-containing-these-words-in-condensed-mode)：无单词筛选器
  - [`在快进模式下以正常速度播放含有这些单词的字幕`](./reference/settings.md#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode)：无单词筛选器
  - [`循环播放含有这些单词的字幕`](./reference/settings.md#repeat-subtitles-containing-these-words)：无单词筛选器
  - [`播放时显示这些单词`](./reference/settings.md#show-these-words-during-playback)：无单词筛选器
  - [`根据理解度估算调整快进速度`](./reference/settings.md#adjust-fast-forward-rate-by-comprehension)：**关**

要为轨道启用字幕词汇标注，请至少将上述一项设置更改为非禁用值。如果已[配置为悬停时显示](./reference/settings.md#only-display-word-color-on-hover)，某些标注可能只会在鼠标悬停时显示。

:::tip
除非上述设置中有项目启用了需要相应集成的功能，否则[`重建 Anki 词库`](./reference/settings.md#re-build-anki-word-database)和[`重建 WaniKani 词库`](./reference/settings.md#re-build-wanikani-word-database)按钮会被禁用。
:::

### 清除 Anki 词库 {#clear-anki-word-database}

要清除某个轨道的 Anki 词库条目，请将[`Anki 单词字段`](./reference/settings.md#anki-word-fields)和[`Anki 句子字段`](./reference/settings.md#anki-sentence-fields)设为空，然后使用[`重建 Anki 词库`](./reference/settings.md#re-build-anki-word-database)按钮。如果按钮已禁用，请先[按以下步骤](#enable-or-disable-annotation-for-a-track)为该轨道启用字幕词汇标注。

### 清除 WaniKani 词库 {#clear-wanikani-word-database}

要清除某个轨道的 WaniKani 词库条目，请将 [WaniKani API 令牌](./reference/settings.md#wanikani-api-token)设为空，然后使用[`重建 WaniKani 词库`](./reference/settings.md#re-build-wanikani-word-database)按钮。如果按钮已禁用，请先[按以下步骤](#enable-or-disable-annotation-for-a-track)为该轨道启用字幕词汇标注。

### 删除本地追踪的单词 {#delete-locally-tracked-words}

将鼠标悬停在本地追踪的单词上，使用[字幕词汇标注键盘快捷键](./reference/settings.md#annotation-keyboard-shortcuts)将其状态设为**未收集**，并在已启用**已忽略**时将其关闭，即可删除该单词。

要批量删除本地追踪的单词，请使用[`单词浏览器`](./reference/settings.md#word-browser)将单词标记为**未收集**并移除其标记。也可以使用[`导入单词`](./reference/settings.md#import-words)功能。

### 所有单词都显示为未收集 {#everything-is-uncollected}

如果你意外启用了字幕词汇标注，请[按以下步骤](#enable-or-disable-annotation-for-a-track)将其禁用。

如果单词状态始终为**未收集**：

- 如果依赖本地状态，请将单词导入本地词库，或将鼠标悬停在单词上并使用[字幕词汇标注键盘快捷键](./reference/settings.md#annotation-keyboard-shortcuts)设置状态。
- 如果依赖 Anki 状态，请确保 Anki 正在运行，并确认 **AnkiConnect URL** 正确。
    - 配置[`Anki 单词字段`](./reference/settings.md#anki-word-fields)（推荐）和/或 [`Anki 句子字段`](./reference/settings.md#anki-sentence-fields)。
    - 运行[`重建 Anki 词库`](./reference/settings.md#re-build-anki-word-database)。
    - 构建数据库后无需继续运行 Anki，但播放期间保持 Anki 打开可使 asbplayer 保持同步。
- 如果依赖 WaniKani 状态，请确认 [`WaniKani API 令牌`](./reference/settings.md#wanikani-api-token)正确。
    - 运行[`重建 WaniKani 词库`](./reference/settings.md#re-build-wanikani-word-database)。
    - asbplayer 会在播放期间自动与 WaniKani 同步。

### 出现红色删除线样式 {#red-strikethrough-styling-appears}

如果你意外启用了字幕词汇标注，请[按以下步骤](#enable-or-disable-annotation-for-a-track)将其禁用。

这表示处理字幕时发生错误，最可能的原因是连接 Yomitan 时出错。检查浏览器控制台中的错误消息；如果无法解决，请在 asbplayer Discord 上寻求帮助。
