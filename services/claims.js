import { isSpecificClaim, relevanceTerms } from './relevance.js';

export const normalizeClaim = value => String(value).normalize('NFC')
  .replace(/[“”„«»]/g, '"').replace(/[’‘]/g, "'").replace(/[.!?]+$/g, '').replace(/\s+/g, ' ').trim();
export function extractClaims(text, maxClaims = 8) {
  const segments = [...new Intl.Segmenter('pt-BR', { granularity: 'sentence' }).segment(text)].flatMap(x => x.segment.split(/\n+/));
  const claims = [], seen = new Set(); let omitted = 0;
  for (const raw of segments) {
    const sentence = raw.trim();
    if (!sentence || /^(?:urgente|bomba|atenção|encaminhad[ao](?: muitas vezes)?)[!:.\s]*$/i.test(sentence)) continue;
    if (sentence.length < 10 || !/[\p{L}]/u.test(sentence)) { if (/[\p{L}\p{N}]/u.test(sentence)) omitted++; continue; }
    const key = normalizeClaim(sentence);
    if (seen.has(key)) continue;
    seen.add(key);
    if (claims.length >= maxClaims || sentence.length > 2000) { omitted++; continue; }
    let tipo = 'fato';
    if (/\b(?:ignore|desconsidere|esqueça)\b.{0,100}\b(?:instruções|regras|prompt|sistema)\b|\b(?:system prompt|developer message|ignore previous)\b/i.test(sentence)) tipo = 'instrucao';
    else if (/\?$/.test(sentence) || /^(?:eu (?:acho|acredito|prefiro)|na minha opinião|para mim|gosto de)\b/i.test(sentence)) tipo = 'opiniao';
    else if (/\b(?:será|serão|vai acontecer|irá|prevejo|previsão|poderá)(?=$|[^\p{L}])/iu.test(sentence)) tipo = 'previsao';
    else if (!isSpecificClaim(sentence)) tipo = 'editorial';
    claims.push({ id: 'a' + (claims.length + 1), texto: sentence, tipo });
  }
  return { claims, omitted };
}
const rules = [
  [/\b(?:URGENTE|BOMBA|CHOCANTE|IMPACTANTE)\b/u, 'Vocabulário de urgência ou impacto'],
  [/[!?]{2,}/u, 'Pontuação repetida para enfatizar a mensagem'],
  [/compartilhe antes que|repasse para todos|envie para todos/iu, 'Pedido de compartilhamento sob pressão'],
  [/ninguém quer que você saiba|mídia esconde|mídia não mostra/iu, 'Apelo genérico a informações supostamente ocultas'],
  [/cura milagrosa|você não vai acreditar/iu, 'Promessa extraordinária ou chamada sensacionalista']
];
export function languageIndicators(text) {
  const indicadores = rules.flatMap(([regex,label]) => { const match = text.match(regex); return match ? [{ label, trecho: match[0] }] : []; });
  const capitals = text.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{8,}\b/u);
  if (capitals) indicadores.push({ label: 'Trecho com letras maiúsculas', trecho: capitals[0] });
  return indicadores;
}
export function keywordQuery(text, limit = 10) {
  return relevanceTerms(text).slice(0,limit).join(' ');
}
export function queryVariants(text) {
  if (!isSpecificClaim(text)) return [];
  // Auditable PT-BR lexical expansion only, never claimed as model-derived paraphrases.
  const keywords = keywordQuery(text);
  const variants = [text.slice(0,300), keywords];
  const expanded = keywords.replace(/\bimunizante\b/g,'vacina').replace(/\bimunizacao\b/g,'vacinacao').replace(/\bpleito\b/g,'eleicao');
  if (expanded !== keywords) variants.push(expanded);
  return [...new Set(variants.filter(Boolean))].slice(0,3);
}
