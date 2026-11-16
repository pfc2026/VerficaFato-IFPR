import test from 'node:test';
import assert from 'node:assert/strict';
import { analisarTextoLocalmente } from '../services/verification-indicators.js';
import { analisarConteudo } from '../services/analysis.js';
import { obterConteudoDaUrl } from '../services/extraction.js';
import { localSections } from '../services/explanation.js';

const neutral = 'A biblioteca recebeu estudantes para a leitura de novos livros.';
const positiveMixed = 'Segundo a Prefeitura de Toledo, de acordo com o estudo publicado em 10/05/2025, um comunicado oficial apresentou R$ 10 milhões em nota, a secretaria informou os resultados. Fonte: https://dados.example.org/estudo 🙂';
const negativeMixed = 'URGENTE!!! compartilhe antes que apaguem, repasse para todos, governo esconde, mídia não mostra, globo não vai noticiar. Há promessa de cura milagrosa para câncer. Fonte: https://dados.example.org/documento';
const quietNlp = async () => ({ indicadores: [], comparacoes: [], tensorflow: { disponivel: false, limitacoes: [] } });
const localExplanation = async result => ({ secoes: localSections(result), geracao: { status: 'local' } });
const noReviews = async () => ({ apiDisponivel: true, status: 'ok', resultados: [] });

function transport(pages, requests = []) {
  return async (url, options = {}) => {
    requests.push(url);
    if (new URL(url).pathname === '/robots.txt') return {
      url, status: 200, headers: { 'content-type': 'text/plain' }, text: 'User-agent: *\nAllow: /'
    };
    await options.beforeRequest?.(new URL(url));
    assert.ok(pages.has(url), 'Unexpected article URL: ' + url);
    return { url, status: 200, headers: { 'content-type': 'text/html; charset=utf-8' },
      text: '<!doctype html><html><head><title>Publicação de teste</title></head><body><article><h1>Publicação de teste</h1><p>' + pages.get(url) + '</p></article></body></html>' };
  };
}

function options(get, extra = {}) {
  return {
    extract: (url, opts) => obterConteudoDaUrl(url, { ...opts, get }),
    check: noReviews, nlp: quietNlp, explain: localExplanation, ...extra
  };
}

test('no measured textual signals yield no percentage instead of a fixed 50', () => {
  const local = analisarTextoLocalmente(neutral);
  assert.deepEqual(local.alertasFalso, []);
  assert.deepEqual(local.alertasConfiavel, []);
  assert.equal(local.porcentagemLocal, null);
});

test('length alone cannot create a percentage or raise the result', () => {
  const short = analisarTextoLocalmente(neutral);
  const long = analisarTextoLocalmente((neutral + ' ').repeat(20));
  assert.equal(short.porcentagemLocal, null);
  assert.equal(long.porcentagemLocal, null);
  assert.equal(long.pesoConfiavel, short.pesoConfiavel);
});

test('adding a known outlet name cannot raise an otherwise unmeasured result', () => {
  const baseline = analisarTextoLocalmente(neutral).porcentagemLocal;
  for (const outlet of ['G1', 'Agência Brasil', 'CNN Brasil']) {
    assert.equal(analisarTextoLocalmente(neutral + ' ' + outlet).porcentagemLocal, baseline, outlet);
  }
});

test('a known outlet URL and another source URL receive equal treatment', () => {
  const known = analisarTextoLocalmente(neutral + ' Fonte: https://g1.globo.com/referencia');
  const other = analisarTextoLocalmente(neutral + ' Fonte: https://dados.example.org/referencia');
  assert.equal(known.porcentagemLocal, other.porcentagemLocal);
  assert.equal(known.pesoConfiavel, other.pesoConfiavel);
});

test('measured positive and negative signals retain the weighted ratio without the 8/74 clamps', () => {
  const high = analisarTextoLocalmente(positiveMixed);
  const low = analisarTextoLocalmente(negativeMixed);
  for (const local of [high, low]) {
    assert.ok(local.pesoConfiavel > 0 && local.pesoFalso > 0);
    assert.equal(local.porcentagemLocal, Math.round(100 * local.pesoConfiavel / (local.pesoConfiavel + local.pesoFalso)));
  }
  assert.ok(high.porcentagemLocal > 74);
  assert.ok(low.porcentagemLocal < 8);
});

test('URL analysis scores the extracted article body rather than the URL string', async () => {
  const url = 'https://body-score.example.org/URGENTE-BOMBA';
  const result = await analisarConteudo({ link: url }, options(transport(new Map([[url, positiveMixed]]))));
  assert.equal(result.noticia.texto, positiveMixed);
  assert.equal(result.analiseVisual.texto, positiveMixed);
  assert.notEqual(result.analiseVisual.texto, url);
  // F04 suppresses the public ratio without eligible evidence, while preserving body-derived signals.
  assert.equal(result.analiseVisual.porcentagem, null);
  assert.deepEqual(result.analiseVisual.analiseLocal.alertasConfiavel, analisarTextoLocalmente(positiveMixed).alertasConfiavel);
  assert.equal(result.analiseVisual.porcentagem, (await analisarConteudo({ texto: positiveMixed }, options())).analiseVisual.porcentagem);
});

test('identical extracted bodies at different domains have the same result', async () => {
  const urls = ['https://g1.globo.com/noticia/mesmo-corpo', 'https://other-domain-score.example.org/noticia/mesmo-corpo'];
  const get = transport(new Map(urls.map(url => [url, positiveMixed])));
  const results = [];
  for (const url of urls) results.push(await analisarConteudo({ link: url }, options(get)));
  assert.equal(results[0].noticia.texto, results[1].noticia.texto);
  assert.equal(results[0].analiseVisual.porcentagem, results[1].analiseVisual.porcentagem);
  assert.equal(results[0].veredito, results[1].veredito);
});

test('different articles requested A/B/A remain isolated even when robots rules are shared', async () => {
  const firstUrl = 'https://isolated-score.example.org/artigo-a';
  const secondUrl = 'https://isolated-score.example.org/artigo-b';
  const requests = [];
  const get = transport(new Map([[firstUrl, positiveMixed], [secondUrl, negativeMixed]]), requests);
  const results = [];
  for (const url of [firstUrl, secondUrl, firstUrl]) results.push(await analisarConteudo({ link: url }, options(get)));
  assert.deepEqual(results.map(result => result.noticia.texto), [positiveMixed, negativeMixed, positiveMixed]);
  assert.notDeepEqual(results[0].analiseLocal.alertasFalso, results[1].analiseLocal.alertasFalso);
  assert.deepEqual(results[0].analiseLocal, results[2].analiseLocal);
  assert.equal(results[0].analiseVisual.porcentagem, results[2].analiseVisual.porcentagem);
  assert.deepEqual(requests.filter(url => new URL(url).pathname !== '/robots.txt'), [firstUrl, secondUrl, firstUrl]);
});

test('source-based factual classifications remain independent of the textual percentage', async () => {
  const claim = 'A prefeitura anunciou uma nova escola em 2025.';
  const url = 'https://factual-score.example.org/noticia';
  const get = transport(new Map([[url, claim]]));
  for (const [rating, verdict] of [['Verdadeiro', 'Conteúdo verdadeiro'], ['Falso', 'Falso']]) {
    const result = await analisarConteudo({ link: url }, options(get, {
      check: async () => ({ apiDisponivel: true, status: 'ok', resultados: [{
        id: 'e1', texto_verificado: claim, avaliacao: rating, verificador: 'Aos Fatos',
        url_verificacao: 'https://aosfatos.org/noticias/referencia', data_verificacao: '2025-08-10T12:00:00Z', data_alegacao: '2025-08-01'
      }] })
    }));
    assert.equal(result.veredito, verdict);
    assert.equal(result.porcentagem, null);
    assert.equal(result.confianca, null);
    assert.equal(result.analiseVisual.porcentagem, analisarTextoLocalmente(claim).porcentagemLocal);
  }
});

test('URL analysis executes real TensorFlow comparisons without treating lexical overlap as truth', async () => {
  const claim = 'A prefeitura anunciou uma nova escola em 2025.';
  const reviewed = 'A prefeitura não anunciou uma nova escola em 2025.';
  const url = 'https://tf-url-score.example.org/noticia';
  const get = transport(new Map([[url, claim]]));
  const opts = options(get, {check: async () => ({apiDisponivel:true,status:'ok',resultados:[{
    id:'e1',texto_verificado:reviewed,avaliacao:'Falso',verificador:'Aos Fatos',
    url_verificacao:'https://aosfatos.org/noticias/referencia',data_verificacao:'2025-08-10T12:00:00Z'
  }]})});
  delete opts.nlp;
  const result = await analisarConteudo({link:url},opts);
  assert.equal(result.analiseLinguagem.tensorflow.disponivel,true);
  assert.equal(result.analiseLinguagem.tensorflow.comparacoesExecutadas,1);
  assert.ok(result.analiseLinguagem.comparacoes[0].similaridadeLexical > 0.5);
  assert.equal(result.veredito,'Sem evidências suficientes');
  assert.equal(result.analiseVisual.porcentagem,null);
});
