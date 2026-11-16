import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SINAIS_FALSO, SINAIS_CONFIAVEL, analisarTextoLocalmente, extrairInformacoesNoticia,
  analisarDimensoesNoticia, calcularVeredictoFinal, obterRotuloVeredicto, criarAnaliseVisual
} from '../services/verification-indicators.js';
import { analisarConteudo } from '../services/analysis.js';
import { localSections } from '../services/explanation.js';
import { reviewedArticle } from './fixtures/reviewed-article.js';

const question = 'flavio bolsonaro teve um romance com o lula?';

test('source dimension explicitly evaluates references inside the text separately from its publication URL', () => {
  const source = criarAnaliseVisual('Um vídeo de um domo não demonstra que a Terra seja plana.').dimensoes.fonte;
  assert.equal(source.escopo, 'referencias_no_texto');
  assert.match(source.descricao, /no corpo do texto/);
  assert.match(source.descricao, /URL da publicação.*separadamente/);
  assert.doesNotMatch(source.descricao, /Não há link de fonte no conteúdo enviado/);
});
const fact = 'A prefeitura anunciou uma nova escola em 2025.';
const quietNlp = async () => ({ indicadores: [], comparacoes: [], tensorflow: { disponivel: false, metodo: 'teste local', modelo: null, limitacoes: [] } });
const localExplain = async result => ({ secoes: localSections(result), geracao: { status: 'local' } });
const options = extra => ({ check: async () => ({ apiDisponivel: true, resultados: [] }), nlp: quietNlp, explain: localExplain, ...extra });
const review = (text = fact, rating = 'Verdadeiro', id = 'e1') => ({
  id, texto_verificado: text, avaliacao: rating, url_verificacao: 'https://aosfatos.org/noticias/' + id,
  verificador: 'Aos Fatos', data_verificacao: '2025-08-10T12:00:00Z', data_alegacao: '2025-08-01', titulo_verificacao: 'Checagem publicada'
});
function validatedClaim(extra = {}) {
  return {
    id: 'a1', tipo: 'fato', texto: fact, veredito: 'Conteúdo verdadeiro', consultaCompleta: true, conflito: false,
    evidencias: [{ ...review(), utilizavel: true, correspondencia: 'exata', fonteReconhecida: true, classificacaoPublicada: 'Conteúdo verdadeiro' }],
    ...extra
  };
}

test('a neutral question keeps its dimensions without inventing a default percentage', () => {
  const visual = criarAnaliseVisual(question);
  assert.equal(visual.porcentagem, null); assert.equal(visual.veredito, 'Indicadores indisponíveis');
  assert.equal(visual.confianca, null); assert.equal(visual.fonte, 'local');
  assert.equal(visual.escopo, 'padroes_textuais');
  assert.equal(visual.quantidadePalavras, 8); assert.equal(visual.quantidadeCaracteres, question.length);
  assert.deepEqual(visual.analiseLocal.alertasFalso, []); assert.deepEqual(visual.analiseLocal.alertasConfiavel, []);
  assert.equal(visual.analiseLocal.pesoFalso, 0); assert.equal(visual.analiseLocal.pesoConfiavel, 0);
  // F04 suppresses public numeric cards without factual eligibility; prose remains.
  assert.equal(visual.dimensoes.sensacionalismo.pontuacao, null); assert.equal(visual.dimensoes.fonte.pontuacao, null);
  assert.equal(visual.dimensoes.estrutura.pontuacao, null); assert.match(visual.dimensoes.estrutura.descricao, /^8 palavra/);
  assert.equal(visual.dimensoes.evidencia.verificacaoExterna, false); assert.equal(visual.heuristico, true);
  assert.match(visual.aviso, /heurística/); assert.match(visual.aviso, /Não é probabilidade de verdade nem prova/);
});

test('alert weights and sensationalism remain available without a short-text scoring penalty', () => {
  assert.equal(SINAIS_FALSO.length, 24); assert.equal(SINAIS_CONFIAVEL.length, 10);
  const local = analisarTextoLocalmente('URGENTE!!!');
  assert.equal(local.pesoFalso, 18); assert.equal(local.pesoConfiavel, 0); assert.equal(local.porcentagemLocal, null);
  assert.equal(local.indiceDisponivel, false);
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

test('length alone contributes no points or default percentage', () => {
  const medium = analisarTextoLocalmente('calmo '.repeat(51));
  const long = analisarTextoLocalmente('calmo '.repeat(101));
  assert.equal(medium.pesoConfiavel, 0); assert.equal(long.pesoConfiavel, 0);
  assert.equal(medium.porcentagemLocal, null); assert.equal(long.porcentagemLocal, null);
  assert.equal(criarAnaliseVisual('calmo '.repeat(101)).confianca, null);
});

test('official attribution, dates, references and structure retain original dimension scores', () => {
  const text = 'Segundo a Prefeitura de Toledo, em 10 de maio de 2025 foi divulgado um comunicado oficial com orçamento de R$ 10 milhões. Fonte: https://g1.globo.com/pr/noticia.';
  const local = analisarTextoLocalmente(text); const dimensions = analisarDimensoesNoticia(text, local);
  assert.equal(local.pesoConfiavel, 41); assert.equal(local.porcentagemLocal, null);
  // F11 removes the former 15 points for a publisher name inside the URL.
  assert.equal(dimensions.sensacionalismo.pontuacao, 0); assert.equal(dimensions.fonte.pontuacao, 85);
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

test('visual labels describe patterns and published ratings never change the text index', () => {
  assert.equal(obterRotuloVeredicto(null), 'Indicadores indisponíveis');
  for (const [score, label] of [[0,'Mais padrões de alerta'],[19,'Mais padrões de alerta'],[20,'Padrões que pedem atenção'],[39,'Padrões que pedem atenção'],[40,'Padrões mistos no texto'],[54,'Padrões mistos no texto'],[55,'Alguns sinais formais no texto'],[74,'Alguns sinais formais no texto'],[75,'Mais referências e sinais formais'],[100,'Mais referências e sinais formais']]) assert.equal(obterRotuloVeredicto(score), label);
  const local = analisarTextoLocalmente(fact);
  for (const rating of ['Verdadeiro', 'Falso', 'Parcialmente verdadeiro', 'Adulterado', 'Distorcido', 'Fora de contexto', 'Enganoso']) {
    const index = calcularVeredictoFinal({ encontrados: true, resultados: [review(fact, rating)] }, local);
    assert.equal(index.porcentagem, null);
    assert.equal(index.confianca, null);
    assert.match(index.explicacao, /Não representa probabilidade de verdade/);
  }
});

test('validated evidence changes evidence counts separately from the local text index', () => {
  const valid = criarAnaliseVisual(fact, { classificacao: 'Conteúdo verdadeiro', afirmacoes: [validatedClaim()] });
  assert.equal(valid.porcentagem, null); assert.equal(valid.fonte, 'local'); assert.equal(valid.confianca, null);
  assert.equal(valid.dimensoes.evidencia.verificacaoExterna, true); assert.equal(valid.dimensoes.evidencia.quantidade, 1);
  for (const changes of [{ utilizavel: false }, { correspondencia: 'relacionada' }, { fonteReconhecida: false }, { classificacaoPublicada: 'Sem evidências suficientes' }]) {
    const claim = validatedClaim(); claim.evidencias[0] = { ...claim.evidencias[0], ...changes };
    const result = criarAnaliseVisual(fact, { classificacao: 'Conteúdo verdadeiro', afirmacoes: [claim] });
    assert.equal(result.porcentagem, null); assert.equal(result.fonte, 'local');
    assert.equal(result.dimensoes.evidencia.verificacaoExterna, false);
  }
});

test('all six evidence classifications retain a descriptive index instead of a factual percentage', () => {
  for (const classification of ['Conteúdo verdadeiro', 'Falso', 'Parcialmente verdadeiro', 'Adulterado', 'Distorcido', 'Fora de contexto']) {
    const claim = validatedClaim({ veredito: classification });
    claim.evidencias[0].classificacaoPublicada = classification;
    claim.evidencias[0].avaliacao = classification;
    const result = criarAnaliseVisual(fact, { classificacao: classification, afirmacoes: [claim] });
    assert.equal(result.porcentagem, null, classification);
    assert.equal(result.confianca, null, classification);
    assert.equal(result.veredito, 'Indicadores indisponíveis', classification);
    assert.equal(result.dimensoes.evidencia.quantidade, 1, classification);
    assert.equal(result.escopo, 'padroes_textuais', classification);
  }
});

test('incomplete searches, conflicts and mixed factual conclusions never promote the old gauge', () => {
  for (const context of [
    { classificacao: 'Conteúdo verdadeiro', incompleta: true, afirmacoes: [validatedClaim()] },
    { classificacao: 'Conteúdo verdadeiro', afirmacoes: [validatedClaim({ consultaCompleta: false })] },
    { classificacao: 'Conteúdo verdadeiro', afirmacoes: [validatedClaim({ conflito: true })] },
    { classificacao: 'Sem evidências suficientes', afirmacoes: [validatedClaim()] }
  ]) {
    const result = criarAnaliseVisual(fact, context);
    assert.equal(result.porcentagem, null); assert.equal(result.fonte, 'local');
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
  assert.equal(result.analiseVisual.porcentagem, null); assert.equal(result.analiseVisual.veredito, 'Indicadores indisponíveis');
  assert.equal(result.analiseVisual.quantidadePalavras, 8); assert.equal(receivedVisual, result.analiseVisual);
  assert.equal(result.analiseLocal, result.analiseVisual.analiseLocal); assert.equal(result.dimensoes, result.analiseVisual.dimensoes);
});

test('matching and related reviews or regional articles never alter the local text index', async () => {
  const exact = await analisarConteudo({ texto: fact }, options({ check: async () => ({ apiDisponivel: true, resultados: [review()] }) }));
  assert.equal(exact.veredito, 'Conteúdo verdadeiro'); assert.equal(exact.porcentagem, null); assert.equal(exact.analiseVisual.porcentagem, null);
  const related = await analisarConteudo({ texto: fact }, options({ check: async () => ({ apiDisponivel: true, resultados: [review('A prefeitura não anunciou uma nova escola em 2025.')] }) }));
  assert.equal(related.veredito, 'Sem evidências suficientes'); assert.equal(related.analiseVisual.porcentagem, null);
  const regional = await analisarConteudo({ texto: fact }, options({ buscarRegionais: async () => [reviewedArticle({ titulo: fact, fonte: 'Portal', url: 'https://regional.example.org/noticia' })] }));
  assert.equal(regional.noticiasRegionais.length, 1); assert.equal(regional.analiseVisual.porcentagem, null); assert.equal(regional.analiseVisual.fonte, 'local');
});

test('URL indicators analyze the extracted article text instead of scoring the pasted address', async () => {
  const result = await analisarConteudo({ link: 'https://noticias.example.org/materia' }, options({
    extract: async url => ({ url, texto: 'URGENTE!!! Uma notícia local foi publicada.', conteudoObtido: true })
  }));
  assert.equal(result.analiseVisual.texto, 'URGENTE!!! Uma notícia local foi publicada.');
  assert.equal(result.analiseVisual.porcentagem, null); assert.equal(result.analiseVisual.analiseLocal.alertasFalso.length, 3);
});

test('positive-only and negative-only signals do not become saturated 100 or 0 percentages', () => {
  const positive = analisarTextoLocalmente('Segundo a Prefeitura de Toledo, foi divulgado um comunicado oficial em 2025.');
  const negative = analisarTextoLocalmente('URGENTE!!! Compartilhe antes que apaguem esta mensagem.');
  assert.ok(positive.pesoConfiavel > 0); assert.equal(positive.pesoFalso, 0);
  assert.ok(negative.pesoFalso > 0); assert.equal(negative.pesoConfiavel, 0);
  for (const result of [positive, negative]) {
    assert.equal(result.indiceDisponivel, false);
    assert.equal(result.porcentagemLocal, null);
  }
});
