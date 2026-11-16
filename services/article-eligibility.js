import { createHash } from 'node:crypto';
import { parsePublicUrl } from './safe-http.js';

export function articleContentHash(record) {
  return createHash('sha256').update(`${String(record?.titulo || '').trim().toLowerCase()}|${String(record?.texto || '').trim().toLowerCase()}`, 'utf8').digest('hex');
}

export function articleIneligibility(record, { requireReview = true } = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return 'registro_invalido';
  if (record.revisao?.estado === 'quarentena' || record.quarentena) return 'quarentena';
  if (typeof record.titulo !== 'string' || record.titulo.trim().length < 5 || typeof record.texto !== 'string' || record.texto.trim().length < 40 || typeof record.fonte !== 'string' || !record.fonte.trim()) return 'conteudo_invalido';
  let url;
  try { url = parsePublicUrl(record.url); } catch { return 'url_invalida'; }
  let path;
  try { path = decodeURI(url.pathname).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\/+$/, ''); }
  catch { return 'url_invalida'; }
  // These identify the audited initialization seed and listing routes, not
  // legitimate reporting which happens to discuss a "teste".
  if ((url.hostname === 'g1.globo.com' && path === '/pr/teste-inicial') ||
      (record.titulo === 'Notícia Teste de Inicialização' && record.texto === 'Texto longo o suficiente para passar no validador do VerificaFato.')) return 'semente_sintetica_auditada';
  if (!path || /\/(?:empregos|ultimas-noticias|noticias|categoria|category|tag|tags)$/.test(path) || /\/(?:categoria|category|tag|tags)\//.test(path)) return 'pagina_generica_ou_listagem';
  if (!requireReview) return null;
  const provenance = record.proveniencia, review = record.revisao;
  const hash = articleContentHash(record);
  if (!provenance || provenance.tipo !== 'artigo' || provenance.urlOrigem !== url.href || provenance.content_hash !== hash || record.content_hash !== hash ||
      !['revisao_documentada', 'extracao_artigo'].includes(provenance.metodo)) return 'proveniencia_nao_validada';
  if (!review || review.estado !== 'aprovado' || review.content_hash !== hash || review.url !== url.href ||
      typeof review.referencia !== 'string' || !review.referencia.trim() || typeof review.em !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(review.em)) return 'revisao_pendente_ou_invalida';
  return null;
}

export const isEligibleArticle = record => articleIneligibility(record) === null;

// Collection and import may retain a structurally valid pending article, but
// they cannot automatically promote it to a reviewed context reference.
export const isAcceptableArchiveRecord = record => articleIneligibility(record, { requireReview: false }) === null;
