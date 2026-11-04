import test from 'node:test';
import { createRequire } from 'node:module';
const load=createRequire(import.meta.url);
const assert=load('node:assert/strict');
const fs=load('node:fs');
const ts=load('typescript');
load.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {createDefaultProductInfo,normalizeProductInfo}=load('../src/lib/productInfo.ts');
const {createDeckDraft,copyProblems,parseTranslations,sourceSignature,translationPrompt}=load('../src/lib/overseas/model.ts');
const {documentHtml,safeLink}=load('../src/lib/overseas/render.ts');
const {LANGUAGES}=load('../src/lib/overseas/types.ts');
const info=createDefaultProductInfo();
Object.assign(info,{nameJa:'試験商品',nameEn:'Sample',descriptionJa:'元の説明です。',descriptionEn:'Source description.',releaseDate:'2026-11-01',endDate:'2026-11-30',howToVideoUrl:'https://youtu.be/sample',priceBase:123456789});
info.ingredients=[{nameJa:'パン',nameEn:'Bread',amount:'1/2個',specs:['仕入れメモは翻訳しない'],photoUrl:'',photoPath:'',photoUrl2:'',photoPath2:''}];
const copy={name:'Sample',lead:'Short lead.',description:'Source description.',features:[{title:'Feature',text:'Source description.'}],caption:'Caption.',ingredientNames:['Bread'],ingredientAmounts:['1/2 piece'],quantityNote:''};
test('source changes invalidate previous confirmation but internal price changes do not',()=>{
  assert.notEqual(sourceSignature(info),sourceSignature({...info,ingredients:[{...info.ingredients[0],amount:'1個'}]}));
  assert.equal(sourceSignature(info),sourceSignature({...info,priceBase:12}));
});
test('empty translations are not represented as complete',()=>{
  const d=createDeckDraft(info);assert.equal(d.copies.th.name,'');assert(copyProblems(d.copies.th,1).length>0);assert.equal(d.sourceConfirmed,false);
});
test('translation import validates ingredient order/count and required text',()=>{
  assert.deepEqual(parseTranslations(JSON.stringify({en:copy}),1).en,copy);
  assert.throws(()=>parseTranslations(JSON.stringify({en:{...copy,ingredientNames:[]}}),1));
  assert.throws(()=>parseTranslations(JSON.stringify({en:{...copy,features:[{title:5,text:'wrong'}]}}),1));
  assert.throws(()=>parseTranslations('{}',1));
});
test('translation prompt excludes prices, procurement details and unrelated fields',()=>{
  const prompt=translationPrompt(info,createDeckDraft(info));assert(!prompt.includes('123456789'));assert(!prompt.includes('仕入れメモは翻訳しない'));
});
test('every language retains seven pages, six rollout steps and original-relative recipe links',()=>{
  const d=createDeckDraft(info);for(const l of LANGUAGES){d.copies[l]=copy;const html=documentHtml(info,d,l,{},'');assert.equal((html.match(/<section class="page/g)||[]).length,7);assert.equal((html.match(/class="step-no"/g)||[]).length,6);assert(html.includes('href="Age3_Standard_Recipe.pdf"'));assert(!html.includes('123456789'));assert(!html.includes('Product Image'));assert(!html.includes('>Fonts<'));}
});
test('user prose is escaped and non-HTTPS links cannot become executable',()=>{
  const d=createDeckDraft(info);d.copies.en={...copy,name:'<script>alert(1)</script>'};
  const html=documentHtml({...info,howToVideoUrl:'javascript:alert(1)'},d,'en',{},'');
  assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('href="javascript:'));
  assert.equal(safeLink('data:text/html,hello'),'');assert.equal(safeLink('https://youtu.be/example'),'https://youtu.be/example');
});
test('saving a draft preserves the existing product schema and values',()=>{
  const d=createDeckDraft(info);const saved=normalizeProductInfo({...info,overseasDecks:{current:d}});
  assert.deepEqual(saved.overseasDecks.current,d);assert.equal(saved.priceBase,info.priceBase);assert.equal(saved.ingredients[0].amount,'1/2個');
});

const {sameQuantityNumbers,assertTranslationQuantities}=load('../src/lib/overseas/model.ts');
const {translationInput,translateCopy}=load('../src/lib/overseas/translate.ts');
test('quantity checks preserve full-width numbers and fractions, and reject changed amounts',()=>{
  assert(sameQuantityNumbers('１／２個','1/2 piece'));
  assert(!sameQuantityNumbers('1/2個','1 piece'));
  assert.throws(()=>assertTranslationQuantities({en:{...copy,ingredientAmounts:['5g']}},['1/2個']));
});
test('AI input strips unrelated fields and rejects oversized/incomplete copy',()=>{
  const input=translationInput({copy:{...copy,secret:'not sent'},referenceEnglish:'Reference',internalPrice:10000});
  assert.equal(JSON.stringify(input).includes('not sent'),false);
  assert.equal(JSON.stringify(input).includes('10000'),false);
  assert.throws(()=>translationInput({copy:{...copy,description:'x'.repeat(17000)},referenceEnglish:''}));
  assert.throws(()=>translationInput({copy:{...copy,features:[]},referenceEnglish:''}));
});
const translated=Object.fromEntries(['en','th','vi','zh'].map(l=>[l,copy]));
const aiReply=copies=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(copies)}]}]});
test('AI calls only the official Responses endpoint, bounded, with strict schema and no storage',async()=>{
  let request;
  const out=await translateCopy({copy,referenceEnglish:''},{key:'test-key',model:'configured-model'},async(url,options)=>{request={url,options};return aiReply(translated);});
  assert.deepEqual(out,translated);
  assert.equal(request.url,'https://api.openai.com/v1/responses');
  const body=JSON.parse(request.options.body);
  assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.max_output_tokens,12000);
  assert.equal(body.model,'configured-model');assert(request.options.signal);
});
test('AI rejects missing language, changed feature count, changed quantity, refusal and incomplete results',async()=>{
  for(const body of [
    aiReply({en:copy}),
    aiReply({...translated,th:{...copy,ingredientAmounts:['1 piece']}}),
    aiReply({...translated,vi:{...copy,features:[...copy.features,...copy.features]}}),
    Response.json({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]}),
    Response.json({status:'incomplete',output:[]}),
    new Response('',{status:429}),
  ])await assert.rejects(()=>translateCopy({copy,referenceEnglish:''},{key:'test-key',model:'configured-model'},async()=>body));
});

test('AI endpoint fails closed before any paid call when settings, origin or payload are invalid',async()=>{
  const route=load('../src/app/api/overseas/translate/route.ts');
  const names=['OPENAI_API_KEY','OPENAI_TRANSLATION_MODEL'];
  const previous=Object.fromEntries(names.map(n=>[n,process.env[n]]));
  const fetchBefore=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('unexpected outbound request');};
  const req=(headers={},body=JSON.stringify({copy,referenceEnglish:''}))=>new Request('https://app.example/api/overseas/translate',{method:'POST',headers:{origin:'https://app.example','content-type':'application/json',...headers},body});
  try{
    names.forEach(n=>delete process.env[n]);
    assert.equal((await route.GET()).status,200);
    assert.equal((await route.GET()).headers.get('cache-control'),'no-store');
    assert.equal((await (await route.GET()).json()).ready,false);
    assert.equal((await route.POST(req())).status,503);
    process.env.OPENAI_API_KEY='unit-test-key';process.env.OPENAI_TRANSLATION_MODEL='unit-test-model';
    assert.equal((await (await route.GET()).json()).ready,true);
    assert.equal((await route.POST(req({origin:'https://evil.example'}))).status,403);
    assert.equal((await route.POST(req({'content-type':'text/plain'}))).status,415);
    assert.equal((await route.POST(req({},'x'.repeat(32769)))).status,413);
    assert.equal((await route.POST(req({},JSON.stringify({copy:{},referenceEnglish:''})))).status,400);
    assert.equal(calls,0);
    globalThis.fetch=async()=>{calls++;return aiReply(translated);};
    assert.equal((await route.POST(req())).status,200);
    assert.equal(calls,1);

  }finally{
    globalThis.fetch=fetchBefore;
    names.forEach(n=>{if(previous[n]===undefined)delete process.env[n];else process.env[n]=previous[n];});
  }
});

const {generationSource,sourceProblems}=load('../src/lib/overseas/model.ts');
const {generationInput,generateCopies}=load('../src/lib/overseas/translate.ts');
const source=generationSource(info,'材料シートの分量を優先');
const japanese={...copy,name:source.name,ingredientNames:source.ingredientNames,ingredientAmounts:source.ingredientAmounts,quantityNote:source.quantityNote};
const generated={ja:japanese,...translated};
test('source intake requires facts only, not manually authored leads, features or captions',()=>{
  assert.deepEqual(sourceProblems(info),[]);
  assert(sourceProblems({...info,descriptionJa:'',ingredients:[{...info.ingredients[0],amount:''}]}).includes('日本語の商品説明'));
  assert.equal(source.name,info.nameJa);assert.equal('features' in source,false);
  assert.equal('priceBase' in source,false);assert.equal('specs' in source,false);
  assert.deepEqual(generationInput({source:{...source,privateNotes:'never sent'}}),source);
  assert.throws(()=>generationInput({source:{...source,ingredientAmounts:[]}}));
});
test('generation creates Japanese copy and all four translations in one bounded AI request',async()=>{
  let count=0;
  const copies=await generateCopies(source,{key:'test-key',model:'configured-model'},async(url,options)=>{
    count++;const body=JSON.parse(options.body);
    assert.equal(url,'https://api.openai.com/v1/responses');
    assert.deepEqual(body.text.format.schema.required,['ja','en','th','vi','zh']);
    assert.equal(JSON.stringify(body.input).includes('features'),false);
    return aiReply(generated);
  });
  assert.equal(count,1);assert.deepEqual(copies,generated);
});
test('generation rejects invented Japanese names, changed ingredient order/amounts/decision, and missing languages',async()=>{
  for(const output of [
    {...generated,ja:{...japanese,name:'別の商品'}},
    {...generated,ja:{...japanese,ingredientNames:['別の食材']}},
    {...generated,ja:{...japanese,ingredientAmounts:['1個']}},
    {...generated,ja:{...japanese,quantityNote:'レシピを優先'}},
    {ja:japanese,en:copy},
    {...generated,th:{...copy,ingredientAmounts:['10g']}},
  ])await assert.rejects(()=>generateCopies(source,{key:'test-key',model:'configured-model'},async()=>aiReply(output)));
});

const {webRecipeUrl,assetSources}=load('../src/lib/overseas/model.ts');
test('registered web recipe keeps its product route and is not fetched as an image',()=>{
  const url='https://zenkoku-kyotsu-recipe.vercel.app/age3-recipe.html#/r/sukiyaki-sand';
  const webInfo={...info,recipeImages:[url,'https://example.com/recipe.jpg']};
  assert.equal(webRecipeUrl(webInfo),url);
  assert.equal(assetSources(webInfo).recipe,'https://example.com/recipe.jpg');
  for(const invalid of ['javascript:alert(1)','https://zenkoku-kyotsu-recipe.vercel.app/age3-recipe.html','https://evil.example/age3-recipe.html#/r/sukiyaki-sand'])assert.equal(webRecipeUrl({...info,recipeImages:[invalid]}),'');
});
test('all five guides link to the registered web recipe, while uploaded PDFs keep portable links',()=>{
  const url='https://zenkoku-kyotsu-recipe.vercel.app/age3-recipe.html#/r/sukiyaki-sand';
  const webInfo={...info,recipeImages:[url]},draft=createDeckDraft(webInfo);
  for(const lang of LANGUAGES){
    draft.copies[lang]=copy;
    const html=documentHtml(webInfo,draft,lang,{},'');
    assert(html.includes('href="'+url+'"'));assert(!html.includes('href="Age3_Standard_Recipe.pdf"'));
    assert.equal((html.match(/<section class="page/g)||[]).length,7);
    const withPdf=documentHtml(webInfo,draft,lang,{},'',undefined,'Age3_Standard_Recipe.pdf');
    assert(withPdf.includes('href="Age3_Standard_Recipe.pdf"'));assert(!withPdf.includes('href="'+url+'"'));
  }
});
