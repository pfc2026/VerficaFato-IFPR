import robotsParser from 'robots-parser';
import { load } from 'cheerio';
import { safeGet, parsePublicUrl } from './safe-http.js';
import { HttpError } from './errors.js';
import { TTLCache } from './limits.js';
const robotsCache = new TTLCache({ ttlMs: 300000, maxEntries: 100 });
const agent = 'VerificaFato';
export async function obterConteudoDaUrl(input, { get = safeGet, signal } = {}) {
  const initial = parsePublicUrl(input);
  async function respectRobots(url, signal) {
    let rules = robotsCache.get(url.origin);
    if (!rules) {
      const result = await get(new URL('/robots.txt', url).href, {
        timeoutMs: 3000, maxBytes: 65536, maxRedirects: 2, allowDomains: [url.hostname],
        headers: { Accept: 'text/plain' }, signal
      });
      if ([401,403].includes(result.status)) throw new HttpError(422, 'O site restringe o acesso automatizado. Cole o texto.', 'ACCESS_RESTRICTED');
      if (result.status !== 404 && result.status !== 410 && result.status !== 200) throw new HttpError(422, 'Não foi possível confirmar as regras de acesso do site. Cole o texto.', 'ROBOTS_UNAVAILABLE');
      rules = { content: result.status === 200 ? result.text : '' };
      robotsCache.set(url.origin, rules);
    }
    if (robotsParser(new URL('/robots.txt', url).href, rules.content).isAllowed(url.href, agent) === false) {
      throw new HttpError(422, 'O site não permite a coleta desta página. Cole o texto.', 'ROBOTS_DENIED');
    }
  }
  const response = await get(initial.href, { beforeRequest: respectRobots, timeoutMs: 10000, signal });
  if (response.status !== 200) throw new HttpError(422, 'O site restringiu ou não disponibilizou a notícia. Cole o texto.', 'PAGE_UNAVAILABLE');
  if (!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers['content-type'] || '')) {
    throw new HttpError(422, 'O endereço precisa apontar para uma página HTML de notícia.', 'INVALID_CONTENT_TYPE');
  }
  const $ = load(response.text);
  // noarchive/nosnippet describe search-result presentation, not access to
  // this public HTML for an on-demand analysis. Crawling permissions are
  // checked through robots.txt before every request, including redirects.
  // https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
  // Preserve article structure and JSON-LD extraction in the shared migrated collector.
  const { NewsExtractor } = await import('../scraper/extractors.js');
  const extractor = NewsExtractor.fromHtml(response.text, response.url);
  const titulo = extractor.extractTitle() || '';
  const texto = extractor.extractText() || '';
  if (texto.length < 30) throw new HttpError(422, 'Não foi possível obter a notícia completa. Cole o texto.', 'EMPTY_ARTICLE');
  if (texto.length > 20000) throw new HttpError(422, 'A notícia excede 20.000 caracteres. Cole um trecho menor.', 'CONTENT_TOO_LONG');
  return { url: response.url, titulo, descricao: $('meta[name="description"]').attr('content')?.slice(0,1000) || '', texto, data_publicacao: extractor.extractDate(), conteudoObtido: true };
}
