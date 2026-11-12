import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { JSDOM } from 'jsdom';
import { createApp } from '../server.js';
import { analisarConteudo } from '../services/analysis.js';
import { generateExplanation } from '../services/explanation.js';
import { renderAnalysis } from '../public/js/result-renderer.js';

const options = {
  check: async () => ({ apiDisponivel: true, resultados: [] }),
  nlp: async () => ({ indicadores: [], comparacoes: [], tensorflow: { disponivel: false, limitacoes: [] } }),
  explain: result => generateExplanation(result, { enabled: false })
};

test('estimativa sem checagens varia com os sinais reais do texto e preserva a conclusão factual', async () => {
  const inputs = [
    ['URGENTE!!!', 8],
    ['A prefeitura anunciou uma nova escola em 2025.', 50],
    ['Segundo a Prefeitura de Toledo, foi divulgado um comunicado oficial em 2025.', 74]
  ];
  for (const [texto, expected] of inputs) {
    const result = await analisarConteudo({ texto }, options);
    assert.equal(result.porcentagem, expected);
    assert.equal(result.porcentagem, result.analiseVisual.porcentagem);
    assert.equal(result.confianca, result.analiseVisual.confianca);
    assert.equal(result.analiseVisual.fonte, 'local');
    assert.equal(result.resultados.length, 0);
    assert.ok(['Sem evidências suficientes', 'Não verificável'].includes(result.veredito));
  }
});

test('HTTP e interface exibem o mesmo percentual heurístico da notícia mesmo sem checagens conclusivas', async t => {
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
  assert.equal(dados.porcentagem, 74);
  assert.equal(dados.resultados.length, 0);
  assert.equal(dados.veredito, 'Sem evidências suficientes');
  const dom = new JSDOM('<div id="result"></div>'), previous = globalThis.document;
  globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  const root = document.getElementById('result');
  for (const record of [dados, { resultado: dados }, { ...dados, porcentagem: null }]) {
    renderAnalysis(root, record);
    assert.equal(root.querySelector('.meter-percentage').textContent, '74%');
    assert.match(root.querySelector('.credibility-meter').textContent, /Possibilidade estimada de ser verdadeiro/);
    assert.match(root.querySelector('.meter-explanation').textContent, /somente sinais de linguagem/);
    assert.match(root.querySelector('.heuristic-disclaimer').textContent, /sem calibração estatística/);
    assert.equal(root.querySelector('.factual-summary h3').textContent, 'Sem evidências suficientes');
    assert.equal(root.querySelector('.progress-bar').getAttribute('aria-valuenow'), '74');
  }
});
