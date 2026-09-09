import fs from 'node:fs';
const p = 'src/pages/area/[prefSlug]/index.astro';
let s = fs.readFileSync(p, 'utf8');

// 1. 掲載ゼロの県でも壊れないように、統計とタイトルを分岐させる
const oldMeta = `const title = \`\${pref}で会社設立｜登録免許税が半額になる市区町村と創業講座\${ym}\`;
const description = \`\${pref}で会社を設立すると登録免許税が15万円→7万5千円に。掲載している\${list.length}市区町村の対象講座\${totalCourses}件を、受講料・開催日つきで比較できます。\`;

const breadcrumbs = [{ name: pref, url: \`/area/\${Astro.params.prefSlug}/\` }];`;

const newMeta = `const empty = list.length === 0;

const title = empty
  ? \`\${pref}で会社設立｜登録免許税が半額になる制度の調べ方\`
  : \`\${pref}で会社設立｜登録免許税が半額になる市区町村と創業講座\${ym}\`;
const description = empty
  ? \`\${pref}は調査中です。会社設立時の登録免許税を15万円→7万5千円にする「特定創業支援等事業」の仕組みと、掲載済みの市区町村をご案内します。\`
  : \`\${pref}で会社を設立すると登録免許税が15万円→7万5千円に。掲載している\${list.length}市区町村の対象講座\${totalCourses}件を、受講料・開催日つきで比較できます。\`;

const breadcrumbs = [{ name: pref, url: \`/area/\${Astro.params.prefSlug}/\` }];`;

if (!s.includes(oldMeta)) throw new Error('title/description が見つかりません');
s = s.replace(oldMeta, newMeta);

// 2. Base に noindex を渡す
s = s.replace(
  '<Base title={title} description={description} breadcrumbs={breadcrumbs}>',
  '<Base title={title} description={description} breadcrumbs={breadcrumbs} noindex={empty}>'
);

// 3. 掲載ゼロなら、数字と一覧表を出さずに説明だけ出す
const oldBody = `  <p class="standfirst">
    市区町村の「特定創業支援等事業」に指定された講座を受けると、株式会社の設立時の登録免許税が
    <strong>15万円から7万5千円</strong>になります。受ける講座は市区町村ごとに違うため、
    {pref}については{list.length}市区町村を掲載しています。
  </p>`;

const newBody = `  <p class="standfirst">
    市区町村の「特定創業支援等事業」に指定された講座を受けると、株式会社の設立時の登録免許税が
    <strong>15万円から7万5千円</strong>になります。受ける講座は市区町村ごとに違うため、
    {empty
      ? \`\${pref}は現在調査中で、まだ掲載できる市区町村がありません。\`
      : \`\${pref}については\${list.length}市区町村を掲載しています。\`}
  </p>`;

if (!s.includes(oldBody)) throw new Error('standfirst が見つかりません');
s = s.replace(oldBody, newBody);

// 数字・一覧表・受講料くらべへの導線は、掲載がある県だけ
s = s.replace('  <div class="figs">', '  {!empty && (\n  <div class="figs">');
s = s.replace(`      <p class="u">{priced.length ? \`最高 \${yen(Math.max(...priced.map((c) => c.fee.amount)))}\` : '判明分なし'}</p>
    </div>
  </div>`, `      <p class="u">{priced.length ? \`最高 \${yen(Math.max(...priced.map((c) => c.fee.amount)))}\` : '判明分なし'}</p>
    </div>
  </div>
  )}`);

s = s.replace('  <h2>{pref}の市区町村</h2>', '  {!empty && (\n  <>\n  <h2>{pref}の市区町村</h2>');
s = s.replace(`    <a href="/compare/fee/">全国の受講料くらべ</a>もご覧ください。
  </p>`, `    <a href="/compare/fee/">全国の受講料くらべ</a>もご覧ください。
  </p>
  </>
  )}`);

fs.writeFileSync(p, s);
console.log('本文を分岐させました');
