---
sidebar_position: 2
---

import project, { appOrigin } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# 挖掘字幕 {#mining-subtitles}

**句子挖掘**是将句子制成记忆卡片的过程。asbplayer 可以将视频、音频和字幕合并到一张卡片中，制作高质量的句子卡片。asbplayer 集成了常用的闪卡应用 **Anki**。

## 设置 Anki {#setup-anki}

1. 安装 [Anki](https://apps.ankiweb.net/)。
2. 在 Anki 中安装 [AnkiConnect](https://ankiweb.net/shared/info/2055492159)。
3. 如果要从视频文件挖掘，请将 <code>{appOrigin}</code> 添加到 AnkiConnect 设置中的 `webCorsOriginList`：

   <CodeBlock language="json">{JSON.stringify({
     apiKey: null,
     apiLogPath: null,
     ignoreOriginList: [],
     webBindAddress: project.services.ankiConnect.host,
     webBindPort: project.services.ankiConnect.port,
     webCorsOriginList: [appOrigin],
   }, null, 2)}</CodeBlock>

4. 添加一个**牌组**。
5. 添加一个**笔记类型**。
   建议创建自己的笔记类型或使用预制类型。如果想快速开始，可以按以下步骤创建一个基本笔记类型：
   1. 点击工具 → 管理笔记类型。
   2. 添加一个“Basic”笔记类型。
   3. 配置**字段**：
      - Sentence
      - Word
      - Definition
      - Image
      - Audio
      - Source
      - URL
   4. 配置**卡片**：
      - 正面：
        ```
        {{Sentence}}
        ```
      - 背面：
        ```
        {{FrontSide}}
        <hr id=answer>
        {{Definition}}
        <p/>
        <div class="image">
        {{Image}}
        </div>
        <p/>
        {{Audio}}
        <p/>
        {{Source}}
        <p/>
        {{URL}}
        ```

## 配置 asbplayer {#configure-asbplayer}

1. 打开 <a href={new URL('?view=settings', project.urls.app).href}>asbplayer 设置</a>。
2. 选择刚创建的**牌组**和**笔记类型**。
3. 对于**句子**、**释义**、**单词**、**音频**、**图像**、**来源**和 **URL** 字段，分别选择笔记类型中对应的字段。

## 安装词典应用 {#install-a-dictionary-app}

asbplayer 没有内置词典。建议安装词典应用，以便填写卡片的**释义**字段。以下是几款常用应用：

- [Yomitan](https://yomitan.wiki/) 是一款浏览器扩展，将鼠标悬停在单词上即可查询。它最初为日语设计，目前也开始支持其他语言。
- [VocabSieve](https://docs.freelanguagetools.org/) 是一款独立的语言学习应用，支持欧洲语言。

## 挖掘字幕 {#mine-subtitles}

1. 为任意视频来源[加载字幕](./loading-subtitles.md)。
2. 点击**挖掘字幕** <NoteAddIcon /> 按钮。
3. 填写弹出的对话框，然后点击**导出**。
