import fs from 'node:fs';

// --- 1. Base.astro：全ページの先頭にサイト名を出す
const bp = 'src/layouts/Base.astro';
let b = fs.readFileSync(bp, 'utf8');

const oldTop = `    <div class="wrap">
      {crumbs.length > 1 && (`;

const newTop = `    <div class="wrap">
      <header class="site-head">
        <a class="brand" href="/" aria-label="創業支援ポータル トップページ">
          <span class="brand-mark" aria-hidden="true">創</span>
          <span class="brand-name">創業支援ポータル</span>
        </a>
      </header>
      {crumbs.length > 1 && (`;

if (!b.includes(oldTop)) throw new Error('Base.astro の wrap 先頭が見つかりません');
b = b.replace(oldTop, newTop);

// フッターにもサイト名を置く（記事の末尾から戻れるように）
const oldFoot = `      <footer class="site-foot">
        <p><a href="/">トップ</a>　<a href="/about/">このサイトについて</a>　<a href="/privacy/">プライバシーポリシー</a></p>`;

const newFoot = `      <footer class="site-foot">
        <p class="foot-brand">
          <a class="brand brand-sm" href="/" aria-label="創業支援ポータル トップページ">
            <span class="brand-mark" aria-hidden="true">創</span>
            <span class="brand-name">創業支援ポータル</span>
          </a>
        </p>
        <p><a href="/about/">このサイトについて</a>　<a href="/privacy/">プライバシーポリシー</a></p>`;

if (!b.includes(oldFoot)) throw new Error('Base.astro のフッターが見つかりません');
b = b.replace(oldFoot, newFoot);
fs.writeFileSync(bp, b);
console.log('Base.astro にサイト名を追加しました');

// --- 2. tokens.css：ブランドの色と形
const cp = 'src/styles/tokens.css';
let c = fs.readFileSync(cp, 'utf8');

const brandCss = `
/* ==========================================================================
   サイト名（朱地に白のボタン）
   ブランド色はテーマで変えない。ダークでも朱地×白のままのほうが
   「同じサイトだ」と分かりやすく、白文字とのコントラストも 7.8:1 で足りる。
   ========================================================================== */
:root{
  --brand:#B7452F;
  --brand-hover:#9C3A27;
  --brand-ink:#FBFAF7;
}

.site-head{margin:0 0 var(--s4)}

.brand{
  display:inline-flex;align-items:center;gap:.5rem;
  background:var(--brand);color:var(--brand-ink);
  padding:.46rem .9rem .5rem;border-radius:3px;
  text-decoration:none;line-height:1.2;
  transition:background .12s ease;
}
.brand:hover,
.brand:focus-visible{background:var(--brand-hover);color:var(--brand-ink)}
.brand:focus-visible{outline:2px solid var(--ink);outline-offset:3px}

.brand-mark{
  font-family:var(--f-disp);font-weight:800;font-size:1.18rem;
  line-height:1;padding-right:.5rem;
  border-right:1px solid rgba(251,250,247,.42);
}
.brand-name{
  font-family:var(--f-disp);font-weight:700;font-size:1.02rem;letter-spacing:.06em;
}

/* フッター側は控えめに */
.foot-brand{margin:0 0 var(--s3)}
.brand-sm{padding:.34rem .7rem .38rem}
.brand-sm .brand-mark{font-size:1rem;padding-right:.42rem}
.brand-sm .brand-name{font-size:.86rem}

@media(max-width:420px){
  .brand-name{font-size:.94rem;letter-spacing:.04em}
}
`;

if (c.includes('.site-head{')) throw new Error('ブランドのCSSが既にあります');
c = c.trimEnd() + '\n' + brandCss;
fs.writeFileSync(cp, c);
console.log('tokens.css にブランドのCSSを追加しました');
