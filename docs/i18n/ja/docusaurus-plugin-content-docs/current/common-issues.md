---
sidebar_position: 5
---

import project from '@site/src/project';

# よくある問題 {#common-issues}

## 一般 {#general}

### 字幕が表示されない {#subtitles-arent-showing-up}

いくつかの方法で、asbplayerの字幕を非表示にできます。

- [`字幕の表示を切り替え`](./reference/settings.md#subtitles-keyboard-shortcuts)キーボードショートカット。
- [`動画内の字幕トラックXを切り替え`](./reference/settings.md#subtitles-keyboard-shortcuts)キーボードショートカット。
- `再生 > プレイバックモード`にある[`字幕を表示`](./reference/settings.md#show-subtitles)オプション。

### asbplayerがAnkiに接続できず、「Failed to fetch.」などのエラーが表示される {#anki-connection-failed}

広告ブロッカーが原因で発生することがあります。

- Braveを使用している場合、Shieldがasbplayerをブロックしていないことを確認してください。
- ブラウザーや広告ブロッカーがリクエストをブロックしていないか確認してください。まずブラウザーの開発者コンソールを開き、エラーを探すとよいでしょう。

設定に誤りがある場合:

- ウェブサイトを使用している場合は、[こちら](./getting-started/mining-subtitles.md)の説明に従い、AnkiConnectでasbplayerが許可されていることを確認してください。

または、既知の不具合が原因の場合:

- この記事の執筆時点では、Experimental Web Platform featuresを有効にするとこの問題が起こることが知られています。`chrome://flags`でこのフラグを無効にしてみてください。
- 新しいバージョンのmacOSでは、AnkiがバックグラウンドにあるとAnkiConnectが応答しません（[macOSユーザー向けの注意](https://git.sr.ht/~foosoft/anki-connect#notes-for-macos-users)）。

### 「最後のカードを更新」機能を使っても、Ankiのカードが更新されない {#card-not-updating}

「最後のカードを更新」を使うときは、Ankiのカードブラウザーが閉じていることを確認してください。カードブラウザーが開いているとカードが更新されたように見えないという[既知の問題](https://github.com/FooSoft/anki-connect/issues/82)がAnkiConnectにあります。

### ローカルファイルを読み込むと画面が真っ黒になる、または音声が再生されない {#local-video-playback-issues}

ブラウザーによって、特定の動画・音声形式をデコードできるかどうかが異なります。[互換性のセクション](./compatibility.md#browsers-and-media-formats)を参照してください。

### ポップアップ辞書拡張機能（Yomitanなど）がサイドパネルで動作しない {#popup-dictionary-in-side-panel}

セキュリティ上の理由から、ブラウザーでは他の拡張機能のページへのスクリプト挿入が許可されていないため、この問題を解決する方法はありません。他の拡張機能でテキストを調べる場合は、動画要素内に表示される字幕か、asbplayerウェブサイトの字幕リストを使ってください。

### asbplayerがストリーミング動画を検出しない {#asbplayer-isnt-detecting-streaming-video}

拡張機能の詳細で、すべてのサイトへのアクセスが許可されていることを確認してください。

### キーボードショートカットが動作しない {#keyboard-shortcuts-arent-working}

<a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>キーボードショートカットの設定</a>または[キーボードショートカットのリファレンス](./reference/settings.md#keyboard-shortcuts)を確認してください。

拡張機能を使用している場合は、次の点も確認してください。

- Chromeでは`chrome://extensions/shortcuts`、Firefoxでは`about:addons` → 歯車アイコン → `拡張機能のショートカットを管理`を確認してください。
- ページを再読み込みし、字幕をもう一度読み込んでみてください。
- 拡張機能をアンインストールして再インストールし、ブラウザーを再起動してみてください。
- 拡張機能が二重にインストールされていないことを確認してください。

### asbplayerがストリーミング動画のスクリーンショットを正しく切り抜かない {#screenshot-cropping-issues}

ブラウザーのズーム設定が100%であることを確認してください。切り抜きは<a href={new URL('?view=settings#misc-settings', project.urls.app).href}>拡張機能の設定</a>で完全に無効にできます。

### JP mining noteを使ったマイニングで問題が起きる {#jp-mining-note-issues}

この[イシュー](https://github.com/asbplayer/asbplayer/issues/220#issuecomment-1501124166)を参照してください。

### asbplayerが音声録音の許可を繰り返し求める {#repeated-audio-permission-prompts}

現在、asbplayerはVolume Master拡張機能と互換性がありません。Volume Masterを無効にしてください。

### 録音した音声にノイズが入る、音が割れる、または途切れる {#garbled-audio-recordings}

通常はCPUの性能不足が原因です。ノートパソコンを使用している場合は、電源に接続されていることを確認してください。また、省電力モードなどでCPUの処理速度が制限されていないことを確認してください。

### キーボードショートカットでストリーミング動画のasbplayerを開くと何も起きず、ページが応答しなくなる {#streaming-shortcut-unresponsive}

`chrome://flags`で`Experimental Web Platform features`が有効になっていると発生することがあります。無効にして、もう一度試してください。

## アノテーション {#annotation}

### トラックのアノテーションを有効または無効にする {#enable-or-disable-annotation-for-a-track}

次の設定が以下の値になっている場合、アノテーションは無効とみなされます。

- [`設定 > アノテーション`](./reference/settings.md#annotation)で:
  - [`既知単語に応じて字幕を色分け`](./reference/settings.md#colorize-subtitles-based-on-known-words): **オフ**
  - [`統計を自動生成`](./reference/settings.md#generate-statistics-automatically): **オフ**
  - [`単語の読みを表示`](./reference/settings.md#display-word-readings): _未選択_（空の値）
  - [`単語の頻度を表示`](./reference/settings.md#display-word-frequency): _未選択_（空の値）
  - [`ピッチアクセントを表示（日本語）`](./reference/settings.md#display-pitch-accent-japanese): _未選択_（空の値）
  - [`単語の定義を表示`](./reference/settings.md#display-word-definitions): _未選択_（空の値）
- [`設定 > プレイバック > アノテーション`](./reference/settings.md#playback-annotation)で:
  - [`一時停止時に最初に一致した単語を選択`](./reference/settings.md#select-first-matching-word-on-pause): なし
  - [`これらの単語を含む字幕で自動一時停止`](./reference/settings.md#auto-pause-subtitles-containing-these-words): 単語フィルターなし
  - [`これらの単語を含む字幕を短縮モードで再生`](./reference/settings.md#play-subtitles-containing-these-words-in-condensed-mode): 単語フィルターなし
  - [`早送りモードでこれらの単語を含む字幕を通常速度で再生`](./reference/settings.md#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode): 単語フィルターなし
  - [`これらの単語を含む字幕をリピート`](./reference/settings.md#repeat-subtitles-containing-these-words): 単語フィルターなし
  - [`再生中にこれらの単語を表示`](./reference/settings.md#show-these-words-during-playback): 単語フィルターなし
  - [`理解度に応じて早送り速度を調整`](./reference/settings.md#adjust-fast-forward-rate-by-comprehension): **オフ**

トラックのアノテーションを有効にするには、上記の設定のうち少なくとも1つを無効値以外に設定します。[設定](./reference/settings.md#only-display-word-color-on-hover)によっては、特定のアノテーションはカーソルを合わせたときのみ表示されます。

:::tip
上記の設定が連携のメリットを得られる値になっていない場合、[`Anki単語データベースを再構築`](./reference/settings.md#re-build-anki-word-database)と[`WaniKani単語データベースを再構築`](./reference/settings.md#re-build-wanikani-word-database)のボタンは無効になります。
:::

### Anki単語データベースを消去する {#clear-anki-word-database}

トラックのAnki単語データベースの項目を消去するには、[`Anki単語フィールド`](./reference/settings.md#anki-word-fields)と[`Anki文フィールド`](./reference/settings.md#anki-sentence-fields)を空にして、[`Anki単語データベースを再構築`](./reference/settings.md#re-build-anki-word-database)ボタンを使います。ボタンが無効の場合は、先に[この手順](#enable-or-disable-annotation-for-a-track)に従ってトラックのアノテーションを有効にしてください。

### WaniKani単語データベースを消去する {#clear-wanikani-word-database}

トラックのWaniKani単語データベースの項目を消去するには、[WaniKani APIトークン](./reference/settings.md#wanikani-api-token)を空にして、[`WaniKani単語データベースを再構築`](./reference/settings.md#re-build-wanikani-word-database)ボタンを使います。ボタンが無効の場合は、先に[この手順](#enable-or-disable-annotation-for-a-track)に従ってトラックのアノテーションを有効にしてください。

### ローカルで記録した単語を削除する {#delete-locally-tracked-words}

ローカルで記録した単語を削除するには、その単語にカーソルを合わせ、[アノテーションのキーボードショートカット](./reference/settings.md#annotation-keyboard-shortcuts)で状態を**未収集**にし、**無視**が設定されている場合は切り替えます。

ローカルで記録した単語をまとめて削除するには、[`単語ブラウザー`](./reference/settings.md#word-browser)で単語を**未収集**にして状態を削除します。または、[`単語をインポート`](./reference/settings.md#import-words)機能を使います。

### すべての単語が未収集になる {#everything-is-uncollected}

誤ってアノテーションを有効にした場合は、[この手順](#enable-or-disable-annotation-for-a-track)に従って無効にしてください。

単語の状態が**未収集**から変わらない場合:

- ローカルの状態を使う場合は、単語をローカル単語データベースにインポートするか、単語にカーソルを合わせて[アノテーションのキーボードショートカット](./reference/settings.md#annotation-keyboard-shortcuts)で状態を設定します。
- Ankiの状態を使う場合は、Ankiが起動しており、**AnkiConnect URL**が正しいことを確認してください。
    - [`Anki単語フィールド`](./reference/settings.md#anki-word-fields)（推奨）や[`Anki文フィールド`](./reference/settings.md#anki-sentence-fields)を設定します。
    - [`Anki単語データベースを再構築`](./reference/settings.md#re-build-anki-word-database)を実行します。
    - データベースの構築後はAnkiを起動したままにする必要はありません。ただし、再生中にAnkiを開いておくとasbplayerとの同期が保たれます。
- WaniKaniの状態を使う場合は、[`WaniKani APIトークン`](./reference/settings.md#wanikani-api-token)が正しいことを確認してください。
    - [`WaniKani単語データベースを再構築`](./reference/settings.md#re-build-wanikani-word-database)を実行します。
    - asbplayerは再生中にWaniKaniと自動同期します。

### 赤い取り消し線が表示される {#red-strikethrough-styling-appears}

誤ってアノテーションを有効にした場合は、[この手順](#enable-or-disable-annotation-for-a-track)に従って無効にしてください。

これは字幕の処理中にエラーが発生したことを示しています。多くの場合、Yomitanへの接続に問題があります。ブラウザーコンソールでエラーメッセージを確認してください。解決できない場合は、asbplayerのDiscordでサポートを求めてください。
