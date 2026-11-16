import test from 'node:test';
import assert from 'node:assert/strict';
import { analisarConteudo } from '../services/analysis.js';
import { generateExplanation } from '../services/explanation.js';

const statement = 'A prefeitura anunciou uma nova escola em 2025.';
const options = {
  check: async () => ({ apiDisponivel: true, resultados: [] }),
  nlp: async () => ({ indicadores: [], comparacoes: [], tensorflow: { disponivel: true, comparacoesExecutadas: 0, modelo: null, limitacoes: [] } }),
  explain: result => generateExplanation(result, { enabled: false })
};
async function generated(base, feedback, references = []) {
  return generateExplanation(base, {
    enabled: true, provider: 'gemini', apiKey: 'offline-fixture', model: 'gemini-fixture',
    fetchImpl: async (_url, init) => {
      const fields = JSON.parse(init.body).generationConfig.responseFormat.text.schema.properties;
      const output = {
        resumo: fields.resumo.enum[0], orientacao: fields.orientacao.enum[0], destaques: [],
        feedback: typeof feedback === 'function' ? feedback(fields) : feedback,
        referencias: references, classificacao: base.veredito, contexto_juridico: { aplicavel: false, referencias: [] }
      };
      return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify(output) }] } }] }));
    }
  });
}

for (const feedback of [
  'O Instituto Horizonte confirmou que a prefeitura inaugurou uma escola em Marte.',
  'A notícia não passa de uma mentira e precisa ser descartada.',
  'Não há dúvida de que inventaram essa história para enganar o público.',
  'Pode confiar: a história aconteceu exatamente como foi contada.',
  'A checagem comprovou uma fraude municipal, embora o resultado geral permaneça inconclusivo.'
]) test('F03 rejects arbitrary factual prose: ' + feedback, async () => {
  const base = await analisarConteudo({ texto: statement }, options);
  const before = structuredClone(base);
  const result = await generated(base, feedback);
  assert.equal(result.geracao.status, 'local');
  assert.equal(result.geracao.estado, 'indisponivel');
  assert.equal(result.geracao.codigo, 'AI_INVALID_RESPONSE');
  assert.ok(!JSON.stringify(result).includes(feedback));
  assert.deepEqual(base, before);
});

test('F03 existing related source ID cannot authorize invented prose', async () => {
  const base = await analisarConteudo({ texto: statement }, options);
  base.fontes = [{ id: 'e1', tipo: 'checagem', titulo: 'Checagem relacionada', url: 'https://aosfatos.org/noticias/relacionada', utilizada: false }];
  const feedback = 'A fonte indicada comprovou que o Instituto Horizonte construiu uma escola em Marte.';
  const result = await generated(base, feedback, ['e1']);
  assert.equal(result.geracao.status, 'local');
  assert.ok(!JSON.stringify(result).includes(feedback));
});

test('F03 permitted selection resolves useful exact server text with attribution preserved', async () => {
  const base = await analisarConteudo({ texto: statement }, options);
  let selected;
  const result = await generated(base, fields => {
    assert.ok(Array.isArray(fields.feedback.enum));
    selected = fields.feedback.enum[0];
    return selected;
  });
  assert.equal(result.geracao.status, 'ia');
  assert.equal(result.feedbackGemini.texto, selected);
  assert.match(result.feedbackGemini.texto, /não|insuficientes/);
  assert.deepEqual(result.feedbackGemini.referencias, []);
  assert.equal(result.secoes.resultado, base.secoes.resultado);
});

test('F08 unexpected explanation exception preserves verdict and reports unavailability', async () => {
  const result = await analisarConteudo({ texto: statement }, { ...options, explain: async () => { throw Error('PRIVATE_PROVIDER_DETAIL'); } });
  assert.equal(result.veredito, 'Sem evidências suficientes');
  assert.equal(result.geracao.status, 'local');
  assert.equal(result.geracao.estado, 'indisponivel');
  assert.equal(result.geracao.codigo, 'AI_UNEXPECTED_ERROR');
  assert.equal(result.servicos.gemini.status, 'indisponivel');
  assert.equal(result.feedbackGemini.estado, 'indisponivel');
  assert.ok(!JSON.stringify(result).includes('PRIVATE_PROVIDER_DETAIL'));
  assert.ok(!JSON.stringify(result).includes('IA opcional não configurada'));
});

test('F03 conclusive explanation uses eligible evidence and preserves the published attribution', async () => {
  const review = {
    id: 'e1', texto_verificado: statement, avaliacao: 'Verdadeiro',
    url_verificacao: 'https://aosfatos.org/noticias/checagem-escola',
    verificador: 'Aos Fatos', titulo_verificacao: 'Checagem publicada',
    data_verificacao: '2025-08-10T12:00:00Z', data_alegacao: '2025-08-01'
  };
  const base = await analisarConteudo({ texto: statement }, {
    ...options, check: async () => ({ apiDisponivel: true, resultados: [review] })
  });
  assert.equal(base.veredito, 'Conteúdo verdadeiro');
  const before = structuredClone(base);
  const result = await generated(base, fields => fields.feedback.enum[0], ['e1']);
  assert.equal(result.geracao.status, 'ia');
  assert.match(result.feedbackGemini.texto, /atribuída às checagens publicadas/);
  assert.equal(result.feedbackGemini.referencias[0].url, review.url_verificacao);
  assert.equal(result.feedbackGemini.referencias[0].verificador, review.verificador);
  assert.equal(result.secoes.resultado, base.secoes.resultado);
  assert.deepEqual(base, before);
});
