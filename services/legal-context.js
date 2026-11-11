import { readFileSync } from 'node:fs';
import { z } from 'zod';

// This is a reviewed allowlist, not a collection of model-provided citations.
// New legislation is admitted only after review of the official consolidated text.
let catalog = {};
let entries = [];
export const LEGAL_SITUATIONS = Object.freeze([
  'Suspeita', 'Investigação', 'Indiciamento', 'Denúncia', 'Processo judicial',
  'Condenação', 'Absolvição', 'Situação não identificada'
]);
const categories = ['acontecimento_noticiado', 'publicacao'];
const normalize = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const timeValue = now => now instanceof Date ? now.getTime() : typeof now === 'number' ? now : Date.parse(now);
const maxReferences = 6;
const empty = () => ({ aplicavel: false, referencias: [] });
const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'sentence' });

function officialUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && (
      url.hostname === 'www2.camara.leg.br' && /^\/legin\/fed\//.test(url.pathname) && /-normaatualizada-(?:pl|pe)\.(?:html|pdf)$/.test(url.pathname) ||
      url.hostname === 'www.tse.jus.br' && /^\/legislacao\//.test(url.pathname)
    );
  } catch { return false; }
}

function fresh(now) {
  const current = timeValue(now);
  const verified = Date.parse(catalog.verificado_em + 'T00:00:00Z');
  const expiry = Date.parse(catalog.revisar_ate + 'T00:00:00Z');
  return Number.isFinite(current) && current >= verified && current < expiry && expiry - verified <= 30 * 86400000;
}

try {
  catalog = JSON.parse(readFileSync(new URL('../data/legal-catalog.json', import.meta.url), 'utf8'));
  entries = catalog.referencias.map(entry => ({
    ...entry, fonte_oficial: catalog.fontes[entry.fonte],
    verificado_em: catalog.verificado_em, revisar_ate: catalog.revisar_ate,
    matchers: entry.sinais.map(pattern => new RegExp(pattern, 'u'))
  }));
  if (!entries.length || new Set(entries.map(entry => entry.id)).size !== entries.length || entries.some(entry =>
    !officialUrl(entry.fonte_oficial) || !entry.lei || !entry.artigo || !entry.explicacao ||
    !entry.consequencias || !entry.ressalvas || !entry.criterio_pertinencia ||
    !entry.categorias.length || entry.categorias.some(category => !categories.includes(category))
  )) throw new Error('INVALID_REVIEWED_LEGAL_CATALOG');
} catch {
  // A missing/corrupt optional asset must never prevent the server from starting.
  catalog = {}; entries = [];
}

export function legalCatalogReadiness({ now = Date.now() } = {}) {
  return {
    status: !entries.length ? 'indisponivel' : fresh(now) ? 'pronto' : 'revisao_pendente',
    referencias: entries.length, verificadoEm: catalog.verificado_em || null, revisarAte: catalog.revisar_ate || null
  };
}

function matches(entry, text) {
  const normalized = normalize(text);
  return entry.matchers.every(matcher => matcher.test(normalized));
}

function substantiveRelation(entry, text) {
  const value = normalize(text);
  // Titles, classes and educational mentions do not report the underlying conduct.
  const allegedConduct = /\b(?:investigad\w*|investiga|suspeit\w* de|inquerito sobre|denunciad\w*|denuncia por|acusad\w*|acusacao de|indiciad\w*|responde a|processad\w*|condenad\w*|absolvid\w*|prendeu)\b/u;
  if (/\b(?:mostra|festival|palestra|seminario|curso|filme|livro|peca teatral|campanha educativa|debate)\b/u.test(value) &&
    /\b(?:sobre|intitulad\w*|chamad\w*|denominad\w*|combate a)\b/u.test(value) && !allegedConduct.test(value)) return false;
  if (/\b(?:nao (?:houve|ocorreu|existiu|ha|existe)|sem (?:qualquer )?(?:registro de |indicio de |noticia de )?)[\s\w]{0,30}\b(?:vazamento|exposicao de dados|corrupcao|propina|peculato|desvio de|racismo|discriminacao|injuria|calunia|difamacao|poluicao|publicidade enganosa|violacao autoral)\b/u.test(value)) return false;
  if (entry.id === 'cp-317' && !/corrupcao passiva|propina|vantagem indevida/u.test(value) && !allegedConduct.test(value)) return false;
  return matches(entry, text);
}

function enclosingSentences(text, snippet) {
  // Validate the original sentence, including words BEFORE a model-selected quote.
  // Otherwise a model could quote "foi condenado" from "não foi condenado".
  return [...segmenter.segment(text)].map(part => part.segment.trim()).filter(sentence => sentence.includes(snippet));
}

/** Narrow lexical eligibility is only a guard; Gemini must still decide relevance. */
export function legalCandidates(text, { now = Date.now() } = {}) {
  if (typeof text !== 'string' || !fresh(now)) return [];
  return entries.filter(entry => substantiveRelation(entry, text)).map(entry => ({
    id: entry.id, lei: entry.lei, artigo: entry.artigo, categorias: [...entry.categorias],
    criterio_pertinencia: entry.criterio_pertinencia, explicacao: entry.explicacao,
    consequencias: entry.consequencias, ressalvas: entry.ressalvas,
    fonte_oficial: entry.fonte_oficial, verificado_em: entry.verificado_em, revisar_ate: entry.revisar_ate
  }));
}

/** Strict structured output: the model selects, but cannot write laws, penalties or URLs. */
export function legalResponseSchema(candidates = []) {
  const ids = candidates.map(candidate => candidate.id);
  return {
    type: 'object', additionalProperties: false,
    properties: {
      aplicavel: { type: 'boolean' },
      referencias: {
        type: 'array', maxItems: ids.length ? maxReferences : 0,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            id: { type: 'string', enum: ids.length ? ids : ['nenhuma'] },
            categoria: { type: 'string', enum: categories },
            trecho_noticia: { type: 'string', minLength: 20, maxLength: 1200 },
            situacao_juridica: { type: 'string', enum: LEGAL_SITUATIONS },
            trecho_situacao: { type: 'string', maxLength: 600 }
          },
          required: ['id', 'categoria', 'trecho_noticia', 'situacao_juridica', 'trecho_situacao']
        }
      }
    }, required: ['aplicavel', 'referencias']
  };
}

const selectionSchema = z.object({
  id: z.string().min(1).max(80), categoria: z.enum(categories),
  trecho_noticia: z.string().trim().min(20).max(1200),
  situacao_juridica: z.enum(LEGAL_SITUATIONS), trecho_situacao: z.string().trim().max(600)
}).strict();
const situationPatterns = {
  'Suspeita': /\b(?:suspeit\w*|possivel|supost\w*|alegacao|alega\w*)\b/u,
  'Investigação': /\b(?:investig\w*|inquerito|apuracao)\b/u,
  'Indiciamento': /\b(?:indiciad\w*|indiciamento|indiciou)\b/u,
  // A complaint to police/the press is not a prosecutorial charge.
  'Denúncia': /\b(?:ministerio publico(?: federal| estadual)?\s+(?:ofereceu|apresentou|ajuizou|formalizou|formulou)\s+(?:uma )?denuncia|denunciad\w* pelo ministerio publico|denuncia (?:oferecida|apresentada) pelo ministerio publico|(?:justica|juiz|tribunal) recebeu (?:a )?denuncia)\b/u,
  'Processo judicial': /\b(?:acao penal|processo judicial|processo criminal|reu|reus|tornou-se reu)\b/u,
  'Condenação': /\b(?:(?:foi|foram|esta|estao|e|sao) (?:judicialmente )?condenad\w*|condenou|condenacao (?:imposta|proferida|mantida))\b/u,
  'Absolvição': /\b(?:(?:foi|foram|esta|estao|e|sao) (?:judicialmente )?absolvid\w*|absolveu|absolvicao (?:proferida|mantida))\b/u
};

const situationRoots = {
  'Suspeita': 'suspeit', 'Investigação': 'investig|inquerito|apuracao', 'Indiciamento': 'indici',
  'Denúncia': 'denunci', 'Processo judicial': 'processo|acao penal|reu',
  'Condenação': 'conden', 'Absolvição': 'absolv'
};
function supportedSituation(item, text, entry) {
  if (item.situacao_juridica === 'Situação não identificada') return item.trecho_situacao === '';
  if (item.trecho_situacao.length < 8 || !item.trecho_noticia.includes(item.trecho_situacao)) return false;
  const contexts = enclosingSentences(text, item.trecho_situacao);
  if (!contexts.length) return false;
  const roots = situationRoots[item.situacao_juridica];
  const negation = new RegExp('\\b(?:nao|sem)\\s+(?:(?:foi|foram|e|ha|houve|esta|existe|qualquer|ainda|ter|ser|uma|que|tenha|sido)\\s+){0,5}(?:' + roots + ')', 'u');
  const conditional = new RegExp('\\b(?:se|caso)\\b.{0,80}\\b(?:foi|foram|tenha|tivesse|fosse|venha a ser)\\b.{0,30}(?:' + roots + ')', 'u');
  const denied = new RegExp('\\b(?:negou|descartou|desmentiu|refutou)\\b.{0,60}(?:' + roots + ')', 'u');
  return contexts.every(context => {
    const sentence = normalize(context);
    if (!substantiveRelation(entry, context) || negation.test(sentence) || conditional.test(sentence) || denied.test(sentence)) return false;
    // A quoted question, an indirect question, or an explicitly negative answer
    // cannot establish that a procedural step actually happened.
    if (sentence.includes('?') || /\b(?:pergunt\w*|question\w*|indag\w*)\b.{0,100}\b(?:se|sobre)\b/u.test(sentence) ||
      /\b(?:respondeu|informou|esclareceu|afirmou|concluiu)\s+(?:que\s+)?nao(?:[.!?,;:]|\s*$)/u.test(sentence)) return false;
    if (/\b(?:pode|podera|deve|devera|pede|pedido|espera|risco de|possibilidade de)\b.{0,45}\b(?:condenad|condenacao|absolvid|absolvicao)/u.test(sentence)) return false;
    return situationPatterns[item.situacao_juridica].test(sentence);
  });
}

const publicationAction = /\b(?:publicacao|reportagem|noticia|materia|texto|jornal|portal)\s+(?:(?:analisad[ao]|original|enviad[ao]|jornalistic[ao]|na internet|em rede social)\s+)?(?:divulga|divulgou|publica|publicou|expoe|expos|exibe|exibiu|identifica|identificou|revela|revelou|acusa|acusou|imputa|imputou|atribui|atribuiu|ofende|ofendeu|injuria|injuriou|difama|difamou|incita|incitou|promove|promoveu|reproduz|reproduziu|omite|omitiu|copia|copiou)\b/u;

function publicationRiskSupported(sentence) {
  const value = normalize(sentence);
  const action = publicationAction.exec(value);
  if (!action) return false;
  const continuation = value.slice(action.index + action[0].length).trim();
  // "O jornal publicou que X é investigado" attributes the event to X.
  // Publishing that report is not evidence of an offence by the newspaper.
  return !/^(?:(?:a|o|uma|um|as|os)\s+)?(?:que\b|se\b|sobre\b|investigacao\b|suspeita\b|denuncia\b|apuracao\b|processo\b|inquerito\b|condenacao\b|absolvicao\b|acusacao contra\b)/u.test(continuation);
}

/** Fail closed for legal errors, independently of the journalistic result. */
export function validateLegalContext(raw, { text = '', candidates = [], now = Date.now() } = {}) {
  if (!fresh(now) || typeof text !== 'string' || !raw || typeof raw !== 'object' || Array.isArray(raw) ||
    Object.keys(raw).some(key => !['aplicavel', 'referencias'].includes(key)) ||
    raw.aplicavel !== true || !Array.isArray(raw.referencias) || raw.referencias.length > maxReferences) return empty();
  const offered = new Set(candidates.map(candidate => candidate.id));
  const eligible = new Map(legalCandidates(text, { now }).filter(entry => offered.has(entry.id)).map(entry => [entry.id, entry]));
  const seen = new Set();
  const referencias = [];
  for (const value of raw.referencias) {
    const parsed = selectionSchema.safeParse(value);
    if (!parsed.success) continue;
    const item = parsed.data;
    const entry = eligible.get(item.id);
    const source = entries.find(candidate => candidate.id === item.id);
    if (!entry || !source || seen.has(item.id) || !entry.categorias.includes(item.categoria) ||
      !text.includes(item.trecho_noticia) || !substantiveRelation(source, item.trecho_noticia) ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(item.trecho_noticia)) continue;
    // At least one complete original sentence must support this legal topic.
    // Checking original context also prevents cropping a negated incident.
    const groundedSentences = [...segmenter.segment(text)].map(part => part.segment.trim()).filter(sentence =>
      (item.trecho_noticia.includes(sentence) || sentence.includes(item.trecho_noticia)) && substantiveRelation(source, sentence));
    if (!groundedSentences.length) continue;
    // Separate an attributed allegation in a story from a risk in the publication.
    if (item.categoria === 'publicacao' && !groundedSentences.some(publicationRiskSupported)) continue;
    const situationVerified = supportedSituation(item, text, source);
    const situation = situationVerified ? item.situacao_juridica : 'Situação não identificada';
    seen.add(item.id);
    referencias.push({
      id: entry.id, lei: entry.lei, artigo: entry.artigo, categoria: item.categoria,
      explicacao: entry.explicacao,
      relacao_com_noticia: 'Pode estar relacionado ao dispositivo pelo seguinte trecho da notícia: “' + item.trecho_noticia + '”. Critério a verificar: ' + entry.criterio_pertinencia,
      consequencias: entry.consequencias,
      situacao_juridica: situation, trecho_situacao: situationVerified ? item.trecho_situacao : '',
      ressalvas: entry.ressalvas + (situationVerified ? '' : ' A etapa processual não pôde ser vinculada com segurança a este trecho.') +
        ' A aplicação depende das circunstâncias e das provas; esta análise não afirma culpa nem substitui decisão da autoridade competente.',
      fonte_oficial: entry.fonte_oficial, verificada: true,
      verificado_em: entry.verificado_em, revisar_ate: entry.revisar_ate,
      trecho_noticia: item.trecho_noticia
    });
  }
  return { aplicavel: referencias.length > 0, referencias };
}
