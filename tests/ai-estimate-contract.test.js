import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAiEstimate,assertAiEstimate,estimateClassification} from '../public/js/ai-estimate.js';
import {assertAnalysisResult} from '../public/js/result-contract.js';
import {analysisFixture} from './helpers/analysis-fixture.js';
const options={provider:'gemini',model:'gemini-controlled'};
const raw=porcentagem=>({verificavel:true,porcentagem,motivos:['conhecimento_geral']});

test('estimativa preserva percentuais do modelo, inclusive extremos e faixas de apresentação',()=>{
  for(const value of [0,8,30,31,50,61,69,70,74,94,100]) {
    const estimate=normalizeAiEstimate(raw(value),options);
    assert.equal(estimate.status,'disponivel');assert.equal(estimate.porcentagem,value);
    assert.equal(estimate.classificacao,value>=70?'Provavelmente verdadeiro':value<=30?'Provavelmente falso':'Veracidade incerta');
    assert.equal(assertAiEstimate(estimate),estimate);
  }
});
test('resposta ausente ou inválida nunca recebe percentual padrão',()=>{
  for(const value of [undefined,null,{},raw(-1),raw(101),raw(74.5),raw('94'),raw(NaN),raw(Infinity),{...raw(80),entidade:'Instituto inventado'},
    {...raw(80),motivos:['Texto livre inventado']},{...raw(80),motivos:['conhecimento_geral','conhecimento_geral']}]) {
    const estimate=normalizeAiEstimate(value,options);
    assert.equal(estimate.status,'indisponivel');assert.equal(estimate.porcentagem,null);assert.equal(estimate.classificacao,null);
  }
});
test('opinião ou previsão pura recebe estado próprio e não porcentagem inventada',()=>{
  for(const motivo of ['conteudo_opinativo','previsao']) {
    const estimate=normalizeAiEstimate({verificavel:false,porcentagem:null,motivos:[motivo]},options);
    assert.equal(estimate.status,'nao_aplicavel');assert.equal(estimate.porcentagem,null);
  }
  assert.equal(normalizeAiEstimate({verificavel:false,porcentagem:null,motivos:['contexto_insuficiente']},options).status,'indisponivel');
});
test('conhecimento do modelo permite estimativa rotulada sem promover ausência de fontes a confirmação',()=>{
  const result=analysisFixture();result.estimativaIA=normalizeAiEstimate(raw(94),{...options,result});
  assert.equal(assertAnalysisResult(result),result);
  assert.equal(result.veredito,'Sem evidências suficientes');assert.equal(result.porcentagem,null);
  assert.deepEqual(result.parecerIntegrado.evidenciasUtilizadas,[]);
});
test('modelo não inventa participação de checagem, comparação ou sinais inexistentes',()=>{
  const result=analysisFixture();
  for(const motivo of ['checagem_concordante','checagem_discordante','comparacao_textual','sinais_linguagem'])
    assert.equal(normalizeAiEstimate({...raw(94),motivos:[motivo]},{...options,result}).status,'indisponivel',motivo);
});
test('cliente recusa estimativa adulterada e incoerente sem relaxar o contrato factual',()=>{
  const result=analysisFixture();const estimate=normalizeAiEstimate(raw(94),{...options,result});
  for(const change of [{porcentagem:500},{porcentagem:'94'},{classificacao:'Falso'},{metodo:'probabilidade_calibrada'},{motivos:['fonte inexistente']},{url:'https://inventado.example.org'}]) {
    result.estimativaIA={...estimate,...change};assert.throws(()=>assertAnalysisResult(result),{code:'INVALID_ANALYSIS_RESULT'});
  }
  assert.equal(estimateClassification(null),null);
});
test('estimativa não contradiz checagem conclusiva validada por alteração silenciosa de número',()=>{
  for(const [veredito,value] of [['Conteúdo verdadeiro',8],['Falso',94]]) {
    const result={veredito,parecerIntegrado:{evidenciasUtilizadas:['r1']}};
    const estimate=normalizeAiEstimate(raw(value),{...options,result});
    assert.equal(estimate.status,'indisponivel');assert.equal(estimate.porcentagem,null);
    assert.equal(normalizeAiEstimate({verificavel:false,porcentagem:null,motivos:['conteudo_opinativo']},{...options,result}).status,'indisponivel');
  }
});
