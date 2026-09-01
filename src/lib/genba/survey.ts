import { SurveyAnswer, SurveyResponse } from "@/lib/genba/types";

export type SurveyOption = {
  id: string;
  /** 用紙と同じ英語のラベル */
  en: string;
  /** 日本語（集計画面ではこちらを主に出す） */
  ja: string;
  emoji: string;
};

export type SurveyQuestion = {
  /** SurveyAnswer のキー */
  key: "q1" | "q2" | "q3" | "q4" | "q5" | "q6";
  no: number;
  en: string;
  ja: string;
  options: SurveyOption[];
  /** Q2 のように「国名」を自由記入させる設問 */
  writeIn?: { key: "country"; label: string };
  /**
   * 設問ごとの色。お客様がスマホで答えるとき、画面が切り替わったことと
   * どこまで進んだかが一目で分かるようにするため。
   */
  color: string;
};

/**
 * 店頭で配っているアンケート用紙（A4・全6問）と同じ設問・同じ並び。
 * 用紙を差し替えるときは、必ずこちらも一緒に直すこと。
 */
export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    key: "q1",
    color: "#2f8f9d",
    no: 1,
    en: "How did you hear about us?",
    ja: "何を見て来店しましたか？",
    options: [
      { id: "flyer", en: "Flyer", ja: "チラシ", emoji: "📄" },
      { id: "sns", en: "SNS", ja: "SNS（Instagram / TikTok / X）", emoji: "📱" },
      { id: "google", en: "Google / Reviews", ja: "Google・口コミ", emoji: "📍" },
      { id: "walking", en: "Walking by", ja: "通りがかり", emoji: "🚶" },
      { id: "friend", en: "Friend / Family", ja: "友人・家族の紹介", emoji: "👥" },
      { id: "media", en: "TV / Magazine", ja: "テレビ・雑誌", emoji: "📺" },
    ],
  },
  {
    key: "q2",
    color: "#3d7ab8",
    no: 2,
    en: "Which country are you from?",
    ja: "どちらの国からお越しですか？",
    options: [
      { id: "japan", en: "Japan", ja: "日本", emoji: "🇯🇵" },
      { id: "east_asia", en: "East Asia", ja: "東アジア（韓国・中国・台湾・香港）", emoji: "🌏" },
      { id: "southeast_asia", en: "Southeast Asia", ja: "東南アジア（タイ・ベトナム・比・星）", emoji: "🌏" },
      { id: "europe", en: "Europe", ja: "ヨーロッパ（仏・英・独・伊・西）", emoji: "🌍" },
      { id: "north_america", en: "North America", ja: "北米（USA・カナダ）", emoji: "🌎" },
      { id: "oceania", en: "Oceania", ja: "オセアニア（豪・NZ）", emoji: "🌐" },
      { id: "middle_east", en: "Middle East", ja: "中東（UAE・サウジ 他）", emoji: "🕌" },
      { id: "other", en: "Other", ja: "その他", emoji: "✏️" },
    ],
    writeIn: { key: "country", label: "国名（Country）" },
  },
  {
    key: "q3",
    color: "#c1741c",
    no: 3,
    en: "What made you want to try it?",
    ja: "食べたいと思った理由は？",
    options: [
      { id: "photo", en: "Photo looked good", ja: "写真がおいしそう", emoji: "📷" },
      { id: "price", en: "The price", ja: "価格", emoji: "💴" },
      { id: "unique", en: "Looked unique", ja: "珍しい・気になった", emoji: "✨" },
      { id: "recommended", en: "Recommended", ja: "すすめられた", emoji: "🙌" },
      { id: "other", en: "Other", ja: "その他", emoji: "✏️" },
    ],
  },
  {
    key: "q4",
    color: "#c05f8a",
    no: 4,
    en: "Did the smell attract you?",
    ja: "匂いにひかれましたか？",
    options: [
      { id: "a_lot", en: "Yes, a lot", ja: "強くひかれた", emoji: "😋" },
      { id: "a_little", en: "A little", ja: "少し", emoji: "🙂" },
      { id: "not_really", en: "Not really", ja: "あまり", emoji: "😐" },
    ],
  },
  {
    key: "q5",
    color: "#46a06b",
    no: 5,
    en: "Was it easy to order?",
    ja: "注文はしやすかったですか？",
    options: [
      { id: "very_easy", en: "Very easy", ja: "とても簡単", emoji: "😄" },
      { id: "ok", en: "OK", ja: "ふつう", emoji: "🙂" },
      { id: "difficult", en: "Difficult", ja: "難しかった", emoji: "😕" },
    ],
  },
  {
    key: "q6",
    color: "#6c5fa8",
    no: 6,
    en: "How was the price?",
    ja: "価格の印象は？",
    options: [
      { id: "cheap", en: "Cheap", ja: "安い", emoji: "💰" },
      { id: "reasonable", en: "Reasonable", ja: "ちょうどよい", emoji: "👍" },
      { id: "expensive", en: "Expensive", ja: "高い", emoji: "💸" },
    ],
  },
];

export function createEmptyAnswer(): SurveyAnswer {
  return { q1: "", q2: "", country: "", q3: "", q4: "", q5: "", q6: "" };
}

export function normalizeAnswer(raw: unknown): SurveyAnswer {
  const base = createEmptyAnswer();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const pick = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  return {
    q1: pick("q1"),
    q2: pick("q2"),
    country: pick("country"),
    q3: pick("q3"),
    q4: pick("q4"),
    q5: pick("q5"),
    q6: pick("q6"),
  };
}

/** 1枚でも回答が入っているか（空の用紙を保存しないため） */
export function hasAnyAnswer(a: SurveyAnswer): boolean {
  return SURVEY_QUESTIONS.some((q) => a[q.key] !== "") || a.country.trim() !== "";
}

export type TallyRow = {
  option: SurveyOption;
  count: number;
  /** 回答があった枚数に対する割合（0〜100） */
  percent: number;
};

/**
 * 設問1つ分を集計する。
 * 分母は「その設問に回答があった枚数」。無回答は分母から外す。
 */
export function tally(responses: SurveyResponse[], q: SurveyQuestion): { rows: TallyRow[]; answered: number } {
  const counts = new Map<string, number>();
  let answered = 0;
  for (const r of responses) {
    const v = r.data[q.key];
    if (!v) continue;
    answered += 1;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const rows = q.options.map((option) => {
    const count = counts.get(option.id) ?? 0;
    return { option, count, percent: answered === 0 ? 0 : (count / answered) * 100 };
  });
  return { rows, answered };
}

/** Q2 の自由記入欄に書かれた国名を、多い順に数える */
export function tallyCountries(responses: SurveyResponse[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of responses) {
    const name = r.data.country.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
}
