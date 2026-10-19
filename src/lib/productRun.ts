import { ProductInfo, ProductRun } from "./types";

/* ------------------------------------------------------------------ *
 * 販売の回（＝年・期間ごとの1回ぶん）
 *
 * 同じ商品でも、年が変われば 期間・価格・材料・作り方・ビジュアル・紹介文・
 * 準備タスク のどれもが変わりうる。どれが変わるかは前もって決められないので、
 * **回ごとに全部を別々に持てる** ようにしてある。
 *
 * 置き場所
 * - 「今準備中の回」… ProductInfo の本体（ホーム画面の締め切り・進捗はここだけを見る）
 * - それ以外の回　… ProductInfo.runs[] の中。`detail` に価格・材料などを持つ
 *
 * 古いデータには `detail` が無い。そういう回は「この回ぶんの記録が残っていない」
 * という意味なので、画面では今の回の内容を薄く出して、その旨を伝える。
 * 直した瞬間に、そのときの内容がその回へ書き写され、以後は独立する
 * （勝手に過去の数字を作らない。`hasOwnDetail` で区別できる）。
 * ------------------------------------------------------------------ */

/** 回ごとに別々に持つ項目 */
export const RUN_FIELDS = [
  "releaseDate",
  "endDate",
  "ongoing",
  "visualDownloads",
  "noAlcoholPork",
  "priceBase",
  "priceBaseUber",
  "priceBaseNotSold",
  "priceByStore",
  "ingredients",
  "howToVideoUrl",
  "recipeImages",
  "recipeNotes",
  "descriptionJa",
  "descriptionEn",
  "instagramPost",
  "igCaption",
  "xCaption",
  "threadsCaption",
  "pressEmail",
  "prTimesUrl",
] as const;

export type RunField = (typeof RUN_FIELDS)[number];

/** 期間・ビジュアル以外の、回ごとの中身（runs[].detail に入る） */
export const DETAIL_FIELDS = RUN_FIELDS.filter(
  (k) => k !== "releaseDate" && k !== "endDate" && k !== "ongoing" && k !== "visualDownloads"
) as Exclude<RunField, "releaseDate" | "endDate" | "ongoing" | "visualDownloads">[];

export type RunDetail = Pick<ProductInfo, (typeof DETAIL_FIELDS)[number]>;

/** 商品そのものの項目（回が変わっても1つ）。品名を変えるときは別商品を作る運用 */
export const PRODUCT_FIELDS = ["nameJa", "nameEn", "slipName", "discontinued"] as const;

/** この回に、その回ぶんの中身が記録されているか */
export function hasOwnDetail(run: ProductRun | null): boolean {
  return !!run && !!run.detail;
}

/** いま選んでいる回の中身を、商品情報と同じ形で取り出す */
export function runFieldsOf(info: ProductInfo, run: ProductRun | null): Pick<ProductInfo, RunField> {
  if (!run) {
    const out = {} as Pick<ProductInfo, RunField>;
    for (const k of RUN_FIELDS) (out as Record<string, unknown>)[k] = info[k];
    return out;
  }
  const detail = (run.detail ?? {}) as Partial<RunDetail>;
  const out = {} as Pick<ProductInfo, RunField>;
  for (const k of DETAIL_FIELDS) {
    (out as Record<string, unknown>)[k] = k in detail ? detail[k] : info[k];
  }
  out.releaseDate = run.releaseDate;
  out.endDate = run.endDate;
  out.ongoing = run.ongoing;
  out.visualDownloads = run.visuals;
  return out;
}

/** 今の中身から、回ぶんの控えを作る */
export function detailFrom(info: ProductInfo): RunDetail {
  const out = {} as RunDetail;
  for (const k of DETAIL_FIELDS) (out as Record<string, unknown>)[k] = info[k];
  return out;
}

/** その回の中身をまるごと取り出す（回を足すときの引き継ぎ元） */
export function snapshotOf(info: ProductInfo, label: string, taskState: Record<string, boolean>): ProductRun {
  return {
    label,
    releaseDate: info.releaseDate,
    endDate: info.endDate,
    ongoing: info.ongoing,
    visuals: info.visualDownloads,
    taskState,
    detail: detailFrom(info),
    createdAt: new Date().toISOString(),
  };
}

/**
 * 画面での直しを、どこへ書くかに振り分ける。
 * 今の回なら商品情報の本体へ、それ以外なら runs[] のその回へ。
 */
export function applyRunPatch(
  info: ProductInfo,
  runLabel: string | null,
  patch: Partial<ProductInfo>
): Partial<ProductInfo> {
  /* 今の回（runLabel が null）は、これまでどおり本体をそのまま直す */
  if (runLabel === null) return patch;

  const idx = info.runs.findIndex((r) => r.label === runLabel);
  if (idx < 0) return {};

  const run = info.runs[idx];
  const next: ProductRun = { ...run };
  const rest: Partial<ProductInfo> = {};
  let detail: Partial<RunDetail> | null = null;

  for (const [key, value] of Object.entries(patch)) {
    if (key === "releaseDate") next.releaseDate = value as string;
    else if (key === "endDate") next.endDate = value as string;
    else if (key === "ongoing") next.ongoing = value as boolean;
    else if (key === "visualDownloads") next.visuals = value as ProductInfo["visualDownloads"];
    else if ((DETAIL_FIELDS as readonly string[]).includes(key)) {
      /* その回ぶんの記録がまだ無ければ、いまの内容を書き写してから直す。
         こうしないと「1項目だけその回、残りは今の回」という食い違いが起きる */
      if (!detail) detail = { ...(run.detail ?? detailFrom(info)) };
      (detail as Record<string, unknown>)[key] = value;
    } else {
      /* 品名など、商品で1つのものは本体へ */
      (rest as Record<string, unknown>)[key] = value;
    }
  }
  if (detail) next.detail = detail as RunDetail;

  const runs = info.runs.slice();
  runs[idx] = next;
  return { ...rest, runs };
}

/* ------------------------------ 年で束ねる ------------------------------ */

const YEAR_IN_LABEL = /(20\d{2})/;

/** その回がかかっている年（2026年12月〜2027年1月なら 2026 と 2027 の両方） */
export function yearsOfRun(run: { label: string; releaseDate: string; endDate: string; ongoing: boolean }): string[] {
  const from = run.releaseDate.slice(0, 4);
  const to = run.ongoing ? "" : run.endDate.slice(0, 4);
  if (from) {
    const a = Number(from);
    const b = Number(to) || a;
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a && b - a <= 5) {
      const out: string[] = [];
      for (let y = a; y <= b; y++) out.push(String(y));
      return out;
    }
    return [from];
  }
  /* 期間が入っていない回は、名前の中の年を手がかりにする */
  const m = run.label.match(YEAR_IN_LABEL);
  return m ? [m[1]] : [];
}

export type RunEntry = {
  /** 回の名前 */
  label: string;
  /** 今準備中の回か */
  current: boolean;
  /** 控えの回の中身（今の回なら null） */
  run: ProductRun | null;
  releaseDate: string;
  endDate: string;
  ongoing: boolean;
  years: string[];
};

/** その商品の全部の回（今の回を含む）を、新しい順に並べて返す */
export function listRuns(info: ProductInfo): RunEntry[] {
  const current: RunEntry = {
    label: info.runLabel,
    current: true,
    run: null,
    releaseDate: info.releaseDate,
    endDate: info.endDate,
    ongoing: info.ongoing,
    years: yearsOfRun({
      label: info.runLabel,
      releaseDate: info.releaseDate,
      endDate: info.endDate,
      ongoing: info.ongoing,
    }),
  };
  const others: RunEntry[] = info.runs.map((r) => ({
    label: r.label,
    current: false,
    run: r,
    releaseDate: r.releaseDate,
    endDate: r.endDate,
    ongoing: r.ongoing,
    years: yearsOfRun(r),
  }));
  const all = [current, ...others];
  /* 期間の早い順。期間が無いものは最後 */
  return all.sort((a, b) => {
    if (!a.releaseDate && !b.releaseDate) return 0;
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    return a.releaseDate.localeCompare(b.releaseDate);
  });
}

/** 回の一覧に出てくる年を、小さい順に */
export function listYears(entries: RunEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) for (const y of e.years) set.add(y);
  return [...set].sort();
}

/** 期間の言い方（2026/12/1〜2027/1/31） */
export function periodLabel(e: { releaseDate: string; endDate: string; ongoing: boolean }): string {
  const fmt = (d: string) => (d ? `${Number(d.slice(0, 4))}/${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : "");
  const from = fmt(e.releaseDate);
  if (!from) return "期間なし";
  if (e.ongoing) return `${from}〜 継続`;
  const to = fmt(e.endDate);
  return to ? `${from}〜${to}` : `${from}〜`;
}
