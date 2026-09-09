import fs from 'node:fs';
const p = 'src/lib/fmt.js';
let s = fs.readFileSync(p, 'utf8');

const from = `export function pageTitle(m, now = new Date()) {
  const ym = \`【\${now.getFullYear()}年\${now.getMonth() + 1}月更新】\`;
  if (m.courses?.some(isFree))
    return \`\${m.name}で会社設立｜無料で登録免許税を半額にする方法と講座一覧\${ym}\`;
  if (m.localSupport?.length)
    return \`\${m.name}で会社設立｜市独自の上乗せ支援と登録免許税半額の条件\${ym}\`;
  return \`\${m.name}で会社設立｜登録免許税が半額になる制度と創業セミナー\${ym}\`;
}`;

const to = `export function pageTitle(m, now = new Date()) {
  const ym = \`【\${now.getFullYear()}年\${now.getMonth() + 1}月更新】\`;
  const priced = m.courses?.filter((c) => typeof c.fee?.amount === 'number') ?? [];
  const openNow = m.courses?.filter((c) => c.status === 'open') ?? [];

  // 自治体数が増えると同じタイトルが並ぶ。ページが実際に持っている情報で
  // 順に切り分けて、検索結果で見分けがつくようにする。
  if (m.courses?.some(isFree))
    return \`\${m.name}で会社設立｜無料で登録免許税を半額にする方法と講座一覧\${ym}\`;
  if (priced.length)
    return \`\${m.name}で会社設立｜受講料\${yen(Math.min(...priced.map((c) => c.fee.amount)))}から登録免許税を半額に\${ym}\`;
  if (openNow.length)
    return \`\${m.name}で会社設立｜募集中の講座\${openNow.length}件と登録免許税半額の条件\${ym}\`;
  if (m.localSupport?.length)
    return \`\${m.name}で会社設立｜市独自の上乗せ支援と登録免許税半額の条件\${ym}\`;
  return \`\${m.name}で会社設立｜登録免許税が半額になる制度と創業セミナー\${ym}\`;
}`;

if (!s.includes(from)) throw new Error('pageTitle が見つかりません');
fs.writeFileSync(p, s.replace(from, to));
console.log('pageTitle を5パターンに分けました');
