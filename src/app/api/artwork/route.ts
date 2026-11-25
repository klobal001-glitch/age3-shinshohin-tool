import {createHash,createSign} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {privateLibrary,libraryConfigured} from '../../../lib/overseas/serverLibrary';
import {ARTWORK_MAX_SIZE,artworkIdPattern,artworkPath,artworkSource,validateArtwork,ArtworkManifest} from '../../../lib/artworkTypes';
export const runtime='nodejs',dynamic='force-dynamic',maxDuration=180;
const json=(v:unknown,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}});
const hash=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
type Store=Awaited<ReturnType<typeof privateLibrary>>;
let registeredCache:{expires:number;sources:Set<string>}|undefined;
async function read(store:Store,id:string,pending=false):Promise<ArtworkManifest|null>{
  const {data,error}=await store.download(`artwork/${pending?'pending':'index'}/${id}.json`);
  if(error){if(Number(error.status)===404||Number(error.statusCode)===404)return null;throw new Error('保存先の画像情報を読み込めませんでした。');}
  return validateArtwork(JSON.parse(await data.text()));
}
async function registered(source:string) {
  if(registeredCache&&registeredCache.expires>Date.now()&&registeredCache.sources.has(source))return true;
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.from('product_info').select('data');if(error)throw new Error('シートの登録情報を確認できませんでした。');
  const sources=new Set<string>();
  const collect=(v:unknown):void=>{if(typeof v==='string'){const s=artworkSource(v);if(s)sources.add(s);}else if(Array.isArray(v))v.forEach(collect);else if(v&&typeof v==='object')Object.values(v).forEach(collect);};
  (data??[]).forEach(r=>collect(r.data));registeredCache={expires:Date.now()+60000,sources};return sources.has(source);
}
async function signed(store:Store,m:ArtworkManifest,full=false){
  const {data,error}=await store.createSignedUrl(artworkPath(m.id,'preview'),3600);
  if(error||!data)throw new Error('画像を開く準備ができませんでした。');
  const urls=full?await Promise.all(m.parts.map(async(_,i)=>{const r=await store.createSignedUrl(artworkPath(m.id,i),3600);if(r.error||!r.data)throw new Error('元画像を開けませんでした。');return r.data.signedUrl;})):undefined;
  return {manifest:m,previewUrl:data.signedUrl,urls};
}
/* ------------------------------------------------------------------ *
 * Googleドライブの画像を、アプリ本体が代わりに取ってくる（2026年11月）
 *
 * ブラウザはドライブから直接読めない（ドライブが外部サイトからの読み取りを
 * 止めるため）。アプリ本体はブラウザではないので、普通にダウンロードできる。
 * ここで受け取って、そのままブラウザへ流す。ブラウザから先は今までと同じ。
 *
 * 安全のため、次のものだけを通す。
 * - シートに登録済みのリンク（registered）
 * - Googleドライブのリンク（ほかの場所は受け付けない）
 * - 画像（PNG・JPEG・WebP）で、30MBまで
 * 共有が「制限付き」のファイルは、アプリ本体もログインしていないので取れない。
 * ------------------------------------------------------------------ */
const DRIVE_FETCH_HOSTS=/^(?:drive\.google\.com|drive\.usercontent\.google\.com|(?:[a-z0-9-]+\.)?googleusercontent\.com)$/;
function driveId(u:URL):string|null{
  const m=u.pathname.match(/^\/file\/d\/([^/]+)/);if(m)return m[1];
  const id=u.searchParams.get('id');return id&&/^[\w-]{10,200}$/.test(id)?id:null;
}
/* ------------------------------------------------------------------ *
 * アプリ専用のGoogleアカウント（サービスアカウント）で読む（2026年11月）
 *
 * ドライブの共有を「リンクを知っている全員」にしなくても、
 * **アプリ専用アカウントのメールアドレスにだけ閲覧権限を与えれば**、
 * アプリが画像を読んで保存できるようにするための道。
 *
 * 設定（Vercelの環境変数）。入れていなければ、この道は使わず今までどおり動く。
 *   GOOGLE_DRIVE_SA_JSON … サービスアカウントの鍵ファイル（JSON）の中身をそのまま
 *   （分けて入れるときは GOOGLE_DRIVE_SA_EMAIL と GOOGLE_DRIVE_SA_KEY）
 * ------------------------------------------------------------------ */
function serviceAccount():{email:string;key:string}|null{
  const raw=process.env.GOOGLE_DRIVE_SA_JSON?.trim();
  if(raw){
    try{
      const j=JSON.parse(raw) as {client_email?:string;private_key?:string};
      if(j.client_email&&j.private_key)return {email:j.client_email,key:j.private_key.replace(/\\n/g,'\n')};
    }catch{/* 形が違えば下の2つを見る */}
  }
  const email=process.env.GOOGLE_DRIVE_SA_EMAIL?.trim(),key=process.env.GOOGLE_DRIVE_SA_KEY?.trim();
  if(email&&key)return {email,key:key.replace(/\\n/g,'\n')};
  return null;
}
const base64url=(v:string|Buffer)=>Buffer.from(v).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
let driveToken:{value:string;expires:number}|undefined;
/** ドライブを読むための合い言葉を取る。1時間ぶん使い回す */
async function driveAccessToken(sa:{email:string;key:string}):Promise<string>{
  if(driveToken&&driveToken.expires>Date.now()+60000)return driveToken.value;
  const now=Math.floor(Date.now()/1000);
  const claim={iss:sa.email,scope:'https://www.googleapis.com/auth/drive.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600};
  const body=`${base64url(JSON.stringify({alg:'RS256',typ:'JWT'}))}.${base64url(JSON.stringify(claim))}`;
  const signature=base64url(createSign('RSA-SHA256').update(body).sign(sa.key));
  const response=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${body}.${signature}`}),
    signal:AbortSignal.timeout(20000),
  });
  const data=await response.json().catch(()=>null) as {access_token?:string;expires_in?:number}|null;
  if(!response.ok||!data?.access_token)throw new Error('アプリ用アカウントの設定を確認してください。');
  driveToken={value:data.access_token,expires:Date.now()+(data.expires_in??3600)*1000};
  return driveToken.value;
}
/** アプリ専用アカウントで1枚読む。権限が無ければ null（そのあと今までの道を試す） */
async function driveFileAsApp(id:string):Promise<Response|{error:string;status:number}|null>{
  const sa=serviceAccount();if(!sa)return null;
  const token=await driveAccessToken(sa);
  const response=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`,
    {headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(60000)});
  if(response.status===401||response.status===403||response.status===404){
    await response.body?.cancel();
    return {status:422,error:`このファイルがアプリ用アカウントに共有されていません。ドライブでこのファイル（またはその親フォルダ）を ${sa.email} に「閲覧者」で共有してください。`};
  }
  if(!response.ok){await response.body?.cancel();return {status:422,error:'画像を取り込めませんでした。時間を置いて再試行してください。'};}
  return response;
}

export async function GET(request:Request){
  if(request.headers.get('x-artwork')!=='1')return json({error:'アプリの画面から実行してください。'},403);
  try{
    const source=artworkSource(new URL(request.url).searchParams.get('source')??'');
    let u:URL;try{u=new URL(source);}catch{return json({error:'画像の共有リンクを確認してください。'},400);}
    if(!/^(?:www\.)?drive\.google\.com$/.test(u.hostname))return json({error:'Googleドライブのリンクだけ取り込めます。'},400);
    const id=driveId(u);if(!id)return json({error:'Googleドライブの「ファイル」のリンクを登録してください（フォルダのリンクは取り込めません）。'},400);
    if(!await registered(source))return json({error:'シートに登録済みの画像リンクを選んでください。'},400);

    /* まずアプリ専用アカウントで読む（共有が「制限付き」のままでも、
       そのアカウントに閲覧権限があれば読める）。設定していなければ飛ばす */
    const asApp=await driveFileAsApp(id);
    if(asApp instanceof Response){
      const mime=(asApp.headers.get('content-type')??'').split(';')[0].toLowerCase();
      if(!/^image\/(png|jpeg|webp)$/.test(mime)){await asApp.body?.cancel();return json({error:'この置き場所のファイルは画像（PNG・JPEG・WebP）ではありません。'},422);}
      const length=Number(asApp.headers.get('content-length'));
      if(Number.isFinite(length)&&length>ARTWORK_MAX_SIZE){await asApp.body?.cancel();return json({error:'元画像は30MB以下で選んでください。'},413);}
      return new Response(asApp.body,{headers:{'Content-Type':mime,'Cache-Control':'no-store',...(Number.isFinite(length)&&length>0?{'Content-Length':String(length)}:{})}});
    }
    /* 専用アカウントに権限が無いときは、公開リンクとして読めるか試す。
       どちらもだめなら、専用アカウント側の案内を返す（そちらが直し方として近いため） */
    const appError=asApp;

    let target=new URL(`https://drive.usercontent.google.com/download?export=download&id=${encodeURIComponent(id)}`);
    for(let step=0;step<6;step++){
      if(/^accounts\.google\.com$/.test(target.hostname))return json(appError?{error:appError.error}:{error:'このファイルは共有が「制限付き」です。共有を「リンクを知っている全員」にしてください。'},422);
      if(target.protocol!=='https:'||target.username||target.password||target.port||!DRIVE_FETCH_HOSTS.test(target.hostname))return json({error:`画像の取り込み先を確認できませんでした（${target.hostname}）。`},400);
      const response=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(60000)});
      if([301,302,303,307,308].includes(response.status)){
        await response.body?.cancel();const next=response.headers.get('location');if(!next)break;target=new URL(next,target);continue;
      }
      if(!response.ok){await response.body?.cancel();return json({error:response.status===404?'リンク先が見つかりません（404）。':'画像を取り込めませんでした。共有設定を確認してください。'},422);}
      const mime=(response.headers.get('content-type')??'').split(';')[0].toLowerCase();
      if(!/^image\/(png|jpeg|webp)$/.test(mime)){await response.body?.cancel();return json({error:'画像ではなく案内ページが返されました。共有を「リンクを知っている全員」にしてください。'},422);}
      const length=Number(response.headers.get('content-length'));
      if(Number.isFinite(length)&&length>ARTWORK_MAX_SIZE){await response.body?.cancel();return json({error:'元画像は30MB以下で選んでください。'},413);}
      return new Response(response.body,{headers:{'Content-Type':mime,'Cache-Control':'no-store',...(Number.isFinite(length)&&length>0?{'Content-Length':String(length)}:{})}});
    }
    return json({error:'画像の取り込み先を確認できませんでした。'},422);
  }catch(e){return json({error:e instanceof Error?e.message:'画像を取り込めませんでした。'},502);}
}

export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin&&(!request.headers.get('host')||request.headers.get('origin')!==`${new URL(request.url).protocol}//${request.headers.get('host')}`))return json({error:'アプリの画面から実行してください。'},403);
  if(!libraryConfigured())return json({error:'画像の共有保存先が設定されていません。'},503);
  try {
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'送信形式を確認してください。'},415);
    const reader=request.body?.getReader();if(!reader)return json({error:'送信内容がありません。'},400);
    const chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>131072){await reader.cancel();return json({error:'送信内容が大きすぎます。'},413);}chunks.push(r.value);}}finally{reader.releaseLock();}
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const store=await privateLibrary();
    if(body.action==='resolve'){
      const source=artworkSource(typeof body.source==='string'?body.source:'');
      let url:URL;try{url=new URL(source);}catch{return json({error:'画像の共有リンクを確認してください。'},400);}
      if(!['www.dropbox.com','dropbox.com'].includes(url.hostname)||!url.pathname.startsWith('/scl/fo/')||!await registered(source))return json({error:'シートに登録済みの画像リンクを選んでください。'},400);
      url.searchParams.delete('dl');url.searchParams.set('raw','1');
      for(let step=0;step<6;step++){
        if(url.protocol!=='https:'||url.username||url.password||url.port||!(/^(www\.)?dropbox\.com$/.test(url.hostname)||/^(?:[a-z0-9]+\.)?dl\.dropboxusercontent\.com$/.test(url.hostname)))return json({error:'画像の転送先を確認できませんでした。'},400);
        const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(30000)});
        await response.body?.cancel();
        if([301,302,303,307,308].includes(response.status)){
          const next=response.headers.get('location');if(!next)break;url=new URL(next,url);continue;
        }
        if(response.ok&&/^image\/(png|jpeg|webp)(;|$)/i.test(response.headers.get('content-type')??''))return json({url:url.href});
        return json({error:response.status===404?'共有リンクの画像が見つかりません（404）。':'フォルダ内の画像を取得できません。画像の共有設定を確認するか元ファイルを選んでください。'},422);
      }
      return json({error:'画像の転送先を確認できませんでした。'},422);
    }
    if(body.action==='report-load'){
      const listed=await store.list('artwork/reports',{limit:10,sortBy:{column:'created_at',order:'desc'}});
      if(listed.error)throw new Error('前回の確認結果を読み込めませんでした。');
      const latest=listed.data?.find(f=>f.name.endsWith('.json')&&f.name!=='latest.json');
      const {data,error}=await store.download(latest?`artwork/reports/${latest.name}`:'artwork/reports/latest.json');
      if(error){if(Number(error.status)===404||Number(error.statusCode)===404)return json({report:null});throw new Error('前回の確認結果を読み込めませんでした。');}
      return json({report:JSON.parse(await data.text())});
    }
    if(body.action==='report-save'){
      const r=body.report;
      if(!r||!Number.isFinite(Date.parse(r.createdAt))||!['total','done','saved','bytes'].every(k=>Number.isSafeInteger(r[k])&&r[k]>=0)||r.total>400||r.done>r.total||r.saved>r.done||!Array.isArray(r.errors)||r.errors.length!==r.done-r.saved||r.errors.some((e:Record<string,unknown>)=>!e||!['product','name','error'].every(k=>typeof e[k]==='string'&&(e[k] as string).length<=300)))return json({error:'確認結果の形式を確認してください。'},400);
      const report={createdAt:r.createdAt,total:r.total,done:r.done,saved:r.saved,bytes:r.bytes,errors:r.errors.map((e:{product:string;name:string;error:string})=>({product:e.product,name:e.name,error:e.error}))};
      const value=JSON.stringify(report),path=`artwork/reports/${crypto.randomUUID()}.json`;
      const history=await store.upload(path,value,{contentType:'application/json',upsert:false});if(history.error)throw new Error('確認結果を保存できませんでした。画像は保存されています。');
      const latest=await store.upload('artwork/reports/latest.json',value,{contentType:'application/json',cacheControl:'0',upsert:true});if(latest.error)throw new Error('最新の確認結果を記録できませんでした。');return json({report});
    }
    if(body.action==='lookup'){
      if(!Array.isArray(body.ids)||body.ids.length>400||body.ids.some((id:unknown)=>typeof id!=='string'||!artworkIdPattern.test(id)))return json({error:'保存番号を確認してください。'},400);
      const items=[];
      for(let i=0;i<body.ids.length;i+=8){const part=await Promise.all(body.ids.slice(i,i+8).map(async(id:string)=>{const m=await read(store,id);return m?await signed(store,m,body.full===true):null;}));items.push(...part);}
      return json({items});
    }
    if(body.action==='prepare'){
      const m=validateArtwork(body.manifest);
      if(hash(m.source)!==m.id||!await registered(m.source))return json({error:'先にシートへリンクを登録してください。'},409);
      const existing=await read(store,m.id);if(existing)return json({saved:await signed(store,existing)});
      const pending=await read(store,m.id,true);
      if(pending&&JSON.stringify({...pending,createdAt:''})!==JSON.stringify({...m,createdAt:''}))return json({error:'保存途中の画像と内容が違います。元ファイルのリンクを登録し直してください。'},409);
      if(!pending){const {error}=await store.upload(`artwork/pending/${m.id}.json`,JSON.stringify(m),{contentType:'application/json',upsert:false});if(error)throw new Error('保存準備に失敗しました。再試行してください。');}
      const uploads=[];
      for(const index of [...m.parts.map((_,i)=>i),'preview' as const]){
        const path=artworkPath(m.id,index),existingPart=await store.download(path);
        if(existingPart.data&&!existingPart.error){const expected=index==='preview'?m.preview:m.parts[index];if(existingPart.data.size!==expected.size||hash(new Uint8Array(await existingPart.data.arrayBuffer()))!==expected.sha256)return json({error:'保存途中の画像が一致しません。元ファイルを新しく差し替えてください。'},409);continue;}
        if(existingPart.error&&Number(existingPart.error.status)!==404&&Number(existingPart.error.statusCode)!==404)throw new Error('保存途中の画像を確認できませんでした。');
        const {data,error}=await store.createSignedUploadUrl(path,{upsert:false});if(error||!data)throw new Error('画像の送信準備ができませんでした。');uploads.push({index,url:data.signedUrl});
      }
      return json({uploads});
    }
    if(body.action==='complete'){
      if(!artworkIdPattern.test(body.id??''))return json({error:'保存番号を確認してください。'},400);
      const existing=await read(store,body.id);if(existing)return json({saved:await signed(store,existing)});
      const m=await read(store,body.id,true);if(!m)return json({error:'保存途中の画像がありません。'},404);
      for(const index of [...m.parts.map((_,i)=>i),'preview' as const]){
        const {data,error}=await store.download(artworkPath(m.id,index));const expected=index==='preview'?m.preview:m.parts[index];
        if(error||!data||data.size!==expected.size||hash(new Uint8Array(await data.arrayBuffer()))!==expected.sha256)return json({error:'画像の保存を確認できませんでした。再試行してください。'},409);
      }
      const {error}=await store.upload(`artwork/index/${m.id}.json`,JSON.stringify(m),{contentType:'application/json',upsert:false});
      if(error){const saved=await read(store,m.id);if(!saved)throw new Error('画像の保存完了を記録できませんでした。');return json({saved:await signed(store,saved)});}
      return json({saved:await signed(store,m)});
    }
    return json({error:'操作を確認してください。'},400);
  }catch(e){return json({error:e instanceof Error?e.message:'画像を共有保存できませんでした。'},502);}
}
