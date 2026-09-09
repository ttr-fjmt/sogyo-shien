import fs from 'node:fs';

// --- 1. 掲載基準の文言（トップページ）
{
  const p = 'src/pages/index.astro';
  let s = fs.readFileSync(p, 'utf8');
  const from = `          受講料か開催日のどちらも公表されていない自治体は、掲載しても利用者が判断できません。
          実施機関側の情報が取れ次第、公開に切り替えます。`;
  const to = `          受講料・開催日・国の3措置以外の上乗せ支援のいずれも公表されていない自治体は、
          掲載しても利用者が判断できません。情報が取れ次第、公開に切り替えます。`;
  if (!s.includes(from)) throw new Error('index.astro の基準文が見つかりません');
  fs.writeFileSync(p, s.replace(from, to));
  console.log('index.astro の基準文を更新');
}

// --- 2. 掲載基準の文言（都道府県ページ）
{
  const p = 'src/pages/area/[prefSlug]/index.astro';
  let s = fs.readFileSync(p, 'utf8');
  const from = `    掲載しているのは、受講料か開催日のいずれかが公表されている市区町村です。
    どちらも公表されていない市区町村は、掲載しても判断材料にならないため公開していません
    （調査済み{municipalities.length}市区町村のうち{published.length}市区町村を掲載）。`;
  const to = `    掲載しているのは、受講料・開催日・国の3措置（登録免許税の軽減、創業関連保証の特例、
    日本政策金融公庫の金利引き下げ）以外の上乗せ支援のうち、いずれかが公表されている市区町村です。
    どれも公表されていない市区町村は、掲載しても判断材料にならないため公開していません
    （調査済み{municipalities.length}市区町村のうち{published.length}市区町村を掲載）。`;
  if (!s.includes(from)) throw new Error('都道府県ページの基準文が見つかりません');
  fs.writeFileSync(p, s.replace(from, to));
  console.log('都道府県ページの基準文を更新');
}

// --- 3. 出典：リンクを張らない出典に対応する
//     福岡市は「トップページ以外の個別ページへのリンクは担当課へ問い合わせ」という
//     方針を出している。監視は続けたいので URL はデータに残し、表示だけリンクを外す。
{
  const p = 'src/pages/area/[prefSlug]/[slug].astro';
  let s = fs.readFileSync(p, 'utf8');
  const from = `      {m.sources.map((s) => (
        <li>{s.title} <a href={s.url} rel="nofollow">{s.url}</a></li>
      ))}`;
  const to = `      {m.sources.map((s) => (
        <li>
          {s.title}{' '}
          {s.noLink ? <span class="src-url">{s.url}</span> : <a href={s.url} rel="nofollow">{s.url}</a>}
          {s.note && <span class="src-note">{s.note}</span>}
        </li>
      ))}`;
  if (!s.includes(from)) throw new Error('出典の描画部分が見つかりません');
  fs.writeFileSync(p, s.replace(from, to));
  console.log('出典の描画をリンク有無に対応させた');
}

// --- 4. その分のCSS
{
  const p = 'src/styles/tokens.css';
  let c = fs.readFileSync(p, 'utf8');
  if (c.includes('.src-url')) throw new Error('出典のCSSが既にあります');
  c = c.trimEnd() + `

/* リンクを張らない出典（先方がリンクに条件を付けている場合） */
.src-url{word-break:break-all;color:var(--ink-faint)}
.src-note{display:block;margin-top:.25rem;color:var(--ink-faint);font-size:.94em}
`;
  fs.writeFileSync(p, c);
  console.log('出典用のCSSを追加');
}
