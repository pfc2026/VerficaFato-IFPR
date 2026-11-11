import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { initLogin, validateNewPassword } from '../public/js/login.js';
import { shareSite } from '../public/js/share.js';
import { renderAnalysis } from '../public/js/result-renderer.js';
import { criarAnaliseVisual } from '../services/verification-indicators.js';
import { initEducation } from '../public/js/education.js';
import { lessons } from '../public/js/education-content.js';

const loginHtml = await readFile(new URL('../public/html/Login.html', import.meta.url), 'utf8');
const homeHtml = await readFile(new URL('../public/html/index.html', import.meta.url), 'utf8');
function login(t, options = {}) {
  const dom = new JSDOM(loginHtml, { url: options.url || 'https://verificafato.example/html/Login.html' });
  t.after(() => dom.window.close());
  const app = initLogin({ doc: dom.window.document, win: dom.window, fetchImpl: options.fetchImpl });
  return { app, doc: dom.window.document, win: dom.window };
}

test('senha nova respeita 12 caracteres e 72 bytes no cadastro e na recuperação', t => {
  const { doc } = login(t);
  for (const id of ['cadSenha', 'cadSenha2', 'resetSenha', 'resetSenha2']) {
    assert.equal(doc.getElementById(id).minLength, 12);
    assert.equal(doc.getElementById(id).maxLength, 72);
  }
  assert.match(doc.querySelector('label[for="cadSenha"]').textContent, /12 caracteres/);
  assert.match(validateNewPassword('123456', '123456'), /12 caracteres/);
  assert.match(validateNewPassword('á'.repeat(37), 'á'.repeat(37)), /72 bytes/);
  assert.match(validateNewPassword('uma senha segura', 'outra senha segura'), /não coincidem/);
  assert.equal(validateNewPassword('senha longa de teste', 'senha longa de teste'), '');
});

test('todos os botões de senha atualizam nome acessível e estado', t => {
  const { doc } = login(t);
  for (const button of doc.querySelectorAll('[data-toggle-password]')) {
    const input = doc.getElementById(button.getAttribute('aria-controls'));
    assert.equal(button.getAttribute('aria-label'), 'Mostrar senha');
    button.click();
    assert.equal(input.type, 'text');
    assert.equal(button.getAttribute('aria-label'), 'Ocultar senha');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    button.click();
    assert.equal(input.type, 'password');
    assert.equal(button.getAttribute('aria-label'), 'Mostrar senha');
  }
});

test('recuperação envia e-mail e apresenta confirmação genérica', async t => {
  const requests = [];
  const { app, doc } = login(t, { fetchImpl: async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ sucesso: true }) };
  } });
  doc.querySelector('[data-login-tab="recuperar"]').click();
  assert.ok(doc.getElementById('panelRecuperar').classList.contains('active'));
  doc.getElementById('recEmail').value = 'pessoa@example.com';
  await app.actions.Recuperar();
  assert.deepEqual(requests, [{ url: '/api/auth/recuperar-senha', body: { email: 'pessoa@example.com' } }]);
  assert.match(doc.getElementById('msgRecuperar').textContent, /Se houver uma conta/);
  assert.equal(doc.getElementById('btnRecuperar').disabled, false);
});

test('recuperação desativada exibe erro real e permite tentar novamente', async t => {
  const { app, doc } = login(t, { fetchImpl: async () => ({ ok: false, json: async () => ({ sucesso: false, erro: 'Recuperação por e-mail indisponível.' }) }) });
  doc.getElementById('recEmail').value = 'pessoa@example.com';
  await app.actions.Recuperar();
  assert.match(doc.getElementById('msgRecuperar').textContent, /indisponível/);
  assert.equal(doc.getElementById('btnRecuperar').disabled, false);
});

test('link de redefinição remove token do endereço, envia uma vez e limpa sessão anterior', async t => {
  const requests = [];
  const { app, doc, win } = login(t, { url: 'https://verificafato.example/html/Login.html?reset=token-temporario', fetchImpl: async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ sucesso: true }) };
  } });
  win.localStorage.setItem('vf-token', 'sessao-antiga');
  assert.equal(win.location.search, '');
  assert.ok(doc.getElementById('panelRedefinir').classList.contains('active'));
  doc.getElementById('resetSenha').value = 'nova senha segura';
  doc.getElementById('resetSenha2').value = 'nova senha segura';
  await app.actions.Redefinir();
  assert.deepEqual(requests, [{ url: '/api/auth/redefinir-senha', body: { token: 'token-temporario', senha: 'nova senha segura' } }]);
  assert.equal(win.localStorage.getItem('vf-token'), null);
  assert.ok(doc.getElementById('panelEntrar').classList.contains('active'));
  assert.match(doc.getElementById('msgEntrar').textContent, /Senha redefinida/);
  await app.actions.Redefinir();
  assert.equal(requests.length, 1);
});

test('compartilhar site confirma cópia, cancelamento e alternativa sem clipboard', async () => {
  const status = { textContent: '' };
  let copied;
  await shareSite({ status, nav: { clipboard: { writeText: async text => { copied = text; } } }, origin: 'https://verificafato.example' });
  assert.equal(copied, 'https://verificafato.example/');
  assert.match(status.textContent, /análise não está incluída/);
  await shareSite({ status, nav: { share: async () => { throw Object.assign(new Error(), { name: 'AbortError' }); } }, origin: 'https://verificafato.example' });
  assert.match(status.textContent, /cancelado/);
  await shareSite({ status, nav: {}, origin: 'https://verificafato.example' });
  assert.match(status.textContent, /Copie o endereço.*https:\/\/verificafato.example\//);
});

test('publicação enviada é distinta das referências no corpo e IA desativada não é falha temporária', () => {
  const dom = new JSDOM('<div id="result"></div>');
  globalThis.document = dom.window.document;
  const root = dom.window.document.getElementById('result');
  renderAnalysis(root, {
    schemaVersion: 2, noticiasRegionais: [{ titulo: 'Exemplo regional', fonte: 'g1_parana', data_publicacao: '2026-11-04T10:30:00Z' }],
    analiseVisual: criarAnaliseVisual('Esta matéria descreve uma pesquisa científica com observações que podem ser investigadas.'),
    noticia: { url: 'https://example.com/materia', conteudoObtido: true },
    geracao: { status: 'local', motivo: 'IA opcional não configurada.' },
    feedbackGemini: { status: 'local', texto: 'O Gemini não pôde gerar um comentário nesta tentativa.' }
  });
  assert.match(root.querySelector('.article-source').textContent, /Endereço da publicação enviada/);
  assert.match(root.querySelector('.analysis-overview').textContent, /Referências citadas no texto/);
  assert.match(root.querySelector('.analysis-overview').textContent, /endereço da publicação enviada é exibido separadamente/);
  assert.doesNotMatch(root.textContent, /Não há link de fonte no conteúdo enviado/);
  assert.match(root.querySelector('.gemini-feedback').textContent, /está desativado/);
  assert.doesNotMatch(root.querySelector('.gemini-feedback').textContent, /nesta tentativa/);
  assert.match(root.querySelector('.regional-findings').textContent, /G1 Paraná · 04\/11\/2026/);
  dom.window.close();
});

test('home possui prévia social, privacidade e espaços mesmo ocultando quebras móveis', () => {
  const dom = new JSDOM(homeHtml);
  const doc = dom.window.document;
  for (const selector of ['link[rel="canonical"]', 'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:image"]', 'meta[name="twitter:card"]']) assert.ok(doc.querySelector(selector), selector);
  assert.equal(doc.querySelector('link[rel="canonical"]').href, 'https://verfica-fato-ifpr.vercel.app/');
  assert.match(doc.getElementById('checklistTitle').textContent, /encaminhar, confira/);
  assert.match(doc.getElementById('quizTitle').textContent, /você, compartilharia/);
  assert.ok(doc.querySelector('footer a[href="/html/Privacidade.html"]'));
  assert.match(doc.getElementById('shareBtn').textContent, /Compartilhar site/);
  dom.window.close();
});

test('nível sem aulas é Em breve e se torna disponível quando publicado', async t => {
  const dom = new JSDOM(homeHtml, { url: 'https://verificafato.example/' });
  globalThis.document = dom.window.document;
  let resolveFetch;
  const app = initEducation({ fetchImpl: () => new Promise(resolve => { resolveFetch = resolve; }) });
  t.after(() => { app.destroy(); dom.window.close(); });
  const advanced = dom.window.document.querySelector('[data-level="avancado"]');
  assert.equal(advanced.disabled, true);
  assert.match(advanced.textContent, /Avançado · Em breve/);
  resolveFetch({ ok: true, json: async () => ({ sucesso: true, licoes: [{ ...lessons[0], nivel: 'avancado' }] }) });
  await app.ready;
  assert.equal(advanced.disabled, false);
  assert.equal(advanced.textContent, 'Avançado');
  advanced.click();
  assert.equal(dom.window.document.querySelectorAll('.lesson-card').length, 1);
});
