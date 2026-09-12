/**
 * 画面共通の見た目の決めごと。
 *
 * 同じ意味のものが画面ごとに違う形・違う色になっていたので、ここに一本化する。
 * 新しく作るときは、ここにあるものをまず使うこと。無ければここに足す。
 *
 * ── 決めごと ──────────────────────────────
 * 角丸   … カード = xl ／ 押せるもの = lg ／ 丸い印 = full の3つだけ
 * 色     … アクセント（オレンジ）は「今おすところ」にだけ。地と面はグレーと白
 * 選択中 … ボタン・タブ・絞り込みは オレンジで塗る
 *          一覧の行は 薄いグレー＋左のオレンジの線（塗りつぶすと一覧が騒がしい）
 * 枠線   … 面の区切り = stone-200 ／ 入力欄 = stone-300。濃い線は使わない
 * 影     … 面は shadow-xs、浮いているもの（窓・貼り付く帯）は shadow-md／lg
 * 文字   … 本文 sm ／ 補足 xs ／ 見出し base・lg。10px・11pxの直書きはしない
 * 高さ   … 指で押すものはスマホで44px以上（min-h-11）、PCでは md:min-h-0 で戻す
 *
 * 色そのものの定義は `src/app/globals.css` の @theme にある。
 * ────────────────────────────────────────
 */

/** 押したときに分かるよう、フォーカスの輪郭は全部これで揃える */
export const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/35 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas";

/** 面。中身は自分で padding を付ける */
export const card = "rounded-xl border border-stone-200 bg-white shadow-xs";

/** 面の見出し帯 */
export const cardHead =
  "flex items-center gap-2.5 border-b border-stone-200 px-4 py-3.5 sm:px-5";

/** 面の中身 */
export const cardBody = "p-4 sm:p-5";

/** 入力欄。高さと文字は globals.css 側でスマホだけ16pxにしている */
export const field =
  `w-full min-h-11 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 ` +
  `shadow-xs transition placeholder:text-stone-400 hover:border-stone-400 md:min-h-0 ${focusRing}`;

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
    primary:
      "bg-amber-700 text-white shadow-xs hover:bg-amber-800 active:bg-amber-900 disabled:bg-stone-300 disabled:shadow-none",
    secondary:
      "border border-stone-300 bg-white text-stone-700 shadow-xs hover:border-stone-400 hover:bg-stone-50 active:bg-stone-100",
    quiet: "text-stone-500 hover:bg-stone-100 hover:text-stone-800",
    danger: "text-stone-400 hover:bg-red-50 hover:text-red-600",
  };
  return `${base} ${tones[tone]} ${extra}`.trim();
}

/** 並べ替え・絞り込みの選択肢。選ばれているものはアクセントで塗る */
export function chip(active: boolean, extra = "", size: "md" | "sm" = "md") {
  /* 大きさは引数で選ぶ。extra に text-xs と書いても効かない
     （Tailwind は書いた順ではなく生成順で勝ち負けが決まるため） */
  const dim =
    size === "sm"
      ? "min-h-10 px-2.5 py-1 text-xs md:min-h-8"
      : "min-h-11 px-3 py-1.5 text-sm md:min-h-0";
  const base =
    `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border ` +
    `transition ${dim} ${focusRing}`;
  const state = active
    ? "border-amber-700 bg-amber-700 font-medium text-white shadow-xs"
    : "border-stone-300 bg-white text-stone-600 shadow-xs hover:border-stone-400 hover:bg-stone-50";
  return `${base} ${state} ${extra}`.trim();
}

/**
 * 一覧の行の選択。塗りつぶさず、薄いグレー＋左のアクセントの線で示す。
 * （一覧は行数が多いので、オレンジで塗ると画面が騒がしくなる）
 */
export function rowSelect(active: boolean, extra = "") {
  const base =
    `relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ` +
    `before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 ` +
    `before:rounded-full before:bg-amber-600 before:transition-opacity ${focusRing}`;
  const state = active
    ? "bg-stone-100 font-medium text-stone-900 before:opacity-100"
    : "text-stone-600 before:opacity-0 hover:bg-stone-100/70 hover:text-stone-900";
  return `${base} ${state} ${extra}`.trim();
}

export type BadgeTone = "neutral" | "accent" | "good" | "warn" | "danger";

/** 数や状態を示す小さな印。押せないもの */
export function badge(tone: BadgeTone = "neutral", extra = "") {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-stone-100 text-stone-600 ring-stone-200",
    accent: "bg-amber-50 text-amber-800 ring-amber-200",
    good: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    warn: "bg-amber-50 text-amber-800 ring-amber-200",
    danger: "bg-red-50 text-red-700 ring-red-100",
  };
  return `${base} ${tones[tone]} ${extra}`.trim();
}

/** 横に流す列。折り返すと縦が伸びて中身が見えなくなる場所で使う */
export const scrollRow =
  "scroll-x-clean flex items-center gap-2 overflow-x-auto";

/** 画面の見出し */
export const h2 = "text-lg font-semibold text-stone-900";
export const h3 = "text-base font-semibold text-stone-900";
/** 一覧の上に置く、小さな区切りの見出し */
export const eyebrow = "text-xs font-medium tracking-wide text-stone-400";
/** 補足の文章 */
export const muted = "text-xs leading-relaxed text-stone-500";

/**
 * 進み具合の細い棒。太いと数字より目立ってしまうので 4px にしている。
 * 100% になったら緑にして、終わったことがひと目で分かるようにする。
 */
export function meter(pct: number, extra = "") {
  const tone =
    pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-600" : "bg-stone-300";
  return {
    track: `h-1 overflow-hidden rounded-full bg-stone-200 ${extra}`.trim(),
    bar: tone,
  };
}
