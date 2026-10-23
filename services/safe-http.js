import http from 'node:http';
import https from 'node:https';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { HttpError } from './errors.js';

export function isPublicAddress(address) {
  try {
    const ip = ipaddr.parse(address);
    if (ip.kind() === 'ipv6') {
      if (ip.isIPv4MappedAddress()) return false;
      // Only global unicast. Block transition/tunneling and special-purpose ranges.
      if (!ip.match(ipaddr.parse('2000::'), 3) || ip.range() !== 'unicast') return false;
      return !['2001::/23','2002::/16','3fff::/20'].some(range => ip.match(ipaddr.parseCIDR(range)));
    }
    if (ip.range() !== 'unicast') return false;
    return !['192.0.0.0/24','192.0.2.0/24','198.51.100.0/24','203.0.113.0/24','198.18.0.0/15','192.88.99.0/24'].some(range => ip.match(ipaddr.parseCIDR(range)));
  } catch { return false; }
}
export function parsePublicUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new HttpError(400, 'Informe uma URL HTTP ou HTTPS válida.', 'INVALID_URL'); }
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !['80','443'].includes(url.port)) || url.href.length > 2048) {
    throw new HttpError(400, 'URL, porta ou credenciais não permitidas.', 'INVALID_URL');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host || host === 'localhost' || /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|onion)$/.test(host) ||
      (!host.includes('.') && !isIP(host)) || (isIP(host) && !isPublicAddress(host))) {
    throw new HttpError(400, 'O endereço informado não é público.', 'SSRF_BLOCKED');
  }
  url.hash = '';
  return url;
}
export async function assertPublicUrl(input, { lookup = dnsLookup, signal = AbortSignal.timeout(3000) } = {}) {
  const url = parsePublicUrl(input);
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  let addresses;
  if (isIP(hostname)) addresses = [{ address: hostname, family: isIP(hostname) }];
  else {
    const dnsTask = lookup(hostname, { all: true, verbatim: true });
    let abortHandler;
    try {
      addresses = await (signal ? Promise.race([dnsTask, new Promise((_, reject) => {
        abortHandler = () => reject(new HttpError(504, 'O endereço demorou demais para responder.', 'TIMEOUT'));
        if (signal.aborted) abortHandler(); else signal.addEventListener('abort', abortHandler, { once: true });
      })]) : dnsTask);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(422, 'Não foi possível resolver o endereço da página.', 'DNS_ERROR');
    } finally { if (abortHandler) signal.removeEventListener('abort', abortHandler); }
  }
  if (!Array.isArray(addresses) || !addresses.length || addresses.some(a => !isPublicAddress(a.address))) {
    throw new HttpError(400, 'O destino resolve para um endereço interno ou reservado.', 'SSRF_BLOCKED');
  }
  return { url, addresses };
}
function permittedHost(host, domains) {
  return !domains || domains.some(domain => host === domain.toLowerCase() || host.endsWith('.' + domain.toLowerCase()));
}
export async function safeGet(input, {
  timeoutMs = 8000, maxBytes = 2 * 1024 * 1024, maxRedirects = 3, headers = {},
  allowDomains, signal: parentSignal, lookup = dnsLookup, beforeRequest, requestFn
} = {}) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = parentSignal ? AbortSignal.any([parentSignal, timeout]) : timeout;
  let current = input;
  try {
    for (let redirects = 0; redirects <= maxRedirects; redirects++) {
      const { url, addresses } = await assertPublicUrl(current, { lookup, signal });
      if (!permittedHost(url.hostname, allowDomains)) throw new HttpError(400, 'Destino fora dos domínios permitidos.', 'DOMAIN_BLOCKED');
      if (beforeRequest) await beforeRequest(url, signal);
      const response = await new Promise((resolve, reject) => {
        let settled = false;
        const fail = err => { if (!settled) { settled = true; reject(err); } };
        const transport = url.protocol === 'https:' ? https : http;
        const request = (requestFn || transport.request.bind(transport))(url, {
          method: 'GET', agent: false, signal, maxHeaderSize: 16384,
          headers: { 'User-Agent': 'VerificaFato/2.0', Accept: 'text/html,application/xhtml+xml', ...headers, 'Accept-Encoding': 'identity' },
          // DNS is pinned to the already validated answers; connection never re-resolves the host.
          lookup(_host, options, callback) {
            if (options?.all) callback(null, addresses);
            else callback(null, addresses[0].address, addresses[0].family);
          }
        }, res => {
          if (res.statusCode >= 300 && res.statusCode < 400) {
            const location = res.headers.location;
            res.destroy();
            settled = true; resolve({ status: res.statusCode, headers: res.headers, location, text: '', url: url.href });
            return;
          }
          const length = Number(res.headers['content-length']);
          if (Number.isFinite(length) && length > maxBytes) { res.destroy(); return fail(new HttpError(422, 'A página excede o tamanho permitido.', 'RESPONSE_TOO_LARGE')); }
          if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') {
            res.destroy(); return fail(new HttpError(422, 'A página enviou uma codificação não suportada.', 'ENCODING_BLOCKED'));
          }
          let bytes = 0; const chunks = [];
          res.on('data', chunk => {
            bytes += chunk.length;
            if (bytes > maxBytes) { res.destroy(); fail(new HttpError(422, 'A página excede o tamanho permitido.', 'RESPONSE_TOO_LARGE')); }
            else chunks.push(chunk);
          });
          res.on('end', () => {
            if (settled) return;
            settled = true; resolve({ url: url.href, status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') });
          });
          res.on('error', fail);
          res.on('aborted', () => fail(new HttpError(422, 'A página interrompeu a resposta.', 'RESPONSE_ABORTED')));
        });
        request.on('error', fail);
        request.end();
      });
      if (response.status >= 300 && response.status < 400) {
        if (!response.location || redirects === maxRedirects) throw new HttpError(422, 'Redirecionamentos excessivos ou inválidos.', 'REDIRECT_BLOCKED');
        const next = new URL(response.location, url);
        if (url.protocol === 'https:' && next.protocol !== 'https:') throw new HttpError(400, 'Redirecionamento inseguro bloqueado.', 'REDIRECT_BLOCKED');
        current = next.href;
        continue;
      }
      return response;
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (signal.aborted) throw new HttpError(504, 'A consulta demorou demais. Cole o texto da notícia para analisar.', 'TIMEOUT');
    throw new HttpError(422, 'Não foi possível acessar a página. Cole o texto da notícia.', 'FETCH_FAILED');
  }
}
