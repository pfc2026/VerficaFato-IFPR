import robotsParser from 'robots-parser';
import { setTimeout as delay } from 'node:timers/promises';
import { safeGet, assertPublicUrl } from '../services/safe-http.js';
import { DEFAULT_USER_AGENT } from './config.js';
import { isSafeUrl } from './validators.js';

const HTML_TYPES = /^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i;
export class RobotsChecker {
  constructor({ userAgent = DEFAULT_USER_AGENT, timeoutMs = 5000, request = safeGet } = {}) {
    this.userAgent = userAgent; this.timeoutMs = timeoutMs; this.request = request; this.cache = new Map();
  }
  async isAllowed(url, { allowDomains, signal } = {}) {
    const origin = new URL(url).origin;
    if (!this.cache.has(origin)) {
      const pending = (async () => {
        try {
          const robotsUrl = new URL('/robots.txt', origin).href;
          const response = await this.request(robotsUrl, { timeoutMs: this.timeoutMs, maxBytes: 256 * 1024, headers: { 'User-Agent': this.userAgent }, allowDomains, signal });
          if (response.status === 404 || response.status === 410) return { allow: true };
          if (response.status !== 200) return { allow: false };
          return { parser: robotsParser(robotsUrl, response.text) };
        } catch { return { allow: false }; }
      })();
      this.cache.set(origin, pending);
    }
    const policy = await this.cache.get(origin);
    return policy.parser ? policy.parser.isAllowed(url, this.userAgent) !== false : policy.allow;
  }
}

export class HttpCollector {
  constructor({ userAgent = DEFAULT_USER_AGENT, timeoutMs = 15000, maxRetries = 3, backoffFactorMs = 1000, request = safeGet, validate = assertPublicUrl, sleep = delay, random = Math.random, robotsChecker } = {}) {
    this.userAgent = userAgent; this.timeoutMs = timeoutMs; this.maxRetries = maxRetries; this.backoffFactorMs = backoffFactorMs;
    this.request = request; this.validate = validate; this.sleep = sleep; this.random = random;
    this.robotsChecker = robotsChecker || new RobotsChecker({ userAgent, request });
    this.controller = new AbortController();
  }
  async fetch(url, { allowDomains, respectRobots = true, signal } = {}) {
    const [safe, reason] = await isSafeUrl(url, { allowDomains, validate: this.validate });
    if (!safe) return [false, reason, 0, null];
    const effectiveSignal = signal ? AbortSignal.any([signal, this.controller.signal]) : this.controller.signal;
    if (effectiveSignal.aborted) return [false, 'Coleta cancelada.', 0, null];
    if (respectRobots && !await this.robotsChecker.isAllowed(url, { allowDomains, signal: effectiveSignal })) return [false, 'Acesso não autorizado ou robots.txt indisponível.', 403, null];
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      let retryAfter;
      try {
        const response = await this.request(url, { timeoutMs: this.timeoutMs, maxBytes: 2 * 1024 * 1024, allowDomains, signal: effectiveSignal, beforeRequest: async (target, hopSignal) => { if (respectRobots && !await this.robotsChecker.isAllowed(target.href, { allowDomains, signal: hopSignal })) throw new Error('Robots impede destino do redirecionamento.'); }, headers: { 'User-Agent': this.userAgent, Accept: 'text/html,application/xhtml+xml;q=0.9', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7' } });
        if (response.status === 200) {
          if (/noarchive|nosnippet/i.test(response.headers?.['x-robots-tag'] || '')) return [false, 'A fonte restringe o armazenamento do conteúdo.', 403, response.url];
          const contentType = response.headers?.['content-type'];
          if (contentType && !HTML_TYPES.test(contentType)) return [false, 'Resposta não contém um documento HTML.', response.status, response.url];
          return [true, response.text, 200, response.url];
        }
        if (response.status !== 429 && response.status < 500) return [false, `Resposta HTTP ${response.status}.`, response.status, response.url];
        if (attempt === this.maxRetries) return [false, `Limite de tentativas excedido (HTTP ${response.status}).`, response.status, response.url];
        const raw = response.headers?.['retry-after'];
        if (/^\d+$/.test(raw || '')) retryAfter = Math.min(Number(raw) * 1000, 30000);
        else if (raw && Number.isFinite(Date.parse(raw))) retryAfter = Math.max(0, Math.min(Date.parse(raw) - Date.now(), 30000));
      } catch {
        if (effectiveSignal.aborted) return [false, 'Coleta cancelada.', 0, null];
        if (attempt === this.maxRetries) return [false, 'Erro de conexão/timeout após tentativas limitadas.', 0, null];
      }
      try { await this.sleep(retryAfter ?? this.backoffFactorMs * 2 ** attempt + 100 + this.random() * 400, undefined, { signal: effectiveSignal }); }
      catch { return [false, 'Coleta cancelada.', 0, null]; }
    }
    return [false, 'Falha de coleta.', 0, null];
  }
  async close() { this.controller.abort(); }
}

/** Compatibilidade --selenium: renderização estática; JavaScript externo nunca é executado. */
export class SeleniumCollector {
  constructor({ userAgent = DEFAULT_USER_AGENT, headless = true, pageLoadTimeoutMs = 20000, request = safeGet, validate = assertPublicUrl, browserFactory } = {}) {
    this.userAgent = userAgent; this.headless = headless; this.pageLoadTimeoutMs = pageLoadTimeoutMs;
    this.request = request; this.validate = validate; this.browserFactory = browserFactory; this.browser = null;
    this.http = new HttpCollector({ userAgent, request, validate });
  }
  async ensureAvailable() {
    if (this.browser) return this.browser;
    try {
      const factory = this.browserFactory || (async () => { const { chromium } = await import('playwright'); return chromium.launch({ headless: this.headless, chromiumSandbox: true }); });
      this.browser = await factory();
      return this.browser;
    } catch {
      throw new Error('Renderização dinâmica solicitada: instale Playwright e Chromium (npm install --save-optional playwright; npx playwright install chromium), ou execute sem --selenium. O modo exige sandbox do navegador e interceptação de WebSockets.');
    }
  }
  async fetch(url, { waitSelector, waitTimeoutMs = 10000, allowDomains, signal } = {}) {
    const [safe, reason] = await isSafeUrl(url, { allowDomains, validate: this.validate });
    if (!safe) return [false, reason, null];
    let context;
    try {
      const browser = await this.ensureAvailable();
      const [ok, html, , finalUrl] = await this.http.fetch(url, { allowDomains, signal });
      if (!ok) return [false, html, null];
      context = await browser.newContext({ userAgent: this.userAgent, serviceWorkers: 'block', acceptDownloads: false, javaScriptEnabled: false });
      if (typeof context.routeWebSocket !== 'function') throw new Error('Versão do Playwright sem bloqueio de WebSocket.');
      await context.routeWebSocket('**/*', socket => socket.close());
      let requests = 0, bytes = Buffer.byteLength(html), servedInitial = false;
      await context.route('**/*', async route => {
        const request = route.request();
        if (request.method() !== 'GET' || !['document', 'stylesheet'].includes(request.resourceType()) || ++requests > 40 || signal?.aborted) { await route.abort(); return; }
        try {
          let response;
          if (!servedInitial && request.isNavigationRequest() && request.url() === finalUrl) {
            servedInitial = true; response = { status: 200, text: html, headers: { 'content-type': 'text/html; charset=utf-8' } };
          } else {
            if (!await this.http.robotsChecker.isAllowed(request.url(), { allowDomains, signal })) { await route.abort(); return; }
            response = await this.request(request.url(), { timeoutMs: 8000, maxBytes: 2 * 1024 * 1024, allowDomains, signal, beforeRequest: async (target, hopSignal) => { if (!await this.http.robotsChecker.isAllowed(target.href, { allowDomains, signal: hopSignal })) throw new Error('Robots impede recurso.'); }, headers: { 'User-Agent': this.userAgent } });
            bytes += Buffer.byteLength(response.text);
          }
          if (bytes > 8 * 1024 * 1024) { await route.abort(); return; }
          const headers = Object.fromEntries(Object.entries(response.headers || {}).filter(([key]) => !/^(?:content-encoding|content-length|transfer-encoding|connection|set-cookie)$/i.test(key)).map(([key, value]) => [key, String(value)]));
          await route.fulfill({ status: response.status, headers, body: response.text });
        } catch { await route.abort().catch(() => {}); }
      });
      await context.addInitScript(() => {
        // Bloqueia canais e workers que não pertencem à rota HTTP interceptada.
        for (const name of ['Worker', 'SharedWorker', 'WebSocket', 'EventSource', 'RTCPeerConnection', 'webkitRTCPeerConnection']) Object.defineProperty(globalThis, name, { configurable: false, writable: false, value: class { constructor() { throw new Error('Canal de rede desabilitado no coletor.'); } } });
      });
      const page = await context.newPage();
      const abort = () => context?.close().catch(() => {});
      signal?.addEventListener('abort', abort, { once: true });
      try {
        await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: this.pageLoadTimeoutMs });
        if (waitSelector) await page.locator(waitSelector).first().waitFor({ state: 'attached', timeout: waitTimeoutMs });
        const resultUrl = page.url();
        const [finalSafe] = await isSafeUrl(resultUrl, { allowDomains, validate: this.validate });
        if (!finalSafe) return [false, 'Navegação final bloqueada pela política de segurança.', null];
        const rendered = await page.content();
        if (Buffer.byteLength(rendered) > 2 * 1024 * 1024) return [false, 'HTML renderizado ultrapassa o limite de tamanho.', null];
        return [true, rendered, resultUrl];
      } finally { signal?.removeEventListener('abort', abort); }
    } catch (error) {
      return [false, error.message.startsWith('Renderização dinâmica') ? error.message : 'Falha na renderização dinâmica segura; conteúdo não coletado.', null];
    } finally { await context?.close().catch(() => {}); }
  }
  async close() { await this.http.close(); if (this.browser) { const browser = this.browser; this.browser = null; await browser.close(); } }
}