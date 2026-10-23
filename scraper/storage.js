import { mkdir, readFile, writeFile, appendFile, rename, unlink, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { MongoClient } from 'mongodb';
import { NewsItem } from './models.js';
import { Deduplicator } from './deduplicator.js';

export const CSV_FIELDS = ['titulo', 'data_publicacao', 'texto', 'url', 'fonte', 'coletado_em', 'content_hash'];
async function readOptional(filepath) { try { return await readFile(filepath, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return ''; throw error; } }
function recordFrom(value, location) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.url !== 'string' || typeof (value.titulo ?? value.title) !== 'string' || typeof (value.texto ?? value.text) !== 'string') throw new Error(`Registro inválido em ${location}; arquivo preservado.`);
  return value instanceof NewsItem ? value : NewsItem.fromRecord(value);
}
function unique(records) {
  const dedup = new Deduplicator(), result = [];
  for (const record of records) if (!dedup.isDuplicate(record.url, record.content_hash)) { result.push(record); dedup.mark(record.url, record.content_hash); }
  return result;
}
async function withLock(filepath, callback) {
  await mkdir(dirname(filepath), { recursive: true });
  const lockpath = `${filepath}.lock`;
  let lock;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { lock = await open(lockpath, 'wx'); break; }
    catch (error) { if (error.code !== 'EEXIST') throw error; await delay(50); }
  }
  if (!lock) throw new Error('Arquivo de saída ocupado; outro processo ou lock residual impede gravação.');
  try { return await callback(); }
  finally { await lock.close(); await unlink(lockpath).catch(() => {}); }
}
function csvCell(value) {
  let text = value == null ? '' : String(value);
  // Evita execução de fórmulas ao abrir os arquivos em programas de planilha.
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) { if (char === '"' && text[index + 1] === '"') { cell += '"'; index++; } else if (char === '"') quoted = false; else cell += char; }
    else if (char === '"' && !cell) quoted = true;
    else if (char === ';') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') { if (char === '\r' && text[index + 1] === '\n') index++; row.push(cell); if (row.some(value => value)) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (quoted) throw new Error('CSV existente está incompleto; arquivo preservado.');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const [headers, ...values] = rows;
  return values.map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

export class StorageManager {
  static async ensureDir(path) { await mkdir(path, { recursive: true }); return path; }
  static async loadRecords(paths) {
    const records = [];
    for (const filepath of Array.isArray(paths) ? paths : [paths]) {
      const text = await readOptional(filepath);
      if (!text.trim()) continue;
      let values;
      try { values = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error(`JSON inválido em ${filepath}; arquivo preservado.`); }
      if (!Array.isArray(values)) throw new Error(`JSON deve conter uma lista em ${filepath}; arquivo preservado.`);
      records.push(...values.map((value, index) => recordFrom(value, `${filepath}, registro ${index + 1}`)));
    }
    return unique(records);
  }
  static async importLegacyRecords(sourcePaths, destination) {
    const records = await this.loadRecords(sourcePaths);
    return this.exportJson(records, destination);
  }
  static async exportJson(records, filepath) {
    if (!records.length) return 0;
    return withLock(filepath, async () => {
      const existing = await this.loadRecords(filepath), dedup = new Deduplicator();
      for (const record of existing) dedup.mark(record.url, record.content_hash);
      let added = 0;
      for (const value of records) {
        const record = recordFrom(value, 'novos registros');
        if (!dedup.isDuplicate(record.url, record.content_hash)) { existing.push(record); dedup.mark(record.url, record.content_hash); added++; }
      }
      const temporary = `${filepath}.${randomUUID()}.tmp`;
      try { await writeFile(temporary, JSON.stringify(existing, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' }); await rename(temporary, filepath); }
      finally { await unlink(temporary).catch(() => {}); }
      return added;
    });
  }
  static async exportJsonl(records, filepath) {
    if (!records.length) return 0;
    return withLock(filepath, async () => {
      const contents = await readOptional(filepath), dedup = new Deduplicator();
      for (const line of contents.split(/\r?\n/)) {
        if (!line.trim()) continue;
        let value; try { value = JSON.parse(line); } catch { throw new Error('JSONL existente está inválido; arquivo preservado.'); }
        const record = recordFrom(value, filepath); dedup.mark(record.url, record.content_hash);
      }
      const added = [];
      for (const value of records) { const record = recordFrom(value, 'novos registros'); if (!dedup.isDuplicate(record.url, record.content_hash)) { added.push(record); dedup.mark(record.url, record.content_hash); } }
      if (added.length) await appendFile(filepath, `${contents && !contents.endsWith('\n') ? '\n' : ''}${added.map(record => JSON.stringify(record)).join('\n')}\n`, 'utf8');
      return added.length;
    });
  }
  static async exportCsv(records, filepath) {
    if (!records.length) return 0;
    return withLock(filepath, async () => {
      const contents = await readOptional(filepath), dedup = new Deduplicator();
      for (const value of parseCsv(contents)) { const record = recordFrom(value, filepath); dedup.mark(record.url, record.content_hash); }
      // Um cabeçalho legado inglês não pode receber linhas em outra ordem.
      if (contents && contents.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] !== CSV_FIELDS.join(';')) throw new Error('CSV legado possui outro cabeçalho; exporte para novo destino e preserve o original.');
      const added = [];
      for (const value of records) { const record = recordFrom(value, 'novos registros'); if (!dedup.isDuplicate(record.url, record.content_hash)) { added.push(record); dedup.mark(record.url, record.content_hash); } }
      if (added.length) {
        const header = contents ? (/[\r\n]$/.test(contents) ? '' : '\r\n') : `\uFEFF${CSV_FIELDS.join(';')}\r\n`;
        await appendFile(filepath, header + added.map(record => CSV_FIELDS.map(key => csvCell(record[key])).join(';')).join('\r\n') + '\r\n', 'utf8');
      }
      return added.length;
    });
  }
  static async saveToMongodb(records, { mongoUri, dbName = 'verificafato', collectionName = 'noticias_coletadas', clientFactory = uri => new MongoClient(uri, { serverSelectionTimeoutMS: 5000 }) } = {}) {
    if (!records.length || !mongoUri) return [0, 0];
    const client = clientFactory(mongoUri);
    try {
      await client.connect();
      const collection = client.db(dbName).collection(collectionName);
      await collection.createIndex({ url: 1 }, { unique: true });
      await collection.createIndex({ content_hash: 1 });
      await collection.createIndex({ fonte: 1 });
      await collection.createIndex({ coletado_em: 1 });
      const items = unique(records.map(value => recordFrom(value, 'MongoDB')));
      const result = await collection.bulkWrite(items.map(item => ({ updateOne: { filter: { url: item.url }, update: { $setOnInsert: item.toDict() }, upsert: true } })), { ordered: false });
      return [result.upsertedCount, items.length - result.upsertedCount];
    } finally { await client.close(); }
  }
}