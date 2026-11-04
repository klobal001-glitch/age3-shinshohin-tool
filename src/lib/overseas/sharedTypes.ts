import type { DeckArchive } from "./library";
import { LANGUAGES } from "./types";
export const PART_SIZE=4*1024*1024,MAX_ARCHIVE_SIZE=512*1024*1024;
export interface ArchivePart {size:number;sha256:string}
export interface SharedManifest {version:1;meta:DeckArchive;parts:ArchivePart[]}
export function validateManifest(value:unknown):SharedManifest {
  const m=value as SharedManifest,meta=m?.meta;
  if(m?.version!==1||!meta||!/^[-a-f0-9]{36}$/.test(meta.id)||!Array.isArray(m.parts)||!m.parts.length||m.parts.length>128||
    ![meta.productId,meta.productName,meta.runLabel,meta.fileName,meta.createdAt].every(s=>typeof s==="string"&&s.length>0&&s.length<=300)||
    !Number.isFinite(Date.parse(meta.createdAt))||!Number.isInteger(meta.byteSize)||meta.byteSize<1||meta.byteSize>MAX_ARCHIVE_SIZE||
    !Array.isArray(meta.languages)||!meta.languages.length||meta.languages.length>5||new Set(meta.languages).size!==meta.languages.length||meta.languages.some(l=>!LANGUAGES.includes(l))||
    m.parts.some((p,i)=>!p||!Number.isInteger(p.size)||p.size<1||p.size>PART_SIZE||(i<m.parts.length-1&&p.size!==PART_SIZE)||!/^([a-f0-9]{64})$/.test(p.sha256))||
    m.parts.reduce((n,p)=>n+p.size,0)!==meta.byteSize)throw new Error("資料の保存情報が正しくありません。");
  return {version:1,meta:{id:meta.id,productId:meta.productId,productName:meta.productName,runLabel:meta.runLabel,createdAt:meta.createdAt,languages:meta.languages,fileName:meta.fileName,byteSize:meta.byteSize,salesPeriod:typeof meta.salesPeriod==="string"?meta.salesPeriod.slice(0,200):undefined,shared:true},parts:m.parts.map(p=>({size:p.size,sha256:p.sha256}))};
}
export const partPath=(id:string,i:number)=>`bundles/${id}/${String(i).padStart(3,"0")}.part`;
