import fs from 'node:fs';

// .stamp が inline-flex + gap の3要素になっていて、狭い画面で
// 「最終確 / 認」のように語の途中で折り返していた。
// ラベルと日付を1つの塊にして、折り返しは塊の間だけで起きるようにする。
const edits = [
  {
    file: 'src/pages/area/[prefSlug]/[slug].astro',
    from: `<p class="stamp">最終確認 <b>{m.lastVerified}</b>　—　出典は各実施機関の公式ページ</p>`,
    to: `<p class="stamp"><span>最終確認 <b>{m.lastVerified}</b></span><span>出典は各実施機関の公式ページ</span></p>`,
  },
  {
    file: 'src/pages/compare/[slug].astro',
    from: `<p class="stamp">最終確認 <b>2026-09-09</b>　—　出典は各自治体・各実施機関の公式ページ</p>`,
    to: `<p class="stamp"><span>最終確認 <b>{lastVerified}</b></span><span>出典は各自治体・各実施機関の公式ページ</span></p>`,
  },
  {
    file: 'src/pages/seido/[slug].astro',
    from: `<p class="stamp">最終確認 <b>2026-09-09</b>　—　{municipalities.length}自治体の公式ページを確認</p>`,
    to: `<p class="stamp"><span>最終確認 <b>{lastVerified}</b></span><span>{municipalities.length}自治体の公式ページを確認</span></p>`,
  },
];

for (const e of edits) {
  let s = fs.readFileSync(e.file, 'utf8');
  if (!s.includes(e.from)) throw new Error(`見つかりません: ${e.file}`);
  fs.writeFileSync(e.file, s.replace(e.from, e.to));
  console.log(`書き換え: ${e.file}`);
}

// 日付を直書きしていた2ページは、データから最新の確認日を出す。
// 直書きだと、データを更新しても表示だけ古いまま残る。
for (const f of ['src/pages/compare/[slug].astro', 'src/pages/seido/[slug].astro']) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('const lastVerified')) continue;
  const m = s.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error(`frontmatter が見つかりません: ${f}`);
  const line = `\n// 掲載データのうち最も新しい確認日を出す（直書きすると更新し忘れる）\nconst lastVerified = municipalities.map((m) => m.lastVerified).sort().at(-1);\n`;
  s = s.replace(m[0], m[0].replace(/\r?\n---$/, line + '---'));
  fs.writeFileSync(f, s);
  console.log(`lastVerified を追加: ${f}`);
}

// CSS：塊ごとに折り返す。区切りの罫は CSS 側で出す。
const cp = 'src/styles/tokens.css';
let c = fs.readFileSync(cp, 'utf8');
const from = `.stamp{
  display:inline-flex;align-items:baseline;gap:.5rem;
  border:1px solid var(--rule-strong);border-radius:2px;
  padding:.35rem .7rem;font-size:.78rem;color:var(--ink-soft);
  background:var(--surface);
}`;
const to = `.stamp{
  display:inline-flex;align-items:baseline;flex-wrap:wrap;gap:.15rem 1.1rem;
  border:1px solid var(--rule-strong);border-radius:2px;
  padding:.35rem .7rem;font-size:.78rem;color:var(--ink-soft);
  background:var(--surface);
}
/* 語の途中で折り返さない。折り返すなら塊と塊の間で */
.stamp > span{white-space:nowrap}
.stamp > span + span::before{content:"—";margin-right:1.1rem;color:var(--rule-strong)}
@media(max-width:520px){
  .stamp > span{white-space:normal}
  .stamp > span + span::before{content:none}
}`;
if (!c.includes(from)) throw new Error('.stamp のCSSが見つかりません');
fs.writeFileSync(cp, c.replace(from, to));
console.log('tokens.css の .stamp を修正しました');
