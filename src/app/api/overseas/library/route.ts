import { completeShared, downloadShared, LibraryError, libraryConfigured, listShared, prepareShared, privateLibrary } from "../../../../lib/overseas/serverLibrary";
export const runtime="nodejs",dynamic="force-dynamic",maxDuration=180;
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(){return json({ready:libraryConfigured()});}
export async function POST(request:Request){
  if(!libraryConfigured())return json({error:"チーム共有の保存先はまだ設定されていません。端末の資料は残っています。管理者に初期設定を依頼してください。"},503);
  if(request.headers.get("origin")!==new URL(request.url).origin)return json({error:"アプリの画面から実行してください。"},403);
  if(!request.headers.get("content-type")?.startsWith("application/json"))return json({error:"送信形式を確認してください。"},415);
  try{
    const reader=request.body?.getReader();if(!reader)throw new LibraryError("送信内容がありません。");
    const chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw new LibraryError("送信内容が大きすぎます。",413);}chunks.push(value);}}finally{reader.releaseLock();}
    const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if(!["list","prepare","complete","download"].includes(body.action))throw new LibraryError("操作を確認してください。");
    if(["complete","download"].includes(body.action)&&!/^[-a-f0-9]{36}$/.test(body.id??""))throw new LibraryError("資料の保存番号を確認してください。");
    const store=await privateLibrary();
    if(body.action==="list")return json({items:await listShared(store)});
    if(body.action==="prepare")return json(await prepareShared(store,body.manifest));
    if(body.action==="complete")return json({meta:await completeShared(store,body.id)});
    return json(await downloadShared(store,body.id));
  }catch(e){
    if(e instanceof LibraryError)return json({error:e.message},e.status);
    if(e instanceof SyntaxError)return json({error:"送信内容を確認してください。"},400);
    return json({error:"共有先に接続できませんでした。端末の資料は残っています。再試行してください。"},502);
  }
}
