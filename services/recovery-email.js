import { z } from 'zod';

function configurationError() {
  const error = new Error('A recuperação de senha por e-mail está indisponível. Entre em contato com o suporte.');
  error.status = 503;
  error.code = 'RECUPERACAO_INDISPONIVEL';
  return error;
}

export function recoveryEmailConfiguration(env = process.env) {
  const key = (env.RESEND_API_KEY || '').trim();
  const from = (env.RECOVERY_EMAIL_FROM || '').trim();
  const senderEmail = from.match(/<([^<>]+)>$/)?.[1] || from;
  if (!key || /[\r\n]/.test(key + from) || !z.email().safeParse(senderEmail).success) throw configurationError();
  let origin;
  try {
    const url = new URL(env.APP_URL);
    const local = env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname) || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error();
    origin = url.origin;
  } catch { throw configurationError(); }
  return { key, from, origin };
}

export function passwordRecoveryReadiness(env = process.env) {
  try {
    recoveryEmailConfiguration(env);
    return { status: 'configurado', configurado: true, provedor: 'resend' };
  } catch {
    return { status: 'desativado', configurado: false, motivo: 'Recuperação por e-mail não configurada no servidor.' };
  }
}

// Resend's documented HTTP API; credentials never leave the server.
// https://resend.com/docs/api-reference/emails/send-email
export async function sendRecoveryEmail({ to, resetUrl }, { env = process.env, fetcher = fetch } = {}) {
  const { key, from, origin } = recoveryEmailConfiguration(env);
  const url = new URL(resetUrl);
  if (url.origin !== origin || url.pathname !== '/html/Login.html' || !/^[a-f0-9]{64}$/.test(url.searchParams.get('reset') || '')) throw configurationError();
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: [to], subject: 'Redefina sua senha — VerificaFato IFPR',
      text: `Recebemos um pedido para redefinir sua senha no VerificaFato IFPR.\n\nAbra este link para criar uma nova senha:\n${url.href}\n\nO link é válido por 30 minutos e só pode ser usado uma vez. Se você não fez esse pedido, ignore esta mensagem. Sua senha continuará a mesma.`
    }),
    redirect: 'error', signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw configurationError();
  const result = await response.json();
  if (typeof result?.id !== 'string' || !result.id) throw configurationError();
}
