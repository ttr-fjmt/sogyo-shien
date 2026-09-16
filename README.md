# 創業支援ポータル

市区町村ごとの特定創業支援等事業を、成果（登録免許税がいくら安くなるか）を軸に整理する
静的サイトです。全国約1,580の認定市区町村への横展開を前提に、**データ駆動**で構成しています。

公開先: https://sogyo-shien.com
作業の進め方は **[CLAUDE.md](CLAUDE.md)** に、公開手順は [DEPLOY.md](DEPLOY.md) にまとめています。

## 使い方

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/ に静的HTMLを出力

npm run status   # 今どこまで進んでいるか（掲載数・保留理由・巡回の状況）
npm run screen tools/targets.tsv   # 候補ページの一次スクリーニング
npm run scan     # 掲載保留と候補キューを巡回（--update で判定を記録）
npm run watch    # 登録済み出典ページの差分検知（--update でスナップショット更新）
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
tools/
  lib/screen-core.mjs          ← ページ取得と仕分けの中身（3秒待機・robots.txt遵守）
  screen.mjs                   ← 手動の一次スクリーニング
  scan.mjs                     ← 候補の定期スクリーニング（scan.yml から）
  watch.mjs                    ← 出典ページの差分検知（watch.yml から）
  status.mjs                   ← 現在地の表示
  candidates.tsv               ← 掲載候補のキュー
```

## テンプレートが守っているルール

1. **講座3件以上はテーブル、3件未満はカード。** 松本市のように1件しかない市でも成立させる。
2. **受講料の昇順で並べる。** 「同じ証明書なのに0円〜396,000円」という事実を並び順が担う。
3. **記載のない項目は空欄にせず「記載なし」と明示し、問い合わせ先に送る。**
   `unknowns` に入れた項目は警告ブロックとして描画される。
4. **受付状況は推定であることを明示する。** `status` と `statusBasis` を必ず対で持つ。
   元データに受付状況フラグがある自治体は稀（調査した18ソース中3つ）。
5. **titleは重複させない。** 「その市で一番効く数字」＋「対象講座の件数」で組み立てる
   （`lib/fmt.js` の `pageTitle`）。指標を1つしか見ないと、条件の似た自治体どうしで
   同じタイトルになる。自動生成で言い表せない市は、データ側の `titleHook` に手書きする。
6. **Event 構造化データは、開催日が確定していて受付中のものだけ出す。**
   通年・未定・終了は出さない（`eventJsonLd`）。
7. **自治体間で記載が食い違う点は断定せず、確認先を示す。** `conflicts` に入れる。

## データを1自治体追加する手順

`src/data/municipalities/<slug>.json` を1つ置くだけです。ビルド時に
`/area/<prefSlug>/<slug>/` が生成され、sitemap にも自動で載ります。

必須キー: `slug` `prefSlug` `pref` `name` `lastVerified` `taxReduction` `requirement`
`courses` `otherBenefits` `sources`

**公開の最低条件**（2026-09-09 改定）: **受講料・開催日・国の3措置以外の上乗せ支援**の
いずれかが公表されていること。加えて出典URLと最終確認日は必須。

満たさない自治体は `publish.ready: false` で登録する。ページは生成されるが noindex になり
sitemap からも外れる。捨てずに登録するのは、週次の巡回対象に載せて、日程や受講料が
公表された時点で気づけるようにするため。詳しくは [CLAUDE.md](CLAUDE.md) の「掲載基準」。

## 自動で回っているもの

| ワークフロー | 実行 | 内容 |
|---|---|---|
| `deploy.yml` | push時 | ビルドして GitHub Pages へ |
| `watch.yml` | 毎週月曜 7:00 JST | 登録済み出典ページの差分検知 → Issue |
| `scan.yml` | 毎週月曜 8:00 JST | 掲載保留と候補キューを巡回し、判定が上がったものを Issue |

JSON化（ダイジェストを読んで自治体データを書く工程）は自動化していません。
理由は [CLAUDE.md](CLAUDE.md) の「自動化していること・していないこと」に書いています。

## 開発環境

Node 22。`npm install && npm run build` がそのまま通ります。

作業ディレクトリは `C:\sogyo-shien`。Claude のスクラッチ領域には置かないでください
（セッション終了で消えるうえ、パスが長く Windows の MAX_PATH に引っかかります）。
