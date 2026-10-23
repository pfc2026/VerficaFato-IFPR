import 'dotenv/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_USER_AGENT = 'VerificaFato-Bot/2.0 (+https://ifpr.edu.br; pesquisa academica; contato@verificafato.ifpr.edu.br)';
export class SourceConfig {
  constructor(options) {
    Object.assign(this, { urlPattern: null, linkSelector: null, titleSelector: null, textSelector: null, dateSelector: null, useSelenium: false, maxArticles: 15, enabled: true }, options);
    if (!this.name || !this.startUrl || !Array.isArray(this.allowDomains) || !this.allowDomains.length) throw new TypeError('Fonte deve informar nome, URL e domínios permitidos.');
  }
}
export const SOURCES = Object.freeze({
  g1_parana: new SourceConfig({ name: 'g1_parana', displayName: 'G1 Paraná', startUrl: 'https://g1.globo.com/pr/', allowDomains: ['g1.globo.com', 'globo.com'], urlPattern: /g1\.globo\.com\/pr\/.*noticia/, linkSelector: "a.feed-post-link, a[href*='/pr/']", titleSelector: 'h1.content-head__title', textSelector: 'article, .mc-body, .content-text', dateSelector: "time[itemprop='datePublished'], time", maxArticles: 10 }),
  o_parana: new SourceConfig({ name: 'o_parana', displayName: 'Jornal O Paraná', startUrl: 'https://www.oparana.com.br', allowDomains: ['oparana.com.br', 'www.oparana.com.br'], urlPattern: /oparana\.com\.br\/(noticia|parana|cascavel|oeste)/, linkSelector: "article a, .entry-title a, a[href*='oparana.com.br']", titleSelector: 'h1.entry-title, h1.post-title', textSelector: 'div.entry-content, article', dateSelector: 'time.entry-date, .posted-on time', maxArticles: 10 }),
  gazeta_do_povo: new SourceConfig({ name: 'gazeta_do_povo', displayName: 'Gazeta do Povo', startUrl: 'https://www.gazetadopovo.com.br/parana/', allowDomains: ['gazetadopovo.com.br', 'www.gazetadopovo.com.br'], urlPattern: /gazetadopovo\.com\.br\/parana\/.*/, linkSelector: "article a, a[href*='/parana/']", titleSelector: 'h1.c-title, h1.title', textSelector: 'article, .c-body', dateSelector: 'time', maxArticles: 10 }),
  jornal_de_toledo: new SourceConfig({ name: 'jornal_de_toledo', displayName: 'Jornal de Toledo', startUrl: 'https://www.jornaldetoledo.com.br', allowDomains: ['jornaldetoledo.com.br', 'www.jornaldetoledo.com.br'], urlPattern: /jornaldetoledo\.com\.br\/.*/, linkSelector: 'article a, .post-title a', titleSelector: 'h1.entry-title, h1.post-title', textSelector: 'div.entry-content, article', dateSelector: 'time', maxArticles: 10 }),
  radio_colmeia: new SourceConfig({ name: 'radio_colmeia', displayName: 'Rádio Colmeia (Cascavel)', startUrl: 'https://radiocolmeia.com.br', allowDomains: ['radiocolmeia.com.br', 'www.radiocolmeia.com.br'], urlPattern: /radiocolmeia\.com\.br\/.*/, linkSelector: 'article a, h2 a, h3 a', titleSelector: 'h1.entry-title, h1', textSelector: 'div.entry-content, article', dateSelector: 'time', maxArticles: 10 }),
  radio_cultura_toledo: new SourceConfig({ name: 'radio_cultura_toledo', displayName: 'Rádio Cultura Toledo', startUrl: 'https://www.radioculturatoledo.com.br', allowDomains: ['radioculturatoledo.com.br', 'www.radioculturatoledo.com.br'], urlPattern: /radioculturatoledo\.com\.br\/.*/, linkSelector: "article a, .post a, a[href*='noticia']", titleSelector: 'h1', textSelector: 'article, .entry-content', dateSelector: 'time', maxArticles: 10 }),
});
export class ScraperSettings {
  constructor(options = {}) {
    Object.assign(this, { userAgent: DEFAULT_USER_AGENT, requestTimeoutMs: 15000, requestDelayMs: 1000, maxRetries: 3, backoffFactorMs: 1000, outputDir: resolve(ROOT_DIR, 'data'), mongoUri: process.env.MONGO_URI || '', mongoDbName: process.env.MONGO_DB_NAME || 'verificafato', mongoCollection: process.env.MONGO_COLLECTION || 'noticias_coletadas', headlessSelenium: true }, options);
    this.outputJsonPath = resolve(this.outputDir, 'noticias.json');
  }
}