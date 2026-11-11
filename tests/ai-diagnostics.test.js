import test from 'node:test';
import assert from 'node:assert/strict';
import { generateExplanation, localSections } from '../services/explanation.js';

const API_TEST_KEY = 'fake-ai-diagnostics-key-offline-only';
const PRIVATE_MESSAGE = 'PRIVATE_UPSTREAM_SENTINEL';
const feedback = 'Ainda faltam evidências para uma conclusão. Confira as fontes originais, as datas e o contexto antes de compartilhar.';
const configured = extra => ({enabled:true,provider:'gemini',apiKey:API_TEST_KEY,model:'gemini-diagnostics-fixture',retryDelayMs:0,...extra});
function fixture(extra={}) {
  return {
    veredito:'Sem evidências suficientes',justificativa:'A consulta não encontrou evidências suficientes.',
    afirmacoes:[{id:'a1',texto:'A prefeitura anunciou uma nova escola.',tipo:'fato',veredito:'Sem evidências suficientes',justificativa:'Não há checagem correspondente.'}],
    analiseLinguagem:{indicadores:[]},fontes:[],resultados:[],limitacoes:['A ausência de checagem não comprova verdade ou falsidade.'],
    ...extra
  };
}
function successfulResponse(request) {
  const fields = request.generationConfig.responseFormat.text.schema.properties;
  const output = {
    resumo:fields.resumo.enum[0],orientacao:fields.orientacao.enum[0],classificacao:fields.classificacao.enum[0],
    destaques:['a1'],feedback,referencias:[]
  };
  if (fields.contexto_juridico) output.contexto_juridico = {aplicavel:false,referencias:[]};
  return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(output)}]}}]}),{headers:{'content-type':'application/json'}});
}
function assertSafeFallback(result,base,code) {
  assert.equal(result.geracao.status,'local');
  assert.equal(result.geracao.estado,'indisponivel');
  assert.equal(result.geracao.codigo,code);
  assert.deepEqual(result.secoes,localSections(base));
  assert.equal(result.feedbackGemini.status,'local');
  assert.deepEqual(result.feedbackGemini.referencias,[]);
  assert.doesNotMatch(JSON.stringify(result),/fake-ai-diagnostics-key|PRIVATE_UPSTREAM_SENTINEL/);
  assert.match(result.feedbackGemini.texto,/não pôde gerar/);
}

for (const [status,code] of [[401,'AI_AUTH_ERROR'],[403,'AI_AUTH_ERROR'],[429,'AI_RATE_LIMIT'],[503,'AI_UNAVAILABLE'],[400,'AI_CONFIG_ERROR'],[404,'AI_CONFIG_ERROR'],[504,'AI_TIMEOUT']]) {
  test('Gemini HTTP '+status+' has safe diagnostic '+code+' and preserves local analysis',async () => {
    const base = fixture(); let calls = 0;
    const result = await generateExplanation(base,configured({fetchImpl:async (url,init) => {
      calls++;
      assert.equal(new URL(url).search,'');
      assert.equal(new Headers(init.headers).get('x-goog-api-key'),API_TEST_KEY);
      return new Response(PRIVATE_MESSAGE+' '+API_TEST_KEY,{status});
    }}));
    assert.equal(calls,[503,504].includes(status) ? 2 : 1);
    assertSafeFallback(result,base,code);
  });
}

test('network errors have a distinct safe diagnostic without leaking provider details',async () => {
  const base = fixture(); let calls = 0;
  const result = await generateExplanation(base,configured({fetchImpl:async () => {calls++; throw Error(PRIVATE_MESSAGE+' '+API_TEST_KEY);}}));
  assert.equal(calls,1);
  assertSafeFallback(result,base,'AI_NETWORK_ERROR');
});

test('HTTP 200 with malformed transport JSON or invalid model output never counts as AI success',async () => {
  const base = fixture();
  for (const response of [
    () => new Response('{'+PRIVATE_MESSAGE),
    () => new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{'+PRIVATE_MESSAGE}]}}]})),
    () => new Response(JSON.stringify({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{}'}]}}]})),
    () => new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{}'}]}}]}))
  ]) {
    let calls = 0;
    const result = await generateExplanation(base,configured({fetchImpl:async () => {calls++; return response();}}));
    assert.equal(calls,1);
    assertSafeFallback(result,base,'AI_INVALID_RESPONSE');
  }
});

test('timeoutMs aborts the actual Gemini request and produces AI_TIMEOUT without duplicate calls',async () => {
  const base = fixture(); let observedSignal, calls = 0;
  // AbortSignal.timeout uses an unref'ed timer; keep this test alive until it fires.
  const keepAlive = setTimeout(() => {},1000);
  try {
    const result = await generateExplanation(base,configured({timeoutMs:5,fetchImpl:async (_url,init) => {
      calls++; observedSignal = init.signal;
      return new Promise((_,reject) => {
        const abort = () => reject(Error(PRIVATE_MESSAGE+' '+API_TEST_KEY));
        if (init.signal.aborted) abort(); else init.signal.addEventListener('abort',abort,{once:true});
      });
    }}));
    assert.equal(calls,1);
    assert.ok(observedSignal instanceof AbortSignal);
    assert.equal(observedSignal.aborted,true);
    assertSafeFallback(result,base,'AI_TIMEOUT');
  } finally { clearTimeout(keepAlive); }
});

test('timeout after response headers while consuming the JSON body remains AI_TIMEOUT',async () => {
  const base = fixture(); let observedSignal, calls = 0;
  const keepAlive = setTimeout(() => {},1000);
  try {
    const result = await generateExplanation(base,configured({timeoutMs:5,fetchImpl:async (_url,init) => {
      calls++; observedSignal = init.signal;
      return new Response(new ReadableStream({start(controller) {
        const abort = () => controller.error(Error(PRIVATE_MESSAGE+' '+API_TEST_KEY));
        if (init.signal.aborted) abort(); else init.signal.addEventListener('abort',abort,{once:true});
      }}),{headers:{'content-type':'application/json'}});
    }}));
    assert.equal(calls,1);
    assert.equal(observedSignal.aborted,true);
    assertSafeFallback(result,base,'AI_TIMEOUT');
  } finally { clearTimeout(keepAlive); }
});

test('one Gemini call receives the entire 20000-character news and bounded TensorFlow results',async () => {
  const article = 'Contexto inicial. '+'x'.repeat(19945)+' FIM DO CONTEXTO IMPORTANTE.';
  const fullText = article.padEnd(20000,' ').slice(0,20000);
  const tensorflow = {disponivel:true,metodo:'TF-IDF e cosseno lexical',modelo:null,modeloSemantico:'desativado',comparacoesExecutadas:40,limitacoes:['Similaridade não comprova veracidade.']};
  const comparacoes = Array.from({length:40},(_,index) => ({afirmacaoId:'a1',evidenciaId:'e'+index,similaridadeLexical:index/40,similaridadeSemantica:null}));
  const base = fixture({noticia:{texto:fullText},analiseLinguagem:{indicadores:[],tensorflow,comparacoes}}), before = structuredClone(base);
  let calls = 0, payload;
  const result = await generateExplanation(base,configured({fetchImpl:async (_url,init) => {
    calls++;
    const request = JSON.parse(init.body);
    payload = JSON.parse(request.contents[0].parts[0].text);
    return successfulResponse(request);
  }}));
  assert.equal(result.geracao.status,'ia');
  assert.equal(calls,1);
  assert.equal(payload.contexto.texto.length,20000);
  assert.equal(payload.contexto.texto,fullText);
  assert.match(payload.contexto.texto,/FIM DO CONTEXTO IMPORTANTE/);
  assert.deepEqual(payload.indicadores.tensorflow,tensorflow);
  assert.equal(payload.indicadores.comparacoes.length,24);
  assert.deepEqual(payload.indicadores.comparacoes,comparacoes.slice(0,24));
  assert.deepEqual(base,before);
  assert.doesNotMatch(JSON.stringify(result),/fake-ai-diagnostics-key|PRIVATE_UPSTREAM_SENTINEL/);
});

test('news is bounded at 20000 characters and missing ML data is explicit rather than fabricated',async () => {
  const base = fixture({noticia:{texto:'x'.repeat(21000)}}); let calls = 0, payload;
  const result = await generateExplanation(base,configured({fetchImpl:async (_url,init) => {
    calls++;
    const request = JSON.parse(init.body);
    payload = JSON.parse(request.contents[0].parts[0].text);
    return successfulResponse(request);
  }}));
  assert.equal(calls,1);
  assert.equal(result.geracao.status,'ia');
  assert.equal(payload.contexto.texto,'x'.repeat(20000));
  assert.equal(payload.indicadores.tensorflow,null);
  assert.deepEqual(payload.indicadores.comparacoes,[]);
});
