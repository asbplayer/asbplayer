---
sidebar_position: 3
---

import NoteAddIcon from '@site/src/components/NoteAddIcon';
import ImageIcon from '@site/src/components/ImageIcon';

# 深入了解字幕挖掘 {#mining-in-depth}

使用 asbplayer 可以根据需求和偏好，采用多种方式挖掘句子。

## 打开 Anki 导出对话框 {#opening-the-anki-export-dialog}

有多种方式可以打开 **Anki 导出对话框**：

1. **侧边栏**的**字幕列表**或网站上的**挖掘字幕** <NoteAddIcon /> 按钮。
2. 流媒体视频或移动版网站**悬浮界面**中的**挖掘字幕** <NoteAddIcon /> 按钮。
3. **挖掘当前字幕并打开 Anki 对话框**[挖掘键盘快捷键](../reference/settings.md#mining-keyboard-shortcuts)，默认为 `Ctrl + Shift + X`。
4. 在流媒体视频上右键 → asbplayer → **挖掘字幕**。

:::info
只有将[挖掘按钮默认操作](../reference/settings#mining-button-default-action)设为“显示 Anki 对话框”，方法 1 和 2 才会打开对话框。  
:::

:::info
加载了_空白_字幕轨道并启用录音时，首次触发上述任一操作会开始录音，第二次触发才会打开 Anki 对话框。
:::

## 调整卡片 {#adjusting-cards}

导出前，可以在对话框中调整卡片。

### 选定时间范围 {#selected-time-range}

可以使用对话框底部的**滑块**更改选定的时间范围。

- 如果尚未手动编辑，**句子字段**会自动更新为与所选时间范围对应的内容。
- 对于本地文件，音频片段也会自动更新。
- 对于流媒体视频，可以根据所选时间范围重新录制音频片段。

### 音频字段 {#audio-field}

**音频字段**会显示录制的音频片段，并提供三个操作按钮：

- **播放/暂停** — 直接在对话框中试听音频片段。
- **重新录制** — 使用当前选定的时间范围重新录制音频（仅限流媒体视频；有可用的重新录制回调时才会显示）。
- **下载** — 将音频片段下载为文件到你的设备。

### 文本字段 {#text-fields}

可以编辑任何文本字段，包括句子、释义、单词、自定义字段、来源、URL 和标签。通常会使用单独的词典应用填写释义字段。

### 图像字段 {#image-field}

对于本地文件，可以点击**图像字段**中的**预览按钮** <ImageIcon />，更改截取画面对应的视频时间戳。

## 导出卡片 {#exporting-cards}

使用对话框底部的按钮导出卡片。共有三种导出方式：

1. **导出**：直接使用对话框中的内容导出卡片。
2. **更新上一张卡片**：使用对话框中的内容更新 Anki 牌组中的上一张卡片。
3. **在 Anki 中打开**：打开 Anki 卡片创建器，并预先填入对话框中的内容。

## 无对话框的挖掘流程 {#dialog-less-mining-flows}

将 asbplayer 与同时集成 Anki 的词典应用搭配使用，就可以在提供单词释义的同时完全跳过 Anki 对话框。目前最常用的此类词典应用是 [Yomitan](https://yomitan.wiki/)。

### 更新上一张卡片 {#update-last-card}

使用 Yomitan 的无对话框挖掘流程如下：

1. 使用 Yomitan 高亮字幕中想要挖掘的单词。
2. 使用 Yomitan 的制卡按钮创建卡片。
3. 立即使用 asbplayer 的**更新上一张卡片**[挖掘键盘快捷键](../reference/settings.md#mining-keyboard-shortcuts)（`Ctrl + Shift + U`），将 asbplayer 提供的内容更新到卡片中。

这种流程的缺点是跳过对话框后，也就失去了修改卡片的机会。不过可以通过以下方式解决：

- 在最后一步，不直接更新上一张卡片，而是使用 `Ctrl + Shift + X` 打开对话框、调整卡片，最后通过对话框界面**更新上一张卡片**。这种方式仍会经过对话框，但保留了 Yomitan 自动提供单词释义的优点。
- 创建卡片_后_，也可以随时使用**手动截图**[挖掘键盘快捷键](../reference/settings.md#mining-keyboard-shortcuts)打开 **Anki 导出对话框**，该快捷键默认为 `Ctrl + Shift + V`。

### 一键挖掘 {#one-click}

请参阅[一键挖掘](./one-click-mining.md)指南。
