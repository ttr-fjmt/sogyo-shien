import fs from 'node:fs';
const p = 'astro.config.mjs';
let s = fs.readFileSync(p, 'utf8');

const oldBlock = `const dir = new URL('./src/data/municipalities/', import.meta.url);
const unpublished = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8')))
  .filter((m) => !m.publish?.ready)
  .map((m) => \`/area/\${m.prefSlug}/\${m.slug}/\`);`;

const newBlock = `const dir = new URL('./src/data/municipalities/', import.meta.url);
const all = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8')));

const unpublished = [
  ...all.filter((m) => !m.publish?.ready).map((m) => \`/area/\${m.prefSlug}/\${m.slug}/\`),
  // 掲載自治体がまだ1件もない都道府県ページも noindex なので外す。
  // （パンくずのリンク切れを防ぐためにページ自体は生成している）
  ...[...new Set(all.map((m) => m.prefSlug))]
    .filter((pref) => !all.some((m) => m.prefSlug === pref && m.publish?.ready))
    .map((pref) => \`/area/\${pref}/\`),
];`;

if (!s.includes(oldBlock)) throw new Error('unpublished ブロックが見つかりません');
s = s.replace(oldBlock, newBlock);
fs.writeFileSync(p, s);
console.log('sitemap のフィルタを更新しました');
