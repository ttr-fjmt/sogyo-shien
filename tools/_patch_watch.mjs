import fs from 'node:fs';
const p = 'tools/watch.mjs';
let s = fs.readFileSync(p, 'utf8');

// 出典が複数ある自治体（制度ページ＋講座ページ）は、講座ページ側で
// 受講料や日程が変わる。1件目だけを見ていると取りこぼす。
const oldStart = `for (const m of municipalities) {
  const url = m.sources?.[0]?.url;
  if (!url) continue;

  // 最終確認からの経過日数（サイトの売りが鮮度なので、これ自体を報告する）
  const days = Math.floor((today - new Date(m.lastVerified)) / 86400000);
  if (days >= 90) stale.push({ name: m.name, days, lastVerified: m.lastVerified });

  if (!(await allowed(url))) {
    failed.push({ name: m.name, url, reason: 'robots.txt により Disallow' });
    continue;
  }`;

const newStart = `for (const m of municipalities) {
  const sources = (m.sources ?? []).filter((s) => s?.url);
  if (!sources.length) continue;

  // 最終確認からの経過日数（サイトの売りが鮮度なので、これ自体を報告する）
  const days = Math.floor((today - new Date(m.lastVerified)) / 86400000);
  if (days >= 90) stale.push({ name: m.name, days, lastVerified: m.lastVerified });

  // 出典が複数ある自治体は、講座ページ側で受講料や日程が変わることがある。
  // 1件目（制度ページ）だけを見ていると取りこぼすので、全部を巡回する。
  for (const [i, src] of sources.entries()) {
  const url = src.url;
  const label = sources.length > 1 ? \`\${m.name}（出典\${i + 1}）\` : m.name;

  if (!(await allowed(url))) {
    failed.push({ name: label, url, reason: 'robots.txt により Disallow' });
    continue;
  }`;

if (!s.includes(oldStart)) throw new Error('ループの先頭が見つかりません');
s = s.replace(oldStart, newStart);

// ループ内の m.name / snapPath / changed.push を差し替える
const oldMid = `  } catch (e) {
    failed.push({ name: m.name, url, reason: e.message });
    continue;
  }
  checked++;

  const now = extract(toText(html));
  const snapPath = path.join(snapDir, \`\${m.slug}.json\`);`;

const newMid = `  } catch (e) {
    failed.push({ name: label, url, reason: e.message });
    continue;
  }
  checked++;

  const now = extract(toText(html));
  // 1件目は既存のスナップショット名を保つ（過去の記録を捨てないため）
  const snapPath = path.join(snapDir, i === 0 ? \`\${m.slug}.json\` : \`\${m.slug}--\${i}.json\`);`;

if (!s.includes(oldMid)) throw new Error('snapPath が見つかりません');
s = s.replace(oldMid, newMid);

s = s.replace(
  '    console.error(`  初回記録 ${m.name}`);',
  '    console.error(`  初回記録 ${label}`);'
);

const oldEnd = `  if (meaningful || d.body) {
    changed.push({ name: m.name, slug: m.slug, url, lastVerified: m.lastVerified, meaningful: !!meaningful, d });
    if (UPDATE) fs.writeFileSync(snapPath, JSON.stringify({ url, ...now }, null, 2));
  }
}`;

const newEnd = `  if (meaningful || d.body) {
    changed.push({ name: label, slug: m.slug, url, lastVerified: m.lastVerified, meaningful: !!meaningful, d });
    if (UPDATE) fs.writeFileSync(snapPath, JSON.stringify({ url, ...now }, null, 2));
  }
  }
}`;

if (!s.includes(oldEnd)) throw new Error('ループの末尾が見つかりません');
s = s.replace(oldEnd, newEnd);

fs.writeFileSync(p, s);
console.log('watch.mjs を全出典巡回に変更しました');
