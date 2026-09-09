import fs from 'node:fs';
const p = 'src/pages/area/[prefSlug]/index.astro';
let s = fs.readFileSync(p, 'utf8');

const oldHead = `export async function getStaticPaths() {
  const byPref = published.reduce((acc, m) => {
    (acc[m.prefSlug] ??= []).push(m);
    return acc;
  }, {});
  return Object.entries(byPref).map(([prefSlug, list]) => ({
    params: { prefSlug },
    props: { list: list.sort((a, b) => a.kana.localeCompare(b.kana, 'ja')), pref: list[0].pref },
  }));
}`;

const newHead = `export async function getStaticPaths() {
  // 掲載前の市区町村しかない県でもページを作る。
  // 市区町村ページのパンくずが必ずここを指すため、無いとリンク切れになる。
  const byPref = municipalities.reduce((acc, m) => {
    (acc[m.prefSlug] ??= []).push(m);
    return acc;
  }, {});
  return Object.entries(byPref).map(([prefSlug, all]) => ({
    params: { prefSlug },
    props: {
      list: all.filter((m) => m.publish?.ready).sort((a, b) => a.kana.localeCompare(b.kana, 'ja')),
      pref: all[0].pref,
    },
  }));
}`;

if (!s.includes(oldHead)) throw new Error('getStaticPaths が見つかりません');
s = s.replace(oldHead, newHead);
fs.writeFileSync(p, s);
console.log('getStaticPaths を差し替えました');
