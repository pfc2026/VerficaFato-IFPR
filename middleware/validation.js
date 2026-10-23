import { z } from 'zod';
export const textField = (max = 80) => z.string().trim().max(max);
export const emailField = z.string().trim().toLowerCase().email().max(254);
export const passwordField = z.string().min(12).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'A senha deve ter no máximo 72 bytes.');
export const currentPasswordField = z.string().min(1).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Senha inválida.');
export const idField = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido.');
export const httpUrl = z.string().trim().max(2048).refine(value => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}, 'Informe uma URL HTTP ou HTTPS válida.');
export function validate(schema, value, res) {
  const result = schema.safeParse(value);
  if (!result.success) { res.status(400).json({ sucesso: false, erro: 'Dados inválidos. Confira os campos enviados.' }); return null; }
  return result.data;
}
export function validId(req, res, next) {
  if (!idField.safeParse(req.params.id).success) return res.status(400).json({ sucesso: false, erro: 'Identificador inválido.' });
  return next();
}
export function databaseError(res, error, fallback = 'Não foi possível concluir a operação.') {
  if (error?.code === 11000) return res.status(409).json({ sucesso: false, erro: 'Já existe um registro com esses dados.' });
  if (error?.name === 'ValidationError' || error?.name === 'CastError') return res.status(400).json({ sucesso: false, erro: 'Dados inválidos.' });
  return res.status(500).json({ sucesso: false, erro: fallback });
}