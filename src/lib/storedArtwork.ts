"use client";
import {useEffect,useState} from 'react';
import {artworkSource,ARTWORK_MAX_SIZE,ARTWORK_PART_SIZE,ArtworkManifest,SavedArtwork,ArtworkReport} from './artworkTypes';
import {toEmbeddedImageUrl} from './imageUrl';
export type ArtworkState={status:'link'|'saving'|'saved'|'error';saved?:SavedArtwork;error?:string};
const states=new Map<string,ArtworkState>(),tasks=new Map<string,Promise<SavedArtwork>>(),listeners=new Set<()=>void>(),checkedAt=new Map<string,number>();
const update=(source:string,s:ArtworkState)=>{states.set(source,s);if(s.saved)checkedAt.set(source,Date.now());listeners.forEach(fn=>fn());};
export async function artworkHash(value:string|ArrayBuffer):Promise<string>{return [...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function api(body:unknown){const r=await fetch('/api/artwork',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});const data=await r.json();if(!r.ok)throw new Error(data.error??'画像を共有保存できませんでした。');return data;}
export async function artworkReport(report?:ArtworkReport):Promise<ArtworkReport|null>{return (await api({action:report?'report-save':'report-load',report})).report??null;}
export async function resolvedArtworkUrl(raw:string):Promise<string>{
  const u=new URL(raw,location.origin);
  if(['dropbox.com','www.dropbox.com'].includes(u.hostname)&&u.pathname.startsWith('/scl/fo/'))return (await api({action:'resolve',source:artworkSource(raw)})).url;
  return toEmbeddedImageUrl(raw);
}
export async function savedArtwork(raw:string,full=false):Promise<SavedArtwork|null>{
  const source=artworkSource(raw);if(!source)return null;
  const cached=states.get(source)?.saved;
  if(cached&&!full&&Date.now()-(checkedAt.get(source)??0)<45*60*1000)return cached;
  const {items}=await api({action:'lookup',ids:[await artworkHash(source)],full});const saved=items[0]??null;
  if(saved)update(source,{status:'saved',saved});return saved;
}
export async function readSavedArtwork(saved:SavedArtwork):Promise<Blob>{
  if(!saved.urls)throw new Error('元画像の保存先を確認できませんでした。');
  const parts=[];
  for(let i=0;i<saved.urls.length;i++){
    const r=await fetch(saved.urls[i],{signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error('保存画像を読み込めませんでした。');
    const bytes=await r.arrayBuffer();if(bytes.byteLength!==saved.manifest.parts[i].size||await artworkHash(bytes)!==saved.manifest.parts[i].sha256)throw new Error('保存画像の内容が一致しません。');parts.push(bytes);
  }
  return new Blob(parts,{type:saved.manifest.mime});
}
let active=0;const waiting:Array<()=>void>=[];
async function slot(){if(active>=2)await new Promise<void>(r=>waiting.push(r));active++;return ()=>{active--;waiting.shift()?.();};}
export function archiveArtwork(raw:string,file?:File):Promise<SavedArtwork>{
  const source=artworkSource(raw);if(!source)return Promise.reject(new Error('画像のリンクではありません。'));
  const previous=tasks.get(source);if(previous)return previous;
  const task=(async()=>{
    const release=await slot();update(source,{status:'saving'});
    try{
      const existing=await savedArtwork(source);if(existing)return existing;
      if(source.startsWith('inside:')&&!file)throw new Error('元ファイルをもう一度選んでください。');
      const r=file?new Response(file,{headers:{'Content-Type':file.type}}):await fetch(await resolvedArtworkUrl(source),{credentials:'omit',signal:AbortSignal.timeout(60000)});
      if(!r.ok)throw new Error(r.status===404?'リンク先が見つかりません（404）。':'画像を取得できません。共有設定を確認してください。');
      if(Number(r.headers.get('Content-Length'))>ARTWORK_MAX_SIZE)throw new Error('元画像は30MB以下で選んでください。');
      const mime=(r.headers.get('Content-Type')??'').split(';')[0].toLowerCase();
      if(!/^image\/(png|jpeg|webp)$/.test(mime))throw new Error('画像ではなく案内ページが返されました。');
      const reader=r.body?.getReader();if(!reader)throw new Error('画像を取得できませんでした。');const chunks:Uint8Array<ArrayBuffer>[]=[];let length=0;
      try{for(;;){const v=await reader.read();if(v.done)break;length+=v.value.length;if(length>ARTWORK_MAX_SIZE){await reader.cancel();throw new Error('元画像は30MB以下で選んでください。');}chunks.push(new Uint8Array(v.value));}}finally{reader.releaseLock();}
      const blob=new Blob(chunks,{type:mime});
      const image=await createImageBitmap(blob);let preview:Blob;
      try{
        if(image.width*image.height>60_000_000)throw new Error('画像が大きすぎます。6000px程度で選んでください。');
        const canvas=document.createElement('canvas'),scale=Math.min(1,600/Math.max(image.width,image.height));canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
        canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);
        preview=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('プレビューを作れませんでした。')),'image/webp',0.78));
        const parts=[];for(let n=0;n<blob.size;n+=ARTWORK_PART_SIZE){const part=blob.slice(n,n+ARTWORK_PART_SIZE);parts.push({size:part.size,sha256:await artworkHash(await part.arrayBuffer())});}
        const manifest:ArtworkManifest={version:1,id:await artworkHash(source),source,createdAt:new Date().toISOString(),mime,size:blob.size,width:image.width,height:image.height,parts,preview:{size:preview.size,sha256:await artworkHash(await preview.arrayBuffer())}};
        let prepared;
        for(let attempt=0;;attempt++){try{prepared=await api({action:'prepare',manifest});break;}catch(e){if(attempt>=2||!(e instanceof Error)||!e.message.includes('先にシート'))throw e;await new Promise(r=>setTimeout(r,1500));}}
        if(prepared.saved){update(source,{status:'saved',saved:prepared.saved});return prepared.saved;}
        for(const upload of prepared.uploads){const bytes=upload.index==='preview'?preview:blob.slice(upload.index*ARTWORK_PART_SIZE,(upload.index+1)*ARTWORK_PART_SIZE);const result=await fetch(upload.url,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes,signal:AbortSignal.timeout(120000)});if(!result.ok&&result.status!==409)throw new Error('画像の送信に失敗しました。再試行してください。');}
        const {saved}=await api({action:'complete',id:manifest.id});update(source,{status:'saved',saved});return saved;
      }finally{image.close();}
    }catch(e){const message=e instanceof Error?e.message:'画像を共有保存できませんでした。';update(source,{status:'error',error:message});throw e;}finally{release();tasks.delete(source);}
  })();tasks.set(source,task);return task;
}
export function useStoredArtwork(raw:string,autoSave=false):ArtworkState{
  const source=artworkSource(raw),[,render]=useState(0);
  useEffect(()=>{const notify=()=>render(n=>n+1);listeners.add(notify);let live=true;
    const timer=setTimeout(()=>{
      if(!source)return;
      if(autoSave)void archiveArtwork(source).catch(()=>{});
      else void savedArtwork(source).catch(()=>{if(live)update(source,{status:'link'});});
    },autoSave?1800:0);
    return ()=>{live=false;clearTimeout(timer);listeners.delete(notify);};
  },[source,autoSave]);
  return states.get(source)??{status:'link'};
}
