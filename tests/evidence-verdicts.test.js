import test from 'node:test';
import assert from 'node:assert/strict';
import { VERDICTS, VERDICT_DEFINITIONS, RATING_MAPPINGS, mapRating, evaluateClaim, consolidate } from '../services/evidence.js';

const statement = 'A prefeitura publicou o orçamento da escola em 2025.';
const claim = {id:'a1',tipo:'fato',texto:statement};
const review = (rating, extra = {}) => ({
  id:'e1',texto_verificado:statement,avaliacao:rating,verificador:'Aos Fatos',
  titulo_verificacao:'Checagem do orçamento da escola',
  url_verificacao:'https://aosfatos.org/checagem/orcamento',
  data_verificacao:'2025-08-10T12:00:00Z',data_alegacao:'2025-08-01',...extra
});

test('six factual categories and two complementary states have distinct definitions',()=>{
  assert.equal(Object.values(VERDICTS).length,8);
  assert.equal(new Set(Object.values(VERDICTS)).size,8);
  for (const verdict of Object.values(VERDICTS)) assert.ok(VERDICT_DEFINITIONS[verdict].length > 40);
  assert.equal(RATING_MAPPINGS['fora de contexto'],VERDICTS.OUT_OF_CONTEXT);
});

for (const [rating,verdict] of [
  ['Verdadeiro',VERDICTS.TRUE],['Parcialmente verdadeiro',VERDICTS.PARTIAL],
  ['Adulterado',VERDICTS.ALTERED],['Distorcido',VERDICTS.DISTORTED],
  ['Fora de contexto',VERDICTS.OUT_OF_CONTEXT],['Falso',VERDICTS.FALSE]
]) {
  test('published '+rating+' is attributed only to an exact, trusted, dated claim',()=>{
    assert.equal(mapRating(rating),verdict);
    const evaluated = evaluateClaim(claim,[review(rating)]);
    assert.equal(evaluated.veredito,verdict);
    assert.deepEqual(evaluated.evidenciasUtilizadas,['e1']);
    assert.match(evaluated.justificativa,/Aos Fatos/);
    assert.match(evaluated.justificativa,/2025-08-10/);
    assert.match(evaluated.justificativa,/Checagem do orçamento/);
    assert.ok(evaluated.limitacoes.length);
    for (const extra of [
      {texto_verificado:'A prefeitura não publicou o orçamento da escola em 2025.'},
      {data_verificacao:''},{data_verificacao:'2999-01-01'},
      {url_verificacao:'https://unknown.example/checagem'},
      {data_alegacao:'2025-08-11'},{data_alegacao:'invalid'},
      {url_verificacao:'https://private@aosfatos.org/checagem'}
    ]) assert.equal(evaluateClaim(claim,[review(rating,extra)]).veredito,VERDICTS.UNKNOWN);
  });
}

test('only whole unambiguous labels map; generic misleading and titles never infer a category',()=>{
  for (const rating of ['Enganoso','Enganosa','Misleading','não é falso','falso e adulterado','montagem','provavelmente verdadeiro','__proto__','toString']) {
    assert.equal(mapRating(rating),VERDICTS.UNKNOWN);
    const evaluated = evaluateClaim(claim,[review(rating,{titulo_verificacao:'Imagem adulterada, distorcida e fora de contexto'})]);
    assert.equal(evaluated.veredito,VERDICTS.UNKNOWN);
    assert.deepEqual(evaluated.evidenciasUtilizadas,[]);
  }
  const evaluated = evaluateClaim(claim,[review('Enganoso')]);
  assert.match(evaluated.justificativa,/rótulo genérico/);
  assert.match(evaluated.limitacoes[0],/sem conversão automática/);
});

test('specific and generic conflicting potential judgments cannot be silently combined',()=>{
  const evaluated = evaluateClaim(claim,[review('Verdadeiro'),review('Enganoso',{id:'e2',url_verificacao:'https://aosfatos.org/segunda'})]);
  assert.equal(evaluated.veredito,VERDICTS.UNKNOWN);
  assert.deepEqual(evaluated.evidenciasUtilizadas,[]);
});

test('lexical and semantic similarity alone cannot establish any factual category',()=>{
  for (const verdict of ['Verdadeiro','Adulterado','Distorcido','Fora de contexto','Falso']) {
    const evaluated = evaluateClaim(claim,[review(verdict,{texto_verificado:'A prefeitura não publicou o orçamento da escola em 2025.'})],
      [{afirmacaoId:'a1',evidenciaId:'e1',similaridadeLexical:1,similaridadeSemantica:1}]);
    assert.equal(evaluated.veredito,VERDICTS.UNKNOWN);
    assert.equal(evaluated.evidencias[0].similaridadeLexical,1);
    assert.equal(evaluated.evidencias[0].utilizavel,false);
  }
  assert.equal(evaluateClaim(claim,[],[{afirmacaoId:'a1',evidenciaId:'e1',similaridadeLexical:1}]).veredito,VERDICTS.UNKNOWN);
});

test('material alteration is attributed with explicit absence of media forensics',()=>{
  const evaluated = evaluateClaim(claim,[review('Adulterado')]);
  assert.equal(evaluated.veredito,VERDICTS.ALTERED);
  assert.match(evaluated.limitacoes.join(' '),/sem realizar perícia/);
  assert.match(evaluated.limitacoes.join(' '),/não foi detectada pelo TensorFlow/);
});

test('partial, distorted and contextual judgments retain unprovided details as limitations',()=>{
  for (const [rating,pattern] of [['Parcialmente verdadeiro',/quais partes/],['Distorcido',/dado real/],['Fora de contexto',/contexto original/]]) {
    const evaluated = evaluateClaim(claim,[review(rating)]);
    assert.match(evaluated.constatacoes.semComprovacao.join(' '),pattern);
    assert.deepEqual(evaluated.constatacoes.confirmado,[]);
  }
});

test('conflicting sources, missing evidence, mixed claims and incomplete consultation remain uncertain',()=>{
  const conflict = evaluateClaim(claim,[review('Verdadeiro'),review('Falso',{id:'e2',url_verificacao:'https://aosfatos.org/segunda'})]);
  assert.equal(conflict.veredito,VERDICTS.UNKNOWN);
  assert.equal(conflict.conflito,true);
  assert.deepEqual(conflict.evidenciasUtilizadas,[]);
  assert.equal(evaluateClaim(claim,[]).veredito,VERDICTS.UNKNOWN);
  const first = evaluateClaim(claim,[review('Verdadeiro')]);
  const second = evaluateClaim({...claim,id:'a2'},[review('Falso')]);
  assert.equal(consolidate([first,second]),VERDICTS.UNKNOWN);
  assert.equal(consolidate([first],{incomplete:true}),VERDICTS.UNKNOWN);
  assert.equal(consolidate([first]),VERDICTS.TRUE);
});

test('relative context and non factual input remain distinct from proven classifications',()=>{
  const contextual = {...claim,texto:'A prefeitura publicou o orçamento da escola hoje.'};
  assert.equal(evaluateClaim(contextual,[review('Verdadeiro',{texto_verificado:contextual.texto})]).veredito,VERDICTS.UNKNOWN);
  for (const tipo of ['opiniao','previsao','instrucao','editorial']) {
    const evaluated = evaluateClaim({...claim,tipo},[review('Verdadeiro')]);
    assert.equal(evaluated.veredito,VERDICTS.UNVERIFIABLE);
    assert.deepEqual(evaluated.evidencias,[]);
    assert.deepEqual(evaluated.evidenciasUtilizadas,[]);
  }
});
