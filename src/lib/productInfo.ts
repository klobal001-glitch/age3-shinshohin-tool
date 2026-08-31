import { Genre, IngredientRow, ProductInfo, VisualLinkGroup } from "./types";

export const VISUAL_DOWNLOAD_DEFS: { key: string; label: string; size: string }[] = [
  { key: "product_image", label: "商品画像", size: "背景なし画像" },
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

/**
 * レギュラー商品で必須にするビジュアル。
 *
 * レギュラー商品は Instagram・ポスター・サイネージなどを作らないため、
 * この3つが埋まればビジュアルは完成として扱う。
 * 残りの項目は任意として、入力欄は今までどおり出す。
 */
export const REGULAR_REQUIRED_VISUAL_KEYS = ["product_image", "uber_image", "airregi"];

/** レギュラースイーツ／レギュラーセイボリーか */
export function isRegularGenre(genre: Genre): boolean {
  return genre === "regular_sweet" || genre === "regular_savory";
}

/** そのジャンルで、このビジュアルが必須かどうか */
export function isRequiredVisualKey(genre: Genre, key: string): boolean {
  return isRegularGenre(genre) ? REGULAR_REQUIRED_VISUAL_KEYS.includes(key) : true;
}

/** そのジャンルで必須になるビジュアルの数 */
export function requiredVisualTotal(genre: Genre): number {
  return isRegularGenre(genre)
    ? REGULAR_REQUIRED_VISUAL_KEYS.length
    : VISUAL_DOWNLOAD_DEFS.length;
}

/** 必須のビジュアルのうち、リンクが入っている数 */
export function requiredVisualFilled(info: ProductInfo, genre: Genre): number {
  return info.visualDownloads.filter(
    (v) => isRequiredVisualKey(genre, v.key) && v.links.some((l) => l.trim())
  ).length;
}

/** 新しい商品を作ったときに最初から用意しておく材料の行数。 */
export const DEFAULT_INGREDIENT_ROWS = 5;

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
    ongoing: false,
    discontinued: false,
    nameEn: "",
    descriptionJa: "",
    descriptionEn: "",
    instagramPost: "",
    priceTokyo: null,
    priceTokyoUber: null,
    priceKama: null,
    priceKamaUber: null,
    ingredients: Array.from({ length: DEFAULT_INGREDIENT_ROWS }, () => ({
      nameJa: "",
      nameEn: "",
      amount: "",
      specs: [] as string[],
    })),
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

export function requiredProgress(info: ProductInfo, genre: Genre): ProgressCount {
  const checks: boolean[] = [
    !!info.nameJa,
    !!info.releaseDate,
    info.noAlcoholPork !== null,
    info.priceTokyo !== null,
    info.priceKama !== null,
    info.ingredients.some((i) => i.nameJa && i.amount),
    // 各サイズのビジュアルは1つでもリンクが入っていれば充足（空欄の行は数えない）。
    // レギュラー商品は必須が3件だけなので、それ以外は数に入れない
    ...info.visualDownloads
      .filter((v) => isRequiredVisualKey(genre, v.key))
      .map((v) => v.links.some((l) => l.trim())),
  ];
  return { filled: checks.filter(Boolean).length, total: checks.length };
}

/**
 * 発売時のPRに使う文面。レギュラー商品は発売告知をしないので、
 * これらが空でも入力率100%になるよう、数から外す。
 * （入力欄は今までどおり出す。書きたくなったら書ける）
 */
function launchPrChecks(info: ProductInfo): boolean[] {
  return [
    !!info.igCaption,
    !!info.xCaption,
    !!info.threadsCaption,
    !!info.pressEmail,
    !!info.prTimesUrl,
  ];
}

export function optionalProgress(info: ProductInfo, genre: Genre): ProgressCount {
  const checks: boolean[] = [
    !!info.nameEn,
    !!info.endDate || info.ongoing,
    !!info.descriptionJa,
    !!info.descriptionEn,
    !!info.instagramPost,
    !!info.howToVideoUrl,
    !!info.recipeNotes,
    ...(isRegularGenre(genre) ? [] : launchPrChecks(info)),
  ];
  return { filled: checks.filter(Boolean).length, total: checks.length };
}

/**
 * 「5 紹介文各種（SNS・PR）」の進捗。
 * 紹介文2件は全ジャンル共通、発売時のPR文面5件はレギュラー商品では数えない。
 */
export function snsProgress(info: ProductInfo, genre: Genre): ProgressCount {
  const checks: boolean[] = [
    !!info.descriptionJa,
    !!info.descriptionEn,
    ...(isRegularGenre(genre) ? [] : launchPrChecks(info)),
  ];
  return { filled: checks.filter(Boolean).length, total: checks.length };
}

/**
 * 材料の入力状況。
 *
 * 材料が2つしかない商品もあるので、空の行を「未入力」として数えない。
 * 何か書いてある行だけを数え、品名と分量が揃っていれば充足とする。
 * （途中まで書いた行があれば、そこだけが残りとして出る）
 */
export function ingredientsProgress(info: ProductInfo): ProgressCount {
  const started = info.ingredients.filter((i) => !isBlankIngredientRow(i));
  return {
    filled: started.filter((i) => i.nameJa.trim() && i.amount.trim()).length,
    // 1件も書いていないときは「1件は要る」という意味で 0/1 にする
    total: Math.max(1, started.length),
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

/** 品名・分量・詳細スペックがすべて空の行か */
export function isBlankIngredientRow(row: IngredientRow): boolean {
  return (
    !row.nameJa.trim() &&
    !row.nameEn.trim() &&
    !row.amount.trim() &&
    row.specs.every((s) => !s.trim())
  );
}

/**
 * 材料の行をそろえる。
 * - 末尾に続く空行は取り除く（過去に大量の空行が入ってしまったデータの掃除）
 * - 入力しやすいように DEFAULT_INGREDIENT_ROWS 行までは空行を補う
 * 途中にある空行は、意図して空けている場合があるので残す。
 */
export function normalizeIngredientRows(rows: unknown[]): IngredientRow[] {
  const cleaned: IngredientRow[] = rows.map((raw) => {
    const row = (raw ?? {}) as Partial<IngredientRow>;
    return {
      nameJa: row.nameJa ?? "",
      nameEn: row.nameEn ?? "",
      amount: row.amount ?? "",
      specs: Array.isArray(row.specs) ? row.specs : [],
    };
  });

  while (cleaned.length > 0 && isBlankIngredientRow(cleaned[cleaned.length - 1])) {
    cleaned.pop();
  }
  while (cleaned.length < DEFAULT_INGREDIENT_ROWS) {
    cleaned.push({ nameJa: "", nameEn: "", amount: "", specs: [] });
  }
  return cleaned;
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

  merged.ongoing = r.ongoing === true;
  merged.discontinued = r.discontinued === true;
  merged.priceTokyo = legacyPriceToNumber(r.priceTokyo);
  merged.priceKama = legacyPriceToNumber(r.priceKama);
  merged.priceTokyoUber = legacyPriceToNumber(r.priceTokyoUber);
  merged.priceKamaUber = legacyPriceToNumber(r.priceKamaUber);

  if (!Array.isArray(merged.ingredients) || merged.ingredients.length === 0) {
    merged.ingredients = base.ingredients;
  } else {
    merged.ingredients = normalizeIngredientRows(merged.ingredients);
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
