const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** データ中の **強調** を安全に <strong> へ。それ以外のHTMLはエスケープする。 */
export function mdBold(s) {
  if (!s) return '';
  return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

export const yen = (n) => n.toLocaleString('ja-JP') + '円';

/** 受講料の表示ラベル。金額が無いものを勝手に埋めない。 */
export function feeLabel(fee) {
  if (!fee) return '記載なし';
  if (fee.free) return '無料';
  if (fee.unknown) return '要確認';
  if (typeof fee.amount === 'number') return yen(fee.amount);
  return '記載なし';
}

export const isFree = (c) => !!c.fee?.free;

/** 並び順は受講料の昇順。無料が先、金額不明は最後。これ自体が記事の主張になる。 */
export function byFee(a, b) {
  const rank = (c) =>
    c.fee?.free ? 0 : typeof c.fee?.amount === 'number' ? 1 : 2;
  const ra = rank(a), rb = rank(b);
  if (ra !== rb) return ra - rb;
  return (a.fee?.amount ?? 0) - (b.fee?.amount ?? 0);
}

export const STATUS = {
  open:    { label: '受付中',  cls: 'b-open' },
  closed:  { label: '受付終了', cls: 'b-closed' },
  tbd:     { label: '未定',    cls: 'b-tbd' },
  unknown: { label: '要確認',  cls: 'b-tbd' },
};

export const FORMAT = {
  online:   { label: 'オンライン',   cls: 'b-online' },
  ondemand: { label: 'オンデマンド', cls: 'b-online' },
  offline:  { label: '対面',        cls: 'b-face' },
  hybrid:   { label: '対面＋オンライン', cls: 'b-face' },
};

/** 1,459ページで同一パターンにならないよう、市の特性でtitleを振り分ける。 */
export function pageTitle(m, now = new Date()) {
  const ym = `【${now.getFullYear()}年${now.getMonth() + 1}月更新】`;
  const priced = m.courses?.filter((c) => typeof c.fee?.amount === 'number') ?? [];
  const openNow = m.courses?.filter((c) => c.status === 'open') ?? [];

  // その自治体でしか言えないことがあるなら、データ側に書いたものを優先する。
  // 自動生成だけだと、条件が同じ自治体どうしで同じタイトルが並んでしまう。
  if (m.titleHook) return `${m.name}で会社設立｜${m.titleHook}${ym}`;

  // 自治体数が増えると同じタイトルが並ぶ。ページが実際に持っている情報で
  // 順に切り分けて、検索結果で見分けがつくようにする。
  // 見出しは「その自治体で一番効く数字」＋「対象講座の件数」で組む。
  // 片方だけだと、条件の似た自治体どうしで同じタイトルになる。
  const n = m.courses?.length ?? 0;
  const free = m.courses?.filter(isFree) ?? [];
  const freeOnline = free.some((c) => c.format === 'online' || c.format === 'hybrid');

  if (free.length && freeOnline)
    return `${m.name}で会社設立｜無料のオンライン講座あり。登録免許税半額の条件と講座${n}件${ym}`;
  if (free.length)
    return `${m.name}で会社設立｜無料講座${free.length}件を含む${n}件。登録免許税を半額にする方法${ym}`;
  if (priced.length)
    return `${m.name}で会社設立｜受講料${yen(Math.min(...priced.map((c) => c.fee.amount)))}から。登録免許税半額の条件と講座${n}件${ym}`;
  if (openNow.length)
    return `${m.name}で会社設立｜募集中${openNow.length}件・講座${n}件。登録免許税半額の条件${ym}`;
  if (m.localSupport?.length)
    return `${m.name}で会社設立｜市独自の上乗せ支援と登録免許税半額の条件${ym}`;
  return `${m.name}で会社設立｜登録免許税が半額になる制度と創業セミナー${ym}`;
}

export function metaDescription(m) {
  const n = m.courses?.length ?? 0;
  const priced = m.courses?.filter((c) => typeof c.fee?.amount === 'number') ?? [];
  const free = m.courses?.some(isFree);
  const cheapest = free
    ? '無料'
    : priced.length
      ? yen(Math.min(...priced.map((c) => c.fee.amount)))
      : null;
  const req = m.requirement?.minSessions
    ? `${m.requirement.minSessions}回以上・${m.requirement.minMonths}か月以上受講すること。`
    : '';
  return [
    `${m.name}で会社を設立すると登録免許税が`,
    `${yen(m.taxReduction.kabushiki.before)}→${yen(m.taxReduction.kabushiki.after)}に。`,
    `条件は${m.name}の特定創業支援等事業を${req}`,
    `対象講座${n}件${cheapest ? `（最安${cheapest}）` : ''}、申請手順、${m.name}独自の支援まで`,
    `${m.lastVerified}時点の情報でまとめました。`,
  ].join('');
}

/** 開催日が確定していて受付中のものだけ Event 構造化データに出す。 */
export function eventJsonLd(m, site) {
  return m.courses
    .filter((c) => c.status === 'open' && c.schedule && !/通年|未定/.test(c.schedule))
    .map((c) => ({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: c.name,
      description: c.content ?? undefined,
      eventAttendanceMode:
        c.format === 'online' || c.format === 'ondemand'
          ? 'https://schema.org/OnlineEventAttendanceMode'
          : 'https://schema.org/OfflineEventAttendanceMode',
      location: c.venue
        ? { '@type': 'Place', name: c.venue }
        : { '@type': 'VirtualLocation', url: site },
      organizer: { '@type': 'Organization', name: c.org },
      offers: c.fee?.free
        ? { '@type': 'Offer', price: '0', priceCurrency: 'JPY' }
        : typeof c.fee?.amount === 'number'
          ? { '@type': 'Offer', price: String(c.fee.amount), priceCurrency: 'JPY' }
          : undefined,
    }));
}
