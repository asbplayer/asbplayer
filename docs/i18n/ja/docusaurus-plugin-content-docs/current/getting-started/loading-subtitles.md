---
sidebar_position: 1
---

import project from '@site/src/project';

# 字幕の読み込み {#loading-subtitles}

asbplayerを使うには、まず動画ソースに字幕を読み込みます。

## ストリーミング動画 {#streaming-video}

### Chrome（またはChromiumベースのブラウザー） {#chromium}

1. Googleの<a href={project.extension.chrome.storeUrl}>ウェブストア</a>または<a href={`${project.urls.repo}/releases/latest`}>GitHubリリース</a>からChrome拡張機能をインストールします。
2. ブラウザーのツールバーにある🧩アイコンをクリックし、asbplayer → **サイドパネルを開く**を選択します。
3. **字幕を読み込む**をクリックすると、現在のページにある動画に字幕が読み込まれます。

### Firefox {#firefox}

:::warning
Firefoxでは一部の機能を利用できません。[互換性](../compatibility.md#extension)のセクションを参照してください。
:::

1. Mozillaの<a href={project.extension.firefox.storeUrl}>アドオンストア</a>または<a href={`${project.urls.repo}/releases/latest`}>GitHubリリース</a>からFirefoxアドオンをインストールします。
2. ブラウザーのツールバーにある🧩アイコンをクリックし、asbplayer → **サイドパネルを開く**を選択します。
3. **字幕を読み込む**をクリックすると、現在のページにある動画に字幕が読み込まれます。

### Android {#android}

[Androidガイド](../guides/android.md)を参照してください。

## 動画ファイル {#video-files}

1. <a href={project.urls.app}>ウェブサイト</a>を開きます。
2. 動画ファイルと字幕ファイルをウェブサイトにドラッグ＆ドロップします。
