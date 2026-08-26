# Hiro App Works Web

Hiro App Worksのブランドトップページ、共通サポート、共通プライバシーポリシーを管理する、依存関係のない静的Webサイトです。アプリ本体のコード、秘密情報、ユーザーデータは含めません。

## 現在の状態

2026-08-18時点で、ブランドトップはローカル実装・ブラウザ確認まで完了しています。GitHubへのpush、Pages公開元の切替、旧リポジトリの停止・削除はまだ行っていません。

公開中のSupport / Privacyは、引き続き従来の独立リポジトリから配信されています。

| ページ | 公開URL | 現在の公開リポジトリ | ソース |
| --- | --- | --- | --- |
| Support | https://hiroappworks.github.io/support/ | https://github.com/hiroappworks/support | `main` / `/ (root)` |
| Privacy | https://hiroappworks.github.io/privacy/ | https://github.com/hiroappworks/privacy | `main` / `/ (root)` |

公開切替が完了するまでは、従来リポジトリと `/Users/hiroaki/Documents/SalesLocationLedger/support/`、`/Users/hiroaki/Documents/SalesLocationLedger/privacy/` を削除しないでください。

## 構成

```text
.
├── index.html
├── consignment-note/
│   └── index.html
├── styles.css
├── script.js
├── site-config.js
├── favicon.ico
├── favicon-32x32.png
├── apple-touch-icon.png
├── assets/
│   ├── brand/
│   │   └── hiro-app-works-mark.svg
│   └── apps/
│       └── consignment-note/
│           ├── README.md
│           ├── app-icon.webp
│           └── screens/
├── support/
├── privacy/
├── docs/
│   └── MIGRATION.md
├── .gitignore
└── .nojekyll
```

## ローカル確認

ビルド処理はありません。リポジトリルートで次を実行します。

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

- Brand: http://127.0.0.1:4173/
- Consignment Note: http://127.0.0.1:4173/consignment-note/
- Support: http://127.0.0.1:4173/support/
- Privacy: http://127.0.0.1:4173/privacy/

## App Store URL

正式URLが確定するまでは、トップページのボタンを「App Store 公開準備中」として無効化しています。URLを推測していません。

公開後は `site-config.js` の `appStoreUrl` だけを変更します。値が `https://apps.apple.com/` で始まる場合にのみ、JavaScriptがボタンを有効化して「App Storeで見る」へ切り替えます。

## アプリ追加

ブランドトップのアプリ行は `index.html` の `data-app="consignment-note"` を持つ `article.app-row` です。2作目以降はこの単位で行を追加し、各アプリの素材を `assets/apps/<app-name>/` に分離します。委託販売ノートの詳細ページは `consignment-note/index.html` です。

## 素材

委託販売ノートのアプリアイコンと画面画像は、SalesLocationLedger内の正式なネイティブアイコンおよびApp Store最終候補から、元ファイルを変更せずWebP派生画像としてコピーしています。出典と変換内容は `assets/apps/consignment-note/README.md` に記録しています。

Hiro App WorksのfaviconとApple Touch Iconは、既存の正式な `hiro-app-works-mark.svg` を変更せず、濃紺背景上へ配置した派生画像です。

正式なOGP画像と委託販売ノートのApp Store URLは未確定です。架空素材や推測URLは追加していません。

## 公開方針

ブランドトップを `https://hiroappworks.github.io/` で公開するには、GitHubユーザーサイト用の `hiroappworks/hiroappworks.github.io` リポジトリが必要です。2026-08-18の調査時点では、このリポジトリは存在しません。

このローカルリポジトリの `origin` は、ユーザーサイト用リポジトリを作成して公開方式を確定するまで設定しません。既存の `hiroappworks/support` または `hiroappworks/privacy` を、この統合リポジトリの `origin` に設定しないでください。

公開切替の手順と確認済み情報は [docs/MIGRATION.md](docs/MIGRATION.md) に記録しています。
