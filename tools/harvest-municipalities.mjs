/**
 * 中小企業庁の都道府県別ページから、認定を受けた市区町村の全国リストを取得する。
 * 1リクエストにつき3秒ウェイト、直列。ブラウザのUAを使用。
 * 出力: tools/out/certified-municipalities.json
 */
import fs from 'node:fs';
import path from 'node:path';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const WAIT = 3000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PREFS = [
  'hokkaido','aomori','iwate','miyagi','akita','yamagata','fukushima','ibaraki','tochigi','gunma',
  'saitama','chiba','tokyo','kanagawa','niigata','toyama','ishikawa','fukui','yamanashi','nagano',
  'gifu','shizuoka','aichi','mie','shiga','kyoto','osaka','hyogo','nara','wakayama',
  'tottori','shimane','okayama','hiroshima','yamaguchi','tokushima','kagawa','ehime','kochi','fukuoka',
  'saga','nagasaki','kumamoto','oita','miyazaki','kagoshima','okinawa',
];
const PREF_JA = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];

/** 表の行から「市区町村名」と「認定時期」を取り出す */
function parse(html) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const out = [];
  for (const [, row] of rows) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(([, c]) =>
      c.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    );
    if (cells.length < 2) continue;
    const [name, when] = cells;
    if (!name || !/[市区町村]$/.test(name)) continue;
    out.push({ name, certifiedAt: when || null });
  }
  return out;
}

const all = [];
const failures = [];
for (let i = 0; i < PREFS.length; i++) {
  const code = String(i + 1).padStart(2, '0');
  const url = `https://www.chusho.meti.go.jp/keiei/chiiki/${code}.nintei_${PREFS[i]}.html`;
  await sleep(WAIT);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = parse(await res.text());
    if (!list.length) throw new Error('表を解析できず0件');
    all.push(...list.map((m) => ({ ...m, pref: PREF_JA[i], prefSlug: PREFS[i], prefCode: code })));
    console.log(`${code} ${PREF_JA[i].padEnd(5, '　')} ${String(list.length).padStart(3)}件`);
  } catch (e) {
    failures.push({ pref: PREF_JA[i], url, reason: String(e.message) });
    console.log(`${code} ${PREF_JA[i].padEnd(5, '　')} 失敗: ${e.message}`);
  }
}

const outDir = path.join(import.meta.dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'certified-municipalities.json'),
  JSON.stringify({ fetchedAt: new Date().toISOString().slice(0, 10), total: all.length, failures, municipalities: all }, null, 2)
);
console.log(`\n合計 ${all.length} 市区町村 / 失敗 ${failures.length} 県`);
