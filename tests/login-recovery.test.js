import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { initLogin } from '../public/js/login.js';

const html = await readFile(new URL('../public/html/Login.html', import.meta.url), 'utf8');

test('forgot password opens the form and submits the email, including unavailable delivery', async t => {
  const dom = new JSDOM(html, { url: 'https://example.org/html/Login.html' });
  t.after(() => dom.window.close());
  const doc = dom.window.document;
  let available = false;
  const login = initLogin({ doc, win: dom.window, fetchImpl: async (path, options) => {
    assert.equal(path, '/api/auth/recuperar-senha');
    assert.deepEqual(JSON.parse(options.body), { email: 'teste@example.org' });
    return { ok: available, json: async () => available ? { sucesso: true } : { sucesso: false, erro: 'Envio indisponível.' } };
  } });
  doc.querySelector('[data-login-tab="recuperar"]').click();
  assert.ok(doc.getElementById('panelRecuperar').classList.contains('active'));
  doc.getElementById('recEmail').value = 'teste@example.org';
  await login.actions.Recuperar();
  assert.equal(doc.getElementById('msgRecuperar').textContent, 'Envio indisponível.');
  assert.equal(doc.getElementById('btnRecuperar').disabled, false);
  available = true;
  await login.actions.Recuperar();
  assert.match(doc.getElementById('msgRecuperar').textContent, /Se houver uma conta/);
});

test('email link opens reset form and successful reset clears the old session', async t => {
  const token = 'a'.repeat(64);
  const dom = new JSDOM(html, { url: `https://example.org/html/Login.html?reset=${token}` });
  t.after(() => dom.window.close());
  const doc = dom.window.document;
  dom.window.localStorage.setItem('vf-token', 'old-session');
  dom.window.localStorage.setItem('vf-user', '{"role":"user"}');
  const login = initLogin({ doc, win: dom.window, fetchImpl: async (path, options) => {
    assert.equal(path, '/api/auth/redefinir-senha');
    assert.deepEqual(JSON.parse(options.body), { token, senha: 'nova-senha-segura' });
    return { ok: true, json: async () => ({ sucesso: true }) };
  } });
  assert.equal(dom.window.location.search, '');
  assert.ok(doc.getElementById('panelRedefinir').classList.contains('active'));
  doc.getElementById('resetSenha').value = 'nova-senha-segura';
  doc.getElementById('resetSenha2').value = 'nova-senha-segura';
  await login.actions.Redefinir();
  assert.equal(dom.window.localStorage.getItem('vf-token'), null);
  assert.equal(dom.window.localStorage.getItem('vf-user'), null);
  assert.ok(doc.getElementById('panelEntrar').classList.contains('active'));
  assert.match(doc.getElementById('msgEntrar').textContent, /Senha redefinida/);
});
