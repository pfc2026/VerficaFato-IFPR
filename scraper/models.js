import { createHash } from 'node:crypto';
import { normalizeText, normalizeUrl, parseAndNormalizeDate } from './normalizers.js';

export class NewsItem {
  constructor(record) { Object.assign(this, record); Object.freeze(this); }
  static computeContentHash(titulo, texto) {
    return createHash('sha256').update(`${String(titulo).trim().toLowerCase()}|${String(texto).trim().toLowerCase()}`, 'utf8').digest('hex');
  }
  static build({ titulo = '', texto = '', data_publicacao = null, url = '', fonte = '', coletado_em, content_hash } = {}) {
    titulo = normalizeText(titulo); texto = normalizeText(texto);
    return new NewsItem({ titulo, texto, data_publicacao: parseAndNormalizeDate(data_publicacao), url: normalizeUrl(url), fonte: normalizeText(fonte), coletado_em: coletado_em || new Date().toISOString(), content_hash: /^[a-f0-9]{64}$/.test(content_hash || '') ? content_hash : this.computeContentHash(titulo, texto) });
  }
  static fromRecord(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('Registro de notícia inválido.');
    return this.build({ titulo: record.titulo ?? record.title, texto: record.texto ?? record.text, data_publicacao: record.data_publicacao ?? record.date ?? null, url: record.url, fonte: record.fonte ?? record.source, coletado_em: record.coletado_em ?? record.collected_at, content_hash: record.content_hash });
  }
  get title() { return this.titulo; }
  get text() { return this.texto; }
  get date() { return this.data_publicacao; }
  get source() { return this.fonte; }
  get collected_at() { return this.coletado_em; }
  toDict() { return { titulo: this.titulo, data_publicacao: this.data_publicacao, texto: this.texto, url: this.url, fonte: this.fonte, coletado_em: this.coletado_em, content_hash: this.content_hash }; }
  toJSON() { return this.toDict(); }
}