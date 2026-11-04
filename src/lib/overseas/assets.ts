import { openOverseasDatabase } from "./library";
import { toDownloadUrl } from "../imageUrl";
import type { DeckAssets, DeckAttachment } from "./types";

export function readDataUrl(blob:Blob):Promise<string> {
  return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error("ファイルを読み込めませんでした。"));r.readAsDataURL(blob);});
}
export async function imageFile(file:Blob):Promise<string> {
  if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw new Error("PNG・JPEG・WebPの画像を選んでください。");
  if(file.size>30*1024*1024)throw new Error("画像は30MB以下で選んでください。");
  const data=await readDataUrl(file);
  const im=new Image();im.src=data;await im.decode();
  if(im.naturalWidth*im.naturalHeight>60_000_000)throw new Error("画像が大きすぎます。長辺6000px程度に縮めてください。");
  return data;
}
export async function fetchImage(raw:string):Promise<string> {
  if(!raw.trim())throw new Error("画像未登録");
  const u=new URL(toDownloadUrl(raw),location.origin);
  if(!["http:","https:"].includes(u.protocol))throw new Error("画像の場所を確認してください。");
  const response=await fetch(u,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error("画像を読み込めません。");
  return imageFile(await response.blob());
}
export async function recipePreview(bytes:ArrayBuffer):Promise<string> {
  const pdfjs=await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc="/overseas/pdf.worker.min.mjs";
  const task=pdfjs.getDocument({data:new Uint8Array(bytes.slice(0))});
  const pdf=await task.promise;
  try {
    const page=await pdf.getPage(1),viewport=page.getViewport({scale:1.8});
    const canvas=document.createElement("canvas");canvas.width=viewport.width;canvas.height=viewport.height;
    await page.render({canvas,viewport}).promise;
    return canvas.toDataURL("image/png");
  } finally { await task.destroy(); }
}
interface LocalFiles { assets:DeckAssets; recipe:DeckAttachment|null }
export async function readLocalFiles(key:string):Promise<LocalFiles|null> {
  const db=await openOverseasDatabase();try{return await new Promise((resolve,reject)=>{
    const request=db.transaction("files").objectStore("files").get(key);
    request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(request.error);
  });}finally{db.close();}
}
export async function saveLocalFiles(key:string,files:LocalFiles):Promise<void> {
  const db=await openOverseasDatabase();try{await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction("files","readwrite");tx.objectStore("files").put(files,key);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
}
