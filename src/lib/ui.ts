/**
 * 画面共通の見た目の決めごと。
 *
 * 同じ意味のものが画面ごとに違う形・違う色になっていたので、ここに一本化する。
 * 新しく作るときは、ここにあるものをまず使うこと。無ければここに足す。
 *
 * ── 決めごと ──────────────────────────────
 * 角丸   … カード = xl ／ 押せるもの = lg ／ 丸い印 = full の3つだけ
 * 選択中 … 必ず琥珀（amber-700）で塗る。黒や濃いグレーは使わない
 * 枠線   … 面の区切り = stone-200 ／ 入力欄 = stone-300
 * 文字   … 本文 sm ／ 補足 xs ／ 見出し base・lg。10px・11pxの直書きはしない
 * 高さ   … 指で押すものはスマホで44px以上（min-h-11）、PCでは md:min-h-0 で戻す
 * ────────────────────────────────────────
 */

/** 押したときに分かるよう、フォーカスの輪郭は全部これで揃える */
export const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:border-amber-500";

/** 面。中身は自分で padding を付ける */
export const card = "rounded-xl border border-stone-200 bg-white";

/** 面の見出し帯 */
export const cardHead =
  "flex items-center gap-2.5 border-b border-stone-200 bg-stone-50 px-4 py-3 sm:px-5";

/** 面の中身 */
export const cardBody = "p-4 sm:p-5";

/** 入力欄。高さと文字は globals.css 側でスマホだけ16pxにしている */
export const field =
  `w-full min-h-11 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 ` +
  `placeholder:text-stone-400 md:min-h-0 ${focusRing}`;

export type BtnTone = "primary" | "secondary" | "quiet" | "danger";

/**
 * ボタン。
 * primary   … その画面でいちばんやってほしいこと（1画面に1つ）
 * secondary … 並の操作
 * quiet     … 枠なし。取り消しや補助
 * danger    … 消す操作。枠なしにして、押し間違いを避ける
 */
export function btn(tone: BtnTone = "secondary", extra = "") {
  const base =
    `inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg ` +
    `px-3.5 py-2 text-sm font-medium transition md:min-h-0 disabled:cursor-default ${focusRing}`;
  const tones: Record<BtnTone, string> = {
    primary: "bg-amber-700 text-white hover:bg-amber-800 disabled:bg-stone-300",
    secondary:
      "border border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50",
    quiet: "text-stone-500 hover:bg-stone-100 hover:text-stone-700",
    danger: "text-stone-400 hover:bg-red-50 hover:text-red-600",
  };
  return `${base} ${tones[tone]} ${extra}`.trim();
}

/** 並べ替え・絞り込みの選択肢。選ばれているものは琥珀で塗る */
export function chip(active: boolean, extra = "") {
  const base =
    `inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg border px-3 py-1.5 ` +
    `text-sm transition md:min-h-0 ${focusRing}`;
  const state = active
    ? "border-amber-700 bg-amber-700 font-medium text-white"
    : "border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50";
  return `${base} ${state} ${extra}`.trim();
}

export type BadgeTone = "neutral" | "accent" | "good" | "warn" | "danger";

/** 数や状態を示す小さな印。押せないもの */
export function badge(tone: BadgeTone = "neutral", extra = "") {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-stone-200 text-stone-600",
    accent: "bg-amber-100 text-amber-900",
    good: "bg-emerald-100 text-emerald-700",
    warn: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-700",
  };
  return `${base} ${tones[tone]} ${extra}`.trim();
}

/** 横に流す列。折り返すと縦が伸びて中身が見えなくなる場所で使う */
export const scrollRow = "scroll-x-clean flex items-center gap-2 overflow-x-auto";

/** 画面の見出し */
export const h2 = "text-lg font-bold text-stone-800";
export const h3 = "text-base font-semibold text-stone-800";
/** 補足の文章 */
export const muted = "text-xs leading-relaxed text-stone-500";
