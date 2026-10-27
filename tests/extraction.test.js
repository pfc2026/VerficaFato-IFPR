import test from 'node:test';
import assert from 'node:assert/strict';
import { obterConteudoDaUrl } from '../services/extraction.js';
import { analisarConteudo } from '../services/analysis.js';

const article = 'A escola publicou o calendário das atividades do próximo semestre. O documento apresenta as datas de matrícula e o cronograma de aulas para os estudantes.';
const html = metadata => '<!doctype html><html><head><title>Calendário escolar</title>' + metadata + '</head><body><article><h1>Calendário escolar</h1><p>' + article + '</p></article></body></html>';

function transport({ metadata = '', headers = {}, pageStatus = 200, pageBody, rules = '', redirect } = {}) {
  return async (url, options = {}) => {
    if (new URL(url).pathname === '/robots.txt') {
      return { url, status: 200, headers: { 'content-type': 'text/plain' }, text: rules };
    }
    await options.beforeRequest?.(new URL(url));
    if (redirect) await options.beforeRequest?.(new URL(redirect));
    return { url: redirect || url, status: pageStatus, headers: { 'content-type': 'text/html; charset=utf-8', ...headers }, text: pageBody ?? html(metadata) };
  };
}

test('public articles with search-result directives remain readable by URL', async () => {
  const cases = [
    { headers: { 'x-robots-tag': 'noarchive' } },
    { headers: { 'x-robots-tag': 'googlebot: NOSNIPPET, NOARCHIVE' } },
    { metadata: '<meta name="robots" content="nosnippet">' },
    { metadata: '<meta name="robots" content="noarchive, noindex, nofollow">' },
    { metadata: '<meta name="robots" content="NoArchive, NoSnippet">', headers: { 'x-robots-tag': 'nosnippet' } }
  ];
  for (const [index, fixture] of cases.entries()) {
    const result = await obterConteudoDaUrl(`https://search-directives-${index}.example.org/noticia`, { get: transport(fixture) });
    assert.equal(result.conteudoObtido, true);
    assert.ok(result.texto.includes(article));
    assert.equal(result.titulo, 'Calendário escolar');
  }
});

test('robots.txt still prevents reading a disallowed article', async () => {
  await assert.rejects(() => obterConteudoDaUrl('https://robots-access.example.org/noticia', {
    get: transport({ rules: 'User-agent: *\nDisallow: /', metadata: '<meta name="robots" content="noarchive">' })
  }), error => error.code === 'ROBOTS_DENIED');
});

test('redirects still check the destination crawling permissions', async () => {
  await assert.rejects(() => obterConteudoDaUrl('https://robots-redirect.example.org/noticia', {
    get: transport({ rules: 'User-agent: *\nDisallow: /restrito', redirect: 'https://robots-redirect.example.org/restrito/noticia' })
  }), error => error.code === 'ROBOTS_DENIED');
});

test('inaccessible, non-HTML and empty pages retain explicit extraction errors', async () => {
  const cases = [
    { pageStatus: 401, code: 'PAGE_UNAVAILABLE' },
    { pageStatus: 403, code: 'PAGE_UNAVAILABLE' },
    { headers: { 'content-type': 'application/pdf' }, code: 'INVALID_CONTENT_TYPE' },
    { pageBody: '<html><body></body></html>', code: 'EMPTY_ARTICLE' }
  ];
  for (const [index, { code, ...fixture }] of cases.entries()) {
    await assert.rejects(() => obterConteudoDaUrl(`https://access-errors-${index}.example.org/noticia`, { get: transport(fixture) }), error => error.code === code);
  }
});

test('a URL with search directives feeds article text to analysis without inventing evidence', async () => {
  const url = 'https://search-directives-analysis.example.org/noticia';
  let analyzedText;
  const result = await analisarConteudo({ link: url }, {
    extract: (input, options) => obterConteudoDaUrl(input, { ...options, get: transport({ headers: { 'x-robots-tag': 'noarchive, nosnippet' } }) }),
    check: async () => ({ apiDisponivel: true, resultados: [], status: 'ok' }),
    nlp: async text => {
      analyzedText = text;
      return { indicadores: [], comparacoes: [], tensorflow: { disponivel: false, limitacoes: [] } };
    }
  });
  assert.ok(analyzedText.includes(article));
  assert.notEqual(analyzedText, url);
  assert.equal(result.noticia.conteudoObtido, true);
  assert.equal(result.veredito, 'Sem evidências suficientes');
});
