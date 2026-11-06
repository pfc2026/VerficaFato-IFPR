import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractClaims, keywordQuery, queryVariants } from '../services/claims.js';
import { createFactChecker, formatReviews } from '../services/fact-check.js';
import { evaluateClaim } from '../services/evidence.js';
import { TTLCache } from '../services/limits.js';
import { isSpecificClaim, filterRelevantReviews, deduplicateReviews, reviewIsRelevant } from '../services/relevance.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/relevance-unit.json', import.meta.url), 'utf8'));
const review = (text, overrides = {}) => ({ id: 'review-a', texto_verificado: text,
  verificador: 'Jornal Aurora Verifica', avaliacao: 'Falso',
  url_verificacao: 'https://aosfatos.org/checagem/espaco',
  titulo_verificacao: 'Conclusão publicada pelo verificador', autor_alegacao: 'Mensagem viral',
  data_alegacao: '2024-01-02', data_verificacao: '2024-02-01', ...overrides });
const google = records => ({ claims: records.map(record => ({ text: record.texto_verificado,
  claimant: record.autor_alegacao, claimDate: record.data_alegacao,
  claimReview: [{ publisher: { name: record.verificador }, title: record.titulo_verificacao,
    url: record.url_verificacao, textualRating: record.avaliacao, reviewDate: record.data_verificacao }] })) });

test('editorial boilerplate is not independently queried for any publisher', async () => {
  let calls = 0;
  const checker = createFactChecker({ apiKey: 'fixture-only', cacheStore: new TTLCache(),
    fetchImpl: async () => { calls++; return new Response(JSON.stringify(google([review(fixture.election)]))); } });
  for (const text of fixture.boilerplate) {
    assert.equal(isSpecificClaim(text), false, text);
    assert.equal(extractClaims(text).claims[0].tipo, 'editorial', text);
    assert.deepEqual(queryVariants(text), [], text);
    assert.deepEqual((await checker(text)).resultados, [], text);
  }
  assert.equal(calls, 0);
});

test('query keywords remove editorial wording but preserve specific organization allegations', () => {
  assert.ok(isSpecificClaim(fixture.publisher));
  assert.equal(extractClaims(fixture.publisher).claims[0].tipo, 'fato');
  assert.ok(queryVariants(fixture.publisher).length);
  assert.ok(keywordQuery(fixture.publisher).includes('aurora'));
  assert.ok(keywordQuery(fixture.publisher).includes('dinheiro'));
  assert.ok(!keywordQuery(fixture.boilerplate[0]).includes('concluiu'));
  assert.ok(reviewIsRelevant(fixture.publisher, review(fixture.publisher)));
});

test('navigation wrappers preserve specific allegations while standalone commands stay unqueried', () => {
  for (const prefix of ['Veja:', 'Saiba mais:', 'Confira:']) {
    const text = prefix + ' ' + fixture.publisher;
    assert.equal(isSpecificClaim(text), true, text);
    const claim = extractClaims(text).claims[0];
    assert.equal(claim.tipo, 'fato', text);
    assert.equal(claim.texto, text, text);
    assert.ok(queryVariants(text).length, text);
    const evaluated = evaluateClaim(claim, [review(fixture.publisher)]);
    assert.equal(evaluated.evidencias[0].correspondencia, 'relacionada', text);
    assert.equal(evaluated.veredito, 'Sem evidências suficientes', text);
  }
  for (const text of ['Leia mais: confira a reportagem completa.', 'Veja: saiba mais sobre esta notícia.']) {
    assert.equal(isSpecificClaim(text), false, text);
    assert.deepEqual(queryVariants(text), [], text);
    assert.equal(extractClaims(text).claims[0].tipo, 'editorial', text);
  }
});

test('external assertion determines topicality, not title, same publisher, or publication URL', () => {
  const unrelated = review(fixture.election, {
    titulo_verificacao: fixture.space,
    url_verificacao: 'https://aosfatos.org/sonda-espacial-marte'
  });
  assert.equal(reviewIsRelevant(fixture.space, unrelated), false);
  assert.deepEqual(filterRelevantReviews(fixture.space, [unrelated]), []);
  const samePublisherOnly = review('O Jornal Aurora Verifica demitiu jornalistas durante uma greve.');
  assert.deepEqual(filterRelevantReviews(fixture.publisher, [samePublisherOnly]), []);
});

test('Google retrieval filters controlled irrelevant responses before returning results', async () => {
  const relevant = review(fixture.space);
  const unrelated = review(fixture.election, { id: 'political', url_verificacao: 'https://aosfatos.org/politica' });
  const checker = createFactChecker({ apiKey: 'fixture-filtering', cacheStore: new TTLCache(),
    fetchImpl: async () => new Response(JSON.stringify(google([relevant, unrelated]))) });
  const result = await checker(fixture.space);
  assert.equal(result.quantidade, 1);
  assert.equal(result.resultados[0].texto_verificado, fixture.space);
  assert.equal(result.resultados[0].autor_alegacao, relevant.autor_alegacao);
  assert.equal(result.resultados[0].avaliacao, relevant.avaliacao);
  assert.equal(result.resultados[0].data_verificacao, relevant.data_verificacao);
  assert.equal(result.resultados[0].url_verificacao, relevant.url_verificacao);
  assert.equal((await checker(fixture.election)).resultados[0].texto_verificado, fixture.election);
});

test('all irrelevant responses produce an empty successful retrieval', async () => {
  const checker = createFactChecker({ apiKey: 'fixture-empty', cacheStore: new TTLCache(),
    fetchImpl: async () => new Response(JSON.stringify(google([review(fixture.election)]))) });
  const result = await checker(fixture.space);
  assert.equal(result.apiDisponivel, true);
  assert.equal(result.encontrados, false);
  assert.equal(result.quantidade, 0);
  assert.deepEqual(result.resultados, []);
});

test('content, query assertion and externally checked assertion must share a topic', () => {
  assert.equal(reviewIsRelevant(fixture.election, review(fixture.election), { content: fixture.space }), false);
  assert.equal(reviewIsRelevant(fixture.election, review(fixture.election), { content: fixture.election }), true);
});

test('topic similarity never supplies missing person, location, date, negation or context equivalence', () => {
  for (const text of fixture.contextChanges) {
    const record = review(text);
    assert.equal(reviewIsRelevant(fixture.contextClaim, record), true, text);
    const evaluated = evaluateClaim({ id: 'a1', texto: fixture.contextClaim, tipo: 'fato' }, [record]);
    assert.equal(evaluated.evidencias[0].correspondencia, 'relacionada', text);
    assert.equal(evaluated.evidencias[0].utilizavel, false, text);
    assert.equal(evaluated.veredito, 'Sem evidências suficientes', text);
  }
});

test('reported allegation and article conclusion remain distinct texts and cannot be promoted', () => {
  const quoted = 'O que estão compartilhando: ' + fixture.space;
  const conclusion = 'É falso que uma sonda espacial encontrou uma estrutura artificial na superfície de Marte.';
  for (const text of [quoted, conclusion]) {
    const claim = extractClaims(text).claims[0];
    assert.equal(claim.texto, text);
    const evaluated = evaluateClaim(claim, [review(fixture.space)]);
    assert.equal(evaluated.veredito, 'Sem evidências suficientes');
    assert.equal(evaluated.evidencias[0].correspondencia, 'relacionada');
  }
});

test('evidence evaluator does not call unrelated review a related record', () => {
  const evaluated = evaluateClaim({ id: 'a1', texto: fixture.space, tipo: 'fato' }, [review(fixture.election)]);
  assert.deepEqual(evaluated.evidencias, []);
  assert.match(evaluated.justificativa, /checagem pertinente/);
});

test('duplicates across query variants preserve attribution, rating, URL and dates', () => {
  const first = review(fixture.space);
  const repeated = { ...first, id: 'other-query-id', url_verificacao: first.url_verificacao + '?utm_source=search#top' };
  const otherAuthor = { ...first, id: 'other-publisher', verificador: 'Agência Independente' };
  const otherRating = { ...first, id: 'conflict', avaliacao: 'Verdadeiro' };
  const otherDate = { ...first, id: 'later-review', data_verificacao: '2025-01-01' };
  const otherClaimant = { ...first, id: 'other-claimant', autor_alegacao: 'Autor da segunda publicação' };
  const otherClaimDate = { ...first, id: 'other-claim-date', data_alegacao: '2023-01-01' };
  const distinct = deduplicateReviews([first, repeated, otherAuthor, otherRating, otherDate, otherClaimant, otherClaimDate]);
  assert.equal(distinct.length, 6);
  assert.deepEqual(distinct[0], first);
  const formatted = formatReviews(google([first, repeated, otherAuthor, otherRating, otherDate, otherClaimant, otherClaimDate]));
  assert.equal(new Set(formatted.map(record => record.id)).size, 6);
});
