import { archiveFile, type DeckArchive, listArchives, saveArchive, updateArchiveMeta } from "./library";
import { MAX_ARCHIVE_SIZE, PART_SIZE, type SharedManifest } from "./sharedTypes";

async function call(action:string,extra:Record<string,unknown>={}) {
  const response=await fetch("/api/overseas/library",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(180000)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||"共有先に接続できませんでした。");return result;
}
async function sha256(blob:Blob) {return [...new Uint8Array(await crypto.subtle.digest("SHA-256",await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,"0")).join("");}
export async function shareArchive(meta:DeckArchive,blob?:Blob):Promise<DeckArchive> {
  const file=blob??await archiveFile(meta.id);
  if(file.size>MAX_ARCHIVE_SIZE)throw new Error("資料は512MB以下で保存してください。");
  const parts=[];
  for(let offset=0;offset<file.size;offset+=PART_SIZE){const part=file.slice(offset,offset+PART_SIZE);parts.push({size:part.size,sha256:await sha256(part)});}
  const manifest:SharedManifest={version:1,meta,parts};
  const prepared=await call("prepare",{manifest});
  if(!prepared.complete){
    const uploads=prepared.uploads as {index:number;url:string}[];
    for(let offset=0;offset<uploads.length;offset+=3)await Promise.all(uploads.slice(offset,offset+3).map(async ticket=>{
      const start=ticket.index*PART_SIZE,body=new FormData();body.append("cacheControl","3600");body.append("",file.slice(start,start+PART_SIZE));
      const response=await fetch(ticket.url,{method:"PUT",headers:{"x-upsert":"false"},body,signal:AbortSignal.timeout(120000)});
      if(!response.ok)throw new Error("共有先への送信が途中で止まりました。端末の資料は残っています。一覧から再試行してください。");
    }));
    await call("complete",{id:meta.id});
  }
  const shared={...meta,shared:true};await updateArchiveMeta(shared);return shared;
}
export async function saveTeamArchive(input:Omit<DeckArchive,"id"|"createdAt"|"byteSize">,blob:Blob):Promise<DeckArchive> {
  const local=await saveArchive({...input,shared:false},blob);
  try{return await shareArchive(local,blob);}catch{return local;}
}
export async function listTeamArchives():Promise<{items:DeckArchive[];ready:boolean;error:string}> {
  const local=await listArchives();let ready=false;
  try{
    const status=await fetch("/api/overseas/library",{signal:AbortSignal.timeout(15000)}).then(r=>r.json());ready=status.ready===true;
    if(!ready)return {items:local,ready:false,error:""};
    const {items}=await call("list");
    const all=new Map<string,DeckArchive>(local.map(row=>[row.id,row]));
    for(const row of items as DeckArchive[])all.set(row.id,{...row,shared:true});
    return {items:[...all.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),ready:true,error:""};
  }catch(e){return {items:local,ready,error:e instanceof Error?e.message:"共有資料を読み込めませんでした。"};}
}
export async function teamArchiveFile(id:string):Promise<Blob> {
  try{return await archiveFile(id);}catch{}
  const result=await call("download",{id}),parts:Blob[]=[];
  for(let offset=0;offset<result.parts.length;offset+=3){
    const batch=await Promise.all((result.parts as {url:string;size:number;sha256:string}[]).slice(offset,offset+3).map(async part=>{
      const response=await fetch(part.url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error("共有資料を取得できませんでした。開き直してください。");
      const blob=await response.blob();if(blob.size!==part.size||await sha256(blob)!==part.sha256)throw new Error("共有資料の内容を確認できませんでした。再度開き直してください。");return blob;
    }));parts.push(...batch);
  }
  const blob=new Blob(parts,{type:"application/zip"});if(blob.size!==result.meta.byteSize)throw new Error("共有資料のサイズが一致しません。");return blob;
}
