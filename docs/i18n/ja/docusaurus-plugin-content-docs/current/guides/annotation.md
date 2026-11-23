---
sidebar_position: 1
---

import project from '@site/src/project';

# アノテーション {#annotation}

asbplayerでは字幕にアノテーションを付けて、語学学習をより効果的に進められます。アノテーション機能には次のものがあります。

- **単語のスタイル**: 単語の状態に応じて色、下線、輪郭線などを設定します。
    - 既知状態はAnki、WaniKaniから取得して同期したり、asbplayer内でローカルに記録したりできます（既知単語の初期登録に役立つインポート／エクスポート機能もあります）。
- **読みのアノテーション**: 各単語の上に読みを表示したり、状態に応じて表示したりします。
- **頻度のアノテーション**: 順位に基づく頻度を各単語の下に表示したり、状態に応じて表示したりします（順位ベースの頻度辞書が少なくとも1つ必要です）。
- **ピッチアクセントのアノテーション**: ふりがなまたはかなの単語にアクセント型を表示します（ピッチアクセント辞書が少なくとも1つ必要です）。
- **語義のアノテーション**: 各単語に短い定義や説明を表示します。
- **統計と理解度**: 現在のメディアで既知の単語について情報を表示します。
- **適応再生**: プレイバックモードとアノテーションデータを使って、学習体験を最適化します。
- **単語ブラウザー**: ローカルの単語を管理し、外部ソースから同期された単語を確認します。
- 今後のリリースでさらに多くの機能を追加する予定です。

:::info
アノテーションには、設定済みの[Yomitan](https://yomitan.wiki/)と[yomitan-api](https://github.com/yomidevs/yomitan-api)が必要です。

**ローカル単語データベース**を使用する場合は、保存した単語がブラウザーによって削除されにくくなるため、asbplayerブラウザー拡張機能のインストールをおすすめします。拡張機能をインストールできない場合は、バックアップとして設定やローカル単語を定期的にエクスポートすることを検討してください。
:::

## セットアップ {#setup}

1. asbplayerの**設定**を開きます。
2. **アノテーション**セクションを開きます。
3. 設定するトラックを選択します。
4. そのトラックの**Yomitan URL**を設定します。
    - 設定済みの[Yomitan](https://yomitan.wiki/)と[yomitan-api](https://github.com/yomidevs/yomitan-api)が必要です。
    - URLが無効または到達不能の場合、asbplayerは設定の横にエラーを表示します。
    - 頻度情報を使うには、Yomitanに順位ベースの頻度辞書が少なくとも1つ必要です。
5. （Ankiユーザー）既知状態情報の取得元にするカードを設定します。
    - 通常、[`Ankiデッキ`](../reference/settings.md#anki-decks)は空欄のままにしてすべてのデッキを対象にします。通常はフィールドで絞り込めば十分です。
    - [`Anki単語フィールド`](../reference/settings.md#anki-word-fields)には、対象の単語だけを含むAnkiノートのフィールドを指定します。
    - [`Anki文フィールド`](../reference/settings.md#anki-sentence-fields)は、専用の単語フィールドがないAnkiノート（文デッキなど）にのみ使用します。Anki単語フィールドに単語がない場合の代替として扱われます。
    - フィールドを設定したら、[`Anki単語データベースを再構築`](../reference/settings.md#re-build-anki-word-database)を実行してデータベースに登録します。
6. （WaniKaniユーザー）[WaniKani > 設定 > APIトークン](https://www.wanikani.com/settings/personal_access_tokens)にアクセスして、asbplayer用のトークンを作成します。
    - `Token Description`欄に`asbplayer`と入力し、すべての`Permissions`を未選択のままにします。asbplayerにはWaniKaniアカウントの読み取りアクセスのみが必要です。
    - `Generate token`をクリックし、生成されたトークンを[`WaniKani APIトークン`](../reference/settings.md#wanikani-api-token)に貼り付けます。
    - APIトークンを設定したら、[`WaniKani単語データベースを再構築`](../reference/settings.md#re-build-wanikani-word-database)を実行してデータベースに登録します。
7. そのトラックで使用するアノテーション機能（スタイル、読み、頻度、ピッチアクセントなど）を有効にします。その他の設定も必要に応じて調整してください。
8. 各オプションの詳しい説明は、設定リファレンスの[アノテーション](../reference/settings.md#annotation)セクションを参照してください。キーボード操作は[アノテーションのキーボードショートカット](../reference/settings.md#annotation-keyboard-shortcuts)に記載されています。

## トラブルシューティング {#troubleshooting}

アノテーションの問題については、ドキュメントの[よくある問題](../common-issues.md#annotation)を参照してください。解決方法が見つからない場合は、<a href={project.urls.discord}>Discord</a>で問い合わせるか、問題の詳細と再現手順を添えて<a href={`${project.urls.repo}/issues`}>バグを報告</a>してください。
