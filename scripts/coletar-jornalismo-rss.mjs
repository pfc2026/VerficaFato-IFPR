// Acrescenta exemplos de jornalismo profissional (títulos e resumos de feeds RSS públicos)
// ao data/treino-tf.json. Rode depois de scripts/coletar-treino-tf.mjs.
import { readFile, writeFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';

const FEEDS = [
  'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml',
  'https://agenciabrasil.ebc.com.br/rss/politica/feed.xml',
  'https://agenciabrasil.ebc.com.br/rss/economia/feed.xml',
  'https://agenciabrasil.ebc.com.br/rss/saude/feed.xml',
  'https://agenciabrasil.ebc.com.br/rss/geral/feed.xml',
  'https://agenciabrasil.ebc.com.br/rss/educacao/feed.xml',
  'https://agenciabrasil.ebc.com.br/rss/internacional/feed.xml',
  'https://agenciabrasil.ebc.com.br/rss/justica/feed.xml',
  'https://g1.globo.com/rss/g1/', 'https://g1.globo.com/rss/g1/pr/parana/', 'https://g1.globo.com/rss/g1/economia/',
  'https://g1.globo.com/rss/g1/politica/', 'https://g1.globo.com/rss/g1/ciencia-e-saude/', 'https://g1.globo.com/rss/g1/educacao/',
  'https://g1.globo.com/rss/g1/mundo/', 'https://g1.globo.com/rss/g1/tecnologia/', 'https://g1.globo.com/rss/g1/brasil/',
  'https://g1.globo.com/rss/g1/pr/oeste-sudoeste/', 'https://g1.globo.com/rss/g1/pr/norte-noroeste/', 'https://g1.globo.com/rss/g1/pr/campos-gerais-sul/',
  'https://www.camara.leg.br/noticias/rss/ultimas-noticias', 'https://www12.senado.leg.br/noticias/rss'
];
const file = new URL('../data/treino-tf.json', import.meta.url);
const data = JSON.parse(await readFile(file, 'utf8'));
const seen = new Set(data.exemplos.map(e => e.texto.toLowerCase()));
const seg = new Intl.Segmenter('pt-BR', { granularity: 'sentence' });
const norm = s => s.normalize('NFC').replace(/\s+/g, ' ').trim();
let added = 0;
for (const feed of FEEDS) {
  let xml;
  try {
    const r = await fetch(feed, { headers: { 'User-Agent': 'VerificaFato-IFPR/2.0 (pesquisa academica)' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) { console.error(feed, r.status); continue; }
    xml = await r.text();
  } catch (e) { console.error(feed, e.message); continue; }
  const $ = cheerio.load(xml, { xmlMode: true });
  const host = new URL(feed).hostname;
  $('item').each((_, item) => {
    const title = norm($(item).find('title').first().text());
    const desc = norm(cheerio.load($(item).find('description').first().text() || '').text());
    const pieces = [title, ...[...seg.segment(desc)].map(s => norm(s.segment))];
    for (const t of pieces) {
      if (t.length < 25 || t.length > 600 || seen.has(t.toLowerCase()) || /leia mais|assista|clique|v[ií]deo:/i.test(t)) continue;
      seen.add(t.toLowerCase());
      data.exemplos.push({ texto: t, rotulo: 1, origem: 'rss:' + host });
      added++;
    }
  });
}
data.fonte += ' + títulos e resumos de feeds RSS (Agência Brasil, g1, Câmara, Senado)';
await writeFile(file, JSON.stringify(data, null, 1));
console.log('jornalismo acrescentado', added, '| total', data.exemplos.length, '| verdadeiros', data.exemplos.filter(e => e.rotulo === 1).length);
