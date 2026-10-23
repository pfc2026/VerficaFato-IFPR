import { assertPublicUrl } from '../services/safe-http.js';
import { NewsItem } from './models.js';
import { parseAndNormalizeDate } from './normalizers.js';

export function isAllowedDomain(hostname, domains) {
  if (!domains?.length) return true;
  hostname = hostname.toLowerCase().replace(/\.$/, '');
  return domains.some(domain => { domain = String(domain).toLowerCase().replace(/^\.+|\.$/g, ''); return !!domain && (hostname === domain || hostname.endsWith(`.${domain}`)); });
}
export async function isSafeUrl(value, { allowDomains, validate = assertPublicUrl, lookup, signal = AbortSignal.timeout(5000) } = {}) {
  if (typeof value !== 'string' || !value.trim()) return [false, 'URL vazia ou com tipo inválido.'];
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return [false, 'Apenas HTTP e HTTPS são permitidos.'];
    if (url.username || url.password) return [false, 'URLs com credenciais não são permitidas.'];
    if (!isAllowedDomain(url.hostname, allowDomains)) return [false, 'Domínio não consta na lista de domínios autorizados.'];
    await validate(url.href, { lookup, signal });
    return [true, null];
  } catch { return [false, 'URL inválida, privada ou não resolvida pela política de segurança.']; }
}
export async function validateNewsItem(item, { minTitleLength = 5, minTextLength = 40, allowDomains, validate = assertPublicUrl } = {}) {
  if (!(item instanceof NewsItem)) return [false, 'Objeto não é uma instância de NewsItem.'];
  if (typeof item.titulo !== 'string' || item.titulo.trim().length < minTitleLength) return [false, 'Título ausente ou muito curto.'];
  if (typeof item.texto !== 'string' || item.texto.trim().length < minTextLength) return [false, 'Texto ausente ou insuficiente.'];
  const [safe, reason] = await isSafeUrl(item.url, { allowDomains, validate });
  if (!safe) return [false, reason];
  if (typeof item.fonte !== 'string' || !item.fonte.trim()) return [false, 'Identificador da fonte ausente.'];
  if (!/^[a-f0-9]{64}$/.test(item.content_hash)) return [false, 'Hash de conteúdo deve ser SHA-256.'];
  if (item.data_publicacao !== null && !parseAndNormalizeDate(item.data_publicacao)) return [false, 'Data de publicação inválida.'];
  if (typeof item.coletado_em !== 'string' || !parseAndNormalizeDate(item.coletado_em)) return [false, 'Timestamp de coleta inválido.'];
  return [true, null];
}