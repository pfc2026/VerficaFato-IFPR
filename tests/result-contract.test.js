import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { JSDOM } from 'jsdom';
import { createApp } from '../server.js';
import { analisarConteudo } from '../services/analysis.js';
import { generateExplanation } from '../services/explanation.js';
import { renderAnalysis } from '../public/js/result-renderer.js';

const texto='A prefeitura anunciou uma nova biblioteca em 2025.';
export async function controlledResult(conclusive=false) {
  return analisarConteudo({texto},{
    check:async()=>({apiDisponivel:true,resultados:conclusive?[{id:'r1',texto_verificado:texto,avaliacao:'Verdadeiro',verificador:'Aos Fatos',data_alegacao:'2025-08-01',data_verificacao:'2025-08-02',url_verificacao:'https://aosfatos.org/noticias/biblioteca',titulo_verificacao:'Checagem controlada'}]:[]}),
    nlp:async()=>({indicadores:[],comparacoes:[],tensorflow:{disponivel:true,comparacoesExecutadas:0,modelo:null,limitacoes:[]}}),
    explain:r=>generateExplanation(r,{enabled:false})
  });
}
const invalid=[undefined,null,{}, {schemaVersion:2}, {schemaVersion:2,veredito:'Conteúdo verdadeiro'}];
test('F01 saída inválida do analisador nunca vira sucesso HTTP',async t=>{
  let output;
  const server=createApp({analyze:async()=>output,dbReady:()=>false,rateLimits:false}).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  for(output of invalid) {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/verificar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texto})});
    assert.equal(response.status,500,JSON.stringify(output));
    const payload=await response.json();assert.equal(payload.sucesso,false);assert.doesNotMatch(JSON.stringify(payload),/stack|afirmacoes|biblioteca/);
  }
  for(const conclusive of [false,true]) {
    output=await controlledResult(conclusive);
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/verificar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texto})});
    assert.equal(response.status,200);assert.equal((await response.json()).dados.veredito,conclusive?'Conteúdo verdadeiro':'Sem evidências suficientes');
  }
});
test('F01 renderer novo recusa incompletos e conclusão sem suporte, preserva positivos completos',async()=>{
  const dom=new JSDOM('<div id="result"></div>');const previous=globalThis.document;globalThis.document=dom.window.document;
  try {
    const root=document.getElementById('result');
    for(const value of invalid)assert.throws(()=>renderAnalysis(root,value));
    for(const conclusive of [false,true])renderAnalysis(root,await controlledResult(conclusive));
    const forged=await controlledResult();forged.veredito=forged.classificacao='Conteúdo verdadeiro';
    assert.throws(()=>renderAnalysis(root,forged));
  } finally {globalThis.document=previous;dom.window.close();}
});
