/** 優先度。未選択は空文字。 */
export type Prio = "A" | "B" | "C" | "";

/** 項目に添付した写真。path は Supabase Storage 上の位置、url は表示用。 */
export type Photo = {
  path: string;
  url: string;
};

/** チェック項目1つ分の記録 */
export type ItemRecord = {
  /** 見た（確認した） */
  done: boolean;
  prio: Prio;
  memo: string;
  photos: Photo[];
};

/**
 * 訪問1回分の記録。同じ店に期間中2回行くことがあるので、
 * 「店舗ごと」ではなく「店舗＋日付ごと」に1件持つ。
 * Supabase には訪問ごとに1行、この形の JSON で入る。
 */
export type VisitData = {
  storeId: string;
  /** 訪問日（YYYY-MM-DD） */
  date: string;
  /** 時間帯などの補足メモ */
  memo: string;
  /** CHECK_ITEMS と同じ並び・同じ数 */
  items: ItemRecord[];
};

/** 一覧に出すときの1件。id は店舗と日付から作る（makeVisitId） */
export type Visit = VisitData & { id: string };

/** アンケート1枚分の回答。値は選択肢の id（未回答は空文字）。 */
export type SurveyAnswer = {
  q1: string;
  q2: string;
  /** Q2 の「国名」自由記入 */
  country: string;
  q3: string;
  q4: string;
  q5: string;
  q6: string;
};

/** 保存済みのアンケート回答1件 */
export type SurveyResponse = {
  id: string;
  storeId: string;
  /** 回答日（YYYY-MM-DD） */
  answeredOn: string;
  data: SurveyAnswer;
};

export type SaveState = "idle" | "saving" | "saved" | "error";
