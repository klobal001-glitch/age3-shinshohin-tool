import {
  Genre,
  IngredientRow,
  ProductInfo,
  StoreId,
  StorePrice,
  STORE_IDS,
  storeMoney,
  ProductRun,
  TaskYearArchive,
  VisualLinkGroup,
  VisualYearArchive,
} from "./types";

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

/**
 * このビジュアルを必須として数えるか。
 *
 * 商品ごとの「ありません」（`group.na`）が入っていれば、そちらが優先。
 * 入っていなければジャンルの既定にしたがう（レギュラー商品は3件だけ必須）。
 * 「ありません」を押した枠は分母から外れるので、進捗が実態と合う。
 */
export function isRequiredVisualKey(
  genre: Genre,
  key: string,
  group?: Pick<VisualLinkGroup, "na">
): boolean {
  if (group && typeof group.na === "boolean") return !group.na;
  return isRegularGenre(genre) ? REGULAR_REQUIRED_VISUAL_KEYS.includes(key) : true;
}

/**
 * その商品で必須になるビジュアルの数。
 * 「ありません」にした枠は数えない。
 */
export function requiredVisualTotal(genre: Genre, info?: ProductInfo): number {
  if (!info) {
    /* 商品が分からないときはジャンルの既定だけで数える（後方互換） */
    return isRegularGenre(genre)
      ? REGULAR_REQUIRED_VISUAL_KEYS.length
      : VISUAL_DOWNLOAD_DEFS.length;
  }
  return info.visualDownloads.filter((v) => isRequiredVisualKey(genre, v.key, v)).length;
}

/** 必須のビジュアルのうち、リンクが入っている数 */
export function requiredVisualFilled(info: ProductInfo, genre: Genre): number {
  return info.visualDownloads.filter(
    (v) => isRequiredVisualKey(genre, v.key, v) && v.links.some((l) => l.trim())
  ).length;
}

/** 「ありません」にしてある枠の数（見出しに出す用） */
export function naVisualCount(info: ProductInfo): number {
  return info.visualDownloads.filter((v) => v.na === true).length;
}

/** 新しい商品を作ったときに最初から用意しておく材料の行数。 */
export const DEFAULT_INGREDIENT_ROWS = 5;

/** まっさらな材料の行 */
export function emptyIngredientRow(): IngredientRow {
  return { nameJa: "", nameEn: "", amount: "", specs: [], photoUrl: "", photoPath: "" };
}

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
    slipName: "",
    releaseDate: "",
    endDate: "",
    ongoing: false,
    discontinued: false,
    nameEn: "",
    descriptionJa: "",
    descriptionEn: "",
    instagramPost: "",
    priceBase: null,
    priceBaseUber: null,
    priceBaseNotSold: false,
    priceByStore: {},
    ingredients: Array.from({ length: DEFAULT_INGREDIENT_ROWS }, () => emptyIngredientRow()),
    howToVideoUrl: "",
    recipeImages: [],
    recipeNotes: "",
    visualYear: "",
    taskYear: "",
    taskArchives: [],
    runLabel: "",
    runs: [],
    visualDownloads,
    visualArchives: [],
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
    !!info.slipName,
    !!info.releaseDate,
    info.noAlcoholPork !== null,
    // 取り扱いのない店舗は、価格が無くても充足とみなす
    // 必須は「標準価格」と「嘉麻」の2件。ほかの店の例外は任意なので分母に入れない
    info.priceBase !== null || info.priceBaseNotSold,
    isStorePriceFilled(info, "kama"),
    info.ingredients.some((i) => i.nameJa && i.amount),
    // 各サイズのビジュアルは1つでもリンクが入っていれば充足（空欄の行は数えない）。
    // レギュラー商品は必須が3件だけなので、それ以外は数に入れない
    ...info.visualDownloads
      .filter((v) => isRequiredVisualKey(genre, v.key, v))
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

/* ------------------------------------------------------------------ *
 * 店舗別の価格
 *
 * 標準価格（priceBase）が全店の基準。これと違う店だけ priceByStore に入れる。
 * 例外を持たない店は、標準価格をそのまま使う。
 * ------------------------------------------------------------------ */

/** 空の店舗別価格（行を足したばかりの状態） */
export function emptyStorePrice(): StorePrice {
  return { price: null, uber: null, notSold: false };
}

/** その店に例外が入っているか（入っていなければ標準価格で売る） */
export function hasStorePrice(info: ProductInfo, store: StoreId): boolean {
  return !!info.priceByStore[store];
}

/** その店の価格欄が埋まっているか。取り扱いなしも埋まったものとして数える */
export function isStorePriceFilled(info: ProductInfo, store: StoreId): boolean {
  const sp = info.priceByStore[store];
  if (!sp) return false;
  return sp.price !== null || sp.notSold;
}

/** その店で実際に売る価格。例外が無ければ標準価格 */
export function resolveStorePrice(info: ProductInfo, store: StoreId): StorePrice {
  return (
    info.priceByStore[store] ?? {
      price: info.priceBase,
      uber: info.priceBaseUber,
      notSold: info.priceBaseNotSold,
    }
  );
}

/** priceByStore の一部だけを書き換えた新しい値を作る（patch にそのまま渡す形） */
export function patchStorePrice(
  info: ProductInfo,
  store: StoreId,
  change: Partial<StorePrice>
): Partial<Record<StoreId, StorePrice>> {
  const cur = info.priceByStore[store] ?? emptyStorePrice();
  return { ...info.priceByStore, [store]: { ...cur, ...change } };
}

/** その店の例外を取り消して、標準価格に戻す */
export function removeStorePrice(
  info: ProductInfo,
  store: StoreId
): Partial<Record<StoreId, StorePrice>> {
  const next = { ...info.priceByStore };
  delete next[store];
  return next;
}

/** 例外が入っている店を、画面に出す順番で並べて返す */
export function storePriceEntries(info: ProductInfo): { store: StoreId; value: StorePrice }[] {
  return STORE_IDS.filter((id) => info.priceByStore[id]).map((id) => ({
    store: id,
    value: info.priceByStore[id] as StorePrice,
  }));
}

/**
 * 保存されている店舗別価格をそろえる。
 * 知らない店舗名は捨て、欠けている欄は空で埋める。
 */
function normalizeStorePrices(raw: unknown): Partial<Record<StoreId, StorePrice>> {
  const out: Partial<Record<StoreId, StorePrice>> = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const id of STORE_IDS) {
    const v = r[id];
    if (!v || typeof v !== "object") continue;
    const sp = v as Record<string, unknown>;
    out[id] = {
      price: legacyPriceToNumber(sp.price),
      uber: legacyPriceToNumber(sp.uber),
      notSold: sp.notSold === true,
    };
  }
  return out;
}

/** 表示用フォーマット。null は空文字。 */
export function formatYen(value: number | null): string {
  if (value === null) return "";
  return `¥${value.toLocaleString("ja-JP")}`;
}

/**
 * 表示用フォーマット（店ごと）。海外の店は現地の記号で出す。
 * 店を渡さないときは標準価格＝円。
 */
export function formatPrice(value: number | null, store?: StoreId | null): string {
  if (value === null) return "";
  return `${storeMoney(store).symbol}${value.toLocaleString("ja-JP")}`;
}

/**
 * ビジュアルの各項目をそろえる。
 * 定義が増えたときに足りないグループを空リンクで補い、順番も定義どおりに直す。
 * 現行の年と過去の年で同じ処理を使う。
 */
function normalizeVisualGroups(groups: unknown): VisualLinkGroup[] {
  const existing = new Map(
    (Array.isArray(groups) ? groups : [])
      .filter((v): v is VisualLinkGroup => !!v && typeof (v as VisualLinkGroup).key === "string")
      .map((v) => [v.key, v])
  );
  return VISUAL_DOWNLOAD_DEFS.map((d) => {
    const cur = existing.get(d.key);
    const group: VisualLinkGroup = {
      key: d.key,
      label: d.label,
      size: d.size,
      links: Array.isArray(cur?.links) ? cur.links : [],
    };
    /* 「ありません／あります」の印は保存された値を必ず残す。
       ここで落とすと、読み込むたびに設定が消える */
    if (typeof cur?.na === "boolean") group.na = cur.na;
    return group;
  });
}

/** 品名・分量・詳細スペック・写真がすべて空の行か */
export function isBlankIngredientRow(row: IngredientRow): boolean {
  return (
    !row.nameJa.trim() &&
    !row.nameEn.trim() &&
    !row.amount.trim() &&
    !row.photoUrl.trim() &&
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
      photoUrl: typeof row.photoUrl === "string" ? row.photoUrl : "",
      photoPath: typeof row.photoPath === "string" ? row.photoPath : "",
    };
  });

  while (cleaned.length > 0 && isBlankIngredientRow(cleaned[cleaned.length - 1])) {
    cleaned.pop();
  }
  while (cleaned.length < DEFAULT_INGREDIENT_ROWS) {
    cleaned.push(emptyIngredientRow());
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
  merged.slipName = typeof r.slipName === "string" ? r.slipName : "";
  merged.discontinued = r.discontinued === true;

  /* 価格の古い形（東京ほか4店で1つ／嘉麻で1つ）を、
     標準価格＋店舗別の例外に読み替える。保存されている中身はそのままで、
     読み込んだ瞬間に新しい形になり、次の保存で置き換わる。 */
  const hasNewPrice = "priceBase" in r || "priceByStore" in r;
  merged.priceBase = legacyPriceToNumber(hasNewPrice ? r.priceBase : r.priceTokyo);
  merged.priceBaseUber = legacyPriceToNumber(hasNewPrice ? r.priceBaseUber : r.priceTokyoUber);
  merged.priceBaseNotSold = hasNewPrice
    ? r.priceBaseNotSold === true
    : r.priceTokyoNotSold === true;

  merged.priceByStore = normalizeStorePrices(r.priceByStore);
  /* 嘉麻は古い形では専用の欄だった。例外の1件として移す */
  if (!merged.priceByStore.kama) {
    const kamaPrice = legacyPriceToNumber(r.priceKama);
    const kamaUber = legacyPriceToNumber(r.priceKamaUber);
    const kamaNotSold = r.priceKamaNotSold === true;
    if (kamaPrice !== null || kamaUber !== null || kamaNotSold) {
      merged.priceByStore.kama = { price: kamaPrice, uber: kamaUber, notSold: kamaNotSold };
    }
  }

  /* 古い欄は保存し直さない（残すと2か所に価格が出来て食い違う） */
  const stale = merged as unknown as Record<string, unknown>;
  for (const key of [
    "priceTokyo",
    "priceTokyoUber",
    "priceTokyoNotSold",
    "priceKama",
    "priceKamaUber",
    "priceKamaNotSold",
  ]) {
    delete stale[key];
  }

  if (!Array.isArray(merged.ingredients) || merged.ingredients.length === 0) {
    merged.ingredients = base.ingredients;
  } else {
    merged.ingredients = normalizeIngredientRows(merged.ingredients);
  }

  merged.recipeImages = Array.isArray(merged.recipeImages)
    ? merged.recipeImages.filter((l): l is string => typeof l === "string")
    : [];
  merged.visualYear = typeof r.visualYear === "string" ? r.visualYear : "";
  merged.taskYear = typeof r.taskYear === "string" ? r.taskYear : "";
  merged.taskArchives = (Array.isArray(merged.taskArchives) ? merged.taskArchives : [])
    .filter((a): a is TaskYearArchive => !!a && typeof a.year === "string")
    .map((a) => ({ year: a.year, state: a.state && typeof a.state === "object" ? a.state : {} }));

  /* 販売の回。年だけで分ける形（taskYear / visualYear）から移ってきたデータは、
     ここで1度だけ runs に入れ替える。名前は年をそのまま使う。 */
  merged.runLabel = typeof r.runLabel === "string" ? r.runLabel : "";
  merged.runs = (Array.isArray(merged.runs) ? merged.runs : [])
    .filter((x): x is ProductRun => !!x && typeof x.label === "string")
    .map((x) => ({
      label: x.label,
      releaseDate: typeof x.releaseDate === "string" ? x.releaseDate : "",
      endDate: typeof x.endDate === "string" ? x.endDate : "",
      ongoing: !!x.ongoing,
      visuals: normalizeVisualGroups(x.visuals),
      taskState: x.taskState && typeof x.taskState === "object" ? x.taskState : {},
    }));
  if (merged.runs.length === 0) {
    const labels: string[] = [];
    for (const a of merged.taskArchives) if (!labels.includes(a.year)) labels.push(a.year);
    for (const a of merged.visualArchives) if (!labels.includes(a.year)) labels.push(a.year);
    if (labels.length > 0) {
      merged.runs = labels.map((label) => ({
        label,
        releaseDate: "",
        endDate: "",
        ongoing: false,
        visuals: merged.visualArchives.find((a) => a.year === label)?.groups ?? [],
        taskState: merged.taskArchives.find((a) => a.year === label)?.state ?? {},
      }));
      if (!merged.runLabel) merged.runLabel = merged.taskYear || merged.visualYear || "";
    }
  }
  if (!merged.runLabel && merged.runs.length > 0) merged.runLabel = "今の回";
  merged.visualDownloads = normalizeVisualGroups(merged.visualDownloads);
  merged.visualArchives = (Array.isArray(merged.visualArchives) ? merged.visualArchives : [])
    .filter((a): a is VisualYearArchive => !!a && typeof a.year === "string")
    .map((a) => ({ year: a.year, groups: normalizeVisualGroups(a.groups) }));

  return merged;
}
