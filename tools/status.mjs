/**
 * 今どこまで進んでいるかを出す。
 *
 *   npm run status
 *
 * 件数をドキュメントに直書きすると必ず古くなるので、データから数える。
 * 引き継ぎや、作業を再開したときの現在地の確認に使う。
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const dataDir = path.join(root, 'src/data/municipalities');

const ms = fs
  .readdirSync(dataDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')))
  .sort((a, b) => a.kana.localeCompare(b.kana, 'ja'));

const pub = ms.filter((m) => m.publish?.ready);
const pending = ms.filter((m) => !m.publish?.ready);
const courses = pub.flatMap((m) => m.courses ?? []);
const priced = courses.filter((c) => typeof c.fee?.amount === 'number');
const yen = (n) => n.toLocaleString('ja-JP') + '円';

const out = [];
out.push('■ 掲載状況');
out.push(`  調査済み ${ms.length} 市区町村 ／ 掲載 ${pub.length} ／ 掲載保留 ${pending.length}`);
out.push(`  都道府県 ${[...new Set(pub.map((m) => m.pref))].length}`);
out.push('');
out.push('■ 講座');
out.push(`  ${courses.length}件（募集中 ${courses.filter((c) => c.status === 'open').length} ／ 終了 ${courses.filter((c) => c.status === 'closed').length} ／ 不明 ${courses.filter((c) => c.status === 'unknown').length}）`);
out.push(`  無料 ${courses.filter((c) => c.fee?.free).length} ／ 受講料が判明 ${priced.length} ／ 記載なし ${courses.filter((c) => c.fee?.unknown).length}`);
if (priced.length) {
  const amts = priced.map((c) => c.fee.amount);
  out.push(`  受講料の幅 ${yen(Math.min(...amts))} 〜 ${yen(Math.max(...amts))}`);
}
out.push(`  オンライン・ハイブリッド ${courses.filter((c) => c.format === 'online' || c.format === 'hybrid').length} ／ 女性向け ${courses.filter((c) => c.audience?.includes('women')).length}`);
out.push('');

// 最終確認からの経過。鮮度がこのサイトの売りなので、古いものを目立たせる。
const today = new Date();
const stale = pub
  .map((m) => ({ name: m.name, days: Math.floor((today - new Date(m.lastVerified)) / 86400000), at: m.lastVerified }))
  .filter((x) => x.days >= 90)
  .sort((a, b) => b.days - a.days);
out.push('■ 鮮度');
out.push(`  最終確認が90日以上前: ${stale.length}件${stale.length ? '' : '（なし）'}`);
for (const s of stale.slice(0, 10)) out.push(`    ${s.name}（${s.at} ／ ${s.days}日前）`);
out.push('');

out.push('■ 掲載保留の理由');
for (const m of pending) out.push(`  ${m.name}: ${(m.publish?.blockers ?? []).join(' / ') || '（理由の記載なし）'}`);
out.push('');

// 監視・候補の状況
const snapDir = path.join(root, 'tools/snapshots');
const snaps = fs.existsSync(snapDir) ? fs.readdirSync(snapDir).filter((f) => f.endsWith('.json')).length : 0;
const statePath = path.join(root, 'tools/scan-state.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : null;
out.push('■ 自動巡回');
out.push(`  差分検知（watch.yml・毎週月曜7時JST）: ${snaps}ページ`);
if (state) {
  const v = Object.values(state.seen ?? {});
  const c = (k) => v.filter((e) => e.verdict === k).length;
  out.push(`  候補スクリーニング（scan.yml・毎週月曜8時JST）: ${v.length}ページ（前回 ${state.scannedAt}）`);
  out.push(`    ○${c('pass')} △${c('maybe')} ×${c('fail')} 取得失敗${c('fetch-failed') + c('blocked')}`);
} else {
  out.push('  候補スクリーニング: まだ実行されていません');
}

console.log(out.join('\n'));
