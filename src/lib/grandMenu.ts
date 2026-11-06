/**
 * グランドメニュー（お店で配る二つ折りの手元メニュー）の号を残しておくための決めごと。
 *
 * 2026年9月15日、松尾さんの依頼で追加した。
 * それまでチラシの号はチャットとメールに散らばっていて、
 * 「前はいつ入稿したか」「今どの号を配っているか」が誰にも分からなかった。
 *
 * 1号 = 1件。商品とは結びつけない（1号にたくさんの商品が載るため）。
 * 保存先は Supabase の grand_menu テーブル（id / data / updated_at）。
 *
 * 2026年11月6日、松尾さんから「使いにくい。お店でタブを分けるとか、
 * 最新が上にくるとか」との指摘。次の3つを直した。
 *   1. 配る店を文字の自由入力から**お店を押して選ぶ形**にして、タブで絞り込めるようにした
 *   2. 配布開始日が空の号が下に沈んでいたので、**号数を主にした並べ替え**に変えた
 *   3. 日付が空なだけの号が「終わった号」と出ていたのを直した
 */

import { STORE_IDS, STORE_LABELS, StoreId } from "@/lib/types";

/** 1つの号 */
export interface GrandMenuIssue {
  /** 号数。「vol.14」のように書く */
  vol: string;
  /** 見出し。「2026年2月 グランドメニュー」のように書く */
  title: string;
  /** 配布をはじめる日 */
  distributeDate: string;
  /** 印刷所へ入稿する日（配布の10日ほど前） */
  submitDate: string;
  /**
   * どの店で配るか。**空の配列＝全店共通**。
   * 2026年11月に足した。これより前の号は `scope` の文字から読み取る。
   */
  stores: StoreId[];
  /**
   * 配る店の文字（昔の形）。いまは `stores` から自動で作る。
   * 古い画面やメモからそのまま読めるように残してある。
   */
  scope: string;
  /** 変更点・覚え書き */
  note: string;
  /** データの置き場所（DropboxやPDFのURL）。1行1つ */
  links: string[];
}

export type GrandMenuRow = { id: string; data: GrandMenuIssue };

export function createEmptyIssue(): GrandMenuIssue {
  return {
    vol: "",
    title: "",
    distributeDate: "",
    submitDate: "",
    stores: [],
    scope: "全店共通",
    note: "",
    links: [],
  };
}

/**
 * 昔の「配る店」の文字から、お店を読み取る。
 *
 * 入っている文字は「全店共通」「銀座店」「銀座店・浅草店・原宿店」「飛騨高山店」など。
 * 読み取れない書き方のときは、全店共通（空の配列）として扱う。
 * 勝手に決めつけて1店だけに絞ると、他の店で見えなくなってしまうため。
 */
export function parseScope(scope: string): StoreId[] {
  const text = (scope || "").trim();
  if (!text) return [];
  if (text.includes("全店")) return [];
  const hit = STORE_IDS.filter((id) => text.includes(STORE_LABELS[id]));
  return hit;
}

/** お店の並びを画面の順（銀座→原宿→浅草→飛騨高山→嘉麻→バンコク）にそろえる */
export function sortStores(ids: StoreId[]): StoreId[] {
  return STORE_IDS.filter((id) => ids.includes(id));
}

/** 「配る店」の文字を、選んだお店から作る */
export function scopeTextOf(stores: StoreId[]): string {
  const list = sortStores(stores);
  if (list.length === 0) return "全店共通";
  return list.map((id) => `${STORE_LABELS[id]}店`).join("・");
}

/** 保存されている形が古くても落ちないように、足りない欄を埋める */
export function normalizeIssue(raw: Partial<GrandMenuIssue> | null | undefined): GrandMenuIssue {
  const base = createEmptyIssue();
  if (!raw) return base;
  const links = Array.isArray(raw.links) ? raw.links.filter((x): x is string => typeof x === "string") : [];
  /* stores が入っていない古い号は、文字から読み取る（保存はしない） */
  const stores = Array.isArray(raw.stores)
    ? sortStores(raw.stores.filter((x): x is StoreId => STORE_IDS.includes(x as StoreId)))
    : parseScope(typeof raw.scope === "string" ? raw.scope : "");
  return {
    ...base,
    ...raw,
    stores,
    scope: typeof raw.scope === "string" && raw.scope.trim() ? raw.scope : scopeTextOf(stores),
    links,
  };
}

/** この号をこのお店のタブに出すか。全店共通（空）はどの店にも出す */
export function issueInStore(issue: GrandMenuIssue, store: StoreId): boolean {
  return issue.stores.length === 0 || issue.stores.includes(store);
}

/** どこかの号ではっきり指定されているお店だけを、タブに出す */
export function storeTabs(rows: GrandMenuRow[]): StoreId[] {
  const used = new Set<StoreId>();
  rows.forEach((r) => r.data.stores.forEach((s) => used.add(s)));
  return STORE_IDS.filter((id) => used.has(id));
}

export type IssueState = "submit" | "waiting" | "current" | "past" | "undated";

/**
 * 号の今の状態。色の意味は他の画面と同じ。
 * submit  … まだ入稿していない（橙＝これから手を付けるもの）
 * waiting … 入稿は済み、配布はこれから（緑）
 * current … いま配っている号（緑）
 * past    … 終わった号（灰）
 * undated … 日付がまだ入っていない（灰）
 *
 * 2026年11月6日の直し：日付が1つも入っていない号まで「終わった号」と出ていた。
 * いちばん新しい vol.23 が「終わった号」になっていて、見た人が混乱する。
 * 日付が空のときは、終わったのではなく**まだ決めていない**と出す。
 */
export function issueState(issue: GrandMenuIssue, today: string, isCurrent: boolean): IssueState {
  if (issue.submitDate && issue.submitDate > today) return "submit";
  if (issue.distributeDate && issue.distributeDate > today) return "waiting";
  if (isCurrent) return "current";
  if (!issue.submitDate && !issue.distributeDate) return "undated";
  return "past";
}

/** 日付の差（日数）。相手が空なら null */
export function daysUntil(date: string, today: string): number | null {
  if (!date) return null;
  const a = Date.parse(`${today}T00:00:00`);
  const b = Date.parse(`${date}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * 「vol.23（飛騨高山 全商品）」から 23 を取り出す。数字が無ければ null。
 * 号数は人が増やしていく番号なので、**日付より当てになる新しさの目印**。
 */
export function volNumber(vol: string): number | null {
  const m = (vol || "").match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * 配布日が新しい順。日付が空のものは下に置く。
 * 「いま配っている号」を決めるときだけ使う（日付が無い号は配っていないため）。
 */
export function sortIssues(rows: GrandMenuRow[]): GrandMenuRow[] {
  return [...rows].sort((a, b) => {
    const x = a.data.distributeDate || "";
    const y = b.data.distributeDate || "";
    if (!x && !y) return 0;
    if (!x) return 1;
    if (!y) return -1;
    return y.localeCompare(x);
  });
}

/**
 * 画面に並べる順。**新しい号が必ず上**。
 *
 * 2026年11月6日の直し：前は配布開始日だけで並べていたので、
 * 日付をまだ入れていない vol.23 がいちばん下に沈み、
 * 「最新が上にこない」と言われた。号数を主、日付を従にする。
 */
export function sortByNewest(rows: GrandMenuRow[]): GrandMenuRow[] {
  return [...rows].sort((a, b) => {
    const va = volNumber(a.data.vol);
    const vb = volNumber(b.data.vol);
    if (va !== vb) {
      /* 号数がまだ無い行（「号を追加」した直後）は、迷わないよういちばん上に出す */
      if (va === null) return -1;
      if (vb === null) return 1;
      return vb - va;
    }
    const da = a.data.distributeDate || a.data.submitDate || "";
    const db = b.data.distributeDate || b.data.submitDate || "";
    if (da !== db) {
      if (!da) return 1;
      if (!db) return -1;
      return db.localeCompare(da);
    }
    /* 同じ号数・同じ日付なら、全店共通を先、店別をあとに */
    if (a.data.stores.length !== b.data.stores.length) {
      return a.data.stores.length - b.data.stores.length;
    }
    return (a.data.title || "").localeCompare(b.data.title || "");
  });
}

/** いま配っている号の id（配布日が今日以下でいちばん新しいもの） */
export function currentIssueId(rows: GrandMenuRow[], today: string): string | null {
  const started = rows.filter((r) => r.data.distributeDate && r.data.distributeDate <= today);
  if (started.length === 0) return null;
  return sortIssues(started)[0].id;
}
