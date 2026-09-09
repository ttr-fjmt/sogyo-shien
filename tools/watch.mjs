/**
 * 掲載済み自治体の出典ページを巡回し、前回との差分を検知する。
 *
 *   node tools/watch.mjs              # 差分を報告（スナップショットは更新しない）
 *   node tools/watch.mjs --update     # 報告したうえでスナップショットを更新する
 *
 * 出力: tools/snapshots/<slug>.json  ＋ 標準出力にMarkdownの報告
 * 終了コード: 差分があれば 1（CIで検知するため）、なければ 0
 *
 * 生HTMLはセッションIDや広告タグで毎回変わるため、本文テキストを正規化した
 * ハッシュと、判断に効く数項目（更新日・金額・日付・受付状況）を比較する。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const WAIT = 3000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UPDATE = process.argv.includes('--update');

const root = path.join(import.meta.dirname, '..');
const dataDir = path.join(root, 'src/data/municipalities');
const snapDir = path.join(import.meta.dirname, 'snapshots');
fs.mkdirSync(snapDir, { recursive: true });

const toText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]*>/g, '\n')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .split('\n').map((s) => s.trim()).filter(Boolean).join('\n');

/** 判断に効く項目だけを取り出す。ここが変わったら人が見る必要がある。 */
function extract(text) {
  const TAX = new Set(['150,000円', '75,000円', '60,000円', '30,000円']);
  return {
    updatedAt: (text.match(/(?:最終更新日|更新日|掲載日)[：:\s]*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/) || [])[1] ?? null,
    fees: [...new Set(text.match(/[0-9,]{3,9}\s*円/g) || [])]
      .map((v) => v.replace(/\s/g, ''))
      .filter((v) => !TAX.has(v) && Number(v.replace(/[,円]/g, '')) >= 1000)
      .sort(),
    dates: [...new Set(text.match(/(?:令和|R)\s?[0-9０-９]{1,2}\s?年\s?[0-9０-９]{1,2}\s?月[0-9０-９]{0,2}\s?日?/g) || [])].sort(),
    status: [...new Set(text.match(/受付中|受付終了|申込締切|随時開催中|募集終了|募集中|キャンセル待ち|満席|定員に達し/g) || [])].sort(),
    hash: crypto.createHash('sha256').update(text.replace(/\s+/g, ' ')).digest('hex').slice(0, 16),
  };
}

const robotsCache = new Map();
async function allowed(url) {
  const { origin, pathname } = new URL(url);
  if (!robotsCache.has(origin)) {
    await sleep(WAIT);
    let dis = [];
    try {
      const r = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': UA } });
      if (r.ok) {
        const t = await r.text();
        if (!/<html/i.test(t)) dis = t.split('\n').filter((l) => /^disallow:/i.test(l)).map((l) => l.slice(9).trim()).filter(Boolean);
      }
    } catch {}
    robotsCache.set(origin, dis);
  }
  return !robotsCache.get(origin).some((d) => {
    if (d === '/' || !d.startsWith('/')) return false;
    const p = d.split('*')[0];
    return p.length > 1 && pathname.startsWith(p);
  });
}

const diffList = (a = [], b = []) => ({
  added: b.filter((x) => !a.includes(x)),
  removed: a.filter((x) => !b.includes(x)),
});

const municipalities = fs.readdirSync(dataDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')))
  .sort((a, b) => a.slug.localeCompare(b.slug));

const today = new Date();
const changed = [];
const failed = [];
const stale = [];
let checked = 0;

for (const m of municipalities) {
  const sources = (m.sources ?? []).filter((s) => s?.url);
  if (!sources.length) continue;

  // 最終確認からの経過日数（サイトの売りが鮮度なので、これ自体を報告する）
  const days = Math.floor((today - new Date(m.lastVerified)) / 86400000);
  if (days >= 90) stale.push({ name: m.name, days, lastVerified: m.lastVerified });

  // 出典が複数ある自治体は、講座ページ側で受講料や日程が変わることがある。
  // 1件目（制度ページ）だけを見ていると取りこぼすので、全部を巡回する。
  for (const [i, src] of sources.entries()) {
  const url = src.url;
  const label = sources.length > 1 ? `${m.name}（出典${i + 1}）` : m.name;

  if (!(await allowed(url))) {
    failed.push({ name: label, url, reason: 'robots.txt により Disallow' });
    continue;
  }

  await sleep(WAIT);
  let html = '';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    html = await r.text();
  } catch (e) {
    failed.push({ name: label, url, reason: e.message });
    continue;
  }
  checked++;

  const now = extract(toText(html));
  // 1件目は既存のスナップショット名を保つ（過去の記録を捨てないため）
  const snapPath = path.join(snapDir, i === 0 ? `${m.slug}.json` : `${m.slug}--${i}.json`);
  const prev = fs.existsSync(snapPath) ? JSON.parse(fs.readFileSync(snapPath, 'utf8')) : null;

  if (!prev) {
    if (UPDATE) fs.writeFileSync(snapPath, JSON.stringify({ url, ...now }, null, 2));
    console.error(`  初回記録 ${label}`);
    continue;
  }

  const d = {
    updatedAt: prev.updatedAt !== now.updatedAt ? [prev.updatedAt, now.updatedAt] : null,
    fees: diffList(prev.fees, now.fees),
    dates: diffList(prev.dates, now.dates),
    status: diffList(prev.status, now.status),
    body: prev.hash !== now.hash,
  };
  const meaningful =
    d.updatedAt || d.fees.added.length || d.fees.removed.length ||
    d.dates.added.length || d.dates.removed.length ||
    d.status.added.length || d.status.removed.length;

  if (meaningful || d.body) {
    changed.push({ name: label, slug: m.slug, url, lastVerified: m.lastVerified, meaningful: !!meaningful, d });
    if (UPDATE) fs.writeFileSync(snapPath, JSON.stringify({ url, ...now }, null, 2));
  }
  }
}

// --- 報告（Markdown）
const out = [];
out.push(`# 出典ページの差分検知　${today.toISOString().slice(0, 10)}`);
out.push('');
out.push(`巡回 ${checked} 件 / 差分あり ${changed.length} 件 / 取得失敗 ${failed.length} 件`);

const important = changed.filter((c) => c.meaningful);
if (important.length) {
  out.push('', '## 内容が変わった可能性がある自治体', '', '**受講料・日程・受付状況・更新日のいずれかが変化しています。確認が必要です。**', '');
  for (const c of important) {
    out.push(`### ${c.name}（最終確認 ${c.lastVerified}）`);
    out.push(`${c.url}`);
    if (c.d.updatedAt) out.push(`- 更新日: \`${c.d.updatedAt[0] ?? 'なし'}\` → \`${c.d.updatedAt[1] ?? 'なし'}\``);
    if (c.d.fees.added.length) out.push(`- 金額が増えた: ${c.d.fees.added.join(', ')}`);
    if (c.d.fees.removed.length) out.push(`- 金額が消えた: ${c.d.fees.removed.join(', ')}`);
    if (c.d.dates.added.length) out.push(`- 日付が増えた: ${c.d.dates.added.slice(0, 8).join(', ')}`);
    if (c.d.dates.removed.length) out.push(`- 日付が消えた: ${c.d.dates.removed.slice(0, 8).join(', ')}`);
    if (c.d.status.added.length) out.push(`- 受付状況が増えた: ${c.d.status.added.join(', ')}`);
    if (c.d.status.removed.length) out.push(`- 受付状況が消えた: ${c.d.status.removed.join(', ')}`);
    out.push('');
  }
}

const minor = changed.filter((c) => !c.meaningful);
if (minor.length) {
  out.push('', '## 本文が変わったが、主要項目に変化なし', '');
  out.push('（お知らせ欄の更新など。優先度は低い）', '');
  minor.forEach((c) => out.push(`- ${c.name} — ${c.url}`));
}

if (stale.length) {
  out.push('', '## 最終確認から90日以上経過', '', '**「最終確認」の日付が古いままだと、このサイトの売りが損なわれます。**', '');
  stale.sort((a, b) => b.days - a.days).forEach((s) => out.push(`- ${s.name} — ${s.days}日経過（${s.lastVerified}）`));
}

if (failed.length) {
  out.push('', '## 取得できなかった', '');
  failed.forEach((f) => out.push(`- ${f.name} — ${f.reason} — ${f.url}`));
}

if (!changed.length && !failed.length && !stale.length) out.push('', '変化はありませんでした。');

console.log(out.join('\n'));
process.exit(important.length || failed.length ? 1 : 0);
