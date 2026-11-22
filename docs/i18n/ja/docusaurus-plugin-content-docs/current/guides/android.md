---
sidebar_position: 7.5
---

import project from '@site/src/project';

# Android {#android}

使い勝手は劣りますが、Android端末でもasbplayerを使用できます。

## ウェブサイト {#website}

ウェブサイトはそのまま使用できます。デスクトップ向けの標準動画コントロールの代わりに**オーバーレイUI**が表示されます。

### ホーム画面に追加 {#add-to-home-screen}

プログレッシブウェブアプリとして、ウェブサイトをAndroid端末のホーム画面に追加できます。ブラウザーのメニューから「ホーム画面に追加」をタップしてください。

## 拡張機能 {#extension}

:::warning
**多くの機能を利用できません**。**サイドパネル**、**スクリーンショット**、**WebSocketインターフェース**が該当します。各ブラウザーの対応機能と非対応機能については、[互換性](../compatibility.md#browsers-and-features)の表を参照してください。
:::

ウェブサイトと同様に、asbplayer拡張機能の主な操作方法は**オーバーレイUI**です。サイドパネルは利用できないため、ブラウザーの拡張機能メニューからasbplayerボタンを選択して**字幕を読み込みます**。拡張機能で[キーボードショートカット](../reference/settings.md#keyboard-shortcuts)を使いたい場合は、（Bluetooth）キーボードがあると便利ですが、必須ではありません。

以下のAndroidブラウザーにasbplayerをインストールできます。

### Firefox for Android {#firefox-for-android}

<a href={project.extension.firefoxAndroid.storeUrl}>AMOページ</a>からasbplayerをインストールします。Firefox for AndroidにはFirefoxと同じ制限があり、DRM保護されたストリームから音声を録音できません。

### Edge Canary {#edge-canary}

Edge Canaryも拡張機能を実行できるChromiumベースのモバイルブラウザーです。この記事の執筆時点では、Edge Canary版のasbplayerは音声録音に対応していません。
Edge Canaryにasbplayerをインストールするには、次の手順に従います。

1. <a href={`${project.urls.repo}/releases/latest`}>リリースページ</a>からasbplayerの`crx`ファイルをダウンロードします。
2. まだ有効にしていない場合は、Edge Canaryの設定で「Microsoft Edgeについて」を開き、ビルドバージョンを数回タップして開発者モードを有効にします。
3. **開発者オプション**で**CRXによる拡張機能のインストール**をタップし、ダウンロードした`crx`ファイルを選択します。

### Kiwi Browser（開発終了） {#kiwi-browser-discontinued}

Kiwi Browserは拡張機能を実行できるChromiumベースのモバイルブラウザーです。ただし、開発は終了しており、[GitHubページ](https://github.com/kiwibrowser/src.next/releases)からのみインストールできます。Kiwi Browserをインストールしたら、Chromeの<a href={project.extension.chrome.storeUrl}>ウェブストア</a>からasbplayerをインストールできます。

## Ankiとの連携 {#anki-integration}

Ankiと連携するには、[AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid)をインストールします。
