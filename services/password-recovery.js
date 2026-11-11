import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { getSigningSecret } from '../middleware/auth.js';
export { passwordRecoveryReadiness } from './recovery-email.js';

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
export const RESET_REQUEST_INTERVAL_MS = 60 * 1000;
export const RESET_REQUEST_MESSAGE = 'Se houver uma conta ativa com esse e-mail, enviaremos um link para redefinir a senha. Confira também a pasta de spam.';
export const hashResetToken = token => crypto.createHash('sha256').update(token).digest('hex');

function invalidToken() {
  const error = new Error('O link de recuperação é inválido ou expirou. Solicite um novo link.');
  error.status = 400;
  error.code = 'TOKEN_INVALIDO';
  return error;
}

// Persist only a digest. The original token exists solely in the e-mail link.
export async function requestPasswordReset(email, {
  users = User, sendEmail, origin, now = () => new Date(), randomBytes = crypto.randomBytes,
  reportDeliveryFailure = () => console.error('Falha ao enviar e-mail de recuperação de senha.')
} = {}) {
  getSigningSecret();
  if (typeof sendEmail !== 'function' || !origin) {
    const error = new Error('A recuperação de senha por e-mail está indisponível. Entre em contato com o suporte.');
    error.status = 503;
    error.code = 'RECUPERACAO_INDISPONIVEL';
    throw error;
  }
  const user = await users.findOne({ email, ativo: true }).select('_id email');
  if (!user) return;
  const requestedAt = now();
  const token = randomBytes(32).toString('hex');
  const digest = hashResetToken(token);
  const expiresAt = new Date(requestedAt.getTime() + RESET_TOKEN_TTL_MS);
  // Atomic cooldown also protects against concurrent requests for the same account.
  const updated = await users.findOneAndUpdate({
    _id: user._id, ativo: true,
    $or: [
      { resetPasswordRequestedAt: { $exists: false } },
      { resetPasswordRequestedAt: { $lte: new Date(requestedAt.getTime() - RESET_REQUEST_INTERVAL_MS) } }
    ]
  }, { $set: { resetPasswordTokenHash: digest, resetPasswordExpiresAt: expiresAt, resetPasswordRequestedAt: requestedAt } });
  if (!updated) return;
  const url = new URL('/html/Login.html', origin);
  url.searchParams.set('reset', token);
  try {
    await sendEmail({ to: user.email, resetUrl: url.href });
  } catch {
    // Returning the same response for absent users and delivery failures avoids
    // disclosing which e-mail addresses have an account.
    await users.updateOne({ _id: user._id, resetPasswordTokenHash: digest }, {
      $unset: { resetPasswordTokenHash: '', resetPasswordExpiresAt: '' }
    });
    reportDeliveryFailure();
  }
}

export async function resetPassword(token, password, { users = User, now = () => new Date(), hashPassword = value => bcrypt.hash(value, 12) } = {}) {
  getSigningSecret();
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw invalidToken();
  const digest = hashResetToken(token);
  const query = { ativo: true, resetPasswordTokenHash: digest, resetPasswordExpiresAt: { $gt: now() } };
  // Verify before computing bcrypt; malformed/expired tokens must remain cheap.
  if (!(await users.exists(query))) throw invalidToken();
  const senha = await hashPassword(password);
  const user = await users.findOneAndUpdate({ ...query, resetPasswordExpiresAt: { $gt: now() } }, {
    $set: { senha },
    $unset: { resetPasswordTokenHash: '', resetPasswordExpiresAt: '', resetPasswordRequestedAt: '' },
    $inc: { tokenVersion: 1 }
  });
  if (!user) throw invalidToken();
}
