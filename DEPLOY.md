# 公開手順

## 構成

既存サイト（agent-zukan / skillup-zukan / freelance-anken-zukan）と同じ構成です。

| 項目 | 設定 |
|---|---|
| ドメイン | sogyo-shien.com（お名前.com で取得、2026-09-09 登録） |
| DNS | **Cloudflare**（`dan.ns.cloudflare.com` / `jamie.ns.cloudflare.com`） |
| ホスティング | **GitHub Pages** |
| リポジトリ | ttr-fjmt/sogyo-shien（private） |
| Cloudflareプロキシ | **オフ**（グレーの雲） |

既存3サイトも DNS は Cloudflare、配信は GitHub Pages です。
`curl -I https://agent-zukan.net/` が `Server: GitHub.com` と `x-github-edge-region: japaneast` を
返すことで確認済みで、Cloudflare は純粋に DNS だけを担当しています。

### 既存サイトと1点だけ違うところ

既存3サイトは `main` ブランチの HTML をそのまま配信しています（Pages の `build_type=legacy`）。
本サイトは Astro でビルドが必要なため、**GitHub Actions でビルドして Pages へデプロイ**します。

そのため Pages の Source は「Deploy from a branch」ではなく「**GitHub Actions**」を選びます。
ここだけ操作が異なります。

利点として、HTML をコミットする必要がなく、
`src/data/municipalities/` に JSON を1つ置いて push すれば全ページが更新されます。

---

## 公開までの手順

### 1. GitHub Pages を有効にする

リポジトリの **Settings → Pages → Build and deployment → Source** を
「**GitHub Actions**」に変更します。

変更すると `.github/workflows/deploy.yml` が動き、数分でデプロイされます。
この時点で払い出される URL で表示確認ができます。

### 2. Cloudflare に DNS レコードを追加する

Cloudflare ダッシュボード → sogyo-shien.com → **DNS** で以下を追加します。

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `185.199.108.153` | **オフ（グレー）** |
| A | `@` | `185.199.109.153` | **オフ（グレー）** |
| A | `@` | `185.199.110.153` | **オフ（グレー）** |
| A | `@` | `185.199.111.153` | **オフ（グレー）** |
| CNAME | `www` | `ttr-fjmt.github.io` | **オフ（グレー）** |

**プロキシは必ずオフにしてください。**オンだと GitHub Pages 側の証明書発行が失敗することがあります。
既存3サイトもオフです。

### 3. 独自ドメインを設定する

**Settings → Pages → Custom domain** に `sogyo-shien.com` を入力して保存します。
DNS チェックが通ったら **Enforce HTTPS** にチェックを入れます。

リポジトリには `public/CNAME`（中身は `sogyo-shien.com`）を置いてあり、
ビルドのたびに `dist/CNAME` として出力されるので、デプロイで設定が消えることはありません。

### 4. 動作確認

- `https://sogyo-shien.com/` — トップページ
- `https://sogyo-shien.com/robots.txt` — Sitemap 行が `.com` を指している
- `https://sogyo-shien.com/sitemap-index.xml` — 22 URL
- `https://sogyo-shien.com/area/kanagawa/kawasaki/` — 川崎市のページ
- `https://sogyo-shien.com/llms.txt` — LLM 向けのサイト説明
- `https://sogyo-shien.com/ads.txt` — AdSense のパブリッシャーID
- `https://sogyo-shien.com/zzz` — 404 ページ

以降は `main` に push するたびに自動でビルド・公開されます。

---

## 公開後にやること

1. **Google Search Console に登録**し、`sitemap-index.xml` を送信する
2. **福岡市に一報を入れる** — 「トップページ以外の個別ページへのリンクは担当課に問い合わせ」と
   明記している唯一の自治体です。現在は未公開なので影響しませんが、公開に切り替える前に連絡してください
3. 検索ボリュームとキーワード難易度を実測する（未実施）
4. 自治体データを増やす

---

## ローカル開発

```bash
npm install
npm run dev     # http://localhost:4321
npm run build   # dist/ に出力
```

プロジェクトは `C:\sogyo-shien` に置いてあります。短いパスなので esbuild の回避策は不要です。

## データを1自治体追加する手順

`src/data/municipalities/<slug>.json` を1つ置くだけです。
ビルド時に `/area/<prefSlug>/<slug>/` が生成され、比較ページ・トップページ・sitemap にも自動で反映されます。

**公開の最低条件**: 受講料か開催日のどちらかが公表されていること。
どちらも無い自治体は `publish.ready` を `false` にすると、noindex かつ sitemap 除外になります。

収集用のツールは `tools/` にあります。

```bash
node tools/screen.mjs tools/targets.tsv   # 一次スクリーニング
```
