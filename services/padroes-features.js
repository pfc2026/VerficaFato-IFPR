// Atributos de estilo usados pelo modelo TensorFlow de padrões de linguagem.
// Mesmo código no treino (scripts/treinar-tf.mjs) e na análise (services/tensorflow.js).
// Não dependem do tamanho do texto, para que frases curtas e reportagens longas sejam comparáveis.
const plain = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const has = (re, s) => (re.test(s) ? 1 : 0);
const cues = [
  // [nome, regex sobre texto sem acento e minúsculo]
  ['urgencia', /\b(urgente|bomba|chocante|impactante|atencao|alerta|exclusivo|bombastico)\b/],
  ['compartilhe', /\b(compartilhe|repasse|divulgue|espalhe|encaminhe|mande para|envie para)\b/],
  ['conspiracao', /\b(esconde|escondem|escondido|nao quer(em)? que voce saiba|midia nao mostra|ninguem fala|a verdade sobre|censura|abafad|silencio)\b/],
  ['milagre', /\b(cura|milagre|milagros|100%|comprovad|definitiv|garantid|elimina|acaba com)\b/],
  ['absoluto', /\b(todos|todas|ninguem|nunca|sempre|jamais|qualquer um)\b/],
  ['voce', /\b(voce|voces|seu|sua|seus|suas)\b/],
  ['atribuicao', /\b(segundo|de acordo com|informou|informa|afirmou|disse|declarou|divulgou|confirmou|explicou|relatou|comunicou|em nota|nota oficial)\b/],
  ['instituicao', /\b(secretaria|ministerio|prefeitura|governo|policia|universidade|ibge|tribunal|conselho|instituto|agencia|hospital|banco central|anvisa|camara|senado|stf|tse|ufpr|ifpr|empresa|associacao)\b/],
  ['data', /\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|segunda-feira|terca-feira|quarta-feira|quinta-feira|sexta-feira|sabado|domingo|ontem|nesta|neste|\d{1,2}\/\d{1,2}|\(\d{1,2}\))\b/],
  ['numero', /\d/],
  ['citacao', /["“”]/],
  ['medida', /\b(r\$|mil|milhoes|bilhoes|por cento|%|km|anos|pessoas|casos)\b/],
  ['xingamento', /\b(bandido|vagabund|ladrao|corrupto|lixo|vergonha|absurdo|canalha|comunista|fascista|petralha|bolsominion)\b/],
  ['revelacao', /\b(revela|descobr|denuncia|vazou|vazad|exposto|desmascar|farsa|golpe)\b/],
  ['proibicao', /\b(proib|obrigatori|vai acabar|vai ser|vao ser|a partir de amanha|a partir de agora)\b/],
  ['cientifico_falso', /\b(estudo prova|cientistas confirmam|medico revela|especialistas alertam|harvard|oms admite)\b/]
];
export const STYLE_NAMES = [...cues.map(c => c[0]), 'exclamacao', 'pontuacao_repetida', 'maiusculas', 'emoji', 'palavras_longas'];
// Além do estilo, o modelo vê palavras e pares de palavras (hashing em 2048 posições),
// o que permite aprender expressões típicas de boatos ("resgatar saldo", "mídia esconde").
export const HASH_BUCKETS = 2048;
export const FEATURE_NAMES = [...STYLE_NAMES, 'palavras_hash_' + HASH_BUCKETS];
export const FEATURE_SIZE = STYLE_NAMES.length + HASH_BUCKETS;
function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % HASH_BUCKETS; }
export function extractFeatures(text) {
  const style = styleFeatures(text);
  const bag = new Array(HASH_BUCKETS).fill(0);
  const tokens = plain(String(text || '')).match(/[a-z0-9]+/g) || [];
  const grams = [...tokens, ...tokens.slice(1).map((t, i) => tokens[i] + '_' + t)];
  for (const g of grams) bag[fnv(g)] = 1;
  const norm = Math.sqrt(bag.reduce((s, v) => s + v, 0)) || 1;
  return [...style, ...bag.map(v => v / norm)];
}
export function styleFeatures(text) {
  const raw = String(text || '');
  const p = plain(raw);
  const words = raw.match(/[\p{L}\p{N}]+/gu) || [];
  const n = Math.max(words.length, 1);
  const upper = words.filter(w => w.length >= 3 && /\p{L}/u.test(w) && w === w.toLocaleUpperCase('pt-BR') && w !== w.toLocaleLowerCase('pt-BR')).length;
  const avgLen = words.reduce((s, w) => s + w.length, 0) / n;
  return [
    ...cues.map(([, re]) => has(re, p)),
    Math.min(1, ((raw.match(/!/g) || []).length) / 2),
    has(/[!?]{2,}/, raw),
    Math.min(1, (upper / n) * 3),
    has(/\p{Extended_Pictographic}/u, raw),
    Math.max(0, Math.min(1, (avgLen - 3) / 4))
  ];
}
// Divide o texto em frases como no treino (uma reportagem é avaliada frase a frase).
export function sentencesFor(text, max = 40) {
  const seg = new Intl.Segmenter('pt-BR', { granularity: 'sentence' });
  const out = [];
  for (const block of String(text || '').split(/\n+/)) {
    for (const { segment } of seg.segment(block)) {
      const s = segment.replace(/\s+/g, ' ').trim();
      if (s.length >= 15 && /\p{L}/u.test(s)) out.push(s);
      if (out.length >= max) return out;
    }
  }
  return out.length ? out : [String(text || '').trim()];
}
