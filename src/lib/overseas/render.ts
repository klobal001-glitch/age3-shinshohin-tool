import type { ProductInfo } from "../types";
import type { DeckDraft, DeckLanguage, DeckAssets } from "./types";
import { sourceIngredients, webRecipeUrl } from "./model";
import { LABELS } from "./labels";
import { DECK_CSS } from "./style";

export const escapeHtml = (s:string) => s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function safeLink(s:string):string {
  try { const u=new URL(s);return u.protocol==="https:"?escapeHtml(u.href):""; } catch { return ""; }
}
export function documentHtml(info:ProductInfo,draft:DeckDraft,lang:DeckLanguage,assets:DeckAssets,fontCss:string,cover?:string,recipeHref?:string):string {
  const l=LABELS[lang],c=draft.copies[lang],e=escapeHtml;
  const image=(key:string,alt="",cls="")=>assets[key]?.data?`<img src="${e(assets[key].data)}" alt="${e(alt)}" class="${e(cls)}">`:`<div class="blank-visual">${e(alt)}</div>`;
  const label=(n:number,title:string)=>`<div class="section-label"><div class="num">${n}</div><div class="section-title">${e(title)}</div></div>`;
  const page=(n:number,body:string)=>`<section class="page ${n===1?"cover-page":""}"><div class="topline"></div>${body}<div class="footer"><b>Age.3 Japan Team</b><span>${e(l.footer)} ${n} / 7</span></div></section>`;
  const p1=page(1,`<div class="cover-wrap"><div><div class="kicker">Age.3 / NEW PRODUCT</div><div class="title-row"><div><div class="main-title">${e(c.name)}</div><div class="sub-title">${e(info.nameEn)}</div></div><div class="meta">${e(l.japanPeriod)}<br>${e(info.releaseDate)}${info.endDate?`<br>– ${e(info.endDate)}`:""}</div></div>${label(1,l.overview)}<div class="island cover-overview"><div class="cover-product">${image("product",c.name)}</div><div class="lead">${e(c.lead)}</div><div class="bodycopy">${e(c.description)}</div></div></div><div class="cover-right">${image("ig1",c.name)}</div></div>`);
  const p2=page(2,label(2,l.features)+`<div class="feature-layout"><div class="feature-img">${image("ig2",c.name)}</div><div class="checks">${c.features.map(f=>`<div class="check"><span class="dot">✓</span><div><b>${e(f.title)}</b><br>${e(f.text)}</div></div>`).join("")}</div></div>`);
  const p3=page(3,label(3,l.instagram)+`<div class="asset-grid">${["ig1","ig2","ig3","story"].map((key,i)=>`<div class="asset-card">${image(key,i<3?`Instagram ${i+1}`:"Instagram Stories")}<div class="asset-name">${i<3?`Instagram ${i+1}`:"Instagram Stories"}</div></div>`).join("")}</div><div class="caption-box"><b>${e(l.caption)}</b>\n${e(c.caption)}</div>`);
  const recipeName=recipeHref===undefined?(safeLink(webRecipeUrl(info))||"Age3_Standard_Recipe.pdf"):(safeLink(recipeHref)||"Age3_Standard_Recipe.pdf");
  const video=safeLink(info.howToVideoUrl);
  const p4=page(4,label(3,l.store)+`<div class="store-grid">${[["portrait",l.portrait,""],["landscape",l.landscape,"land"],["poster",l.poster,"small"],["recipe",l.recipe,"small"]].map(([key,title,cls])=>`<div class="store-card ${cls}">${key==="recipe"?`<a href="${recipeName}">${image(key,title)}</a>`:image(key,title)}<div class="asset-name">${e(title)}</div></div>`).join("")}</div><div class="material-list"><div class="material-item">Instagram × 3 + Stories × 1</div><div class="material-item">${e(l.digital)}</div><div class="material-item"><a href="${recipeName}">${e(l.recipe)}</a></div>${video?`<div class="material-item"><a href="${video}">${e(l.video)} ▶</a></div>`:""}</div><div class="note">${e(l.localize)}</div>`);
  const ing=sourceIngredients(info);
  const p5=page(5,label(4,l.ingredients)+`<table class="ing-table"><thead><tr><th>${e(l.image)}</th><th>${e(l.ingredient)}</th><th>${e(l.amount)}</th></tr></thead><tbody>${ing.map((row,i)=>`<tr><td>${image(`ingredient${i}`,c.ingredientNames[i]??"","ingredient-photo")}</td><td><b>${e(c.ingredientNames[i]??"")}</b><span class="ing-name-en">${e(row.nameEn)}</span></td><td>${e(c.ingredientAmounts[i]??"")}</td></tr>`).join("")}</tbody></table>${c.quantityNote?`<div class="note">${e(c.quantityNote)}</div>`:""}`);
  const card=(title:string,preview:string,desc:string,cls="")=>`<div class="contents-card"><h2>${e(title)}</h2><div class="contents-rule"></div><div class="contents-preview ${cls}">${preview}</div><div class="contents-desc">${e(desc)}</div></div>`;
  const p6=page(6,`<header class="contents-header"><h1 class="contents-title">${e(c.name)}<br>${e(l.folder)}</h1>${image("product",c.name,"contents-cutout")}</header><div class="contents-grid">`+
    card(l.guide,cover?`<img src="${e(cover)}" alt="${e(l.guide)}">`:image("ig1",l.guide),l.guide,"contain")+
    card("Instagram",`<div class="contents-ig">${[1,2,3].map(i=>image(`ig${i}`,`Instagram ${i}`)).join("")}</div>`,l.igDesc)+
    card(l.digital,`<div class="contents-menu">${image("portrait",l.portrait)}${image("landscape",l.landscape)}</div>`,l.digitalDesc,"digital-preview")+
    card(l.poster,image("poster",l.poster),l.posterDesc,"contain")+
    card(l.recipe,`<a href="${recipeName}">${image("recipe",l.recipe)}</a>`,l.recipeDesc,"contain")+
    (video?card(l.video,`<a class="video-link" href="${video}">${image("ig1",c.name)}<div class="video-play" aria-hidden="true"></div></a>`,l.videoDesc,"contents-video"):"")+"</div>");
  const steps=[[l.review,l.reviewDesc],[l.prototype,l.prototypeDesc],[l.share,l.shareDesc],[l.check,l.checkDesc],[l.period,l.periodDesc],[l.sell,l.sellDesc]];
  const p7=page(7,label(5,l.rollout)+`<div class="island"><b>${e(l.beforeSales)}</b><div class="flow">${steps.map(([title,text],i)=>`<div class="step"><div class="step-no">${i+1}</div><h3>${e(title)}</h3><p>${e(text)}</p></div>`).join("")}</div></div><div style="margin-top:5mm">${label(6,l.cooperation)}</div><div class="coop"><div class="notice"><b>${e(l.request)}</b><br><br>${e(l.requestDesc)}<br><br><b>${e(l.reportPeriod)}</b><br><br>${e(l.localize)}<br><br>${e(l.contact)}</div><div class="closing-panel"><div class="big">${e(c.name)}<br>${e(l.closing)}</div><p>${e(c.lead)}</p></div></div>`);
  const color=(s:string,fallback:string)=>/^#[0-9a-f]{6}$/i.test(s)?s:fallback;
  const palette=`:root{--deep:${color(draft.palette.deep,"#164e38")};--mid:${color(draft.palette.deep,"#164e38")};--accent:${color(draft.palette.accent,"#dc6516")};--paper:${color(draft.palette.paper,"#f7f7f0")};--line:#deded5;--ink:#302e28;--muted:#727168}`;
  return `<!doctype html><html lang="${lang=== "zh"?"zh-CN":lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(c.name)} | Age.3</title><style>${fontCss}${DECK_CSS}${palette}</style></head><body>${p1+p2+p3+p4+p5+p6+p7}</body></html>`;
}
