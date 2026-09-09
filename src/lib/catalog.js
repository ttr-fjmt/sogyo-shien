/**
 * 全自治体のデータを1か所に集約する層。
 * 比較ページはここから導出するので、自治体JSONを足すだけで自動的に更新される。
 */
const files = import.meta.glob('../data/municipalities/*.json', { eager: true });

export const municipalities = Object.values(files)
  .map((m) => m.default ?? m)
  .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

export const published = municipalities.filter((m) => m.publish?.ready);

/** 全講座を自治体情報つきで平坦化する */
export const allCourses = municipalities.flatMap((m) =>
  m.courses.map((c) => ({
    ...c,
    city: m.name,
    pref: m.pref,
    href: `/area/${m.prefSlug}/${m.slug}/`,
    cityReady: !!m.publish?.ready,
  }))
);

export const priced = allCourses.filter((c) => typeof c.fee?.amount === 'number');
export const freeCourses = allCourses.filter((c) => c.fee?.free);
export const onlineCourses = allCourses.filter(
  (c) => c.format === 'online' || c.format === 'ondemand'
);
export const womenCourses = allCourses.filter((c) => c.audience?.includes('women'));

export const stats = {
  cities: municipalities.length,
  published: published.length,
  courses: allCourses.length,
  free: freeCourses.length,
  priced: priced.length,
  min: priced.length ? Math.min(...priced.map((c) => c.fee.amount)) : null,
  max: priced.length ? Math.max(...priced.map((c) => c.fee.amount)) : null,
  /** 受講料が不明な講座。これ自体が伝えるべき情報になる。 */
  unknownFee: allCourses.filter((c) => c.fee?.unknown).length,
  citiesWithNoFee: municipalities.filter((m) =>
    m.courses.every((c) => !c.fee?.free && typeof c.fee?.amount !== 'number')
  ),
};

export const feeRatio =
  stats.min && stats.max ? Math.round(stats.max / stats.min) : null;

/** 棒グラフの目盛り。最高額が突出するので、2番目に高い額を上限にする。 */
export function chartScale(courses) {
  const amounts = courses
    .filter((c) => typeof c.fee?.amount === 'number')
    .map((c) => c.fee.amount)
    .sort((a, b) => b - a);
  if (amounts.length < 2) return amounts[0] ?? 1;
  return amounts[1];
}
