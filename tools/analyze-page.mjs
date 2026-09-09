/**
 * 市区町村の「特定創業支援等事業」ページを取得し、機械的に取れる項目だけを埋めた
 * ドラフトJSONと、人が読むための本文ダイジェストを出力する。
 *
 *   node tools/analyze-page.mjs <URL> <slug> <prefSlug> <pref> <name> <kana> <prefKana>
 *
 * 判断が要る項目（受講料・開催日・定員・独自制度）は "TODO" のまま残す。
 * ここを自動で埋めないのは、推測で数値を作らないため。
 */
import fs from 'node:fs';
import path from 'node:path';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const [url, slug, prefSlug, pref, name, kana, prefKana] = process.argv.slice(2);
if (!url || !slug) {
  console.error('usage: node tools/analyze-page.mjs <URL> <slug> <prefSlug> <pref> <name> <kana> <prefKana>');
  process.exit(1);
}

const origin = new URL(url).origin;

async function get(u) {
  await sleep(3000);
  const res = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja' } });
  return { status: res.status, text: res.ok ? await res.text() : '' };
}

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

// --- robots.txt
const rob = await get(`${origin}/robots.txt`);
const robotsExists = rob.status === 200 && !/<html/i.test(rob.text);
const disallow = robotsExists
  ? rob.text.split('\n').filter((l) => /^disallow:/i.test(l)).map((l) => l.split(':')[1]?.trim())
  : [];
const targetPath = new URL(url).pathname;
const blocked = disallow.some((d) => d && d !== '/' && targetPath.startsWith(d.replace(/\*$/, '')));

if (blocked) {
  console.error(`robots.txt により Disallow されています: ${targetPath}`);
  process.exit(2);
}

// --- 本体
const page = await get(url);
if (page.status !== 200) {
  console.error(`取得失敗: HTTP ${page.status}`);
  process.exit(3);
}
const html = page.text;
const text = toText(html);

// --- 機械的に取れるもの
const has = (re) => re.test(text);
const grab = (re) => (text.match(re) || [])[1] ?? null;

const facts = {
  updatedAt: grab(/(?:最終更新日|更新日)[：:\s]*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日|[0-9]{4}-[0-9]{2}-[0-9]{2})/),
  minSessions: /([0-9４-９4-9])回以上/.test(text) ? Number(String(text.match(/([0-9４-９4-9])回以上/)[1]).replace(/[４-９]/g, (c) => '0123456789'[c.charCodeAt(0) - 0xff10])) : null,
  minMonths: /([0-9１-９1-9])(?:か月|ヶ月|カ月|箇月)以上/.test(text) ? 1 : null,
  mentionsKabushiki15: has(/15万円|１５万円|150,000/),
  mentionsGodo6: has(/6万円|６万円|60,000/),
  rate: has(/0\.7[%％]/) && has(/0\.35[%％]/) ? { before: '0.7%', after: '0.35%' } : null,
  subjects: ['経営', '財務', '人材育成', '販路開拓'].filter((s) => text.includes(s)),
  mentionsJizokuka: has(/持続化補助金/),
  mentionsHosho: has(/創業関連保証/),
  mentionsJfc: has(/日本政策金融公庫|沖縄振興開発金融公庫/),
  tables: (html.match(/<table/gi) || []).length,
  tableRows: (html.match(/<tr/gi) || []).length,
  pdfLinks: [...new Set([...html.matchAll(/href="([^"]*\.pdf[^"]*)"/gi)].map((m) => m[1]))],
  externalOrgLinks: [...new Set(
    [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1])
      .filter((u) => !u.includes(new URL(url).hostname))
      .filter((u) => /cci|shokokai|shokoko|bank|shinkin|or\.jp|co\.jp/.test(u))
  )].slice(0, 25),
  yenAmounts: [...new Set((text.match(/[0-9,]{3,9}\s*円/g) || []))].slice(0, 30),
  dateLike: [...new Set((text.match(/(?:令和|R)\s?[0-9０-９]{1,2}\s?年\s?[0-9０-９]{1,2}\s?月[0-9０-９]{0,2}\s?日?|[0-9]{1,2}月[0-9]{1,2}日/g) || []))].slice(0, 30),
  capacityLike: [...new Set((text.match(/定員[^\n。]{0,20}/g) || []))].slice(0, 10),
  deadlineLike: [...new Set((text.match(/[^\n。]{0,15}(?:締切|〆切|申込期限)[^\n。]{0,15}/g) || []))].slice(0, 10),
};

// --- ドラフト（判断が要る項目は TODO のまま）
const draft = {
  slug, prefSlug, pref, prefKana, name, kana,
  lastVerified: new Date().toISOString().slice(0, 10),
  sourceUpdatedAt: facts.updatedAt,
  publish: { ready: false, blockers: ['TODO: 受講料と開催日が取れているか確認して判定'] },
  taxReduction: {
    kabushiki: { before: 150000, after: 75000 },
    godo: { before: 60000, after: 30000 },
    rate: facts.rate ?? { before: '0.7%', after: '0.35%' },
    notes: [],
  },
  requirement: {
    minSessions: facts.minSessions,
    minMonths: facts.minMonths,
    subjects: facts.subjects.length === 4 ? facts.subjects : [],
    notes: [],
  },
  courses: [{ name: 'TODO', org: 'TODO', fee: { unknown: true }, format: 'offline', sessions: null, schedule: null, capacity: null, deadline: null, status: 'unknown', statusBasis: 'TODO' }],
  coursesNote: 'TODO',
  otherBenefits: [
    facts.mentionsHosho && { title: '創業関連保証', body: 'TODO' },
    facts.mentionsJfc && { title: '日本政策金融公庫', body: 'TODO' },
    facts.mentionsJizokuka && { title: '持続化補助金', body: 'TODO' },
  ].filter(Boolean),
  localSupport: [],
  sources: [{ title: `${name}「特定創業支援等事業」`, url }],
};

const outDir = path.join(import.meta.dirname, 'out', slug);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'draft.json'), JSON.stringify(draft, null, 2));
fs.writeFileSync(path.join(outDir, 'facts.json'), JSON.stringify({ url, robotsExists, disallow, ...facts }, null, 2));
fs.writeFileSync(path.join(outDir, 'digest.txt'), text.slice(0, 20000));

console.log(`--- ${name} (${pref}) ---`);
console.log(`robots.txt: ${robotsExists ? `あり / Disallow ${disallow.length}行` : 'なし(404)'} / 対象パスはブロックされていません`);
console.log(`更新日: ${facts.updatedAt ?? '取得できず'}`);
console.log(`要件: ${facts.minSessions ?? '?'}回以上・${facts.minMonths ?? '?'}か月以上 / 4分野の記載: ${facts.subjects.length}/4`);
console.log(`表: ${facts.tables}個 / 行 ${facts.tableRows} / PDF ${facts.pdfLinks.length}件 / 外部機関リンク ${facts.externalOrgLinks.length}件`);
console.log(`金額らしき記述: ${facts.yenAmounts.slice(0, 8).join(' ') || 'なし'}`);
console.log(`日付らしき記述: ${facts.dateLike.slice(0, 8).join(' ') || 'なし'}`);
console.log(`定員: ${facts.capacityLike.join(' / ') || 'なし'}`);
console.log(`締切: ${facts.deadlineLike.join(' / ') || 'なし'}`);
console.log(`\n出力: tools/out/${slug}/ (draft.json / facts.json / digest.txt)`);
