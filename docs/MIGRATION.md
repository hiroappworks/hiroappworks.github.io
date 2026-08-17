# Support / Privacy 分離・移管記録

調査・コピー日: 2026-08-18

## 移管元

### Support

- ローカル: `/Users/hiroaki/Documents/SalesLocationLedger/support/`
- Git remote: `https://github.com/hiroappworks/support.git`
- Branch: `main`
- 移管時HEAD: `6fda7110c8e458899f0c44c22928b0b682873579`
- 公開URL: `https://hiroappworks.github.io/support/`
- GitHub Pages: 有効
- 公開方式: `main` ブランチの `/ (root)`（既存READMEの記録）
- GitHub Actions workflow: なし
- `CNAME`: なし

### Privacy

- ローカル: `/Users/hiroaki/Documents/SalesLocationLedger/privacy/`
- Git remote: `https://github.com/hiroappworks/privacy.git`
- Branch: `main`
- 移管時HEAD: `5192021c9a190a883c726ff4c9ccaf1699b73667`
- 公開URL: `https://hiroappworks.github.io/privacy/`
- GitHub Pages: 有効
- 公開方式: `main` ブランチの `/ (root)`（既存READMEの記録）
- GitHub Actions workflow: なし
- `CNAME`: なし

`SalesLocationLedger` 直下には `.git/config` がなく、アプリ本体全体を管理する親Gitリポジトリはありません。SupportとPrivacyはそれぞれ独立したGitリポジトリです。

## コピーした配信ファイル

各ページから `.git` とリポジトリ固有READMEを除外し、実際に配信される以下のファイルだけをコピーしました。

- `support/index.html`
- `support/styles.css`
- `support/assets/hiro-app-works-mark.svg`
- `privacy/index.html`
- `privacy/styles.css`
- `privacy/assets/hiro-app-works-mark.svg`

本文、URL、Contact導線、CSS、SVGには変更を加えていません。コピー後のファイルは移管元および公開中ファイルとSHA-256が一致することを確認済みです。

## 維持する導線

- Googleフォーム: `https://forms.gle/Jt4DjdAAtz8oBd1y9`
- メール: `mailto:hiro.appworks@gmail.com`
- 共通Support: `https://hiroappworks.github.io/support/`
- 共通Privacy: `https://hiroappworks.github.io/privacy/`
- 委託販売ノート専用Privacy: `https://hiroappworks.github.io/consignment-note-privacy/`

## 公開切替前に必要な作業

1. ルートのブランドページを完成させる。
2. `hiroappworks/hiroappworks.github.io` リポジトリを新規作成する（同名リポジトリが存在しないことは2026-08-18に確認済み）。
3. このWeb専用リポジトリを新しいremoteへ接続する。
4. GitHub Pagesの公開元を確定し、ルート、`/support/`、`/privacy/` を実際に確認する。
5. 既存の `hiroappworks/support` と `hiroappworks/privacy` が同じパスを公開している状態でのルーティングを確認する。
6. HTML、CSS、SVG、Contact、モバイル表示、直接URLアクセスを回帰確認する。
7. 公開切替とロールバック手順が確認できてから、旧リポジトリのPages停止・アーカイブ・削除を別途判断する。

## ロールバック方針

公開切替が完了するまでは、既存の公開リポジトリとSalesLocationLedger内の元フォルダをそのまま残します。新しい公開に問題がある場合は、既存のSupport / Privacyリポジトリを変更せずに稼働継続できる状態を維持します。

