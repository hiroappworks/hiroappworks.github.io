# Hiro App Works Xプロフィールバナー

Xプロフィール用の独立バナー制作物です。OGP本体とRootサイトのソースにはリンクしておらず、`assets/brand/ogp.png` と `ogp/` 以下のファイルも変更しません。

## 出力

- `../assets/brand/x-profile-banner.png`
- 1500 × 500px PNG

X公式ヘルプの推奨ヘッダーサイズに合わせています。

## 使用素材

- `../assets/brand/hiro-app-works-mark.svg`
- `../assets/apps/consignment-note/app-icon.webp`
- `../assets/apps/consignment-note/screens/home.webp`

## frame方針

右側のpreview frameはRootのPhase 3.3相当の値を基準にしています。

- `aspect-ratio: 660 / 1434`
- `padding: 7px`
- `border: 2px solid #3a3d42`
- `border-radius: 48px`
- `background: #111317`
- Rootと同じ二重shadow
- 画像は`object-fit: cover`で元画像を歪めずに配置

高さはwidthと`aspect-ratio`から決まり、別のheight指定や`scaleX()`は使っていません。frameは下端を約43px（キャンバス高の約8.7%）キャンバス外へ出し、上端・アプリ名・`APP 01`・主要画面を優先して見せています。

制作原稿は `x-profile-banner.html` / `x-profile-banner.css` です。
