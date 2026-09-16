# 創業支援ポータル — 作業の引き継ぎ

市区町村ごとの「特定創業支援等事業」を、**成果（登録免許税がいくら安くなるか）を軸に**
整理する静的サイト。https://sogyo-shien.com で公開中。

まず現在地を出す:

```bash
npm run status
```

掲載数・講座数・保留理由・自動巡回の状況が出る。**件数はドキュメントに直書きしない**
（必ず古くなる。過去に README がそれで壊れた）。

---

## 1. このサイトが何を売りにしているか

「講座の一覧」ではなく「**その市で会社を作ると、いくら・どう得か**」を出すこと。
だから次の2つが生命線になる。

- **役所のページに書いていないことは書かない。** 推測で数値を埋めない。
  書いていない項目は `unknowns` に入れて「記載なし」と明示し、問い合わせ先に送る。
- **いつ時点の情報かを必ず示す。** `lastVerified` と `sources` は全ページ必須。

この2つを崩すと、他のどのサイトとも区別がつかなくなる。

---

## 2. 作業の流れ

自治体を増やすのが本丸。1セッション10〜20自治体のペースで進めてきた。

```
1. 候補URLを探す        … 検索。URLは推測しない
2. npm run screen       … 一次スクリーニング（機械的な仕分け）
3. ダイジェストを読む    … tools/out/<slug>/digest.txt
4. JSONを書く           … src/data/municipalities/<slug>.json
5. npm run build → push … 全ページ・sitemap・監視対象が自動更新
```

### 2-2 の使い方

```bash
printf 'URL\tslug\tprefSlug\tpref\t表示名\n' > tools/_t.tsv
npm run screen tools/_t.tsv
```

`○` は「読む価値がある」まで。**掲載可否の判断ではない。**
実際 `○` が付いた川口市・松山市は、日付の実体が過去のリンク一覧で掲載できなかった。

### 4 の JSON

`src/data/municipalities/<slug>.json` を1つ置けば `/area/<prefSlug>/<slug>/` が生成される。
書き方は既存ファイルに倣う。構造が一番よく揃っているのは `kobe.json` `kurume.json`。

大きなJSONを書くときは **Write ツールを使う**。bash のヒアドキュメントは
日本語＋バッククォートで壊れたことがある。

---

## 3. 掲載基準（2026-09-09 に拡大）

> **受講料・開催日・国の3措置以外の上乗せ支援** のいずれかが公表されていること

満たさない自治体は `publish.ready: false` で登録する。ページは生成されるが noindex になり、
sitemap からも外れる。**捨てずに登録する**のは、週次の巡回対象に載せるため。

「国の3措置」= 登録免許税の軽減／創業関連保証の特例／日本政策金融公庫の金利引き下げ。
これ以外（市の融資制度、保証料補助、補助金など）があれば **上乗せ支援**として掲載対象になる。

判断に迷った実例:
- 相模原市 … 融資の利用者負担利率 0.7%→0.5% は**市独自**なので掲載
- 那覇市 … 沖縄県の創業者支援資金の要件緩和。県の措置だが国の3措置以外なので掲載
- 北九州市・富山市 … 国の3措置だけなので保留

基準を変えるときは `src/pages/index.astro` と `src/pages/area/[prefSlug]/index.astro` の
説明文も直す（利用者に見せている約束なので、実装とずれてはいけない）。

---

## 4. 自動化していること・していないこと

| | 内容 | 頻度 |
|---|---|---|
| `deploy.yml` | ビルドして GitHub Pages へ | push時 |
| `watch.yml` | **登録済み**出典ページの差分検知 → Issue | 毎週月曜 7:00 JST |
| `scan.yml` | 保留自治体＋`tools/candidates.tsv` を巡回し、判定が上がったものを Issue | 毎週月曜 8:00 JST |

`scan` は前回の判定を `tools/scan-state.json` に持ち、**変化したものだけ**報告する
（毎週同じ一覧が来ると読まなくなるため）。判定が `pass` のまま受講料だけ新たに載った場合も
拾えるよう、金額の有無を別に見ている。

### JSON化は自動化しない

ここは判断の塊で、機械にすると静かに誤ったページが増える。実際に必要だった判断:

- 「無料」が講座の受講料か、Adobe Reader のダウンロードか
- 締切が過ぎているかの日付照合（`status` は `open` / `closed` / `unknown`）
- 市独自の上乗せと国の措置の切り分け
- 豊島区は補助金があるが対象講座ページが404 → 保留

---

## 5. 取得の作法（守ること）

- **1リクエストあたり3秒待つ。並列アクセスはしない。**
- **robots.txt が Disallow しているパスは取得しない。** その場合は記録して次へ進む。
- User-Agent は一般的なブラウザのもの。
- PDFは URL とファイル名の記録のみ。ダウンロード・解析はしない。
- 取得に失敗したものを成功扱いにしない。失敗理由を残す。
- **ボット検知の回避はしない。** 経済産業省のページは AWS WAF に阻まれたため収集を中止した。
  ネリサポは GitHub Actions からは 403（手元からは取得可）。どちらも迂回していない。

実装は `tools/lib/screen-core.mjs` にまとまっている。新しい収集ツールを書くならここを使う。

### 相手方の掲載条件

福岡市は「トップページ以外の個別ページへのリンクは各ページの担当課に問い合わせ」という
方針を出している。出典のURLを**リンクにしていない**（`sources[].noLink` で制御）。
監視は個別ページで続けている。担当課への連絡が済めば通常のリンクに戻せる。

---

## 6. ページの作りで守っているルール

`src/pages/area/[prefSlug]/[slug].astro` と `src/lib/fmt.js` に実装がある。

1. **講座3件以上はテーブル、3件未満はカード。** 1件しかない市でも成立させる。
2. **受講料の昇順。** 無料 → 金額順 → 記載なし。並び順そのものが情報になる。
3. **受付状況は `status` と `statusBasis` を必ず対で持つ。** 根拠なしに「募集中」と書かない。
4. **Event 構造化データは、開催日が確定していて受付中のものだけ。** 通年・未定・終了は出さない。
5. **タイトルは重複させない。** `pageTitle` が「その市で一番効く数字＋対象講座の件数」で
   組み立てる。自動生成で言い表せない市は、データ側の `titleHook` に手書きする。

タイトル・descriptionの重複は毎回この方法で確認する:

```bash
npm run build && node -e "
const fs=require('fs'),path=require('path');
function walk(d,o=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const q=path.join(d,e.name);e.isDirectory()?walk(q,o):e.name==='index.html'&&o.push(q);}return o;}
const t={};for(const f of walk('dist')){const h=fs.readFileSync(f,'utf8').replace(/\n/g,'');
if(/content=\"noindex\"/.test(h))continue;(t[(h.match(/<title>([^<]*)/)||[])[1]]??=[]).push(f);}
const d=Object.entries(t).filter(([,v])=>v.length>1);
console.log('index可 '+Object.values(t).flat().length+' / 重複 '+d.length);
for(const [k,v] of d) console.log('  '+k+' ← '+v.length);"
```

---

## 7. 公開まわり

| 項目 | 設定 |
|---|---|
| ドメイン | sogyo-shien.com（お名前.com） |
| DNS | Cloudflare（**プロキシはオフ**。グレーの雲） |
| ホスティング | GitHub Pages（Source は **GitHub Actions**） |
| リポジトリ | ttr-fjmt/sogyo-shien（**public**。Pages を無料で使うため） |
| GA4 | G-4N0ZKF117P。`?ga=off` で自分のアクセスを除外、`?ga=on` で解除 |
| AdSense | pub-5761092657360295。枠IDは `src/lib/ads.js`（空なら何も描画しない） |

詳しくは `DEPLOY.md`。

`Base.astro` の head の順番は変えないこと。
**ld+json → GA除外スクリプト → gtag → adsbygoogle**。
GA除外を gtag より前に置かないと、初回のページビューを止められない。

---

## 8. 積み残し

- **自治体を増やす。** 全国約1,580のうち今は `npm run status` の数だけ。ここが本丸。
- **認定市区町村の総数が確定していない**（1,459 か 1,580 か）。一次情報の経済産業省ページが
  WAF で取得できず未解決。README の「1,459」はこの未解決の数字。
- **検索ボリューム・キーワード難易度の実測をしていない。** `docs/seo-keyword-design.md` は
  設計だけで、実測値が入っていない。
- **系統B（産業振興公社・経済産業局・中小機構・商工会議所・よろず支援拠点）の利用規約が未確認。**
- **福岡市の担当課への連絡**（7-2 のリンク方針）。

---

## 9. 環境

別の場所で始めるとき:

```bash
git clone https://github.com/ttr-fjmt/sogyo-shien.git
cd sogyo-shien
npm install
npm run status   # 現在地
npm run build    # 通ることを確認
```

- リポジトリがそのまま引き継ぎの実体。**手元にしかない状態を作らない**
  （データも収集ツールも巡回の記録も全部コミットしてある）。
- **パスの短いところに置く。** Claude のスクラッチ領域に置くとセッション終了で消えるうえ、
  パスが長く Windows の MAX_PATH に引っかかって esbuild が動かない。
- Node 22。CI も同じ。
- `tools/out/`（ダイジェスト）と `dist/` は .gitignore。ダイジェストは
  `npm run screen` を流せば再生成できる。
- `tools/_patch*.mjs` `tools/_add*.mjs` は使い捨ての作業スクリプト。
  何をどう直したかの記録として残してあるだけで、再実行は想定していない。

## 10. コミット

- メッセージは日本語。**何を変えたかだけでなく、なぜそうしたかを書く。**
  不具合を直したときは、何が起きていたかを残す（例:「.stamp が inline-flex + gap の
  3要素になっていて、狭い画面で語の途中で折り返していた」）。
- `main` に直接コミットしている。ブランチは切っていない。
- 末尾に付ける:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
