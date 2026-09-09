import fs from 'node:fs';
const p = 'src/lib/fmt.js';
let s = fs.readFileSync(p, 'utf8');

const from = `  if (m.courses?.some(isFree))
    return \`\${m.name}で会社設立｜無料で登録免許税を半額にする方法と講座一覧\${ym}\`;
  if (priced.length)
    return \`\${m.name}で会社設立｜受講料\${yen(Math.min(...priced.map((c) => c.fee.amount)))}から登録免許税を半額に\${ym}\`;
  if (openNow.length)
    return \`\${m.name}で会社設立｜募集中の講座\${openNow.length}件と登録免許税半額の条件\${ym}\`;`;

const to = `  // 見出しは「その自治体で一番効く数字」＋「対象講座の件数」で組む。
  // 片方だけだと、条件の似た自治体どうしで同じタイトルになる。
  const n = m.courses?.length ?? 0;
  const free = m.courses?.filter(isFree) ?? [];
  const freeOnline = free.some((c) => c.format === 'online' || c.format === 'hybrid');

  if (free.length && freeOnline)
    return \`\${m.name}で会社設立｜無料のオンライン講座あり。登録免許税半額の条件と講座\${n}件\${ym}\`;
  if (free.length)
    return \`\${m.name}で会社設立｜無料講座\${free.length}件を含む\${n}件。登録免許税を半額にする方法\${ym}\`;
  if (priced.length)
    return \`\${m.name}で会社設立｜受講料\${yen(Math.min(...priced.map((c) => c.fee.amount)))}から。登録免許税半額の条件と講座\${n}件\${ym}\`;
  if (openNow.length)
    return \`\${m.name}で会社設立｜募集中\${openNow.length}件・講座\${n}件。登録免許税半額の条件\${ym}\`;`;

if (!s.includes(from)) throw new Error('pageTitle の分岐が見つかりません');
fs.writeFileSync(p, s.replace(from, to));
console.log('pageTitle を更新しました');
