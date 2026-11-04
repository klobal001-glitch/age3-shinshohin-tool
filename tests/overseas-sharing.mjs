import test from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const load=createRequire(import.meta.url),assert=load('node:assert/strict'),fs=load('node:fs'),ts=load('typescript');
load.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {PART_SIZE,validateManifest,partPath}=load('../src/lib/overseas/sharedTypes.ts');
const {privateLibrary,prepareShared,completeShared,listShared,downloadShared}=load('../src/lib/overseas/serverLibrary.ts');
const meta={id:'12345678-1234-4234-8234-123456789abc',productId:'test',productName:'試験用商品',runLabel:'2026年11月',createdAt:'2026-11-04T01:00:00.000Z',languages:['ja','en','th','vi','zh'],fileName:'試験用商品.zip',byteSize:PART_SIZE+9};
const bytes=[new Uint8Array(PART_SIZE).fill(17),new Uint8Array(9).fill(23)];
const manifest={version:1,meta,parts:bytes.map(b=>({size:b.length,sha256:createHash('sha256').update(b).digest('hex')}))};
function fakeStorage(){
  const objects=new Map();
  const store={
    download:async path=>objects.has(path)?{data:objects.get(path),error:null}:{data:null,error:{status:404,statusCode:'404'}},
    upload:async(path,blob)=>{if(objects.has(path))return {error:{status:409}};objects.set(path,blob);return {error:null};},
    list:async(prefix,options={})=>({data:[...objects.entries()].filter(([p])=>p.startsWith(prefix+'/')&&!p.slice(prefix.length+1).includes('/')).map(([p,b])=>({name:p.slice(prefix.length+1),metadata:{size:b.size}})).sort((a,b)=>a.name.localeCompare(b.name)).slice(options.offset??0,(options.offset??0)+(options.limit??100)),error:null}),
    createSignedUploadUrl:async path=>({data:{signedUrl:`https://storage.example/upload/${path}`},error:null}),
    createSignedUrl:async path=>({data:{signedUrl:`https://storage.example/read/${path}`},error:null}),
  };return {store,objects};
}
test('shared manifests reject traversal, changed byte counts and malformed hashes',()=>{
  assert.equal(validateManifest(manifest).meta.shared,true);
  assert.throws(()=>validateManifest({...manifest,meta:{...meta,id:'../secret'}}));
  assert.throws(()=>validateManifest({...manifest,meta:{...meta,byteSize:15}}));
  assert.throws(()=>validateManifest({...manifest,parts:[{size:meta.byteSize,sha256:'bad'}]}));
});
test('public buckets cannot expose team guide files',async()=>{
  let used=false;
  const client={storage:{getBucket:async()=>({data:{public:true},error:null}),from:()=>{used=true;}}};
  await assert.rejects(()=>privateLibrary(client,'guides'));assert.equal(used,false);
});
test('incomplete uploads stay out of the shared list, resume only missing parts, and become immutable history',async()=>{
  const {store,objects}=fakeStorage();
  const first=await prepareShared(store,manifest);assert.equal(first.uploads.length,2);
  assert.deepEqual(await listShared(store),[]);
  objects.set(partPath(meta.id,0),new Blob([bytes[0]]));
  await assert.rejects(()=>completeShared(store,meta.id));
  const resumed=await prepareShared(store,manifest);assert.deepEqual(resumed.uploads.map(t=>t.index),[1]);
  objects.set(partPath(meta.id,1),new Blob([bytes[1]]));
  const saved=await completeShared(store,meta.id);assert.equal(saved.shared,true);
  assert.deepEqual(await listShared(store),[saved]);
  assert.equal((await prepareShared(store,manifest)).complete,true);
  await assert.rejects(()=>prepareShared(store,{...manifest,meta:{...meta,productName:'上書きしない'}}));
  const reopened=await downloadShared(store,meta.id);
  assert.equal(reopened.parts.length,2);assert.deepEqual(reopened.parts.map(p=>p.sha256),manifest.parts.map(p=>p.sha256));
  assert.equal((await completeShared(store,meta.id)).id,meta.id);
});
test('server refuses missing settings/origin/payload problems without connecting to storage',async()=>{
  const route=load('../src/app/api/overseas/library/route.ts');
  const keys=['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','OVERSEAS_LIBRARY_BUCKET'];
  const prior=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('must not connect');};
  const request=(headers={},body='{"action":"list"}')=>new Request('https://app.example/api/overseas/library',{method:'POST',headers:{origin:'https://app.example','content-type':'application/json',...headers},body});
  try{
    keys.forEach(k=>delete process.env[k]);assert.equal((await (await route.GET()).json()).ready,false);assert.equal((await route.POST(request())).status,503);
    process.env.NEXT_PUBLIC_SUPABASE_URL='https://storage.example';process.env.SUPABASE_SERVICE_ROLE_KEY='unit-test-key';process.env.OVERSEAS_LIBRARY_BUCKET='guides';
    assert.equal((await (await route.GET()).json()).ready,true);
    assert.equal((await route.POST(request({origin:'https://evil.example'}))).status,403);
    assert.equal((await route.POST(request({},'x'.repeat(65537)))).status,413);
    assert.equal((await route.POST(request({},'{"action":"download","id":"../x"}'))).status,400);
    assert.equal(calls,0);
  }finally{globalThis.fetch=originalFetch;keys.forEach(k=>{if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k];});}
});

test('a second device reconstructs identical bytes and rejects corrupted shared parts',async()=>{
  const {teamArchiveFile}=load('../src/lib/overseas/teamLibrary.ts');
  const before=globalThis.fetch;let corrupt=false;
  globalThis.fetch=async(url,options)=>{
    if(url==='/api/overseas/library'){
      assert.equal(JSON.parse(options.body).action,'download');
      return Response.json({meta,parts:manifest.parts.map((p,i)=>({...p,url:`https://storage.example/${i}`}))});
    }
    const i=Number(String(url).split('/').pop()),data=bytes[i].slice();if(corrupt&&i===1)data[0]++;
    return new Response(data);
  };
  try{
    const result=await teamArchiveFile(meta.id);
    assert.deepEqual(new Uint8Array(await result.arrayBuffer()),new Uint8Array([...bytes[0],...bytes[1]]));
    corrupt=true;await assert.rejects(()=>teamArchiveFile(meta.id));
  }finally{globalThis.fetch=before;}
});
