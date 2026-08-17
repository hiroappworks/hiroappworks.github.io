# Hiro App Works Web

Hiro App Worksのブランドトップページ、共通サポート、共通プライバシーポリシーを管理するWeb専用リポジトリです。アプリ本体のコード、秘密情報、ユーザーデータは含めません。

## 現在の状態

2026-08-18時点では、公開中のSupport / Privacyは従来の独立リポジトリから配信されています。このローカルリポジトリへのコピーは完了していますが、公開元の切替はまだ行っていません。

| ページ | 公開URL | 現在の公開リポジトリ | ソース |
| --- | --- | --- | --- |
| Support | https://hiroappworks.github.io/support/ | https://github.com/hiroappworks/support | `main` / `/ (root)` |
| Privacy | https://hiroappworks.github.io/privacy/ | https://github.com/hiroappworks/privacy | `main` / `/ (root)` |

公開切替が完了するまでは、従来リポジトリと `/Users/hiroaki/Documents/SalesLocationLedger/support/`、`/Users/hiroaki/Documents/SalesLocationLedger/privacy/` を削除しないでください。

## 構成

```text
.
├── support/
│   ├── index.html
│   ├── styles.css
│   └── assets/
│       └── hiro-app-works-mark.svg
├── privacy/
│   ├── index.html
│   ├── styles.css
│   └── assets/
│       └── hiro-app-works-mark.svg
├── docs/
│   └── MIGRATION.md
├── .gitignore
└── .nojekyll
```

ルートの `index.html` は、ブランドトップページ制作時に追加します。

## ローカル確認

依存関係やビルド処理はありません。リポジトリルートで次を実行します。

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

- Support: http://127.0.0.1:4173/support/
- Privacy: http://127.0.0.1:4173/privacy/

## 公開方針

将来のブランドトップページを `https://hiroappworks.github.io/` で公開するには、GitHubユーザーサイト用の `hiroappworks/hiroappworks.github.io` リポジトリが必要です。2026-08-18の調査時点では、このリポジトリは存在しません。

このローカルリポジトリの `origin` は、ユーザーサイト用リポジトリを作成して公開方式を確定するまで設定しません。既存の `hiroappworks/support` または `hiroappworks/privacy` を、この統合リポジトリの `origin` に設定しないでください。

公開切替の手順と確認済み情報は [docs/MIGRATION.md](docs/MIGRATION.md) に記録しています。

