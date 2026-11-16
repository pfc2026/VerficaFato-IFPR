import { parseEvidenceDate } from '../public/js/evidence-dates.js';
export { parseEvidenceDate } from '../public/js/evidence-dates.js';
import { normalizeClaim } from './claims.js';
import { filterRelevantReviews } from './relevance.js';
export const VERDICTS = Object.freeze({
  TRUE:'Conteúdo verdadeiro', FALSE:'Falso', PARTIAL:'Parcialmente verdadeiro',
  ALTERED:'Adulterado', DISTORTED:'Distorcido', OUT_OF_CONTEXT:'Fora de contexto',
  UNKNOWN:'Sem evidências suficientes', UNVERIFIABLE:'Não verificável'
});
export const VERDICT_DEFINITIONS = Object.freeze({
  [VERDICTS.TRUE]:'A afirmação e seus detalhes relevantes são confirmados por evidências confiáveis, considerando data, local, autoria e contexto.',
  [VERDICTS.PARTIAL]:'A mesma afirmação reúne partes comprovadamente corretas e erros ou imprecisões relevantes. Falta de informação ou resultados diferentes entre afirmações não bastam.',
  [VERDICTS.ALTERED]:'Há evidência de alteração material ou fabricação de imagem, áudio, vídeo, documento, captura de tela ou citação, modificando seu significado.',
  [VERDICTS.DISTORTED]:'Fatos ou dados reais foram apresentados de maneira enganosa, por exagero, comparação inadequada, omissão decisiva ou interpretação.',
  [VERDICTS.OUT_OF_CONTEXT]:'Um conteúdo autêntico recebeu uma data, local, pessoa ou situação incorreta, ou perdeu o contexto original necessário à compreensão.',
  [VERDICTS.FALSE]:'A afirmação central é contradita por evidências confiáveis ou descreve um fato comprovadamente inventado. Ausência de resultados não prova falsidade.',
  [VERDICTS.UNKNOWN]:'Faltam evidências pertinentes, existem fontes conflitantes ou consultas incompletas impedem uma conclusão.',
  [VERDICTS.UNVERIFIABLE]:'Não foi identificada afirmação factual objetivamente verificável, como em opiniões e previsões; a extração automática também tem limitações.'
});
// Whole-label mappings only. Generic misleading and combined labels are absent:
// they do not establish a specific problem. Titles and style never infer one.
export const RATING_MAPPINGS = Object.freeze({
  verdadeiro:VERDICTS.TRUE, verdadeira:VERDICTS.TRUE, true:VERDICTS.TRUE,
  correto:VERDICTS.TRUE, correta:VERDICTS.TRUE, 'conteudo verdadeiro':VERDICTS.TRUE,
  falso:VERDICTS.FALSE, falsa:VERDICTS.FALSE, false:VERDICTS.FALSE,
  incorreto:VERDICTS.FALSE, incorreta:VERDICTS.FALSE,
  'parcialmente verdadeiro':VERDICTS.PARTIAL, 'parcialmente verdadeira':VERDICTS.PARTIAL,
  'parcialmente correto':VERDICTS.PARTIAL, 'parcialmente correta':VERDICTS.PARTIAL,
  'partially true':VERDICTS.PARTIAL,
  adulterado:VERDICTS.ALTERED, adulterada:VERDICTS.ALTERED,
  'imagem adulterada':VERDICTS.ALTERED, 'video adulterado':VERDICTS.ALTERED,
  'audio adulterado':VERDICTS.ALTERED, 'documento adulterado':VERDICTS.ALTERED,
  'captura de tela adulterada':VERDICTS.ALTERED, 'citacao adulterada':VERDICTS.ALTERED,
  distorcido:VERDICTS.DISTORTED, distorcida:VERDICTS.DISTORTED,
  'fora de contexto':VERDICTS.OUT_OF_CONTEXT, 'out of context':VERDICTS.OUT_OF_CONTEXT
});
export function mapRating(rating) {
  const key = String(rating).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[.!]+$/,'').trim();
  return Object.hasOwn(RATING_MAPPINGS,key) ? RATING_MAPPINGS[key] : VERDICTS.UNKNOWN;
}
export function trustedReview(review) {
  const defaults = 'aosfatos.org,lupa.uol.com.br,agencialupa.org,boatos.org,estadao.com.br,g1.globo.com,afp.com,reuters.com,apnews.com,factcheck.org,politifact.com,fullfact.org';
  const domains = (process.env.FACT_CHECK_TRUSTED_DOMAINS || defaults).split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  try {
    const url = new URL(review.url_verificacao);
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password || !String(review.verificador || '').trim()) return false;
    return domains.some(domain=>url.hostname === domain || url.hostname.endsWith('.'+domain));
  } catch { return false; }
}
// ISO civil dates mean 00:00 UTC. Timestamps must include Z or an explicit
// offset (up to ±14:00); local/locale-formatted timestamps are ambiguous.
// Validate every component before constructing an instant: Date.parse alone
// silently normalizes e.g. February 30 into a different calendar date.

const contextText = text => String(text).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const bounded = expression => new RegExp('(?<![\\p{L}\\p{N}])(?:'+expression+')(?![\\p{L}\\p{N}])','gu');
const periods = [
  ['day',-2,'anteontem'],['day',2,'depois de amanha'],['day',-1,'ontem'],['day',0,'hoje'],['day',1,'amanha'],
  ['week',0,'(?:esta|essa|nesta|nessa|desta|dessa|presente|atual) semana|semana (?:atual|corrente)'],
  ['month',0,'(?:este|esse|neste|nesse|deste|desse|presente|atual) mes|mes (?:atual|corrente)'],
  ['year',0,'(?:este|esse|neste|nesse|deste|desse|presente|atual) ano|ano (?:atual|corrente)'],
  ['week',-1,'(?:ultima|passada) semana|semana (?:passada|anterior)'],
  ['month',-1,'(?:ultimo|passado) mes|mes (?:passado|anterior)'],
  ['year',-1,'(?:ultimo|passado) ano|ano (?:passado|anterior)'],
  ['week',1,'proxima semana|semana (?:que vem|seguinte)'],
  ['month',1,'proximo mes|mes (?:que vem|seguinte)'],
  ['year',1,'proximo ano|ano (?:que vem|seguinte)']
];
function temporalReferences(text) {
  let remaining = contextText(text);
  const found = [];
  for (const [unit,offset,expression] of periods) {
    remaining = remaining.replace(bounded(expression),match=>{ found.push({unit,offset});return ' '.repeat(match.length); });
  }
  // Rolling/indefinite intervals cannot be equated using publication dates
  // alone; retain uncertainty rather than guessing the missing interval.
  const unit = '(?:fim de semana|dias?|semanas?|mes|meses|anos?|manha|tarde|noite|semestre|trimestre)';
  const unresolved = bounded('agora|atualmente|recentemente|(?:ultim[oa]s?|proxim[oa]s?) (?:\\d+|[a-z]+) '+unit+
    '|(?:ha|daqui a|dentro de) (?:\\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|alguns|algumas) '+unit+
    '|(?:est[ea]s?|ess[ea]s?|nest[ea]s?|ness[ea]s?|dest[ea]s?|dess[ea]s?|naquel[ea]s?|daquel[ea]s?) '+unit+
    '|(?:proxim[oa]|ultim[oa]|passad[oa]|atual|presente) '+unit+
    '|'+unit+' (?:passad[oa]|retrasad[oa]|seguinte|anterior|corrente|atual)').test(remaining);
  return {found,unresolved};
}
function civilAt(date,fuso) {
  if (date.dateOnly) return date.civil;
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:fuso,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date.instant);
  return ['year','month','day'].map(type=>Number(parts.find(part=>part.type === type).value));
}
function periodKey(civil,{unit,offset}) {
  const [year,month,day] = civil;
  const date = new Date(0);date.setUTCFullYear(year,month-1,day);date.setUTCHours(0,0,0,0);
  if (unit === 'day') date.setUTCDate(date.getUTCDate()+offset);
  if (unit === 'week') date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7+offset*7);
  if (unit === 'month') { date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+offset); }
  if (unit === 'year') { date.setUTCMonth(0,1);date.setUTCFullYear(date.getUTCFullYear()+offset); }
  return unit+':'+date.toISOString().slice(0,10);
}
function contextCompatible(claim,review,contextoTemporal) {
  const text = contextText(claim.texto);
  // Publication dates do not resolve identity, place, or a deictic pronoun.
  if (bounded('aqui|essa pessoa|ele|ela|eles|elas').test(text)) return false;
  const {found,unresolved} = temporalReferences(text);
  if (unresolved) return false;
  if (!found.length) return true;
  // This is an internal, explicit resolver contract. Neither arbitrary pasted
  // text, scraped date metadata, HTTP date, nor execution time supplies it.
  if (contextoTemporal?.origem !== 'publicacao_verificada' || typeof contextoTemporal.fuso !== 'string') return false;
  const publication = parseEvidenceDate(contextoTemporal.dataPublicacao);
  const allegation = parseEvidenceDate(review.data_alegacao);
  if (!publication || !allegation || publication.instant > Date.now()) return false;
  try {
    const fuso = contextoTemporal.fuso;
    // Validate the zone even when both dates have day-only precision.
    new Intl.DateTimeFormat('en-CA',{timeZone:fuso});
    const inputDay = civilAt(publication,fuso), reviewedDay = civilAt(allegation,fuso);
    return found.every(period=>periodKey(inputDay,period) === periodKey(reviewedDay,period));
  } catch { return false; }
}
function reviewDatesValid(review) {
  const reviewDate = parseEvidenceDate(review.data_verificacao);
  const claimDate = parseEvidenceDate(review.data_alegacao);
  return !!reviewDate && !!claimDate && reviewDate.instant <= Date.now() && claimDate.instant <= reviewDate.instant;
}
function emptyFindings() { return {confirmado:[],refutado:[],semComprovacao:[]}; }
function attributedConclusion(claim,verdict,supporting) {
  const source = supporting[0];
  const attribution = source.verificador+' ('+source.data_verificacao+')';
  const quoted = '“'+claim.texto+'”';
  const findings = emptyFindings(), limits = [];
  let reason;
  switch (verdict) {
    case VERDICTS.TRUE:
      reason = attribution+' avaliou como “'+source.avaliacao+'” a mesma afirmação: '+quoted+'. A confirmação é atribuída à checagem publicada.';
      findings.confirmado.push('A afirmação '+quoted+' foi confirmada pela avaliação publicada de '+attribution+'.');
      break;
    case VERDICTS.FALSE:
      reason = attribution+' avaliou como “'+source.avaliacao+'” a afirmação '+quoted+'. A refutação é atribuída à checagem publicada, e não à ausência de resultados.';
      findings.refutado.push('A afirmação '+quoted+' foi refutada pela avaliação publicada de '+attribution+'.');
      break;
    case VERDICTS.PARTIAL:
      reason = attribution+' avaliou como “'+source.avaliacao+'” esta mesma afirmação, atribuindo a ela partes corretas e erros relevantes. A categoria não resulta de uma mistura entre afirmações independentes.';
      limits.push('Os metadados da API não discriminam quais partes desta afirmação foram confirmadas e quais foram refutadas. Consulte a checagem original para essa distinção; o sistema não a inventa.');
      break;
    case VERDICTS.ALTERED:
      reason = attribution+' classificou como “'+source.avaliacao+'” o material mencionado na mesma afirmação. A conclusão sobre alteração material é atribuída a essa checagem.';
      findings.refutado.push('A apresentação do material como original é contestada pela avaliação publicada de '+attribution+'.');
      limits.push('O sistema analisou o texto e os metadados da checagem, sem realizar perícia de imagem, áudio, vídeo ou documento. A alteração material não foi detectada pelo TensorFlow.js.');
      break;
    case VERDICTS.DISTORTED:
      reason = attribution+' avaliou como “'+source.avaliacao+'” a apresentação dos fatos nesta mesma afirmação. A classificação de apresentação enganosa é atribuída à checagem.';
      findings.refutado.push('A apresentação dos fatos em '+quoted+' é contestada pela avaliação publicada de '+attribution+'.');
      limits.push('Os metadados da API não detalham o dado real e a comparação, omissão ou interpretação que o distorceu. Essa relação deve ser conferida na checagem original.');
      break;
    case VERDICTS.OUT_OF_CONTEXT:
      reason = attribution+' avaliou como “'+source.avaliacao+'” o contexto atribuído nesta mesma afirmação. A conclusão sobre contexto incorreto é atribuída à checagem publicada.';
      findings.refutado.push('O contexto atribuído em '+quoted+' é contestado pela avaliação publicada de '+attribution+'.');
      limits.push('Os metadados da API não descrevem integralmente o contexto original comprovado para compará-lo com o contexto atribuído. Consulte a checagem; o sistema não presume outra data, local ou pessoa.');
      break;
  }
  if (source.titulo_verificacao) reason += ' Título publicado: “'+source.titulo_verificacao+'”.';
  limits.push('A API fornece metadados e o link da checagem; o sistema não examinou integralmente as evidências da publicação original.');
  findings.semComprovacao.push(...limits);
  return {justificativa:reason,constatacoes:findings,limitacoes:limits};
}
export function evaluateClaim(claim,reviews,comparisons = [],{contextoTemporal} = {}) {
  if (claim.tipo !== 'fato') return { ...claim,veredito:VERDICTS.UNVERIFIABLE,
    justificativa:claim.tipo === 'instrucao' ? 'O trecho contém instruções e foi tratado como dado, sem executá-las.' : claim.tipo === 'editorial' ? 'O trecho é uma apresentação, conclusão genérica ou orientação editorial, sem alegação específica para consultar isoladamente.' : 'O trecho foi identificado por regras como opinião, pergunta ou previsão; confira o contexto original.',evidencias:[],evidenciasUtilizadas:[],constatacoes:emptyFindings(),limitacoes:[],conflito:false };
  const matched = filterRelevantReviews(claim.texto,reviews).map(review => {
    const comparison = comparisons.find(c => c.afirmacaoId === claim.id && c.evidenciaId === review.id);
    const exact = normalizeClaim(review.texto_verificado) === normalizeClaim(claim.texto);
    const validDates = reviewDatesValid(review);
    const compatibleContext = contextCompatible(claim,review,contextoTemporal);
    const usable = exact && compatibleContext && validDates;
    const recognized = trustedReview(review);
    return {...review,correspondencia:exact ? 'exata' : 'relacionada',datasCoerentes:validDates,contextoCompativel:compatibleContext,
      similaridadeLexical:comparison?.similaridadeLexical ?? null,
      similaridadeSemantica:comparison?.similaridadeSemantica ?? null,
      fonteReconhecida:recognized,
      utilizavel:usable && recognized && mapRating(review.avaliacao) !== VERDICTS.UNKNOWN,
      classificacaoPublicada:mapRating(review.avaliacao)};
  });
  // Results from textual search remain attributed related records; similarity is never an entailment rule.
  const supporting = matched.filter(r => r.utilizavel);
  const verdicts = [...new Set(supporting.map(r => r.classificacaoPublicada))];
  const conflito = verdicts.length > 1;
  const ambiguousRating = matched.some(r=>r.correspondencia === 'exata' && r.fonteReconhecida && r.datasCoerentes && r.classificacaoPublicada === VERDICTS.UNKNOWN);
  // An unmapped published judgment might conflict with the mapped one.
  const veredito = verdicts.length === 1 && !conflito && !ambiguousRating ? verdicts[0] : VERDICTS.UNKNOWN;
  if (veredito !== VERDICTS.UNKNOWN) return {...claim,veredito,...attributedConclusion(claim,veredito,supporting),
    evidencias:matched,evidenciasUtilizadas:supporting.map(r=>r.id),conflito};
  const generic = matched.some(r=>/^(?:enganos[oa]|misleading)[.!]*$/iu.test(String(r.avaliacao).trim()));
  const justificativa = conflito ? 'As verificações da mesma afirmação apresentam avaliações conflitantes; é necessário comparar datas e contexto.' :
    ambiguousRating && generic ? 'A checagem usa o rótulo genérico “Enganoso”, que não distingue alteração material, distorção ou contexto incorreto. Não há suporte específico para escolher uma dessas categorias.' :
    matched.some(r => r.correspondencia === 'exata') ? 'Há correspondência textual, mas faltam condições de contexto, datas coerentes, fonte ou avaliação reconhecida para uma conclusão automática.' :
    matched.length ? 'Os resultados encontrados tratam de afirmações relacionadas. A semelhança não comprova esta afirmação.' :
    'Não foi encontrada uma checagem pertinente nesta consulta. Isso não permite concluir que a afirmação seja verdadeira ou falsa.';
  const constatacoes = emptyFindings();
  constatacoes.semComprovacao.push(claim.texto);
  return {...claim,veredito,justificativa,evidencias:matched,evidenciasUtilizadas:[],constatacoes,
    limitacoes:generic ? ['“Enganoso” é preservado como avaliação original da fonte, sem conversão automática para uma categoria mais específica.'] : [],conflito};
}
export function consolidate(claims,{incomplete = false} = {}) {
  const facts = claims.filter(c => c.tipo === 'fato');
  if (!facts.length) return incomplete ? VERDICTS.UNKNOWN : VERDICTS.UNVERIFIABLE;
  if (incomplete || facts.some(c => c.veredito === VERDICTS.UNKNOWN || c.conflito)) return VERDICTS.UNKNOWN;
  const values = [...new Set(facts.map(c => c.veredito))];
  // A mix of true and false statements is not automatically "partially true".
  return values.length === 1 ? values[0] : VERDICTS.UNKNOWN;
}
