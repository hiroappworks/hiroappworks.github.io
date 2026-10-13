# Consignment Note 1.1.3 privacy policy — unpublished final wording candidate

Prepared 2026-10-13. Owner review and legal applicability checks remain. This is not publication, release, or a finding of legal compliance.

## Source and publication isolation

Application source: `hiroappworks/consignment-note`, Draft PR #29, `codex/posthog-surveys-20261011`, HEAD `ca64939ba6392cd86a90ce92a6500911d9d01a69`. The 30-event contract and current source take precedence over historical policy drafts. No application product code, collection gates, versions, dependencies, PostHog settings, ASC, or production data changed.

Web base: `3afb4014bb929b503061b17f93901a7d201cb185`; working branch `codex/consignment-privacy-v113-20261013`. Live GitHub Pages configuration was read: legacy build, `main`, `/`; no repository Actions workflows were present. Pushing this branch or opening its Draft PR does not update the configured public Pages source. Recheck that configuration before eventual merge/publication.

Final Japanese candidate: `consignment-note/privacy/index.html`.
Final English candidate: `en/consignment-note/privacy/index.html`.
Legacy URL copies: `consignment-note-privacy/index.html` and `en/consignment-note-privacy/index.html`.

The review-only note must be removed on authorized publication. Both last-updated dates stay September 22, 2026 until actual publication; update them together then. Do not publish the 1.1.3 wording as if 1.1.2 already sends new usage logs.

## Provider naming decision: C — applicability evidence is insufficient

The current-version narrative uses 「外部の利用状況分析サービス」 / “a third-party app analytics service”. Its privacy-policy link uses a generic visible label but leads to the actual provider policy. RevenueCat's existing purchase disclosure remains named. One historical PostHog mention remains inside “Earlier app versions”: removing it would obscure the known earlier recipient. This is not a conclusion that naming is legally mandatory only in that history section.

The following primary sources were checked:

- [Telecommunications Business Act enforcement regulations](https://laws.e-gov.go.jp/law/360M50001000025/), Articles 22-2-27 and 22-2-29. The official e-Gov law-data API was used to read the actual provisions because the HTML viewer did not expose their text to the browsing tool. Article 22-2-27 defines four covered service categories; Article 22-2-29 requires notification/publication to include sent information, the recipient handler's name, and purposes when this regime applies. A generic description alone would not satisfy the recipient-name requirement in an applicable case.
- [Telecommunications Business Act](https://laws.e-gov.go.jp/law/359AC0000000086/), Article 27-12, and [MIC external-transmission guidance](https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/gaibusoushin_kiritsu_00002.html). MIC page retrieval was blocked, so this review does not claim a complete reading of that page. The statutory text, not a secondary commentary, supports the requirements above.
- [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/), 5.1.1(i), 5.1.1(ii), and 5.1.2(i): data, uses, third-party protection, retention/deletion and sharing destinations must be explained; consent remains a separate release concern. These provisions do not establish that using a generic label always meets disclosure requirements, nor that a particular vendor name must appear repeatedly throughout the body.
- [PPC foreign-transfer guidelines](https://www.ppc.go.jp/personalinfo/legal/guidelines_offshore/) and [PPC APPI FAQ](https://www.ppc.go.jp/personalinfo/faq/APPI_QA/): applicable duties depend on personal-data / personal-related-information status, recipient handling, transfer arrangements and safeguards. A persistent identifier is not automatically outside all obligations merely because names and email addresses are absent.
- Provider identities in their public policies: [PostHog privacy](https://posthog.com/privacy), PostHog Inc. and affiliates; [RevenueCat privacy](https://www.revenuecat.com/privacy/), RevenueCat, Inc. The actual contracting/receiving entity for this account must be checked before presenting a legal-name disclosure as definitive.

The app's main service is local business-record management, not messaging, social posting or whole-web search. However, the exact classification of remote survey delivery and other information provision has not been authoritatively determined. Using an analytics SDK alone neither establishes nor disproves applicability. Accordingly **A (complete omission permitted) is not established**. If applicability is confirmed, **B (minimal independent provider disclosure required) follows**; until then the current conclusion is **C**.

Concrete owner action before publication: send MIC's relevant consultation service or qualified counsel a service-flow summary: offline business management, no account/login, remote optional fixed-choice surveys, analytics transmission and purchase validation; ask whether this operator/service falls within Article 27-12 and Article 22-2-27. Separately confirm account contracting entities, processing roles and cross-border safeguards. Do not infer these answers from the UI label or US Cloud alone.

### Conditional independent disclosure proposal — not inserted into HTML

Use only after applicability/recipient facts and owner choice are resolved. Keep the general narrative unchanged; avoid repeating names throughout it. If uncertain, Hiro may elect clearer recipient identification, but this is not proof of full statutory compliance.

Japanese proposed heading: **外部サービスについて**

> 利用状況の分析と任意アンケートには、PostHog Inc.のサービスを利用します。送信する情報は、この方針で説明した機能の利用状況、インストール内の識別子、表示言語などの技術情報、および本人が送信した選択式アンケートの回答です。当方はアプリ改善のために利用し、送信先はサービス提供・運用に必要な処理を行います。保存先は米国のクラウド環境です。利用状況の送信は設定から停止できます。アンケートは、共有設定とは別に本人が回答を送信した場合に送信されます。
>
> 購入状態の確認には、RevenueCat, Inc.のサービスを利用します。購入情報、サービスの識別子、アプリ・端末の技術情報を、購入・復元・Pro権利の確認とサービス運用のために取り扱います。決済はAppleが行います。

English proposed heading: **External service providers**

> We use PostHog Inc.'s service for app usage analytics and optional surveys. Information sent includes the feature usage, installation identifier, display language and technical information described in this policy, and multiple-choice answers you submit. We use it to improve the App; the recipient processes it as needed to provide and operate the service. The storage environment is in the United States. You can stop usage sharing in Settings. Survey answers are sent separately when you choose to submit them, regardless of the usage-sharing setting.
>
> We use RevenueCat, Inc.'s service to check purchases. Purchase information, service identifiers, and app and device technical information are handled to support purchases, restoration, Pro access, and service operation. Apple processes payments.

This conditional text requires recipient-entity and recipient-purpose verification. A more complete external-transmission table may be required by the applicable regime. It is not a substitute for resolving applicability or consent.

## Meaning and implementation reconciliation

| Topic | Japanese / English candidate | Verification boundary |
|---|---|---|
| Business records | Device-local product, stock, sales, settlement and photo data; no analytics upload of their contents | Preserves existing storage, sharing, CSV and backup explanations |
| 30 events | Feature categories rather than technical event-name list | Frozen contract; no added collection |
| Continuity | Installation identifier links usage across ordinary restarts/updates and OFF→ON | No absolute anonymity claim; no user ID/copy UI |
| Choice | Default ON; Settings OFF persists; no feature/Pro restriction or old unsent-log replay | Owner choice retained; Apple consent compliance not certified |
| Surveys | Optional fixed choices, independent response identity, explicit sending even when usage OFF; availability checks communicate | No free text/photos; no claim that usage OFF stops survey service communication |
| Unknown delivery | User may end without resending; no success/deletion implication; other surveys remain usable | No technical checkpoint or retry jargon in general text |
| Retention / IP | US Cloud; seven-year search/analysis window; production stored-event IP discard distinct from network/security handling | No guarantee of seven-year physical erasure of all copies/logs/backups |
| AI / providers | Production external AI and internal-training settings OFF; necessary service operation / subcontracting | Existing verified settings reused; no settings changed |
| Deletion | Existing contact, available evidence and applicable law; inability to identify every anonymous record from name/email alone | No universal individual-deletion promise; no denial of applicable rights |
| Historical versions | 1.1–1.1.2 new usage logs disabled; earlier configured builds' limited transmission preserved | Old memory persistence, exclusions and OFF-not-deletion facts retained |
| Purchases / files | RevenueCat and App Store; local photos; user-selected CSV/backup sharing, manual restore | No new iCloud capability asserted; no payment/business logic changed |

Editorial review covered first-time users, makers managing consignment sales, privacy-conscious readers and App Review readers. This is a drafting review, not external reader research or Apple acceptance. Wording avoids SDK/API/event/UUID/ACK terminology in new general-user sections; a few existing purchase/storage terms remain to preserve the earlier facts. No suggestion that screen tracking is enabled or that no information ever leaves the device.

## Checks actually performed

- Four HTML files: balanced element structure, unique/preserved anchors, existing local asset/navigation/fragment destinations, unchanged dates and Japanese/English legacy-copy article parity PASS.
- Existing Web regression suite: 18 tests PASS; no app unit suite rerun because application source is unchanged.
- In-app browser local preview: Japanese and English at actual **1280×720**, nonblank page, readable sections, table-of-contents navigation, legacy disclosure expansion and language switching both ways; no captured error/warning console entries. No horizontal document overflow observed.
- **Initial iPhone-width visual QA was unverified** (resolved by the final pass below): supported viewport requests for 390×844 returned without an error but actual DOM and screenshot stayed 1280×720. No mobile PASS claim; do not substitute a cropped desktop screenshot for a mobile layout. Existing responsive CSS was not changed. Hiro can verify both unpublished local HTML pages at phone width, or a later supported responsive-browser session can complete this check before publication.
- Local preview served the original page with its existing website analytics beacon omitted only in the preview response, to avoid recording QA traffic. The committed script is unchanged.
- `git diff --check` PASS; no new credentials, app tokens, internal IDs or user records in this patch. Existing public contact and site-beacon configuration remain untouched.

## Publication gates and next owner decisions

1. Review Japanese/English copy and decide the provider naming approach after the applicability check. Current naming result C is a publication HOLD, not an asserted exemption.
2. Phone-width browser QA is complete in the final pass below. Preserve contact, language switching, anchors and SEO on publication; no unrelated pages should change.
3. Verify recipient contracts / deletion and service-log scope where needed; seven years describes the query window, not universal erasure.
4. Keep the existing Apple default-ON consent issue visible in developer release records. The owner's adopted behavior is unchanged and not presented as Apple-approved.
5. Only with separate publication authorization: remove the review notice, set actual update dates, resolve any necessary independent provider disclosure, and merge to the configured Pages branch. No publication or merge is performed in this task.


## Final wording and mobile display pass — 2026-10-13

Owner accepted the existing candidate and requested one sentence removal only:

- Japanese: removed 「識別子や受付番号を画面に表示・コピーする機能はありません。」
- English: removed “The App does not display or offer copying of identifiers or receipt numbers.”

The rest of the general-user copy is unchanged. This is removal of an unnecessary UI implementation explanation, not removal of the disclosures of persistent installation identity, linked usage history, separate survey response identity or device-local response/skip/acceptance state. No ID UI was added and no app code changed. Both legacy URL copies match their canonical articles.

### Actual mobile-sized browser verification

The Codex in-app browser viewport override now applied correctly. No Playwright browser installation or dependency was added. The installed Playwright package had no installed browser engines, so it was not used; the in-app browser itself completed the responsive checks.

| Language | Requested and observed viewport | Screenshot pixel dimensions | Document scroll width | Horizontal overflow / clipped article blocks |
|---|---|---|---|---|
| Japanese | 375 × 812 | 375 × 812 | 375 | None |
| English | 375 × 812 | 375 × 812 | 375 | None |
| Japanese | 390 × 844 | 390 × 844 | 390 | None |
| English | 390 × 844 | 390 × 844 | 390 | None |
| Japanese | 430 × 932 | 430 × 932 | 430 | None |
| English | 430 × 932 | 430 × 932 | 430 | None |

Viewport width was read from the rendered document; screenshot width/height were independently decoded from the screenshot bytes. These are genuine responsive viewports, not desktop crops. Representative title, contents and survey-body screenshots were visually inspected and shown in the QA session. Japanese and English text wraps within the cards with readable spacing; sampled article paragraph size is 15.2px at all three widths. No unexpected background, padding, title or link overflow was observed.

The contents anchor navigation, history disclosure expansion and Japanese-to-English language selection were exercised at each width; English-to-Japanese return was also verified. Contact anchor navigation and the visible mail link (`mailto:contact@hiroappworks.com`) were checked in representative Japanese/English conditions. No email was opened or sent. No captured warning/error console entries. This is browser-responsive QA, not owner physical-iPhone acceptance.

HTML structure, local links/fragments, preserved unique anchors, existing dates, and alias article parity PASS. Existing Web regression tests **18/18 PASS** in this pass; diff check PASS. No application unit suite rerun and no CI PASS inferred. Metadata, design/CSS, language script, inquiry destination, publication dates and unrelated pages are unchanged.

### Final review status

Wording and mobile browser display are ready for Hiro's final review; do not continue optional polishing. Provider-name applicability remains **C** with the independent conditional disclosure retained above. Historical PostHog mention and provider privacy link are protected. No legal re-audit or new exemption conclusion was made. Existing owner default-ON choice and unresolved Apple consent issue are unchanged.

Public main, public website, app Draft PR #29, PostHog and ASC are not modified by this final pass. Before separately authorized publication: owner approves the wording and resolves any necessary provider-name disclosure; remove the review-only notice and update both dates to the actual publication date. This pass does not authorize merge or publication.


## Owner-requested history simplification — 2026-10-14 (unpublished)

Supersedes the historical-PostHog-mention protection in the earlier review above: remove the whole “Earlier app versions / 以前のバージョンについて” disclosure from all four pages. Keep only a concise applicability note for usage analytics and optional surveys in1.1.3 and later. Augment the existing no-auto-deletion sentence with app updates; do not duplicate it. Other current collection, business-data exclusion, identifier, opt-out, optional answer, US/seven-year/IP/deletion/support and RevenueCat paragraphs and provider privacy links remain unchanged. Dates stay October13 until separately approved publication.

Provider naming classification remains C; the independent conditional disclosure proposal earlier in this document is preserved. Public body text has no PostHog name; the existing https://posthog.com/privacy link is retained. No new legal exemption or applicability conclusion.

QA:169 existing Web regression tests PASS; four-page HTML nesting/IDs/local-links/anchors/date checks and canonical/alias article equality PASS; all non-target paragraphs preserved. In-app browser responsive CSS viewport375/390/430px verified in Japanese and English, no horizontal overflow/clipped text blocks. Screenshots cover the scrollable content region (15px scrollbar excluded); do not describe these as full-width device screenshots. Language switching in both directions, contents anchor navigation and contact-page access checked; no recorded warning/error console entries. Browser plugin absent; installed standalone Playwright had no engine in the previous environment, so the supported in-app viewport and browser inspection were reused without dependencies. This is responsive browser QA, not a physical-iPhone acceptance. Main/deployment and app/ASC/PostHog/build21 unchanged.
