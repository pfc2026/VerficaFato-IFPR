import { load } from 'cheerio';
import { normalizeText, normalizeUrl, parseAndNormalizeDate } from './normalizers.js';
import { isSafeUrl } from './validators.js';
import { parsePublicUrl, assertPublicUrl } from '../services/safe-http.js';

const REMOVE_TAGS = 'script,style,noscript,iframe,nav,header,footer,aside,form,button';
const REMOVE_ATTRIBUTES = /cookie|comentario|compartilh|social-share|publicidade|banner|relacionad|sidebar|widget|anuncio/i;
const DATE_SELECTORS = ['.posted-on', '.entry-date', '.data-publicacao', '.post-date', '.data', "[itemprop='datePublished']"];
const TEXT_SELECTORS = ['.entry-content', '.noticia-texto', '.post-content', '.content-text', '#materia-conteudo'];

export class NewsExtractor {
  constructor(html, baseUrl) {
    this.baseUrl = baseUrl;
    this.raw = load(typeof html === 'string' ? html : '');
    this.clean = load(this.raw.html());
    this.clean(REMOVE_TAGS).remove();
    this.clean('[class],[id]').filter((_, element) => REMOVE_ATTRIBUTES.test(`${this.clean(element).attr('class') || ''} ${this.clean(element).attr('id') || ''}`)).remove();
  }
  static fromHtml(html, baseUrl) { return new NewsExtractor(html, baseUrl); }
  extractJsonLd() {
    const records = [];
    this.raw('script[type="application/ld+json"]').each((_, element) => {
      try {
        const value = JSON.parse(this.raw(element).text());
        if (Array.isArray(value)) records.push(...value);
        else if (value && typeof value === 'object') records.push(...(Array.isArray(value['@graph']) ? value['@graph'] : [value]));
      } catch { /* Marcação externa inválida não impede a extração do HTML. */ }
    });
    return records.filter(value => value && typeof value === 'object');
  }
  extractTitle(customSelector) {
    if (customSelector) { const title = normalizeText(this.raw(customSelector).first().text()); if (title) return title; }
    for (const name of ['og:title', 'twitter:title']) {
      const content = this.raw(`meta[property="${name}"],meta[name="${name}"]`).first().attr('content');
      if (content) return normalizeText(content);
    }
    const heading = normalizeText(this.clean('h1').first().text());
    if (heading) return heading;
    for (const record of this.extractJsonLd()) if (typeof record.headline === 'string' && record.headline.trim()) return normalizeText(record.headline);
    return normalizeText(this.raw('title').first().text().replace(/\s+(?:-|\||—)\s+[^|—]+$/, ''));
  }
  extractDate(customSelector) {
    const parseElement = element => parseAndNormalizeDate(element.attr('datetime') || element.attr('content') || element.text());
    if (customSelector) { const date = parseElement(this.raw(customSelector).first()); if (date) return date; }
    for (const selector of ['meta[property="article:published_time"]', 'meta[name="article:published_time"]', 'meta[property="og:published_time"]', 'meta[name="pubdate"]', 'meta[name="publishdate"]', 'meta[name="date"]']) {
      const date = parseElement(this.raw(selector).first()); if (date) return date;
    }
    for (const record of this.extractJsonLd()) for (const key of ['datePublished', 'dateCreated', 'uploadDate']) {
      const date = parseAndNormalizeDate(record[key]); if (date) return date;
    }
    for (const element of this.clean('time').toArray()) { const date = parseElement(this.clean(element)); if (date) return date; }
    for (const selector of DATE_SELECTORS) { const date = parseElement(this.raw(selector).first()); if (date) return date; }
    return null;
  }
  paragraphs(element, minimum = 20) {
    return element.find('p').toArray().map(p => normalizeText(this.clean(p).text())).filter(text => text.length > minimum);
  }
  extractText(customSelector) {
    if (customSelector) {
      const element = this.clean(customSelector).first();
      if (element.length) { const paragraphs = this.paragraphs(element); return normalizeText(paragraphs.length ? paragraphs.join('\n\n') : element.text()); }
    }
    const article = this.clean('article').first();
    if (article.length) {
      const paragraphs = this.paragraphs(article);
      if (paragraphs.length >= 2) return normalizeText(paragraphs.join('\n\n'));
      const text = normalizeText(article.text()); if (text.length > 100) return text;
    }
    for (const selector of TEXT_SELECTORS) {
      const element = this.clean(selector).first();
      if (element.length) { const paragraphs = this.paragraphs(element); if (paragraphs.length) return normalizeText(paragraphs.join('\n\n')); }
    }
    return normalizeText(this.clean('p').toArray().map(element => normalizeText(this.clean(element).text())).filter(text => text.length > 35).join('\n\n'));
  }
  async extractLinks({ linkSelector, allowDomains, urlPattern, validate, maxLinks = 300 } = {}) {
    const links = [], seen = new Set(), checkedHosts = new Map();
    const cachedValidate = async (value, options) => {
      const parsed = parsePublicUrl(value); // Todos os caminhos mantêm validação sintática própria.
      if (!checkedHosts.has(parsed.hostname)) checkedHosts.set(parsed.hostname, (validate || assertPublicUrl)(value, options));
      return checkedHosts.get(parsed.hostname);
    };
    const regex = typeof urlPattern === 'string' ? new RegExp(urlPattern) : urlPattern;
    for (const element of this.raw(linkSelector || 'a[href]').toArray()) {
      const href = this.raw(element).attr('href'); if (!href) continue;
      let url; try { url = normalizeUrl(new URL(href, this.baseUrl).href); } catch { continue; }
      if (seen.has(url)) continue;
      seen.add(url);
      if (regex) { regex.lastIndex = 0; if (!regex.test(url)) continue; }
      const [safe] = await isSafeUrl(url, { allowDomains, validate: cachedValidate });
      if (safe) links.push(url);
      if (links.length >= maxLinks) break;
    }
    return links;
  }
}