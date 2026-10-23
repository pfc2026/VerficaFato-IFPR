import { z } from 'zod';
import { obterConteudoDaUrl } from './extraction.js';
import { verificarNoticia } from './fact-check.js';
import { extractClaims, languageIndicators } from './claims.js';
import { analyzeLanguage } from './tensorflow.js';
import { evaluateClaim, consolidate, VERDICTS } from './evidence.js';
import { generateExplanation } from './explanation.js';
import { HttpError } from './errors.js';
import { createLimiter } from './limits.js';
import { criarAnaliseVisual } from './verification-indicators.js';

const inputSchema = z.object({
  texto:z.string().trim().max(20000).optional(),link:z.string().trim().max(2048).optional(),
  cidade:z.string().trim().max(80).optional(),categoria:z.string().trim().max(80).optional()
}).strict().superRefine((body,context)=>{
  if (!!body.texto === !!body.link) context.addIssue({code:'custom',message:'Envie somente texto ou link.'});
  if (body.texto && body.texto.length < 10) context.addIssue({code:'custom',message:'Envie pelo menos 10 caracteres.'});
});
const run = createLimiter(3,12);
function validateInput(body) {
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400,'Envie texto de 10 a 20.000 caracteres ou um link, em campos de texto válidos.','INVALID_INPUT');
  return parsed.data;
}
function safeNews(records) {
  return (Array.isArray(records)?records:[]).slice(0,3).flatMap(n => {
    try {
      const url = new URL(n.url);
      if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return [];
      return [{titulo:String(n.titulo||'').slice(0,500),texto:String(n.texto||'').slice(0,260),url:url.href,fonte:String(n.fonte||'').slice(0,200),data_publicacao:n.data_publicacao||null}];
    } catch { return []; }
  });
}
export async function analisarConteudo(body,options={}) {
  const input = validateInput(body);
  const deadline = AbortSignal.timeout(45000);
  const signal = options.signal ? AbortSignal.any([options.signal,deadline]) : deadline;
  if (signal.aborted) throw new HttpError(504,'A análise foi cancelada ou ultrapassou o tempo permitido.','ANALYSIS_TIMEOUT');
  let onAbort;
  const cancelled = new Promise((_,reject)=>{ onAbort=()=>reject(new HttpError(504,'A análise foi cancelada ou ultrapassou o tempo permitido.','ANALYSIS_TIMEOUT')); signal.addEventListener('abort',onAbort,{once:true}); });
  try {
    return await Promise.race([run(()=>{ signal.throwIfAborted();return analyze(input,{...options,signal}); }),cancelled]);
  } finally { signal.removeEventListener('abort',onAbort); }
}
async function analyze(input,{
  extract = obterConteudoDaUrl,check = verificarNoticia,nlp = analyzeLanguage,explain = generateExplanation,buscarRegionais,signal
}={}) {
  const entrada = input.texto || input.link;
  const isUrl = !!input.link || /^https?:\/\/\S+$/i.test(entrada);
  let noticia = {url:'',conteudoObtido:false};
  let text = entrada;
  if (isUrl) { noticia = await extract(entrada,{signal}); text = noticia.texto; }
  if (typeof text !== 'string' || text.length < 10 || text.length > 20000) throw new HttpError(422,'O conteúdo extraído precisa ter entre 10 e 20.000 caracteres.','INVALID_CONTENT');
  const { claims, omitted } = extractClaims(text);
  const facts = claims.filter(c=>c.tipo === 'fato');
  const limitations = [
    'A extração de afirmações usa regras e pode omitir contexto, confundir opiniões ou não separar todos os fatos.',
    'A busca Google cobre apenas checagens indexadas; resultados vazios não indicam verdade ou falsidade.',
    'A equivalência factual não é inferida por similaridade. Somente correspondência textual com data válida e avaliação reconhecida pode fundamentar uma classificação automática atribuída à fonte.'
  ];
  if (omitted) limitations.push(omitted + ' trecho(s) foram omitidos por serem curtos, numéricos ou excederem oito afirmações/2.000 caracteres por afirmação; não foram verificados.');
  const [checks,regionalResult] = await Promise.all([
    Promise.all(facts.map(async claim => {
      try { return {id:claim.id,...await check(claim.texto,{signal})}; }
      catch { return {id:claim.id,resultados:[],apiDisponivel:false,erroAPI:'A consulta Google falhou temporariamente.',status:'indisponivel'}; }
    })),
    buscarRegionais ? Promise.resolve().then(()=>buscarRegionais(text,noticia.url)).then(safeNews).catch(()=>{limitations.push('O acervo regional não pôde ser consultado.');return [];}) : Promise.resolve([])
  ]);
  const reviews = [...new Map(checks.flatMap(c=>c.resultados || []).map(r=>[r.id,r])).values()].slice(0,60);
  let language;
  try { language = await nlp(text,claims,reviews); }
  catch { language={indicadores:languageIndicators(text),tensorflow:{disponivel:false,metodo:'indisponível',modelo:null,limitacoes:['TensorFlow.js não pôde ser carregado.']},comparacoes:[]}; }
  limitations.push(...(language.tensorflow?.limitacoes || []));
  if (checks.some(c=>!c.apiDisponivel)) limitations.push(...new Set(checks.filter(c=>!c.apiDisponivel).map(c=>c.erroAPI || 'A consulta Google não foi concluída.')));
  if (regionalResult.length) limitations.push('Notícias do acervo regional são referências de contexto, sem confirmar automaticamente a afirmação.');
  const afirmacoes = claims.map(claim=>{
    const checkResult = checks.find(c=>c.id === claim.id);
    const evaluated = evaluateClaim(claim,checkResult?.resultados || [],language.comparacoes);
    evaluated.consultaCompleta = claim.tipo === 'fato' ? checkResult?.apiDisponivel === true : true;
    // Partial API failures must not hide contradictory reviews that were not retrieved.
    if (!evaluated.consultaCompleta && evaluated.tipo === 'fato') {
      evaluated.veredito = VERDICTS.UNKNOWN;
      evaluated.justificativa = 'A consulta às checagens não foi concluída. Os resultados parciais abaixo não sustentam uma conclusão.';
    }
    return evaluated;
  });
  const incomplete = omitted > 0 || checks.some(c=>!c.apiDisponivel);
  const veredito = consolidate(afirmacoes,{incomplete});
  const justificativa = veredito === VERDICTS.UNKNOWN ?
    'Uma ou mais afirmações permanecem sem evidência suficiente, têm avaliações conflitantes ou não puderam ser verificadas por completo.' :
    veredito === VERDICTS.UNVERIFIABLE ? 'Os trechos identificados não apresentam um fato objetivamente verificável nos termos enviados.' :
    'As afirmações verificáveis analisadas têm avaliações publicadas correspondentes. Confira as fontes e o contexto de cada checagem.';
  const fontes = [
    ...reviews.map(r=>({id:r.id,titulo:r.titulo_verificacao || r.texto_verificado,url:r.url_verificacao,verificador:r.verificador,data:r.data_verificacao,tipo:'checagem'})),
    ...regionalResult.map((n,i)=>({id:'n'+i,titulo:n.titulo,url:n.url,verificador:n.fonte,data:n.data_publicacao,tipo:'noticia'}))
  ];
  const analiseVisual = criarAnaliseVisual(text, { afirmacoes, classificacao: veredito, incompleta: incomplete });
  const result = {
    schemaVersion:2,tipoEntrada:isUrl?'url':'texto',veredito,classificacao:veredito,porcentagem:null,confianca:null,
    justificativa,afirmacoes,resultados:reviews,encontrados:reviews.length > 0,quantidade:reviews.length,
    apiDisponivel:checks.length ? checks.every(c=>c.apiDisponivel) : null,
    erroAPI:checks.find(c=>!c.apiDisponivel)?.erroAPI,
    fonte:reviews.length?'api':'sem_evidencias',noticia,noticiasRegionais:regionalResult,
    analiseLinguagem:language,fontes,limitacoes:[...new Set(limitations)],
    analiseVisual, analiseLocal: analiseVisual.analiseLocal, dimensoes: analiseVisual.dimensoes
  };
  let generated;
  try { generated = await explain(result,{signal}); }
  catch { generated = await generateExplanation(result,{enabled:false}); }
  result.secoes = generated.secoes;
  result.geracao = generated.geracao;
  result.resumo = result.secoes.resumo;
  if (result.geracao.status === 'local' && process.env.ENABLE_AI_EXPLANATION === 'true') {
    result.limitacoes.push(result.geracao.motivo);
    result.secoes.limitacoes = result.limitacoes.join('\n');
  }
  result.explicacao = [
    ['Resumo da análise','resumo'],['Resultado da verificação','resultado'],['O que encontramos','encontramos'],
    ['Análise de linguagem','linguagem'],['Orientação ao usuário','orientacao'],['Limitações','limitacoes']
  ].map(([label,key])=>label+'\n'+result.secoes[key]).join('\n\n');
  return result;
}
