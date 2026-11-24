---
sidebar_position: 8
---

import project, { ankiConnectUrl, webSocketUrl } from '@site/src/project';

# 一键挖掘 {#one-click-mining}

asbplayer 擅长将字幕和视频内容连接到 AnkiConnect，但无法自行自动提供单词释义。因此，大多数句子挖掘流程都需要用户进行两三次鼠标或键盘操作。

如果将 asbplayer 与满足以下条件的其他应用搭配使用，就可以一键挖掘：

- 提供缺少的单词释义信息；
- 已经集成 AnkiConnect。

[Yomitan](https://yomitan.wiki/) 就是此类应用的一个例子。

## 安装并配置 Yomitan {#install-and-configure-yomitan}

按照 [Yomitan 网站](https://yomitan.wiki/)上的说明安装 Yomitan，并为目标语言配置词典。如果尚未安装，还需要在 Anki 中添加 [AnkiConnect](https://ankiweb.net/shared/info/2055492159)。

在 Yomitan 的 Anki 设置中：

- AnkiConnect 服务器地址应使用默认值（<code>{ankiConnectUrl}</code>）。
- Yomitan 应使用与 asbplayer 相同的**笔记类型**。

## 安装 asbplayer Anki 插件 {#install-the-asbplayer-anki-add-on}

该插件至少需要 Anki 25.02。目前尚未在 AnkiWeb 上提供，因此需要通过文件安装：

1. 从<a href={`${project.urls.repo}/releases?q=${encodeURIComponent(project.releases.ankiAddon.releaseTitlePrefix)}`}>发布页面</a>下载最新的 `.ankiaddon` 文件。
2. 打开该文件，并在弹出窗口中点击**是**。
3. 重启 Anki。

## 将 asbplayer 连接到插件 {#connect-asbplayer-to-the-add-on}

在 asbplayer 扩展的<a href={new URL('?view=settings#misc-settings', project.urls.app).href}>杂项设置</a>（靠近底部）中启用 WebSocket 客户端。保留默认的 WebSocket 服务器 URL（<code>{webSocketUrl}</code>），它与插件的默认值一致。

## 像平常一样使用 **Yomitan** 挖掘 {#mine-with-yomitan-as-usual}

使用 Yomitan 挖掘句子时，生成的卡片会自动包含单词释义、图像和音频。

要始终将 asbplayer 的字幕文本用于句子字段，请在**挖掘**设置中启用[**句子字段始终使用字幕文本**](../reference/settings.md#always-use-subtitle-text-for-sentence-field)。这会用所有轨道中挖掘到的字幕文本替换 Yomitan 提供的句子文本。

如果从同一字幕中挖掘多个单词，**更新上一张卡片**也可以更新之前匹配的卡片。启用[**句子更新**](../reference/settings.md#update-sentence-for-cards-with-the-same-subtitle-text)可共享句子和已配置的字幕轨道，启用[**图像/音频更新**](../reference/settings.md#update-all-cards-with-the-same-subtitle-text)可共享截图和音频片段。

## 插件设置

在 Anki 中前往**工具 > 插件**，选择该插件并点击**配置**，即可更改插件设置。`postMineAction` 是 Yomitan 添加卡片后 asbplayer 执行的操作（默认值：<code>{project.services.webSocket.postMineAction}</code>）。要使用一键挖掘流程，请将其设为 `2`（更新上一张卡片）。如果更改了 `port`，还需要相应更改 asbplayer 的 WebSocket 服务器 URL。
