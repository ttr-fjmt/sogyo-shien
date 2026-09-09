import fs from 'node:fs';

// --- 1. 自治体ごとに手書きの見出しを持てるようにする
{
  const p = 'src/lib/fmt.js';
  let s = fs.readFileSync(p, 'utf8');
  const from = `  const priced = m.courses?.filter((c) => typeof c.fee?.amount === 'number') ?? [];
  const openNow = m.courses?.filter((c) => c.status === 'open') ?? [];`;
  const to = `  const priced = m.courses?.filter((c) => typeof c.fee?.amount === 'number') ?? [];
  const openNow = m.courses?.filter((c) => c.status === 'open') ?? [];

  // その自治体でしか言えないことがあるなら、データ側に書いたものを優先する。
  // 自動生成だけだと、条件が同じ自治体どうしで同じタイトルが並んでしまう。
  if (m.titleHook) return \`\${m.name}で会社設立｜\${m.titleHook}\${ym}\`;`;
  if (!s.includes(from)) throw new Error('pageTitle の変数宣言が見つかりません');
  fs.writeFileSync(p, s.replace(from, to));
  console.log('pageTitle に titleHook を追加');
}

// --- 2. 同じタイトルになっていた7自治体に、その市でしか言えない見出しを書く
const hooks = {
  funabashi: '信用保証料が全額補給される条件',
  hamamatsu: '市の融資利率が1.3%に下がる条件',
  naha: '創業融資の自己資金が半分で済む条件',
  niigata: '開業資金の利子が3年間ゼロになる条件',
  sagamihara: '市の融資が0.5%以内になる条件',
  sendai: '省エネ設備の補助まで受けられる条件',
  shibuya: 'オンライン完結の創業セミナーと次回開講',
};

for (const [slug, hook] of Object.entries(hooks)) {
  const p = `src/data/municipalities/${slug}.json`;
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  // slug の直後に置くと、データを開いたときに目に入る
  const out = {};
  for (const [k, v] of Object.entries(m)) {
    out[k] = v;
    if (k === 'kind') out.titleHook = hook;
  }
  if (!out.titleHook) out.titleHook = hook;
  fs.writeFileSync(p, JSON.stringify(out, null, 2) + '\n');
  console.log(`${m.name}: ${hook}`);
}
