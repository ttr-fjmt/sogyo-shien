/**
 * ページを1本取得して、機械的に取れる項目だけで仕分ける中身。
 *
 * 手動の screen.mjs と、定期実行の scan.mjs の両方から使う。
 * ここに置いてあるのは「本文を読まなくても判断できること」だけで、
 * 受講料が講座のものか手数料かといった判断は人がやる。
 *
 * 取得の作法（相手のサーバーに迷惑をかけないための約束）:
 *   - 1リクエストあたり3秒待つ。並列アクセスはしない
 *   - robots.txt が Disallow しているパスは取得しない
 *   - User-Agent は一般的なブラウザのもの
 */
import fs from 'node:fs';
import path from 'node:path';

export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
export const WAIT = 3000;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const toText = (html) =>
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
export async function robotsFor(origin) {
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

/** robots.txt の Disallow に当たるか。
 *  ワイルドカード開始（*.pdf$ 等）は前方一致に落とすと空文字になり全パスに誤ヒットするので、
 *  前方一致で判定できるのは「/」始まりのパターンだけに限る。 */
export function isBlocked(disallow, pathname) {
  return disallow.some((d) => {
    if (d === '/' || !d.startsWith('/')) return false;
    const prefix = d.split('*')[0];
    return prefix.length > 1 && pathname.startsWith(prefix);
  });
}

export function extract(text, html = '') {
  // --- 金額
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

  // --- 日付
  // 更新日・計画期間の終了日（令和13年3月31日など）は開催日ではないので除く。
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

  return {
    verdict,
    updatedAt: (text.match(/(?:最終更新日|更新日)[：:\s]*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/) || [])[1] ?? null,
    minSessions: (text.match(/([0-9４-９4-9])回以上/) || [])[1] ?? null,
    subjects: ['経営', '財務', '人材育成', '販路開拓'].filter((s) => text.includes(s)).length,
    tables: (html.match(/<table/gi) || []).length,
    pdfs: [...new Set([...html.matchAll(/href="([^"]*\.pdf[^"]*)"/gi)].map((m) => m[1]))].length,
    yenSample: yen.slice(0, 5),
    hasFree: free,
    freeLines: freeLines.slice(0, 2),
    dateSample: dates.slice(0, 4),
    statusWords,
  };
}

/** 1件を取得して仕分ける。digestDir を渡すと本文をダイジェストとして保存する。 */
export async function screenOne(t, { digestDir = null } = {}) {
  const u = new URL(t.url);
  const rob = await robotsFor(u.origin);
  if (isBlocked(rob.disallow, u.pathname)) {
    return { ...t, verdict: 'blocked', note: 'robots.txt により Disallow' };
  }

  await sleep(WAIT);
  let html = '', status = 0;
  try {
    const r = await fetch(t.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja' } });
    status = r.status;
    if (r.ok) html = await r.text();
  } catch (e) {
    status = `err:${e.message}`;
  }
  if (!html) return { ...t, verdict: 'fetch-failed', status };

  const text = toText(html);
  const r = { ...t, status, robots: rob.exists ? `${rob.disallow.length}行` : 'なし', ...extract(text, html) };

  if (digestDir) {
    const dir = path.join(digestDir, t.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'digest.txt'), text.slice(0, 20000));
  }
  return r;
}

/** TSV（URL / slug / prefSlug / pref / name）を読む。# 始まりの行はコメント。 */
export function readTargets(file) {
  return fs.readFileSync(file, 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [url, slug, prefSlug, pref, name] = l.split('\t');
      return { url, slug, prefSlug, pref, name };
    });
}

export function line(r) {
  const mark = { pass: '○', maybe: '△', fail: '×', blocked: '✗', 'fetch-failed': '✗' }[r.verdict] ?? '?';
  if (r.verdict === 'blocked') return `${mark} ${r.name} robots.txtによりアクセスせず`;
  if (r.verdict === 'fetch-failed') return `${mark} ${r.name} 取得失敗 (${r.status})`;
  const money = (r.yenSample.join(',') || (r.hasFree ? '無料' : 'なし')).slice(0, 22);
  return `${mark} ${r.name.padEnd(6, '　')} 金額:${money.padEnd(22)} 日付:${(r.dateSample[0] ?? 'なし').padEnd(10)} 状況:${(r.statusWords[0] ?? 'なし').padEnd(6)} 表${r.tables} PDF${r.pdfs}`;
}
