import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { JSDOM } from 'jsdom';
import { createApp } from '../server.js';
import { analisarConteudo } from '../services/analysis.js';
import { generateExplanation } from '../services/explanation.js';
import { renderAnalysis, renderHistoryAnalysis } from '../public/js/result-renderer.js';

const options = {
  check: async () => ({ apiDisponivel: true, resultados: [] }),
  nlp: async () => ({ indicadores: [], comparacoes: [], tensorflow: { disponivel: false, limitacoes: [] } }),
  explain: result => generateExplanation(result, { enabled: false })
};

test('índice textual exige evidência factual elegível além do contraste e não produz valores padrão', async () => {
  const inputs = [
    ['URGENTE!!!', null],
    ['A prefeitura anunciou uma nova escola em 2025.', null],
    ['Segundo a Prefeitura de Toledo, foi divulgado um comunicado oficial em 2025.', null],
    ['URGENTE!!! Segundo a Prefeitura de Toledo, foi divulgado um comunicado oficial em 2025.', null]
  ];
  for (const [texto, expected] of inputs) {
    const result = await analisarConteudo({ texto }, options);
    assert.equal(result.porcentagem, null);
    assert.equal(result.confianca, null);
    assert.equal(result.analiseVisual.porcentagem, expected);
    assert.equal(result.analiseVisual.escopo, 'padroes_textuais');
    assert.equal(result.analiseVisual.confianca, null);
    assert.equal(result.analiseVisual.fonte, 'local');
    assert.equal(result.resultados.length, 0);
    assert.ok(['Sem evidências suficientes', 'Não verificável'].includes(result.veredito));
  }
});

test('HTTP e interface distinguem índice textual da conclusão factual sem checagens', async t => {
  const texto = 'Segundo a Prefeitura de Toledo, foi divulgado um comunicado oficial em 2025.';
  const app = createApp({
    analyze: body => analisarConteudo(body, { ...options,
      extract: async url => ({ url, texto, conteudoObtido: true })
    }),
    dbReady: () => false, rateLimits: false
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/verificar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ link: 'https://example.org/noticia' })
  });
  assert.equal(response.status, 200);
  const { dados } = await response.json();
  assert.equal(dados.porcentagem, null);
  assert.equal(dados.analiseVisual.porcentagem, null);
  assert.equal(dados.resultados.length, 0);
  assert.equal(dados.veredito, 'Sem evidências suficientes');
  const dom = new JSDOM('<div id="result"></div>'), previous = globalThis.document;
  globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  const root = document.getElementById('result');
  for (const record of [dados, { resultado: dados }, { ...dados, porcentagem: null }]) {
    (record.resultado ? renderHistoryAnalysis : renderAnalysis)(root, record);
    assert.equal(root.querySelector('.meter-percentage'), null);
    assert.equal(root.querySelector('.credibility-meter'), null);
    assert.equal(root.querySelector('.analysis-card strong'), null);
    assert.equal(root.querySelector('.text-patterns-status'),null);
    assert.match(root.querySelector('.ai-estimate-summary').textContent,/Estimativa indisponível/);
    assert.equal(root.querySelector('.factual-summary h3').textContent, 'Sem evidências suficientes');
    assert.equal(root.querySelector('.progress-bar'), null);
  }
});
