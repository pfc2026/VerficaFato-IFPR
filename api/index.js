import app, { connectDatabase } from '../server.js';
export default async function handler(req, res) {
  if (/^\/api\/(auth|admin|historico|fontes|education)(?:\/|\?|$)/.test(req.url || '') || req.headers.authorization) await connectDatabase({ seed: true });
  else if (/^\/api\/verificar(?:\/|\?|$)/.test(req.url || '')) void connectDatabase({ seed: true });
  return app(req, res);
}