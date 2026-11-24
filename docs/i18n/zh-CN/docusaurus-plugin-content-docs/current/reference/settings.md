---
sidebar_position: 1
---

import project from '@site/src/project';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# 设置 {#settings}

## <a href={new URL('?view=settings#anki-settings', project.urls.app).href}>Anki</a> {#anki}

### AnkiConnect URL {#ankiconnect-url}

Anki 中运行的 AnkiConnect 插件服务器的 URL。

### AnkiConnect API Key {#ankiconnect-api-key}

启用 API 密钥保护时，在 AnkiConnect 中配置的 API 密钥。

### 更新卡片后刷新 Anki 浏览器 {#refresh-anki-card-browser}

启用后，asbplayer 更新卡片时会刷新已打开的 Anki 浏览器，使其字段显示最新值。这可能会将浏览器窗口置于前台。此设置默认禁用。

### 牌组 {#deck}

卡片发送到的 Anki 牌组。

### 笔记类型 {#note-type}

卡片使用的 Anki 笔记类型。笔记类型定义卡片的“模型”和“视图”，具体来说，是一组卡片字段，以及一个用于决定如何在卡片正反面显示这些字段的 HTML 模板。

### 卡片字段 {#card-fields}

每个卡片字段设置都决定内容映射到已配置笔记类型中的哪个字段。**字段标签**（句子、释义、单词、图像、音频或 URL）表示**内容**，而**字段值**则是**笔记类型中的字段**。

这些字段会按照设置中的顺序显示在 **Anki 导出对话框**中。可以使用 **⋮ 菜单** → **下移**或**上移**更改顺序。

| 字段                  | 内容                                               |
| --------------------- | -------------------------------------------------- |
| 句子（所有轨道）      | 挖掘时间点的所有字幕                                 |
| 释义                  | 用户提供的单词释义                                   |
| 单词                  | 用户提供的单词                                       |
| 音频                  | 从视频来源录制的音频                                 |
| 图像                  | 视频来源的截图                                       |
| 来源                  | 字幕文件或视频名称及时间戳                           |
| URL                   | 从流媒体视频挖掘卡片时的当前 URL                     |
| 字幕轨道 1            | 挖掘时间点轨道 1 的字幕                              |
| 字幕轨道 2            | 挖掘时间点轨道 2 的字幕                              |
| 字幕轨道 3            | 挖掘时间点轨道 3 的字幕                              |
| 自定义字段            | 用户提供的值                                         |

### 标签 {#tags}

每张卡片默认附带的标签。

## <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>挖掘</a> {#mining}

### 挖掘按钮默认操作 {#mining-button-default-action}

“挖掘按钮” <NoteAddIcon/> 指**悬浮界面**中最左侧的按钮，以及**字幕列表**中每条字幕旁的按钮。此设置用于配置这些按钮的操作。

| 设置                    | 行为                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 显示 Anki 对话框        | 将目标字幕记录到挖掘历史并显示 **Anki 导出对话框**                                                                                                                                                |
| 更新上一张卡片          | 将目标字幕记录到挖掘历史，并使用 asbplayer 提供的所有上下文更新已配置牌组中的上一张卡片（用户提供的释义、单词和自定义字段除外）                                                                    |
| 显示更新卡片对话框      | 将目标字幕记录到挖掘历史，并显示用于使用 asbplayer 提供的上下文更新上一张卡片的对话框                                                                                                             |
| 导出卡片                | 将目标字幕记录到挖掘历史，并且_仅_使用 asbplayer 提供的上下文导出卡片（用户提供的释义、单词和自定义字段除外）                                                                                    |
| 无                      | 将目标字幕记录到挖掘历史                                                                                                                                                                            |

### 挖掘后的播放状态 {#post-mining-playback-state}

配置触发挖掘操作后的播放状态。

### 将挖掘的字幕复制到剪贴板 {#copy-mined-subtitles-to-clipboard}

启用后，每次触发挖掘操作时都会将目标字幕复制到剪贴板。

### 句子字段始终使用字幕文本 {#always-use-subtitle-text-for-sentence-field}

启用后，即使外部应用提供了不同的句子文本，也会使用所有轨道中挖掘到的字幕文本填入句子字段。使用 [Yomitan 挖掘](../guides/one-click-mining.md)时，此设置很有用。

### 更新上一张卡片时，也更新字幕文本相同卡片的句子 {#update-sentence-for-cards-with-the-same-subtitle-text}

启用后，**更新上一张卡片**挖掘操作还会替换连续创建且现有句子与导出句子匹配的笔记中的句子字段和已配置的字幕轨道 1–3 字段。更新时会尽量保留每条笔记的高亮内容。没有导出文本的轨道字段保持不变。如果字幕字段与释义等非字幕字段共用一个 Anki 字段，更新句子时会保留先前笔记中的该字段。

此设置会复制当前导出所选的句子。启用[**句子字段始终使用字幕文本**](#always-use-subtitle-text-for-sentence-field)可使用挖掘到的完整字幕文本。[图像/音频更新](#update-all-cards-with-the-same-subtitle-text)独立于此设置。

匹配时使用主句子字段并忽略句子标记；只要一个句子包含另一个句子，就视为匹配。因此，只包含第一行的笔记也可能与完整字幕匹配。搜索范围包括最近两个 Anki 日内添加的笔记，并在遇到第一条不同或缺失的句子时停止。更新轨道字段时也必须配置句子字段，且导出的句子不能为空。此设置默认禁用，且不会影响对指定卡片的更新。

### 更新上一张卡片时，也更新字幕文本相同卡片的图像/音频 {#update-all-cards-with-the-same-subtitle-text}

启用后，**更新上一张卡片**挖掘操作还会更新由同一字幕行连续创建的笔记中的音频和图像字段。每条先前创建的笔记会保留其单词、释义和自定义字段。除非同时启用[句子更新](#update-sentence-for-cards-with-the-same-subtitle-text)，否则其字幕字段保持不变。匹配时会忽略句子标记，并允许句子只是挖掘字幕上下文的一部分。

搜索范围包括最近两个 Anki 日内添加的笔记，并在遇到第一条不同或缺失的句子时停止。必须配置句子字段，且导出的句子必须包含文本，不能只有空白或标记。此设置默认禁用，且不会影响对指定卡片的更新。

### 从本地视频录音时播放音频 {#play-audio-while-recording-from-local-video}

asbplayer 使用浏览器内置的 [MediaRecorder](https://developer.mozilla.org/ja/docs/Web/API/MediaRecorder) API 从本地视频文件录制音频。此设置用于配置录音期间是否播放声音。

### 将音频重新编码为 mp3 {#re-encode-audio-as-mp3}

录制的音频默认不会编码为 `mp3`。启用此设置会将音频重新编码为 `mp3`。通常没有理由关闭此设置，尤其是想在 iOS 上复习卡片的用户。

### 音频前置留白 {#audio-padding-start}

在目标字幕**之前**多少毫秒开始录制音频。

### 音频后置留白 {#audio-padding-end}

在目标字幕**之后**多少毫秒停止录制音频。

### 图像捕获格式（仅限网站）{#image-capture-format}

指定挖掘卡片的图像捕获格式。仅适用于网站上的本地视频文件，唯一的附加选项是“视频片段”。

### 最大捕获宽度/高度 {#max-capture-dimensions}

截图的最大宽度/高度（像素）。`0` 表示“不限”。

### 从截图中裁去黑边 {#trim-black-bars-from-screenshots}

启用后，会从截图中裁去因宽银幕格式产生的黑边。

### 裁剪片段开头/结尾 {#clip-trim-start-end}

确定视频片段的默认时间范围时，指定从字幕时间区间的开头和结尾分别裁掉多少时间。仅在选择视频片段图像捕获格式时可用。

### 片段最长时长 {#max-clip-length}

指定视频片段的最长时长。仅在选择视频片段图像捕获格式时可用。

### 截图捕获延迟 {#screenshot-capture-delay}

目标字幕出现后等待多久再截取画面。

### 相邻字幕数量范围 {#surrounding-subtitles-count-radius}

**Anki 导出对话框**底部有一个滑块，可用于调整选定的时间区间。滑块会将相邻字幕纳入额外上下文。此设置用于限制相邻字幕的数量。

### 相邻字幕时间范围 {#surrounding-subtitles-time-radius}

**Anki 导出对话框**底部有一个滑块，可用于调整选定的时间区间。滑块会将相邻字幕纳入额外上下文。此设置用于限制相邻字幕与目标字幕之间允许的时间范围。

## <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>字幕外观</a> {#subtitle-appearance}

### 字幕轨道 {#subtitle-appearance-track}

asbplayer 可以同时加载多个字幕轨道。此下拉菜单用于选择以下设置要应用到的轨道。默认选择“全部”。选择“全部”时修改任何外观设置，都会同时更改所有轨道的对应设置。为设置指定某个轨道的值后，该设置就会从“全部”页面中消失。

### 字幕预览 {#subtitle-preview}

预览和编辑用于展示外观设置效果的字幕文本。

### 样式 {#styling}

| 设置                              | 说明                                                                                 | CSS 属性                   |
| --------------------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| 字幕颜色                           | 颜色                                                                                 | `color`                     |
| 字幕大小                           | `px` 单位的大小                                                                      | `font-size`                 |
| 字幕字体粗细                       | 字体粗细                                                                             | `font-weight`               |
| 字幕轮廓颜色                       | 描边颜色                                                                             | `-webkit-text-stroke-color` |
| 字幕轮廓粗细                       | 描边粗细                                                                             | `-webkit-text-stroke-width` |
| 字幕阴影颜色                       | 阴影颜色                                                                             | `text-shadow`               |
| 字幕阴影粗细                       | 阴影粗细                                                                             | `text-shadow`               |
| 字幕背景颜色                       | 背景颜色                                                                             | `background-color`          |
| 字幕背景不透明度                   | 背景不透明度                                                                         | `background`                |
| 字幕字体系列                       | 字体。授予本地字体访问权限后，会显示可用字体下拉菜单。                               | `font-family`               |
| CSS:\<style key\>                 | 使用**添加自定义 CSS**下拉菜单添加的任意自定义 CSS 属性的字符串值。                  | 自定义属性                  |
| 字幕模糊                           | 为字幕应用模糊效果。悬停时取消模糊。                                                  | `filter:blur(...)`          |
| 基于图像的字幕缩放系数             | 缩放基于图像的字幕。                                                                 | —                           |

### 布局 {#layout}

| 设置                                 | 说明                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------- |
| 字幕对齐                             | 将字幕放在视频元素的顶部还是底部。                                         |
| 字幕位置距底部偏移                   | 所有底部字幕轨道与视频元素底部之间的距离。                                 |
| 字幕位置距顶部偏移                   | 所有顶部字幕轨道与视频元素顶部之间的距离。                                 |
| 字幕宽度                             | 字幕容器的宽度，单位为 `%` 或像素。                                        |

## <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>键盘快捷键</a> {#keyboard-shortcuts}

可以使用键盘快捷键访问 asbplayer 的大多数功能。

### <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>字幕</a>键盘快捷键 {#subtitles-keyboard-shortcuts}

| 操作                                | 默认快捷键       |
| ------------------------------------ | ---------------- |
| 选择要加载的字幕轨道                  | Ctrl + Shift + F |
| 显示/隐藏字幕                         | ↓                |
| 切换视频中的字幕轨道 1                | 1                |
| 切换视频中的字幕轨道 2                | 2                |
| 切换视频中的字幕轨道 3                | 3                |
| 在 asbplayer 中切换字幕轨道 1         | W + 1            |
| 在 asbplayer 中切换字幕轨道 2         | W + 2            |
| 在 asbplayer 中切换字幕轨道 3         | W + 3            |
| 在 asbplayer 中取消字幕轨道 1 的模糊   | B + 1            |
| 在 asbplayer 中取消字幕轨道 2 的模糊   | B + 2            |
| 在 asbplayer 中取消字幕轨道 3 的模糊   | B + 3            |
| 上移底部字幕                          |                  |
| 下移底部字幕                          |                  |
| 上移顶部字幕                          |                  |
| 下移顶部字幕                          |                  |

### <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>挖掘</a>键盘快捷键 {#mining-keyboard-shortcuts}

| 操作                                                                                | 默认快捷键                 |
| ------------------------------------------------------------------------------------ | -------------------------- |
| 挖掘当前字幕                                                                      | Ctrl + Shift + Z（网站）   |
| 挖掘当前字幕并打开 Anki 对话框                                                       | Ctrl + Shift + X           |
| 使用 asbplayer 捕获的截图、音频等更新最近创建的 Anki 卡片                             | Ctrl + Shift + U           |
| 绕过对话框将卡片导出到 Anki。                                                        |                            |
| 手动截图，覆盖挖掘时自动截取的截图                                                   | Ctrl + Shift + V（网站）   |
| 即使已加载字幕文件，也可手动开始/停止录音。                                          | Ctrl + Shift + R（网站）   |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>播放</a>键盘快捷键 {#playback-keyboard-shortcuts}

| 操作                            | 默认快捷键       |
| ------------------------------- | ---------------- |
| 显示/隐藏侧边栏                  | \`               |
| 播放/暂停                        | Space            |
| 切换自动暂停                     | Shift + P        |
| 切换紧凑模式                     | Shift + O        |
| 切换快进模式                     | Shift + F        |
| 切换重复模式                     | Shift + R        |
| 切换字幕显示时机                 |                  |
| 循环切换自动暂停恢复模式         |                  |
| 向前循环切换方案                 |                  |
| 向后循环切换方案                 |                  |
| 切换方案 1                       |                  |
| 切换方案 2                       |                  |
| 切换方案 3                       |                  |
| 切换方案 4                       |                  |
| 切换方案 5                       |                  |
| 切换方案 6                       |                  |
| 切换方案 7                       |                  |
| 切换方案 8                       |                  |
| 切换方案 9                       |                  |
| 切换方案 10                      |                  |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>定位</a>键盘快捷键 {#seek-keyboard-shortcuts}

| 操作                                                                      | 默认快捷键       |
| ------------------------------------------------------------------------- | ---------------- |
| 向后定位（默认为 3 秒，可[配置](#seek-interval-seconds)）                 | A                |
| 向前定位（默认为 3 秒，可[配置](#seek-interval-seconds)）                 | D                |
| 定位到上一条字幕                                                          | ←                |
| 定位到下一条字幕                                                          | →                |
| 定位到当前/上一条字幕的开头                                               | ↑                |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>播放速度</a>键盘快捷键 {#playback-rate-keyboard-shortcuts}

| 操作                    | 默认快捷键       |
| ----------------------- | ---------------- |
| 提高播放速度            | Ctrl + Shift + ] |
| 降低播放速度            | Ctrl + Shift + [ |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>字幕偏移</a>键盘快捷键 {#subtitle-offset-keyboard-shortcuts}

| 操作                                                                    | 默认快捷键       |
| ------------------------------------------------------------------------ | ---------------- |
| 调整字幕偏移，使上一条字幕与当前时间戳对齐                              | Ctrl + ←         |
| 调整字幕偏移，使下一条字幕与当前时间戳对齐                              | Ctrl + →         |
| 将字幕偏移增加 100ms                                                     | Ctrl + Shift + ← |
| 将字幕偏移减少 100ms                                                     | Ctrl + Shift + → |
| 重置字幕偏移                                                            | Ctrl + Shift + ↓ |

### <a href={new URL('?view=settings#annotation', project.urls.app).href}>字幕词汇标注</a>键盘快捷键 {#annotation-keyboard-shortcuts}

| 操作                              | 默认快捷键       |
| --------------------------------- | ---------------- |
| 打开统计                          | Q + S            |
| 跳转到下一个单词                  | Q + E            |
| 跳转到上一个单词                  | Q + W            |
| 将悬停单词标记为熟练              | Q + 5            |
| 跳转到下一个熟练单词              |                  |
| 跳转到上一个熟练单词              |                  |
| 将悬停单词标记为未熟练            | Q + 4            |
| 跳转到下一个未熟练单词            |                  |
| 跳转到上一个未熟练单词            |                  |
| 将悬停单词标记为已掌握            | Q + 3            |
| 跳转到下一个已掌握单词            |                  |
| 跳转到上一个已掌握单词            |                  |
| 将悬停单词标记为学习中            | Q + 2            |
| 跳转到下一个学习中单词            |                  |
| 跳转到上一个学习中单词            |                  |
| 将悬停单词标记为未知              | Q + 1            |
| 跳转到下一个未知单词              |                  |
| 跳转到上一个未知单词              |                  |
| 将悬停单词标记为未收集            | Q + 0            |
| 跳转到下一个未收集单词            |                  |
| 跳转到上一个未收集单词            |                  |
| 切换悬停单词的已忽略状态          | Q + I            |
| 跳转到下一个已忽略单词            |                  |
| 跳转到上一个已忽略单词            |                  |

### 定位间隔（秒）{#seek-interval-seconds}

控制[定位键盘快捷键](#seek-keyboard-shortcuts)使用的间隔。

### 使用“定位到当前/上一条字幕的开头”后始终播放 {#always-play-on-subtitle-seek}

使用定位到当前/上一条字幕开头的[定位键盘快捷键](#seek-keyboard-shortcuts)时，始终开始播放，而不是保留当前播放状态。这样可以少按一次按键。

### 播放速度调整步长 {#playback-speed-adjust-step}

使用“提高/降低播放速度”[键盘快捷键](#playback-rate-keyboard-shortcuts)时的增减量。

### 扩展快捷键 {#extension-shortcuts}

安装浏览器扩展后，部分挖掘快捷键（例如挖掘当前字幕、挖掘当前字幕并打开 Anki 对话框）会作为浏览器命令实现，而不是普通的按键事件监听器，因此只能在浏览器的扩展快捷键编辑器中修改。

- Chrome: `chrome://extensions/shortcuts`
- Firefox: `about:addons` → `Manage Extension Shortcuts`

## <a href={new URL('?view=settings#annotation', project.urls.app).href}>字幕词汇标注</a> {#annotation}

### 单词浏览器 {#word-browser}

:::info
只有本地单词可以编辑或删除；外部来源为只读，只能通过[同步](#re-build-anki-word-database)更新。
:::

打开单词浏览器，你可以在其中查看和管理本地词库及从 Anki 同步的词库中的所有单词。

:::tip
你可以使用该语言的任何文字体系查询单词（例如日语中的罗马字、平假名、片假名或汉字）。

系统还会自动处理一些常见的便捷替换，例如 `e -> é` 或 `ss -> ß`。
:::

### 导入单词 {#import-words}

将单词导入 asbplayer 的**本地词库**。

导入的单词被视为本地单词，确定单词状态时优先于外部来源。

导入对话框支持粘贴任意文本（asbplayer 会进行分词），也支持导入先前导出的文件。

:::tip
你可以将鼠标悬停在单词上，并使用[字幕词汇标注键盘快捷键](#annotation-keyboard-shortcuts)在本地更改其状态。
:::

### 导出单词 {#export-words}

导出本地词库，以便备份、迁移到其他设备，或在网站和扩展之间共享。

### 重建 Anki 词库 {#re-build-anki-word-database}

构建或重建从 Anki 获取的单词状态信息本地缓存。

:::tip
启用轨道且 Anki 可连接时，播放过程中也会自动更新缓存。

除非你的标注设置[需要 Anki 集成](../common-issues.md#enable-or-disable-annotation-for-a-track)，否则此按钮不可用。

要清除某个轨道的 Anki 词库条目，请[按以下步骤操作](../common-issues.md#clear-anki-word-database)。
:::

### 重建 WaniKani 词库 {#re-build-wanikani-word-database}

构建或重建从 WaniKani 获取的词汇信息本地缓存。

:::tip
启用轨道并配置令牌后，播放过程中也会自动更新缓存。

除非你的标注设置[需要 WaniKani 集成](../common-issues.md#enable-or-disable-annotation-for-a-track)，否则此按钮不可用。

要清除某个轨道的 WaniKani 词库条目，请[按以下步骤操作](../common-issues.md#clear-wanikani-word-database)。
:::

### 字幕轨道 {#annotation-track}

选择这些词汇标注设置要应用到的字幕轨道。

### 根据已知单词为字幕着色 {#colorize-subtitles-based-on-known-words}

启用单词状态样式（未收集、未知、学习中等）。样式使用已配置的[**单词颜色样式**](#word-color-style)和[**单词状态颜色**](#word-status-colors)。

### 自动生成统计数据 {#generate-statistics-automatically}

加载当前媒体时自动生成统计数据。这也会启用统计悬浮层。[打开统计](#annotation-keyboard-shortcuts)键盘快捷键位于“字幕词汇标注”组中。

### 显示单词读音 {#display-word-readings}

根据单词状态和标记，在单词上方显示读音（例如振假名）。

### 显示单词词频 {#display-word-frequency}

根据状态和标记，在单词下方显示基于排名的词频（如果可用）。这有助于确定哪些单词值得花时间学习。

:::tip
要显示词频信息，你的 Yomitan 实例中至少要有一本基于排名的词频词典。如果词频词典没有声明其模式，asbplayer 会尝试判断它是否基于排名，并据此使用。

如果某个单词有多个词频数值，则使用最低（最常见）的数值。
:::

### 显示音高重音（日语）{#display-pitch-accent-japanese}

:::note
要在振假名上显示音高重音，必须通过[**显示单词读音**](#display-word-readings)启用读音显示。
:::

根据状态和标记，在振假名或假名文本本身上显示音高重音。

:::info
如果有相应数据，单词后接助词的音高重音会根据该单词的音高重音确定。

通常只有汉字会显示振假名，但启用此功能后，只要单词中至少包含一个汉字，所有字符都会显示振假名。这让复合词的音高重音更易阅读。
:::

### 显示单词释义 {#display-word-definitions}

根据单词状态和标记，控制是否为每个单词显示简短释义或说明。

### 单词字段搜索策略 {#word-field-search-strategy}

控制 asbplayer 如何将字幕中的单词与已知单词进行匹配。

- **已收集精确形式**：字段必须包含字幕中的确切表面形式（running -> running）。
- **已收集词元形式**：必须已收集词元/原形（running -> run）。
- **已收集词元或精确形式**：词元或精确形式任一匹配时，就视为已收集（上述任一种）。
- **已收集任意形式**：任何相关形式匹配时，就视为已收集（running -> run、ran、runs 等）。

选择**已收集词元形式**、**已收集词元或精确形式**或**已收集任意形式**时，[**跨文字体系匹配**](#match-across-language-scripts)用于控制基于词元的匹配是否可以跨越同一语言的不同文字体系（例如汉字、平假名、片假名）。

### 卡片选择优先级 {#card-choice-priority}

如果某个单词匹配到多张 Anki 卡片，此设置用于决定使用哪张卡片确定单词状态：

- **字段包含精确形式**（匹配多张时回退到最熟悉的卡片）
- **字段包含词元**（匹配多张时回退到最熟悉的卡片）
- **最熟悉的卡片**
- **最不熟悉的卡片**

### 句子字段搜索策略 {#sentence-field-search-strategy}

控制 asbplayer 如何搜索已配置的 [**Anki 句子字段**](#anki-sentence-fields)，可用选项与[**单词字段搜索策略**](#word-field-search-strategy)相同。

选择**已收集词元形式**、**已收集词元或精确形式**或**已收集任意形式**时，[**跨文字体系匹配**](#match-across-language-scripts)用于控制基于词元的匹配是否可以跨越同一语言的不同文字体系（例如汉字、平假名、片假名）。

:::tip
由于句子中包含多个单词，卡片状态与其中任意单词的关联性会被削弱，因此除非你只有句子卡片，否则最好将此项设为**已收集精确形式**。
:::

### 跨文字体系匹配 {#match-across-language-scripts}

控制基于词元的匹配是否可以跨越同一语言的不同文字体系（例如汉字、平假名、片假名）。

```
if true:
  - Kana subtitles can match kanji in collection, could be homophones but text processing can't handle it so we allow it.
  - Kanji subtitles only match with kanji in collection, prevents kana collected matches all kanji homophones.
if false:
  - Never match across scripts, downside is if kanji is collected kana will need to be collected too.
  - Essentially a strict mode where the you need to collect all script forms of a word.
```

### Yomitan API URL {#yomitan-api-url}

Yomitan API 端点的 URL。如果 URL 无法访问或无效，asbplayer 会显示错误。

:::tip
你需要配置 [Yomitan](https://yomitan.wiki/) 实例和 [yomitan-api](https://github.com/yomidevs/yomitan-api)。
:::

### Yomitan 解析器 {#yomitan-parser}

选择用于对字幕文本进行分词的 Yomitan 解析器：

- **Scanning Parser（所有语言）**：Yomitan 的内部解析器，会匹配词典中的最长单词。
- **MeCab（日语）**：使用 MeCab 解析日语文本。需要在 Yomitan 中配置 MeCab 支持，最好至少有一本 UniDic 词典。

### 单词最大长度 {#max-word-length}

:::info
此设置仅适用于 Scanning Parser。
:::

限制 asbplayer 为标注而尝试扫描/分词的最大单词长度。

:::tip
设置过低会漏掉较长的单词，设置过高则可能导致性能问题。
:::

### Anki 牌组（可选）{#anki-decks}

将 Anki 搜索范围限制为所选牌组。留空时，asbplayer 会搜索所有牌组。

### Anki 单词字段 {#anki-word-fields}

仅包含目标单词的 Anki 笔记字段。建议通过此方式从 Anki 获取已知状态信息。

### Anki 句子字段 {#anki-sentence-fields}

包含句子的 Anki 笔记字段（通常用于句子牌组）。如果[**Anki 单词字段**](#anki-word-fields)中没有包含目标单词的卡片，则使用此字段作为备用。

### Anki 熟练卡片的稳定性/间隔（天）{#mature-anki-stability-interval}

控制将 Anki 卡片视为**熟练**状态而非较低成熟度状态的天数阈值。

- **未收集**：在 Anki 中找不到。
- **未知**：在 Anki 中找到且符合 `is:new`。
- **学习中**：在 Anki 中找到且符合 `is:learn`。
- **已掌握**：在 Anki 中找到且符合 `-is:new -is:learn prop:s<{ceil(cutoff / 2)}`。
- **未熟练**：在 Anki 中找到且符合 `-is:new -is:learn prop:s>=${ceil(cutoff / 2)} prop:s<${cutoff}`。
- **熟练**：在 Anki 中找到且符合 `-is:new -is:learn prop:s>=${cutoff}`。

:::tip
如果卡片有可用的 FSRS 稳定性数据（上次复习时启用了 FSRS），则会使用该数据而非间隔。

有关单词状态的详情，请参阅[**单词状态颜色**](#word-status-colors)。
:::

### 将已暂停的 Anki 卡片视为 {#treat-suspended-anki-cards-as}

控制从 Anki 构建单词状态时如何处理**已暂停**的卡片：

- **正常**：使用 Anki 中的原始状态。
- 或选择特定单词状态（例如**熟练**、**未知**等），强制将已暂停的卡片视为该状态。

:::tip
如果某个单词只有部分卡片处于暂停状态，则会筛除这些卡片，并根据未暂停的卡片确定单词状态。

有关单词状态的详情，请参阅[**单词状态颜色**](#word-status-colors)。
:::

### WaniKani API 令牌 {#wanikani-api-token}

使用 WaniKani API 令牌从 WaniKani 同步已知单词。设置方法请参阅[字幕词汇标注指南](../guides/annotation.md#setup)。

asbplayer 只使用 `vocabulary` 和 `kana_vocabulary` 主题类型确定已知单词。状态根据该主题配置的[间隔重复系统](https://docs.api.wanikani.com/20170710/#spaced-repetition-system)的 SRS 阶段确定。WaniKani 状态定义如下：

- **未收集**：在 WaniKani 中找不到。
- **未知**：在 WaniKani 中找到，但 SRS 阶段低于 `Starting stage`。
- **学习中**：在 WaniKani 中找到，SRS 阶段不低于 `Starting stage` 且低于 `Passing stage`。
- **已掌握**：在 WaniKani 中找到，SRS 阶段处于 `Passing stage` 和 `Burning stage` 之间阶段的较低一半。
- **未熟练**：在 WaniKani 中找到，SRS 阶段处于 `Passing stage` 和 `Burning stage` 之间阶段的较高一半。
- **熟练**：在 WaniKani 中找到，SRS 阶段不低于 `Burning stage`。

:::tip
有关单词状态的详情，请参阅[**单词状态颜色**](#word-status-colors)。
:::

### 单词颜色样式 {#word-color-style}

控制如何将状态颜色应用于[**根据已知单词为字幕着色**](#colorize-subtitles-based-on-known-words)中的单词：

- **文本**：更改单词颜色。
- **背景**：更改单词后方的颜色。
- **下划线**：使用状态颜色为单词添加下划线。
- **上划线**：使用状态颜色为单词添加上划线。
- **轮廓**：使用状态颜色描绘单词轮廓。

:::tip
使用**轮廓**时，可能需要将[**字幕轮廓粗细**](#subtitle-appearance-track)设为 `0`，以获得最佳效果。
:::

### 粗细 {#thickness}

控制**下划线**、**上划线**和**轮廓**样式的粗细（像素）。

### 悬停时突出显示单词 {#highlight-words-on-hover}

:::info
此突出显示表示 asbplayer 当前捕获键盘快捷键的焦点。如果没有出现突出显示，可能需要点击播放器使其获得焦点。键盘快捷键只对当前获得焦点的视频或字幕列表生效，不能同时对两者生效。

突出显示主要用于帮助你了解当前悬停并准备收集的是哪个单词。因此，悬停目标必须是单词，并且必须启用着色。
:::

启用后，悬停在单词上时会突出显示该单词，帮助你了解 Yomitan 如何对其分词。

### 仅在悬停时显示单词颜色 {#only-display-word-color-on-hover}

:::note
此设置仅在启用[**根据已知单词为字幕着色**](#colorize-subtitles-based-on-known-words)时生效。
:::

为视频或字幕列表启用后，单词颜色默认隐藏；只有将鼠标悬停在视频或字幕列表中的字幕文本上时才会显示。

### 仅在悬停时显示单词读音 {#only-display-word-reading-on-hover}

:::note
此设置仅在启用[**显示单词读音**](#display-word-readings)时生效。
:::

为视频或字幕列表启用后，单词读音默认隐藏；只有将鼠标悬停在视频或字幕列表中的字幕文本上时才会显示。

### 仅在悬停时显示单词词频 {#only-display-word-frequency-on-hover}

:::note
此设置仅在启用[**显示单词词频**](#display-word-frequency)时生效。
:::

为视频或字幕列表启用后，单词词频默认隐藏；只有将鼠标悬停在视频或字幕列表中的字幕文本上时才会显示。

### 仅在悬停时显示单词释义 {#only-display-word-definitions-on-hover}

:::note
此设置仅在启用[**显示单词释义**](#display-word-definitions)时生效。
:::

为视频或字幕列表启用后，单词释义默认隐藏；只有将鼠标悬停在视频或字幕列表中的字幕文本上时才会显示。

### 仅在悬停时显示音高重音 {#only-display-pitch-accent-on-hover}

:::note
此设置仅在启用[**显示音高重音（日语）**](#display-pitch-accent-japanese)时生效。
:::

为视频或字幕列表启用后，音高重音默认隐藏；只有将鼠标悬停在视频或字幕列表中的字幕文本上时才会显示。

### 单词读音大小 {#word-reading-size}

控制单词读音（振假名）的大小，单位为 em（占字幕字体大小的百分比）。

### 单词词频大小 {#word-frequency-size}

控制单词词频的大小，单位为 em（占字幕字体大小的百分比）。

### 单词释义大小 {#word-definition-size}

控制单词释义的大小，单位为 em（占字幕字体大小的百分比）。

### 音高重音大小 {#pitch-accent-size}

控制音高重音的大小，单位为 em（占字幕字体大小的百分比）。

### 单词状态颜色 {#word-status-colors}

每种状态都可以设置颜色和透明度，并可单独启用或禁用[**单词颜色样式**](#word-color-style)。

- **未收集**：单词不在 asbplayer 数据库中。
- **未知**：单词存在，但被视为未知。
- **学习中**：单词正在学习。
- **已掌握**：单词已完成学习阶段。
- **未熟练**：单词已知，但尚未熟练。
- **熟练**：单词已完全掌握（熟练）。

:::tip
可以按需禁用状态样式，例如禁用**熟练**以减少视觉干扰。

如果不想区分某些状态，可以重复使用颜色（例如**已掌握**和**未熟练**）。

Anki 卡片状态的判定方法请参阅[**Anki 熟练卡片的稳定性/间隔（天）**](#mature-anki-stability-interval)。
WaniKani 状态的判定方法请参阅 [**WaniKani API 令牌**](#wanikani-api-token)。
:::

## <a href={new URL('?view=settings#playback', project.urls.app).href}>播放</a> {#playback}

### 受播放模式和键盘快捷键影响的字幕轨道 {#playback-subtitle-tracks}

指定使用[字幕](#subtitles-keyboard-shortcuts)和[定位](#seek-keyboard-shortcuts)键盘快捷键或播放模式时要考虑的轨道。例如，启用紧凑模式后，系统会将此选项指定轨道中没有字幕的时间轴片段视为空白并自动跳过。

### 鼠标悬停在字幕上时自动暂停 {#auto-pause-when-mousing-over-subtitles}

鼠标悬停在字幕上时的自动暂停行为。“启用并自动恢复”表示鼠标移出字幕后会自动继续播放。

### 播放模式 {#playback-modes}

可以使用[播放键盘快捷键](#playback-keyboard-shortcuts)切换播放模式。

### 播放速度 {#playback-rate}

控制媒体的正常播放速度，包括启用快进模式时字幕内使用的速度。每次开始播放都会使用此速度。观看时可使用[播放速度键盘快捷键](#playback-rate-keyboard-shortcuts)调整速度。

### 显示播放速度通知 {#show-playback-rate-notification}

快进模式之外的播放速度发生变化时显示通知。

### 自动暂停偏好 {#auto-pause-preference}

启用自动暂停时，选择在字幕开头、结尾还是两端自动暂停。若同时启用两端暂停和循环播放，每次循环前会在结尾暂停，但会跳过开头暂停，以免连续暂停两次。

### 重复次数偏好 {#repeat-count-preference}

控制继续播放前每条字幕的重复次数。`0` 表示无限重复。

### 显示字幕前的重复次数 {#repeats-before-showing-subtitles}

重复播放片段时，先隐藏字幕，直到达到此重复次数。`0` 表示不隐藏字幕，`1` 表示从第一次重复开始就显示字幕。

### 字幕触发起点和终点偏移 {#subtitle-trigger-start-and-end-offsets}

以毫秒为单位调整自动暂停和循环播放使用的字幕开始及结束触发点。这些偏移会在全局字幕偏移之后应用。开始和结束偏移可以单独配置；正值会延后播放效果，负值会提前触发。每个偏移后的边界都受媒体和相邻字幕事件边界限制。如果偏移后的开始和结束时间交叉，它们的先后顺序会互换。

### 快进最小跳过间隔 {#fast-forward-minimum-skip-interval}

字幕间隔达到此时长时，快进整个间隔。较短的间隔保持正常播放速度。

### 快进播放速度 {#fast-forward-playback-rate}

启用快进模式时的快进速度。

### 紧凑模式最小跳过间隔 {#condensed-playback-minimum-skip-interval}

启用紧凑模式后，只有当距离下一条字幕至少有这么长时间时，才会跳转到下一条字幕。

### 字幕间隔触发起点和终点偏移 {#subtitle-gap-trigger-start-and-end-offsets}

调整快进和紧凑模式使用的字幕间隔触发点。间隔起点偏移为非负值，会从字幕结束时刻向后移动触发点；间隔终点偏移为非正值，会从下一条字幕开始前向前移动触发点。每个间隔都受媒体和相邻字幕事件边界限制。

### 自动暂停恢复模式 {#auto-pause-resume-mode}

控制自动暂停如何结束。

- **手动**：播放会保持暂停，直到你手动继续。

- **固定**：每次自动暂停的时长都相同。
  - 由[固定暂停时长](#fixed-pause-duration)和[自动暂停后的恢复延迟](#resume-delay-after-auto-pause)控制。

- **字幕长度**：根据字幕字符数计算暂停时长。只计算可定位轨道上的字幕，因此与目标语言同时加载的译文轨道不会延长暂停时间。
  - 由[最短暂停时长](#minimum-pause-duration)、[最长暂停时长](#maximum-pause-duration)、[每个字符的暂停时间](#pause-time-per-character)和[自动暂停后的恢复延迟](#resume-delay-after-auto-pause)控制。

### 固定暂停时长 {#fixed-pause-duration}

**固定**模式下自动暂停持续的时间。

### 最短暂停时长 {#minimum-pause-duration}

**字幕长度**模式下允许的最短暂停时间，不受字幕字符数影响。

### 最长暂停时长 {#maximum-pause-duration}

**字幕长度**模式下允许的最长暂停时间。`0` 表示没有上限。非零最大值不能小于最短暂停时长。

### 每个字符的暂停时间 {#pause-time-per-character}

**字幕长度**模式下为每个字符分配的毫秒数。字符数乘以此值后，会限制在最短和最长暂停时长之间。

### 自动暂停后的恢复延迟 {#resume-delay-after-auto-pause}

在**固定**和**字幕长度**模式下，自动暂停分为两个阶段：字幕先显示设定的暂停时长，随后隐藏，而播放会继续暂停一段恢复延迟时间。此设置控制第二阶段的时长。

### 显示字幕 {#show-subtitles}

- **到时显示**：字幕处于有效时间范围时显示。

- **暂停时显示**：只有字幕处于有效时间范围且播放已暂停时才显示。

- **手动暂停时显示**：只有字幕处于有效时间范围且播放被手动暂停时才显示。

## <a href={new URL('?view=settings#playback', project.urls.app).href}>播放 > 字幕词汇标注</a> {#playback-annotation}

这些设置使用所选字幕轨道在[字幕词汇标注](#annotation)中的单词状态、标记和词频。启用自动暂停、紧凑模式、快进模式和循环播放时，对应规则才会生效。**无单词筛选器**表示该轨道没有选择任何状态或标记。规则按轨道分别应用：可定位轨道若未为某个模式选择状态或标记，即使与已配置规则的轨道同时播放，该模式也会保持通常行为。

### 字幕轨道 {#playback-annotation-track}

选择要编辑其词汇标注播放设置的字幕轨道。所选轨道与“字幕词汇标注”选项卡共用。

### 暂停时选中首个匹配单词 {#select-first-matching-word-on-pause}

每当播放暂停时（包括手动暂停以及暂停时定位之后），选中第一个符合任一所选状态或标记的单词。留空即可禁用此行为。选中操作会在视频播放器中进行；如果未加载视频或视频未连接，则在字幕播放器中进行。

如果暂停是由[基于词汇标注的自动暂停规则](#auto-pause-subtitles-containing-these-words)触发，则会选中符合该规则的单词。此下拉菜单仍控制手动暂停时的单词选择。

以下每条单词规则都有各自的状态和标记选择、单词数量限制及词频限制。单词必须符合选定的状态或标记，并同时满足两个限制。

### 自动暂停含有这些单词的字幕 {#auto-pause-subtitles-containing-these-words}

启用自动暂停模式时，只在包含匹配单词的字幕处暂停，并选中第一个匹配单词。自动暂停时此规则优先于[**暂停时选中首个匹配单词**](#select-first-matching-word-on-pause)；该下拉菜单仍适用于手动暂停。

### 循环播放含有这些单词的字幕 {#repeat-subtitles-containing-these-words}

启用循环播放模式时，只重复包含匹配单词的字幕。

### 在紧凑模式下播放含有这些单词的字幕 {#play-subtitles-containing-these-words-in-condensed-mode}

启用紧凑模式时，在紧凑时间轴中保留包含匹配单词的字幕。跳过其他字幕。

### 在快进模式下以正常速度播放含有这些单词的字幕 {#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode}

启用快进模式时，以正常播放速度播放包含匹配单词的字幕。其他字幕则快进播放。

### 根据理解度估算调整快进速度 {#adjust-fast-forward-rate-by-comprehension}

启用快进模式时，根据句子的理解度估算分数选择字幕片段内的播放速度。

理解度估算不高于[**最低理解度估算**](#minimum-comprehension)时使用正常播放速度；达到 100% 时使用设定的快进速度。两者之间的速度按比例计算。

在由理解度估算控制的字幕中更改速度时，会更改设定的快进速度，然后根据理解度估算重新计算实际应用的速度。即使理解度估算使字幕保持正常速度，此行为仍适用。键盘快捷键和播放器速度控制使用相同逻辑；正常速度不会改变。

### 最低理解度估算 {#minimum-comprehension}

设置开始加速的百分比（0–99%，默认值为 60%）。

### 播放时显示这些单词 {#show-these-words-during-playback}

选择播放期间应保持可见的单词状态和标记。

### 至少有此百分比的单词将被隐藏时，隐藏整条字幕 {#whole-subtitle-hidden-percentage}

如果显示规则会隐藏字幕中至少此百分比的单词，就隐藏整条字幕。例如设为 **80%** 时，五个单词的字幕中若有四个将被隐藏，则整条字幕都会隐藏，包括那个设为显示的单词。标点和其他非字母字符不计入。

### 逐个隐藏不匹配的单词 {#hide-non-matching-words-individually}

启用后，整条字幕尚未达到隐藏阈值时，不符合显示规则的单词会逐个隐藏。禁用后，字幕会一直完整显示，直到达到阈值。

### 每个所选类别的最少单词数 {#minimum-words-per-selected-category}

字幕中的每个所选类别（例如**未收集**或**已忽略**）会分别计数。如果某类别的单词数低于此限制，该类别的单词不会触发规则。`0` 表示不限制。

### 每个所选类别的最多单词数 {#maximum-words-per-selected-category}

字幕中的每个所选类别（例如**未收集**或**已忽略**）会分别计数。如果某类别的单词数超过此限制，该类别的单词不会触发规则。`0` 表示不限制。

### 仅当单词词频不低于 {#only-when-word-frequency-is-at-least}

匹配的单词词频必须不低于此值。缺少词频数据时按 `1` 计算。`0` 表示不限制。

### 仅当单词词频不高于 {#only-when-word-frequency-is-at-most}

匹配的单词词频必须不高于此值。缺少词频数据时按 `1` 计算。`0` 表示不限制。

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>流媒体视频</a>（仅限扩展）{#streaming-video}

只有安装浏览器扩展后才能使用流媒体视频设置。

### 加载字幕时，也在新标签页中通过应用打开字幕列表 {#open-subtitle-list-in-tab}

每当字幕加载到视频元素中时，打开网站并在单独的标签页中将已加载的字幕与网站同步。

### 应用 URL {#app-url}

确定扩展从何处获取部分配置，以及将字幕同步到单独标签页中运行的网站时要打开哪个 URL。基本上就是网站 URL。

### 启用控制悬浮层 {#enable-controls-overlay}

在已加载字幕的视频元素上显示悬浮界面。

### 显示字幕 {#display-subtitles}

在视频元素上显示已加载的字幕。

### 挖掘时录制音频 {#record-audio-when-mining}

挖掘字幕时，录制该字幕对应的音频并添加到闪卡中。

### 挖掘时截图 {#take-screenshot-when-mining}

挖掘字幕时截取画面并添加到闪卡中。

### 挖掘时清理截图 {#clean-screenshot-when-mining}

挖掘字幕且启用截图时，会在截图前移除视频元素上方的 HTML 元素，使截图保持“干净”。

### 挖掘时裁剪截图 {#crop-screenshot-when-mining}

挖掘字幕时，将截图裁剪到视频元素范围内。

### 图像捕获格式 {#streaming-image-capture-format}

指定从流媒体视频挖掘卡片时使用的图像捕获格式。额外选项为“动态 WebP”，它会捕获标签页中视频在字幕时间范围内的画面（包括音频留白），并保存为动态图像，而不是单张截图。

只有启用[挖掘时录制音频](#record-audio-when-mining)后才会使用动态 WebP，否则仍按常规方式截图。它适用于所有会录制媒体的挖掘方式，包括通过录音键盘快捷键手动开始和停止录音；这种方式会捕获停止录音前的全部内容（最多 30 秒）。同一时间只能进行一次录制。Firefox 不支持动态 WebP，也无法捕获受 DRM 保护的视频。捕获片段时必须让标签页保持可见，因为 Chrome 会停止渲染隐藏的标签页。

### 动态图像帧率 {#animated-image-fps}

捕获动态 WebP 图像时每秒截取的帧数。较长的片段会自动减少帧数，以控制卡片大小。仅在选择动态 WebP 图像捕获格式时可用。

### 动态图像质量 {#animated-image-quality}

动态 WebP 图像每一帧的质量，范围为 `0.1` 到 `1`。数值越高，画质越好，但文件也越大。仅在选择动态 WebP 图像捕获格式时可用。

### 允许拖放字幕文件 {#allow-subtitle-file-drag-and-drop}

允许将字幕文件拖放到视频元素上。

### 自动加载检测到的字幕 {#auto-load-detected-subtitles}

如果当前网站支持自动检测字幕，则自动加载字幕。如果检测到多个轨道，则加载首选语言对应的轨道。选中“记住这些轨道选择”复选框后最近加载的语言即为首选语言。

### 自动加载检测到的字幕失败时提示 {#prompt-on-subtitle-autoload-failure}

自动加载字幕失败时，在尝试加载检测到的字幕前先显示提示。

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>流媒体视频 > 页面</a> {#pages}

YouTube、Netflix 等网站集成的设置。asbplayer 已为每个网站预先配置默认设置，可以在“页面”部分修改这些默认值。

### 机器翻译的目标语言代码（仅限 YouTube）{#youtube-translation-languages}

指定 YouTube 机器翻译要使用的目标语言。指定语言后，字幕轨道选择器中会出现每个目标语言对应的额外轨道。

## <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>杂项</a> {#misc}

### 导入/导出设置 {#import-export-settings}

以 `json` 文件的形式导入或导出设置。

### 主题 {#theme}

将 asbplayer 界面显示为浅色或深色主题。

### 语言 {#language}

界面显示语言。

注意：asbplayer 支持的语言并非都已完成全部文本的本地化。尚未本地化的内容会以英语显示。欢迎通过 [Crowdin 项目](https://crowdin.com/project/asbplayer)帮助翻译。

### 自动最大化本地视频 {#auto-maximize-local-video}

打开字幕面板时自动最大化本地视频。

### 在字幕列表中显示挖掘按钮 {#show-mining-button-in-subtitle-list}

启用后，在字幕列表的每条字幕旁显示挖掘按钮。

### 字幕列表时间戳 {#subtitle-list-timestamps}

控制字幕列表中时间戳的显示方式。

- **隐藏**：不显示。
- **开始时间**：仅显示字幕开始时间戳。
- **开始和结束时间**：显示字幕的开始和结束时间戳。

### 记住字幕偏移 {#remember-subtitle-offset}

启用后，时间偏移会保持不变。加载字幕时会使用上次采用的偏移值。

### 记住上次播放速度 {#remember-last-playback-rate}

在视频中更改播放速度时更新播放速度设置。禁用后，播放仍会从已配置的速度开始，但观看期间的速度调整只暂时生效。

### 记住上次播放模式 {#remember-last-playback-modes}

再次开始播放时恢复上次启用的播放模式。禁用后，播放会以正常模式开始。

### 自动将当前字幕复制到剪贴板 {#auto-copy-current-subtitle-to-clipboard}

字幕显示时自动复制到剪贴板。可用于将字幕发送到能监控剪贴板的应用。

### 可自动复制的字幕轨道 {#subtitle-tracks-eligible-for-auto-copy}

指定启用[自动将当前字幕复制到剪贴板](#auto-copy-current-subtitle-to-clipboard)设置后自动复制哪些轨道。

### 显示预览缩略图 {#show-preview-thumbnails}

在字幕列表中显示预览缩略图。

### 在缩略图上方显示字幕 {#subtitle-above-thumbnail}

在字幕列表的预览缩略图上方显示字幕。

### 字幕正则筛选器 {#subtitle-regex-filter}

与此正则表达式匹配的子字符串会替换为[字幕正则筛选器文本替换](#subtitle-regex-filter-text-replacement)的值。

### 字幕正则筛选器文本替换 {#subtitle-regex-filter-text-replacement}

将与上述正则表达式匹配的子字符串替换为此设置的值。留空时会直接移除匹配的子字符串。

### 字幕 HTML {#subtitle-html}

如何处理字幕文件中的 HTML。

### 检测并显示 Ruby 标注 {#detect-and-display-ruby}

启用后，asbplayer 会自动检测 Netflix 风格的单词读音，并使用 `ruby` 标签以特定样式显示。Netflix 风格的读音常见于日语字幕，形式如 `花子（はなこ）`，即在单词后用括号标注读音。

### 启用 WebSocket 客户端 {#enable-websocket-client}

启用 WebSocket 客户端，以便通过 WebSocket 接口控制 asbplayer。

### WebSocket 服务器 URL {#websocket-server-url}

启用 WebSocket 客户端时要连接的 WebSocket 服务器 URL。通常这是本地运行的[预打包 WebSocket 服务器](../guides/web-socket-server.md)实例。

### 挖掘历史存储上限 {#mining-history-storage-limit}

限制挖掘历史中可保存的卡片数量。

### 标签页名称 {#name-of-the-tab}

应用标签页使用的名称。

## 配置 {#profiles}

设置配置是一套完全独立的设置值。可以在设置界面中更改当前配置，也可以在**加载字幕**和 **Anki 导出**对话框中切换。
