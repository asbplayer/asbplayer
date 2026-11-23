---
sidebar_position: 7.5
---

import project from '@site/src/project';

# Android {#android}

虽然使用体验不如桌面端，但 asbplayer 也可以在 Android 设备上使用。

## 网站 {#website}

网站可以直接使用。此时会显示**悬浮界面**，而不是默认的桌面版视频控制栏。

### 添加到主屏幕 {#add-to-home-screen}

作为渐进式 Web 应用，网站可以添加到 Android 设备的主屏幕。在浏览器菜单中点击“添加到主屏幕”。

## 扩展 {#extension}

:::warning
**许多功能不可用**：包括**侧边栏**、**截图**和 **WebSocket 接口**。各浏览器支持和不支持的功能请参阅[兼容性](../compatibility.md#browsers-and-features)部分的表格。
:::

与网站版一样，与 asbplayer 扩展交互的主要方式是使用**悬浮界面**。由于没有侧边栏，需要从浏览器的扩展菜单中选择 asbplayer 按钮来**加载字幕**。使用（蓝牙）键盘并非必需，但如果你希望使用扩展的[键盘快捷键](../reference/settings.md#keyboard-shortcuts)，键盘会很有帮助。

以下 Android 浏览器可以安装 asbplayer。

### Firefox for Android {#firefox-for-android}

从 <a href={project.extension.firefoxAndroid.storeUrl}>AMO 页面</a>安装 asbplayer。Firefox for Android 与 Firefox 有相同的限制：无法录制 DRM 保护的流媒体音频。

### Edge Canary {#edge-canary}

Edge Canary 是另一款可以运行扩展的 Chromium 移动浏览器。截至本文撰写时，Edge Canary 上的 asbplayer 不支持录音。
要在 Edge Canary 上安装 asbplayer：

1. 从<a href={`${project.urls.repo}/releases/latest`}>发布页面</a>下载 asbplayer 的 `crx` 文件。
2. 如果尚未启用开发人员模式，请在 Edge Canary 设置中打开“关于 Microsoft Edge”，然后多次点击版本号。
3. 在**开发人员选项**中点击**通过 crx 安装扩展**，并选择刚下载的 `crx` 文件。

### Kiwi Browser (discontinued) {#kiwi-browser-discontinued}

Kiwi Browser 是一款可以运行扩展的 Chromium 移动浏览器。不过它已停止开发，只能从 [GitHub 页面](https://github.com/kiwibrowser/src.next/releases)安装。安装 Kiwi Browser 后，可以从 Chrome <a href={project.extension.chrome.storeUrl}>网上应用店</a>安装 asbplayer。

## Anki 集成 {#anki-integration}

如需集成 Anki，请安装 [AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid)。
