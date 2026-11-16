import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {JSDOM} from 'jsdom';
import {createApp} from '../server.js';
import {analisarConteudo} from '../services/analysis.js';
import {generateExplanation} from '../services/explanation.js';
import {renderAnalysis} from '../public/js/result-renderer.js';
import {estimateClassification} from '../public/js/ai-estimate.js';

test('HTTP → pipeline → TensorFlow real + Gemini controlado → tela mostra o índice calculado e a explicação, nunca o número do Gemini',async t=>{
  let requests=0;
  const server=createApp({dbReady:()=>false,rateLimits:false,analyze:body=>analisarConteudo(body,{
    check:async()=>({apiDisponivel:true,resultados:[]}),
    explain:result=>generateExplanation(result,{provider:'gemini',model:'gemini-controlled',apiKey:'test-key',enabled:true,
      fetchImpl:async(_url,options)=>{
        requests++;
        const request=JSON.parse(options.body),schema=request.generationConfig.responseFormat.text.schema.properties;
        const output={resumo:schema.resumo.enum[0],orientacao:schema.orientacao.enum[0],destaques:[],feedback:schema.feedback.enum[0],
          referencias:[],classificacao:result.veredito,contexto_juridico:{aplicavel:false,referencias:[]},
          explicacao:'Explicação controlada do Gemini sobre o contexto deste conteúdo.',
          estimativa:{verificavel:true,porcentagem:42,motivos:['conhecimento_geral']}};
        return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(output)}]}}]}));
      }})
  })}).listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const dom=new JSDOM('<div id="result"></div>'),previous=globalThis.document;globalThis.document=dom.window.document;
  t.after(()=>{globalThis.document=previous;dom.window.close();});
  for(const texto of ['O IBGE divulgou nesta terça-feira que a taxa de desemprego caiu para 5,6% no trimestre.','URGENTE!!! Governo vai confiscar a poupança de todos, compartilhe antes que apaguem!']) {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/verificar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texto})});
    assert.equal(response.status,200);const {sucesso,dados}=await response.json();assert.equal(sucesso,true);
    const pct=dados.indiceVeracidade.porcentagem;
    assert.ok(Number.isInteger(pct));assert.equal(dados.indiceVeracidade.componentes.tensorflow.porcentagem,pct);
    assert.equal(dados.estimativaIA.porcentagem,null);
    assert.equal(dados.porcentagem,null);assert.deepEqual(dados.parecerIntegrado.evidenciasUtilizadas,[]);
    const root=document.getElementById('result');renderAnalysis(root,dados);
    assert.equal(root.querySelector('.estimate-percentage').textContent,pct+'%');
    assert.equal(root.querySelector('.ai-estimate-summary h3').textContent,estimateClassification(pct));
    assert.match(root.querySelector('.gemini-feedback-text').textContent,/Explicação controlada do Gemini/);
    assert.equal(root.querySelector('.result-details').open,false);
  }
  assert.equal(requests,2);
});
