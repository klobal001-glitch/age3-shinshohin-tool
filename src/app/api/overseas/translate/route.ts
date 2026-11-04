import { TranslationError, translateCopy, translationInput, generateCopies, generationInput } from "../../../../lib/overseas/translate";

export const runtime="nodejs";
export const maxDuration=180;
export const dynamic="force-dynamic";
const config=()=>({key:process.env.OPENAI_API_KEY??"",model:process.env.OPENAI_TRANSLATION_MODEL??""});
const configured=()=>{const c=config();return !!c.key&&!!c.model;};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
// Public-by-request endpoint. Best-effort per-instance throttle; provider project limits must cap total usage.
let inFlight=0,windowStart=0,requests=0;
export async function GET(){return json({ready:configured()});}
export async function POST(request:Request){
  if(!configured())return json({error:"自動翻訳はまだ利用設定が完了していません。管理者に連絡してください。"},503);
  const origin=request.headers.get("origin");
  if(!origin||origin!==new URL(request.url).origin)return json({error:"アプリの画面から翻訳を実行してください。"},403);
  const c=config();
  if(!request.headers.get("content-type")?.startsWith("application/json"))return json({error:"原稿の送信形式を確認してください。"},415);
  if(Number(request.headers.get("content-length")??0)>32768)return json({error:"原稿が長すぎます。短くして再度お試しください。"},413);
  if(Date.now()-windowStart>60000){windowStart=Date.now();requests=0;}
  if(inFlight>=1||requests>=4)return json({error:"別の翻訳を処理中か、短時間の利用回数が多くなっています。少し待ってから再度お試しください。"},429);
  inFlight++;requests++;
  try{
    // Enforce byte limits while reading, even if Content-Length was omitted or forged.
    const reader=request.body?.getReader();if(!reader)throw new TranslationError("原稿がありません。");
    const chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();throw new TranslationError("原稿が長すぎます。短くして再度お試しください。",413);}chunks.push(value);}}finally{reader.releaseLock();}
    const raw=JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return json({copies:raw?.mode==="generate"?await generateCopies(generationInput(raw),c):await translateCopy(translationInput(raw),c)});
  }catch(e){
    if(e instanceof TranslationError)return json({error:e.message},e.status);
    if(e instanceof SyntaxError)return json({error:"原稿の形式を確認してください。"},400);
    return json({error:"AI翻訳を完了できませんでした。原稿は変更していません。時間を置いて再度お試しください。"},502);
  }finally{inFlight--;}
}
