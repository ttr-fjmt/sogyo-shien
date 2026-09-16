/**
 * README.md と DEPLOY.md の古くなった記述を直す。
 *
 * 引き継ぎ資料を作るにあたって読み直したら、次がずれていた:
 *   - リポジトリが private のままになっていた（実際は public）
 *   - 掲載基準が初期の案（講座3件以上）のままで、現在の運用と違う
 *   - title の振り分けが3パターンのままで、実装は6パターン＋titleHook
 *   - スクラッチ領域用の MAX_PATH 回避策が「重要」として残っていた
 *   - 件数が直書きされていた（古くなるので npm run status に寄せる）
 */
import fs from 'node:fs';

// --- DEPLOY.md
{
  const p = 'DEPLOY.md';
  let s = fs.readFileSync(p, 'utf8');
  const from = '| リポジトリ | ttr-fjmt/sogyo-shien（private） |';
  const to = '| リポジトリ | ttr-fjmt/sogyo-shien（**public**） |';
  if (!s.includes(from)) throw new Error('DEPLOY.md の該当行が見つかりません');
  s = s.replace(from, to);
  // public にした理由を残しておく（private に戻すと Pages が止まるため）
  const anchor = '既存3サイトも DNS は Cloudflare、配信は GitHub Pages です。';
  s = s.replace(
    anchor,
    'リポジトリを public にしているのは、**private リポジトリの GitHub Pages が有料プラン限定**のためです。\n既存3サイト（agent-zukan / skillup-zukan / freelance-anken-zukan）も public で運用しています。\nprivate に戻すと公開が止まります。\n\n' + anchor
  );
  fs.writeFileSync(p, s);
  console.log('DEPLOY.md: リポジトリの可視性を public に修正');
}

// --- README.md
{
  const p = 'README.md';
  let s = fs.readFileSync(p, 'utf8');

  // 冒頭。件数の直書きをやめ、現在地の出し方に寄せる
  s = s.replace(
    `市区町村ごとの特定創業支援等事業を、成果（登録免許税がいくら安くなるか）を軸に整理する
静的サイトです。1,459の認定市区町村への横展開を前提に、**データ駆動**で構成しています。`,
    `市区町村ごとの特定創業支援等事業を、成果（登録免許税がいくら安くなるか）を軸に整理する
静的サイトです。全国約1,580の認定市区町村への横展開を前提に、**データ駆動**で構成しています。

公開先: https://sogyo-shien.com
作業の進め方は **[CLAUDE.md](CLAUDE.md)** に、公開手順は [DEPLOY.md](DEPLOY.md) にまとめています。`
  );

  // 使い方に現在地と巡回ツールを足す
  s = s.replace(
    '```bash\nnpm install --ignore-scripts   # ※ --ignore-scripts の理由は下記\nnpm run dev                    # http://localhost:4321\nnpm run build                  # dist/ に静的HTMLを出力\n```',
    `\`\`\`bash
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/ に静的HTMLを出力

npm run status   # 今どこまで進んでいるか（掲載数・保留理由・巡回の状況）
npm run screen tools/targets.tsv   # 候補ページの一次スクリーニング
npm run scan     # 掲載保留と候補キューを巡回（--update で判定を記録）
npm run watch    # 登録済み出典ページの差分検知（--update でスナップショット更新）
\`\`\``
  );

  // 構成に tools/ を足す
  s = s.replace(
    `    area/[prefSlug]/[slug].astro   ← 地域ページのテンプレート（全自治体で共用）
\`\`\``,
    `    area/[prefSlug]/[slug].astro   ← 地域ページのテンプレート（全自治体で共用）
tools/
  lib/screen-core.mjs          ← ページ取得と仕分けの中身（3秒待機・robots.txt遵守）
  screen.mjs                   ← 手動の一次スクリーニング
  scan.mjs                     ← 候補の定期スクリーニング（scan.yml から）
  watch.mjs                    ← 出典ページの差分検知（watch.yml から）
  status.mjs                   ← 現在地の表示
  candidates.tsv               ← 掲載候補のキュー
\`\`\``
  );

  // タイトルのルール（実装に合わせる）
  s = s.replace(
    `5. **titleは市の特性で振り分ける。** 無料講座あり → 無料訴求、独自支援あり → 独自訴求、
   それ以外 → 標準。1,459件が同一パターンになるのを避ける（\`lib/fmt.js\` の \`pageTitle\`）。`,
    `5. **titleは重複させない。** 「その市で一番効く数字」＋「対象講座の件数」で組み立てる
   （\`lib/fmt.js\` の \`pageTitle\`）。指標を1つしか見ないと、条件の似た自治体どうしで
   同じタイトルになる。自動生成で言い表せない市は、データ側の \`titleHook\` に手書きする。`
  );

  // 掲載基準（初期案から現行の運用へ）
  s = s.replace(
    `**公開の最低条件**（SEO仕様書より）: 講座の実データ3件以上、その市固有の制度1つ以上、
出典URLと最終確認日。満たせない市は公開しない。`,
    `**公開の最低条件**（2026-09-09 改定）: **受講料・開催日・国の3措置以外の上乗せ支援**の
いずれかが公表されていること。加えて出典URLと最終確認日は必須。

満たさない自治体は \`publish.ready: false\` で登録する。ページは生成されるが noindex になり
sitemap からも外れる。捨てずに登録するのは、週次の巡回対象に載せて、日程や受講料が
公表された時点で気づけるようにするため。詳しくは [CLAUDE.md](CLAUDE.md) の「掲載基準」。`
  );

  // MAX_PATH の節は、スクラッチ領域限定の話だったので置き換える
  const idx = s.indexOf('## この環境でのビルドについて（重要）');
  if (idx < 0) throw new Error('README.md の MAX_PATH の節が見つかりません');
  s =
    s.slice(0, idx) +
    `## 自動で回っているもの

| ワークフロー | 実行 | 内容 |
|---|---|---|
| \`deploy.yml\` | push時 | ビルドして GitHub Pages へ |
| \`watch.yml\` | 毎週月曜 7:00 JST | 登録済み出典ページの差分検知 → Issue |
| \`scan.yml\` | 毎週月曜 8:00 JST | 掲載保留と候補キューを巡回し、判定が上がったものを Issue |

JSON化（ダイジェストを読んで自治体データを書く工程）は自動化していません。
理由は [CLAUDE.md](CLAUDE.md) の「自動化していること・していないこと」に書いています。

## 開発環境

Node 22。\`npm install && npm run build\` がそのまま通ります。

作業ディレクトリは \`C:\\sogyo-shien\`。Claude のスクラッチ領域には置かないでください
（セッション終了で消えるうえ、パスが長く Windows の MAX_PATH に引っかかります）。
`;

  fs.writeFileSync(p, s);
  console.log('README.md: 掲載基準・タイトル規則・ビルド手順を現状に合わせた');
}
