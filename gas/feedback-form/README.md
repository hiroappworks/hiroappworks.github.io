# 返信不要のご意見・ご要望フォーム（owner-run setup）

委託販売ノート専用の保存先を作る独立したApps Scriptです。既存 `gas/contact-form/`、既存フォーム、回答シート、公開デプロイは変更しません。このコードはWeb受付APIではありません。

## 実行方法

事業用アカウントの今回専用スタンドアロンプロジェクトに `Setup.gs` を保存し、初回だけGoogle Forms権限を承認します。管理URL・実IDはrepository外の引き継ぎ記録に保存します。再開時に新しいプロジェクトを作らないでください。

1. `setupFeedbackForm_`：初回のみ未公開フォームを作成し、作成直後に `FEEDBACK_FORM_ID` をScript Propertiesへ保存します。段落必須質問1件と設定を作り、`FEEDBACK_ITEM_ID` と完了印を保存します。
2. `verifyFeedbackForm_`：保存済みIDだけを開いて構造・設定を検査します。フォームや質問を追加せず、回答投稿・削除も行いません。
3. `saveQaResponsesOnce_`：明示的なQA操作です。日本語・英語各1件を保存して再読取り比較し、メール情報が空であることを検査します。QAマーカーと回答IDをScript Propertiesに保存します。再実行では同じ回答を確認し、部分失敗時もマーカーで重複投稿を避けます。回答は保持します。
4. setup再実行後も同じForm ID・Item ID・質問数1・QA件数2であることを確認し、Googleフォーム管理画面の回答側でも保存を確認します。

作成開始印だけが残った場合は、新規作成を停止します。今回の作成経緯と所有者を確認し、既に作られたフォームのIDを復旧してください。同名検索だけで既存フォームを流用しません。

## 設定と検証上の注意

- 本文1欄、段落形式、必須。文字数validatorを付けず1文字も許容する設計です。
- 名前・メール・カテゴリ・言語等の追加質問なし。メール収集、1回答制限、回答編集、回答概要、クイズはOFF。
- 初期状態は `FormApp.create(title, false)` で未公開。未公開でのowner GAS保存可否は実サービスで確認が必要です。保存に公開が必要な場合も自動公開せず、今回専用フォームだけを対象に設定・確認します。
- ログイン不要・回答者アクセス・編集共有権限はGoogle管理画面でも確認してください。deprecatedな `setRequireLogin` は使いません。
- 既存回答シートとの接続、メール送信、トリガー作成、回答削除、外部fetchはありません。
- 実行ログは設定・管理ID・検証結果のみ。投稿本文やメールは出力しません。
- Script Propertiesを消すと安全な再開に必要な記録を失います。公開repoへ実IDや資格情報を追加しないでください。

## 未完成の範囲

2026-09-07に実サービスで完了：専用フォーム1件、段落必須質問1件、日英QA各1件をメール情報なしで保存し、FormResponse再読取りとフォーム回答画面で確認しました。setup再実行でも同じForm ID・Item ID、質問1件・回答2件を維持しました。

未公開・受付停止での `FormResponse.submit()` は拒否されました。そのため、この新規フォームだけをGoogle管理画面で公開・受付ONにし、保存確認を完了しました。回答者はリンクを知っている全員、編集者ビューは制限付き、アクセス一覧は事業用オーナー1人だけです。Web掲載・告知・デプロイ・通知はしていません。setup完了後の再実行は公開状態を書き換えません。

今回の実測では、作成後のファイル名が画面に表示されても `getTitle()` が空でした。初期設定途中で空の場合のみ明示的にタイトルを設定します。また `getEditors()` は今回オーナーを含む1件を返したため、件数0を共有安全性の条件にせず、管理画面で所有者・編集者の一般アクセスを別途確認します。

ログイン必須・1回制限OFFと回答者の一般アクセスは設定画面で確認済み。独立した未ログイン環境からの送信は未実施です（別ブラウザにもGoogleログインがあったため、未ログイン実測とは扱いません）。今回の保存テストはowner GAS経由であり、後続のWeb受付実送信とは別です。

Webの本文入力画面、公開用GAS受付、スパム対策、二重送信対策、運営者通知、日英Web実送信、アプリ導線は別工程です。`FormResponse.submit()` はフォーム送信トリガーを自動発火させる前提にしません。

## 公式資料（2026-09-07確認）

- [FormApp](https://developers.google.com/apps-script/reference/forms/form-app)
- [Form](https://developers.google.com/apps-script/reference/forms/form)
- [FormResponse](https://developers.google.com/apps-script/reference/forms/form-response)
- [Forms REST APIの公開状態変更](https://developers.google.com/workspace/forms/api/guides/api-changes-to-google-forms)（Apps Script APIと区別）
- [Installable triggers](https://developers.google.com/apps-script/guides/triggers/installable)

---

## Web受付のローカル実装（2026-09-07追加・未公開）

**現在：管理関数のprivate化とiframeローカル回帰はGO、Google上への反映・公開は未実施です。** 管理者用の入口は `setupFeedbackForm_` / `verifyFeedbackForm_` / `saveQaResponsesOnce_` に改名しました。基本ロジックは変えず、内部呼び出しだけを更新しています。公開トップレベル関数は受付の `doGet` / `doPost` の2つだけです。管理者の手動実行とWeb受付を分離し、Web要求からsetup・verify・QAへ分岐しません。末尾 `_` の関数を実エディタで選択・手動実行する具体的手順は未確認です。実行を簡単にするための公開wrapper、alias、任意関数名dispatcherは追加しないでください。

前回HOLDの履歴：公開名の管理関数3つとHtmlServiceが併存すると `google.script.run` から管理処理を呼べる懸念があったため、受付側の安全gateで遮断しました。今回、ユーザー承認によるprivate化だけでgateが通ることを確認し、**Code.gsの安全gateは変更していません**。旧公開名の復活はgateが遮断し、別名の公開wrapper/aliasは配置予定全.gsの公開範囲回帰テストで検出します。Google公式仕様とソース公開範囲・mock副作用の確認が根拠であり、実Google RPCの拒否を実測したという意味ではありません。

後続反映ではSetup.gsとCode.gsを必ず整合する版で配置し、古い公開名の管理関数を含む別ファイルをデプロイ対象へ混ぜないでください。新プロジェクト・フォームの作り直しは不要です。今回、Google上のコード・Script Properties・権限は変更しておらず、レビュー後の別工程で反映と実サービス確認を行います。

上の「未完成の範囲」はsetup工程当時の記録として維持しています。今回の追加は日英画面・専用受付・mock検証だけです。**Google上へのコード反映、権限・Properties変更、デプロイ、回答追加、メール送信、Web公開は未実施**です。既存QA回答2件の保存確認は前工程の結果であり、今回は再実行していません。

### ファイルと役割

- `/consignment-note/feedback/index.html`：日本語、`/en/consignment-note/feedback/index.html`：英語。同じ保存先を利用し、利用者の入力欄は段落本文1つだけです。
- `/feedback-form.js`：検証・送信中ガード・確認済み応答による成功表示・再試行。`/feedback-form.css`：このページだけの装飾。共通CSSを変更しません。
- `/feedback-config.js`：独立した `window.HIRO_FEEDBACK_CONFIG`。endpoint・sitekey・responseOriginは空のままです。endpoint/sitekey未設定時は準備中、送信不可、Turnstileのscriptも読み込みません。
- `Code.gs`：既存の専用GASプロジェクト向け受付です。今回安全gateは不変で、iframeのHTMLフォーム送信がLFをCRLFへ変換する不整合だけを読取り境界で補正しました（下記）。private化済みSetupとの整合版だけを後続工程で反映します。返信ありの `gas/contact-form/Code.gs` と併置しないでください（双方にdoPost/doGetがあります）。受付helperは `fb..._` / `FB_` 名でsetupのグローバル名と分離しています。
- `Setup.gs`：owner-run処理の関数3名と内部参照だけをprivate化。受付からsetup・QA投稿・フォーム自動作成・質問修復を呼びません。今回の管理処理検証はmockだけで、実Google上では実行していません。
- `tests/feedback.test.cjs`、`tests/feedback-harness.cjs`：Node標準テストとGoogle/Turnstile/Mailのmock。
- `tests/feedback-browser.cjs`：localhost静的サーバー＋既存Playwrightでの日英操作確認。外部リクエストを遮断しmock応答に置換するテスト専用コードです。本番ページにmock分岐はありません。

言語切替は2ページを直接結ぶ通常リンクです。既存 `language.js` の未登録ルート処理を流用せず、言語設定やCookie/localStorageも書き換えません。既存contact設定・共通CSS・既存ページ・Google側の設定には手を加えていません。

### 既存保存先・必要なScript Properties

実Form ID・Item ID・Apps Script project ID・管理URLは、repository外の `HiroAppWorks/FeedbackSetup/consignment-note/20260907-204325/FEEDBACK_FORM_SETUP.md` を正本として参照してください。新しいフォームを作り直したり、公開回答URLのIDをForm IDとして転記したりしません。

| キー | 値・役割 | 現状 |
| --- | --- | --- |
| `FEEDBACK_FORM_ID` | 既存setupが記録した専用フォームの管理ID | 前工程で設定済み、変更しない |
| `FEEDBACK_ITEM_ID` | 既存の必須段落質問の数値Item ID | 前工程で設定済み、変更しない |
| `FEEDBACK_TURNSTILE_SECRET` | Siteverify用secret | 次工程で安全に設定、フロントへ出さない |
| `FEEDBACK_ALLOWED_HOSTNAMES` | 完全一致で許可するhostnameをカンマ区切り。例 `hiroappworks.com`（URL/path/wildcard不可） | 次工程で確認・設定 |
| `FEEDBACK_PARENT_ORIGIN` | Webの正確なHTTPS origin。例 `https://hiroappworks.com`。JA/ENとも同一origin | 次工程で確認・設定 |
| `FEEDBACK_NOTIFICATION_EMAIL` | 運営者の固定メール1件。候補 `contact@hiroappworks.com` | 次工程で承認・設定・到達確認 |
| `FB_RECEIPT_<requestId>` | 受付が生成する最小の重複防止記録 | 本文・token・宛先を含まない、手動入力不要 |

設定欠落・不正な保存先構造はfail closedです。質問ID、質問総数1、段落型、必須、メール非収集、回答受付ONを確認してから保存します。フォームを自動修復しません。

### 公開側設定と権限（まだ反映しない）

`feedback-config.js` に設定するのは、専用GAS web appの `/exec` endpoint、公表可能なTurnstile **sitekey**、およびiframe応答の正確なHTTPS `responseOrigin` だけです。Secret、Form ID、Item ID、通知先、GAS管理URLは埋め込みません。endpointは `https://script.google.com/macros/s/<deployment-id>/exec` 形式だけを許可します。既存返信あり受付のendpointを流用しないでください。

必要なGAS権限は、既存フォームへ保存するForms権限、Siteverifyの外部fetch権限、運営者通知のMailApp権限です。明示scope管理の場合の候補は `https://www.googleapis.com/auth/forms`、`https://www.googleapis.com/auth/script.external_request`、`https://www.googleapis.com/auth/script.send_mail`。新しいGmail/Drive/Sheets権限やトリガーは不要です。反映後にApps Scriptの実際のscope表示を確認し、事業用所有者が承認します。

将来のWebアプリは既存専用プロジェクトで「所有者として実行」し、Google未ログインの利用者から送信できるアクセス設定を別工程で確認します。編集権限やフォーム回答閲覧を一般公開する必要はありません。今回これらを設定したとは扱いません。

### 検証・送信データ・スパム対策

WebからのPOSTは `message / locale / requestId / turnstileToken / honeypot / transport` だけ。Googleフォームへ保存するのは外側をtrimした本文だけです。localeはページの固定ja/enであり、機器から自動取得しません。改行・絵文字・句読点・HTMLのような文字列もテキストとして保持します。textareaとGASは同じUTF-16 code unit基準の5,000上限（絵文字等は2以上の場合あり）、1文字から許可します。trim前の上限も検査します。

サーバーで許可キー・文字列型・空欄・上限・UUID v4・token最大2,048・locale・空honeypot・transport・100,000上限のPOSTサイズを検査します。平坦な文字列JSONの厳密parserにより重複キー（エスケープ表記含む）、配列、数値、ネストを拒否。URLエンコードPOSTも重複/不正encodingを拒否します。queryに情報を載せず、GETから設定・ID・回答を返しません。

Turnstileは専用widget/action `feedback` を使用します。Siteverifyのsuccessが厳密なtrue、hostnameが設定と完全一致、actionがfeedbackであることが必須です。Secret未設定、検証エラー、通信例外、失効tokenは一切保存しません。検証を省略するfallbackや本番テストtoken特例はありません。画面の期限切れ・エラー・timeoutで送信を止め、確認をやり直せます。compactサイズで小型画面の幅を確保します。

Turnstile tokenは短時間・単回利用です。受付済みID/同内容の再試行は保存記録を先に確認し、使い切ったtokenを再検証しません。未知のIDは必ず検証します。Cloudflare APIへremoteipは渡しませんが、ブラウザによるwidgetアクセスに必要な通信まで「情報を一切送らない」とは説明しません。今回の新規画面には解析beacon・セッション録画・操作ログを追加していません。

Googleフォームの**直接回答URL**はWebからリンクしません。この専用Web受付のTurnstileは、Googleフォーム直接URLからの投稿を防ぎません。前工程でフォームが公開・受付ONになっていることとは別の防御範囲です。直接URLの扱い・スパム状況は運用上の確認事項です。

### 重複防止の順序・保持期間・限界

フロントの送信中フラグを同期的に立て、本文をreadOnlyにします。同じ本文・localeの再試行は同じUUID v4をメモリ上で再利用し、異なる内容の送信時は新しいIDにします。fetch→iframeも同じIDです。本文/IDのCookie・localStorage保存や継続追跡は行いません。ページ再読み込み・別タブではIDを引き継がないため、そこをまたぐ重複防止は保証しません。

受付はScriptLock（取得待ち最大1秒）内で同じIDの `SHA-256([locale, trimmed message])` を確認します。同ID・異内容はconflict。既存acceptedは保存・通知なしで成功を返し、既存pendingはresult_unknownとして自動保存を止めます。

処理順は **検証→pending記録→FormResponse.submit→accepted記録→通知を1回試行→保存成功応答** です。

- receiptはfingerprint・状態・時刻だけをScript Propertiesへ保存。生本文・token・メール・FormResponse本文を記録しません。
- TTLは作成時刻から24時間、最大1,000件。次の受付時にlock内で期限超過の `FB_RECEIPT_` キーだけを削除します。投稿がない間は物理削除が遅延します（24時間ちょうどの自動消去ではない）。定期トリガーを作りません。上限に達したら受付busyで失敗させ、無制限に蓄積しません。setup用Propertiesは消しません。
- 不正receiptは勝手に消して再受付せず安全に停止。運営者が状況を確認してください。
- FormsとPropertiesは別ストレージのため、完全なexactly-onceではありません。pending後・submit前の停止、submit結果不明、submit成功後・accepted記録前の停止ではpendingが残る可能性があります。同じ送信は自動で再保存せず、運営者がGoogleフォーム回答側を確認します。サーバーは本文をreceiptに持たず、requestIdもフォーム質問へ追加しないため、本人の投稿を一意に照合できる保証はありません。
- submit自体がthrowした場合も「必ず未保存」と断定できず、result_unknown・通知なしとします。画面は本文を残して重複再投稿を控える案内に切り替えます。これは一般の一時的な通信失敗（同じIDで再試行可能）と区別します。
- submit成功を認識後にaccepted書込みだけが失敗した場合、最初の応答は保存成功とし、通知は行わず固定運用コードを記録。次の同ID要求はpendingとして止まる場合があります。
- TTL後の同ID送信は新規扱いになり得ます。24時間を超える再試行やpendingの安易な手動削除は重複のリスクがあります。保存内容を確認せずreceiptだけ削除して再送しないでください。自動の大規模キュー・新DBは導入していません。
- Script Propertiesの容量/読書きquota、Forms/Mail/UrlFetch/実行時間quotaはGASプランに依存します。1,000件上限はquota無制限の意味ではなく、公開後の運用監視・上限見直しは別判断です。

### 通知の保証範囲

通知先はScript Propertiesだけから取得します。件名は `【委託販売ノート】新しいご意見・ご要望`。本文は新着案内とフォーム回答管理画面リンクのみで、投稿本文は複製しません。投稿者への受付メール・返信はありません。

MailAppは保存・accepted確定後に明示的に呼びます。`FormResponse.submit()` がonFormSubmitを自動発火する前提にはしません。通知失敗/メールquota不足でも回答を削除せず保存成功を返します。同じaccepted IDの再試行で再通知しません。通知前の停止も含め、メールの必達は保証せず自動再試行トリガーもありません。運営者はGoogleフォームで回答を確認できます。

運用ログは `feedback_notification_failed` / `feedback_receipt_write_failed` の固定コードだけ。生例外・投稿本文・token・メール・管理IDをログや投稿者responseへ出しません。ログの通知失敗は「回答未保存」ではありません。

### 通信方式・実デプロイで残る確認

まずtext/plain JSONのcors fetchでContentService応答を確認します（credential omit、redirect follow、12秒のAbortController）。no-cors/opaque、JSONP、URL queryへの本文格納、架空のContentService CORS APIは使いません。Siteverify側のUrlFetchAppには任意timeoutオプションを追加していません。ブラウザのtimeoutはGoogle側処理の停止を保証しないため、遅れて保存された場合も同じIDで確認します。

private化済みSetup併置構成で、fetch応答を確認できない場合に同じID・本文・tokenでhidden form/iframe POSTへ切り替える経路をmock確認しました（25秒timeout）。`responseOrigin` が設定済みの場合だけ有効です。本番configは空のまま維持しています。公開設定へ実測前のGoogle originを推測で入れないでください。responseOrigin未設定ならfallbackせず本文を保持して通信結果不明と表示します。

今回のブラウザ回帰で、改行入り本文だけが同ID再試行時にconflictになることを確認しました。原因はnative HTMLフォームPOSTのLF→CRLF変換です。URLエンコードされたiframe要求の読取り時に限りCRLFをtextareaのLFへ戻してから、既存の文字数検証・fingerprint・保存処理へ渡します。改行位置・本文・絵文字は維持し、追加されたCRによって5,000文字境界の本文が拒否されることも防ぎます。JSON fetch経路、検証条件、Turnstile、安全gate、保存・通知順序、重複防止TTL/上限は変更していません。改行を含む上限ちょうどと上限超過を追加テストしています。

iframe結果は正確なorigin、送信先iframeそのものまたはその子孫Window（最大4段の親参照）、requestId、固定type、ok/code、余分なフィールドのない構造を全て検査します。GASは許可されたWeb originへ `window.top.postMessage` を送り、本文・secretをresponseへ含めません。script内の機械値も `<>&` 等をescapeします。無関係なwindow messageを成功扱いにしません。

**Googleの実際のHtmlService iframe階層・応答origin・redirect/CORS・Safari挙動は未確認**です。今回の最終mockはSetup.gsとCode.gsを必ず同じグローバル領域で読み込み、Setupを省略する例外を廃止しました。日英・desktop/320pxで、保存後fetch応答消失→同IDのiframe再試行→保存/通知増殖なしを確認します。不正origin/source/ID/構造のmessageでは成功せず、正当なiframe応答後だけ成功表示します。実環境でも別途確認し、origin wildcard/source検証省略へ安易に緩めません。

### ローカルテスト

Web repositoryのルートで実行します。追加npm packageやbuild frameworkはありません。

```bash
node --test tests/feedback.test.cjs
node --check feedback-form.js
node --check feedback-config.js
```

97ケース：前回79件の検証目的を維持し、全.gs公開範囲・旧名/alias/wrapper検出・管理操作指定の拒否・管理関数の再実行/QA非増殖/空タイトル補正・private化済みSetup併置でのiframe保存/失敗/通知回帰・nativeフォームの改行変換と5,000文字境界を追加しました。名前変更を元に戻したSetupのSHAは前工程と一致し、管理ロジック不変も検査します。Googleサービス・Siteverify・MailAppはVM内mockのみです。Nodeからprivate関数を直接実行できることはGoogle RPC非公開性の実測ではありません。

既存Playwright環境が利用可能な場合（新規インストールは不要）：

```bash
# PLAYWRIGHT_MODULEは利用可能な既存playwright moduleの絶対パス（通常解決できる場合は省略）。
# Chrome installed channelを利用する場合だけPLAYWRIGHT_CHANNEL=chrome。
PLAYWRIGHT_MODULE=/path/to/existing/playwright PLAYWRIGHT_CHANNEL=chrome \
  node tests/feedback-browser.cjs
```

テストがlocalhost HTTPサーバーと独立ブラウザcontextを起動・終了します。前回の日英×1280/320px・36シナリオを維持し、各組合せにiframe自動再試行と不正応答無視→正当応答で成功の2件を追加し、計44シナリオです。Google/Cloudflareのリクエストは全てinterceptしてmock化し、その他外部リクエストはabortします。iframeケースだけmockのresponseOriginを配信設定に差し込み、空の本番configと既存gateを変更しません。実サービスのiframe階層を再現できたという主張ではありません。

画像は自動生成のOS一時ディレクトリ、または `FEEDBACK_SCREENSHOTS` で指定したrepository外のディレクトリへ保存します。画像にはローカルQA本文とmockの表示のみ。実フォーム本文は使用しません。通信失敗テストに対応する `net::ERR_FAILED` は意図したエラーとして個別計数し、それ以外のconsole error・runtime error・予期しない外部要求は失敗にします。

既存contactコードのSHAテストは今回の変更境界を固定する回帰検査です。後続の承認済みcontact改修では、その変更をレビューしたうえで基準値を更新してください。テストを通すために既存機能を弱めないでください。

### 公開前のWebプライバシー文面 最小追記案（本文・日付は今回は未変更）

この受付はアプリ内部の行動計測ではなく、利用者がWebで任意に入力する意見です。既存の「お問い合わせへの回答」という目的だけで十分とせず、日英の目的/保存先/検証データの説明と整合させてください。追記位置と適用日は公開前レビューで確定します。

日本語案：

> 返信不要の「ご意見・ご要望」フォームでは、利用者が入力した本文をGoogleフォームに保存し、アプリの改善の参考にします。名前・メールアドレスの入力は求めず、個別の返信は行いません。不正送信や重複送信の防止のため、ページ言語、送信単位の識別子、本文等から生成する照合値、受付状態・時刻、Cloudflare Turnstileの検証情報を処理します。重複防止記録は原則24時間を有効期間とし、期限を過ぎた記録は次の受付処理時に削除します。投稿本文は運営者への通知メールには含めません。

English draft:

> For the no-reply feedback form, we store the text you submit in Google Forms and use it to help improve the app. We do not ask for your name or email address and do not send individual replies. To prevent abuse and duplicate submissions, we process the page language, a per-submission identifier, a fingerprint derived from the submitted text and language, the submission status and timestamp, and Cloudflare Turnstile verification information. Duplicate-prevention records are valid for 24 hours and expired records are deleted during the next submission-processing operation. The submitted text is not included in notification emails to the operator.

これは最小追記候補です。Google Forms本文自体の保存・削除運用、Turnstileの事業者説明/リンク、既存ポリシーとの重複、受付連絡先を併せて確認してください。24時間は回答本文の保存期間ではありません。「完全匿名」「アプリから外部送信なし」「直接GoogleフォームにもTurnstileが適用」等とは記載しません。

### 次工程の公開ゲート

1. 今回のprivate化・iframe回帰を含む差分をレビュー・保存し、別工程で専用GASへ整合版を反映する。古い公開管理関数が残っていないこと、実クライアントから管理関数が呼べないことを確認し、必要scopeだけを承認する。今回Google上には反映しない。
2. 専用Turnstile widgetのhostname/actionとsitekey/secretを確認。Script Propertiesへ固定通知先等を安全に設定。既存返信ありwidget/受付は変更しない。
3. 専用Webアプリの実行者/匿名アクセス/公開デプロイURLを確認。管理URLではないendpointを設定。
4. HtmlServiceの実origin/iframe ancestryを確認してresponseOriginを設定。ブラウザmock成功を実GoogleのCORS/Safari検証と取り違えない。
5. 日英Webプライバシー追記・公開時期の承認。未確定値を本番configへ混ぜない。
6. 別工程で日英・未ログイン・Safari等の実送信、Googleフォームへの実保存、運営者通知到達、重複再試行、token失効・通知失敗時の挙動を確認。QA本文を明示し既存回答を削除しない。
7. 上記GO後に、既存お問い合わせフォームの日英アプリ指定、アプリ設定の「ご意見・お問い合わせ」を別差分で実装。

今回は公開、Google反映・投稿、実メール、トリガー、Cloudflare設定、App Store操作、アプリ改修、commit/pushを一切行っていません。

### 追加公式資料（2026-09-07確認）

- [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)：server必須、期限・単回利用、hostname/action。
- [Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)：本番設定と検証用の区別。今回のテストは公式テスト鍵による実通信ではなく完全mock。
- [ContentService / redirects](https://developers.google.com/apps-script/guides/content)：googleusercontentへのredirect。独自CORSヘッダーAPIを仮定しない。
- [UrlFetchApp](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app)：Siteverify送信、利用可能なオプションとscope。
- [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app)：保存後の明示的な運営者通知。
- [Installable triggers](https://developers.google.com/apps-script/guides/triggers/installable)：スクリプト/APIによる送信でtriggerが発火する前提を置かない。
- [GAS quotas](https://developers.google.com/apps-script/guides/services/quotas)：Properties・メール・実行等の制限。quotaの増量/新規契約は行わない。
- [HtmlService server communication / private functions](https://developers.google.com/apps-script/guides/html/communication#private_functions)：末尾underscoreの管理関数はgoogle.script.runから呼べないという公式仕様。前回HOLDの根拠と、今回private化の根拠。実Google上の拒否確認は次工程です。
