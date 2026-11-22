---
sidebar_position: 9
---

import project, { webSocketHttpUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# WebSocketサーバー {#websocket-server}

asbplayerはWebSocket接続の双方向性を利用し、ブラウザーの外部から利用できるインターフェースを提供します。

この設計では、asbplayerはユーザーのコンピューター上で動作する**WebSocketサーバー**への接続を維持する**WebSocketクライアント**です。サーバーはHTTPインターフェースを公開し、クライアントであるasbplayerにコマンドを送信します。パッケージに含まれるサーバーの技術リファレンスは[こちら](../reference/external-api.md)です。

このサーバーは、AnkiConnectの`addNote`リクエストにasbplayerが提供するメディアを追加するワンクリックのマイニングフローを実現するために作られました。そのため、主な機能の1つとして**AnkiConnectプロキシ**も備えています。

:::note
ワンクリックでカードをマイニングするには、[asbplayer Ankiアドオン](./one-click-mining.md#install-the-asbplayer-anki-add-on)を使う方法をおすすめします。以下で説明するAnkiConnectプロキシは代替手段です。
:::

## サーバーの起動 {#run-the-server}

1. <a href={project.urls.repo}>asbplayerリポジトリ</a>をクローンします。

    <CodeBlock language="bash">{`git clone ${project.urls.repo}.git asbplayer`}</CodeBlock>

2. まだインストールしていない場合は、[Golang](https://go.dev/dl/)をインストールします。
3. サーバーを起動します。

    ```
    cd asbplayer/scripts/web-socket-server
    go run .
    ```

プロキシは非常に軽量なため、バックグラウンドで起動したままにしても問題ありません。Windowsでは[RBTray](https://github.com/benbuck/rbtray)を使ってタスクバーに最小化できます。

## asbplayerをサーバーに接続する {#connect-asbplayer-to-the-server}

<a href={new URL('?view=settings#misc-settings', project.urls.app).href}>その他の設定</a>で、asbplayerのWebSocketクライアントを設定して有効にします。初期状態では、asbplayerはWebSocketサーバーのデフォルトのIPアドレスとポートを参照しているため、通常はWebSocketクライアントを有効にするだけで接続できます。

## AnkiConnectプロキシを使ったワンクリックのマイニング {#one-click-mining-with-the-ankiconnect-proxy}

説明に従って[Yomitanのウェブサイト](https://yomitan.wiki/)からYomitanをインストールし、学習対象言語の辞書を設定します。

次にYomitanを設定します。

- AnkiConnect URLにはAnkiConnectではなくAnkiConnectプロキシを指定します。プロキシのデフォルトURLは<code>{webSocketHttpUrl}</code>です。
- Yomitanではasbplayerと同じ**ノートタイプ**を使用します。

Yomitanで文からカードをマイニングすると、単語の定義、画像、音声がすでに追加されたカードが作成されます。プロキシの`POST_MINE_ACTION`を`2`（最後のカードを更新）にすると、完全なワンクリック作成フローを実現できます。詳しくは[サーバー設定](#server-configuration)を参照してください。

Sentenceフィールドで常にasbplayerの字幕テキストを使うには、**マイニング**設定で[**文フィールドに常に字幕テキストを使う**](../reference/settings.md#always-use-subtitle-text-for-sentence-field)を有効にします。これにより、Yomitanが提供する文のテキストが、全トラックから取得した字幕テキストに置き換えられます。

## APIリファレンス {#api-reference}

WebSocket接続を通じてasbplayerに送信できるコマンドについては、[技術リファレンス](../reference/external-api.md#commands)を参照してください。

## HTTPベースのAPI {#http-based-api}

WebSocketサーバーには、上記のコマンドを実行するHTTPベースのAPIが実装されています。

- `POST asbplayer/load-subtitles`（リクエスト本文の任意の`mediaId`）(<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/load-subtitles`}>スクリプト</a>)
- `POST asbplayer/seek`（リクエスト本文の任意の`mediaId`）(<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/seek`}>スクリプト</a>)
- `GET asbplayer/bound-media` (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/bound-media`}>スクリプト</a>)
- `GET asbplayer/subtitles`（任意の`?mediaId=...&trackNumbers=0,1`）(<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/subtitles`}>スクリプト</a>)

## AnkiConnectプロキシ {#ankiconnect-proxy}

WebSocketサーバーはAnkiConnectプロキシとしても動作し、`addNote`リクエストに音声やスクリーンショットなどのasbplayerが提供する情報を追加できます。

プロキシは`addNote`以外のAnkiConnectリクエストをそのまま転送します。`addNote`に対するプロキシの動作は、以下で説明する設定の`POST_MINE_ACTION`の値によって決まります。

## サーバー設定 {#server-configuration}

サーバーと同じディレクトリに置いた`.env`ファイルで設定します。以下に説明付きの例を示します。

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
