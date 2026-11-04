"use client";

/* Local data URLs must remain original image elements for portable guide exports. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { useAppData } from "@/hooks/useAppData";
import type { ProductInfo } from "@/lib/types";
import OverseasLibraryView from "./OverseasLibraryView";
import { saveTeamArchive } from "@/lib/overseas/teamLibrary";
import RunTabs, { runView } from "./RunTabs";
import { runFieldsOf } from "@/lib/productRun";
import { btn, card, field, h2, muted } from "@/lib/ui";
import { assertTranslationQuantities, assetSources, copyProblems, createDeckDraft, generationSource, sourceProblems, parseTranslations, sourceIngredients, webRecipeUrl, sourceSignature, translationPrompt } from "@/lib/overseas/model";
import { DeckAssets, DeckAttachment, DeckDraft, DeckLanguage, LANGUAGES, LANGUAGE_NAMES } from "@/lib/overseas/types";
import { fetchImage, imageFile, readLocalFiles, recipePreview, saveLocalFiles } from "@/lib/overseas/assets";
import { documentHtml } from "@/lib/overseas/render";
import { fontCss, layoutProblems, makeBundle, renderFrame } from "@/lib/overseas/export";

type App=ReturnType<typeof useAppData>;

export default function OverseasDeckView({app,onOpenSwitcher,quick=false}:{app:App;onOpenSwitcher?:()=>void;quick?:boolean}) {
  const product=app.selectedProduct;
  if(!quick)return <OverseasLibraryView/>;
  if(app.loading)return <p>商品情報を読み込んでいます…</p>;
  if(!product)return <p>資料を作る商品を選んでください。</p>;
  const info=app.getInfo(product.id),view=runView(app,info);
  const effective={...info,...runFieldsOf(info,view.past)};
  const runKey=view.viewingLabel||"current";
  return <div className="space-y-5">
    {!quick&&<><div className="flex flex-wrap items-center justify-between gap-3"><h2 className={h2}>海外FC資料</h2><button className={btn()} onClick={onOpenSwitcher}>{product.name} · 商品を変える</button></div>
    <RunTabs app={app} info={info}/></>}
    {view.viewingPast&&!view.past?.detail?<p className="rounded-xl bg-amber-50 p-4 text-amber-800">この販売回の食材・説明文の記録がありません。今の回を参考表示しています。対象の情報か確認してから作成してください。</p>:null}
    <DeckEditor key={`${product.id}:${runKey}`} app={app} productId={product.id} info={effective} runKey={runKey} quick={quick}/>
  </div>;
}
function DeckEditor({app,productId,info,runKey,quick}:{app:App;productId:string;info:ProductInfo;runKey:string;quick:boolean}) {
  const [draft,setDraft]=useState<DeckDraft>(()=>info.overseasDecks?.[runKey]??createDeckDraft(info));
  const [lang,setLang]=useState<DeckLanguage>("ja"),[selected,setSelected]=useState<DeckLanguage[]>([...LANGUAGES]);
  const [assets,setAssets]=useState<DeckAssets>({}),[recipe,setRecipe]=useState<DeckAttachment|null>(null);
  const [filesReady,setFilesReady]=useState(false),[loadingAssets,setLoadingAssets]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[status,setStatus]=useState(""),[importText,setImportText]=useState("");
  const [preview,setPreview]=useState(""),[previewPage,setPreviewPage]=useState(1),[layout,setLayout]=useState<string[]>([]);
  const [aiReady,setAiReady]=useState<boolean|null>(null);
  useEffect(()=>{let live=true;fetch("/api/overseas/translate").then(r=>r.json()).then(v=>{if(live)setAiReady(v.ready===true);}).catch(()=>{if(live)setAiReady(false);});return()=>{live=false;};},[]);
  const [replaceTranslations,setReplaceTranslations]=useState(false);
  const [replaceAll,setReplaceAll]=useState(false),[adjust,setAdjust]=useState(false),[prepared,setPrepared]=useState(!quick);
  const autoLoaded=useRef(false),autoStarted=useRef(false);
  const attachmentKey=`${productId}:${runKey}`;
  const signature=sourceSignature(info),sources=assetSources(info),ingredients=sourceIngredients(info),copy=draft.copies[lang];
  const patch=(next:DeckDraft)=>{setDraft(next);if(JSON.stringify([draft.copies,draft.palette,draft.recipeLanguage])!==JSON.stringify([next.copies,next.palette,next.recipeLanguage]))setPreview("");const base=app.getInfo(productId);app.updateInfo(productId,{overseasDecks:{...base.overseasDecks,[runKey]:next}});};
  const changeCopy=(change:Partial<typeof copy>)=>patch({...draft,checkedLanguages:{...draft.checkedLanguages,[lang]:false},copies:{...draft.copies,[lang]:{...copy,...change}}});
  useEffect(()=>{let live=true;readLocalFiles(attachmentKey).then(files=>{if(live&&files){setAssets(files.assets);setRecipe(files.recipe);}}).catch(()=>{if(live)setError("この端末の素材を読み込めませんでした。画像を選び直してください。");}).finally(()=>{if(live)setFilesReady(true);});return()=>{live=false;};},[attachmentKey]);
  useEffect(()=>{
    if(!filesReady)return;
    void saveLocalFiles(attachmentKey,{assets,recipe}).catch(()=>setError("素材をこの端末へ保存できませんでした。画面を閉じる前に書き出してください。"));
  },[assets,recipe,filesReady,attachmentKey]);
  const labels:Record<string,string>={product:"背景なし商品画像",ig1:"Instagram 1（メイン）",ig2:"Instagram 2（食材説明）",ig3:"Instagram 3（寄り画像）",story:"ストーリーズ",portrait:"サイネージ・縦",landscape:"サイネージ・横",poster:"A1ポスター",recipe:"標準レシピの見本画像"};
  ingredients.forEach((row,i)=>{labels[`ingredient${i}`]=row.nameJa||row.nameEn;});
  const registeredRecipe=webRecipeUrl(info),recipeHref=recipe?"Age3_Standard_Recipe.pdf":registeredRecipe||undefined;
  const missingAssets=Object.keys(labels).filter(k=>!(k==="recipe"&&!recipe&&registeredRecipe)&&!assets[k]?.data);
  const stale=draft.sourceSignature!==signature;
  const loadAssets=async()=>{
    setError("");setLoadingAssets(true);const missing:string[]=[],loaded={...assets};
    try{for(let start=0;start<Object.keys(sources).length;start+=3){await Promise.all(Object.entries(sources).slice(start,start+3).map(async([key,url])=>{
      if(key==="recipe"&&!recipe&&registeredRecipe)return;
      if(assets[key]?.data&&assets[key].source===url)return;
      if(!url){if(!assets[key]?.data)missing.push(labels[key]);return;}
      try{const data=await fetchImage(url);loaded[key]={data,name:labels[key],source:url};}
      catch(e){missing.push(`${labels[key]}（${message(e)}）`);}
    }));}setAssets(loaded);setStatus(missing.length?`読み込めない素材：${missing.join("、")}。登録リンクを確認するか、画像の枠から元ファイルを選んでください。`:"画像の準備完了 ✓");return loaded;}
    finally{setLoadingAssets(false);}
  };
  const upload=async(key:string,file:File)=>{try{setError("");const data=await imageFile(file);setAssets(a=>({...a,[key]:{data,name:file.name,source:sources[key]??""}}));setPreview("");}catch(e){setError(message(e));}};
  const uploadRecipe=async(file:File)=>{
    setLoadingAssets(true);setError("");
    try{
      if(file.size>30*1024*1024)throw new Error("レシピは30MB以下のPDFを選んでください。");
      const bytes=await file.arrayBuffer();if(new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")throw new Error("レシピのPDFを選んでください。");
      const data=await recipePreview(bytes);setRecipe({bytes,name:file.name});setAssets(a=>({...a,recipe:{data,name:file.name,source:"recipe-upload"}}));setPreview("");
    }catch(e){setError(message(e));}finally{setLoadingAssets(false);}
  };
  const showPreview=async(previewLang:DeckLanguage=lang)=>{
    const missing=copyProblems(draft.copies[previewLang],ingredients.length);
    if(missing.length){setPreview('');setLayout([]);setError(`${LANGUAGE_NAMES[previewLang]}の原稿が未完成です：${missing.join('、')}。先に原稿を作成してください。`);setStatus('');return;}
    setBusy(true);setError("");let frame:HTMLIFrameElement|undefined;
    try{const html=documentHtml(info,draft,previewLang,assets,await fontCss(previewLang),undefined,recipeHref);frame=await renderFrame(html);const problems=layoutProblems(frame.contentDocument!);setLayout(problems);setPreview(html);setPreviewPage(1);setStatus(problems.length?"はみ出している原稿を短くしてください。":"文字切れなし ✓");}
    catch(e){setError(message(e));}finally{frame?.remove();setBusy(false);}
  };
  const download=async()=>{
    setBusy(true);setError("");
    try{
      if(!recipe&&!registeredRecipe)throw new Error("標準レシピを登録してください。");
      const blob=await makeBundle(info,draft,selected,assets,recipe,setStatus);
      setStatus("資料を保管し、チームの共有先に保存しています…");
      let archived=true,shared=false;
      const fileName=`Age3_${info.nameJa.replace(/[\\/:*?"<>|]/g,"_")}_資料セット.zip`;
      try{const saved=await saveTeamArchive({productId,productName:info.nameJa,runLabel:runKey==="current"?"現在の販売回":runKey,languages:[...selected],fileName,salesPeriod:`${info.releaseDate} 〜 ${info.endDate||"終了日未登録"}`},blob);shared=saved.shared===true;}
      catch{archived=false;setError("資料はできましたが、一覧への保存に失敗しました。ダウンロードしたZIPを保管してください。");}
      const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`Age3_${info.nameJa.replace(/[\\/:*?"<>|]/g,"_")}_資料セット.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);setStatus(!archived?"資料セットをダウンロードしました。一覧には保存されていません。":shared?"資料をチームの共有先と「海外FC資料」の一覧に保存しました。別の端末からも開けます。":"資料はこの端末に保存しました。チーム共有は未完了です。「海外FC資料」の一覧から共有保存を再試行してください。");
    }catch(e){setError(message(e));}finally{setBusy(false);}
  };
  const needed=[...sourceProblems(info),...(!recipe&&!registeredRecipe?["標準レシピ（Web版リンクまたは原本PDF）"]:[]),
    ...Object.keys(labels).filter(k=>k!=="recipe"&&!assets[k]?.data&&!sources[k]).map(k=>labels[k]),
    ...(!quick&&(stale||!draft.sourceConfirmed)?["商品情報・分量の確認"]:[])];
  const autoCreate=async()=>{
    setError("");
    if(needed.length){setError(`先にそろえてください：${needed.join("、")}`);return;}
    if(!replaceAll&&LANGUAGES.some(l=>draft.copies[l].features.length||draft.copies[l].lead)){setError("原稿を作り直す場合は「既存の原稿を作り直す」にチェックしてください。");return;}
    setBusy(true);let frame:HTMLIFrameElement|undefined;
    try{
      setStatus("登録済みの画像を読み込んでいます…");
      const loaded=await loadAssets();
      const missing=Object.keys(labels).filter(k=>!(k==="recipe"&&!recipe&&registeredRecipe)&&!loaded[k]?.data);
      if(missing.length)throw new Error(`読み込めない素材があります：${missing.map(k=>labels[k]).join("、")}。元の画像を選んでください。`);
      setStatus("商品情報から日本語の文章と4言語の翻訳を作成しています…");
      const response=await fetch("/api/overseas/translate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"generate",source:generationSource(info,draft.copies.ja.quantityNote)}),signal:AbortSignal.timeout(150000)});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"資料の文章を作成できませんでした。");
      const ja=parseTranslations(JSON.stringify({en:result.copies?.ja}),ingredients.length).en!;
      const translated=parseTranslations(JSON.stringify(result.copies),ingredients.length);
      if(LANGUAGES.some(l=>l!=="ja"&&!translated[l]))throw new Error("5言語の原稿が揃っていません。もう一度作成してください。");
      const next:DeckDraft={...draft,sourceConfirmed:true,sourceSignature:signature,copies:{...draft.copies,...translated,ja},checkedLanguages:{}};
      assertTranslationQuantities(next.copies,ingredients.map(i=>i.amount));
      // Preserve newly generated copy even if layout checking needs a later retry.
      patch(next);setReplaceAll(false);setLang("ja");
      const problems:string[]=[];let japanese="";
      for(const language of LANGUAGES){
        setStatus(`${LANGUAGE_NAMES[language]}の7ページを確認しています…`);
        const html=documentHtml(info,next,language,loaded,await fontCss(language),undefined,recipeHref);
        frame=await renderFrame(html);
        problems.push(...layoutProblems(frame.contentDocument!).map(p=>`${LANGUAGE_NAMES[language]}：${p}`));
        frame.remove();frame=undefined;if(language==="ja")japanese=html;
      }
      setLayout(problems);setPreview(japanese);setPreviewPage(1);
      setStatus(problems.length?"5言語の資料を作成しました。はみ出している文章を修正してから保存してください。":"5言語の資料ができました。内容を確認して保存してください。");
    }catch(e){setError(e instanceof Error&&["TimeoutError","AbortError"].includes(e.name)?"作成が時間内に終わりませんでした。時間を置いて再度お試しください。":message(e));setStatus("");}
    finally{frame?.remove();setBusy(false);}
  };
  const autoTranslate=async()=>{
    setError("");
    const problems=copyProblems(draft.copies.ja,ingredients.length);
    if(stale||!draft.sourceConfirmed){setError("先に商品情報・分量を確認してください。");return;}
    if(problems.length){setError(`日本語の原稿を整えてください：${problems.join("、")}`);return;}
    try{assertTranslationQuantities({ja:draft.copies.ja},ingredients.map(i=>i.amount));}catch(e){setError(message(e));return;}
    if(!replaceTranslations&&LANGUAGES.some(l=>l!=="ja"&&(draft.copies[l].lead||draft.copies[l].features.length))){setError("既存の各国語原稿を置き換えるには、下のチェックを入れてください。");return;}
    setBusy(true);setStatus("英語・タイ語・ベトナム語・中国語を翻訳しています…");
    try{
      const response=await fetch("/api/overseas/translate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({copy:draft.copies.ja,referenceEnglish:info.descriptionEn}),signal:AbortSignal.timeout(150000)});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"翻訳できませんでした。再度お試しください。");
      const copies=parseTranslations(JSON.stringify(result.copies),ingredients.length);
      assertTranslationQuantities(copies,ingredients.map(i=>i.amount));
      patch({...draft,copies:{...draft.copies,...copies},checkedLanguages:{ja:draft.checkedLanguages.ja}});
      setReplaceTranslations(false);setLang("en");setStatus("4言語の翻訳ができました。各言語の表現・食材の順番・使用量を確認し、必要に応じて修正してください。");
    }catch(e){setError(e instanceof Error&&["TimeoutError","AbortError"].includes(e.name)?"翻訳が時間内に終わりませんでした。原稿を短くして再度お試しください。":message(e));setStatus("");}finally{setBusy(false);}
  };
  const prepareQuick=useEffectEvent(async()=>{try{await loadAssets();}finally{setPrepared(true);}});
  const startQuick=useEffectEvent(()=>{
    if(autoStarted.current)return;
    const readyCopy=!stale&&LANGUAGES.every(l=>copyProblems(draft.copies[l],ingredients.length).length===0);
    if(readyCopy&&missingAssets.length===0){autoStarted.current=true;void showPreview();}
    else if(aiReady&&!needed.length&&!LANGUAGES.some(l=>draft.copies[l].lead||draft.copies[l].features.length)){
      autoStarted.current=true;void autoCreate();
    }
  });
  useEffect(()=>{
    if(!quick||!filesReady||autoLoaded.current)return;
    autoLoaded.current=true;
    void Promise.resolve().then(()=>prepareQuick());
  },[quick,filesReady]);
  useEffect(()=>{
    if(!quick||!prepared||!filesReady||loadingAssets||autoStarted.current)return;
    void Promise.resolve().then(()=>startQuick());
  },[quick,prepared,filesReady,loadingAssets,stale,draft,ingredients.length,missingAssets.length,aiReady,needed.length]);
  const incompleteLanguages=LANGUAGES.filter(l=>copyProblems(draft.copies[l],ingredients.length).length>0);
  const readyCopy=!stale&&incompleteLanguages.length===0;
  const copyPrompt=async()=>{try{await navigator.clipboard.writeText(translationPrompt(info,draft));setStatus("翻訳依頼文をコピーしました。翻訳結果のJSONを下の欄に貼り付けると取り込めます。");}catch{setImportText(translationPrompt(info,draft));setStatus("クリップボードが使えないため、下の欄に翻訳依頼文を表示しました。コピーしてご利用ください。");}};
  const input=(title:string,value:string,onChange:(v:string)=>void,large=false)=><label className="block space-y-1.5"><span className="text-sm font-medium">{title}</span>{large?<textarea className={`${field} min-h-28`} value={value} onChange={e=>onChange(e.target.value)}/>:<input className={field} value={value} onChange={e=>onChange(e.target.value)}/>}</label>;
  return <div className="space-y-5">
    {!quick&&<p className={muted}>商品情報から、5言語の7ページ資料・表紙PNG・配布用ZIPを作ります。原稿はチームで共有し、追加した素材ファイルはこの端末に保存します。</p>}
    <div aria-live="polite" className="space-y-2">{error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{status&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{status}</p>}{app.saveState==="saving"&&<p className={muted}>原稿を保存中…</p>}{app.saveState==="error"&&<button className={btn()} onClick={app.retrySave}>原稿の保存を再試行</button>}</div>
    {(!quick||adjust||!readyCopy)&&<fieldset disabled={busy||loadingAssets||!filesReady} className={`${card} min-w-0 space-y-4 border-emerald-200 p-5`}>
      <legend className="sr-only">資料の自動作成</legend>
      <h3 className="text-lg font-semibold">1. 準備</h3>
      <p className={muted}>登録済みの商品情報・画像を使います。</p>
      {needed.length?<div className="rounded-xl bg-amber-50 p-3"><p className="text-sm font-medium">不足しているもの</p><ul className="mt-2 flex flex-wrap gap-2">{needed.map((item,i)=><li className="rounded-lg bg-white px-3 py-1 text-sm" key={i}>{item}</li>)}</ul></div>:<p className="text-sm text-emerald-800">✓ 必要な情報は入力済み</p>}
      {registeredRecipe&&!recipe&&<a className="inline-flex min-h-11 items-center text-sm text-emerald-800 underline" href={registeredRecipe} target="_blank" rel="noreferrer">✓ 登録済みレシピ ↗</a>}
      {LANGUAGES.some(l=>draft.copies[l].features.length||draft.copies[l].lead)&&<label className="flex min-h-11 items-center gap-2 text-sm"><input className="h-5 w-5" type="checkbox" checked={replaceAll} onChange={e=>setReplaceAll(e.target.checked)}/>5言語の原稿を作り直す</label>}
      <details className="text-xs text-stone-500"><summary className="cursor-pointer py-2">AIに送る情報</summary><p className="mt-1">商品名・説明・食材名・分量・注記をOpenAIへ送信します。</p></details>
      {aiReady===false&&<p className="text-sm text-amber-800">AI作成は設定待ちです。</p>}
      <button className={btn("primary")} disabled={!!needed.length||aiReady!==true} onClick={autoCreate}>5言語の資料を作る</button>
    </fieldset>}
    {!quick&&<fieldset disabled={busy} className={`${card} min-w-0 space-y-4 p-5`}>
      <legend className="sr-only">商品情報の確認</legend><h3 className="text-lg font-semibold">1. 商品情報を確認</h3>
      <p className="text-sm">{info.nameJa} ／ 日本販売期間：{info.releaseDate||"未登録"} 〜 {info.endDate||"終了日未登録"}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{ingredients.map((i,k)=><p key={k} className="rounded-lg bg-stone-50 p-3 text-sm">{i.nameJa||i.nameEn}<b className="ml-3">{i.amount||"分量未登録"}</b></p>)}</div>
      {ingredients.length>8&&<p className="text-sm text-red-700">食材が8品を超えています。この7ページ用の書き出しには対応していません。</p>}
      {stale&&<p className="text-sm text-amber-800">商品情報が原稿作成時から変わっています。説明文・食材・分量・画像を再確認してください。</p>}
      <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" checked={draft.sourceConfirmed&&!stale} onChange={e=>patch({...draft,sourceSignature:signature,sourceConfirmed:e.target.checked,checkedLanguages:{}})}/><span>この販売回の内容・分量を確認しました。レシピ原本と異なる場合は、下の「分量に関する注記」に採用する基準を記入します。</span></label>
    </fieldset>}
    {(!quick||adjust||(!recipe&&!registeredRecipe)||missingAssets.length>0)&&<fieldset disabled={busy||loadingAssets||!filesReady} className={`${card} min-w-0 space-y-4 p-5`}>
      <legend className="sr-only">素材をそろえる</legend><h3 className="text-lg font-semibold">不足画像を追加</h3>
      <button className={btn()} onClick={loadAssets}>{loadingAssets?"素材を読み込み中…":"登録済みの画像を読み込む"}</button>
      <p className={muted}>画像の枠を押して追加・差し替え。</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Object.entries(labels).filter(([key])=>key!=="recipe"&&(!quick||adjust||!assets[key]?.data)).map(([key,title])=><label key={key} className="relative flex min-h-44 cursor-pointer flex-col rounded-xl border border-stone-200 bg-stone-50 p-3 focus-within:ring-2 focus-within:ring-amber-500"><span className="text-sm font-medium">{title}</span>{assets[key]?.data?<img src={assets[key].data} alt={title} className="mt-2 h-24 w-full object-contain"/>:<span className="flex flex-1 items-center justify-center py-6 text-center text-sm text-amber-800">＋ 画像を選ぶ</span>}<span className="mt-2 truncate text-xs text-stone-500">{assets[key]?.name??"未読込"}</span><input className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="file" accept="image/png,image/jpeg,image/webp" aria-label={`${title}を選ぶ`} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(key,f);e.target.value="";}}/></label>)}</div>
      <label className="block space-y-2"><span className="text-sm font-medium">標準レシピの原本PDF（任意・変更せず同梱）</span><input className={field} type="file" aria-label="標準レシピの原本PDF（任意・変更せず同梱）" accept="application/pdf" onChange={e=>{const f=e.target.files?.[0];if(f)void uploadRecipe(f);e.target.value="";}}/>{recipe&&<span className="block text-sm text-emerald-700">選択済み：{recipe.name}</span>}</label>
      {assets.recipe?.data&&<img className="h-48 max-w-full object-contain" src={assets.recipe.data} alt="同梱レシピの1ページ目"/>}
      {input("レシピ原本に記載されている言語",draft.recipeLanguage,v=>patch({...draft,recipeLanguage:v}))}
    </fieldset>}
    {(!quick||adjust)&&<fieldset disabled={busy} className={`${card} min-w-0 space-y-5 p-5`}>
      <legend className="sr-only">各国語の原稿</legend><h3 className="text-lg font-semibold">原稿を編集</h3>
      <div className="space-y-3 rounded-xl bg-stone-50 p-4">
        <p className="text-sm">日本語原稿を4言語へ翻訳します。</p>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input className="h-5 w-5" type="checkbox" checked={replaceTranslations} onChange={e=>setReplaceTranslations(e.target.checked)}/>既存の各国語原稿を今回の翻訳に置き換える</label>
        <button className={btn("primary")} disabled={aiReady!==true} onClick={autoTranslate}>日本語から4言語へAI翻訳する</button>
        <p className={muted}>{aiReady===null?"自動翻訳の利用状況を確認しています…":aiReady?"利用コードの入力は不要です。":"AI翻訳は設定待ちです。"}</p>
      </div>
      <div role="tablist" aria-label="資料の言語" className="flex flex-wrap gap-2">{LANGUAGES.map(l=><button role="tab" aria-selected={lang===l} key={l} className={btn(lang===l?"primary":"secondary")} onClick={()=>{setLang(l);setPreview("");setLayout([]);}}>{LANGUAGE_NAMES[l]}{draft.checkedLanguages[l]?" ✓":""}</button>)}</div>
      {input("商品名",copy.name,v=>changeCopy({name:v}))}{input("表紙のひとこと",copy.lead,v=>changeCopy({lead:v}))}{input("商品説明",copy.description,v=>changeCopy({description:v}),true)}
      <div className="space-y-3"><p className="text-sm font-medium">商品の特徴（1〜5件）</p>{copy.features.map((f,i)=><div className="space-y-2 rounded-xl bg-stone-50 p-3" key={i}>{input(`特徴${i+1}の見出し`,f.title,v=>changeCopy({features:copy.features.map((x,k)=>k===i?{...x,title:v}:x)}))}{input("説明",f.text,v=>changeCopy({features:copy.features.map((x,k)=>k===i?{...x,text:v}:x)}),true)}<button className={btn("quiet")} onClick={()=>changeCopy({features:copy.features.filter((_,k)=>k!==i)})}>この特徴を外す</button></div>)}{copy.features.length<5&&<button className={btn()} onClick={()=>changeCopy({features:[...copy.features,{title:"",text:""}]})}>＋ 特徴を追加</button>}</div>
      {input("Instagram紹介文（価格・日本限定の告知は入れない）",copy.caption,v=>changeCopy({caption:v}),true)}
      <div className="space-y-3">{ingredients.map((row,i)=><div className="grid gap-2 sm:grid-cols-2" key={i}>{input(`${row.nameJa}：${LANGUAGE_NAMES[lang]}の食材名`,copy.ingredientNames[i]??"",v=>changeCopy({ingredientNames:ingredients.map((_,k)=>k===i?v:copy.ingredientNames[k]??"")}))}{input(`使用量（登録値：${row.amount}）`,copy.ingredientAmounts[i]??"",v=>changeCopy({ingredientAmounts:ingredients.map((_,k)=>k===i?v:copy.ingredientAmounts[k]??"")}))}</div>)}</div>
      {input("分量に関する注記（レシピとの差異・採用する基準など）",copy.quantityNote,v=>changeCopy({quantityNote:v}),true)}
      <label className="flex min-h-11 items-start gap-3 text-sm"><input className="mt-1 h-5 w-5" type="checkbox" checked={draft.checkedLanguages[lang]===true} onChange={e=>patch({...draft,checkedLanguages:{...draft.checkedLanguages,[lang]:e.target.checked}})}/><span>{LANGUAGE_NAMES[lang]}の表現と分量を確認しました。翻訳は最終的に各国の担当者にも確認してください。</span></label>
      <details className="rounded-xl border border-stone-200 p-4"><summary className="cursor-pointer text-sm font-medium">翻訳用文章をコピー・翻訳原稿をまとめて取り込む</summary><div className="mt-4 space-y-3"><p className={muted}>日本語の原稿を整えてから翻訳依頼文をコピーします。翻訳結果を貼り付けると、各言語の欄へ取り込めます。</p><button className={btn()} onClick={copyPrompt}>翻訳依頼文をコピー</button><textarea aria-label="翻訳原稿を貼り付け" className={`${field} min-h-40`} value={importText} onChange={e=>setImportText(e.target.value)} placeholder="翻訳結果のJSONをここに貼り付け"/><button className={btn()} onClick={()=>{try{const copies=parseTranslations(importText,ingredients.length);assertTranslationQuantities(copies,ingredients.map(i=>i.amount));patch({...draft,copies:{...draft.copies,...copies},checkedLanguages:{}});setStatus("翻訳原稿を取り込みました。各言語の表現と分量を確認してください。");setImportText("");setError("");}catch(e){setError(message(e));}}}>翻訳原稿を取り込む</button></div></details>
    </fieldset>}
    {quick&&!readyCopy&&!preview&&!adjust&&<button className={btn("quiet")} onClick={()=>setAdjust(true)}>原稿を編集する</button>}
    {(!quick||readyCopy||preview||adjust)&&<fieldset disabled={busy} className={`${card} min-w-0 space-y-4 p-5`}>
      <legend className="sr-only">見た目と書き出し</legend><h3 className="text-lg font-semibold">{quick?"2. 資料を確認":"資料を確認"}</h3>
      {(!quick||adjust)&&<div className="flex flex-wrap gap-5">{([["deep","見出しの色"],["accent","アクセント"],["paper","背景色"]] as const).map(([key,title])=><label className="flex min-h-11 items-center gap-2 text-sm" key={key}><input type="color" className="h-11 w-12" value={draft.palette[key]} onChange={e=>patch({...draft,palette:{...draft.palette,[key]:e.target.value}})}/>{title}</label>)}</div>}
      {(!quick||adjust)&&<p className={muted}>7ページの構成・縦横サイネージの配置は固定です。商品に合わせて色を選べます。</p>}
      {(!quick||!preview)&&<button className={btn()} onClick={()=>showPreview()}>{LANGUAGE_NAMES[lang]}の7ページを確認</button>}
      {layout.map((p,i)=><p key={i} className="text-sm text-red-700">{p}</p>)}
      {quick&&<><div className="flex flex-wrap gap-2">{LANGUAGES.map(l=><button key={l} className={btn(lang===l?"primary":"secondary")} onClick={()=>{setLang(l);void showPreview(l);}}>{LANGUAGE_NAMES[l]}{copyProblems(draft.copies[l],ingredients.length).length>0&&<span className="ml-2 text-xs">原稿未完成</span>}</button>)}</div><button className={btn("quiet")} onClick={()=>setAdjust(v=>!v)}>{adjust?"編集を閉じる":"編集する"}</button></>}
      {incompleteLanguages.length>0&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">原稿未完成：{incompleteLanguages.map(l=>LANGUAGE_NAMES[l]).join('・')}</p>}
      {stale&&<p className="text-sm text-amber-800">商品情報が更新されています。編集画面で原稿を確認してください。</p>}
      {preview&&<div className="space-y-3"><div className="flex flex-wrap gap-2">{Array.from({length:7},(_,i)=><button key={i} className={btn(previewPage===i+1?"primary":"secondary")} onClick={()=>setPreviewPage(i+1)}>{i+1}</button>)}</div><Preview html={preview} page={previewPage}/></div>}
      {(!quick||adjust)&&<div className="flex flex-wrap gap-4">{LANGUAGES.map(l=><label key={l} className="flex min-h-11 items-center gap-2 text-sm"><input className="h-5 w-5" type="checkbox" checked={selected.includes(l)} onChange={e=>setSelected(s=>e.target.checked?LANGUAGES.filter(x=>x===l||s.includes(x)):s.filter(x=>x!==l))}/>{LANGUAGE_NAMES[l]}</label>)}</div>}
      <div className="border-t border-stone-100 pt-4"><h3 className="text-lg font-semibold">3. 保存</h3><p className="mt-1 text-xs text-stone-500">5言語 · HTML / PDF / 表紙PNG</p></div>
      <details className="text-xs text-stone-500"><summary className="cursor-pointer py-2">保存内容</summary><p className="mt-1">標準レシピ・言語別ZIP・制作記録も同梱。PDF・PNGは300dpi。保存した資料は「海外FC資料」から開けます。</p></details>
      {missingAssets.length>0&&<p className="text-sm text-amber-800">未読込の画像：{missingAssets.map(k=>labels[k]).join("、")}</p>}
      {copyProblems(copy,ingredients.length).length>0&&<p className="text-sm text-amber-800">{LANGUAGE_NAMES[lang]}の未入力：{copyProblems(copy,ingredients.length).join("、")}</p>}
      <label className="flex min-h-11 items-start gap-3 text-sm"><input className="mt-1 h-5 w-5" type="checkbox" disabled={!selected.length||stale||selected.some(l=>copyProblems(draft.copies[l],ingredients.length).length>0)} checked={selected.length>0&&selected.every(l=>draft.checkedLanguages[l]===true)} onChange={e=>patch({...draft,sourceConfirmed:quick&&e.target.checked?true:draft.sourceConfirmed,checkedLanguages:{...draft.checkedLanguages,...Object.fromEntries(selected.map(l=>[l,e.target.checked]))}})}/><span>{quick?"内容・分量・画像を確認しました":"選んだ言語すべての内容・分量・画像を確認しました。"}</span></label>
      <button className={btn("primary")} disabled={!filesReady||loadingAssets||!selected.length||stale||selected.some(l=>copyProblems(draft.copies[l],ingredients.length).length>0||!draft.checkedLanguages[l])} onClick={download}>{quick?"資料を保存・ダウンロード":"資料セットを作る"}</button>
    </fieldset>}
    {busy&&<p role="status" className="sticky bottom-24 rounded-xl bg-stone-900 p-4 text-sm text-white md:bottom-4">{status||"資料を準備しています…"}　</p>}
  </div>;
}
function message(e:unknown){return e instanceof Error?e.message:"作成できませんでした。入力内容をご確認ください。";}
function Preview({html,page}:{html:string;page:number}) {
  const container=useRef<HTMLDivElement>(null),[width,setWidth]=useState(800);
  useEffect(()=>{const el=container.current;if(!el)return;const observer=new ResizeObserver(()=>setWidth(el.clientWidth));observer.observe(el);return()=>observer.disconnect();},[]);
  const preview=html.replace("</head>",`<style>html,body{padding:0!important;width:1123px!important}.page{display:none!important;width:297mm!important;height:210mm!important;min-height:0!important;overflow:hidden!important;margin:0!important}.page:nth-child(${page}){display:block!important}</style></head>`);
  return <div ref={container} className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-stone-200" style={{height:width*794/1123}}><iframe title={`資料プレビュー ${page}ページ`} sandbox="allow-same-origin" srcDoc={preview} className="block origin-top-left border-0" style={{width:1123,height:794,transform:`scale(${width/1123})`}}/></div>;
}
