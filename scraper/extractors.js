import { load } from 'cheerio';
import { normalizeText, normalizeUrl, parseAndNormalizeDate } from './normalizers.js';
import { isSafeUrl } from './validators.js';
import { parsePublicUrl, assertPublicUrl } from '../services/safe-http.js';

const REMOVE_TAGS = 'script,style,noscript,iframe,nav,header,footer,aside,form,button,[role="navigation"],[role="complementary"]';
const REMOVE_ATTRIBUTES = /cookie|comentario|compartilh|social-share|publicidade|banner|relacionad|sidebar|widget|anuncio|recommend|related|newsletter|read[-_]?more|more[-_]?stories|most[-_]?read|mais[-_]?lidas|recircul|outbrain|taboola|teads|feed[-_]?post/i;
const DATE_SELECTORS = ['.posted-on', '.entry-date', '.data-publicacao', '.post-date', '.data', "[itemprop='datePublished']"];
const TEXT_SELECTORS = [
  '[itemprop="articleBody"]', '.article-body', '.article__body', '.article-content',
  '.news-body', '.news-content', '.mc-body', '.c-body', '.entry-content',
  '.noticia-texto', '.post-content', '.content-text', '#materia-conteudo'
];

export class NewsExtractor {
  constructor(html, baseUrl) {
    this.baseUrl = baseUrl;
    this.raw = load(typeof html === 'string' ? html : '');
    this.clean = load(this.raw.html());
    this.clean(REMOVE_TAGS).remove();
    this.clean('[class],[id],[aria-label],[data-component],[data-testid]').filter((_, element) =>
      REMOVE_ATTRIBUTES.test(['class', 'id', 'aria-label', 'data-component', 'data-testid'].map(name => this.clean(element).attr(name) || '').join(' '))
    ).remove();
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
    // A paragraph in a linked recommendation is a headline, not article prose.
    return element.find('p').toArray().filter(p => {
      const paragraph = this.clean(p);
      const text = normalizeText(paragraph.text());
      const links = normalizeText(paragraph.find('a').text());
      return !paragraph.closest('a, article article').length && (!links || links.length < text.length * 0.8);
    }).map(p => normalizeText(this.clean(p).text())).filter(text => text.length > minimum);
  }
  extractText(customSelector) {
    const prose = element => normalizeText(this.paragraphs(element).join('\n\n'));
    const bodyText = element => element.find('p').length ? prose(element) : normalizeText(element.text());
    const selectBody = element => {
      for (const selector of TEXT_SELECTORS) {
        const bodies = element.find(selector).add(element.filter(selector)).toArray();
        for (const body of bodies) {
          const text = bodyText(this.clean(body));
          if (text.length >= 30) return text;
        }
      }
      return prose(element);
    };
    if (customSelector) {
      const element = this.clean(customSelector).first();
      if (element.length) {
        const text = selectBody(element);
        if (text) return text;
      }
    }
    const articles = this.clean('article').filter((_, element) => !this.clean(element).parents('article').length).toArray();
    const primary = articles.find(element => this.clean(element).find('h1').length) || (articles.length === 1 ? articles[0] : null);
    if (primary) {
      // Scope body selectors to the primary story before considering any
      // document-wide container: a preceding story card can reuse the classes.
      const text = selectBody(this.clean(primary));
      if (text.length >= 30) return text;
    } else {
      // Explicit containers also support sites without semantic article tags.
      // Bodies inside multiple unidentifiable article cards are not candidates.
      for (const selector of TEXT_SELECTORS) {
        for (const body of this.clean(selector).toArray()) {
          if (this.clean(body).parents('article').length) continue;
          const text = bodyText(this.clean(body));
          if (text.length >= 30) return text;
        }
      }
    }
    // Some public news pages render the body only in structured metadata.
    const title = this.extractTitle();
    const bodies = this.extractJsonLd().filter(record => typeof record.articleBody === 'string' && record.articleBody.trim());
    const matchesUrl = record => {
      const page = record.mainEntityOfPage;
      const urls = [record.url, record['@id'], typeof page === 'string' ? page : page?.['@id']];
      return urls.some(value => typeof value === 'string' && normalizeUrl(value) === normalizeUrl(this.baseUrl));
    };
    const matchingBody = bodies.find(record => normalizeText(record.headline) === title || matchesUrl(record)) ||
      (bodies.length === 1 && (!title || !bodies[0].headline) ? bodies[0] : null);
    if (matchingBody) {
      const body = load(matchingBody.articleBody);
      body(REMOVE_TAGS).remove();
      const text = normalizeText(body('p').length ? body('p').toArray().map(element => body(element).text()).join('\n\n') : body('body').text());
      if (text.length >= 30) return text;
    }
    // Do not concatenate every paragraph on the page. If no bounded body can
    // be identified, the caller asks the reader to paste the original text.
    return '';
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
