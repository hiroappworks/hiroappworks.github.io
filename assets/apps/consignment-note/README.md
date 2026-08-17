# 委託販売ノート Web素材

このフォルダの画像は、`/Users/hiroaki/Documents/SalesLocationLedger/` 内の素材から作成したWeb表示用の軽量派生画像です。移管元のファイルは変更・移動・削除していません。

## アプリアイコン

- Web: `app-icon.webp`（512 × 512、WebP quality 90）
- 元: `ios/app/Images.xcassets/AppIcon.appiconset/ChatGPT Image 2026年8月11日 14_42_28.png`
- 元SHA-256: `314488b92ba5b41147960163d0a49b45c43c4cfd669f20f4fa54b3e737225395`
- 根拠: 同フォルダの `Contents.json` が、iOS universal 1024 × 1024 AppIconとしてこの画像を参照

`assets/images/icon.png` はExpoの「A」マークで、ネイティブAppIconと一致しないためWebサイトには使用していません。

## 画面画像

元フォルダ:

`App Store掲載スクショ/最終候補_6.9inch_2026-08-12/`

同フォルダのREADMEには、全6枚がiPhone 17 Pro Max Simulatorから取得した1320 × 2868 pxの生画面キャプチャであり、App Store提出用の最終候補であることが記録されています。Webでは必要な4画面だけを660 × 1434へ縮小し、WebP quality 86で保存しています。UIの合成・文字入れ・トリミングは行っていません。

| Web | 元ファイル | 元SHA-256 |
| --- | --- | --- |
| `screens/home.webp` | `05_ホーム.png` | `dbe5689e864061d14becfc6520fb8a5a1bc35182ee416fb5ce21abb496f40830` |
| `screens/locations.webp` | `04_販売場所.png` | `2953542ec2a0bc84d24b5c02a941a13abddc4256acd368f8c13f838ca84b4aff` |
| `screens/remaining-count.webp` | `01_残数記録.png` | `796a869b4ab8908d5e44f9fda5bbc20d63d84f5a797469b23fdb729baa8d20f3` |
| `screens/settlement.webp` | `03_精算.png` | `aabb912622ec02706009f8e6a0de35437dd294d00acb397cf70f27e6af7f0f2d` |

残りの `02_商品一覧.png` と `06_Pro分析.png` は、今回のストーリーに不要なためコピーしていません。
