import { readFile } from 'node:fs/promises';
import { normalizeUrl } from './normalizers.js';
export class Deduplicator {
  constructor() { this.seenUrls = new Set(); this.seenHashes = new Set(); }
  isDuplicate(url, contentHash) { return this.seenUrls.has(normalizeUrl(url)) || !!(contentHash && this.seenHashes.has(contentHash)); }
  mark(url, contentHash) { if (url) this.seenUrls.add(normalizeUrl(url)); if (contentHash) this.seenHashes.add(contentHash); }
  async loadFromJsonl(filepath) {
    let contents;
    try { contents = await readFile(filepath, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
    let loaded = 0;
    for (const line of contents.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try { const record = JSON.parse(line); if (record?.url) { this.mark(record.url, record.content_hash); loaded++; } } catch { /* Uma linha quebrada não invalida as demais. */ }
    }
    return loaded;
  }
}