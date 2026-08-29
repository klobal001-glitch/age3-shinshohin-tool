import { ProductInfo, VisualLinkGroup } from "./types";

export const VISUAL_DOWNLOAD_DEFS: { key: string; label: string; size: string }[] = [
  { key: "ig_feed", label: "Instagram フィード投稿画像", size: "1,080 × 1,350px" },
  { key: "ig_story", label: "Instagram ストーリーズ投稿画像", size: "1,080 × 1,920px" },
  { key: "poster_a1_asakusa", label: "ポスター A1（浅草）", size: "594 × 841mm" },
  { key: "signage_v", label: "サイネージ 縦", size: "1,080 × 1,920px" },
  { key: "signage_h", label: "サイネージ 横", size: "1,920 × 1,080px" },
  { key: "uber_image", label: "Uber Eats 商品画像", size: "1,250 × 1,000px" },
  { key: "panel_kama", label: "嘉麻パネル", size: "450 × 450mm" },
  { key: "ec_slider_pc", label: "ECスライダー PC", size: "1,960 × 980px" },
  { key: "ec_slider_sp", label: "ECスライダー スマホ", size: "1,280 × 1,280px" },
  { key: "laminate_kanto", label: "レジ用ラミネートA5 関東＋飛騨高山用", size: "210 × 148mm" },
  { key: "laminate_kama", label: "レジ用ラミネートA5 嘉麻用", size: "210 × 148mm" },
  { key: "airregi", label: "エアレジ 商品画像", size: "" },
  { key: "menu_fold", label: "二つ折り手元メニュー", size: "" },
  { key: "flyer", label: "各店チラシ", size: "" },
];

export function createDefaultProductInfo(): ProductInfo {
  const visualDownloads: VisualLinkGroup[] = VISUAL_DOWNLOAD_DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    size: d.size,
    links: [],
  }));

  return {
    noAlcoholPork: null,
    nameJa: "",
    releaseDate: "",
    endDate: "",
    nameEn: "",
    descriptionJa: "",
    descriptionEn: "",
    instagramPost: "",
    priceTokyo: null,
    priceTokyoUber: null,
    priceKama: null,
    priceKamaUber: null,
    ingredients: [
      { nameJa: "", nameEn: "", amount: "", specs: [] },
      { nameJa: "", nameEn: "", amount: "", specs: [] },
    ],
    howToVideoUrl: "",
    recipeNotes: "",
    visualDownloads,
    igCaption: "",
    xCaption: "",
    threadsCaption: "",
    pressEmail: "",
    prTimesUrl: "",
  };
}

export interface ProgressCount {
  filled: number;
  total: number;
}

export function requiredProgress(info: ProductInfo): ProgressCount {
  const checks: boolean[] = [
    !!info.nameJa,
    !!info.releaseDate,
    info.noAlcoholPork !== null,
    info.priceTokyo !== null,
    info.priceKama !== null,
    info.ingredients.some((i) => i.nameJa && i.amount),
  ];
  return { filled: checks.filter(Boolean).length, total: checks.length };
}

export function optionalProgress(info: ProductInfo): ProgressCount {
  const checks: boolean[] = [
    !!info.nameEn,
    !!info.endDate,
    !!info.descriptionJa,
    !!info.descriptionEn,
    !!info.instagramPost,
    !!info.howToVideoUrl,
    !!info.recipeNotes,
    !!info.igCaption,
    !!info.xCaption,
    !!info.threadsCaption,
    !!info.pressEmail,
    !!info.prTimesUrl,
    ...info.visualDownloads.map((v) => v.links.length > 0),
  ];
  return { filled: checks.filter(Boolean).length, total: checks.length };
}

export function ingredientsProgress(info: ProductInfo): ProgressCount {
  return {
    filled: info.ingredients.filter((i) => i.nameJa && i.amount).length,
    total: info.ingredients.length,
  };
}

/* ------------------------------------------------------------------ *
 * 価格まわり
 *
 * 価格は「税込・円」の数値で保持する。Uber価格は元価格の UBER_RATE 倍を
 * 自動計算して表示し、値を明示的に入れた場合だけその値を優先する
 * （＝ null は「自動」を意味する）。
 * ------------------------------------------------------------------ */

export const UBER_RATE = 1.4;

/** 入力欄の文字列を価格の数値に変換する。数字以外は無視。空なら null。 */
export function parsePriceInput(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  return Number(digits);
}

/** 旧形式（"3,800 (¥)" / "¥950 (+¥100)" など）から最初の数値を取り出す。 */
export function legacyPriceToNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const m = value.replace(/,/g, "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** 元価格から自動計算した Uber 価格（1円単位で四捨五入）。 */
export function autoUberPrice(base: number | null): number | null {
  if (base === null) return null;
  return Math.round(base * UBER_RATE);
}

/** 実際に表示・書き出しに使う Uber 価格。手入力があればそれを優先。 */
export function effectiveUberPrice(explicit: number | null, base: number | null): number | null {
  return explicit !== null ? explicit : autoUberPrice(base);
}

/** 表示用フォーマット。null は空文字。 */
export function formatYen(value: number | null): string {
  if (value === null) return "";
  return `¥${value.toLocaleString("ja-JP")}`;
}

/**
 * Supabase から読んだ古い形のデータを現在の型に合わせて補正する。
 * - 価格の文字列 → 数値
 * - 廃止された priceUber は「銀座系のUber価格」として引き継がず破棄する
 * - 欠けているキーはデフォルト値で埋める
 */
export function normalizeProductInfo(raw: unknown): ProductInfo {
  const base = createDefaultProductInfo();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const merged = { ...base, ...(r as Partial<ProductInfo>) } as ProductInfo;

  merged.priceTokyo = legacyPriceToNumber(r.priceTokyo);
  merged.priceKama = legacyPriceToNumber(r.priceKama);
  merged.priceTokyoUber = legacyPriceToNumber(r.priceTokyoUber);
  merged.priceKamaUber = legacyPriceToNumber(r.priceKamaUber);

  if (!Array.isArray(merged.ingredients) || merged.ingredients.length === 0) {
    merged.ingredients = base.ingredients;
  } else {
    merged.ingredients = merged.ingredients.map((row) => ({
      nameJa: row?.nameJa ?? "",
      nameEn: row?.nameEn ?? "",
      amount: row?.amount ?? "",
      specs: Array.isArray(row?.specs) ? row.specs : [],
    }));
  }

  // ビジュアルDLの定義が増えた場合に備えて、足りないグループを補う
  const existing = new Map(
    (Array.isArray(merged.visualDownloads) ? merged.visualDownloads : []).map((v) => [v.key, v])
  );
  merged.visualDownloads = VISUAL_DOWNLOAD_DEFS.map((d) => {
    const cur = existing.get(d.key);
    return {
      key: d.key,
      label: d.label,
      size: d.size,
      links: Array.isArray(cur?.links) ? cur.links : [],
    };
  });

  return merged;
}
