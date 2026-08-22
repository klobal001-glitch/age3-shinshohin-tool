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
    priceTokyo: "",
    priceKama: "",
    priceUber: "",
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
    !!info.priceTokyo,
    !!info.priceKama,
    !!info.priceUber,
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
