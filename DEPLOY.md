# 公開手順

## 0. その前に：公開してよいか

現在**12自治体・91講座**を掲載しています。掲載基準を満たさない5自治体は `noindex` かつ
sitemap 除外なので、公開しても検索結果には出ません。

ただし、公開前に確認しておくべきことが1つあります。

- **福岡市** は「トップページ以外の個別ページへのリンクは、各ページの担当課に問い合わせ」と
  明記しています。現在は未公開なので影響しませんが、**公開に切り替える前に一報を入れてください**。
  法律上リンクは自由なので禁止ではありませんが、出典として深くリンクする設計のためです。

トップページと各ページの「開発版」表記は、公開時に外すかどうかを決めてください。
12自治体で公開するか、もう少し貯めてから公開するかは判断が必要です。

## 1. ドメイン（取得済み）

**取得済み: sogyo-shien.com**（2026-09-09 登録／お名前.com／有効期限 2027-09-09）

購入先の例: お名前.com / Value Domain / Cloudflare Registrar
（Cloudflare Registrar は原価販売でホスティングと同じ管理画面に入りますが、.jp は非対応のことがあります）

他の空き候補: sogyo-school.jp / setsuritsu-navi.jp / kaigyo-navi.jp / sogyo-hangaku.jp

**`tokutei-sogyo.jp` は避けてください。**供給側の用語で、会社を作りたい人はこの言葉を知りません。

## 2. ホスティング

**Cloudflare Pages を推奨します。**

- 完全な静的サイトなので無料枠で足ります
- 独自ドメインとSSLが無料、設定も数クリック
- 日本国内のエッジから配信されるので表示が速い（Core Web Vitals に効きます）
- ビルドは GitHub 連携で自動

Vercel / Netlify でも問題ありません。同じ静的出力です。

### 設定値

| 項目 | 値 |
|---|---|
| ビルドコマンド | `npm run build` |
| 出力ディレクトリ | `dist` |
| Node バージョン | 20 以上 |
| 環境変数 | `SITE_URL=https://sogyo-shien.com` |

`wrangler.toml` は Cloudflare Pages 用に置いてあります。

## 3. 公開に必要なファイルは配置済み

| ファイル | 役割 |
|---|---|
| `public/robots.txt` | 全許可＋sitemap の場所を明示 |
| `public/_headers` | セキュリティヘッダと `_astro/*` の長期キャッシュ |
| `src/pages/404.astro` | 404ページ（市区町村検索つき、noindex） |
| `astro.config.mjs` | `site` を `SITE_URL` 環境変数で上書き可能 |
| `.gitignore` | `node_modules` `dist` `tools/out` を除外 |

ドメインを変える場合は `SITE_URL` を変えるだけで、canonical・OGP・sitemap すべて追従します。
`public/robots.txt` の Sitemap 行だけは手で書き換えてください。

## 4. 公開後にやること

1. **Google Search Console に登録**し、`sitemap-index.xml` を送信する
2. 掲載している自治体・実施機関に**リンクの一報を入れる**（特に福岡市）
3. 検索ボリュームとキーワード難易度を実測する（これまで未実施）
4. 自治体データを増やす（`src/data/municipalities/` に JSON を1つ置くだけ）

## 5. ローカル開発

```bash
npm install
npm run dev     # http://localhost:4321
npm run build   # dist/ に出力
```

このプロジェクトは `C:sogyo-shien` に置いてあります。
Claude のスクラッチ領域（パスが長くWindowsのMAX_PATHを超える）では esbuild の
回避策が必要でしたが、この場所では不要です。
