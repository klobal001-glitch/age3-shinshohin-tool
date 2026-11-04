"use client";

import { useEffect, useState } from "react";
import type JSZip from "jszip";
import { archivePath, DeckArchive, downloadArchiveBlob } from "@/lib/overseas/library";
import { listTeamArchives, shareArchive, teamArchiveFile } from "@/lib/overseas/teamLibrary";
import { DeckLanguage, LANGUAGE_NAMES } from "@/lib/overseas/types";
import { btn, card, field, h2, muted } from "@/lib/ui";

export default function OverseasLibraryView() {
  const [items,setItems]=useState<DeckArchive[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [search,setSearch]=useState(""),[opened,setOpened]=useState<DeckArchive|null>(null);
  const [ready,setReady]=useState(false),[sharing,setSharing]=useState<string|null>(null);
  const refresh=async()=>{setLoading(true);try{const result=await listTeamArchives();setItems(result.items);setReady(result.ready);setError(result.error);}catch{setError("資料の一覧を読み込めませんでした。");}finally{setLoading(false);}};
  useEffect(()=>{let live=true;listTeamArchives().then(result=>{if(live){setItems(result.items);setReady(result.ready);setError(result.error);}}).catch(()=>{if(live)setError("資料の一覧を読み込めませんでした。");}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
  if(opened)return <ArchiveViewer item={opened} onBack={()=>setOpened(null)}/>;
  const filtered=items.filter(item=>`${item.productName} ${item.runLabel} ${item.salesPeriod??""}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="space-y-5">
    <h2 className={h2}>海外FC資料</h2>
    <p className="text-sm text-stone-600">作成した資料の保管場所です。G-4の「海外FC資料制作」で保存した資料が、作成日時順に並びます。</p>
    <p className={muted}>「共有済み」の資料はチームの別端末でも開けます。「共有待ち」はこの端末に保存した資料です。</p>
    {!loading&&!ready&&<p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">チーム共有の保存先は初期設定待ちです。端末内の資料は下に残っています。設定が完了したら共有保存できます。</p>}
    {ready&&<button className={btn()} disabled={loading||sharing!==null} onClick={refresh}>チームの資料を更新</button>}
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <input type="search" className={field} aria-label="保存済み資料を検索" placeholder="商品名・販売回で検索" value={search} onChange={e=>setSearch(e.target.value)}/>
    <p className={muted}>{filtered.length}件の資料</p>
    {loading?<p>保存した資料を読み込んでいます…</p>:!items.length?<div className={`${card} space-y-2 p-6`}><p className="font-medium">保存した資料はまだありません。</p><p className="text-sm text-stone-500">タスクページのG-4から資料を制作し、「5言語の資料をまとめて保存」を押すと、ここに残ります。</p></div>:!filtered.length?<p>一致する資料はありません。</p>:<div className="space-y-3">{filtered.map(item=><article key={item.id} className={`${card} space-y-3 p-5`}>
      <div><h3 className="text-lg font-semibold">{item.productName} <span className={`ml-2 rounded-full px-2 py-1 text-xs ${item.shared?"bg-emerald-50 text-emerald-800":"bg-amber-50 text-amber-800"}`}>{item.shared?"共有済み":"共有待ち"}</span></h3><p className={muted}>{item.runLabel}{item.salesPeriod?`（${item.salesPeriod}）`:""} · {new Date(item.createdAt).toLocaleString("ja-JP")} · {(item.byteSize/1024/1024).toFixed(1)} MB</p></div>
      <div className="flex flex-wrap gap-2">{item.languages.map(lang=><span key={lang} className="rounded-full bg-stone-100 px-3 py-1 text-xs">{LANGUAGE_NAMES[lang]}</span>)}</div>
      <div className="flex flex-wrap gap-2"><button className={btn("primary")} onClick={()=>setOpened(item)}>資料を開く</button><button className={btn()} onClick={async()=>{try{downloadArchiveBlob(await teamArchiveFile(item.id),item.fileName);}catch(e){setError(message(e));}}}>資料一式を保存</button>{!item.shared&&<button className={btn()} disabled={!ready||sharing!==null} onClick={async()=>{setSharing(item.id);setError("");try{await shareArchive(item);await refresh();}catch(e){setError(message(e));}finally{setSharing(null);}}}>{sharing===item.id?"共有先に保存中…":"チームへ共有保存"}</button>}</div>
    </article>)}</div>}
  </div>;
}
function ArchiveViewer({item,onBack}:{item:DeckArchive;onBack:()=>void}) {
  const [zip,setZip]=useState<JSZip|null>(null),[lang,setLang]=useState<DeckLanguage>(item.languages[0]);
  const [html,setHtml]=useState(""),[error,setError]=useState("");
  useEffect(()=>{let live=true;Promise.all([teamArchiveFile(item.id),import("jszip")]).then(async([blob,{default:Zip}])=>Zip.loadAsync(blob)).then(value=>{if(live)setZip(value);}).catch(e=>{if(live)setError(message(e));});return()=>{live=false;};},[item.id]);
  useEffect(()=>{
    if(!zip)return;let live=true,recipeUrl="";
    Promise.all([zip.file(archivePath(lang,"html"))?.async("string"),zip.file(`${lang}/Age3_Standard_Recipe.pdf`)?.async("blob")]).then(([source,recipe])=>{
      if(!live)return;if(!source)throw new Error("HTMLが見つかりません。");
      if(recipe)recipeUrl=URL.createObjectURL(new Blob([recipe],{type:"application/pdf"}));
      setHtml(recipeUrl?source.replaceAll('href="Age3_Standard_Recipe.pdf"',`href="${recipeUrl}" target="_blank" rel="noreferrer"`):source);
    }).catch(e=>{if(live)setError(message(e));});
    return()=>{live=false;if(recipeUrl)URL.revokeObjectURL(recipeUrl);};
  },[zip,lang]);
  const download=async(kind:"html"|"pdf"|"png")=>{
    try{const path=archivePath(lang,kind),file=zip?.file(path);if(!file)throw new Error("ファイルが見つかりません。");downloadArchiveBlob(await file.async("blob"),path.split("/").pop()!);}catch(e){setError(message(e));}
  };
  return <div className="space-y-4">
    <button className={btn()} onClick={onBack}>← 資料一覧に戻る</button>
    <h2 className={h2}>{item.productName}</h2><p className={muted}>{item.runLabel} · {new Date(item.createdAt).toLocaleString("ja-JP")}に保存した資料</p>
    <p className="text-sm text-stone-600">保存した時点の完成資料を表示しています。今の商品情報が変更されても、この資料は変わりません。</p>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="保存資料の言語">{item.languages.map(l=><button key={l} role="tab" aria-selected={l===lang} className={btn(l===lang?"primary":"secondary")} onClick={()=>{setLang(l);setHtml("");setError("");}}>{LANGUAGE_NAMES[l]}</button>)}</div>
    <div className="flex flex-wrap gap-2"><button disabled={!zip} className={btn()} onClick={()=>download("pdf")}>PDFを保存</button><button disabled={!zip} className={btn()} onClick={()=>download("html")}>HTMLを保存</button><button disabled={!zip} className={btn()} onClick={()=>download("png")}>表紙PNGを保存</button></div>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {html?<iframe title={`${item.productName}・${LANGUAGE_NAMES[lang]}の保存資料`} sandbox="allow-same-origin allow-popups" srcDoc={html} className="h-[75vh] min-h-96 w-full rounded-xl border border-stone-200 bg-white"/>:<p>保存した資料を開いています…</p>}
  </div>;
}
function message(e:unknown){return e instanceof Error?e.message:"資料を開けませんでした。";}
