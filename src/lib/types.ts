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

/* ------------------------------------------------------------------ *
 * 店舗と価格
 *
 * 以前は「東京ほか4店で1つの価格」「嘉麻で1つの価格」の2つしか持てなかった。
 * 2026年9月17日の飛騨高山定例で、はみ出る鰻玉が 浅草1,500円／飛騨高山2,000円 と
 * 決まり、同じ欄の中で価格が割れたため、店舗ごとに持てるようにした。
 *
 * 持ち方は「標準価格 ＋ 標準と違う店だけの例外」。ほとんどの商品は全店同じなので、
 * 例外を持たなければ今までと同じ1つの価格で済む。
 * ------------------------------------------------------------------ */

export type StoreId = "ginza" | "harajuku" | "asakusa" | "hida" | "kama";

/** 画面に出す順番。北から南ではなく、直営4店→嘉麻の順 */
export const STORE_IDS: StoreId[] = ["ginza", "harajuku", "asakusa", "hida", "kama"];

export const STORE_LABELS: Record<StoreId, string> = {
    ginza: "銀座",
    harajuku: "原宿",
    asakusa: "浅草",
    hida: "飛騨高山",
    kama: "嘉麻",
};

/** 標準価格と違う店の価格1件ぶん */
export interface StorePrice {
    price: number | null;
    /** Uber価格。null = 自動計算（price × UBER_RATE） */
    uber: number | null;
    /** この店では売らない商品。価格が無くても充足とみなす */
    notSold: boolean;
}

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

/** 再販したときの、前の年ぶんの準備タスク（参照用・runs へ移行済みの古い形） */
export interface TaskYearArchive {
    year: string; // 例 "2025"
    state: Record<string, boolean>; // task_state と同じ形
}

/**
 * 「販売の回」1回ぶん。
 *
 * 同じ商品でも、年やバージョン（ハロウィン仕様など）で出し直すことがある。
 * 1回ごとに変わるのは 発売月・販売終了月・ビジュアル・準備タスク の4つだけ。
 * 品名・材料・価格・レシピ・紹介文は商品で1つ（ものは同じなので）。
 */
export interface ProductRun {
    label: string; // 「2025 通常」「2026 ハロウィン」など。自由に付けられる
    releaseDate: string;
    endDate: string;
    ongoing: boolean;
    visuals: VisualLinkGroup[];
    taskState: Record<string, boolean>;
}

export interface VisualLinkGroup {
    key: string;
    label: string;
    size: string;
    links: string[];
    /**
     * その商品に「このビジュアルは存在しない」ことを明示する印。
     *
     * true  … ありません（必須の数＝分母から外す）
     * false … あります（ジャンルの既定に関係なく必須として数える）
     * 未設定 … ジャンルの既定にしたがう（レギュラー商品は3件だけ必須）
     *
     * レギュラー商品はInstagram投稿やポスターを作らないので、そもそも
     * データが存在しない。未入力として残り続けると進捗が実態と合わないため、
     * 押して分母から外せるようにしている（`isRequiredVisualKey`）。
     * バナナブリュレのようにシーズンからレギュラー化して全部そろっている商品は、
     * false を入れて全件を必須に戻す。
     */
    na?: boolean;
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
  // 標準価格（priceBase）を全店の基準にして、これと違う店だけ priceByStore に入れる。
  // 店舗によっては売らない商品があるので、店舗ごとに「取り扱いなし」を持てる。
  priceBase: number | null; // 標準価格。例外を入れていない店はこの値で売る
  priceBaseUber: number | null; // 上記のUber価格。null = 自動計算（priceBase × 1.4）
  priceBaseNotSold: boolean;
  /** 標準と違う店だけ。嘉麻はほとんどの商品で価格が違うので、必須の数に入れている */
  priceByStore: Partial<Record<StoreId, StorePrice>>;

  // 材料
  ingredients: IngredientRow[];

  // 作り方
  howToVideoUrl: string;
  // レシピの画像。準備タスクの「レシピ作成」から貼る。1枚でも入れば完了扱い
  recipeImages: string[];
    recipeNotes: string;

  // ビジュアルダウンロード
  // ビジュアルは年ごとに作り直すことがある。visualDownloads は「一番新しい年」＝
  // 今準備している年で、必須の数え方・カード画像・入力率はすべてこちらだけを見る。
  // 古い年は visualArchives に参照用として残す。
  visualYear: string; // 一番新しい年のラベル。空なら年で分けていない
  visualDownloads: VisualLinkGroup[];
  visualArchives: VisualYearArchive[];

  // 準備タスクも年ごとに持つ。再販したとき、前の年のチェックを残したまま
  // 今年ぶんを空から始められるようにするため。
  // 「今の年ぶん」は task_state テーブル側。進捗・締め切りの数え方はそちらだけを見る。
  taskYear: string; // 古い形。runs へ移行済み
  taskArchives: TaskYearArchive[]; // 古い形。runs へ移行済み

  // 販売の回。「今の回」は releaseDate / endDate / ongoing / visualDownloads と
  // task_state テーブルに入っている（数え方はすべてそちらだけを見る）。
  // runs は終わった回の控え。新しい順に並べる。
  runLabel: string; // 今の回の名前（例「2026 ハロウィン」）。空なら回で分けていない
  runs: ProductRun[];

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
    /**
     * タスク名のうしろに小さく添える注記。
     * タスク名と同じ大きさ・濃さで書くと、肝心のタスク名が読み取りにくくなるため、
     * 注記は label に混ぜずにここへ入れる（表示は `TaskNote`）。
     */
    note?: string;
    children?: TaskLeaf[]; // 制作/入稿など、サブチェックがある場合
    /** 行の右に出す、別アプリ・別シートを開くボタン（複数可） */
    links?: { url: string; label: string }[];
    /**
     * 情報シートの項目と連動するタスク。
     * チェックの代わりにシートの値をそのまま出し、どちらかに付ければ両方に付く。
     * 状態は情報シート側だけが持つので、2つの画面で食い違わない。
     */
    linkedField?:
        | "noAlcoholPork"
        | "recipeImages"
        | "priceBase"
        | "priceBaseUber"
        /** 店舗別の価格。例：`priceStore:kama` = 嘉麻の元価格 */
        | `priceStore:${StoreId}`
        | `priceStoreUber:${StoreId}`;
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
