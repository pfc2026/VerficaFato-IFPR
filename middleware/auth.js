import crypto from 'node:crypto';
import User from '../models/User.js';
export function getSigningSecret() {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== 'string' || secret.length < 32 || Buffer.byteLength(secret, 'utf8') < 32) {
    const error = new Error('Autenticação indisponível. Configure uma chave segura no servidor.'); error.status = 503; throw error;
  }
  return secret;
}
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
export function gerarToken(userId, version = 0) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ id: String(userId), v: version, iat: now, exp: now + 7 * 24 * 60 * 60 });
  const data = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', getSigningSecret()).update(data).digest('base64url');
  return `${data}.${signature}`;
}
export function verificarToken(token) {
  const secret = getSigningSecret();
  try {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
    const [headerPart, payloadPart, signaturePart] = parts;
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;
    const expected = crypto.createHmac('sha256', secret).update(`${headerPart}.${payloadPart}`).digest();
    const actual = Buffer.from(signaturePart, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (!payload || typeof payload.id !== 'string' || !/^[a-f\d]{24}$/i.test(payload.id) || !Number.isSafeInteger(payload.exp) || payload.exp <= now) return null;
    if (payload.iat !== undefined && (!Number.isSafeInteger(payload.iat) || payload.iat > now + 60)) return null;
    if (payload.v !== undefined && (!Number.isSafeInteger(payload.v) || payload.v < 0)) return null;
    return payload;
  } catch { return null; }
}
async function authenticate(req, res, next, required) {
  req.user = null;
  const authorization = req.headers.authorization;
  if (!authorization) {
    if (required) return res.status(401).json({ sucesso: false, erro: 'Autenticação necessária.' });
    return next();
  }
  const match = typeof authorization === 'string' && authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    if (required) return res.status(401).json({ sucesso: false, erro: 'Token inválido ou expirado.' });
    return next();
  }
  try {
    const decoded = verificarToken(match[1]);
    if (decoded && User.db.readyState === 1) {
      const user = await User.findById(decoded.id).select('-senha');
      if (user?.ativo && (user.tokenVersion || 0) === (decoded.v || 0)) req.user = user;
    }
    if (required && !req.user) return res.status(401).json({ sucesso: false, erro: 'Token inválido ou expirado.' });
    return next();
  } catch (error) {
    if (!required) return next();
    return res.status(error.status === 503 ? 503 : 401).json({ sucesso: false, erro: error.status === 503 ? 'Autenticação indisponível.' : 'Token inválido ou expirado.' });
  }
}
export const autenticarOpcional = (req, res, next) => authenticate(req, res, next, false);
export const autenticarObrigatorio = (req, res, next) => authenticate(req, res, next, true);
export function autenticarAdmin(req, res, next) {
  return autenticarObrigatorio(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ sucesso: false, erro: 'Acesso permitido apenas a administradores.' });
    return next();
  });
}