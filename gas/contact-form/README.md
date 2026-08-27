# お問い合わせフォーム送信設定

このディレクトリには、静的サイトの `/contact/` から送信された内容を、既存のGoogleフォームへ登録するGoogle Apps Scriptを置いています。Googleフォーム自体、既存の回答、質問項目、設定は変更しません。

## 既存フォームとの対応

2026-08-27に公開フォームの表示を確認し、現在の項目を次のとおり照合しています。

| サイト側の内部ID | Googleフォームの質問 | 種類 | 必須 | 送信値 |
| --- | --- | --- | --- | --- |
| `appId` | 対象アプリ | リスト | ○ | GASの許可リストから表示値へ変換 |
| `inquiryTypeId` | お問い合わせ種別 | リスト | ○ | GASの許可リストから表示値へ変換 |
| `message` | お問い合わせ内容 | 段落 | ○ | 入力本文 |
| `email` | 返信先メールアドレス | 短文 | ○ | メールアドレス |
| `appVersion` | アプリのバージョン | 短文 | 任意 | 入力値 |
| `iosDevice` | iOSバージョン／iPhone機種 | 短文 | 任意 | 入力値 |

氏名の質問は既存フォームにないため、サイトにも追加していません。`locale` は現在のフォームの質問へ追加せず、GASの受付許可値（`ja` / `en`）としてのみ検証します。将来フォームへ保存する場合は、既存フォームの変更について別途確認してください。

`app_consignment_note` と `app_other`、お問い合わせ種別の内部IDから、現在のGoogleフォームの選択肢へ変換する処理は `Code.gs` の許可リストに限定しています。クライアントから表示ラベルを受け取って保存することはありません。

## Apps Scriptプロジェクトの作成

1. Google Apps Scriptで新しいスタンドアロンプロジェクトを作成します。
2. `Code.gs` の内容を貼り付けます。
3. プロジェクト設定で `appsscript.json` のマニフェスト表示を有効にし、同梱のマニフェスト内容を反映します。
4. 初回実行時の権限確認で、既存Googleフォームと外部リクエストへのアクセスを許可します。

## Script Properties

Apps Scriptの「プロジェクトの設定」から、次のScript Propertiesを登録してください。

| キー | 値 |
| --- | --- |
| `GOOGLE_FORM_ID` | `1FAIpQLSfhrGuzRwkdyHXKMJRBKzAnb6IefsICHSgmdK0g3wIaiAecLQ` |
| `TURNSTILE_SECRET` | Cloudflare TurnstileのSecret Key（リポジトリへ保存しない） |
| `ALLOWED_HOSTNAMES` | 実際に許可するサイトのホスト名をカンマ区切りで指定（例：`hiroappworks.com,www.hiroappworks.com`） |

`ALLOWED_HOSTNAMES` は、Turnstileウィジェットに登録したホスト名と一致させてください。`hiroappworks.github.io` からも利用する期間がある場合は、そのホスト名をウィジェット側にも登録したうえで値へ追加します。ローカル確認には本番用ウィジェットを流用せず、必要ならCloudflareのテスト用キーを別途使ってください。

## Web Appとしてデプロイ

Apps Scriptの「デプロイ」→「新しいデプロイ」→「ウェブアプリ」で、次の設定にします。

- 実行するユーザー：自分
- アクセスできるユーザー：全員（Googleへのログインを要求しない設定）

デプロイ後に発行される `/exec` URLを使います。`/dev` URLは編集者向けのため、公開サイトへ設定しません。GETで開いたときに、`{"ok":true,"service":"hiro-app-works-contact"}` 相当の応答が返ることを確認できます。

## 静的サイト側の設定

`site-config.js` の次の空欄へ、手動で値を入れます。

```js
contact: Object.freeze({
  endpoint: "https://script.google.com/macros/s/デプロイメントID/exec",
  turnstileSiteKey: "公開用のTurnstile Site Key",
}),
```

Site Keyは公開HTMLへ入る値です。TurnstileのSecret Key、GoogleフォームIDの認証情報、Apps Scriptの編集権限情報は静的サイトへ記載しません。

## 送信方式とCORS／リダイレクト

`contact-form.js` は、まず `text/plain` のJSONを `fetch` で送信します。カスタムヘッダーやJSONのContent-Typeによる事前リクエストを避けつつ、JSONの成功応答を確認するためです。

Apps ScriptのContent Serviceは応答を一時URLへリダイレクトすることがあるため、ブラウザがその応答をCORSとして読めない場合があります。その場合は同じ `requestId` の値で非表示iframeへ通常のPOSTを行い、GASが返す `postMessage` の結果を受け取ります。GAS側は同じリクエストIDを短時間キャッシュするため、応答だけが読めなかったときの再処理を抑えます。どちらの経路でも、Turnstile検証とGoogleフォーム登録はGAS側で行います。

## Turnstile設定

CloudflareのTurnstile管理画面で、実際に公開するホスト名のウィジェットを人間が作成します。静的サイトへはSite Keyだけを設定し、Secret Keyは上記の `TURNSTILE_SECRET` Script Propertyだけへ保存してください。GASは `https://challenges.cloudflare.com/turnstile/v0/siteverify` へサーバー側検証を行い、検証失敗・期限切れ・再利用トークンを受け付けません。

このリポジトリからウィジェット作成、Secret Key発行、Cloudflare設定、DNS変更は行っていません。

## 構造変更時の扱い

Googleフォームの質問タイトル、種類、必須設定、選択肢が変わると、`Code.gs` は安全側に倒して送信を停止します。質問項目を変更した場合は、`FORM_FIELD_DEFINITIONS` と許可リストを実際のフォームに照合してから更新してください。コード側で推測したタイトルへの自動フォールバックはありません。

## 現時点で未実施の確認

このリポジトリ作業では、Apps Scriptのデプロイ、Turnstileウィジェット作成、実際のフォーム送信、回答やSpreadsheetへのテスト登録を行っていません。これらは上記の手動設定後に、本番投入前の確認として実施してください。
