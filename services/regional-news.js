// Common language and publication boilerplate must not make unrelated stories
// appear relevant. This is a conservative lexical filter, never fact evidence.
const STOP_WORDS = new Set(`a ao aos aquela aquele aquelas aqueles algo algumas alguns antes apos aqui assim ate cada caso como com contra da das de dela dele dessa desse desta deste dia dias disse do dos durante e ela ele elas eles em entre era eram essa esse esta estava estavam estas este estes eu foi foram ha hoje isso isto ja lhe mais mas me mesmo minha meu muito muita muitas muitos na nas nao nem nessa nesse nesta neste no nos noso nossa novas novo novos o os ou outra outro outras outros para pela pelas pelo pelos pode podem pois por porque qual quando que quem sao se sem ser sera seu seus sua suas sob sobre tambem tem tendo ter toda todo todas todos uma umas um uns voce voces anos ano ainda apenas agora segundo apos entanto alem ate sera neste momento noticia noticias reportagem video videos mostra mostram publicado publicada publicacao afirmou afirma informa informado informacao informacoes texto imagem imagens veja leia saiba entenda diz disse fato fatos checagem falso falsa verdadeiro verdadeira`.split(/\s+/));

export function regionalTerms(value) {
  return [...new Set(String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [])].filter(term => term.length >= 3 && !STOP_WORDS.has(term) && !/^\d+$/.test(term));
}

export function rankRegionalNews(records, query, { limit = 3 } = {}) {
  const terms = regionalTerms(query);
  if (!terms.length) return [];
  return (Array.isArray(records) ? records : []).map(item => {
    const title = new Set(regionalTerms(item.titulo));
    const body = new Set(regionalTerms(item.texto));
    const titleMatches = terms.filter(term => title.has(term)).length;
    const bodyMatches = terms.filter(term => body.has(term)).length;
    // A shared generic word or a substring (terra/enterrado) is insufficient.
    // A short query needs all its topic terms; longer prose needs at least
    // two title terms or three body terms and meaningful overlap.
    const titleThreshold = Math.min(2, terms.length);
    const bodyThreshold = Math.min(3, terms.length);
    const relevant = terms.length >= 2 && (
      (titleMatches >= titleThreshold && titleMatches / Math.max(1, title.size) >= 0.25) ||
      (titleMatches >= 1 && bodyMatches >= bodyThreshold && bodyMatches / terms.length >= 0.5)
    );
    return { item, relevant, score: titleMatches * 5 + bodyMatches };
  }).filter(record => record.relevant).sort((a, b) => b.score - a.score).slice(0, limit)
    .map(({ item }) => ({ ...item, correspondencia: 'termos' }));
}
