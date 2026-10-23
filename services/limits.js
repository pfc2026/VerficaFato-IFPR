import { HttpError } from './errors.js';
// Limits both active work and queued work; no unbounded per-process request backlog.
export function createLimiter(concurrency = 3, maxQueue = 24) {
  let active = 0;
  const queue = [];
  function drain() {
    while (active < concurrency && queue.length) {
      const { task, resolve, reject } = queue.shift();
      active++;
      Promise.resolve().then(task).then(resolve, reject).finally(() => { active--; drain(); });
    }
  }
  return task => new Promise((resolve, reject) => {
    if (queue.length >= maxQueue) return reject(new HttpError(503, 'O serviço está ocupado. Tente novamente em instantes.', 'BUSY'));
    queue.push({ task, resolve, reject }); drain();
  });
}
export class TTLCache {
  constructor({ ttlMs = 300000, maxEntries = 300, now = Date.now } = {}) {
    this.ttlMs = ttlMs; this.maxEntries = maxEntries; this.now = now; this.items = new Map();
  }
  get(key) {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (item.expires <= this.now()) { this.items.delete(key); return undefined; }
    this.items.delete(key); this.items.set(key, item);
    return structuredClone(item.value);
  }
  set(key, value) {
    this.items.delete(key);
    while (this.items.size >= this.maxEntries) this.items.delete(this.items.keys().next().value);
    this.items.set(key, { value: structuredClone(value), expires: this.now() + this.ttlMs });
  }
}
