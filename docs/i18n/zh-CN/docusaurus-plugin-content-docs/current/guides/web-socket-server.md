---
sidebar_position: 9
---

import project, { webSocketHttpUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# WebSocket 服务器 {#websocket-server}

asbplayer 利用 WebSocket 连接的双向通信特性，提供可从浏览器外部访问的接口。

在这种架构中，asbplayer 是一个**WebSocket 客户端**，它与运行在用户电脑本地的 **WebSocket 服务器**保持连接。随后，服务器通过 HTTP 接口触发发送给客户端 asbplayer 的命令。预打包服务器的技术参考请见[此处](../reference/external-api.md)。

该服务器最初用于实现一键挖掘流程，为 AnkiConnect 的 `addNote` 请求添加 asbplayer 提供的媒体内容，因此其主要功能之一也是充当 **AnkiConnect 代理**。

:::note
实现一键挖掘的首选方式是使用 [asbplayer Anki 插件](./one-click-mining.md#install-the-asbplayer-anki-add-on)。下文介绍的 AnkiConnect 代理是另一种方案。
:::

## 运行服务器 {#run-the-server}

1. 克隆 <a href={project.urls.repo}>asbplayer 仓库</a>。

    <CodeBlock language="bash">{`git clone ${project.urls.repo}.git asbplayer`}</CodeBlock>

2. 如果尚未安装，请安装 [Golang](https://go.dev/dl/)。
3. 运行服务器：

    ```
    cd asbplayer/scripts/web-socket-server
    go run .
    ```

该代理占用资源很少，可以在后台持续运行。在 Windows 上，可以使用 [RBTray](https://github.com/benbuck/rbtray) 将其最小化到任务栏。

## 将 asbplayer 连接到服务器 {#connect-asbplayer-to-the-server}

在<a href={new URL('?view=settings#misc-settings', project.urls.app).href}>杂项设置</a>中配置并启用 asbplayer 的 WebSocket 客户端。默认情况下，asbplayer 已指向 WebSocket 服务器的默认 IP 地址和端口，因此通常只需启用 WebSocket 客户端即可。

## 使用 AnkiConnect 代理进行一键挖掘 {#one-click-mining-with-the-ankiconnect-proxy}

按照 [Yomitan 网站](https://yomitan.wiki/)上的说明安装 Yomitan，并为目标语言配置词典。

然后配置 Yomitan：

- AnkiConnect URL 应指向 AnkiConnect 代理，而不是 AnkiConnect。代理的默认 URL 是 <code>{webSocketHttpUrl}</code>。
- Yomitan 应使用与 asbplayer 相同的**笔记类型**。

使用 Yomitan 挖掘句子时，生成的卡片会自动包含单词释义、图像和音频。将代理的 `POST_MINE_ACTION` 设为 `2`（更新上一张卡片），即可实现真正的一键挖掘流程。详情请参阅[服务器配置](#server-configuration)。

要始终将 asbplayer 的字幕文本用于句子字段，请在**挖掘**设置中启用[**句子字段始终使用字幕文本**](../reference/settings.md#always-use-subtitle-text-for-sentence-field)。这会用所有轨道中挖掘到的字幕文本替换 Yomitan 提供的句子文本。

## API 参考 {#api-reference}

WebSocket 连接支持发送给 asbplayer 的命令说明，请参阅[技术参考](../reference/external-api.md#commands)。

## 基于 HTTP 的 API {#http-based-api}

WebSocket 服务器实现了一个基于 HTTP 的 API，用于触发上文所述的命令。

- `POST asbplayer/load-subtitles` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/load-subtitles`}>script</a>)
- `POST asbplayer/seek` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/seek`}>script</a>)
- `GET asbplayer/bound-media` (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/bound-media`}>script</a>)
- `GET asbplayer/subtitles` (optional `?mediaId=...&trackNumbers=0,1`) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/subtitles`}>script</a>)

## AnkiConnect 代理 {#ankiconnect-proxy}

WebSocket 服务器也充当 AnkiConnect 代理，可以为 `addNote` 请求添加 asbplayer 提供的上下文，例如音频和截图。

除 `addNote` 外，代理会原样转发所有 AnkiConnect 请求。对于 `addNote`，代理的具体行为取决于下文配置中的 `POST_MINE_ACTION` 值。

## 服务器配置 {#server-configuration}

服务器通过放在同一目录下的 `.env` 文件进行配置。以下是带说明的示例文件。

```
# Port that the proxy will listen on
PORT=8766

# AnkiConnect URL
ANKI_CONNECT_URL=http://127.0.0.1:8765

# Action for asbplayer to take when the proxy receives an addNote request
# 0 = 'None'
# 1 = 'Open Anki dialog'
# 2 = 'Update last card' (updates last card with asbplayer media AFTER passing through original addNote request)
# 3 = 'Export card'
POST_MINE_ACTION=2
```
