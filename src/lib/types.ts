// Age.3 新商品シート — データ型定義

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

/** 過去の年のビジュアル一式。参照用に取っておくだけで、必須の数には入らない */
export interface VisualYearArchive {
    year: string; // 例 "2025"
    groups: VisualLinkGroup[];
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
    slipName: string; // 伝票記載名。伝票・レジに出す短い名前
    releaseDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  ongoing: boolean; // 継続販売中（販売終了日を設けないレギュラー商品など）
  discontinued: boolean; // 廃盤。作らなくなった商品を、現行の一覧や集計から外す
  nameEn: string;
    descriptionJa: string;
    descriptionEn: string;
    instagramPost: string;
    // 価格はすべて数値（税込・円）。未入力は null。
  // 片方の店舗でしか売らない商品があるので、店舗ごとに「取り扱いなし」を持てる
  priceTokyoNotSold: boolean;
  priceKamaNotSold: boolean;
  priceTokyo: number | null; // 銀座・原宿・浅草・飛騨高山
  priceTokyoUber: number | null; // 上記のUber価格。null = 自動計算（priceTokyo × 1.4）
  priceKama: number | null; // 嘉麻
  priceKamaUber: number | null; // 上記のUber価格。null = 自動計算（priceKama × 1.4）

  // 材料
  ingredients: IngredientRow[];

  // 作り方
  howToVideoUrl: string;
    recipeNotes: string;

  // ビジュアルダウンロード
  // ビジュアルは年ごとに作り直すことがある。visualDownloads は「一番新しい年」＝
  // 今準備している年で、必須の数え方・カード画像・入力率はすべてこちらだけを見る。
  // 古い年は visualArchives に参照用として残す。
  visualYear: string; // 一番新しい年のラベル。空なら年で分けていない
  visualDownloads: VisualLinkGroup[];
  visualArchives: VisualYearArchive[];

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
    /**
     * 情報シートの項目と連動するタスク。
     * チェックの代わりにシートの値をそのまま出し、どちらかに付ければ両方に付く。
     * 状態は情報シート側だけが持つので、2つの画面で食い違わない。
     */
    linkedField?:
        | "noAlcoholPork"
        | "priceTokyo"
        | "priceTokyoUber"
        | "priceKama"
        | "priceKamaUber";
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
