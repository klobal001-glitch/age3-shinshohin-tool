import type { DeckLanguage } from "./types";

export interface DeckArchive {
  id:string;productId:string;productName:string;runLabel:string;createdAt:string;
  languages:DeckLanguage[];fileName:string;byteSize:number;salesPeriod?:string;shared?:boolean;
}
export function openOverseasDatabase():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open("age3-overseas-files",2);
    request.onupgradeneeded=()=>{
      for(const store of ["files","archiveMeta","archiveFiles"])
        if(!request.result.objectStoreNames.contains(store))request.result.createObjectStore(store);
    };
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
export async function saveArchive(input:Omit<DeckArchive,"id"|"createdAt"|"byteSize">,blob:Blob):Promise<DeckArchive> {
  const meta:DeckArchive={...input,id:crypto.randomUUID(),createdAt:new Date().toISOString(),byteSize:blob.size};
  const db=await openOverseasDatabase();
  try{await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(["archiveMeta","archiveFiles"],"readwrite");
    tx.objectStore("archiveMeta").put(meta,meta.id);tx.objectStore("archiveFiles").put(blob,meta.id);
    tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
  });return meta;}finally{db.close();}
}
export async function listArchives():Promise<DeckArchive[]> {
  const db=await openOverseasDatabase();try{return await new Promise((resolve,reject)=>{
    const request=db.transaction("archiveMeta").objectStore("archiveMeta").getAll();
    request.onsuccess=()=>resolve((request.result as DeckArchive[]).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
    request.onerror=()=>reject(request.error);
  });}finally{db.close();}
}
export async function archiveFile(id:string):Promise<Blob> {
  const db=await openOverseasDatabase();try{return await new Promise((resolve,reject)=>{
    const request=db.transaction("archiveFiles").objectStore("archiveFiles").get(id);
    request.onsuccess=()=>request.result?resolve(request.result):reject(new Error("保存したファイルが見つかりません。"));
    request.onerror=()=>reject(request.error);
  });}finally{db.close();}
}
export function archivePath(lang:DeckLanguage,kind:"html"|"pdf"|"png") {
  return kind==="png"?`${lang}/Age3_Cover_${lang}.png`:`${lang}/Age3_Product_${lang}.${kind}`;
}
export function downloadArchiveBlob(blob:Blob,name:string) {
  const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

export async function updateArchiveMeta(meta:DeckArchive):Promise<void> {
  const db=await openOverseasDatabase();try{await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction("archiveMeta","readwrite");tx.objectStore("archiveMeta").put(meta,meta.id);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
}
