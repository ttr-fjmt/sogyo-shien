# 創業支援ポータル

市区町村ごとの特定創業支援等事業を、成果（登録免許税がいくら安くなるか）を軸に整理する
静的サイトです。1,459の認定市区町村への横展開を前提に、**データ駆動**で構成しています。

## 使い方

```bash
npm install --ignore-scripts   # ※ --ignore-scripts の理由は下記
npm run dev                    # http://localhost:4321
npm run build                  # dist/ に静的HTMLを出力
```

## 構成

```
src/
  data/municipalities/*.json   ← 1自治体 = 1ファイル。ここだけ増やせばページが増える
  lib/fmt.js                   ← 表示ルール（受講料の整形・並び順・title振り分け・JSON-LD）
  layouts/Base.astro           ← head / メタ / 構造化データ
  styles/tokens.css            ← デザイントークン（ライト/ダーク両対応）
  pages/
    index.astro
    area/[prefSlug]/[slug].astro   ← 地域ページのテンプレート（全自治体で共用）
```

## テンプレートが守っているルール

1. **講座3件以上はテーブル、3件未満はカード。** 松本市のように1件しかない市でも成立させる。
2. **受講料の昇順で並べる。** 「同じ証明書なのに0円〜396,000円」という事実を並び順が担う。
3. **記載のない項目は空欄にせず「記載なし」と明示し、問い合わせ先に送る。**
   `unknowns` に入れた項目は警告ブロックとして描画される。
4. **受付状況は推定であることを明示する。** `status` と `statusBasis` を必ず対で持つ。
   元データに受付状況フラグがある自治体は稀（調査した18ソース中3つ）。
5. **titleは市の特性で振り分ける。** 無料講座あり → 無料訴求、独自支援あり → 独自訴求、
   それ以外 → 標準。1,459件が同一パターンになるのを避ける（`lib/fmt.js` の `pageTitle`）。
6. **Event 構造化データは、開催日が確定していて受付中のものだけ出す。**
   通年・未定・終了は出さない（`eventJsonLd`）。
7. **自治体間で記載が食い違う点は断定せず、確認先を示す。** `conflicts` に入れる。

## データを1自治体追加する手順

`src/data/municipalities/<slug>.json` を1つ置くだけです。ビルド時に
`/area/<prefSlug>/<slug>/` が生成され、sitemap にも自動で載ります。

必須キー: `slug` `prefSlug` `pref` `name` `lastVerified` `taxReduction` `requirement`
`courses` `otherBenefits` `sources`

**公開の最低条件**（SEO仕様書より）: 講座の実データ3件以上、その市固有の制度1つ以上、
出典URLと最終確認日。満たせない市は公開しない。

## この環境でのビルドについて（重要）

Claude のスクラッチ領域はパスが長く、**Windows の MAX_PATH（260文字）を超えるため
esbuild のバイナリを spawn できません**。そのため、この環境では次の回避策を使っています。

- `npm install --ignore-scripts`（esbuild の postinstall が失敗するため）
- `package.json` の `overrides` で esbuild を単一バージョンに固定
- ビルド時に `ESBUILD_BINARY_PATH` で短いパスのバイナリを指定

```bash
ESBUILD_BINARY_PATH="C:\Users\fujim\esb.exe" npm run build
```

**通常の作業マシンでは、これらはすべて不要です。** `C:\sogyo-portal` のような短いパスに
置けば `npm install && npm run build` がそのまま通ります。その場合は
`package.json` の `overrides` も外して構いません。
