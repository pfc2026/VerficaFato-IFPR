const crypto = require('crypto');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'vf-secret-mude-em-producao';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Gera um token assinado com HMAC SHA256
 */
function gerarToken(userId) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    id: userId,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  };

  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = base64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
  return `${data}.${sig}`;
}

/**
 * Valida o token e retorna o payload decodificado se a assinatura e expiração forem válidas.
 */
function verificarToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, sig] = parts;

    const data = `${h}.${p}`;
    const expectedSig = base64url(
      crypto.createHmac('sha256', JWT_SECRET).update(data).digest()
    );
    if (expectedSig !== sig) return null;

    const payloadRaw = Buffer.from(
      p.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');

    const payload = JSON.parse(payloadRaw);
    if (payload?.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Middleware opcional: tenta autenticar, mas não bloqueia a requisição caso falhe.
 */
async function autenticarOpcional(req, res, next) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    req.user = null;
    return next();
  }

  try {
    const token = match[1];
    const decoded = verificarToken(token);

    if (!decoded || !decoded.id) {
      req.user = null;
      return next();
    }

    const user = await User.findById(decoded.id).select('-senha');
    if (!user || !user.ativo) {
      req.user = null;
      return next();
    }

    req.user = user;
  } catch (err) {
    req.user = null;
  }

  return next();
}

/**
 * Middleware obrigatório: bloqueia requisições sem token válido.
 */
async function autenticarObrigatorio(req, res, next) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ sucesso: false, erro: 'Token não fornecido ou formato inválido.' });
  }

  try {
    const token = match[1];
    const decoded = verificarToken(token);

    if (!decoded || !decoded.id) {
      return res.status(401).json({ sucesso: false, erro: 'Token inválido ou expirado.' });
    }

    const user = await User.findById(decoded.id).select('-senha');
    if (!user) {
      return res.status(401).json({ sucesso: false, erro: 'Usuário não encontrado.' });
    }

    if (!user.ativo) {
      return res.status(401).json({ sucesso: false, erro: 'Sua conta está desativada.' });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ sucesso: false, erro: 'Falha na autenticação.' });
  }
}

/**
 * Middleware administrador: exige que o usuário autenticado possua a role 'admin'.
 */
async function autenticarAdmin(req, res, next) {
  // Executa primeiro a autenticação obrigatória
  autenticarObrigatorio(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ sucesso: false, erro: 'Acesso negado. Apenas administradores.' });
    }
    return next();
  });
}

module.exports = {
  autenticarOpcional,
  autenticarObrigatorio,
  autenticarAdmin,
  verificarToken,
  gerarToken
};
