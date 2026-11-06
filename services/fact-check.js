import { createHash } from 'node:crypto';
import { TTLCache, createLimiter } from './limits.js';
import { queryVariants, keywordQuery } from './claims.js';
const ENDPOINT = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
const cache = new TTLCache({ ttlMs: 10 * 60 * 1000, maxEntries: 500 });
const limit = createLimiter(3, 30);
const pending = new Map();
function safeReviewUrl(value) {
  try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function formatReviews(data) {
  const results = [];
  for (const claim of Array.isArray(data?.claims) ? data.claims.slice(0,10) : []) {
    if (typeof claim.text !== 'string' || !claim.text || claim.text.length > 5000) continue;
    for (const review of Array.isArray(claim.claimReview) ? claim.claimReview.slice(0,10) : []) {
      const url = safeReviewUrl(review.url);
      if (!url || typeof review.textualRating !== 'string' || !review.publisher?.name) continue;
      const str = (v, size = 1000) => typeof v === 'string' ? v.slice(0,size) : '';
      results.push({
        id: 'e' + createHash('sha256').update(url + '|' + claim.text + '|' + review.textualRating).digest('hex').slice(0,16),
        texto_verificado: claim.text, autor_alegacao: str(claim.claimant),
        data_alegacao: str(claim.claimDate), verificador: str(review.publisher.name,200),
        dominio_verificador: str(review.publisher.site,200), titulo_verificacao: str(review.title),
        avaliacao: str(review.textualRating,200), url_verificacao: url,
        data_verificacao: str(review.reviewDate,50), idioma: str(review.languageCode,30)
      });
    }
  }
  return results;
}
async function boundedJson(response, maxBytes = 512000) {
  const announced = Number(response.headers.get('content-length'));
  if (announced > maxBytes) throw new Error('TOO_LARGE');
  if (!response.body) throw new Error('EMPTY_BODY');
  const chunks = []; let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > maxBytes) { await response.body.cancel?.().catch(() => {}); throw new Error('TOO_LARGE'); }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export { boundedJson };
export function createFactChecker({ apiKey = process.env.GOOGLE_API_KEY, fetchImpl = fetch, cacheStore = cache, run = limit } = {}) {
  async function search(query, signal) {
    const key = createHash('sha256').update((apiKey || '') + '|pt-BR|' + query).digest('hex');
    const cached = cacheStore.get(key);
    if (cached) return cached;
    if (!signal && pending.has(key)) return pending.get(key);
    const task = run(async () => {
      signal?.throwIfAborted();
      const params = new URLSearchParams({ query, languageCode: 'pt-BR', pageSize:'10' });
      // API key stays in a header, never in URL/log/error bodies.
      const response = await fetchImpl(ENDPOINT + '?' + params, { headers: { 'X-Goog-Api-Key': apiKey, Accept:'application/json' }, redirect:'error', signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(6000)]) : AbortSignal.timeout(6000) });
      if (!response.ok) {
        await response.body?.cancel?.();
        const err = new Error(response.status === 429 ? 'QUOTA' : 'UNAVAILABLE');
        err.code = response.status === 429 ? 'quota' : response.status === 401 || response.status === 403 ? 'configuracao' : 'indisponivel';
        throw err;
      }
      const reviews = formatReviews(await boundedJson(response));
      cacheStore.set(key, reviews);
      return reviews;
    });
    if (!signal) pending.set(key,task);
    try { return await task; } finally { if (!signal) pending.delete(key); }
  }
  return async function verificarNoticia(texto,{signal}={}) {
    if (!apiKey) return { encontrados:false,quantidade:0,resultados:[],apiDisponivel:false,estrategia:'não configurada',erroAPI:'Consulta Google não configurada no servidor.', status:'nao_configurada' };
    const results = new Map(); let errorCode = '', successful = 0;
    for (const query of queryVariants(texto)) {
      if (signal?.aborted) break;
      try { for (const review of await search(query,signal)) results.set(review.id,review); successful++; }
      catch (error) { errorCode = error.code || 'indisponivel'; break; }
    }
    const resultados = [...results.values()].slice(0,30);
    return { encontrados:resultados.length > 0,quantidade:resultados.length,resultados,apiDisponivel:!errorCode,
      estrategia:'afirmação e variações lexicais',palavrasChaveUsadas:keywordQuery(texto),
      status:errorCode || 'ok',erroAPI:errorCode ? (errorCode === 'quota' ? 'O limite da consulta Google foi atingido.' : 'A consulta Google está indisponível. A ausência de resultados não permite concluir a veracidade.') : undefined,
      consultasConcluidas:successful };
  };
}
export const verificarNoticia = (texto,options) => createFactChecker()(texto,options);
