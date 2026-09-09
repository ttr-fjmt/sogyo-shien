/**
 * 掲載候補の定期スクリーニング。
 *
 *   node tools/scan.mjs [--update] [--limit N]
 *
 * 見るのは2種類:
 *   1. 掲載保留の自治体（publish.ready が false）
 *      日程や受講料が公表されたら掲載できるので、判定が pass に変わったら知らせる。
 *   2. tools/candidates.tsv に貯めた未登録の候補
 *      pass になったものを「登録候補」として知らせる。
 *
 * 毎週同じ ✗ の一覧を送っても読まないので、前回から判定が変わったものだけを報告する。
 * 前回の判定は tools/scan-state.json に持つ。
 *
 * 終了コード 1 = 知らせるべき変化あり（ワークフローがIssueを立てる）
 *
 * 注意: 判定はページに何が書いてあるかを機械的に見るだけで、
 * 掲載するかどうかの判断はしない。JSON化は人がダイジェストを読んで書く。
 */
import fs from 'node:fs';
import path from 'node:path';
import { screenOne, readTargets, line } from './lib/screen-core.mjs';

const root = path.join(import.meta.dirname, '..');
const dataDir = path.join(root, 'src/data/municipalities');
const outDir = path.join(import.meta.dirname, 'out');
const statePath = path.join(import.meta.dirname, 'scan-state.json');
const candidatesFile = path.join(import.meta.dirname, 'candidates.tsv');

const UPDATE = process.argv.includes('--update');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const municipalities = fs
  .readdirSync(dataDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')));

const registered = new Set(municipalities.map((m) => m.slug));
const pending = municipalities.filter((m) => !m.publish?.ready);

// --- 巡回対象を組み立てる
const targets = [];
for (const m of pending) {
  for (const [i, s] of (m.sources ?? []).entries()) {
    if (!s?.url) continue;
    targets.push({
      url: s.url,
      slug: i === 0 ? m.slug : `${m.slug}--${i}`,
      prefSlug: m.prefSlug,
      pref: m.pref,
      name: (m.sources.length > 1 ? `${m.name}（出典${i + 1}）` : m.name),
      kind: 'pending',
      blockers: m.publish?.blockers ?? [],
    });
  }
}

if (fs.existsSync(candidatesFile)) {
  for (const t of readTargets(candidatesFile)) {
    // すでに登録済みの自治体は 1 のループで見ているので二重に取りに行かない
    if (registered.has(t.slug)) continue;
    targets.push({ ...t, kind: 'candidate' });
  }
}

const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { seen: {} };
state.seen ??= {};

const results = [];
let n = 0;
for (const t of targets) {
  if (n >= LIMIT) {
    console.error(`  上限 ${LIMIT} 件に達したので残りは次回に回します`);
    break;
  }
  n++;
  const r = await screenOne(t, { digestDir: outDir });
  results.push(r);
  console.error(line(r));
}

// --- 前回から変わったものだけを拾う
//
// 判定（pass/maybe/fail）だけを見ていると取りこぼす。
// たとえば「日付＋受付状況」で既に pass のページに、あとから受講料が載った場合、
// 判定は pass のままなので気づけない。金額の有無は日付と違って年度で回らないので、
// 「金額が無い→有る」に変わったことも合図として扱う。
const moneyOf = (r) => (r.yenSample?.length ? r.yenSample.join(',') : r.hasFree ? '無料' : '');

const improved = [];
const regressed = [];
const rank = { blocked: -1, 'fetch-failed': -1, fail: 0, maybe: 1, pass: 2 };
for (const r of results) {
  const prev = state.seen[r.url];
  const before = prev?.verdict ?? null;
  const moneyBefore = prev?.money ?? null;
  const money = moneyOf(r);
  const entry = { ...r, before, moneyBefore, money };

  if (before === null) {
    // 初回。pass だけ知らせる（fail を初回から並べても読む気にならない）
    if (r.verdict === 'pass') improved.push(entry);
    continue;
  }
  if (before !== r.verdict) {
    ((rank[r.verdict] ?? 0) > (rank[before] ?? 0) ? improved : regressed).push(entry);
    continue;
  }
  // 判定は同じでも、金額が新たに載ったなら知らせる
  if (!moneyBefore && money) improved.push({ ...entry, reason: 'money' });
}

const ymd = new Date().toISOString().slice(0, 10);
const out = [];
out.push(`# 掲載候補のスクリーニング　${ymd}`);
out.push('');
out.push(`巡回 ${results.length} 件（掲載保留 ${results.filter((r) => r.kind === 'pending').length} / 未登録の候補 ${results.filter((r) => r.kind === 'candidate').length}）`);
out.push('');

const V = { pass: '○ 本登録に進める', maybe: '△ 要確認', fail: '× 見送り', blocked: '✗ robots.txtで取得せず', 'fetch-failed': '✗ 取得失敗' };
const detail = (r) => {
  const b = [];
  b.push(`- 金額: ${r.yenSample?.length ? r.yenSample.join(', ') : r.hasFree ? '無料の記述あり' : 'なし'}`);
  b.push(`- 日付: ${r.dateSample?.length ? r.dateSample.join(', ') : 'なし'}`);
  if (r.statusWords?.length) b.push(`- 受付状況: ${r.statusWords.join(', ')}`);
  if (r.updatedAt) b.push(`- ページの更新日: ${r.updatedAt}`);
  if (r.freeLines?.length) b.push(`- 「無料」の該当行: ${r.freeLines.map((l) => `\`${l.slice(0, 60)}\``).join(' / ')}`);
  return b.join('\n');
};

if (improved.length) {
  out.push('## 判定が上がりました', '');
  for (const r of improved) {
    out.push(`### ${r.name}${r.kind === 'pending' ? '（掲載保留中）' : '（未登録）'}`);
    out.push(
      r.reason === 'money'
        ? `判定は ${V[r.verdict]} のままですが、**受講料の記述が新たに出ました**（前回: なし → 今回: ${r.money}）`
        : `${V[r.before] ?? '（初回）'} → **${V[r.verdict]}**`
    );
    out.push('');
    out.push(r.url);
    out.push('');
    out.push(detail(r));
    if (r.kind === 'pending' && r.blockers?.length) {
      out.push('', `これまでの保留理由: ${r.blockers.join(' / ')}`);
    }
    // tools/out/ は .gitignore しているので、CIで作ったダイジェストはリポジトリに残らない。
    // 手元で読むためのコマンドをそのまま貼る。
    out.push('', '本文を読むには:', '```bash', `printf '${r.url}\\t${r.slug}\\t${r.prefSlug}\\t${r.pref}\\t${r.name}\\n' > tools/_scan.tsv && node tools/screen.mjs tools/_scan.tsv && cat tools/out/${r.slug}/digest.txt`, '```', '');
  }
} else {
  out.push('判定が上がったものはありませんでした。', '');
}

if (regressed.length) {
  out.push('## 判定が下がりました', '');
  out.push('（募集が終わった、ページが消えた、などの可能性があります）', '');
  for (const r of regressed) {
    out.push(`- **${r.name}** ${V[r.before]} → ${V[r.verdict]} — ${r.url}`);
  }
  out.push('');
}

out.push('---', '');
out.push('この一覧は機械的な判定です。掲載するかどうかは、ダイジェストを読んでから決めてください。');

console.log(out.join('\n'));

if (UPDATE) {
  for (const r of results) {
    state.seen[r.url] = { verdict: r.verdict, money: moneyOf(r), name: r.name, checkedAt: ymd };
  }
  state.scannedAt = ymd;
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
}

process.exit(improved.length || regressed.length ? 1 : 0);
