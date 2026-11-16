import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateClaim, VERDICTS } from '../services/evidence.js';
import { extractClaims } from '../services/claims.js';
import { analisarConteudo } from '../services/analysis.js';

const fixedNow = Date.parse('2026-11-15T12:00:00-03:00');
const absolute = 'A prefeitura de Curitiba anunciou uma nova escola em 2025.';
const source = (text = absolute, extra = {}) => ({id:'e1',texto_verificado:text,avaliacao:'Verdadeiro',
  verificador:'Aos Fatos',url_verificacao:'https://aosfatos.org/checagem/escola',
  data_verificacao:'2025-08-10T12:00:00Z',data_alegacao:'2025-08-01',...extra});
const claim = texto => ({id:'a1',tipo:'fato',texto});
const context = (dataPublicacao, extra = {}) => ({contextoTemporal:{dataPublicacao,
  fuso:'America/Sao_Paulo',origem:'publicacao_verificada',...extra}});

for (const expression of ['esta semana','neste mês','hoje','NESTA SEMANA','ESTE MES','nessa semana','no próximo mês','no mês passado','ontem','amanhã','neste ano','nos últimos 7 dias','há dois dias','nestas semanas','neste fim de semana','naquela semana','na última noite']) {
  test('F02: matching old text does not resolve '+expression, t => {
    t.mock.timers.enable({apis:['Date'],now:fixedNow});
    const text = 'A prefeitura de Curitiba anunciou uma nova escola '+expression+'.';
    const result = evaluateClaim(claim(text),[source(text)]);
    assert.equal(result.veredito,VERDICTS.UNKNOWN);
    assert.deepEqual(result.evidenciasUtilizadas,[]);
    assert.equal(result.evidencias[0].utilizavel,false);
  });
}

test('F02: verified publication anchors must resolve the same civil periods, independent of analysis time', t => {
  t.mock.timers.enable({apis:['Date'],now:fixedNow});
  for (const expression of ['esta semana','neste mês','hoje','ontem','semana passada','no próximo mês']) {
    const text = 'A prefeitura de Curitiba anunciou uma nova escola '+expression+'.';
    const review = source(text);
    assert.equal(evaluateClaim(claim(text),[review],[],context('2026-11-15')).veredito,VERDICTS.UNKNOWN,expression);
    // This input explicitly belongs to the old publication, not to today.
    assert.equal(evaluateClaim(claim(text),[review],[],context('2025-08-01')).veredito,VERDICTS.TRUE,expression);
  }
  const text = 'A prefeitura de Curitiba anunciou uma nova escola hoje.';
  assert.equal(evaluateClaim(claim(text),[source(text)],[],context('2025-08-01',{origem:'coleta'})).veredito,VERDICTS.UNKNOWN);
  assert.equal(evaluateClaim(claim(text),[source(text)],[],context('2025-08-01',{fuso:'invalid'})).veredito,VERDICTS.UNKNOWN);
  assert.equal(evaluateClaim(claim(text),[source(text,{data_alegacao:''})],[],context('2025-08-01')).veredito,VERDICTS.UNKNOWN);
});

test('F02: Sao Paulo midnight boundary and other contextual guards remain decisive', t => {
  t.mock.timers.enable({apis:['Date'],now:fixedNow});
  const text = 'A prefeitura de Curitiba anunciou uma nova escola hoje.';
  const review = source(text,{data_alegacao:'2025-08-02T01:30:00Z'}); // Aug 1, 22:30 in Sao Paulo
  assert.equal(evaluateClaim(claim(text),[review],[],context('2025-08-01T23:00:00-03:00')).veredito,VERDICTS.TRUE);
  assert.equal(evaluateClaim(claim(text),[review],[],context('2025-08-02T00:01:00-03:00')).veredito,VERDICTS.UNKNOWN);
  for (const changed of ['A prefeitura de Londrina anunciou uma nova escola hoje.',
    'O governador de Curitiba anunciou uma nova escola hoje.',
    'A prefeitura de Curitiba não anunciou uma nova escola hoje.']) {
    assert.equal(evaluateClaim(claim(text),[source(changed)],[],context('2025-08-01')).veredito,VERDICTS.UNKNOWN);
  }
  const deictic = 'Ela anunciou uma nova escola nesta semana em Curitiba.';
  assert.equal(evaluateClaim(claim(deictic),[source(deictic)],[],context('2025-08-01')).veredito,VERDICTS.UNKNOWN);
  for (const ordinary of [absolute,'A prefeitura de Curitiba inaugurou o museu Amanhãlandia em 2025.']) {
    assert.equal(evaluateClaim(claim(ordinary),[source(ordinary)]).veredito,VERDICTS.TRUE);
  }
});

const invalidDates = ['',null,'2025-02-30','2025-02-29','2025-13-01','2025-04-31',
  '2025-08-01T24:00:00Z','2025-08-01T12:60:00Z','2025-08-01T12:00:60Z',
  '2025-08-01T12:00:00+14:01','2025-08-01T12:00:00+25:00','2025-08-01T12:00:00',
  '08/01/2025','2025-2-01'];
for (const field of ['data_alegacao','data_verificacao']) {
  test('F05: strict calendar, clock, offset and required '+field, t => {
    t.mock.timers.enable({apis:['Date'],now:fixedNow});
    for (const date of invalidDates) {
      const result = evaluateClaim(claim(absolute),[source(absolute,{[field]:date})]);
      assert.equal(result.veredito,VERDICTS.UNKNOWN,field+': '+date);
      assert.equal(result.evidencias[0].datasCoerentes,false,field+': '+date);
    }
    const missing = source(); delete missing[field];
    assert.equal(evaluateClaim(claim(absolute),[missing]).veredito,VERDICTS.UNKNOWN);
    for (const date of ['2024-02-29','2025-08-01','2025-08-01T12:00:00Z','2025-08-01T12:00:00.123-03:00','2025-08-01T12:00:00+14:00']) {
      const extra = field === 'data_alegacao' ? {[field]:date} : {data_alegacao:'2024-02-28',[field]:date};
      assert.equal(evaluateClaim(claim(absolute),[source(absolute,extra)]).veredito,VERDICTS.TRUE,field+': '+date);
    }
  });
}

test('F05: timestamp chronology uses offsets and never substitutes another date', t => {
  t.mock.timers.enable({apis:['Date'],now:fixedNow});
  const evaluate = extra => evaluateClaim(claim(absolute),[source(absolute,extra)]).veredito;
  assert.equal(evaluate({data_alegacao:'2025-08-01T23:30:00-03:00',data_verificacao:'2025-08-02T03:00:00Z'}),VERDICTS.TRUE);
  assert.equal(evaluate({data_alegacao:'2025-08-01T23:30:00-03:00',data_verificacao:'2025-08-02T02:00:00Z'}),VERDICTS.UNKNOWN);
  assert.equal(evaluate({data_verificacao:'2026-11-15T15:00:01Z'}),VERDICTS.UNKNOWN);
});

const nonFacts = [
  ['Esta cidade é maravilhosa.','opiniao'],['Eu penso que a gestão foi ótima.','opiniao'],
  ['Na minha opinião, a escola é excelente.','opiniao'],['EU CONSIDERO esta obra péssima.','opiniao'],
  ['Aquele parque é horrível.','opiniao'],['Este projeto parece maravilhoso.','opiniao'],
  ['Daqui a dois anos a escola estará pronta.','previsao'],['No próximo mês a escola ficará pronta.','previsao'],
  ['A ponte estará aberta amanhã.','previsao'],['Os alunos terão novas salas no ano que vem.','previsao']
];
test('F09: common subjective judgments and future events are not current factual claims', () => {
  for (const [text,tipo] of nonFacts) assert.equal(extractClaims(text).claims[0].tipo,tipo,text);
});

test('F09: objective statements and attributed promises retain their actual scope', () => {
  for (const text of [absolute,'A escola tem doze salas de aula.',
    'O prefeito afirmou em 2025 que a escola estará pronta em 2027.',
    'A prefeitura anunciou que a escola será inaugurada em 2027.']) {
    const extracted = extractClaims(text).claims[0];
    assert.equal(extracted.tipo,'fato',text); assert.equal(extracted.texto,text);
    // The reported promise must not become evidence of the future event itself.
    if (/afirmou|anunciou/.test(text) && /2027/.test(text)) {
      assert.equal(evaluateClaim(extracted,[source('A escola estará pronta em 2027.')]).veredito,VERDICTS.UNKNOWN);
    }
  }
  const mixed = extractClaims('Esta cidade é maravilhosa. A escola tem doze salas de aula. Daqui a dois anos a escola estará pronta.');
  assert.deepEqual(mixed.claims.map(c=>c.tipo),['opiniao','fato','previsao']);
  for (const text of ['Esta cidade é maravilhosa, mas a escola tem doze salas de aula.',
    'Eu penso que a gestão foi ótima; a escola tem doze salas de aula.']) {
    assert.deepEqual(extractClaims(text).claims.map(c=>c.tipo),['opiniao','fato']);
  }
});

test('F09: pipeline skips factual searches for opinions/predictions and preserves mixed objective facts', async () => {
  const seen=[];
  const options={check:async text=>{seen.push(text); return {apiDisponivel:true,resultados:[]};},
    nlp:async()=>({indicadores:[],comparacoes:[],tensorflow:{disponivel:false,modelo:null,limitacoes:[]}}),
    explain:async result=>({secoes:{resumo:'Sem confirmação factual.',resultado:result.veredito,encontramos:'Sem fontes.',linguagem:'Estilo não comprova fatos.',orientacao:'Consulte as fontes.',limitacoes:'Regras de extração têm limitações.'},geracao:{status:'local'}})};
  for (const [texto] of nonFacts) {
    const result = await analisarConteudo({texto},options);
    assert.equal(result.veredito,VERDICTS.UNVERIFIABLE,texto);
    assert.equal(result.servicos.googleFactCheck.status,'nao_consultado',texto);
  }
  assert.deepEqual(seen,[]);
  await analisarConteudo({texto:'Esta cidade é maravilhosa. A escola tem doze salas de aula.'},options);
  assert.deepEqual(seen,['A escola tem doze salas de aula.']);
});
