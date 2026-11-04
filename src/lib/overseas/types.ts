export const LANGUAGES = ["ja", "en", "th", "vi", "zh"] as const;
export type DeckLanguage = typeof LANGUAGES[number];
export const LANGUAGE_NAMES: Record<DeckLanguage, string> = { ja: "日本語", en: "英語", th: "タイ語", vi: "ベトナム語", zh: "中国語（簡体字）" };
export interface DeckCopy {
  name: string;
  lead: string;
  description: string;
  features: { title: string; text: string }[];
  caption: string;
  ingredientNames: string[];
  ingredientAmounts: string[];
  quantityNote: string;
}
export interface DeckDraft {
  version: 1;
  sourceSignature: string;
  sourceConfirmed: boolean;
  checkedLanguages: Partial<Record<DeckLanguage, boolean>>;
  palette: { deep: string; accent: string; paper: string };
  copies: Record<DeckLanguage, DeckCopy>;
  recipeLanguage: string;
}
export interface DeckAsset { data: string; name: string; source: string }
export type DeckAssets = Record<string, DeckAsset>;
export interface DeckAttachment { bytes: ArrayBuffer; name: string }
