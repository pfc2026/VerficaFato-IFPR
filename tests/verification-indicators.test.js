import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SINAIS_FALSO, SINAIS_CONFIAVEL, analisarTextoLocalmente, extrairInformacoesNoticia,
  analisarDimensoesNoticia, calcularVeredictoFinal, obterRotuloVeredicto, criarAnaliseVisual
} from '../services/verification-indicators.js';
import { analisarConteudo } from '../services/analysis.js';
import { localSections } from '../services/explanation.js';

const question = 'flavio bolsonaro teve um romance com o lula?';
const fact = 'A prefeitura anunciou uma nova escola em 2025.';
const quietNlp = async () => ({ indicadores: [], comparacoes: [], tensorflow: { disponivel: false, metodo: 'teste local', modelo: null, limitacoes: [] } });
const localExplain = async result => ({ secoes: localSections(result), geracao: { status: 'local' } });
const options = extra => ({ check: async () => ({ apiDisponivel: true, resultados: [] }), nlp: quietNlp, explain: localExplain, ...extra });
const review = (text = fact, rating = 'Verdadeiro', id = 'e1') => ({
  id, texto_verificado: text, avaliacao: rating, url_verificacao: 'https://aosfatos.org/noticias/' + id,
  verificador: 'Aos Fatos', data_verificacao: '2025-08-10T12:00:00Z', titulo_verificacao: 'Checagem publicada'
});
function validatedClaim(extra = {}) {
  return {
    id: 'a1', tipo: 'fato', texto: fact, veredito: 'Verdadeiro', consultaCompleta: true, conflito: false,
    evidencias: [{ ...review(), utilizavel: true, correspondencia: 'exata', fonteReconhecida: true, classificacaoPublicada: 'Verdadeiro' }],
    ...extra
  };
}

test('the original neutral-question scenario restores 50%, zero signals and dimensions 0/0/8', () => {
  const visual = criarAnaliseVisual(question);
  assert.equal(visual.porcentagem, 50); assert.equal(visual.veredito, 'Inconclusivo / Verificar');
  assert.equal(visual.confianca, 'baixa'); assert.equal(visual.fonte, 'local');
  assert.equal(visual.quantidadePalavras, 8); assert.equal(visual.quantidadeCaracteres, question.length);
  assert.deepEqual(visual.analiseLocal.alertasFalso, []); assert.deepEqual(visual.analiseLocal.alertasConfiavel, []);
  assert.equal(visual.analiseLocal.pesoFalso, 0); assert.equal(visual.analiseLocal.pesoConfiavel, 0);
  assert.equal(visual.dimensoes.sensacionalismo.pontuacao, 0); assert.equal(visual.dimensoes.fonte.pontuacao, 0);
  assert.equal(visual.dimensoes.estrutura.pontuacao, 8); assert.match(visual.dimensoes.estrutura.descricao, /^8 palavra/);
  assert.equal(visual.dimensoes.evidencia.verificacaoExterna, false); assert.equal(visual.heuristico, true);
  assert.match(visual.aviso, /heurística/); assert.match(visual.aviso, /não prova definitiva/);
});

test('original alert weights, short-text penalty and sensationalism parameters are preserved', () => {
  assert.equal(SINAIS_FALSO.length, 24); assert.equal(SINAIS_CONFIAVEL.length, 10);
  const local = analisarTextoLocalmente('URGENTE!!!');
  assert.equal(local.pesoFalso, 26); assert.equal(local.pesoConfiavel, 0); assert.equal(local.porcentagemLocal, 8);
  assert.equal(local.alertasFalso.length, 3);
  const dimensions = analisarDimensoesNoticia('URGENTE!!!', local);
  assert.equal(dimensions.sensacionalismo.pontuacao, 63); assert.equal(dimensions.sensacionalismo.nivel, 'alto');
  assert.equal(dimensions.fonte.pontuacao, 0); assert.equal(dimensions.estrutura.pontuacao, 8);
});

test('occurrence caps and repeated calls preserve the original deterministic results', () => {
  const repeated = 'URGENTE '.repeat(10);
  const first = analisarTextoLocalmente(repeated);
  assert.equal(first.pesoFalso, 42); assert.equal(first.alertasFalso.length, 2);
  assert.equal(first.alertasFalso[0].ocorrencias, 10);
  assert.deepEqual(analisarTextoLocalmente(repeated), first);
});

test('original length bonuses and local-score ceiling remain unchanged', () => {
  const medium = analisarTextoLocalmente('calmo '.repeat(51));
  const long = analisarTextoLocalmente('calmo '.repeat(101));
  assert.equal(medium.pesoConfiavel, 4); assert.equal(long.pesoConfiavel, 8);
  assert.equal(medium.porcentagemLocal, 74); assert.equal(long.porcentagemLocal, 74);
  assert.equal(criarAnaliseVisual('calmo '.repeat(101)).confianca, 'baixa');
});

test('official attribution, dates, references and structure retain original dimension scores', () => {
  const text = 'Segundo a Prefeitura de Toledo, em 10 de maio de 2025 foi divulgado um comunicado oficial com orçamento de R$ 10 milhões. Fonte: https://g1.globo.com/pr/noticia.';
  const local = analisarTextoLocalmente(text); const dimensions = analisarDimensoesNoticia(text, local);
  assert.equal(local.pesoConfiavel, 50); assert.equal(local.porcentagemLocal, 74);
  assert.equal(dimensions.sensacionalismo.pontuacao, 0); assert.equal(dimensions.fonte.pontuacao, 100);
  assert.equal(dimensions.estrutura.pontuacao, 73);
  assert.deepEqual(dimensions.informacoes.datas, ['10 de maio de 2025']);
  assert.deepEqual(dimensions.informacoes.links, ['https://g1.globo.com/pr/noticia']);
});

test('original extracted keywords and filtered word count are preserved separately from header counters', () => {
  const extracted = extrairInformacoesNoticia(question);
  assert.equal(extracted.alegacaoPrincipal, question); assert.equal(extracted.quantidadePalavras, 5);
  assert.deepEqual(extracted.palavrasImportantes, ['bolsonaro', 'romance', 'flavio', 'teve', 'lula']);
  assert.deepEqual(extracted.entidades, []); assert.deepEqual(extracted.numeros, []); assert.deepEqual(extracted.datas, []);
  assert.equal(criarAnaliseVisual(question).quantidadePalavras, 8);
});

test('the original visual label thresholds and weighted API calculation are retained', () => {
  for (const [score, label] of [[0,'Provavelmente Falsa'],[19,'Provavelmente Falsa'],[20,'Tende a ser falsa'],[39,'Tende a ser falsa'],[40,'Inconclusivo / Verificar'],[54,'Inconclusivo / Verificar'],[55,'Tende a ser verdadeira'],[74,'Tende a ser verdadeira'],[75,'Provavelmente Verdadeira'],[100,'Provavelmente Verdadeira']]) assert.equal(obterRotuloVeredicto(score), label);
  const local = analisarTextoLocalmente(fact);
  assert.equal(calcularVeredictoFinal({ encontrados: true, resultados: [review()] }, local).porcentagem, 88);
  assert.equal(calcularVeredictoFinal({ encontrados: true, resultados: [review(fact, 'Falso')] }, local).porcentagem, 12);
});

test('visual API weighting accepts only complete modern validated evidence', () => {
  const valid = criarAnaliseVisual(fact, { classificacao: 'Verdadeiro', afirmacoes: [validatedClaim()] });
  assert.equal(valid.porcentagem, 88); assert.equal(valid.fonte, 'api'); assert.equal(valid.confianca, 'média');
  assert.equal(valid.dimensoes.evidencia.verificacaoExterna, true); assert.equal(valid.dimensoes.evidencia.quantidade, 1);
  for (const changes of [{ utilizavel: false }, { correspondencia: 'relacionada' }, { fonteReconhecida: false }, { classificacaoPublicada: 'Sem evidências suficientes' }]) {
    const claim = validatedClaim(); claim.evidencias[0] = { ...claim.evidencias[0], ...changes };
    const result = criarAnaliseVisual(fact, { classificacao: 'Verdadeiro', afirmacoes: [claim] });
    assert.equal(result.porcentagem, 50); assert.equal(result.fonte, 'local');
  }
});

test('incomplete searches, conflicts and mixed factual conclusions never promote the old gauge', () => {
  for (const context of [
    { classificacao: 'Verdadeiro', incompleta: true, afirmacoes: [validatedClaim()] },
    { classificacao: 'Verdadeiro', afirmacoes: [validatedClaim({ consultaCompleta: false })] },
    { classificacao: 'Verdadeiro', afirmacoes: [validatedClaim({ conflito: true })] },
    { classificacao: 'Sem evidências suficientes', afirmacoes: [validatedClaim()] }
  ]) {
    const result = criarAnaliseVisual(fact, context);
    assert.equal(result.porcentagem, 50); assert.equal(result.fonte, 'local');
  }
});

test('the analysis response exposes original indicators without replacing its factual classification', async () => {
  let receivedVisual;
  const result = await analisarConteudo({ texto: question }, options({
    check: async () => { throw new Error('Questions must not invoke a factual query.'); },
    explain: async data => { receivedVisual = data.analiseVisual; return localExplain(data); }
  }));
  assert.equal(result.veredito, 'Não verificável'); assert.equal(result.classificacao, 'Não verificável');
  assert.equal(result.porcentagem, null); assert.equal(result.confianca, null);
  assert.equal(result.analiseVisual.porcentagem, 50); assert.equal(result.analiseVisual.veredito, 'Inconclusivo / Verificar');
  assert.equal(result.analiseVisual.quantidadePalavras, 8); assert.equal(receivedVisual, result.analiseVisual);
  assert.equal(result.analiseLocal, result.analiseVisual.analiseLocal); assert.equal(result.dimensoes, result.analiseVisual.dimensoes);
});

test('real matching reviews feed visual weighting while related reviews and regional articles do not', async () => {
  const exact = await analisarConteudo({ texto: fact }, options({ check: async () => ({ apiDisponivel: true, resultados: [review()] }) }));
  assert.equal(exact.veredito, 'Verdadeiro'); assert.equal(exact.porcentagem, null); assert.equal(exact.analiseVisual.porcentagem, 88);
  const related = await analisarConteudo({ texto: fact }, options({ check: async () => ({ apiDisponivel: true, resultados: [review('A prefeitura não anunciou uma nova escola em 2025.')] }) }));
  assert.equal(related.veredito, 'Sem evidências suficientes'); assert.equal(related.analiseVisual.porcentagem, 50);
  const regional = await analisarConteudo({ texto: fact }, options({ buscarRegionais: async () => [{ titulo: fact, fonte: 'Portal', url: 'https://regional.example.org/noticia' }] }));
  assert.equal(regional.noticiasRegionais.length, 1); assert.equal(regional.analiseVisual.porcentagem, 50); assert.equal(regional.analiseVisual.fonte, 'local');
});

test('URL indicators analyze the extracted article text instead of scoring the pasted address', async () => {
  const result = await analisarConteudo({ link: 'https://noticias.example.org/materia' }, options({
    extract: async url => ({ url, texto: 'URGENTE!!! Uma notícia local foi publicada.', conteudoObtido: true })
  }));
  assert.equal(result.analiseVisual.texto, 'URGENTE!!! Uma notícia local foi publicada.');
  assert.equal(result.analiseVisual.porcentagem, 8); assert.equal(result.analiseVisual.analiseLocal.alertasFalso.length, 3);
});