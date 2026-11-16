import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { analisarConteudo } from '../services/analysis.js';
import { generateExplanation } from '../services/explanation.js';
import { createApp } from '../server.js';
import { assertAnalysisResult } from '../public/js/result-contract.js';

const texto='A prefeitura de Curitiba anunciou uma nova biblioteca em 2025.';
const review={id:'r1',texto_verificado:texto,avaliacao:'Verdadeiro',verificador:'Aos Fatos',
  data_alegacao:'2025-08-01',data_verificacao:'2025-08-02',
  url_verificacao:'https://aosfatos.org/noticias/biblioteca',titulo_verificacao:'Checagem controlada'};
const base=await analisarConteudo({texto},{
  check:async()=>({apiDisponivel:true,resultados:[review]}),
  nlp:async()=>({indicadores:[],comparacoes:[],tensorflow:{disponivel:true,comparacoesExecutadas:0,modelo:null,limitacoes:[]}}),
  explain:result=>generateExplanation(result,{enabled:false})
});
const evidence=data=>data.afirmacoes[0].evidencias[0];
const forged=[
  ['context rejected by evaluator',data=>{evidence(data).contextoCompativel=false;}],
  ['missing context compatibility',data=>{delete evidence(data).contextoCompativel;}],
  ['impossible review calendar behind true eligibility flags',data=>{
    evidence(data).data_verificacao=data.resultados[0].data_verificacao=data.fontes[0].data='2025-02-30';
    evidence(data).data_alegacao=data.resultados[0].data_alegacao=data.fontes[0].dataAlegacao='2025-02-01';
  }],
  ['claim date later than review date',data=>{
    evidence(data).data_alegacao=data.resultados[0].data_alegacao=data.fontes[0].dataAlegacao='2025-08-03';
  }],
  ['exact-match flag for a different place',data=>{
    const changed='A prefeitura de Londrina anunciou uma nova biblioteca em 2025.';
    evidence(data).texto_verificado=data.resultados[0].texto_verificado=data.fontes[0].afirmacaoVerificada=changed;
  }],
  ['published rating contradicts mapped classification',data=>{
    evidence(data).avaliacao=data.resultados[0].avaliacao=data.fontes[0].avaliacaoOriginal='Falso';
  }],
  ['evidence metadata differs from referenced review',data=>{evidence(data).data_verificacao='2025-08-04';}],
  ['source metadata differs from referenced review',data=>{data.fontes[0].data='2025-08-04';}],
  ['source attribution differs from referenced review',data=>{evidence(data).verificador='Instituto Horizonte';}],
  ['orphan fact-check source',data=>{data.fontes.push({...data.fontes[0],id:'orphan',utilizada:false});}],
  ['regional context claims to be used factual evidence',data=>{
    data.fontes.push({id:'n0',tipo:'noticia',titulo:'Contexto regional',url:'https://g1.globo.com/pr/artigo',verificador:'G1 Paraná',utilizada:true});
  }]
];

test('F01 invariant controls accept an actual complete conclusive pipeline result',()=>{
  assert.equal(base.veredito,'Conteúdo verdadeiro');
  assert.equal(evidence(base).contextoCompativel,true);
  assert.equal(assertAnalysisResult(base),base);
});
for(const [name,mutate] of forged) test('F01 client invariant rejects '+name,()=>{
  const data=structuredClone(base);mutate(data);
  assert.throws(()=>assertAnalysisResult(data),{code:'INVALID_ANALYSIS_RESULT'});
});

test('F01 server never returns success for forged evidence eligibility',async t=>{
  let output;
  const server=createApp({analyze:async()=>output,dbReady:()=>false,rateLimits:false}).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  for(const [name,mutate] of forged){
    output=structuredClone(base);mutate(output);
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/verificar`,{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({texto})});
    const body=await response.json();
    assert.equal(response.status,500,name);
    assert.equal(body.sucesso,false,name);
    assert.doesNotMatch(JSON.stringify(body),/Instituto Horizonte|2025-02-30|stack|biblioteca/);
  }
});
