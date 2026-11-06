import { normalizeClaim } from './claims.js';
export const VERDICTS = Object.freeze({
  TRUE:'Verdadeiro', FALSE:'Falso', PARTIAL:'Parcialmente verdadeiro', MISLEADING:'Enganoso',
  UNKNOWN:'Sem evidências suficientes', UNVERIFIABLE:'Não verificável'
});
export function mapRating(rating) {
  const key = String(rating).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[.!]+$/,'').trim();
  // Whole labels only; "não é falso" must never become "Falso".
  const table = new Map([
    ['verdadeiro',VERDICTS.TRUE],['verdadeira',VERDICTS.TRUE],['true',VERDICTS.TRUE],['correto',VERDICTS.TRUE],['correta',VERDICTS.TRUE],
    ['falso',VERDICTS.FALSE],['falsa',VERDICTS.FALSE],['false',VERDICTS.FALSE],['incorreto',VERDICTS.FALSE],['incorreta',VERDICTS.FALSE],
    ['parcialmente verdadeiro',VERDICTS.PARTIAL],['parcialmente verdadeira',VERDICTS.PARTIAL],['parcialmente correto',VERDICTS.PARTIAL],
    ['enganoso',VERDICTS.MISLEADING],['enganosa',VERDICTS.MISLEADING],['misleading',VERDICTS.MISLEADING],['fora de contexto',VERDICTS.MISLEADING]
  ]);
  return table.get(key) || VERDICTS.UNKNOWN;
}
export function trustedReview(review) {
  const defaults = 'aosfatos.org,lupa.uol.com.br,agencialupa.org,boatos.org,estadao.com.br,g1.globo.com,afp.com,reuters.com,apnews.com,factcheck.org,politifact.com,fullfact.org';
  const domains = (process.env.FACT_CHECK_TRUSTED_DOMAINS || defaults).split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  try {
    const host = new URL(review.url_verificacao).hostname;
    return domains.some(domain=>host === domain || host.endsWith('.'+domain));
  } catch { return false; }
}
function contextAmbiguous(text) { return /\b(?:hoje|ontem|amanhã|agora|aqui|atualmente|neste ano|este ano|essa pessoa|ele|ela)(?=$|[^\p{L}])/iu.test(text); }
export function evaluateClaim(claim,reviews,comparisons = []) {
  if (claim.tipo !== 'fato') return { ...claim,veredito:VERDICTS.UNVERIFIABLE,
    justificativa:claim.tipo === 'instrucao' ? 'O trecho contém instruções e foi tratado como dado, sem executá-las.' : 'O trecho foi identificado por regras como opinião, pergunta ou previsão; confira o contexto original.',evidencias:[],conflito:false };
  const matched = reviews.map(review => {
    const comparison = comparisons.find(c => c.afirmacaoId === claim.id && c.evidenciaId === review.id);
    const exact = normalizeClaim(review.texto_verificado) === normalizeClaim(claim.texto);
    const date = Date.parse(review.data_verificacao);
    const usable = exact && !contextAmbiguous(claim.texto) && Number.isFinite(date) && date <= Date.now();
    return {...review,correspondencia:exact ? 'exata' : 'relacionada',
      similaridadeLexical:comparison?.similaridadeLexical ?? null,
      similaridadeSemantica:comparison?.similaridadeSemantica ?? null,
      fonteReconhecida:trustedReview(review),
      utilizavel:usable && trustedReview(review) && mapRating(review.avaliacao) !== VERDICTS.UNKNOWN,
      classificacaoPublicada:mapRating(review.avaliacao)};
  });
  // Results from textual search remain attributed related records; similarity is never an entailment rule.
  const supporting = matched.filter(r => r.utilizavel);
  const verdicts = [...new Set(supporting.map(r => r.classificacaoPublicada))];
  const conflito = verdicts.length > 1;
  let veredito = verdicts.length === 1 && !conflito ? verdicts[0] : VERDICTS.UNKNOWN;
  const justificativa = conflito ? 'As verificações da mesma afirmação apresentam avaliações conflitantes; é necessário comparar datas e contexto.' :
    veredito !== VERDICTS.UNKNOWN ? 'Há checagem publicada com texto correspondente e avaliação reconhecida. A classificação é atribuída ao verificador e à data indicada; leia a análise original.' :
    matched.some(r => r.correspondencia === 'exata') ? 'Há correspondência textual, mas faltam condições de contexto, data ou avaliação reconhecida para uma conclusão automática.' :
    matched.length ? 'Os resultados encontrados tratam de afirmações relacionadas. A semelhança não comprova esta afirmação.' :
    'Não foi encontrada uma checagem correspondente nesta consulta. Isso não permite concluir que a afirmação seja verdadeira ou falsa.';
  return {...claim,veredito,justificativa,evidencias:matched,conflito};
}
export function consolidate(claims,{incomplete = false} = {}) {
  const facts = claims.filter(c => c.tipo === 'fato');
  if (!facts.length) return incomplete ? VERDICTS.UNKNOWN : VERDICTS.UNVERIFIABLE;
  if (incomplete || facts.some(c => c.veredito === VERDICTS.UNKNOWN || c.conflito)) return VERDICTS.UNKNOWN;
  const values = [...new Set(facts.map(c => c.veredito))];
  // A mix of true and false statements is not automatically "partially true".
  return values.length === 1 ? values[0] : VERDICTS.UNKNOWN;
}
