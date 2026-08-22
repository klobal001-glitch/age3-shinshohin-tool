// Age.3 新商品ツール — データ型定義

export type Genre =
    | "regular_sweet" // レギュラースイーツ
  | "regular_savory" // レギュラーセイボリー
  | "sweets_sand" // スイーツサンド
  | "fruit_sand" // フルーツサンド
  | "single" // 単品
  | "shop_limited" // 店舗限定
  | "season" // シーズン
  | null; // 指定なし

export const GENRE_LABELS: Record<NonNullable<Genre>, string> = {
    regular_sweet: "レギュラースイーツ",
    regular_savory: "レギュラーセイボリー",
    sweets_sand: "スイーツサンド",
    fruit_sand: "フルーツサンド",
    single: "単品",
    shop_limited: "店舗限定",
    season: "シーズン",
};

export interface Product {
    id: string;
    name: string;
    genre: Genre;
    custom: boolean; // ユーザーが追加した商品か
}

export interface IngredientRow {
    nameJa: string;
    nameEn: string;
    amount: string;
    specs: string[]; // 詳細スペック（任意・複数可）
}

export interface VisualLinkGroup {
    key: string;
    label: string;
    size: string;
    links: string[];
}

export interface ProductInfo {
    // 基本データ
  noAlcoholPork: "mark" | "nomark" | null;
    nameJa: string;
    releaseDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  nameEn: string;
    descriptionJa: string;
    descriptionEn: string;
    instagramPost: string;
    priceTokyo: string; // 銀座・原宿・浅草・飛騨高山
  priceKama: string; // 嘉麻
  priceUber: string; // Uber

  // 材料
  ingredients: IngredientRow[];

  // 作り方
  howToVideoUrl: string;
    recipeNotes: string;

  // ビジュアルダウンロード
  visualDownloads: VisualLinkGroup[];

  // 紹介文各種（SNS・PR）
  igCaption: string;
    xCaption: string;
    threadsCaption: string;
    pressEmail: string;
    prTimesUrl: string;
}

export interface TaskLeaf {
    id: string; // グループ内でユニーク
  label: string;
}

export interface TaskItem {
    id: string;
    label: string;
    children?: TaskLeaf[]; // 制作/入稿など、サブチェックがある場合
}

export type DeadlineRule =
    | { type: "monthsBefore"; months: number; day: number } // 発売月からmonthsか月前のday日
  | { type: "weekBeforeWeekday" } // 発売日の1週間前の平日
  | { type: "afterRule"; refGroupId: string; refMilestoneIndex: number; days: number } // 他マイルストーンのN日後
  | { type: "endOfMonth"; useEndDate: boolean }; // 月末（販売終了月 or 発売月）

export interface Milestone {
    id: string;
    label: string; // 例: 前々月28日まで
  rule: DeadlineRule;
    note?: string;
    tasks: TaskItem[];
}

export interface TaskGroup {
    id: string; // A-1, G-1 ...
  icon: string;
    title: string;
    milestones: Milestone[];
}
