// Monta o conjunto de treino do modelo TensorFlow de padrões de linguagem.
// Classe 0 (desinformação): alegações que agências de checagem classificaram como falsas,
//   obtidas pela Google Fact Check Tools API (mesma chave do servidor).
// Classe 1 (jornalismo): frases de reportagens reais do acervo regional (data/noticias.json)
//   e alegações classificadas como verdadeiras pelas agências.
// Uso: node scripts/coletar-treino-tf.mjs  -> grava data/treino-tf.json
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';

const KEY = process.env.GOOGLE_API_KEY;
if (!KEY) { console.error('GOOGLE_API_KEY não configurada.'); process.exit(1); }
const ENDPOINT = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
const TOPICS = ['vacina','covid','urna','eleição','lula','bolsonaro','STF','pix','imposto','INSS','aposentadoria','auxílio',
  'Bolsa Família','gasolina','Petrobras','dengue','câncer','cura','chip','5G','terra plana','clima','enchente','Rio Grande do Sul',
  'Paraná','Curitiba','escola','MEC','Enem','salário mínimo','desemprego','PIB','inflação','dólar','Banco Central','polícia',
  'crime','facção','presídio','aborto','igreja','ONU','China','Israel','Ucrânia','Estados Unidos','Trump','Moraes','Anvisa',
  'Ministério da Saúde','SUS','hospital','remédio','ivermectina','cloroquina','máscara','gripe','sarampo','vacinação infantil',
  'agrotóxico','Amazônia','desmatamento','queimadas','indígenas','MST','reforma tributária','Receita Federal','CPF','golpe',
  'WhatsApp','Instagram','TikTok','inteligência artificial','deepfake','vídeo','foto','áudio','censura','fake news',
  'Copa','futebol','Neymar','Globo','jornalista','prefeito','governador','deputado','senador','Câmara','Senado'];

const falseRe = /\b(falso|fals[ao]|fake|mentira|enganoso|engan|distorcido|fora de contexto|sem contexto|exagerad|insustent|n[aã]o [eé] verdade|incorreto|errado|boato|montagem|adulterad|manipulad|sem comprova|n[aã]o procede)/i;
const trueRe = /^(verdadeiro|verdade|correto|true|[eé] verdade|confirmado|procede|fato)\b/i;

async function search(query, pageToken) {
  const params = new URLSearchParams({ query, languageCode: 'pt-BR', pageSize: '50' });
  if (pageToken) params.set('pageToken', pageToken);
  const r = await fetch(ENDPOINT + '?' + params, { headers: { 'X-Goog-Api-Key': KEY } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const seen = new Set(), rows = [];
const norm = s => s.normalize('NFC').replace(/\s+/g, ' ').trim();
for (const topic of TOPICS) {
  let token;
  for (let page = 0; page < 3; page++) {
    let data;
    try { data = await search(topic, token); } catch (e) { console.error(topic, e.message); break; }
    for (const c of data.claims || []) {
      const text = norm(c.text || '');
      if (text.length < 20 || text.length > 600 || seen.has(text.toLowerCase())) continue;
      const ratings = (c.claimReview || []).map(r => String(r.textualRating || '').trim()).filter(Boolean);
      if (!ratings.length) continue;
      const isTrue = ratings.every(r => trueRe.test(r));
      const isFalse = ratings.every(r => falseRe.test(r) && !trueRe.test(r));
      if (!isTrue && !isFalse) continue;
      seen.add(text.toLowerCase());
      rows.push({ texto: text, rotulo: isTrue ? 1 : 0, origem: 'factcheck', avaliacao: ratings[0].slice(0, 60) });
    }
    token = data.nextPageToken;
    if (!token) break;
  }
}
// Frases de reportagens do acervo (jornalismo profissional publicado).
const news = JSON.parse(await readFile(new URL('../data/noticias.json', import.meta.url), 'utf8'));
const seg = new Intl.Segmenter('pt-BR', { granularity: 'sentence' });
for (const n of news) {
  for (const block of String(n.texto || '').split(/\n+/)) {
    for (const { segment } of seg.segment(block)) {
      const text = norm(segment);
      if (text.length < 40 || text.length > 600 || seen.has(text.toLowerCase())) continue;
      if (/siga o g1|leia mais|inscrever|conta globo|v[ií]deos:|foto:|^por /i.test(text)) continue;
      seen.add(text.toLowerCase());
      rows.push({ texto: text, rotulo: 1, origem: 'acervo:' + (n.fonte || 'jornal') });
    }
  }
  const title = norm(String(n.titulo || ''));
  if (title.length >= 20 && !seen.has(title.toLowerCase())) { seen.add(title.toLowerCase()); rows.push({ texto: title, rotulo: 1, origem: 'acervo:' + (n.fonte || 'jornal') }); }
}
const count = l => rows.filter(r => r.rotulo === l).length;
console.log(`total ${rows.length} | desinformação ${count(0)} | jornalismo/verdadeiro ${count(1)} | verdadeiras do Fact Check ${rows.filter(r => r.rotulo === 1 && r.origem === 'factcheck').length}`);
await writeFile(new URL('../data/treino-tf.json', import.meta.url), JSON.stringify({ geradoEm: new Date().toISOString(), fonte: 'Google Fact Check Tools API (classificações das agências) + acervo data/noticias.json', exemplos: rows }, null, 1));
