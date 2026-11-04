import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const load=createRequire(import.meta.url),fs=load('node:fs'),ts=load('typescript');
load.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {ARTWORK_PART_SIZE,validateArtwork,artworkSource,artworkPath}=load('../src/lib/artworkTypes.ts');
const hash=b=>createHash('sha256').update(b).digest('hex');
const source='https://www.dropbox.com/s/test/original.png?dl=0';
const folderSource='https://www.dropbox.com/scl/fo/folder/token?preview=test.jpg&rlkey=key';
const bytes=new Uint8Array(ARTWORK_PART_SIZE+5).fill(3),preview=new Uint8Array([1,2,3]);
const manifest={version:1,id:hash(source),source,createdAt:new Date().toISOString(),mime:'image/png',size:bytes.length,width:2000,height:2000,parts:[bytes.slice(0,ARTWORK_PART_SIZE),bytes.slice(ARTWORK_PART_SIZE)].map(b=>({size:b.length,sha256:hash(b)})),preview:{size:preview.length,sha256:hash(preview)}};
const objects=new Map();
const store={
 list:async prefix=>({data:[...objects.keys()].filter(p=>p.startsWith(prefix+'/')).reverse().map(p=>({name:p.slice(prefix.length+1)}))}),
 download:async p=>objects.has(p)?{data:objects.get(p),error:null}:{error:{status:404}},
 upload:async(p,value,options)=>{if(objects.has(p)&&!options.upsert)return {error:{status:409}};objects.set(p,new Blob([value]));return {error:null};},
 createSignedUploadUrl:async p=>({data:{signedUrl:`https://storage.example/${p}`}}),
 createSignedUrl:async p=>({data:{signedUrl:`https://storage.example/${p}`}}),
};
const mod=load.resolve('@supabase/supabase-js');load(mod);load.cache[mod].exports={createClient:()=>({storage:{getBucket:async()=>({data:{public:false}}),from:()=>store},from:()=>({select:async()=>({data:[{data:{visualDownloads:[{links:[source,folderSource]}]}}]})})})};
process.env.NEXT_PUBLIC_SUPABASE_URL='https://storage.example';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';process.env.OVERSEAS_LIBRARY_BUCKET='test';
const {POST}=load('../src/app/api/artwork/route.ts');
const request=(body,origin='https://app.example')=>POST(new Request('https://app.example/api/artwork',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
test('sources exclude insecure URLs and accept local file versions and bundled artwork',()=>{
 assert.equal(artworkSource('http://unsafe.example/image.jpg'),'');assert.equal(artworkSource('https://name:secret@example.com/image.jpg'),'');assert.equal(artworkSource('//unsafe/image.jpg'),'');assert.equal(artworkSource('/visuals/image.jpg'),'/visuals/image.jpg');assert.ok(artworkSource('inside:artwork/12345678-1234-4234-8234-123456789abc/image.jpg'));
});
test('manifest requires exact chunk boundaries, dimensions, hashes and maximum size',()=>{
 assert.equal(validateArtwork(manifest).size,bytes.length);
 assert.throws(()=>validateArtwork({...manifest,id:'../../secret'}));assert.throws(()=>validateArtwork({...manifest,size:bytes.length+1}));assert.throws(()=>validateArtwork({...manifest,width:100000}));assert.throws(()=>validateArtwork({...manifest,parts:[{size:bytes.length,sha256:'x'}]}));assert.throws(()=>artworkPath('../escape',0));assert.throws(()=>artworkPath(manifest.id,10));
});
test('cross-site writes and unregistered links cannot reserve storage',async()=>{
 assert.equal((await request({action:'prepare',manifest},'https://other.example')).status,403);
 const other='https://example.com/unregistered.png';assert.equal((await request({action:'prepare',manifest:{...manifest,source:other,id:hash(other)}})).status,409);
 assert.equal(objects.size,0);
});
test('partial or corrupt originals cannot become saved; completed originals are immutable and usable without Dropbox',async()=>{
 const prepared=await (await request({action:'prepare',manifest})).json();assert.equal(prepared.uploads.length,3);
 assert.equal((await (await request({action:'lookup',ids:[manifest.id]})).json()).items[0],null);
 assert.equal((await request({action:'complete',id:manifest.id})).status,409);
 objects.set(artworkPath(manifest.id,0),new Blob([bytes.slice(0,ARTWORK_PART_SIZE)]));
 objects.set(artworkPath(manifest.id,1),new Blob([new Uint8Array(5)]));objects.set(artworkPath(manifest.id,'preview'),new Blob([preview]));
 assert.equal((await request({action:'complete',id:manifest.id})).status,409);
 assert.equal((await request({action:'prepare',manifest})).status,409);
 objects.set(artworkPath(manifest.id,1),new Blob([bytes.slice(ARTWORK_PART_SIZE)]));
 const resumed=await request({action:'prepare',manifest:{...manifest,createdAt:new Date(Date.now()+1000).toISOString()}});assert.equal(resumed.status,200);assert.equal((await resumed.json()).uploads.length,0);
 const complete=await (await request({action:'complete',id:manifest.id})).json();assert.equal(complete.saved.manifest.size,bytes.length);
 const changed=await (await request({action:'prepare',manifest:{...manifest,parts:manifest.parts.map(p=>({...p,sha256:hash('changed')}))}})).json();assert.equal(changed.saved.manifest.parts[0].sha256,manifest.parts[0].sha256);
 const reopened=await (await request({action:'lookup',ids:[manifest.id],full:true})).json();assert.equal(reopened.items[0].urls.length,2);assert.equal(reopened.items[0].manifest.source,source);
});

test('migration reports are shared, bounded and retain historical results',async()=>{
 const report={createdAt:new Date().toISOString(),total:2,done:2,saved:1,bytes:100,errors:[{product:'商品',name:'image.jpg',error:'404'}]};
 assert.equal((await request({action:'report-save',report:{...report,saved:2}})).status,400);
 assert.equal((await request({action:'report-save',report})).status,200);
 const read=await (await request({action:'report-load'})).json();assert.deepEqual(read.report,report);
 const history=[...objects.keys()].filter(p=>p.startsWith('artwork/reports/')&&!p.endsWith('latest.json'));assert.equal(history.length,1);
 assert.equal((await request({action:'report-save',report:{...report,createdAt:new Date(Date.now()+1000).toISOString()}})).status,200);
 assert.equal([...objects.keys()].filter(p=>p.startsWith('artwork/reports/')&&!p.endsWith('latest.json')).length,2);
 objects.set('artwork/reports/latest.json',new Blob([JSON.stringify(report)]));
 const newest=await (await request({action:'report-load'})).json();assert.notEqual(newest.report.createdAt,report.createdAt);
});

test('folder selections resolve only registered Dropbox redirects; HTML and unsafe targets fail closed',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>++calls===1?new Response(null,{status:302,headers:{location:'https://uc123.dl.dropboxusercontent.com/cd/image'}}):new Response(new Uint8Array([1]),{headers:{'content-type':'image/jpeg'}});
  const result=await request({action:'resolve',source:folderSource});assert.equal(result.status,200);assert.equal((await result.json()).url,'https://uc123.dl.dropboxusercontent.com/cd/image');assert.equal(calls,2);
  calls=0;globalThis.fetch=async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}});};
  assert.equal((await request({action:'resolve',source:folderSource})).status,400);assert.equal(calls,1);
  globalThis.fetch=async()=>new Response('<html>No access</html>',{headers:{'content-type':'text/html'}});
  assert.equal((await request({action:'resolve',source:folderSource})).status,422);
 }finally{globalThis.fetch=original;}
});
