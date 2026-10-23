import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { createApp } from '../server.js';
import { gerarToken, verificarToken, getSigningSecret } from '../middleware/auth.js';
import { sanitizeLesson } from '../routes/admin.js';
import { passwordField, currentPasswordField } from '../middleware/validation.js';
import User from '../models/User.js';
import Verificacao from '../models/Verificacao.js';
import ConteudoEdu from '../models/ConteudoEdu.js';
import { HttpError } from '../services/errors.js';

process.env.JWT_SECRET = 'backend-tests-only-isolated-secret-with-48-bytes';
const userId = '507f1f77bcf86cd799439011';
const otherId = '507f1f77bcf86cd799439012';
const fixture = { schemaVersion: 2, veredito: 'não verificável', porcentagem: null, confianca: null, explicacao: 'Sem evidência suficiente.', resultados: [], afirmacoes: [], fontes: [], secoes: { resumo: 'Teste', resultado: 'Inconclusivo', encontramos: [], linguagem: [], orientacao: 'Confira fontes.', limitacoes: [] }, limitacoes: [], analiseLinguagem: {} };
const baseUser = () => ({ _id: userId, nome: 'Usuário teste', email: 'teste@example.org', role: 'user', cidade: 'Toledo', ativo: true, tokenVersion: 0, senha: 'must-never-be-public' });
function signed(payload, header = { alg: 'HS256', typ: 'JWT' }) {
  const head = Buffer.from(JSON.stringify(header)).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}
async function http(t, options = {}) {
  const app = createApp({ analyze: async () => structuredClone(fixture), dbReady: () => false, rateLimits: false, ...options });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (url, { body, token, headers, ...rest } = {}) => fetch(base + url, {
    ...rest, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  request.baseUrl = base; return request;
}
function mockUser(t, user) {
  const prior = User.db._readyState;
  User.db._readyState = 1;
  t.after(() => { User.db._readyState = prior; });
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
}

test('importing server does not establish a database connection', () => assert.equal(mongoose.connection.readyState, 0));
test('JWT round-trip preserves user ID and session version', () => {
  const decoded = verificarToken(gerarToken(userId, 3));
  assert.equal(decoded.id, userId); assert.equal(decoded.v, 3);
  assert.ok(decoded.exp > Math.floor(Date.now() / 1000));
});
test('JWT rejects missing, expired or mistyped expiration, invalid IDs and algorithms', () => {
  const exp = Math.floor(Date.now() / 1000) + 100;
  for (const payload of [{ id: userId }, { id: userId, exp: 0 }, { id: userId, exp: String(exp) }, { id: userId, exp: Math.floor(Date.now() / 1000) }, { id: 'invalid', exp }, { id: [userId], exp }, { id: userId, exp, v: -1 }, { id: userId, exp, iat: exp + 500 }]) assert.equal(verificarToken(signed(payload)), null);
  for (const header of [{ alg: 'none', typ: 'JWT' }, { alg: 'HS512', typ: 'JWT' }, { alg: 'HS256', typ: 'other' }]) assert.equal(verificarToken(signed({ id: userId, exp }, header)), null);
  const valid = gerarToken(userId);
  assert.equal(verificarToken(valid.slice(0, -1)), null);
  assert.equal(verificarToken('x'.repeat(5000)), null);
});
test('authentication refuses missing or short server secrets', () => {
  const secret = process.env.JWT_SECRET;
  try {
    delete process.env.JWT_SECRET; assert.throws(getSigningSecret, { status: 503 });
    process.env.JWT_SECRET = 'short'; assert.throws(() => gerarToken(userId), { status: 503 });
    process.env.JWT_SECRET = 'á'.repeat(16); assert.throws(getSigningSecret, { status: 503 });
  } finally { process.env.JWT_SECRET = secret; }
});
test('new passwords require twelve characters and obey bcrypt byte limit', () => {
  assert.equal(passwordField.safeParse('short').success, false);
  assert.equal(passwordField.safeParse('long-secure-password').success, true);
  assert.equal(passwordField.safeParse('á'.repeat(37)).success, false);
  assert.equal(currentPasswordField.safeParse('old6pw').success, true);
});
test('lesson HTML preserves formatting and removes executable content', () => {
  const result = sanitizeLesson('<h3>Título</h3><script>alert(1)</script><p onclick="alert(1)">Texto<img src=x onerror=alert(1)><a href="javascript:alert(1)">ruim</a><a href="//evil.example">relativo</a><a href="https://example.org">seguro</a></p>');
  assert.match(result, /<h3>Título<\/h3>/); assert.match(result, /https:\/\/example.org/);
  assert.doesNotMatch(result, /script|onclick|onerror|javascript:|href="\/\//i);
});
test('public analysis works while database is offline and status exposes no secret metadata', async t => {
  const request = await http(t);
  const response = await request('/api/verificar', { method: 'POST', body: { texto: 'A prefeitura anunciou uma nova escola.' } });
  assert.equal(response.status, 200); const output = await response.json();
  assert.equal(output.sucesso, true); assert.equal(output.dados.porcentagem, null); assert.equal(output.dados.confianca, null);
  const status = await (await request('/api/status')).json();
  assert.equal(status.mongo, 'desconectado'); assert.equal('apiKey' in status, false);
  assert.equal((await request('/api/auth/perfil')).status, 503);
  assert.equal((await request('/api/unknown')).status, 404);
});
test('verification rejects objects, dual input, unsafe protocols and excessive input', async t => {
  let calls = 0;
  const request = await http(t, { analyze: async () => { calls++; return fixture; } });
  for (const body of [null, {}, { texto: { $ne: null } }, { texto: 42 }, { texto: 'curto' }, { texto: 'Texto suficientemente longo.', link: 'https://example.org' }, { link: 'file:///etc/passwd' }, { link: 'javascript:alert(1)' }, { link: 'https://user:pass@example.org' }, { texto: 'Texto suficientemente longo.', role: 'admin' }, { texto: 'a'.repeat(20001) }]) {
    const result = await request('/api/verificar', { method: 'POST', body });
    assert.equal(result.status, 400, JSON.stringify(body)); await result.text();
  }
  assert.equal(calls, 0);
  const oversized = await request('/api/verificar', { method: 'POST', body: { texto: 'a'.repeat(70000) } });
  assert.equal(oversized.status, 413);
});
test('CORS rejects other origins and returns PATCH in allowed preflight', async t => {
  const saved = process.env.APP_ORIGINS; process.env.APP_ORIGINS = 'https://allowed.example';
  t.after(() => { if (saved === undefined) delete process.env.APP_ORIGINS; else process.env.APP_ORIGINS = saved; });
  const request = await http(t);
  assert.equal((await request('/api/status', { headers: { Origin: 'https://evil.example' } })).status, 403);
  const preflight = await request('/api/auth/perfil', { method: 'OPTIONS', headers: { Origin: 'https://allowed.example' } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://allowed.example');
  assert.match(preflight.headers.get('access-control-allow-methods'), /PATCH/);
  const headers = (await request('/api/status')).headers;
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-powered-by'), null);
  assert.doesNotMatch(headers.get('content-security-policy').split(';').find(item => item.trim().startsWith('script-src ')), /unsafe-inline/);
});
test('registration and login reject NoSQL operators before model queries', async t => {
  const request = await http(t, { dbReady: () => true });
  t.mock.method(User, 'findOne', () => { throw new Error('must not query'); });
  const response = await request('/api/auth/entrar', { method: 'POST', body: { email: { $ne: null }, senha: 'password' } });
  assert.equal(response.status, 400);
  assert.equal((await request('/api/auth/registrar', { method: 'POST', body: { nome: 'Teste', email: 'test@example.org', senha: 'long-secure-password', role: 'admin' } })).status, 400);
});
test('inactive accounts and revoked sessions cannot use profile or admin', async t => {
  const user = baseUser(); mockUser(t, user);
  const request = await http(t, { dbReady: () => true }); const token = gerarToken(userId, 0);
  user.ativo = false; assert.equal((await request('/api/auth/me', { token })).status, 401);
  user.ativo = true; user.tokenVersion = 1; assert.equal((await request('/api/auth/perfil', { token })).status, 401);
  user.tokenVersion = 0; assert.equal((await request('/api/admin/usuarios', { token })).status, 403);
});
test('profile returns a safe DTO without password hashes or session versions', async t => {
  const user = baseUser(); mockUser(t, user); t.mock.method(Verificacao, 'countDocuments', async () => 4);
  const request = await http(t, { dbReady: () => true });
  const response = await request('/api/auth/me', { token: gerarToken(userId) });
  assert.equal(response.status, 200); const data = await response.json();
  assert.equal(data.usuario.id, userId); assert.equal(data.usuario.totalVerificacoes, 4);
  assert.equal('senha' in data.usuario, false); assert.equal('tokenVersion' in data.usuario, false);
});
test('history deletion always scopes the query to the authenticated owner', async t => {
  mockUser(t, baseUser()); let filter;
  t.mock.method(Verificacao, 'findOneAndDelete', async input => { filter = input; return null; });
  const request = await http(t, { dbReady: () => true });
  const response = await request(`/api/historico/${otherId}`, { method: 'DELETE', token: gerarToken(userId) });
  assert.equal(response.status, 404); assert.deepEqual(filter, { _id: otherId, userId });
});
test('password change invalidates the existing session', async t => {
  const user = baseUser(); user.senha = await bcrypt.hash('old6pw', 4); user.save = async () => user;
  mockUser(t, user); const token = gerarToken(userId, 0); const request = await http(t, { dbReady: () => true });
  const changed = await request('/api/auth/senha', { method: 'PATCH', token, body: { senhaAtual: 'old6pw', novaSenha: 'a-new-long-password' } });
  assert.equal(changed.status, 200); assert.equal(user.tokenVersion, 1); assert.equal(await bcrypt.compare('a-new-long-password', user.senha), true);
  assert.equal((await request('/api/auth/me', { token })).status, 401);
});
test('failed history persistence does not destroy a completed analysis', async t => {
  mockUser(t, baseUser()); let stored;
  t.mock.method(Verificacao, 'create', async value => { stored = value; throw new Error('internal-connection-detail'); });
  const request = await http(t, { dbReady: () => true });
  const response = await request('/api/verificar', { method: 'POST', token: gerarToken(userId), body: { texto: 'A prefeitura anunciou uma nova escola.' } });
  assert.equal(response.status, 200); const result = await response.json();
  assert.match(result.dados.avisoHistorico, /não foi possível salvar/);
  assert.equal(stored.schemaVer, 2); assert.equal(stored.porcentagem, null); assert.equal(stored.resultado.veredito, fixture.veredito);
  assert.doesNotMatch(JSON.stringify(result), /internal-connection-detail/);
});
test('educational API sanitizes preexisting lesson HTML', async t => {
  t.mock.method(ConteudoEdu, 'find', () => ({ sort: () => ({ limit: () => ({ lean: async () => [{ titulo: 'Lição', conteudoHTML: '<p>Texto</p><script>evil()</script>' }] }) }) }));
  const request = await http(t, { dbReady: () => true });
  const data = await (await request('/api/education')).json(); assert.equal(data.licoes[0].conteudoHTML, '<p>Texto</p>');
});
test('domain failures preserve safe 4xx codes and internal failures hide details', async t => {
  let internal = false;
  const request = await http(t, { analyze: async () => { if (internal) throw new Error('SECRET_DATABASE_URI'); throw new HttpError(400, 'O endereço informado não é público.', 'SSRF_BLOCKED'); } });
  const first = await request('/api/verificar', { method: 'POST', body: { texto: 'Texto suficientemente longo.' } });
  assert.equal(first.status, 400); assert.equal((await first.json()).codigo, 'SSRF_BLOCKED');
  internal = true; const second = await request('/api/verificar', { method: 'POST', body: { texto: 'Texto suficientemente longo.' } });
  assert.equal(second.status, 500); assert.doesNotMatch(await second.text(), /SECRET_DATABASE_URI/);
});
test('public verification limits repeated requests', async t => {
  const request = await http(t, { rateLimits: true });
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await request('/api/verificar', { method: 'POST', body: { texto: 'Texto suficientemente longo.' } });
    assert.equal(response.status, 200); await response.text();
  }
  const limited = await request('/api/verificar', { method: 'POST', body: { texto: 'Texto suficientemente longo.' } }); assert.equal(limited.status, 429);
});
test('Vercel HTTPS forwarding preserves same-origin requests', async t => {
  const saved = process.env.VERCEL; process.env.VERCEL = '1';
  t.after(() => { if (saved === undefined) delete process.env.VERCEL; else process.env.VERCEL = saved; });
  const request = await http(t);
  const response = await request('/api/status', { headers: { Origin: request.baseUrl.replace('http:', 'https:'), 'X-Forwarded-Proto': 'https' } });
  assert.equal(response.status, 200);
});
test('aggregated metrics require admin access and contain no user data', async t => {
  const user = baseUser(); mockUser(t, user);
  const request = await http(t, { dbReady: () => true }); const token = gerarToken(userId);
  assert.equal((await request('/api/admin/metricas')).status, 401);
  assert.equal((await request('/api/admin/metricas', { token })).status, 403);
  user.role = 'admin';
  const response = await request('/api/admin/metricas', { token }); assert.equal(response.status, 200);
  const result = await response.json(); assert.ok(result.metricas.requests > 0);
  assert.ok(result.metricas.statuses['403'] > 0);
  assert.doesNotMatch(JSON.stringify(result.metricas), /teste@example|507f1f77|must-never|Bearer|JWT_SECRET/);
  const status = await (await request('/api/status')).json(); assert.equal('metricas' in status, false);
});
test('complete HTTP flow uses the real analysis pipeline and TensorFlow without external providers',async t=>{
  const { analisarConteudo }=await import('../services/analysis.js');
  const { generateExplanation }=await import('../services/explanation.js');
  const request=await http(t,{analyze:(body,options)=>analisarConteudo(body,{
    ...options,check:async()=>({apiDisponivel:true,resultados:[]}),
    explain:result=>generateExplanation(result,{enabled:false})
  })});
  const response=await request('/api/verificar',{method:'POST',body:{texto:'A biblioteca anunciou novas atividades culturais.',link:''}});
  assert.equal(response.status,200);
  const {sucesso,dados}=await response.json();
  assert.equal(sucesso,true);assert.equal(dados.schemaVersion,2);
  assert.equal(dados.veredito,'Sem evidências suficientes');
  assert.equal(dados.porcentagem,null);assert.equal(dados.analiseLinguagem.tensorflow.disponivel,true);
  assert.equal(dados.geracao.status,'local');assert.ok(dados.afirmacoes.length);
  assert.ok(dados.secoes.limitacoes);assert.ok(dados.explicacao.includes('Resumo da análise'));
});
