import type { ProductInfo } from "../types";
import { documentHtml } from "./render";
import { copyProblems, sameQuantityNumbers, sourceIngredients, webRecipeUrl, sourceSignature } from "./model";
import { DeckAssets, DeckAttachment, DeckDraft, DeckLanguage, LANGUAGE_NAMES } from "./types";

const FONT_CACHE = new Map<string,Promise<string>>();
async function dataUrl(path:string):Promise<string> {
  if(!FONT_CACHE.has(path))FONT_CACHE.set(path,fetch(path).then(async r=>{
    if(!r.ok)throw new Error("書体を読み込めませんでした。再度お試しください。");
    const blob=await r.blob();return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
  }).catch(e=>{FONT_CACHE.delete(path);throw e;}));
  return FONT_CACHE.get(path)!;
}
export async function fontCss(lang:DeckLanguage):Promise<string> {
  const latin=await dataUrl("/overseas-fonts/latin.woff2");
  let css=`@font-face{font-family:DeckLatin;src:url(${latin}) format('woff2');font-weight:400;font-display:block}`;
  if(["ja","zh","th"].includes(lang))css+=`@font-face{font-family:DeckLocal;src:url(${await dataUrl(`/overseas-fonts/${lang}.woff2`)}) format('woff2');font-weight:400;font-display:block}`;
  return css;
}
export async function renderFrame(html:string):Promise<HTMLIFrameElement> {
  const frame=document.createElement("iframe");
  frame.title="資料書き出し用";frame.setAttribute("sandbox","allow-same-origin");
  frame.style.cssText="position:fixed;left:-20000px;top:0;width:1123px;height:794px;border:0;visibility:visible;pointer-events:none";
  const loaded=new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error("プレビューの読み込みに時間がかかっています。再度お試しください。")),60000);frame.onload=()=>{clearTimeout(timeout);resolve();};});
  const fixed=`<style>html,body{width:1123px!important;padding:0!important;overflow:visible!important}.page{width:297mm!important;height:210mm!important;min-height:0!important;margin:0!important;overflow:hidden!important;box-shadow:none!important}</style>`;
  frame.srcdoc=html.replace("</head>",fixed+"</head>");document.body.appendChild(frame);
  try{await loaded;const doc=frame.contentDocument!;await doc.fonts.ready;await Promise.all([...doc.images].map(im=>im.decode()));return frame;}catch(e){frame.remove();throw e;}
}
export function layoutProblems(doc:Document):string[] {
  const errors:string[]=[];
  const pages=[...doc.querySelectorAll<HTMLElement>(".page")];
  if(pages.length!==7)return ["ページ数が7ページになっていません。"];
  pages.forEach((page,i)=>{
    const bounds=page.getBoundingClientRect(),footer=page.querySelector(".footer")!.getBoundingClientRect();
    const walker=doc.createTreeWalker(page,NodeFilter.SHOW_TEXT);let broken=false;
    while(walker.nextNode()){
      const node=walker.currentNode;if(!node.textContent?.trim())continue;
      const range=doc.createRange();range.selectNodeContents(node);
      if([...range.getClientRects()].some(r=>r.left<bounds.left-1||r.right>bounds.right+1||r.bottom>bounds.bottom+1||(!(node.parentElement?.closest(".footer"))&&r.bottom>footer.top-2)))broken=true;
    }
    if([...page.querySelectorAll<HTMLElement>(".contents-card")].some(c=>c.scrollHeight>c.clientHeight+1))broken=true;
    if(broken)errors.push(`${i+1}ページ目の文字が枠からはみ出しています。原稿を短くしてください。`);
  });
  return errors;
}
async function canvasPage(page:HTMLElement):Promise<HTMLCanvasElement> {
  const {default:html2canvas}=await import("html2canvas");
  return html2canvas(page,{scale:300/96,backgroundColor:"#ffffff",logging:false,windowWidth:1123,windowHeight:794,
    onclone(doc){
      // html2canvas does not support object-fit: represent images as fitted backgrounds.
      doc.querySelectorAll<HTMLImageElement>(".page img").forEach(im=>{
        const s=doc.defaultView!.getComputedStyle(im),box=doc.createElement("div");
        // Keep absolute positions, margins and flex sizing as well as the image dimensions.
        // In particular the folder-index cutout must stay at the upper right.
        box.className=im.className;
        for(const prop of Array.from(s))box.style.setProperty(prop,s.getPropertyValue(prop));
        box.style.display=s.display==="inline"?"inline-block":s.display;
        box.style.backgroundImage=`url('${im.src}')`;
        box.style.backgroundSize=s.objectFit==="cover"?"cover":"contain";
        box.style.backgroundRepeat="no-repeat";
        box.style.backgroundPosition=s.objectPosition;
        box.style.backgroundOrigin="content-box";
        im.replaceWith(box);
      });
    }});
}
function canvasBlob(canvas:HTMLCanvasElement):Promise<Blob> {return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("表紙画像を作れませんでした。")),"image/png"));}
export async function makeBundle(info:ProductInfo,draft:DeckDraft,languages:DeckLanguage[],assets:DeckAssets,recipe:DeckAttachment|null,progress:(s:string)=>void):Promise<Blob> {
  if(!draft.sourceConfirmed||draft.sourceSignature!==sourceSignature(info))throw new Error("商品の情報が変更されています。内容を再確認してください。");
  const ingredients=sourceIngredients(info);
  if(ingredients.length<1||ingredients.length>8)throw new Error("この7ページ資料は食材1〜8品に対応しています。食材の件数を確認してください。");
  const recipeUrl=recipe?"Age3_Standard_Recipe.pdf":webRecipeUrl(info);
  if(!recipeUrl)throw new Error("標準レシピを登録してください。");
  const required=["product","ig1","ig2","ig3","story","portrait","landscape","poster",...(recipe?["recipe"]:[]),...ingredients.map((_,i)=>`ingredient${i}`)];
  const missing=required.filter(k=>!assets[k]?.data);
  if(missing.length)throw new Error("未読込の画像があります。素材の欄で画像を選び直してください。");
  if(!languages.length)throw new Error("書き出す言語を選んでください。");
  for(const lang of languages){
    const problems=copyProblems(draft.copies[lang],ingredients.length);
    if(problems.length||!draft.checkedLanguages[lang])throw new Error(`${LANGUAGE_NAMES[lang]}の原稿を確認してください。${problems.join("、")}`);
    if(ingredients.some((i,k)=>!sameQuantityNumbers(i.amount,draft.copies[lang].ingredientAmounts[k])))throw new Error(`${LANGUAGE_NAMES[lang]}の分量の数字が食材一覧と一致しません。`);
  }
  const [{default:JSZip},{jsPDF}]=await Promise.all([import("jszip"),import("jspdf")]);
  const zip=new JSZip(),covers=new JSZip();
  const record=["# Age.3 海外FC 新商品資料 制作記録",`商品：${info.nameJa}`,`作成日時：${new Date().toISOString()}`,`日本販売期間：${info.releaseDate} 〜 ${info.endDate}`,`レシピ原本：${recipe?.name??recipeUrl}（${recipe?draft.recipeLanguage:"Web版・登録リンクを参照"}）`,"", "## 確定した食材使用量",...ingredients.map(i=>`- ${i.nameJa}：${i.amount}`),"", "## 言語別注記",...languages.map(l=>`- ${LANGUAGE_NAMES[l]}：${draft.copies[l].quantityNote||"注記なし"}`),"", "## 検証","各7ページ・文字切れ確認済み。各言語の原稿を担当者が確認済み。ネイティブ校閲の完了を自動判定するものではありません。","PDFは300dpiの画像形式（文字検索なし）。表紙PNGは同じ描画から生成。HTMLの画像と書体は埋め込み。",recipe?"レシピは原本PDFを同梱。":"レシピは登録済みWeb版へのリンクを収録。原本PDFの同梱はありません。"];
  for(const lang of languages){
    progress(`${LANGUAGE_NAMES[lang]}の書体・レイアウトを準備しています`);
    const fonts=await fontCss(lang);let html=documentHtml(info,draft,lang,assets,fonts,undefined,recipeUrl),frame=await renderFrame(html);
    try {
      let problems=layoutProblems(frame.contentDocument!);if(problems.length)throw new Error(`${LANGUAGE_NAMES[lang]}：${problems.join(" ")}`);
      const first=await canvasPage(frame.contentDocument!.querySelector<HTMLElement>(".page")!);
      const cover=await canvasBlob(first),coverData=first.toDataURL("image/png");first.width=first.height=1;
      frame.remove();html=documentHtml(info,draft,lang,assets,fonts,coverData,recipeUrl);frame=await renderFrame(html);
      problems=layoutProblems(frame.contentDocument!);if(problems.length)throw new Error(`${LANGUAGE_NAMES[lang]}：${problems.join(" ")}`);
      const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});
      const pages=[...frame.contentDocument!.querySelectorAll<HTMLElement>(".page")];
      for(let i=0;i<7;i++){
        progress(`${LANGUAGE_NAMES[lang]}：${i+1} / 7ページを作成しています`);
        const canvas=await canvasPage(pages[i]);if(i)pdf.addPage("a4","landscape");
        pdf.addImage(canvas.toDataURL("image/jpeg",.96),"JPEG",0,0,297,210);canvas.width=canvas.height=1;
      }
      // Match links to the actual rendered card bounds on each page.
      pages.forEach((page,index)=>{
        pdf.setPage(index+1);const bounds=page.getBoundingClientRect();
        page.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(a=>{
          const rect=a.getBoundingClientRect(),href=a.getAttribute("href")??"";
          if(!rect.width||!rect.height)return;
          pdf.link((rect.left-bounds.left)*297/bounds.width,(rect.top-bounds.top)*210/bounds.height,rect.width*297/bounds.width,rect.height*210/bounds.height,{url:href});
        });
      });
      const folder=zip.folder(lang)!;
      folder.file(`Age3_Product_${lang}.html`,html);folder.file(`Age3_Product_${lang}.pdf`,pdf.output("arraybuffer"));
      folder.file(`Age3_Cover_${lang}.png`,cover);if(recipe)folder.file("Age3_Standard_Recipe.pdf",recipe.bytes);else folder.file("Age3_Standard_Recipe_URL.txt",recipeUrl);
      covers.file(`Age3_Cover_${lang}.png`,cover);
      progress(`${LANGUAGE_NAMES[lang]}のセットをまとめています`);
      zip.file(`Age3_${lang}_HTML_PDF_PNG.zip`,await folder.generateAsync({type:"uint8array",compression:"DEFLATE"}));
    }finally{frame.remove();}
  }
  zip.file("Age3_Cover_PNG.zip",await covers.generateAsync({type:"uint8array",compression:"DEFLATE"}));
  zip.file("制作記録.md",record.join("\n\n"));
  progress("全ファイルをまとめています");
  return zip.generateAsync({type:"blob",compression:"DEFLATE"});
}
