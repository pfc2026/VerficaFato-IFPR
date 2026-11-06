import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { JSDOM } from 'jsdom';
import { analisarConteudo } from '../services/analysis.js';
import { formatReviews } from '../services/fact-check.js';
import { generateExplanation } from '../services/explanation.js';
import { createApp } from '../server.js';
import { gerarToken } from '../middleware/auth.js';
import User from '../models/User.js';
import Verificacao from '../models/Verificacao.js';
import { renderAnalysis } from '../public/js/result-renderer.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/relevance-flow.json', import.meta.url), 'utf8'));
const externalReviews = formatReviews(fixture.googleResponse);
const relevant = externalReviews[0];
const irrelevant = externalReviews.slice(1);
const ids = records => records.map(record => record.id).sort();
const urls = records => records.map(record => record.url_verificacao).sort();
const nlp = async () => ({ indicadores: [], tensorflow: { disponivel: false, limitacoes: [] }, comparacoes: [] });
const explain = result => generateExplanation(result, { enabled: false });
function controlledOptions({ reviews = externalReviews, ...extra } = {}) {
  return {
    check: async () => ({ apiDisponivel: true, resultados: structuredClone(reviews), dadosAPI: structuredClone(externalReviews) }),
    extract: async url => ({ url, titulo: 'Vídeo de domo e inteligência artificial', texto: fixture.domeContext, conteudoObtido: true }),
    buscarRegionais: async () => [], nlp, explain, ...extra
  };
}
function assertOnlyRelevant(result, expected = [relevant]) {
  assert.deepEqual(urls(result.resultados), urls(expected));
  assert.equal(result.quantidade, expected.length);
  assert.equal(result.encontrados, expected.length > 0);
  const reviewSources = result.fontes.filter(source => source.tipo === 'checagem');
  assert.deepEqual(reviewSources.map(source => source.url).sort(), urls(expected));
  const allowed = new Set(expected.map(review => review.url_verificacao));
  for (const claim of result.afirmacoes) {
    assert.ok(claim.evidencias.every(review => allowed.has(review.url_verificacao)));
  }
  for (const review of externalReviews.filter(review => !allowed.has(review.url_verificacao))) {
    assert.ok(!JSON.stringify(result).includes(review.url_verificacao), 'discarded review leaked into an alternate result field');
    assert.ok(!JSON.stringify(result).includes(review.id), 'discarded evidence ID leaked');
  }
}
function render(t, record) {
  const dom = new JSDOM('<!doctype html><div id="result"></div>', { url: 'https://verificafato.example' });
  const previous = { document: globalThis.document, DOMParser: globalThis.DOMParser };
  globalThis.document = dom.window.document;
  globalThis.DOMParser = dom.window.DOMParser;
  t.after(() => dom.window.close());
  const root = dom.window.document.getElementById('result');
  try {
    renderAnalysis(root, record);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
  return root;
}
function cardUrls(root) {
  return [...root.querySelectorAll('.verification-item a.analysis-source-link')].map(link => link.href).sort();
}

test('mixed external responses expose only the dome review in results, sources, evidence and rendered cards', async t => {
  const result = await analisarConteudo({ texto: fixture.domeContext }, controlledOptions());
  assertOnlyRelevant(result);
  const root = render(t, result);
  assert.deepEqual(cardUrls(root), [relevant.url_verificacao]);
  assert.equal(root.querySelectorAll('.verification-item').length, 1);
  const card = root.querySelector('.verification-item');
  for (const value of [relevant.texto_verificado, relevant.avaliacao, relevant.verificador, relevant.data_verificacao]) {
    assert.ok(card.textContent.includes(value));
  }
  assert.deepEqual(result.noticiasRegionais, []);
});

test('URL and text analysis apply the same relevance rule to controlled extracted content', async () => {
  const fromText = await analisarConteudo({ texto: fixture.domeContext }, controlledOptions());
  const fromUrl = await analisarConteudo({ link: fixture.publicationUrl }, controlledOptions());
  assertOnlyRelevant(fromText); assertOnlyRelevant(fromUrl);
  assert.deepEqual(fromText.resultados, fromUrl.resultados);
  assert.deepEqual(fromText.afirmacoes, fromUrl.afirmacoes);
  assert.equal(fromText.tipoEntrada, 'texto'); assert.equal(fromUrl.tipoEntrada, 'url');
  assert.equal(fromUrl.noticia.url, fixture.publicationUrl);
  assert.ok(!fromUrl.resultados.some(review => review.url_verificacao === fixture.publicationUrl));
});

test('only irrelevant responses produce an empty final set and no cards instead of recent same-publisher fallbacks', async t => {
  const result = await analisarConteudo({ texto: fixture.domeContext }, controlledOptions({ reviews: irrelevant }));
  assertOnlyRelevant(result, []);
  assert.equal(result.veredito, 'Sem evidências suficientes');
  const root = render(t, result);
  assert.deepEqual(cardUrls(root), []);
  assert.equal(root.querySelectorAll('.verification-item').length, 0);
  assert.match(root.querySelector('.fact-check-status').textContent, /Nenhuma|Não.*encontr/i);
  assert.match(root.querySelector('.fact-check-status').textContent, /não confirma|não permite|não.*veracidade/i);
});

test('publisher boilerplate alone issues no queries and cannot admit recent reviews of the same publisher', async t => {
  const queried = [];
  const result = await analisarConteudo({ texto: fixture.boilerplate }, controlledOptions({
    check: async claim => { queried.push(claim); return { apiDisponivel: true, resultados: externalReviews }; }
  }));
  assert.deepEqual(queried, []);
  assertOnlyRelevant(result, []);
  assert.equal(render(t, result).querySelectorAll('.verification-item').length, 0);
});

test('legitimate electoral and publisher-subject claims retain their corresponding reviews', async () => {
  for (const [texto, expected] of [[fixture.politicalClaim, externalReviews[1]], [fixture.publisherClaim, externalReviews[4]]]) {
    const queried = [];
    const result = await analisarConteudo({ texto }, controlledOptions({
      check: async claim => { queried.push(claim); return { apiDisponivel: true, resultados: structuredClone(externalReviews) }; }
    }));
    assert.deepEqual(queried, [texto]);
    assertOnlyRelevant(result, [expected]);
  }
});

test('duplicate reviews from distinct queries collapse without losing published attribution or independent reviews', async t => {
  const independent = { ...relevant, id: 'independent-review', verificador: 'Agência de Checagem',
    dominio_verificador: 'agencia.example.org', url_verificacao: 'https://agencia.example.org/checagem/domo',
    avaliacao: 'Montagem', data_verificacao: '2025-04-16T12:00:00Z' };
  const reviews = [...externalReviews, { ...relevant }, { ...relevant, id: 'duplicate-query-id' }, independent];
  const result = await analisarConteudo({ texto: fixture.domeContext }, controlledOptions({ reviews }));
  assertOnlyRelevant(result, [relevant, independent]);
  assert.equal(result.resultados.length, 2);
  assert.deepEqual(cardUrls(render(t, result)), urls([relevant, independent]));
  const retained = result.resultados.find(review => review.url_verificacao === relevant.url_verificacao);
  for (const key of ['autor_alegacao', 'avaliacao', 'verificador', 'url_verificacao', 'data_verificacao', 'data_alegacao']) {
    assert.equal(retained[key], relevant[key], key);
  }
});

test('real HTTP analysis, new authenticated history data and restored cards retain the same filtered review set', async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'relevance-tests-only-secret-with-more-than-48-bytes';
  t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
  const userId = '507f1f77bcf86cd799439071';
  const recordId = '507f1f77bcf86cd799439072';
  const priorState = User.db._readyState;
  User.db._readyState = 1;
  t.after(() => { User.db._readyState = priorState; });
  const user = { _id: userId, nome: 'Fixture relevance', ativo: true, tokenVersion: 0, role: 'user' };
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  const records = [];
  t.mock.method(Verificacao, 'create', async record => { const saved = JSON.parse(JSON.stringify({ _id: recordId, ...record })); records.push(saved); return saved; });
  t.mock.method(Verificacao, 'find', filter => {
    assert.deepEqual(filter, { userId });
    return { sort: () => ({ limit: async () => structuredClone(records) }) };
  });
  const app = createApp({ dbReady: () => true, rateLimits: false,
    analyze: (body, options) => analisarConteudo(body, { ...options, ...controlledOptions() }) });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const authorization = `Bearer ${gerarToken(userId)}`;
  const response = await fetch(base + '/api/verificar', { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ link: fixture.publicationUrl }) });
  assert.equal(response.status, 200);
  const { sucesso, dados } = await response.json();
  assert.equal(sucesso, true); assertOnlyRelevant(dados);
  assert.equal(records.length, 1);
  assert.equal(records[0].userId, userId);
  assert.deepEqual(records[0].dadosAPI, dados.resultados);
  assert.deepEqual(records[0].resultado, dados);
  const historyResponse = await fetch(base + '/api/historico', { headers: { Authorization: authorization } });
  assert.equal(historyResponse.status, 200);
  const { itens } = await historyResponse.json();
  assert.equal(itens.length, 1);
  assertOnlyRelevant(itens[0].resultado);
  assert.deepEqual(ids(itens[0].dadosAPI), ids(dados.resultados));
  const directCards = cardUrls(render(t, dados));
  // The history renderer prefers the stored v2 result even if a legacy field is stale.
  const restored = render(t, { ...itens[0], dadosAPI: [...externalReviews] });
  assert.deepEqual(cardUrls(restored), directCards);
  assert.deepEqual(directCards, [relevant.url_verificacao]);
  assert.equal(restored.querySelectorAll('.verification-item').length, dados.quantidade);
});
