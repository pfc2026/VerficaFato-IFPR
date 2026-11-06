import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import { createApp } from '../server.js';
import User from '../models/User.js';
import Verificacao from '../models/Verificacao.js';

test('registration, login, profile and authenticated history preserve owner isolation', async t => {
  const previousSecret = process.env.JWT_SECRET;
  const previousState = User.db._readyState;
  process.env.JWT_SECRET = 'isolated-auth-lifecycle-test-secret-over-32-characters';
  User.db._readyState = 1;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    User.db._readyState = previousState;
  });
  const userId = '507f1f77bcf86cd799439011';
  const historyId = '507f1f77bcf86cd799439012';
  const records = [];
  let user;
  t.mock.method(User, 'exists', async filter => user?.email === filter.email);
  t.mock.method(User, 'create', async value => {
    user = { ...value, _id: userId, ativo: true, tokenVersion: 0 };
    return user;
  });
  t.mock.method(User, 'findOne', filter => ({ select: async () => user?.email === filter.email ? user : null }));
  t.mock.method(User, 'findById', id => ({ select: async () => String(id) === userId ? user : null }));
  t.mock.method(User, 'findByIdAndUpdate', async (id, update) => {
    assert.equal(String(id), userId);
    Object.assign(user, update.$set);
    return user;
  });
  t.mock.method(Verificacao, 'countDocuments', async filter => records.filter(item => item.userId === filter.userId).length);
  t.mock.method(Verificacao, 'create', async value => {
    const record = { ...structuredClone(value), _id: historyId };
    records.push(record);
    return record;
  });
  t.mock.method(Verificacao, 'find', filter => ({
    sort() { return this; }, limit: async () => records.filter(item => item.userId === filter.userId)
  }));
  t.mock.method(Verificacao, 'findOneAndDelete', async filter => {
    const index = records.findIndex(item => item._id === filter._id && item.userId === filter.userId);
    return index < 0 ? null : records.splice(index, 1)[0];
  });
  const analysis = {
    schemaVersion: 2, veredito: 'Sem evidências suficientes', resultados: [], afirmacoes: [],
    fontes: [], limitacoes: ['A ausência de checagem não prova verdade ou falsidade.']
  };
  const server = createApp({ dbReady: () => true, rateLimits: false, analyze: async () => structuredClone(analysis) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, { token, body, method = 'GET' } = {}) => fetch(base + path, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const credentials = { nome: 'Leitor de teste', email: 'isolated@example.org', senha: 'uma-senha-longa-de-teste' };
  const registration = await request('/api/auth/registrar', { method: 'POST', body: credentials });
  assert.equal(registration.status, 201);
  const registered = await registration.json();
  assert.equal(registered.usuario.id, userId);
  assert.equal(registered.usuario.role, 'user');
  assert.equal('senha' in registered.usuario, false);
  assert.notEqual(user.senha, credentials.senha);
  assert.equal(await bcrypt.compare(credentials.senha, user.senha), true);
  assert.equal((await request('/api/auth/registrar', { method: 'POST', body: credentials })).status, 409);
  assert.equal((await request('/api/auth/entrar', { method: 'POST', body: { email: credentials.email, senha: 'senha-incorreta' } })).status, 401);
  const login = await request('/api/auth/entrar', { method: 'POST', body: { email: credentials.email, senha: credentials.senha } });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  assert.ok(token);
  const update = await request('/api/auth/perfil', { method: 'PATCH', token, body: { nome: 'Leitor atualizado', cidade: 'Toledo' } });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).usuario.nome, 'Leitor atualizado');
  const verified = await request('/api/verificar', { method: 'POST', token, body: { texto: 'A biblioteca anunciou atividades culturais.' } });
  assert.equal(verified.status, 200);
  const output = await verified.json();
  const history = await (await request('/api/historico', { token })).json();
  assert.equal(history.itens.length, 1);
  assert.deepEqual(history.itens[0].resultado, output.dados);
  assert.deepEqual(history.itens[0].dadosAPI, output.dados.resultados);
  assert.equal(history.itens[0].userId, userId);
  const profile = await (await request('/api/auth/perfil', { token })).json();
  assert.equal(profile.usuario.totalVerificacoes, 1);
  assert.equal(profile.usuario.cidade, 'Toledo');
  assert.equal('senha' in profile.usuario, false);
  assert.deepEqual((await (await request('/api/historico')).json()).itens, []);
  assert.equal((await request('/api/auth/perfil')).status, 401);
  assert.equal((await request(`/api/historico/${historyId}`, { method: 'DELETE', token })).status, 200);
  assert.equal(records.length, 0);
});
