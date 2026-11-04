// Server only. Do not import this module into client components.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { partPath, type SharedManifest, validateManifest } from "./sharedTypes";

export class LibraryError extends Error {constructor(message:string,public status=400){super(message);}}
export function libraryConfigured(){return !!process.env.NEXT_PUBLIC_SUPABASE_URL&&!!process.env.SUPABASE_SERVICE_ROLE_KEY&&!!process.env.OVERSEAS_LIBRARY_BUCKET;}
export async function privateLibrary(client?:SupabaseClient,bucket=process.env.OVERSEAS_LIBRARY_BUCKET??"") {
  const admin=client??createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await admin.storage.getBucket(bucket);
  if(error||!data||data.public)throw new LibraryError("共有先の非公開フォルダの設定を管理者に確認してください。",503);
  return admin.storage.from(bucket);
}
type Store=Awaited<ReturnType<typeof privateLibrary>>;
async function read(store:Store,path:string):Promise<SharedManifest|null>{
  const {data,error}=await store.download(path);
  if(error){if(Number(error.status)===404||Number(error.statusCode)===404)return null;throw new LibraryError("共有資料を読み込めませんでした。時間を置いて再試行してください。",502);}
  try{return validateManifest(JSON.parse(await data.text()));}catch{throw new LibraryError("共有資料の保存情報を確認できませんでした。",502);}
}
async function write(store:Store,path:string,value:SharedManifest){
  const {error}=await store.upload(path,new Blob([JSON.stringify(value)],{type:"application/json"}),{contentType:"application/json",upsert:false});
  if(error)throw new LibraryError("共有資料の保存情報を登録できませんでした。再試行してください。",502);
}
export async function listShared(store:Store){
  const result=[];
  for(let offset=0;;offset+=100){
    const {data,error}=await store.list("index",{offset,limit:100,sortBy:{column:"name",order:"asc"}});
    if(error)throw new LibraryError("共有資料の一覧を読み込めませんでした。",502);
    const names=(data??[]).filter(f=>f.name.endsWith(".json"));
    for(let i=0;i<names.length;i+=5){const rows=await Promise.all(names.slice(i,i+5).map(f=>read(store,`index/${f.name}`)));result.push(...rows.filter((r):r is SharedManifest=>!!r).map(r=>r.meta));}
    if(!data||data.length<100)break;
    if(offset>=9900)throw new LibraryError("共有資料の件数が多いため、管理者に一覧設定を確認してください。",503);
  }
  return result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export async function prepareShared(store:Store,input:unknown){
  let manifest:SharedManifest;try{manifest=validateManifest(input);}catch{throw new LibraryError("資料の保存情報が正しくありません。");}
  const id=manifest.meta.id,complete=await read(store,`index/${id}.json`);
  if(complete){if(JSON.stringify(complete)!==JSON.stringify(manifest))throw new LibraryError("同じ保存番号の別資料があります。新しく保存し直してください。",409);return {complete:true,meta:complete.meta,uploads:[]};}
  const pending=await read(store,`pending/${id}.json`);
  if(pending&&JSON.stringify(pending)!==JSON.stringify(manifest))throw new LibraryError("保存途中の資料情報と一致しません。",409);
  if(!pending)await write(store,`pending/${id}.json`,manifest);
  const {data:existing,error}=await store.list(`bundles/${id}`,{limit:200});
  if(error)throw new LibraryError("共有先を確認できませんでした。",502);
  const uploads=[];
  for(let i=0;i<manifest.parts.length;i++){
    const path=partPath(id,i),found=existing?.find(f=>f.name===path.split("/").pop());
    if(found&&Number(found.metadata?.size)===manifest.parts[i].size)continue;
    if(found)throw new LibraryError("保存途中のファイルのサイズが一致しません。新しく保存し直してください。",409);
    const {data,error}=await store.createSignedUploadUrl(path,{upsert:false});
    if(error||!data)throw new LibraryError("共有先への送信準備ができませんでした。",502);
    uploads.push({index:i,url:data.signedUrl});
  }
  return {complete:false,uploads};
}
export async function completeShared(store:Store,id:string){
  const complete=await read(store,`index/${id}.json`);if(complete)return complete.meta;
  const manifest=await read(store,`pending/${id}.json`);if(!manifest)throw new LibraryError("保存途中の資料が見つかりません。",404);
  const {data,error}=await store.list(`bundles/${id}`,{limit:200});
  if(error||manifest.parts.some((p,i)=>Number(data?.find(f=>f.name===partPath(id,i).split("/").pop())?.metadata?.size)!==p.size))throw new LibraryError("まだ共有先へ保存し終わっていません。再試行してください。",409);
  await write(store,`index/${id}.json`,manifest);return manifest.meta;
}
export async function downloadShared(store:Store,id:string){
  const manifest=await read(store,`index/${id}.json`);if(!manifest)throw new LibraryError("共有資料が見つかりません。",404);
  const parts=[];
  for(let i=0;i<manifest.parts.length;i++){
    const {data,error}=await store.createSignedUrl(partPath(id,i),1800);
    if(error||!data)throw new LibraryError("共有資料を開く準備ができませんでした。",502);
    parts.push({...manifest.parts[i],url:data.signedUrl});
  }
  return {meta:manifest.meta,parts};
}
