import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import { generateExplanation, localSections } from '../services/explanation.js';

const key='fake-retry-test-key-never-a-real-credential';
const model='gemini-retry-fixture';
const news='Um agente público está sendo investigado por possível corrupção passiva, após suspeita de receber propina por contratos municipais.';
const legalNow=new Date('2026-11-11T12:00:00Z');
const feedback='A notícia relata uma investigação e apresenta uma hipótese que ainda precisa ser apurada. Confira os documentos originais e a manifestação dos envolvidos antes de compartilhar.';
const config=extra=>({provider:'gemini',apiKey:key,model,enabled:true,retryDelayMs:0,legalNow,...extra});
function fixture() {
  return {
    veredito:'Sem evidências suficientes',justificativa:'Não há checagem correspondente disponível.',
    afirmacoes:[{id:'a1',texto:news,tipo:'fato',veredito:'Sem evidências suficientes',justificativa:'A investigação não confirma a acusação.'}],
    analiseVisual:{texto:news},fontes:[],resultados:[],limitacoes:['A consulta não confirma nem desmente o relato.'],
    analiseLinguagem:{indicadores:[],comparacoes:[],tensorflow:{disponivel:true,modelo:null}}
  };
}
function output(init,provider='gemini') {
  const request=JSON.parse(init.body);
  const schema=provider==='gemini'?request.generationConfig.responseFormat.text.schema:request.text.format.schema;
  return {
    resumo:schema.properties.resumo.enum[0],orientacao:schema.properties.orientacao.enum[0],
    destaques:['a1'],referencias:[],feedback,classificacao:schema.properties.classificacao.enum[0],
    contexto_juridico:{aplicavel:true,referencias:[{
      id:'cp-317',categoria:'acontecimento_noticiado',trecho_noticia:news,
      situacao_juridica:'Investigação',trecho_situacao:'está sendo investigado por possível corrupção passiva'
    }]}
  };
}
function success(init,provider='gemini',override={}) {
  const value={...output(init,provider),...override};
  const data=provider==='gemini'?{candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(value)}]}}]}:
    {status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]};
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
}
function failure(status,headers={}) {
  return new Response('private-provider-message '+key,{status,headers});
}
function assertLocal(result,code,attempts,http) {
  assert.equal(result.geracao.status,'local');
  assert.equal(result.feedbackGemini.status,'local');
  assert.equal(result.geracao.codigo,code);
  assert.equal(result.geracao.tentativas,attempts);
  if(http===undefined)assert.equal(Object.hasOwn(result.geracao,'httpProvedor'),false);
  else assert.equal(result.geracao.httpProvedor,http);
  assert.deepEqual(result.contexto_juridico,{aplicavel:false,referencias:[]});
  assert.deepEqual(result.secoes,localSections(fixture()));
  assert.doesNotMatch(JSON.stringify(result),/fake-retry-test-key|private-provider-message/);
}

test('Gemini 503 then valid 200 retries the same request once and preserves verified legal context',async t=>{
  const logs=[];
  for(const method of ['log','warn','error'])t.mock.method(console,method,(...args)=>logs.push(args));
  const requests=[];
  const base=fixture(),before=structuredClone(base);
  const result=await generateExplanation(base,config({fetchImpl:async(url,init)=>{
    requests.push({url:String(url),body:init.body,headers:new Headers(init.headers)});
    return requests.length===1?failure(503):success(init);
  }}));
  assert.equal(requests.length,2);
  assert.equal(requests[0].url,requests[1].url);
  assert.equal(requests[0].body,requests[1].body);
  assert.equal(requests[1].url,'https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent');
  for(const request of requests){
    assert.equal(request.headers.get('x-goog-api-key'),key);
    assert.ok(!request.url.includes(key));assert.ok(!request.body.includes(key));
  }
  assert.equal(result.geracao.status,'ia');
  assert.equal(result.geracao.tentativas,2);assert.equal(result.geracao.httpProvedor,200);
  assert.equal(result.geracao.modelo,model);
  assert.equal(result.contexto_juridico.aplicavel,true);
  assert.equal(result.contexto_juridico.referencias[0].id,'cp-317');
  assert.equal(result.contexto_juridico.referencias[0].verificada,true);
  assert.equal(result.contexto_juridico.referencias[0].situacao_juridica,'Investigação');
  assert.deepEqual(result.feedbackGemini,{texto:feedback,status:'ia',provedor:'gemini',modelo:model,referencias:[]});
  assert.deepEqual(base,before);
  assert.ok(!JSON.stringify({result,logs}).includes(key));
});

test('two transient failures stop at two attempts and never fabricate AI or legal output',async()=>{
  let calls=0;
  const result=await generateExplanation(fixture(),config({fetchImpl:async()=>{calls++;return failure(503);}}));
  assert.equal(calls,2);assertLocal(result,'AI_UNAVAILABLE',2,503);
});

test('408, 500, 502 and 504 are retryable once; a first successful response is never duplicated',async()=>{
  for(const status of [408,500,502,504]){
    let calls=0;
    const result=await generateExplanation(fixture(),config({fetchImpl:async(_url,init)=>++calls===1?failure(status):success(init)}));
    assert.equal(calls,2,String(status));assert.equal(result.geracao.status,'ia',String(status));
    assert.equal(result.geracao.tentativas,2);assert.equal(result.geracao.httpProvedor,200);
  }
  let calls=0;
  const result=await generateExplanation(fixture(),config({fetchImpl:async(_url,init)=>{calls++;return success(init);}}));
  assert.equal(calls,1);assert.equal(result.geracao.tentativas,1);assert.equal(result.geracao.httpProvedor,200);
});

test('429 with valid Retry-After zero may recover but absent or invalid headers never retry',async()=>{
  let calls=0;
  const recovered=await generateExplanation(fixture(),config({fetchImpl:async(_url,init)=>++calls===1?failure(429,{'Retry-After':'0'}):success(init)}));
  assert.equal(calls,2);assert.equal(recovered.geracao.status,'ia');
  for(const value of [undefined,'','-1','0.5','not-a-date','Wed, 11 Nov 2026 12:00:00 GMT garbage']){
    calls=0;
    const headers=value===undefined?{}:{'Retry-After':value};
    const result=await generateExplanation(fixture(),config({fetchImpl:async()=>{calls++;return failure(429,headers);}}));
    assert.equal(calls,1,String(value));assertLocal(result,'AI_RATE_LIMIT',1,429);
  }
});

test('integer Retry-After is respected on a 503 as well as on a rate limit',async()=>{
  for(const status of [503,429]){
    const times=[];
    const result=await generateExplanation(fixture(),config({fetchImpl:async(_url,init)=>{
      times.push(performance.now());return times.length===1?failure(status,{'Retry-After':'1'}):success(init);
    }}));
    assert.equal(times.length,2);assert.ok(times[1]-times[0]>=950,'Retry-After must not be shortened');
    assert.equal(result.geracao.status,'ia');
  }
});

test('HTTP-date Retry-After is respected without treating an invalid date as permission to retry 429',async()=>{
  const expected=Date.now()+2000;
  const header=new Date(expected).toUTCString(),notBefore=Date.parse(header);
  const times=[];
  const result=await generateExplanation(fixture(),config({fetchImpl:async(_url,init)=>{
    times.push(Date.now());return times.length===1?failure(429,{'Retry-After':header}):success(init);
  }}));
  assert.equal(times.length,2);assert.ok(times[1]>=notBefore-30);
  assert.equal(result.geracao.status,'ia');assert.equal(result.geracao.tentativas,2);
});

test('invalid Retry-After on 503 uses the configured delay and retains the two-attempt limit',async()=>{
  let calls=0;
  const start=performance.now();
  const result=await generateExplanation(fixture(),config({fetchImpl:async(_url,init)=>++calls===1?failure(503,{'Retry-After':'invalid'}):success(init)}));
  assert.equal(calls,2);assert.equal(result.geracao.status,'ia');assert.ok(performance.now()-start<1000);
});

test('Retry-After that cannot leave the one-second reserve returns promptly without another request',async()=>{
  for(const value of ['60','9999999999999999999999999999999999999',new Date(Date.now()+60000).toUTCString()]){
    let calls=0;
    const start=performance.now();
    const result=await generateExplanation(fixture(),config({fetchImpl:async()=>{calls++;return failure(429,{'Retry-After':value});}}));
    assert.equal(calls,1,value);assertLocal(result,'AI_RATE_LIMIT',1,429);
    assert.ok(performance.now()-start<1000,'An excessive Retry-After must not occupy the request budget');
  }
  let calls=0;
  const result=await generateExplanation(fixture(),config({timeoutMs:1500,fetchImpl:async()=>{calls++;return failure(503,{'Retry-After':'1'});}}));
  assert.equal(calls,1);assertLocal(result,'AI_UNAVAILABLE',1,503);
});

test('time already spent on the first response reduces the remaining retry budget',async()=>{
  let calls=0;
  const result=await generateExplanation(fixture(),config({timeoutMs:1300,fetchImpl:async()=>{calls++;await pause(450);return failure(503);}}));
  assert.equal(calls,1);assertLocal(result,'AI_UNAVAILABLE',1,503);
});

test('cancellation while waiting for Retry-After aborts promptly and prevents the second fetch',async()=>{
  const controller=new AbortController();let calls=0;
  const pending=generateExplanation(fixture(),config({signal:controller.signal,fetchImpl:async()=>{
    calls++;return failure(503,{'Retry-After':'10'});
  }}));
  const start=performance.now();
  await pause(30);controller.abort();
  const result=await pending;
  assert.equal(calls,1);assertLocal(result,'AI_TIMEOUT',1,503);assert.ok(performance.now()-start<1000);
});

test('one shared default deadline is created for both retry attempts',async t=>{
  const original=AbortSignal.timeout.bind(AbortSignal),timeouts=[];
  t.mock.method(AbortSignal,'timeout',milliseconds=>{timeouts.push(milliseconds);return original(milliseconds);});
  let calls=0;
  const result=await generateExplanation(fixture(),config({fetchImpl:async(_url,init)=>++calls===1?failure(503):success(init)}));
  assert.equal(result.geracao.status,'ia');assert.equal(calls,2);assert.deepEqual(timeouts,[20000]);
});

test('a stalled second response body expires at the original deadline instead of receiving a fresh timeout',async t=>{
  // Native AbortSignal timers are unref'ed; this in-memory stream has no socket
  // to keep Node alive while the shared deadline expires.
  const activeHandle=setTimeout(()=>{},5000);
  t.after(()=>clearTimeout(activeHandle));
  const nativeTimeout=AbortSignal.timeout.bind(AbortSignal),deadlines=[];
  t.mock.method(AbortSignal,'timeout',milliseconds=>{deadlines.push(milliseconds);return nativeTimeout(milliseconds);});
  let calls=0;const signals=[],start=performance.now();
  const result=await generateExplanation(fixture(),config({timeoutMs:2500,fetchImpl:async(_url,init)=>{
    signals.push(init.signal);
    if(++calls===1)return failure(503);
    const body=new ReadableStream({start(controller){
      if(init.signal.aborted)controller.error(init.signal.reason);
      else init.signal.addEventListener('abort',()=>controller.error(init.signal.reason),{once:true});
    }});
    return new Response(body,{headers:{'Content-Type':'application/json'}});
  }}));
  const elapsed=performance.now()-start;
  assert.equal(calls,2);assertLocal(result,'AI_TIMEOUT',2,200);
  assert.deepEqual(deadlines,[2500],'A second response body must not receive a fresh deadline');
  assert.ok(signals.every(signal=>signal.aborted));
  assert.ok(elapsed>=2100,'The in-memory body must remain pending until the shared timeout');
});

test('auth, billing and configuration failures do not retry or expose upstream bodies',async()=>{
  for(const [status,code] of [[400,'AI_CONFIG_ERROR'],[401,'AI_AUTH_ERROR'],[402,'AI_UNAVAILABLE'],[403,'AI_AUTH_ERROR'],[404,'AI_CONFIG_ERROR']]){
    let calls=0;
    const result=await generateExplanation(fixture(),config({fetchImpl:async()=>{calls++;return failure(status);}}));
    assert.equal(calls,1,String(status));assertLocal(result,code,1,status);
  }
});

test('network failures, malformed JSON, provider refusal and invalid contracts do not retry',async()=>{
  const factories=[
    {fetch:async()=>{throw new Error('private-provider-message '+key);},code:'AI_NETWORK_ERROR',http:undefined},
    {fetch:async()=>new Response('{broken-json'),code:'AI_INVALID_RESPONSE',http:200},
    {fetch:async()=>new Response(JSON.stringify({promptFeedback:{blockReason:'SAFETY'}})),code:'AI_INVALID_RESPONSE',http:200},
    {fetch:async(_url,init)=>success(init,'gemini',{classificacao:'Verdadeiro'}),code:'AI_INVALID_RESPONSE',http:200}
  ];
  for(const scenario of factories){
    let calls=0;
    const result=await generateExplanation(fixture(),config({fetchImpl:async(...args)=>{calls++;return scenario.fetch(...args);}}));
    assert.equal(calls,1);assertLocal(result,scenario.code,1,scenario.http);
  }
});

test('invalid second JSON consumes only the already-authorized second attempt',async()=>{
  let calls=0;
  const result=await generateExplanation(fixture(),config({fetchImpl:async()=>++calls===1?failure(503):new Response('{invalid-second-json')}));
  assert.equal(calls,2);assertLocal(result,'AI_INVALID_RESPONSE',2,200);
});

test('OpenAI does not inherit Gemini retries and zero-attempt states carry no attempt metadata',async()=>{
  let calls=0;
  const failed=await generateExplanation(fixture(),config({provider:'openai',model:'openai-test-model',fetchImpl:async()=>{calls++;return failure(503);}}));
  assert.equal(calls,1);assertLocal(failed,'AI_UNAVAILABLE',1,503);
  for(const options of [{enabled:false},{apiKey:''},{model:'invalid/model'}, {signal:AbortSignal.abort()}]){
    calls=0;
    const result=await generateExplanation(fixture(),config({...options,fetchImpl:async()=>{calls++;throw new Error('Must not fetch');}}));
    assert.equal(calls,0);assert.equal(result.geracao.status,'local');
    assert.equal(Object.hasOwn(result.geracao,'tentativas'),false);
    assert.equal(Object.hasOwn(result.geracao,'httpProvedor'),false);
  }
});
