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

test('main article body excludes unrelated election recommendations inside a broad article wrapper', async () => {
  const main = 'O vídeo mostra um domo de uma atração turística. A gravação não demonstra que a Terra seja plana.';
  const other = 'As eleições e as urnas foram alvo de fraude eleitoral segundo um político.';
  const result = await obterConteudoDaUrl('https://bounded-article.example.org/terra-plana', { get: transport({ pageBody: `
    <article><h1>Vídeo de domo não comprova Terra plana</h1>
      <div class="article-body"><p>${main}</p></div>
      <div><h2>Outras notícias</h2><p>${other}</p></div>
    </article><p>${other}</p>` }) });
  assert.equal(result.texto, main);
  assert.ok(!result.texto.includes('eleitoral'));
});

test('body selectors stay inside the primary story when an earlier unrelated card uses a stronger selector', async () => {
  const main = 'O vídeo mostra um domo turístico e não comprova que a Terra seja plana.';
  const result = await obterConteudoDaUrl('https://primary-story.example.org/domo', { get: transport({ pageBody: `
    <main><div class="article-body"><p>As eleições foram alvo de fraude eleitoral segundo um político.</p></div>
    <article><h1>Vídeo de domo e Terra plana</h1><div class="mc-body"><p>${main}</p></div></article></main>` }) });
  assert.equal(result.texto, main);
});

test('recommendations, nested article cards and linked headlines are excluded from article prose', async () => {
  const other = 'As urnas nas eleições foram questionadas por políticos nesta semana.';
  const result = await obterConteudoDaUrl('https://clean-article.example.org/noticia', { get: transport({ pageBody: `
    <article><h1>Calendário escolar</h1><p>${article}</p>
      <section data-component="recommended"><p>${other}</p></section>
      <section aria-label="related stories"><p>${other}</p></section>
      <article><h2>Outra matéria</h2><p>${other}</p></article>
      <p><a href="/outra-materia">${other}</a></p>
      <p>A secretaria confirmou o calendário para a comunidade escolar.</p>
    </article>` }) });
  assert.ok(result.texto.includes(article));
  assert.ok(result.texto.includes('A secretaria confirmou'));
  assert.ok(!result.texto.includes('urnas'));
});

test('pages without an identifiable article body never join all page paragraphs', async () => {
  for (const pageBody of [
    `<main><h1>Portal de notícias</h1><p>${article}</p><p>Novas eleições e urnas foram discutidas por políticos de outra região.</p></main>`,
    `<main><article><h2>Recomendação</h2><p>${article}</p></article><article><h2>Outra recomendação</h2><p>${article}</p></article></main>`
  ]) {
    await assert.rejects(() => obterConteudoDaUrl('https://no-bounded-article.example.org/noticia', { get: transport({ pageBody }) }),
      error => error.code === 'EMPTY_ARTICLE');
  }
});

test('structured articleBody provides a bounded alternative to whole-page extraction', async () => {
  const result = await obterConteudoDaUrl('https://structured-body.example.org/noticia', { get: transport({ pageBody: `
    <meta property="og:title" content="Calendário escolar">
    <script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', headline: 'Calendário escolar', articleBody: article })}</script>
    <h1>Calendário escolar</h1><p>As eleições e as urnas aparecem apenas em recomendações.</p>` }) });
  assert.equal(result.texto, article);
});

test('structured bodies belonging to another headline never substitute for the submitted article', async () => {
  await assert.rejects(() => obterConteudoDaUrl('https://unrelated-structured-body.example.org/domo', { get: transport({ pageBody: `
    <meta property="og:title" content="Vídeo de um domo e Terra plana">
    <script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', headline: 'Eleições e urnas', articleBody: 'As urnas nas eleições foram questionadas por políticos nesta semana.' })}</script>
    <h1>Vídeo de um domo e Terra plana</h1>` }) }), error => error.code === 'EMPTY_ARTICLE');
});

test('URL analysis never sends recommendation claims to fact checking', async () => {
  const seen = [];
  const body = `<article><h1>Domo e Terra plana</h1><div class="article-body"><p>O vídeo mostra o domo de uma atração turística. A gravação não comprova que a Terra seja plana.</p></div>
    <section><h2>Outras notícias</h2><p>O político afirmou que houve fraude eleitoral nas urnas das eleições.</p></section></article>`;
  await analisarConteudo({ link: 'https://analysis-topic.example.org/domo' }, {
    extract: (input, options) => obterConteudoDaUrl(input, { ...options, get: transport({ pageBody: body }) }),
    check: async text => { seen.push(text); return { apiDisponivel: true, resultados: [] }; },
    nlp: async () => ({ indicadores: [], comparacoes: [], tensorflow: { disponivel: false, limitacoes: [] } })
  });
  assert.ok(seen.some(text => text.includes('Terra')));
  assert.ok(seen.every(text => !/urna|eleiç|fraude|político/i.test(text)));
});
