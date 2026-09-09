/**
 * 一次スクリーニング（手動）。TSVの各行を取得し、機械的に取れる項目だけで
 * 「本登録に進めるか」を仕分ける。本文の読解はしない（受講料・日程の判断は人がやる）。
 *
 *   node tools/screen.mjs tools/targets.tsv
 *
 * TSV: URL <TAB> slug <TAB> prefSlug <TAB> pref <TAB> name
 * 出力: tools/out/screening.json ＋ 各市の digest.txt
 *
 * 判定基準（推測で数値を作らないための線引き）:
 *   pass  = 金額の記述があり、かつ日付の記述がある（または 日付＋受付状況）
 *   maybe = 金額か日付か受付状況のどれか一方だけある
 *   fail  = どれも無い（掲載しても利用者が判断できない）
 *
 * 判定の中身は tools/lib/screen-core.mjs にある。定期実行の scan.mjs と共通。
 */
import fs from 'node:fs';
import path from 'node:path';
import { screenOne, readTargets, line } from './lib/screen-core.mjs';

const targetsFile = process.argv[2] ?? path.join(import.meta.dirname, 'targets.tsv');
const outDir = path.join(import.meta.dirname, 'out');

const results = [];
for (const t of readTargets(targetsFile)) {
  const r = await screenOne(t, { digestDir: outDir });
  results.push(r);
  console.log(line(r));
}

fs.mkdirSync(outDir, { recursive: true });
// 過去の結果とマージする（実行のたびに上書きしてしまわないように）
const prevPath = path.join(outDir, 'screening.json');
const prev = fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, 'utf8')).results ?? [] : [];
const merged = [...prev.filter((o) => !results.some((n) => n.slug === o.slug)), ...results];
fs.writeFileSync(
  prevPath,
  JSON.stringify({ screenedAt: new Date().toISOString().slice(0, 10), total: merged.length, results: merged }, null, 2)
);

const c = (v) => results.filter((r) => r.verdict === v).length;
console.log(
  `\n○本登録に進める ${c('pass')} / △要確認 ${c('maybe')} / ×見送り ${c('fail')} / 取得失敗 ${c('fetch-failed') + c('blocked')}`
);
