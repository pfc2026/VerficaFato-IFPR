import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { assertPublicUrl } from '../services/safe-http.js';
import { normalizeText, normalizeUrl, parseAndNormalizeDate } from '../scraper/normalizers.js';
import { NewsItem } from '../scraper/models.js';
import { isSafeUrl, validateNewsItem } from '../scraper/validators.js';
import { NewsExtractor } from '../scraper/extractors.js';
import { Deduplicator } from '../scraper/deduplicator.js';
import { HttpCollector, RobotsChecker, SeleniumCollector } from '../scraper/collectors.js';
import { StorageManager, parseCsv } from '../scraper/storage.js';
import { SourceConfig, ScraperSettings } from '../scraper/config.js';
import { collectSource, runPipeline, PipelineMetrics, main } from '../scraper/coleta.js';

const URL1 = 'https://g1.globo.com/pr/noticia/1';
const URL2 = 'https://g1.globo.com/pr/noticia/2';
const TEXT = 'O Instituto Federal do Paraná anunciou uma iniciativa acadêmica para analisar a desinformação regional.';
const HTML = `<!doctype html><html><head><title>Título alternativo - Portal Regional</title><meta property="og:title" content="Título Canônico da Notícia"><meta property="article:published_time" content="2024-10-23T14:30:00-03:00"></head><body><header>Menu da página</header><article><h1>Título da página</h1><time datetime="2024-10-23T14:30:00-03:00"></time><div class="entry-content"><p>${TEXT}</p><p>A pesquisa permitirá que a comunidade compare notícias e consulte as fontes publicadas com maior segurança.</p></div><div class="social-share"><p>Compartilhe esta propaganda com toda sua lista de contatos.</p></div></article><aside>Publicidade aqui</aside></body></html>`;
const publicValidator = (url, options = {}) => assertPublicUrl(url, { ...options, lookup: async () => [{ address: '8.8.8.8', family: 4 }] });
const noop = async () => {};
const quiet = { info() {}, warn() {}, error() {} };
const item = (number = 1, overrides = {}) => NewsItem.build({ titulo: `Notícia Regional ${number}`, texto: `${TEXT} Registro ${number}.`, url: `https://g1.globo.com/pr/noticia/${number}`, fonte: 'g1_parana', data_publicacao: '2024-10-23T14:30:00-03:00', ...overrides });
const response = (status = 200, text = HTML, url = URL1, headers = {}) => ({ status, text, url, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });
async function temporary(t) { const directory = await mkdtemp(join(tmpdir(), 'verificafato-scraper-')); t.after(() => rm(directory, { recursive: true, force: true })); return directory; }

// Os dez cenários da suíte Python foram portados e ampliados. Todo transporte é injetado.
test('normalização Unicode, controles e espaços conserva o texto português', () => {
  assert.equal(normalizeText('  A\u0000\t B\r\n\r\n\r\nＣafé  '), 'A B\n\nＣafé');
  assert.equal(normalizeText(null), '');
  assert.equal(normalizeUrl('HTTPS://G1.GLOBO.COM/pr/noticia/?utm_source=x&FBCLID=y&id=2#texto'), 'https://g1.globo.com/pr/noticia?id=2');
});
test('datas ISO, brasileiras e por extenso preservam offset e rejeitam calendário impossível', () => {
  assert.equal(parseAndNormalizeDate('2024-10-23T14:30:00-03:00'), '2024-10-23T14:30:00-03:00');
  assert.equal(parseAndNormalizeDate('2024-05-15T10:00:00Z'), '2024-05-15T10:00:00+00:00');
  assert.equal(parseAndNormalizeDate('10/08/2024 09:15'), '2024-08-10T09:15:00');
  assert.equal(parseAndNormalizeDate('23 de outubro de 2024 às 14:30'), '2024-10-23T14:30:00');
  assert.equal(parseAndNormalizeDate('29/02/2024'), '2024-02-29T00:00:00');
  for (const value of ['31/02/2024', '29/02/2023', '2024-13-01', '2024-01-01T25:01:00Z', 'data inválida', '', null]) assert.equal(parseAndNormalizeDate(value), null);
});
test('NewsItem possui o contrato português e hash compatível com Python', async () => {
  const extractor = NewsExtractor.fromHtml(HTML, URL1);
  const record = NewsItem.build({ titulo: extractor.extractTitle(), texto: extractor.extractText(), url: URL1, fonte: 'g1_parana', data_publicacao: extractor.extractDate() });
  assert.equal(record.titulo, 'Título Canônico da Notícia');
  assert.ok(record.texto.includes('Instituto Federal do Paraná'));
  assert.ok(!record.texto.includes('propaganda'));
  assert.equal(record.data_publicacao, '2024-10-23T14:30:00-03:00');
  assert.equal(record.url, URL1);
  assert.deepEqual(await validateNewsItem(record, { allowDomains: ['g1.globo.com'], validate: publicValidator }), [true, null]);
  assert.equal(NewsItem.computeContentHash(' Notícia ', ' TEXTO '), createHash('sha256').update('notícia|texto').digest('hex'));
  assert.equal(record.title, record.titulo);
  assert.equal(record.toDict().date, undefined);
  assert.ok(Object.isFrozen(record));
});
test('extração suporta JSON-LD @graph, layouts alternativos e seletor customizado', () => {
  const jsonld = NewsExtractor.fromHtml(`<script type="application/ld+json">{"@graph":[{"headline":"Prefeitura de Cascavel entrega obras","datePublished":"2024-05-15T10:00:00Z"}]}</script><article><p>${TEXT}</p><p>${TEXT} Segunda parte.</p></article>`, URL1);
  assert.equal(jsonld.extractTitle(), 'Prefeitura de Cascavel entrega obras');
  assert.equal(jsonld.extractDate(), '2024-05-15T10:00:00+00:00');
  const alternate = NewsExtractor.fromHtml(`<div class="post-header"><h1 class="post-title">Campus IFPR promove seminário regional</h1><span class="posted-on">10/08/2024 09:15</span></div><div class="post-content"><p>${TEXT}</p></div>`, URL1);
  assert.equal(alternate.extractTitle(), 'Campus IFPR promove seminário regional');
  assert.equal(alternate.extractDate(), '2024-08-10T09:15:00');
  assert.equal(alternate.extractText('.post-content'), TEXT);
  assert.equal(NewsExtractor.fromHtml(HTML, URL1).extractTitle('h1'), 'Título da página');
});
test('data ausente é null e não vira a data da coleta', () => {
  const extractor = NewsExtractor.fromHtml(`<article><h1>Notícia sem data publicada</h1><p>${TEXT}</p></article>`, URL1);
  assert.equal(extractor.extractDate(), null);
  assert.equal(NewsItem.build({ titulo: extractor.extractTitle(), texto: TEXT, url: URL1, fonte: 'teste' }).toDict().data_publicacao, null);
});
test('URLs privadas, esquemas inválidos e domínios falsamente semelhantes são bloqueados', async () => {
  for (const url of ['http://localhost:8000/api', 'http://127.0.0.1', 'http://2130706433', 'http://0x7f000001', 'http://10.0.0.1', 'http://192.168.0.1', 'http://169.254.169.254', 'http://[::1]', 'http://[::ffff:127.0.0.1]', 'ftp://g1.globo.com/a', 'https://user:password@g1.globo.com']) {
    assert.equal((await isSafeUrl(url, { validate: publicValidator }))[0], false, url);
  }
  assert.equal((await isSafeUrl('https://g1.globo.com.evil.com/a', { allowDomains: ['g1.globo.com'], validate: publicValidator }))[0], false);
  assert.equal((await isSafeUrl(URL1, { allowDomains: ['globo.com'], validate: publicValidator }))[0], true);
});
test('extração resolve links relativos, filtra domínio e regex, e mantém ordem sem duplicar', async () => {
  const extractor = NewsExtractor.fromHtml('<a href="/pr/noticia/1?utm_source=a">1</a><a href="/pr/noticia/1#top">repetido</a><a href="https://evil.com/pr/noticia/2">externo</a><a href="/pr/noticia/2">2</a><a href="/esporte">menu</a>', URL1);
  assert.deepEqual(await extractor.extractLinks({ allowDomains: ['g1.globo.com'], urlPattern: /\/pr\/noticia\//, validate: publicValidator }), [URL1, URL2]);
});
test('deduplicação considera URL normalizada e hash de conteúdo', () => {
  const dedup = new Deduplicator(), hash = item().content_hash;
  assert.equal(dedup.isDuplicate(URL1, hash), false);
  dedup.mark(`${URL1}?utm_source=a`, hash);
  assert.equal(dedup.isDuplicate(`${URL1}#top`), true);
  assert.equal(dedup.isDuplicate(URL2, hash), true);
});
test('robots.txt aplica regras por agente e faz cache por origem', async () => {
  let calls = 0;
  const robots = new RobotsChecker({ userAgent: 'VerificaFato', request: async () => { calls++; return response(200, 'User-agent: *\nDisallow: /privado\nAllow: /publico'); } });
  assert.equal(await robots.isAllowed('https://g1.globo.com/privado/a'), false);
  assert.equal(await robots.isAllowed('https://g1.globo.com/publico/a'), true);
  assert.equal(calls, 1);
  for (const status of [401, 403, 500]) assert.equal(await new RobotsChecker({ request: async () => response(status) }).isAllowed(URL1), false);
  assert.equal(await new RobotsChecker({ request: async () => response(404) }).isAllowed(URL1), true);
  assert.equal(await new RobotsChecker({ request: async () => { throw new Error('timeout'); } }).isAllowed(URL1), false);
});
test('HTTP retries limitados para timeout e 429, com Retry-After', async () => {
  let calls = 0; const waits = [];
  const collector = new HttpCollector({ validate: publicValidator, robotsChecker: { isAllowed: async () => true }, maxRetries: 2, request: async () => ++calls < 3 ? response(429, '', URL1, { 'retry-after': '2' }) : response(), sleep: async ms => waits.push(ms) });
  assert.equal((await collector.fetch(URL1))[0], true);
  assert.equal(calls, 3); assert.deepEqual(waits, [2000, 2000]);
  await collector.close();
  calls = 0;
  const timeout = new HttpCollector({ validate: publicValidator, robotsChecker: { isAllowed: async () => true }, maxRetries: 2, request: async () => { calls++; throw new Error('Timeout'); }, sleep: noop });
  const result = await timeout.fetch(URL1);
  assert.equal(result[0], false); assert.equal(result[2], 0); assert.equal(calls, 3);
  await timeout.close();
});
test('404 não sofre retry; respostas não HTML e restrições de arquivamento são recusadas', async () => {
  for (const mock of [response(404), response(200, '{}', URL1, { 'content-type': 'application/json' }), response(200, HTML, URL1, { 'x-robots-tag': 'noarchive' })]) {
    let calls = 0;
    const collector = new HttpCollector({ validate: publicValidator, robotsChecker: { isAllowed: async () => true }, request: async () => { calls++; return mock; }, sleep: noop });
    assert.equal((await collector.fetch(URL1))[0], false); assert.equal(calls, 1); await collector.close();
  }
});
test('HTTP solicita robots novamente antes de cada hop de redirecionamento', async () => {
  let redirectedChecked = false;
  const collector = new HttpCollector({ validate: publicValidator, maxRetries: 0, robotsChecker: { isAllowed: async url => { if (url.includes('/restrito')) { redirectedChecked = true; return false; } return true; } }, request: async (_url, options) => { await options.beforeRequest(new URL('https://g1.globo.com/restrito'), options.signal); return response(); } });
  assert.equal((await collector.fetch(URL1))[0], false); assert.equal(redirectedChecked, true); await collector.close();
});
test('fechar coletor cancela novas requisições antes do transporte', async () => {
  let calls = 0;
  const collector = new HttpCollector({ validate: publicValidator, request: async () => { calls++; return response(); } });
  await collector.close(); assert.equal((await collector.fetch(URL1))[0], false); assert.equal(calls, 0);
});
test('exportação JSON UTF-8 é atômica, mantém null e é idempotente', async t => {
  const directory = await temporary(t), path = join(directory, 'data', 'noticias.json');
  assert.equal(await StorageManager.exportJson([item(), item(2, { data_publicacao: null })], path), 2);
  const records = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(records[0].titulo, 'Notícia Regional 1'); assert.equal(records[1].data_publicacao, null);
  assert.equal(await StorageManager.exportJson([item()], path), 0);
  assert.equal((await StorageManager.loadRecords(path)).length, 2);
});
test('importação inglês→português preserva o original e deduplica fontes', async t => {
  const directory = await temporary(t), legacy = join(directory, 'legacy.json'), destination = join(directory, 'noticias.json');
  const source = JSON.stringify([{ title: 'Notícia antiga original', text: TEXT, date: null, url: URL1, source: 'g1_parana', collected_at: '2024-01-01T00:00:00Z' }]);
  await writeFile(legacy, source);
  assert.equal(await StorageManager.importLegacyRecords([legacy], destination), 1);
  assert.equal(await readFile(legacy, 'utf8'), source);
  const values = JSON.parse(await readFile(destination, 'utf8'));
  assert.equal(values[0].titulo, 'Notícia antiga original'); assert.equal(values[0].title, undefined); assert.equal(values[0].data_publicacao, null);
  assert.equal(await StorageManager.importLegacyRecords([legacy], destination), 0);
});
test('JSON corrompido e diretório inválido geram erro sem destruir o original', async t => {
  const directory = await temporary(t), corrupt = join(directory, 'corrupt.json'), blocked = join(directory, 'arquivo');
  await writeFile(corrupt, '{incompleto');
  await assert.rejects(StorageManager.exportJson([item()], corrupt), /JSON inválido/);
  assert.equal(await readFile(corrupt, 'utf8'), '{incompleto');
  await writeFile(blocked, 'bloqueio');
  await assert.rejects(StorageManager.exportJson([item()], join(blocked, 'noticias.json')));
});
test('gravações JSON concorrentes preservam ambos os registros', async t => {
  const directory = await temporary(t), path = join(directory, 'noticias.json');
  await Promise.all([StorageManager.exportJson([item(1)], path), StorageManager.exportJson([item(2)], path)]);
  assert.equal((await StorageManager.loadRecords(path)).length, 2);
});
test('JSONL e CSV são idempotentes; CSV possui BOM, aspas, delimitador e proteção de fórmula', async t => {
  const directory = await temporary(t), jsonl = join(directory, 'noticias.jsonl'), csv = join(directory, 'noticias.csv');
  const records = [item(1, { titulo: '=Título suspeito; "citado"', texto: `${TEXT}\n\nSegundo parágrafo.` })];
  assert.equal(await StorageManager.exportJsonl(records, jsonl), 1);
  assert.equal(await StorageManager.exportJsonl(records, jsonl), 0);
  assert.equal(await StorageManager.exportCsv(records, csv), 1);
  assert.equal(await StorageManager.exportCsv(records, csv), 0);
  const contents = await readFile(csv, 'utf8');
  assert.equal(contents.charCodeAt(0), 0xFEFF);
  const parsed = parseCsv(contents);
  assert.equal(parsed.length, 1); assert.equal(parsed[0].titulo, '\'=Título suspeito; "citado"');
  assert.equal(parsed[0].texto, records[0].texto);
});
test('deduplicador JSONL tolera linha inválida sem perder as demais', async t => {
  const directory = await temporary(t), path = join(directory, 'noticias.jsonl');
  await writeFile(path, JSON.stringify(item()) + '\n{quebrado}\n' + JSON.stringify(item(2)));
  const dedup = new Deduplicator(); assert.equal(await dedup.loadFromJsonl(path), 2); assert.equal(dedup.isDuplicate(URL2), true);
});
test('MongoDB usa upsert e encerra o cliente mesmo quando ocorre falha', async () => {
  let closed = 0, operations;
  const collection = { createIndex: noop, bulkWrite: async values => { operations = values; return { upsertedCount: 1 }; } };
  const clientFactory = () => ({ connect: noop, db: () => ({ collection: () => collection }), close: async () => { closed++; } });
  assert.deepEqual(await StorageManager.saveToMongodb([item()], { mongoUri: 'mongodb://fixture', clientFactory }), [1, 0]);
  assert.equal(operations[0].updateOne.upsert, true); assert.equal(operations[0].updateOne.update.$setOnInsert.url, URL1); assert.equal(closed, 1);
  collection.bulkWrite = async () => { throw new Error('falha simulada'); };
  await assert.rejects(StorageManager.saveToMongodb([item()], { mongoUri: 'mongodb://fixture', clientFactory })); assert.equal(closed, 2);
});
test('pipeline continua após falha isolada e conta as fontes processadas', async () => {
  let calls = 0;
  const http = { validate: publicValidator, fetch: async () => { calls++; return calls === 1 ? [true, '<a href="/pr/noticia/1">1</a><a href="/pr/noticia/2">2</a>', 200, 'https://g1.globo.com/pr/'] : calls === 2 ? [false, '500', 500, null] : [true, HTML, 200, URL2]; } };
  const source = new SourceConfig({ name: 'teste', startUrl: 'https://g1.globo.com/pr/', allowDomains: ['g1.globo.com'] });
  const metrics = new PipelineMetrics();
  const values = await collectSource({ sourceConfig: source, settings: new ScraperSettings({ requestDelayMs: 0 }), httpCollector: http, metrics, logger: quiet });
  assert.equal(values.length, 1); assert.equal(values[0].url, URL2); assert.equal(metrics.errorsCount, 1); assert.equal(metrics.sourcesProcessed, 1);
});
test('runPipeline exporta sem MongoDB, retorna estado parcial e fecha recursos', async t => {
  const directory = await temporary(t); let calls = 0, closed = false, summary;
  const http = { validate: publicValidator, fetch: async () => ++calls === 1 ? [true, '<a href="/pr/noticia/1">artigo</a>', 200, 'https://g1.globo.com/pr/'] : [true, HTML, 200, URL1], close: async () => { closed = true; } };
  const source = new SourceConfig({ name: 'teste', startUrl: 'https://g1.globo.com/pr/', allowDomains: ['g1.globo.com'] });
  const code = await runPipeline({ sourceName: 'teste', settings: new ScraperSettings({ outputDir: directory, requestDelayMs: 0 }), sources: { teste: source }, httpCollector: http, enableMongo: false, importLegacy: false, logger: quiet, onSummary: value => { summary = value; } });
  assert.equal(code, 0); assert.equal(closed, true); assert.equal(summary.itens_validos, 1); assert.equal((await StorageManager.loadRecords(join(directory, 'noticias.json'))).length, 1);
  calls = 0; http.fetch = async () => [false, 'falha simulada', 500, null];
  assert.equal(await runPipeline({ sourceName: 'teste', settings: new ScraperSettings({ outputDir: directory }), sources: { teste: source }, httpCollector: http, enableMongo: false, importLegacy: false, logger: quiet }), 2);
});
test('CLI --help mantém opções legadas sem executar coleta', async () => {
  assert.equal(await main(['--help']), 0);
  assert.equal(await runPipeline({ limit: -1, logger: quiet }), 1);
  assert.equal(await runPipeline({ sourceName: 'inexistente', logger: quiet }), 1);
});
test('navegador indisponível não faz fallback silencioso', async () => {
  const collector = new SeleniumCollector({ browserFactory: async () => { throw new Error('não instalado'); } });
  await assert.rejects(collector.ensureAvailable(), /instale Playwright/); await collector.close();
});
test('navegador encerra contexto após falha e exige bloqueio de WebSocket', async () => {
  let closed = 0, browserClosed = 0;
  const context = { close: async () => { closed++; } };
  const collector = new SeleniumCollector({ validate: publicValidator, request: async url => url.endsWith('/robots.txt') ? response(404, '', url) : response(), browserFactory: async () => ({ newContext: async () => context, close: async () => { browserClosed++; } }) });
  assert.equal((await collector.fetch(URL1))[0], false); assert.equal(closed, 1);
  await collector.close(); assert.equal(browserClosed, 1); assert.equal(collector.browser, null);
});
test('navegador usa interceptação para HTML e subrequest e bloqueia método POST', async () => {
  let routeHandler, websocketBlocked = false, closed = 0, transportCalls = 0, aborted = 0; const fulfilled = [];
  const fakeRoute = (url, method = 'GET', type = 'document') => ({ request: () => ({ method: () => method, resourceType: () => type, isNavigationRequest: () => type === 'document', url: () => url }), abort: async () => { aborted++; }, fulfill: async value => fulfilled.push(value) });
  const context = {
    routeWebSocket: async () => { websocketBlocked = true; }, route: async (_pattern, handler) => { routeHandler = handler; }, addInitScript: noop, close: async () => { closed++; },
    newPage: async () => ({ goto: async url => { await routeHandler(fakeRoute(url)); await routeHandler(fakeRoute('https://g1.globo.com/app.css', 'GET', 'stylesheet')); await routeHandler(fakeRoute('https://g1.globo.com/app.js', 'GET', 'script')); await routeHandler(fakeRoute('https://g1.globo.com/post', 'POST', 'fetch')); }, url: () => URL1, content: async () => HTML }),
  };
  const collector = new SeleniumCollector({ validate: publicValidator, request: async url => { transportCalls++; return url.endsWith('/robots.txt') ? response(404, '', url) : response(200, url.endsWith('.css') ? 'body { color: black; }' : HTML, url); }, browserFactory: async () => ({ newContext: async options => { assert.equal(options.javaScriptEnabled, false); assert.equal(options.serviceWorkers, 'block'); return context; }, close: noop }) });
  const result = await collector.fetch(URL1, { allowDomains: ['g1.globo.com'] });
  assert.equal(result[0], true); assert.equal(websocketBlocked, true); assert.equal(fulfilled.length, 2); assert.equal(aborted, 2); assert.equal(transportCalls, 3); assert.equal(closed, 1);
  await collector.close();
});
test('NFC preserva expoentes e não transforma 10² em 102 na extração', () => {
  assert.equal(normalizeText('A área medida foi de 10² metros quadrados.'), 'A área medida foi de 10² metros quadrados.');
  const extractor = NewsExtractor.fromHtml('<article><h1>Área do terreno em metros</h1><p>A área medida no relatório público foi de 10² metros quadrados, conforme o levantamento apresentado.</p></article>', URL1);
  assert.ok(extractor.extractText().includes('10²'));
  assert.ok(!extractor.extractText().includes('102 metros'));
});

test('cache DNS da descoberta não é compartilhado com o transporte das páginas', async () => {
  let validations = 0, requests = 0;
  const validate = async (url, options) => { validations++; return publicValidator(url, options); };
  const extractor = NewsExtractor.fromHtml('<a href="/pr/noticia/1">um</a><a href="/pr/noticia/2">dois</a>', URL1);
  const links = await extractor.extractLinks({ allowDomains: ['g1.globo.com'], validate });
  assert.equal(validations, 1);
  const collector = new HttpCollector({ validate, robotsChecker: { isAllowed: async () => true }, request: async url => { requests++; return response(200, HTML, url); } });
  for (const url of links) assert.equal((await collector.fetch(url, { allowDomains: ['g1.globo.com'] }))[0], true);
  assert.equal(requests, 2); assert.equal(validations, 3);
  await collector.close();
});