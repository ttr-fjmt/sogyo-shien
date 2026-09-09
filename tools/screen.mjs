/**
 * 一次スクリーニング。targets.tsv の各行を取得し、機械的に取れる項目だけで
 * 「本登録に進めるか」を仕分ける。本文の読解はしない（受講料・日程の判断は人がやる）。
 *
 *   node tools/screen.mjs tools/targets.tsv
 *
 * targets.tsv: URL <TAB> slug <TAB> prefSlug <TAB> pref <TAB> name
 * 出力: tools/out/screening.json  ＋ 各市の digest.txt
 *
 * 判定基準（推測で数値を作らないための線引き）:
 *   pass  = 金額の記述があり、かつ日付の記述がある
 *   maybe = 金額か日付のどちらか一方だけある
 *   fail  = どちらも無い（掲載しても利用者が判断できない）
 */
import fs from 'node:fs';
import path from 'node:path';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const WAIT = 3000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const robotsCache = new Map();
async function robotsFor(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  await sleep(WAIT);
  let info = { exists: false, disallow: [] };
  try {
    const r = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': UA } });
    if (r.ok) {
      const t = await r.text();
      if (!/<html/i.test(t)) {
        info = {
          exists: true,
          disallow: t.split('\n').filter((l) => /^disallow:/i.test(l)).map((l) => l.slice(9).trim()).filter(Boolean),
        };
      }
    }
  } catch {}
  robotsCache.set(origin, info);
  return info;
}

const targetsFile = process.argv[2] ?? path.join(import.meta.dirname, 'targets.tsv');
const targets = fs.readFileSync(targetsFile, 'utf8').split('\n')
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l) => { const [url, slug, prefSlug, pref, name] = l.split('\t'); return { url, slug, prefSlug, pref, name }; });

const results = [];
for (const t of targets) {
  const origin = new URL(t.url).origin;
  const rob = await robotsFor(origin);
  const p = new URL(t.url).pathname;
  // ワイルドカード開始（*.pdf$ 等）は前方一致に落とすと空文字になり全パスに誤ヒットする。
  // 前方一致で判定できるのは「/」始まりのパターンだけに限る。
  const blocked = rob.disallow.some((d) => {
    if (d === '/' || !d.startsWith('/')) return false;
    const prefix = d.split('*')[0];
    return prefix.length > 1 && p.startsWith(prefix);
  });
  if (blocked) {
    results.push({ ...t, verdict: 'blocked', note: 'robots.txt により Disallow' });
    console.log(`✗ ${t.name.padEnd(6, '　')} robots.txtによりアクセスせず`);
    continue;
  }

  await sleep(WAIT);
  let html = '', status = 0;
  try {
    const r = await fetch(t.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja' } });
    status = r.status;
    if (r.ok) html = await r.text();
  } catch (e) { status = `err:${e.message}`; }

  if (!html) {
    results.push({ ...t, verdict: 'fetch-failed', status });
    console.log(`✗ ${t.name.padEnd(6, '　')} 取得失敗 (${status})`);
    continue;
  }

  const text = toText(html);
  // --- 金額の判定
  // 登録免許税の軽減額（15万/7.5万/6万/3万）はどのページにも出るので受講料の signal から除く。
  // 数百円は証明書の交付手数料や返信用切手（市川市の110円がこれだった）なので除く。
  const TAX = new Set(['150,000円', '75,000円', '60,000円', '30,000円', '150000円', '75000円', '60000円', '30000円']);
  const yen = [...new Set(text.match(/[0-9,]{3,9}\s*円/g) || [])]
    .map((v) => v.replace(/\s/g, ''))
    .filter((v) => !TAX.has(v))
    .filter((v) => Number(v.replace(/[,円]/g, '')) >= 1000);

  // 「無料」はページ内に散在するため、行単位で文脈を見る。
  // 誤検出の実例: 「Adobe Readerをダウンロード（無料）」(北区)、「無料経営相談」(朝霞市)。
  const NOISE = /(Adobe|Reader|ダウンロード|プラグイン|閲覧|バナー)/;
  const COURSE = /(セミナー|講座|創業塾|起業塾|スクール|ゼミ|研修|カレッジ|アカデミー)/;
  const freeLines = text.split('\n').filter((l) => /無料/.test(l) && COURSE.test(l) && !NOISE.test(l));
  const free = freeLines.length > 0;

  // --- 日付の判定
  // 更新日・計画期間の終了日（令和13年3月31日など）は開催日ではないので、
  // 講座を示す語が同じ行にあるか、月日形式のものだけを開催日候補とする。
  const dateLines = text.split('\n').filter((l) =>
    /(?:令和|R)\s?[0-9０-９]{1,2}\s?年\s?[0-9０-９]{1,2}\s?月|[0-9]{1,2}月[0-9]{1,2}日/.test(l) &&
    !/(更新日|掲載日|計画期間|有効期限|認定|施行|改正|廃止|名称変更)/.test(l)
  );
  const dates = [...new Set(dateLines.flatMap((l) =>
    l.match(/(?:令和|R)\s?[0-9０-９]{1,2}\s?年\s?[0-9０-９]{1,2}\s?月[0-9０-９]{0,2}日?|[0-9]{1,2}月[0-9]{1,2}日/g) || []
  ))];

  // 受付状況の列を持つ自治体は信頼度が高いので拾う（千葉市・さいたま市・板橋公社の例）
  const statusWords = [...new Set(text.match(/受付中|受付終了|申込締切|随時開催中|募集終了|開催予定|キャンセル待ち/g) || [])];

  const hasMoney = yen.length > 0 || free;
  const hasDate = dates.length > 0;
  const hasStatus = statusWords.length > 0;
  // 金額と日付の両方、または「日付＋受付状況」があれば本登録に進める
  const verdict =
    (hasMoney && hasDate) || (hasDate && hasStatus) ? 'pass'
    : hasMoney || hasDate || hasStatus ? 'maybe'
    : 'fail';

  const r = {
    ...t, verdict, status,
    robots: rob.exists ? `${rob.disallow.length}行` : 'なし',
    updatedAt: (text.match(/(?:最終更新日|更新日)[：:\s]*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/) || [])[1] ?? null,
    minSessions: (text.match(/([0-9４-９4-9])回以上/) || [])[1] ?? null,
    subjects: ['経営', '財務', '人材育成', '販路開拓'].filter((s) => text.includes(s)).length,
    tables: (html.match(/<table/gi) || []).length,
    pdfs: [...new Set([...html.matchAll(/href="([^"]*\.pdf[^"]*)"/gi)].map((m) => m[1]))].length,
    yenSample: yen.slice(0, 5), hasFree: free, freeLines: freeLines.slice(0,2), dateSample: dates.slice(0, 4), statusWords,
  };
  results.push(r);

  const dir = path.join(import.meta.dirname, 'out', t.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'digest.txt'), text.slice(0, 20000));

  const mark = { pass: '○', maybe: '△', fail: '×' }[verdict];
  console.log(
    `${mark} ${t.name.padEnd(6, '　')} 金額:${(r.yenSample.join(',') || (free ? '無料' : 'なし')).slice(0, 22).padEnd(22)} 日付:${(r.dateSample[0] ?? 'なし').padEnd(10)} 状況:${(r.statusWords[0] ?? 'なし').padEnd(6)} 表${r.tables} PDF${r.pdfs}`
  );
}

const outDir = path.join(import.meta.dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });
// 過去の結果とマージする（実行のたびに上書きしてしまわないように）
const prevPath = path.join(outDir, 'screening.json');
const prev = fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, 'utf8')).results ?? [] : [];
const merged = [...prev.filter((o) => !results.some((n) => n.slug === o.slug)), ...results];
fs.writeFileSync(prevPath, JSON.stringify({ screenedAt: new Date().toISOString().slice(0, 10), total: merged.length, results: merged }, null, 2));

const c = (v) => results.filter((r) => r.verdict === v).length;
console.log(`\n○本登録に進める ${c('pass')} / △要確認 ${c('maybe')} / ×見送り ${c('fail')} / 取得失敗 ${c('fetch-failed') + c('blocked')}`);
