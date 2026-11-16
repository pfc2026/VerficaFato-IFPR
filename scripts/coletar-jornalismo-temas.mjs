// Equilibra os temas do treino: para cada tema dos boatos (vacina, urna, Pix...), busca manchetes
// jornalísticas reais sobre o MESMO tema no RSS do Google Notícias. Sem isso o modelo aprende
// que "vacina" ou "urna" são sinais de boato, e notícias verdadeiras desses temas recebem nota baixa.
import { readFile, writeFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';

const TOPICS = ['vacina','covid','urna eletrônica','eleição','Lula','Bolsonaro','STF','Pix','imposto','INSS','aposentadoria','auxílio',
  'Bolsa Família','gasolina','Petrobras','dengue','câncer','tratamento','5G','clima','enchente','Rio Grande do Sul',
  'Paraná','Curitiba','escola','MEC','Enem','salário mínimo','desemprego','PIB','inflação','dólar','Banco Central','polícia',
  'facção','presídio','aborto','igreja','ONU','China','Israel','Ucrânia','Estados Unidos','Trump','Alexandre de Moraes','Anvisa',
  'Ministério da Saúde','SUS','hospital','medicamento','vacinação','sarampo','gripe','agrotóxico','Amazônia','desmatamento','queimadas',
  'indígenas','MST','reforma tributária','Receita Federal','CPF','golpe','WhatsApp','TikTok','inteligência artificial','TSE',
  'Copa do Mundo','futebol','prefeito','governador','deputado','senador','Câmara dos Deputados','Senado','Congresso','Haddad',
  'poupança','Caixa','FGTS','Terra','NASA','autismo','vacina covid','ivermectina','Pfizer','Butantan','Fiocruz','OMS'];
const BAN = /\b(falso|fals[ao]s?|fake|boato|enganos|checagem|verifica(do|mos)|[ée] mentira|desinforma|n[aã]o [ée] verdade|fato ou fake|comprova|lupa|aos fatos)\b/i;
const file = new URL('../data/treino-tf.json', import.meta.url);
const data = JSON.parse(await readFile(file, 'utf8'));
const seen = new Set(data.exemplos.map(e => e.texto.toLowerCase()));
let added = 0;
const only = process.argv.slice(2);
for (const topic of only.length ? only : TOPICS) {
  await new Promise(r => setTimeout(r, 2500)); // evita bloqueio por excesso de pedidos (HTTP 429)
  const url = 'https://news.google.com/rss/search?' + new URLSearchParams({ q: topic, hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' });
  let xml;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'VerificaFato-IFPR/2.0 (pesquisa academica)' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) { console.error(topic, r.status); continue; }
    xml = await r.text();
  } catch (e) { console.error(topic, e.message); continue; }
  const $ = cheerio.load(xml, { xmlMode: true });
  $('item').each((_, item) => {
    // Título vem como "Manchete - Veículo"; removemos o nome do veículo.
    const t = $(item).find('title').first().text().replace(/\s+-\s+[^-]{2,60}$/, '').replace(/\s+/g, ' ').trim();
    if (t.length < 25 || t.length > 400 || BAN.test(t) || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    data.exemplos.push({ texto: t, rotulo: 1, origem: 'gnews:' + topic });
    added++;
  });
}
if (!data.fonte.includes('Google Notícias')) data.fonte += ' + manchetes jornalísticas por tema (RSS Google Notícias, sem checagens)';
await writeFile(file, JSON.stringify(data, null, 1));
console.log('manchetes acrescentadas', added, '| total', data.exemplos.length);
