/**
 * グランドメニュー（お店で配る二つ折りの手元メニュー）の号を残しておくための決めごと。
 *
 * 2026年9月15日、松尾さんの依頼で追加した。
 * それまでチラシの号はチャットとメールに散らばっていて、
 * 「前はいつ入稿したか」「今どの号を配っているか」が誰にも分からなかった。
 *
 * 1号 = 1件。商品とは結びつけない（1号にたくさんの商品が載るため）。
 * 保存先は Supabase の grand_menu テーブル（id / data / updated_at）。
 */

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
  /** どの店で配るか。「全店共通」「銀座のみ」など */
  scope: string;
  /** 変更点・覚え書き */
  note: string;
  /** データの置き場所（DropboxやPDFのURL）。1行1つ */
  links: string[];
}

export type GrandMenuRow = { id: string; data: GrandMenuIssue };

export function createEmptyIssue(): GrandMenuIssue {
  return { vol: "", title: "", distributeDate: "", submitDate: "", scope: "全店共通", note: "", links: [] };
}

/** 保存されている形が古くても落ちないように、足りない欄を埋める */
export function normalizeIssue(raw: Partial<GrandMenuIssue> | null | undefined): GrandMenuIssue {
  const base = createEmptyIssue();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    links: Array.isArray(raw.links) ? raw.links.filter((x): x is string => typeof x === "string") : [],
  };
}

export type IssueState = "submit" | "waiting" | "current" | "past";

/**
 * 号の今の状態。色の意味は他の画面と同じ。
 * submit  … まだ入稿していない（橙＝これから手を付けるもの）
 * waiting … 入稿は済み、配布はこれから（緑）
 * current … いま配っている号（緑）
 * past    … 終わった号（灰）
 */
export function issueState(issue: GrandMenuIssue, today: string, isCurrent: boolean): IssueState {
  if (issue.submitDate && issue.submitDate > today) return "submit";
  if (issue.distributeDate && issue.distributeDate > today) return "waiting";
  return isCurrent ? "current" : "past";
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
 * 配布日が新しい順。日付が空のものは下に置く。
 * （左の商品リストと同じ「新しいものが上」の並び）
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

/** いま配っている号の id（配布日が今日以下でいちばん新しいもの） */
export function currentIssueId(rows: GrandMenuRow[], today: string): string | null {
  const started = rows.filter((r) => r.data.distributeDate && r.data.distributeDate <= today);
  if (started.length === 0) return null;
  return sortIssues(started)[0].id;
}
