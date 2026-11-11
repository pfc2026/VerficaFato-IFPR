import express from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { emailField, passwordField, validate, databaseError } from '../middleware/validation.js';
import { requestPasswordReset, resetPassword, RESET_REQUEST_MESSAGE } from '../services/password-recovery.js';
import { recoveryEmailConfiguration, sendRecoveryEmail } from '../services/recovery-email.js';

const requestSchema = z.object({ email: emailField }).strict();
const resetSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), senha: passwordField }).strict();

export function createPasswordRecoveryRouter({
  requestReset = requestPasswordReset, performReset = resetPassword,
  getConfiguration = recoveryEmailConfiguration, sendEmail = sendRecoveryEmail, rateLimits = true
} = {}) {
  const router = express.Router();
  if (rateLimits) router.use(['/recuperar-senha', '/redefinir-senha'], rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { sucesso: false, erro: 'Muitas tentativas de recuperação. Tente novamente em alguns minutos.' }
  }));
  function errorResponse(res, error) {
    if (error?.status === 503) return res.status(503).json({ sucesso: false, erro: 'A recuperação de senha por e-mail está indisponível. Entre em contato com o suporte.', codigo: 'RECUPERACAO_INDISPONIVEL' });
    if (error?.code === 'TOKEN_INVALIDO') return res.status(400).json({ sucesso: false, erro: error.message, codigo: error.code });
    return databaseError(res, error, 'Não foi possível concluir a recuperação de senha. Tente novamente.');
  }
  router.post('/recuperar-senha', async (req, res) => {
    const body = validate(requestSchema, req.body, res); if (!body) return;
    try {
      const { origin } = getConfiguration();
      await requestReset(body.email, { origin, sendEmail });
      return res.json({ sucesso: true, mensagem: RESET_REQUEST_MESSAGE });
    } catch (error) { return errorResponse(res, error); }
  });
  router.post('/redefinir-senha', async (req, res) => {
    const body = validate(resetSchema, req.body, res); if (!body) return;
    try {
      await performReset(body.token, body.senha);
      return res.json({ sucesso: true, mensagem: 'Senha redefinida com sucesso. Entre novamente com sua nova senha.' });
    } catch (error) { return errorResponse(res, error); }
  });
  return router;
}
