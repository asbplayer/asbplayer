---
sidebar_position: 8
---

import project, { ankiConnectUrl, webSocketUrl } from '@site/src/project';

# ワンクリックマイニング {#one-click-mining}

asbplayerは字幕や動画の内容をAnkiConnectに連携できますが、単語の定義を自動で提供することはできません。そのため、ほとんどのセンテンスマイニングフローでは、マウスやキーボードで2、3回の操作が必要です。

次の機能を持つ別のアプリケーションとasbplayerを組み合わせると、ワンクリックマイニングが可能です。

- 不足している単語の定義情報を提供する。
- AnkiConnectとすでに連携している。

[Yomitan](https://yomitan.wiki/)は、このようなアプリケーションの一例です。

## Yomitanのインストールと設定 {#install-and-configure-yomitan}

手順に従って[Yomitanのウェブサイト](https://yomitan.wiki/)からYomitanをインストールし、学習対象言語の辞書を設定します。まだ追加していない場合は、Ankiに[AnkiConnect](https://ankiweb.net/shared/info/2055492159)も追加する必要があります。

YomitanのAnki設定で、次のようにします。

- AnkiConnectサーバーアドレスはデフォルト（<code>{ankiConnectUrl}</code>）にしてください。
- Yomitanではasbplayerと同じ**ノートタイプ**を使います。

## asbplayer Ankiアドオンのインストール {#install-the-asbplayer-anki-add-on}

このアドオンにはAnki 25.02以降が必要です。AnkiWebではまだ入手できないため、ファイルからインストールします。

1. <a href={`${project.urls.repo}/releases?q=${encodeURIComponent(project.releases.ankiAddon.releaseTitlePrefix)}`}>リリースページ</a>から最新の`.ankiaddon`ファイルをダウンロードします。
2. ファイルを開き、ポップアップの**はい**を押します。
3. Ankiを再起動します。

## asbplayerをアドオンに接続 {#connect-asbplayer-to-the-add-on}

asbplayer拡張機能の<a href={new URL('?view=settings#misc-settings', project.urls.app).href}>その他の設定</a>（下部付近）でWebSocketクライアントを有効にします。アドオンのデフォルトと一致するため、WebSocketサーバーURL（<code>{webSocketUrl}</code>）はデフォルトのままにしてください。

## 通常どおり**Yomitan**でマイニング {#mine-with-yomitan-as-usual}

Yomitanで文をマイニングすると、単語の定義、画像、音声がすでに追加されたカードが作成されます。

Sentenceフィールドで常にasbplayerの字幕テキストを使うには、**マイニング**設定で[**文フィールドに常に字幕テキストを使う**](../reference/settings.md#always-use-subtitle-text-for-sentence-field)を有効にします。Yomitanが提供する文のテキストが、すべてのトラックから取得したマイニング対象の字幕テキストに置き換わります。

同じ字幕から複数の単語をマイニングすると、**最後のカードを更新する**で、それ以前に作成した一致するカードも更新できます。[**文の更新**](../reference/settings.md#update-sentence-for-cards-with-the-same-subtitle-text)を有効にすると文と設定済みの字幕トラックを共有し、[**画像・音声の更新**](../reference/settings.md#update-all-cards-with-the-same-subtitle-text)を有効にするとスクリーンショットと音声クリップを共有します。

## アドオンの設定

アドオンの設定はAnkiの**ツール > アドオン**でアドオンを選択し、**設定**を押すと変更できます。`postMineAction`はYomitanがカードを追加した後にasbplayerが実行する操作です（デフォルト: <code>{project.services.webSocket.postMineAction}</code>）。ワンクリックマイニングフローでは`2`（最後のカードを更新）に設定します。`port`を変更した場合は、asbplayerのWebSocketサーバーURLも一致するように変更する必要があります。
