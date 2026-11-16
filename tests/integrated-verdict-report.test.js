import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { analisarConteudo } from '../services/analysis.js';
import { generateExplanation } from '../services/explanation.js';
import { VERDICTS, VERDICT_DEFINITIONS } from '../services/evidence.js';
import { normalizeResult, renderAnalysis, renderHistoryAnalysis } from '../public/js/result-renderer.js';

const claim='A prefeitura de Curitiba inaugurou uma escola municipal em 2025.';
const second='A prefeitura de Londrina abriu uma biblioteca pública em 2024.';
const review=(id,text,rating)=>({id,texto_verificado:text,avaliacao:rating,
  verificador:'Aos Fatos',titulo_verificacao:'Análise publicada sobre a alegação',
  url_verificacao:'https://aosfatos.org/noticias/'+id,data_verificacao:'2025-08-10T12:00:00Z',
  data_alegacao:'2025-08-01',autor_alegacao:'Publicação examinada'});
const offlineExplanation=(result)=>generateExplanation(result,{enabled:false});
const analyze=(texto,check,extra={})=>analisarConteudo({texto},{check,explain:offlineExplanation,...extra});

function rendered(record,check,historical=false) {
  const dom=new JSDOM('<main id="result"></main>'),previous=globalThis.document;
  globalThis.document=dom.window.document;
  try {
    const root=document.getElementById('result'),normalized=(historical?renderHistoryAnalysis:renderAnalysis)(root,record);
    check(root,normalized);
  } finally {globalThis.document=previous;dom.window.close();}
}
function recordedGemini() {
  const payloads=[];
  return {payloads,explain:(result,options)=>generateExplanation(result,{...options,enabled:true,provider:'gemini',apiKey:'offline-fixture-key',model:'gemini-fixture',
    fetchImpl:async(_url,init)=>{
      const request=JSON.parse(init.body),schema=request.generationConfig.responseFormat.text.schema.properties;
      payloads.push(JSON.parse(request.contents[0].parts[0].text));
      const output={resumo:schema.resumo.enum[0],orientacao:schema.orientacao.enum[0],classificacao:result.veredito,
        feedback:schema.feedback.enum[0],
        destaques:[],referencias:[],contexto_juridico:{aplicavel:false,referencias:[]}};
      return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(output)}]}}]}));
    }})};
}
function assertUnresolved(result) {
  assert.equal(result.veredito,VERDICTS.UNKNOWN);
  assert.deepEqual(result.parecerIntegrado.evidenciasUtilizadas,[]);
  assert.ok(result.fontes.every(source=>source.utilizada===false));
  for (const item of result.afirmacoes) {
    assert.deepEqual(item.evidenciasUtilizadas,[]);
    assert.deepEqual(item.constatacoes.confirmado,[]);
    assert.deepEqual(item.constatacoes.refutado,[]);
    assert.ok(item.constatacoes.semComprovacao.length);
  }
  rendered(result,root=>{
    assert.equal(root.querySelector('.factual-summary h3').textContent,VERDICTS.UNKNOWN);
    assert.doesNotMatch(root.querySelector('.claim-results').textContent,/Fonte da classificação:/);
    assert.ok([...root.querySelectorAll('.claim-verdict')].every(node=>node.textContent===VERDICTS.UNKNOWN));
  });
}

for (const [rating,expected] of [
  ['Verdadeiro',VERDICTS.TRUE],['Parcialmente verdadeiro',VERDICTS.PARTIAL],['Adulterado',VERDICTS.ALTERED],
  ['Distorcido',VERDICTS.DISTORTED],['Fora de contexto',VERDICTS.OUT_OF_CONTEXT],['Falso',VERDICTS.FALSE]
]) {
  test('parecer integrado com TensorFlow real e fonte atribuída: '+expected,async()=>{
    const evidence=review('e1',claim,rating);
    const result=await analyze(claim,async()=>({apiDisponivel:true,status:'ok',resultados:[evidence]}));
    assert.equal(result.veredito,expected);assert.equal(result.classificacao,expected);
    assert.deepEqual(result.parecerIntegrado,{versao:1,classificacao:expected,criterio:VERDICT_DEFINITIONS[expected],
      evidenciasUtilizadas:['e1'],resultadosMistos:false,midiaAnalisada:false});
    assert.equal(Object.keys(result.classificacoes).length,8);
    assert.equal(result.afirmacoes[0].veredito,expected);
    assert.deepEqual(result.afirmacoes[0].evidenciasUtilizadas,['e1']);
    assert.equal(result.fontes[0].id,'e1');assert.equal(result.fontes[0].utilizada,true);
    assert.equal(result.fontes[0].afirmacaoVerificada,claim);assert.equal(result.fontes[0].avaliacaoOriginal,rating);
    assert.equal(result.fontes[0].verificador,evidence.verificador);assert.equal(result.fontes[0].data,evidence.data_verificacao);
    assert.equal(result.servicos.googleFactCheck.status,'ok');assert.equal(result.servicos.tensorflow.status,'ok');
    assert.equal(result.servicos.gemini.status,'desativado');assert.equal(result.analiseLinguagem.tensorflow.disponivel,true);
    assert.equal(result.porcentagem,null);assert.equal(result.confianca,null);
    assert.equal(result.analiseVisual.escopo,'padroes_textuais');
    rendered(result,root=>{
      assert.equal(root.querySelector('.factual-summary h3').textContent,expected);
      const card=root.querySelector('.claim-result');assert.ok(card);
      assert.equal(card.querySelector('.claim-text').textContent,claim);
      assert.equal(card.querySelector('.claim-verdict').textContent,expected);
      assert.match(card.textContent,/Fonte da classificação: Aos Fatos/);
      assert.ok(card.textContent.includes('Avaliação original: '+rating));
      assert.equal(card.querySelector('.claim-evidence a').href,evidence.url_verificacao);
      assert.match(card.textContent,/10\/08\/2025/);assert.match(card.textContent,/Publicação examinada/);
      assert.equal(root.querySelector('.service-availability'),null);
      assert.match(root.querySelector('.linguistic-comparisons').textContent,/TensorFlow.js: 1 comparação\(ões\) lexical\(is\) executada\(s\); nenhum modelo treinado utilizado/);
      assert.equal(root.querySelectorAll('.classification-guide dt').length,8);
      assert.equal(root.querySelector('.meter-percentage'),null); // No contrast of textual signals; no number is invented.
    });
    if (expected===VERDICTS.ALTERED) assert.match(result.afirmacoes[0].limitacoes.join(' '),/sem realizar perícia/);
  });
}

test('resultados mistos mantêm as constatações por afirmação e uma conclusão geral inconclusiva',async()=>{
  const result=await analyze(claim+' '+second,async text=>({apiDisponivel:true,status:'ok',resultados:[review(text===claim?'e1':'e2',text,text===claim?'Verdadeiro':'Falso')]}));
  assert.equal(result.veredito,VERDICTS.UNKNOWN);assert.equal(result.parecerIntegrado.resultadosMistos,true);
  assert.deepEqual(result.afirmacoes.map(item=>item.veredito),[VERDICTS.TRUE,VERDICTS.FALSE]);
  assert.equal(result.afirmacoes[0].constatacoes.confirmado.length,1);assert.equal(result.afirmacoes[1].constatacoes.refutado.length,1);
  assert.deepEqual(result.parecerIntegrado.evidenciasUtilizadas,['e1','e2']);
  rendered(result,root=>{
    assert.equal(root.querySelector('.factual-summary h3').textContent,VERDICTS.UNKNOWN);
    assert.deepEqual([...root.querySelectorAll('.claim-verdict')].map(node=>node.textContent),[VERDICTS.TRUE,VERDICTS.FALSE]);
    assert.doesNotMatch(root.querySelector('.factual-summary').textContent,/Parcialmente verdadeiro/);
  });
});

test('fontes conflitantes não mantêm fontes utilizadas, constatações conclusivas ou provas no payload Gemini',async()=>{
  const gemini=recordedGemini();
  const result=await analyze(claim,async()=>({apiDisponivel:true,status:'ok',resultados:[review('e1',claim,'Verdadeiro'),review('e2',claim,'Falso')]}),{explain:gemini.explain});
  assert.equal(result.afirmacoes[0].conflito,true);assertUnresolved(result);
  assert.deepEqual(gemini.payloads[0].evidencias_validadas,[]);
  assert.ok(gemini.payloads[0].fontes.every(source=>source.papel==='checagem_relacionada'));
});

test('falha parcial não conserva conclusão nem evidência aprovada para o Gemini',async()=>{
  const gemini=recordedGemini();
  const result=await analyze(claim,async()=>({apiDisponivel:false,status:'indisponivel',resultados:[review('e1',claim,'Verdadeiro')],erroAPI:'Consulta interrompida.'}),{explain:gemini.explain});
  assert.equal(result.afirmacoes[0].consultaCompleta,false);assert.equal(result.servicos.googleFactCheck.status,'incompleto');
  assertUnresolved(result);assert.deepEqual(gemini.payloads[0].evidencias_validadas,[]);
  assert.deepEqual(gemini.payloads[0].afirmacoes[0].evidenciasIds,[]);
  assert.deepEqual(gemini.payloads[0].afirmacoes[0].constatacoes.confirmado,[]);
});

test('checagem apenas relacionada e alta similaridade não produzem classificação factual',async()=>{
  const related='A prefeitura de Curitiba anunciou uma escola municipal em 2025.';
  const result=await analyze(claim,async()=>({apiDisponivel:true,status:'ok',resultados:[review('e1',related,'Verdadeiro')]}));
  assertUnresolved(result);
  assert.equal(result.analiseLinguagem.tensorflow.disponivel,true);
  assert.ok(result.analiseLinguagem.comparacoes.some(pair=>pair.similaridadeLexical>0.5));
});

test('falha Google mantém incerteza e falha TensorFlow não derruba uma checagem validada',async()=>{
  const unavailable=await analyze(claim,async()=>{throw new Error('Google indisponível');});
  assertUnresolved(unavailable);assert.equal(unavailable.servicos.googleFactCheck.status,'incompleto');
  assert.equal(unavailable.servicos.tensorflow.status,'ok');
  const localFailure=await analyze(claim,async()=>({apiDisponivel:true,resultados:[review('e1',claim,'Falso')]}),{nlp:async()=>{throw new Error('TF indisponível');}});
  assert.equal(localFailure.veredito,VERDICTS.FALSE);assert.equal(localFailure.servicos.tensorflow.status,'indisponivel');
  rendered(localFailure,root=>assert.match(root.querySelector('.linguistic-comparisons').textContent,/TensorFlow.js: indisponível/));
});

test('histórico Enganoso vira incerteza com aviso e esconde percentual antigo sem escopo',()=>{
  const stored={schemaVersion:2,veredito:'Enganoso',classificacao:'Enganoso',justificativa:'Registro anterior.',
    afirmacoes:[],resultados:[],fontes:[],analiseVisual:{porcentagem:97,veredito:'Alta credibilidade',confianca:'alta'}};
  const normalized=normalizeResult({resultado:stored});
  assert.equal(normalized.veredito,VERDICTS.UNKNOWN);assert.match(normalized.avisoHistorico,/não foi remapeada/);
  rendered({resultado:stored},root=>{
    assert.equal(root.querySelector('.factual-summary h3').textContent,VERDICTS.UNKNOWN);
    assert.equal(root.querySelector('.meter-percentage'),null);
    assert.match(root.querySelector('.analysis-limitations').textContent,/Faça uma nova consulta/);
    assert.equal(root.querySelector('.credibility-meter'),null);
    assert.doesNotMatch(root.textContent,/97|Alta credibilidade/);
  },true);
});
