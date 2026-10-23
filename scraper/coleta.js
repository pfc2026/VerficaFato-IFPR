/** CLI e orquestração ESM. O runtime normal não importa nem executa Python. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { SOURCES, ROOT_DIR, ScraperSettings } from './config.js';
import { HttpCollector, SeleniumCollector } from './collectors.js';
import { NewsExtractor } from './extractors.js';
import { NewsItem } from './models.js';
import { Deduplicator } from './deduplicator.js';
import { StorageManager } from './storage.js';
import { validateNewsItem } from './validators.js';
import { normalizeUrl } from './normalizers.js';

export class PipelineMetrics {
  constructor() { Object.assign(this, { sourcesProcessed: 0, linksDiscovered: 0, pagesFetched: 0, itemsExtracted: 0, itemsValid: 0, itemsRejected: 0, duplicatesIgnored: 0, filesPersisted: 0, mongoPersisted: 0, errorsCount: 0 }); }
  summary() { return { fontes_processadas: this.sourcesProcessed, links_descobertos: this.linksDiscovered, paginas_coletadas: this.pagesFetched, itens_extraidos: this.itemsExtracted, itens_validos: this.itemsValid, itens_rejeitados: this.itemsRejected, duplicatas_ignoradas: this.duplicatesIgnored, registros_arquivos: this.filesPersisted, registros_mongodb: this.mongoPersisted, erros_operacionais: this.errorsCount }; }
}

export async function collectSource({ sourceConfig, settings = new ScraperSettings(), httpCollector, seleniumCollector, deduplicator = new Deduplicator(), metrics = new PipelineMetrics(), maxItems, forceBrowser = false, sleep = delay, logger = console, signal } = {}) {
  metrics.sourcesProcessed++;
  const source = sourceConfig, items = [], limit = maxItems ?? source.maxArticles;
  const dynamic = forceBrowser || source.useSelenium;
  if (dynamic && !seleniumCollector) throw new Error('Fonte dinâmica exige coletor de navegador seguro.');
  const fetchPage = async (url, waitSelector) => {
    if (dynamic) { const [ok, html, finalUrl] = await seleniumCollector.fetch(url, { waitSelector, allowDomains: source.allowDomains, signal }); return [ok, html, finalUrl]; }
    const [ok, html, , finalUrl] = await httpCollector.fetch(url, { allowDomains: source.allowDomains, signal }); return [ok, html, finalUrl];
  };
  const [coverOk, coverHtml, coverUrl] = await fetchPage(source.startUrl);
  if (!coverOk) { metrics.errorsCount++; logger.warn(`Falha ao coletar a página inicial da fonte ${source.name}.`); return items; }
  const cover = NewsExtractor.fromHtml(coverHtml, coverUrl || source.startUrl);
  const links = await cover.extractLinks({ linkSelector: source.linkSelector, allowDomains: source.allowDomains, urlPattern: source.urlPattern, validate: httpCollector.validate });
  metrics.linksDiscovered += links.length;
  for (const url of links) {
    if (signal?.aborted) break;
    if (items.length >= limit) break;
    if (deduplicator.isDuplicate(url)) { metrics.duplicatesIgnored++; continue; }
    const path = new URL(url).pathname;
    if (normalizeUrl(url) === normalizeUrl(source.startUrl) || /\/(?:ultimas-noticias|empregos|tags?|categor(?:y|ia)|author)(?:\/|$)/i.test(path)) continue;
    try {
      if (settings.requestDelayMs > 0) await sleep(settings.requestDelayMs, undefined, { signal });
      const [ok, html, finalUrl] = await fetchPage(url, source.titleSelector);
      if (!ok || !html) { metrics.errorsCount++; continue; }
      metrics.pagesFetched++;
      const extractor = NewsExtractor.fromHtml(html, finalUrl || url);
      if (/noarchive|nosnippet/i.test(extractor.raw('meta[name=robots]').attr('content') || '')) { metrics.itemsRejected++; continue; }
      const item = NewsItem.build({ titulo: extractor.extractTitle(source.titleSelector), texto: extractor.extractText(source.textSelector), data_publicacao: extractor.extractDate(source.dateSelector), url: finalUrl || url, fonte: source.name });
      metrics.itemsExtracted++;
      const [valid] = await validateNewsItem(item, { allowDomains: source.allowDomains, validate: httpCollector.validate });
      if (!valid) { metrics.itemsRejected++; continue; }
      if (deduplicator.isDuplicate(item.url, item.content_hash)) { metrics.duplicatesIgnored++; continue; }
      deduplicator.mark(item.url, item.content_hash); items.push(item); metrics.itemsValid++;
    } catch { metrics.errorsCount++; logger.warn(`Falha isolada em um artigo da fonte ${source.name}; coleta prossegue.`); }
  }
  return items;
}

export async function runPipeline({ sourceName = 'all', limit, outputDir, enableMongo = true, enableSelenium = false, importLegacy = true, migrateOnly = false, settings: customSettings, httpCollector: customHttp, seleniumCollector: customBrowser, sources = SOURCES, logger = console, onSummary, signal } = {}) {
  if (limit != null && (!Number.isInteger(limit) || limit < 1 || limit > 500)) { logger.error('O limite deve ser um inteiro entre 1 e 500 por fonte.'); return 1; }
  if (sourceName !== 'all' && !Object.hasOwn(sources, sourceName)) { logger.error(`Fonte desconhecida. Opções: ${Object.keys(sources).join(', ')}, all.`); return 1; }
  const settings = customSettings || new ScraperSettings(outputDir ? { outputDir: resolve(outputDir) } : {});
  const metrics = new PipelineMetrics(), deduplicator = new Deduplicator();
  const selected = sourceName === 'all' ? Object.values(sources).filter(source => source.enabled) : [sources[sourceName]];
  const http = customHttp || new HttpCollector({ userAgent: settings.userAgent, timeoutMs: settings.requestTimeoutMs, maxRetries: settings.maxRetries, backoffFactorMs: settings.backoffFactorMs });
  let browser = customBrowser;
  try {
    const paths = [settings.outputJsonPath];
    if (importLegacy && resolve(settings.outputDir) === resolve(ROOT_DIR, 'data')) paths.push(resolve(ROOT_DIR, 'scraper', 'data', 'noticias.json'));
    const baseline = await StorageManager.loadRecords(paths);
    for (const item of baseline) deduplicator.mark(item.url, item.content_hash);
    const items = [];
    if (!migrateOnly) {
      if (enableSelenium || selected.some(source => source.useSelenium)) {
        browser ||= new SeleniumCollector({ userAgent: settings.userAgent, headless: settings.headlessSelenium });
        await browser.ensureAvailable();
      }
      for (const source of selected) {
        if (signal?.aborted) { metrics.errorsCount++; break; }
        try { items.push(...await collectSource({ sourceConfig: source, settings, httpCollector: http, seleniumCollector: browser, deduplicator, metrics, maxItems: limit, forceBrowser: enableSelenium, logger, signal })); }
        catch { metrics.errorsCount++; logger.warn(`Falha isolada na fonte ${source.name}; demais fontes serão processadas.`); }
      }
    }
    const records = [...baseline, ...items];
    if (records.length) {
      for (const [method, path] of [['exportJson', settings.outputJsonPath], ['exportJsonl', resolve(settings.outputDir, 'noticias.jsonl')], ['exportCsv', resolve(settings.outputDir, 'noticias.csv')]]) {
        try { const count = await StorageManager[method](records, path); if (method === 'exportJson') metrics.filesPersisted = count; }
        catch { metrics.errorsCount++; logger.error(`Falha de persistência em ${method}; arquivos anteriores preservados.`); }
      }
      if (enableMongo && settings.mongoUri) {
        try { const [inserted] = await StorageManager.saveToMongodb(records, { mongoUri: settings.mongoUri, dbName: settings.mongoDbName, collectionName: settings.mongoCollection }); metrics.mongoPersisted = inserted; }
        catch { metrics.errorsCount++; logger.error('Persistência MongoDB indisponível; credenciais não registradas.'); }
      }
    }
    return metrics.errorsCount ? 2 : 0;
  } catch (error) {
    metrics.errorsCount++;
    logger.error(error.message.startsWith('Renderização dinâmica') ? error.message : 'Pipeline não concluído; verifique a integridade dos arquivos e as configurações.');
    return 1;
  } finally {
    try { await http.close(); } catch {}
    if (browser) { try { await browser.close(); } catch {} }
    const summary = metrics.summary();
    logger.info(JSON.stringify(summary));
    onSummary?.(summary);
  }
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({ args: argv, options: { source: { type: 'string', default: 'all' }, all: { type: 'boolean' }, limit: { type: 'string' }, 'output-dir': { type: 'string' }, 'no-mongo': { type: 'boolean' }, selenium: { type: 'boolean' }, 'no-import-legacy': { type: 'boolean' }, 'migrate-only': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } }, strict: true });
    if (values.help) { console.info('Uso: node scraper/coleta.js [--source FONTE|all] [--all] [--limit 10] [--output-dir data] [--no-mongo] [--selenium] [--migrate-only] [--no-import-legacy]\nFontes: ' + Object.keys(SOURCES).join(', ')); return 0; }
    if (values.all && values.source !== 'all') throw new Error('Use --all ou --source FONTE.');
    return runPipeline({ sourceName: values.source, limit: values.limit == null ? undefined : Number(values.limit), outputDir: values['output-dir'], enableMongo: !values['no-mongo'], enableSelenium: !!values.selenium, importLegacy: !values['no-import-legacy'], migrateOnly: !!values['migrate-only'] });
  } catch { console.error('Argumentos inválidos. Consulte node scraper/coleta.js --help.'); return 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();