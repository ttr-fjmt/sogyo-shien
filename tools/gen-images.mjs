/**
 * OGP画像とファビコンを生成する。
 *
 *   npm i --no-save sharp && node tools/gen-images.mjs
 *
 * sharp は生成のときだけ使うので、依存には入れない（CIのビルドを重くしないため）。
 * 出力した PNG / SVG は public/ にコミットする。
 * 配色はサイトのデザイントークンと同じ（紙白・藍墨・朱）。
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const pub = path.join(import.meta.dirname, '..', 'public');

const MINCHO = 'Yu Mincho, Hiragino Mincho ProN, MS PMincho, serif';
const GOTHIC = 'Yu Gothic, Hiragino Kaku Gothic ProN, Meiryo, sans-serif';

const ogp = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#FBFAF7"/>
  <rect width="1200" height="12" fill="#B7452F"/>
  <text x="80" y="205" font-family="${MINCHO}" font-size="66" font-weight="bold" fill="#1A2238">会社をつくる前に、</text>
  <text x="80" y="297" font-family="${MINCHO}" font-size="66" font-weight="bold" fill="#1A2238">登録免許税は半額にできる</text>
  <rect x="80" y="342" width="280" height="4" fill="#B7452F"/>
  <text x="80" y="408" font-family="${GOTHIC}" font-size="31" fill="#525C73">市区町村ごとの特定創業支援等事業を、</text>
  <text x="80" y="455" font-family="${GOTHIC}" font-size="31" fill="#525C73">受講料・日程つきで比較できます</text>
  <text x="80" y="562" font-family="${GOTHIC}" font-size="27" fill="#7B8397">sogyo-shien.com</text>
  <text x="1120" y="562" text-anchor="end" font-family="${MINCHO}" font-size="50" font-weight="bold" fill="#B7452F">創業支援ポータル</text>
</svg>`;

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#B7452F"/>
  <text x="256" y="352" text-anchor="middle" font-family="${MINCHO}" font-size="320" font-weight="bold" fill="#FBFAF7">創</text>
</svg>`;

await sharp(Buffer.from(ogp)).png().toFile(path.join(pub, 'ogp-image.png'));
await sharp(Buffer.from(icon)).resize(180, 180).png().toFile(path.join(pub, 'apple-touch-icon.png'));
fs.writeFileSync(path.join(pub, 'favicon.svg'), icon);

console.log('生成しました:');
for (const f of ['ogp-image.png', 'apple-touch-icon.png', 'favicon.svg']) {
  console.log(`  ${f}  ${fs.statSync(path.join(pub, f)).size} bytes`);
}
