import { isSpecificClaim, relevanceTerms } from './relevance.js';

export const normalizeClaim = value => String(value).normalize('NFC')
  .replace(/[“”„«»]/g, '"').replace(/[’‘]/g, "'").replace(/[.!?]+$/g, '').replace(/\s+/g, ' ').trim();
const plainClaim = text => text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
function claimType(sentence) {
  const plain = plainClaim(sentence);
  if (/\b(?:ignore|desconsidere|esqueca)\b.{0,100}\b(?:instrucoes|regras|prompt|sistema)\b|\b(?:system prompt|developer message|ignore previous)\b/u.test(plain)) return 'instrucao';
  if (/\?$/.test(plain) || /^(?:(?:eu )?(?:acho|acredito|prefiro|penso|considero|sinto)|na minha opiniao|para mim|gosto de)\b/u.test(plain)) return 'opiniao';
  // A report about an attributed announcement is a different assertion from
  // the event promised. Preserve its entire wording; never extract the quoted
  // future event as if the reporter had established that it happened.
  if (/^.{2,}\b(?:afirmou|declarou|disse|anunciou|prometeu|informou|comunicou|assegurou|garantiu|relatou)\b.{0,100}(?:\bque\b|:)/u.test(plain)) return isSpecificClaim(sentence) ? 'fato' : 'editorial';
  if (/\b(?:sera|serao|estara|estarao|tera|terao|ficara|ficarao|ocorrera|ocorrerao|acontecera|acontecerao|abrira|abrirao|inaugurara|inaugurarao|construira|construirao|recebera|receberao|devera|deverao|podera|poderao|ira|irao|prevejo|previsao)\b|\b(?:vai|vao) (?:acontecer|ficar|estar|abrir|inaugurar|construir|receber|funcionar|custar|terminar|concluir|entregar)\b|\bdaqui a (?:\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|alguns|algumas) (?:dias?|semanas?|meses|anos?)\b/u.test(plain)) return 'previsao';
  // Subjective copular judgments are opinions even without a first-person
  // preface. These lexical rules remain conservative and are not a general
  // semantic classifier; factual sentences are retained separately.
  if (/\b(?:e|era|foi|parece|considero) (?:muito |realmente |simplesmente )?(?:maravilhos[oa]|otim[oa]|pessim[oa]|excelente|horrivel|fantastic[oa]|incrivel|lind[oa]|bonit[oa]|adoravel|terrivel)(?![\p{L}])/u.test(plain)) return 'opiniao';
  return isSpecificClaim(sentence) ? 'fato' : 'editorial';
}
export function extractClaims(text, maxClaims = 8) {
  // Explicit clause boundaries preserve a separately stated factual datum in
  // a mixed opinion/fact sentence without stripping attribution from quotes.
  const segments = [...new Intl.Segmenter('pt-BR', { granularity: 'sentence' }).segment(text)]
    .flatMap(x => x.segment.split(/\n+|;\s*|,\s*(?:mas|porém|contudo)\s+/iu));
  const claims = [], seen = new Set(); let omitted = 0;
  for (const raw of segments) {
    const sentence = raw.trim();
    if (!sentence || /^(?:urgente|bomba|atenção|encaminhad[ao](?: muitas vezes)?)[!:.\s]*$/i.test(sentence)) continue;
    if (sentence.length < 10 || !/[\p{L}]/u.test(sentence)) { if (/[\p{L}\p{N}]/u.test(sentence)) omitted++; continue; }
    const key = normalizeClaim(sentence);
    if (seen.has(key)) continue;
    seen.add(key);
    if (claims.length >= maxClaims || sentence.length > 2000) { omitted++; continue; }
    const tipo = claimType(sentence);
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
  // A busca do Fact Check funciona melhor com poucas palavras: além da frase e da lista
  // longa, consultamos as 3 e as 4 palavras mais específicas (as mais longas, na ordem do texto).
  const terms = relevanceTerms(text);
  const top = n => { const keep = new Set([...terms].sort((a,b)=>b.length-a.length).slice(0,n)); return terms.filter(t=>keep.has(t)).join(' '); };
  const variants = [text.slice(0,300), keywords, terms.length > 4 ? top(4) : '', terms.length > 3 ? top(3) : ''];
  const expanded = keywords.replace(/\bimunizante\b/g,'vacina').replace(/\bimunizacao\b/g,'vacinacao').replace(/\bpleito\b/g,'eleicao');
  if (expanded !== keywords) variants.push(expanded);
  return [...new Set(variants.filter(Boolean))].slice(0,5);
}
