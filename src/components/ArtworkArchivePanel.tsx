"use client";
import {useRef,useState} from 'react';
import {useAppData} from '@/hooks/useAppData';
import {artworkSource} from '@/lib/artworkTypes';
import {archiveArtwork,artworkReport} from '@/lib/storedArtwork';
import {isImageUrl,linkLabel} from '@/lib/imageUrl';
import {isInactive,saleStatus} from '@/lib/saleStatus';

export default function ArtworkArchivePanel({app}:{app:ReturnType<typeof useAppData>}){
  const [running,setRunning]=useState(false),[done,setDone]=useState(0),[total,setTotal]=useState(0),[saved,setSaved]=useState(0),[bytes,setBytes]=useState(0),[errors,setErrors]=useState<Array<{product:string;name:string;error:string}>>([]);
  const stop=useRef(false);
  const [notice,setNotice]=useState('');
  async function previous(){try{const r=await artworkReport();if(!r){setNotice('前回の確認結果はまだありません。');return;}setTotal(r.total);setDone(r.done);setSaved(r.saved);setBytes(r.bytes);setErrors(r.errors);setNotice(`${new Date(r.createdAt).toLocaleString('ja-JP')} の確認結果`);}catch(e){setNotice(e instanceof Error?e.message:'結果を読み込めませんでした。');}}
  async function run(){
    stop.current=false;setRunning(true);setNotice('');setDone(0);setSaved(0);setBytes(0);setErrors([]);
    const sources=new Map<string,{product:string;name:string}>();
    // Active products first, while keeping archived runs and original links untouched.
    const products=[...app.products].sort((a,b)=>Number(isInactive(saleStatus(app.getInfo(a.id))))-Number(isInactive(saleStatus(app.getInfo(b.id)))));
    for(const product of products){const info=app.getInfo(product.id),groups=[...info.visualDownloads,...info.visualArchives.flatMap(a=>a.groups),...info.runs.flatMap(r=>r.visuals)];
      for(const g of groups)for(const raw of g.links){const source=artworkSource(raw);if(source&&isImageUrl(source)&&!sources.has(source))sources.set(source,{product:product.name,name:linkLabel(source).name});}
    }
    const list=[...sources];setTotal(list.length);
    let cursor=0,finished=0,savedCount=0,byteCount=0;const failures:Array<{product:string;name:string;error:string}>=[];
    async function worker(){while(cursor<list.length&&!stop.current){const [source,label]=list[cursor++];try{const result=await archiveArtwork(source);savedCount++;byteCount+=result.manifest.size;setSaved(savedCount);setBytes(byteCount);}catch(e){failures.push({...label,error:e instanceof Error?e.message:'保存できませんでした。'});setErrors([...failures]);}setDone(++finished);}}
    try{await Promise.all([worker(),worker()]);await artworkReport({createdAt:new Date().toISOString(),total:list.length,done:finished,saved:savedCount,bytes:byteCount,errors:failures});setNotice('確認結果もチームの共有先に保存しました。');}catch(e){setNotice(e instanceof Error?e.message:'確認結果を保存できませんでした。');}finally{setRunning(false);}
  }
  return <details className="my-5 rounded-xl border border-stone-200 bg-white p-4">
    <summary className="min-h-11 cursor-pointer font-semibold text-stone-700">登録画像の共有保存・リンク確認</summary>
    <p className="my-3 text-sm text-stone-600">全商品の現在・過去のビジュアルを、販売中・準備中の商品から確認します。保存済み画像は再送信しません。元のリンクと差し替え前の保存画像も残します。食材写真はすでに共有保存されています。</p>
    <button type="button" disabled={running||app.loading} onClick={()=>void run()} className="min-h-11 rounded-full bg-amber-800 px-5 py-2 text-white disabled:opacity-40">既存画像をまとめて共有保存</button>
    <button type="button" disabled={running} onClick={()=>void previous()} className="ml-3 min-h-11 rounded border px-4">前回の確認結果を見る</button>
    {running&&<button type="button" onClick={()=>{stop.current=true;}} className="ml-3 min-h-11 rounded border px-4">現在の画像までで中断</button>}
    {total>0&&<p role="status" className="my-3 text-sm">{running?'確認中':'確認結果'}：{done} / {total}件　画像保存済み {saved}件（原画像 約{(bytes/1024/1024).toFixed(1)}MB）　要確認 {errors.length}件</p>}
    {notice&&<p className="my-2 text-sm text-stone-600">{notice}</p>}
    {errors.length>0&&<><p className="my-2 text-sm text-red-700">以下はリンクのみ登録されています。有効なリンクに差し替えるか、元ファイルを登録してください。</p><ul className="max-h-80 overflow-y-auto text-sm">{errors.map((row,i)=><li key={i} className="border-t py-2">{row.product} ／ {row.name}<br/><span className="text-red-700">{row.error}</span></li>)}</ul></>}
    {total>0&&!running&&done<total&&<p className="text-sm">途中までの画像は保存されています。同じボタンから続けられます。</p>}
  </details>;
}
