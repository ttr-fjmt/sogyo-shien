import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';

// 掲載基準を満たしていない自治体は noindex にしているので、sitemap からも外す。
// （noindex なのに sitemap に載っている状態は矛盾したシグナルになる）
const dir = new URL('./src/data/municipalities/', import.meta.url);
const all = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8')));

const unpublished = [
  ...all.filter((m) => !m.publish?.ready).map((m) => `/area/${m.prefSlug}/${m.slug}/`),
  // 掲載自治体がまだ1件もない都道府県ページも noindex なので外す。
  // （パンくずのリンク切れを防ぐためにページ自体は生成している）
  ...[...new Set(all.map((m) => m.prefSlug))]
    .filter((pref) => !all.some((m) => m.prefSlug === pref && m.publish?.ready))
    .map((pref) => `/area/${pref}/`),
];

export default defineConfig({
  // 本番URLは環境変数 SITE_URL で上書きする（ホスティング側で設定）
  site: process.env.SITE_URL ?? 'https://sogyo-shien.com',
  integrations: [
    sitemap({
      filter: (page) => !unpublished.some((p) => page.endsWith(p)),
    }),
  ],
  build: { format: 'directory' },
});
