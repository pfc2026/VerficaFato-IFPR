import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticationReadiness, gerarToken, verificarToken } from '../middleware/auth.js';
import { requestPasswordReset, resetPassword, hashResetToken, RESET_TOKEN_TTL_MS } from '../services/password-recovery.js';
import { recoveryEmailConfiguration, passwordRecoveryReadiness, sendRecoveryEmail } from '../services/recovery-email.js';
import { createPasswordRecoveryRouter } from '../routes/password-recovery.js';

process.env.JWT_SECRET = 'recovery-tests-only-with-more-than-thirty-two-characters';
const origin = 'https://verificafato.example';
const id = '507f1f77bcf86cd799439011';
const start = new Date('2026-11-04T12:00:00Z');
const env = { RESEND_API_KEY: 're_test', RECOVERY_EMAIL_FROM: 'VerificaFato <conta@example.org>', APP_URL: origin, NODE_ENV: 'production' };

function store(initial = { _id: id, email: 'teste@example.org', ativo: true, tokenVersion: 0 }) {
  let state = initial ? { ...initial } : null;
  const matches = query => {
    if (!state) return false;
    if (query._id && query._id !== state._id) return false;
    if (query.ativo !== undefined && query.ativo !== state.ativo) return false;
    if (query.resetPasswordTokenHash && query.resetPasswordTokenHash !== state.resetPasswordTokenHash) return false;
    if (query.resetPasswordExpiresAt && !(state.resetPasswordExpiresAt > query.resetPasswordExpiresAt.$gt)) return false;
    if (query.$or && state.resetPasswordRequestedAt && state.resetPasswordRequestedAt > query.$or[1].resetPasswordRequestedAt.$lte) return false;
    return true;
  };
  const update = (query, operation) => {
    if (!matches(query)) return null;
    Object.assign(state, operation.$set);
    for (const key of Object.keys(operation.$unset || {})) delete state[key];
    for (const [key, amount] of Object.entries(operation.$inc || {})) state[key] = (state[key] || 0) + amount;
    return { ...state };
  };
  return {
    get current() { return state; },
    findOne: query => ({ select: async () => state?.email === query.email && state.ativo ? { ...state } : null }),
    exists: async query => matches(query),
    findOneAndUpdate: async (query, operation) => update(query, operation),
    updateOne: async (query, operation) => update(query, operation)
  };
}

test('authentication readiness reports missing/short secrets without disclosing them', () => {
  const previous = process.env.JWT_SECRET;
  try {
    delete process.env.JWT_SECRET;
    assert.equal(authenticationReadiness().configurado, false);
    process.env.JWT_SECRET = 'short';
    assert.equal(authenticationReadiness().status, 'indisponivel');
    assert.doesNotMatch(JSON.stringify(authenticationReadiness()), /short/);
    process.env.JWT_SECRET = previous;
    assert.deepEqual(authenticationReadiness(), { status: 'pronto', configurado: true });
  } finally { process.env.JWT_SECRET = previous; }
});

test('recovery requires explicit credentials, sender, and a trusted HTTPS origin', () => {
  assert.deepEqual(passwordRecoveryReadiness(env), { status: 'configurado', configurado: true, provedor: 'resend' });
  for (const values of [
    { ...env, RESEND_API_KEY: '' }, { ...env, RECOVERY_EMAIL_FROM: '' }, { ...env, APP_URL: '' },
    { ...env, RECOVERY_EMAIL_FROM: 'bad\nInjected@example.org' },
    { ...env, APP_URL: 'http://example.org' }, { ...env, APP_URL: 'https://user:password@example.org' },
    { ...env, APP_URL: 'https://example.org?redirect=evil' }, { ...env, APP_URL: 'https://example.org/path' },
    { ...env, NODE_ENV: 'production', APP_URL: 'http://localhost:3000' }
  ]) {
    assert.equal(passwordRecoveryReadiness(values).configurado, false);
    assert.throws(() => recoveryEmailConfiguration(values), { status: 503 });
  }
  assert.equal(recoveryEmailConfiguration({ ...env, NODE_ENV: 'development', APP_URL: 'http://127.0.0.1:3000' }).origin, 'http://127.0.0.1:3000');
  assert.doesNotMatch(JSON.stringify(passwordRecoveryReadiness(env)), /re_test|conta@example/);
});

test('recovery stores a hash, sends the single-use link, and expires it after thirty minutes', async () => {
  const users = store();
  let sent;
  await requestPasswordReset(users.current.email, { users, origin, now: () => start, sendEmail: async value => { sent = value; } });
  const url = new URL(sent.resetUrl);
  const token = url.searchParams.get('reset');
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(url.origin, origin);
  assert.equal(url.pathname, '/html/Login.html');
  assert.equal(users.current.resetPasswordTokenHash, hashResetToken(token));
  assert.notEqual(users.current.resetPasswordTokenHash, token);
  assert.equal(users.current.resetPasswordExpiresAt.getTime(), start.getTime() + RESET_TOKEN_TTL_MS);
  assert.doesNotMatch(JSON.stringify(users.current), new RegExp(token));
});

test('recovery does not expose whether an account exists or is inactive', async () => {
  for (const users of [store(null), store({ _id: id, email: 'teste@example.org', ativo: false })]) {
    let calls = 0;
    assert.equal(await requestPasswordReset('teste@example.org', { users, origin, now: () => start, sendEmail: async () => { calls++; } }), undefined);
    assert.equal(calls, 0);
  }
});

test('per-account cooldown limits delivery and a new request invalidates the old link', async () => {
  const users = store();
  const sent = [];
  let current = start;
  const options = { users, origin, now: () => current, sendEmail: async value => { sent.push(value); } };
  await Promise.all([requestPasswordReset(users.current.email, options), requestPasswordReset(users.current.email, options)]);
  assert.equal(sent.length, 1);
  const first = new URL(sent[0].resetUrl).searchParams.get('reset');
  current = new Date(start.getTime() + 60001);
  await requestPasswordReset(users.current.email, options);
  assert.equal(sent.length, 2);
  await assert.rejects(resetPassword(first, 'my-new-secure-password', { users, now: () => current }), { code: 'TOKEN_INVALIDO' });
});

test('delivery failure removes the token and keeps the public response generic', async () => {
  const users = store();
  let reported = 0;
  assert.equal(await requestPasswordReset(users.current.email, {
    users, origin, now: () => start, sendEmail: async () => { throw new Error('provider credentials and details'); },
    reportDeliveryFailure: () => { reported++; }
  }), undefined);
  assert.equal(users.current.resetPasswordTokenHash, undefined);
  assert.equal(users.current.resetPasswordExpiresAt, undefined);
  assert.equal(reported, 1);
});

test('successful reset hashes the new password, consumes token and revokes old sessions', async () => {
  const users = store();
  const oldSession = gerarToken(id, users.current.tokenVersion);
  let sent;
  await requestPasswordReset(users.current.email, { users, origin, now: () => start, sendEmail: async value => { sent = value; } });
  const token = new URL(sent.resetUrl).searchParams.get('reset');
  await resetPassword(token, 'my-new-secure-password', { users, now: () => start });
  assert.equal(await bcrypt.compare('my-new-secure-password', users.current.senha), true);
  assert.equal(users.current.tokenVersion, 1);
  assert.notEqual(verificarToken(oldSession).v, users.current.tokenVersion);
  assert.equal(users.current.resetPasswordTokenHash, undefined);
  await assert.rejects(resetPassword(token, 'different-secure-password', { users, now: () => start }), { code: 'TOKEN_INVALIDO' });
});

test('only one concurrent reset can consume the same token', async () => {
  const token = 'b'.repeat(64);
  const users = store({ _id: id, email: 'teste@example.org', ativo: true, tokenVersion: 0, resetPasswordTokenHash: hashResetToken(token), resetPasswordExpiresAt: new Date(start.getTime() + 10000) });
  const options = { users, now: () => start, hashPassword: async () => 'new-hash' };
  const results = await Promise.allSettled([resetPassword(token, 'my-new-secure-password', options), resetPassword(token, 'other-secure-password', options)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason.code === 'TOKEN_INVALIDO').length, 1);
  assert.equal(users.current.tokenVersion, 1);
});

test('expired tokens and inactive accounts cannot reset passwords', async () => {
  const token = 'c'.repeat(64);
  for (const initial of [
    { _id: id, ativo: true, resetPasswordTokenHash: hashResetToken(token), resetPasswordExpiresAt: start },
    { _id: id, ativo: false, resetPasswordTokenHash: hashResetToken(token), resetPasswordExpiresAt: new Date(start.getTime() + 10000) }
  ]) {
    const users = store(initial);
    await assert.rejects(resetPassword(token, 'my-new-secure-password', { users, now: () => start, hashPassword: () => { throw new Error('must not compute hash'); } }), { code: 'TOKEN_INVALIDO' });
    assert.equal(users.current.senha, undefined);
  }
});

test('Resend adapter sends text over fixed HTTPS endpoint and keeps API key out of content', async () => {
  const token = 'd'.repeat(64);
  let requested;
  await sendRecoveryEmail({ to: 'user@example.org', resetUrl: `${origin}/html/Login.html?reset=${token}` }, {
    env, fetcher: async (url, options) => { requested = { url, options }; return { ok: true, json: async () => ({ id: 'message-id' }) }; }
  });
  assert.equal(requested.url, 'https://api.resend.com/emails');
  assert.equal(requested.options.headers.Authorization, 'Bearer re_test');
  assert.equal(requested.options.redirect, 'error');
  const body = JSON.parse(requested.options.body);
  assert.deepEqual(body.to, ['user@example.org']);
  assert.match(body.text, /30 minutos/);
  assert.match(body.text, new RegExp(token));
  assert.doesNotMatch(body.text, /re_test/);
  await assert.rejects(sendRecoveryEmail({ to: 'user@example.org', resetUrl: `https://evil.example/html/Login.html?reset=${token}` }, { env }), { status: 503 });
  await assert.rejects(sendRecoveryEmail({ to: 'user@example.org', resetUrl: `${origin}/html/Login.html?reset=${token}` }, { env, fetcher: async () => ({ ok: false }) }), { status: 503 });
});

async function http(t, options) {
  const app = express(); app.use(express.json());
  app.use('/api/auth', createPasswordRecoveryRouter({ rateLimits: false, ...options }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return (path, body) => fetch(`http://127.0.0.1:${server.address().port}/api/auth${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('Brevo configuration selects only its own key and reports no secrets', () => {
  const values = { ...env, RECOVERY_EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'brevo-test-secret' };
  assert.deepEqual(passwordRecoveryReadiness(values), { status: 'configurado', configurado: true, provedor: 'brevo' });
  assert.equal(recoveryEmailConfiguration(values).key, 'brevo-test-secret');
  for (const invalid of [{ ...values, BREVO_API_KEY: '' }, { ...values, BREVO_API_KEY: 'bad\nkey' }, { ...values, RECOVERY_EMAIL_PROVIDER: 'unknown' }]) {
    assert.throws(() => recoveryEmailConfiguration(invalid), { status: 503 });
    assert.doesNotMatch(JSON.stringify(passwordRecoveryReadiness(invalid)), /brevo-test-secret|re_test/);
  }
});

test('Brevo sends a reset link with its API contract and rejects failed deliveries', async () => {
  const values = { ...env, RECOVERY_EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'brevo-test-secret' };
  const message = { to: 'user@example.org', resetUrl: `${origin}/html/Login.html?reset=${'f'.repeat(64)}` };
  for (const from of ['VerificaFato <conta@example.org>', 'conta@example.org']) {
    await sendRecoveryEmail(message, { env: { ...values, RECOVERY_EMAIL_FROM: from }, fetcher: async (url, options) => {
      assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
      assert.equal(options.headers['api-key'], values.BREVO_API_KEY);
      assert.equal(options.headers.Authorization, undefined);
      assert.equal(options.redirect, 'error');
      const body = JSON.parse(options.body);
      assert.equal(body.sender.email, 'conta@example.org');
      assert.deepEqual(body.to, [{ email: message.to }]);
      assert.ok(body.textContent.includes(message.resetUrl));
      assert.doesNotMatch(options.body, /brevo-test-secret|re_test/);
      return { ok: true, json: async () => ({ messageId: '<message@example.org>' }) };
    } });
  }
  for (const response of [{ ok: false }, { ok: true, json: async () => ({}) }]) {
    await assert.rejects(sendRecoveryEmail(message, { env: values, fetcher: async () => response }), { status: 503 });
  }
});

test('recovery HTTP validates input, hides account presence and rejects unavailable configuration', async t => {
  let email;
  const request = await http(t, { getConfiguration: () => ({ origin }), requestReset: async value => { email = value; } });
  const result = await request('/recuperar-senha', { email: ' User@Example.org ' });
  assert.equal(result.status, 200); assert.equal(email, 'user@example.org');
  assert.deepEqual(Object.keys(await result.json()).sort(), ['mensagem', 'sucesso']);
  assert.equal((await request('/recuperar-senha', { email: 'invalid' })).status, 400);
  assert.equal((await request('/recuperar-senha', { email: 'user@example.org', role: 'admin' })).status, 400);
  const unavailable = await http(t, { getConfiguration: () => recoveryEmailConfiguration({}) });
  const response = await unavailable('/recuperar-senha', { email: 'user@example.org' });
  assert.equal(response.status, 503); assert.equal((await response.json()).codigo, 'RECUPERACAO_INDISPONIVEL');
});

test('reset HTTP enforces twelve characters, bcrypt byte limit and handles spent tokens', async t => {
  const token = 'e'.repeat(64);
  const request = await http(t, { performReset: async received => {
    assert.equal(received, token);
    const error = new Error('O link de recuperação é inválido ou expirou. Solicite um novo link.'); error.code = 'TOKEN_INVALIDO'; throw error;
  } });
  for (const senha of ['short6', 'á'.repeat(37)]) assert.equal((await request('/redefinir-senha', { token, senha })).status, 400);
  assert.equal((await request('/redefinir-senha', { token: 'invalid', senha: 'my-new-secure-password' })).status, 400);
  const invalid = await request('/redefinir-senha', { token, senha: 'my-new-secure-password' });
  assert.equal(invalid.status, 400); assert.equal((await invalid.json()).codigo, 'TOKEN_INVALIDO');
});

test('recovery HTTP rate limit prevents repeated requests', async t => {
  const request = await http(t, { rateLimits: true, getConfiguration: () => ({ origin }), requestReset: async () => {} });
  for (let attempt = 0; attempt < 10; attempt++) assert.equal((await request('/recuperar-senha', { email: 'user@example.org' })).status, 200);
  assert.equal((await request('/recuperar-senha', { email: 'user@example.org' })).status, 429);
});
