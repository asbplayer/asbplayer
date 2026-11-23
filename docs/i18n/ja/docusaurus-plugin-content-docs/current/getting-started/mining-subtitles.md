---
sidebar_position: 2
---

import project, { appOrigin } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# 字幕をマイニングする {#mining-subtitles}

**センテンスマイニング**とは、文からフラッシュカードを作成することです。asbplayerでは動画、音声、字幕を1枚のカードにまとめ、高品質なセンテンスカードを作成できます。asbplayerは人気のフラッシュカードアプリ**Anki**と連携します。

## Ankiのセットアップ {#setup-anki}

1. [Anki](https://apps.ankiweb.net/)をインストールします。
2. Ankiに[AnkiConnect](https://ankiweb.net/shared/info/2055492159)を追加します。
3. 動画ファイルからカードをマイニングする場合は、AnkiConnectの設定で`webCorsOriginList`に<code>{appOrigin}</code>を追加します。

   <CodeBlock language="json">{JSON.stringify({
     apiKey: null,
     apiLogPath: null,
     ignoreOriginList: [],
     webBindAddress: project.services.ankiConnect.host,
     webBindPort: project.services.ankiConnect.port,
     webCorsOriginList: [appOrigin],
   }, null, 2)}</CodeBlock>

4. **デッキ**を追加します。
5. **ノートタイプ**を追加します。
   独自のノートタイプを作成するか、既成のものを使うことをおすすめします。まず使い始めたい場合は、以下の手順で基本的なノートタイプを作成してください。
   1. ツール → ノートタイプの管理をクリックします。
   2. 「基本」ノートタイプを追加します。
   3. **フィールド**を設定します。
      - Sentence
      - Word
      - Definition
      - Image
      - Audio
      - Source
      - URL
   4. **カード**を設定します。
      - 表面:
        ```
        {{Sentence}}
        ```
      - 裏面:
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

## asbplayerの設定 {#configure-asbplayer}

1. <a href={new URL('?view=settings', project.urls.app).href}>asbplayerの設定</a>を開きます。
2. 先ほど作成した**デッキ**と**ノートタイプ**を選択します。
3. **文**、**定義**、**単語**、**音声**、**画像**、**ソース**、**URL**の各フィールドに、ノートタイプの対応するフィールドを選択します。

## 辞書アプリのインストール {#install-a-dictionary-app}

asbplayerには辞書が組み込まれていません。カードの**定義**フィールドを簡単に入力できるよう、辞書アプリのインストールをおすすめします。人気のアプリを以下に紹介します。

- [Yomitan](https://yomitan.wiki/)は、単語にカーソルを合わせて検索できるブラウザー拡張機能です。もともとは日本語向けに作られましたが、他の言語にも対応し始めています。
- [VocabSieve](https://docs.freelanguagetools.org/)は、ヨーロッパ言語に対応した独立型の語学学習アプリです。

## 字幕をマイニングする {#mine-subtitles}

1. 任意の動画ソースに[字幕を読み込みます](./loading-subtitles.md)。
2. **字幕をマイニングする** <NoteAddIcon /> ボタンをクリックします。
3. 表示されたダイアログに入力し、**エクスポート**をクリックします。
