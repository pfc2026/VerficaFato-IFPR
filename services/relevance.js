// Retrieval relevance is deliberately separate from factual equivalence. These
// lexical rules select records worth reading; they never authorize a verdict.
const GENERIC = new Set(`a ao aos as o os de da das do dos em na nas no nos um uma uns umas e ou que com para por pela pelas pelo pelos se sem sobre entre ate como mas nao ja mais muito tambem isso isto esse essa esses essas este esta estes estas aquele aquela seu sua seus suas foi foram ser sendo sido sao esta estao tem vai pode podem disse segundo ainda apenas assim quando onde porque ele ela eles elas eu voce voces ha era eram sera seria seriam teria teriam neste nesta nesse nessa hoje ontem amanha agora aqui atualmente noticia noticias reportagem reportagens jornal jornais publicacao publicacoes publicado publicada publicados publicadas publicar publicou texto textos conteudo conteudos informacao informacoes mensagem mensagens boato boatos fato fatos checagem checagens verifica verificacao verificacoes verificar verificado verificada verificou checou investigou investigaram investigado investigada investigacao apurou apuracao concluiu concluir conclusao falso falsa falsos falsas verdadeiro verdadeira verdadeiros verdadeiras enganoso enganosa evidencia evidencias leia veja saiba confira entenda acesse clique assista acompanhe compartilhe encaminhe compartilhar compartilhando compartilharam compartilhado compartilhada redes sociais video videos imagem imagens mostra mostram mostraria afirma afirmam afirmou diz dizem perfil perfis conta contas comentarios pessoas outro outra outros outras`.split(/\s+/));

export function relevanceTerms(value) {
  return [...new Set(String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [])].filter(word => word.length >= 3 && !GENERIC.has(word) && !/^\d+$/.test(word));
}

export function isSpecificClaim(text) {
  if (typeof text !== 'string') return false;
  const plain = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  // A navigation command alone is not an assertion. A colon can introduce an
  // actual allegation; assess that remainder without rewriting the claim used
  // later by the stricter factual-equivalence check.
  if (/^(?:leia|veja|saiba|confira|entenda|acesse|clique|assista|acompanhe|compartilhe|encaminhe)\b/u.test(plain)) {
    const colon = plain.indexOf(':');
    return colon >= 0 && isSpecificClaim(plain.slice(colon + 1));
  }
  // Keep organizations as possible subjects. Inspect the remainder of a
  // publisher's investigation/conclusion rather than blacklisting its name.
  const editorialVerbs = [...plain.matchAll(/\b(?:investigou|apurou|verificou|checou|concluiu)\b/gu)];
  if (editorialVerbs.length) {
    const last = editorialVerbs.at(-1);
    if (!relevanceTerms(plain.slice(last.index + last[0].length)).length) return false;
  }
  return relevanceTerms(text).length >= 2;
}

export function canonicalReviewUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.href;
  } catch { return String(value || ''); }
}

const identityText = value => String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim();
export function reviewIdentity(review) {
  // Preserve distinct authors, published ratings and dates, even at one URL.
  return JSON.stringify([canonicalReviewUrl(review.url_verificacao), review.texto_verificado,
    review.verificador, review.avaliacao, review.data_verificacao,
    review.autor_alegacao, review.data_alegacao].map(identityText));
}

export function deduplicateReviews(reviews) {
  const unique = new Map();
  for (const review of Array.isArray(reviews) ? reviews : []) {
    if (!review || typeof review !== 'object') continue;
    const key = reviewIdentity(review);
    const previous = unique.get(key);
    if (!previous) unique.set(key, { ...review });
    else {
      // A query may return a less complete copy. Do not discard attribution or
      // dates supplied by another query, and keep one stable evidence ID.
      for (const [field, value] of Object.entries(review)) if (!previous[field] && value) previous[field] = value;
    }
  }
  return [...unique.values()];
}

export function reviewIsRelevant(claimText, review, { content = claimText } = {}) {
  if (!isSpecificClaim(claimText) || typeof review?.texto_verificado !== 'string') return false;
  const query = relevanceTerms(claimText);
  const external = new Set(relevanceTerms(review.texto_verificado));
  const original = new Set(relevanceTerms(content));
  const shared = query.filter(word => external.has(word) && original.has(word));
  // Publisher/title/URL matches cannot substitute for the actually reviewed
  // assertion. The publisher's own name alone is not a topical match either.
  const publisher = new Set(relevanceTerms(review.verificador));
  if (!shared.some(word => !publisher.has(word))) return false;
  return shared.length >= 2 && shared.length / Math.min(query.length, external.size) >= 0.35;
}

export function filterRelevantReviews(claimText, reviews, options) {
  return deduplicateReviews(reviews).filter(review => reviewIsRelevant(claimText, review, options));
}
