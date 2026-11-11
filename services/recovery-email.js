import { z } from 'zod';

function configurationError() {
  const error = new Error('A recuperação de senha por e-mail está indisponível. Entre em contato com o suporte.');
  error.status = 503;
  error.code = 'RECUPERACAO_INDISPONIVEL';
  return error;
}

export function recoveryEmailConfiguration(env = process.env) {
  // Preserve existing Resend installations; select Brevo explicitly for new ones.
  const provider = (env.RECOVERY_EMAIL_PROVIDER || 'resend').trim().toLowerCase();
  if (!['resend', 'brevo'].includes(provider)) throw configurationError();
  const key = (env[provider === 'brevo' ? 'BREVO_API_KEY' : 'RESEND_API_KEY'] || '').trim();
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
  return { key, from, origin, provider };
}

export function passwordRecoveryReadiness(env = process.env) {
  try {
    const { provider } = recoveryEmailConfiguration(env);
    return { status: 'configurado', configurado: true, provedor: provider };
  } catch {
    return { status: 'desativado', configurado: false, motivo: 'Recuperação por e-mail não configurada no servidor.' };
  }
}

// Provider HTTP APIs; credentials never leave the server.
// https://resend.com/docs/api-reference/emails/send-email
// https://developers.brevo.com/reference/send-transac-email
export async function sendRecoveryEmail({ to, resetUrl }, { env = process.env, fetcher = fetch, logger = console.error } = {}) {
  const { key, from, origin, provider } = recoveryEmailConfiguration(env);
  const url = new URL(resetUrl);
  if (url.origin !== origin || url.pathname !== '/html/Login.html' || !/^[a-f0-9]{64}$/.test(url.searchParams.get('reset') || '')) throw configurationError();
  const subject = 'Redefina sua senha — VerificaFato IFPR';
  const text = `Recebemos um pedido para redefinir sua senha no VerificaFato IFPR.\n\nAbra este link para criar uma nova senha:\n${url.href}\n\nO link é válido por 30 minutos e só pode ser usado uma vez. Se você não fez esse pedido, ignore esta mensagem. Sua senha continuará a mesma.`;
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:#1a6b3a;padding:28px 32px;text-align:center">
          <span style="color:#ffffff;font-size:22px;font-weight:bold">✅ VerificaFato IFPR</span>
        </td></tr>
        <tr><td style="padding:36px 32px">
          <h1 style="color:#1a1a1a;font-size:20px;margin:0 0 16px">Redefinição de senha</h1>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px">Recebemos uma solicitação para redefinir a senha da sua conta no <strong>VerificaFato IFPR</strong>.</p>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 28px">Clique no botão abaixo para criar uma nova senha:</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px">
            <tr><td style="background:#1a6b3a;border-radius:8px;text-align:center">
              <a href="${url.href}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">Redefinir minha senha</a>
            </td></tr>
          </table>
          <p style="color:#888;font-size:13px;line-height:1.5;margin:0 0 8px">⏱ Este link é válido por <strong>30 minutos</strong> e só pode ser usado uma vez.</p>
          <p style="color:#888;font-size:13px;line-height:1.5;margin:0 0 24px">Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanece a mesma.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#aaa;font-size:12px;margin:0">Se o botão não funcionar, copie e cole este link no navegador:<br>
          <a href="${url.href}" style="color:#1a6b3a;word-break:break-all">${url.href}</a></p>
        </td></tr>
        <tr><td style="background:#f9f9f9;padding:16px 32px;text-align:center">
          <p style="color:#bbb;font-size:12px;margin:0">VerificaFato IFPR — Projeto de verificação de fatos</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const senderMatch = from.match(/^(.*?)\s*<([^<>]+)>$/);
  const sender = senderMatch ? { name: senderMatch[1].trim() || 'VerificaFato IFPR', email: senderMatch[2] } : { name: 'VerificaFato IFPR', email: from };
  const brevo = provider === 'brevo';
  let response;
  try {
    response = await fetcher(brevo ? 'https://api.brevo.com/v3/smtp/email' : 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { ...(brevo ? { 'api-key': key } : { Authorization: `Bearer ${key}` }), 'Content-Type': 'application/json' },
      body: JSON.stringify(brevo
        ? { sender, to: [{ email: to }], subject, textContent: text, htmlContent: html }
        : { from, to: [to], subject, text, html }),
      redirect: 'error', signal: AbortSignal.timeout(10000)
    });
  } catch {
    logger(`[recovery-email] Falha de rede ao contatar ${provider}.`);
    throw configurationError();
  }
  if (!response.ok) {
    logger(`[recovery-email] ${provider} retornou HTTP ${response.status}.`);
    throw configurationError();
  }
  const result = await response.json();
  const messageId = brevo ? result?.messageId : result?.id;
  if (typeof messageId !== 'string' || !messageId) {
    logger(`[recovery-email] ${provider} não retornou messageId.`);
    throw configurationError();
  }
}