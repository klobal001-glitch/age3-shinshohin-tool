import type { ProductInfo } from "../types";
import { DeckDraft, DeckLanguage, DeckCopy, LANGUAGES } from "./types";

export const sourceIngredients = (info: ProductInfo) => info.ingredients.filter(i => i.nameJa.trim() || i.nameEn.trim());
export function sourceSignature(info: ProductInfo): string {
  // Snapshot only source facts that affect the guide. No prices or internal specs enter translation.
  return JSON.stringify([info.nameJa, info.nameEn, info.releaseDate, info.endDate, info.descriptionJa,
    info.descriptionEn, sourceIngredients(info).map(i => [i.nameJa,i.nameEn,i.amount,i.photoUrl]),
    info.visualDownloads,info.howToVideoUrl,info.recipeImages]);
}
export function createDeckDraft(info: ProductInfo): DeckDraft {
  const ingredients = sourceIngredients(info);
  const copies = Object.fromEntries(LANGUAGES.map(lang => {
    const description = lang === "ja" ? info.descriptionJa : lang === "en" ? info.descriptionEn : "";
    const c: DeckCopy = {
      name: lang === "ja" ? info.nameJa : lang === "en" ? info.nameEn : "",
      lead: "",description,features: [],caption: "",quantityNote: "",
      ingredientNames: ingredients.map(i => lang === "ja" ? i.nameJa : lang === "en" ? i.nameEn : ""),
      ingredientAmounts: ingredients.map(i => lang === "ja" ? i.amount : ""),
    };
    return [lang,c];
  })) as Record<DeckLanguage,DeckCopy>;
  return { version:1,sourceSignature:sourceSignature(info),sourceConfirmed:false,checkedLanguages:{},
    palette:{deep:"#164e38",accent:"#dc6516",paper:"#f7f7f0"},copies,recipeLanguage:"日本語・英語", };
}
export function assetSources(info: ProductInfo): Record<string,string> {
  const links = (key:string) => info.visualDownloads.find(g=>g.key===key)?.links.filter(Boolean) ?? [];
  const feed=links("ig_feed");
  const sources: Record<string,string> = {
    product:links("product_image")[0]??"",ig1:feed[0]??"",ig2:feed[1]??"",ig3:feed[2]??"",
    story:links("ig_story")[0]??"",portrait:links("signage_v")[0]??"",landscape:links("signage_h")[0]??"",
    poster:links("poster_a1_asakusa")[0]??"",recipe:info.recipeImages[0]??"",
  };
  sourceIngredients(info).forEach((row,i)=>{sources[`ingredient${i}`]=row.photoUrl;});
  return sources;
}
export function copyProblems(copy:DeckCopy,count:number):string[] {
  const out:string[]=[];
  if(!copy.name.trim())out.push("商品名");
  if(!copy.lead.trim())out.push("表紙のひとこと");
  if(!copy.description.trim())out.push("商品説明");
  if(!copy.caption.trim())out.push("Instagram紹介文");
  if(copy.features.length<1||copy.features.length>5||copy.features.some(f=>!f.title.trim()||!f.text.trim()))out.push("商品の特徴（1〜5件）");
  if(copy.ingredientNames.length!==count||copy.ingredientNames.some(s=>!s.trim()))out.push("食材名");
  if(copy.ingredientAmounts.length!==count||copy.ingredientAmounts.some(s=>!s.trim()))out.push("使用量の翻訳");
  return out;
}
export function translationPrompt(info:ProductInfo,draft:DeckDraft):string {
  return `Age.3の海外FC向け商品紹介資料を翻訳してください。出力は {"en":{...},"th":{...},"vi":{...},"zh":{...}} のJSONのみ。zhは簡体字。各オブジェクトは次の日本語と同じキー・配列件数。食材の順番・数字・単位の意味を維持し、商品名・食材名以外の事実を追加しないこと。素材画像内の文字やレシピ原本は翻訳対象外。レシピの使用量の差異がある場合はquantityNoteの判断を保持。公開用の文章に価格・仕入れ・内部メモ・NO ALCOHOL/NO PORK対応表現を追加しないこと。\n日本語原稿：\n${JSON.stringify(draft.copies.ja,null,2)}\n英語の登録説明（参考）：${info.descriptionEn}`;
}
export function parseTranslations(raw:string,count:number):Partial<Record<DeckLanguage,DeckCopy>> {
  const obj=JSON.parse(raw.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/, ""));
  if(!obj||typeof obj!=="object"||Array.isArray(obj))throw new Error("翻訳原稿は言語ごとのJSONで貼り付けてください。");
  const result:Partial<Record<DeckLanguage,DeckCopy>>={};
  for(const lang of LANGUAGES.filter(l=>l!=="ja")) {
    const c=obj[lang];if(c===undefined)continue;
    if(!c||typeof c!=="object"||!["name","lead","description","caption","quantityNote"].every(k=>typeof c[k]==="string")||
      !Array.isArray(c.features)||!c.features.every((f:unknown)=>!!f&&typeof f==="object"&&typeof (f as {title?:unknown}).title==="string"&&typeof (f as {text?:unknown}).text==="string")||
      !Array.isArray(c.ingredientNames)||!c.ingredientNames.every((s:unknown)=>typeof s==="string")||
      !Array.isArray(c.ingredientAmounts)||!c.ingredientAmounts.every((s:unknown)=>typeof s==="string"))throw new Error(`${lang}の原稿の形式を確認してください。`);
    if(copyProblems(c,count).length)throw new Error(`${lang}の原稿が不足しています：${copyProblems(c,count).join("、")}`);
    result[lang]={name:c.name,lead:c.lead,description:c.description,features:c.features.map((f:{title:string;text:string})=>({title:f.title,text:f.text})),caption:c.caption,quantityNote:c.quantityNote,ingredientNames:c.ingredientNames,ingredientAmounts:c.ingredientAmounts};
  }
  if(!Object.keys(result).length)throw new Error("en・th・vi・zhのいずれかの翻訳原稿を入れてください。");
  return result;
}

// Numeric tokens must survive translation, including full-width digits and fractions.
export function sameQuantityNumbers(source:string,translated:string):boolean {
  const numbers=(s:string)=>s.normalize("NFKC").match(/\d+(?:\.\d+)?/g)?.join("|")??"";
  return numbers(source)===numbers(translated);
}
export function assertTranslationQuantities(copies:Partial<Record<DeckLanguage,DeckCopy>>,amounts:string[]):void {
  for(const [lang,copy] of Object.entries(copies)) {
    if(copy.ingredientAmounts.length!==amounts.length||amounts.some((a,i)=>!sameQuantityNumbers(a,copy.ingredientAmounts[i])))
      throw new Error(`${lang}の分量の数字が元データと一致しません。翻訳を修正してください。`);
  }
}

export function generationSource(info:ProductInfo,quantityNote="") {
  const rows=sourceIngredients(info);
  return {name:info.nameJa,description:info.descriptionJa,referenceEnglish:info.descriptionEn,
    ingredientNames:rows.map(i=>i.nameJa),ingredientAmounts:rows.map(i=>i.amount),quantityNote};
}
export function sourceProblems(info:ProductInfo):string[] {
  const missing:string[]=[];
  if(!info.nameJa.trim())missing.push("日本語の商品名");
  if(!info.descriptionJa.trim())missing.push("日本語の商品説明");
  if(!info.releaseDate.trim())missing.push("日本の販売開始日");
  const rows=sourceIngredients(info);
  if(rows.length<1||rows.length>8)missing.push("食材一覧（1〜8品）");
  rows.forEach((row,i)=>{if(!row.nameJa.trim())missing.push(`食材${i+1}の日本語名`);if(!row.amount.trim())missing.push(`${row.nameJa||`食材${i+1}`}の使用量`);});
  return missing;
}
