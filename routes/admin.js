import express from 'express';
import { getMetrics } from '../middleware/metrics.js';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import { autenticarAdmin } from '../middleware/auth.js';
import { textField, httpUrl, validate, validId, databaseError } from '../middleware/validation.js';
import User from '../models/User.js';
import Fonte from '../models/Fonte.js';
import Verificacao from '../models/Verificacao.js';
import ConteudoEdu from '../models/ConteudoEdu.js';
const router = express.Router();
router.use(autenticarAdmin);
router.get('/metricas', (req, res) => res.json({ sucesso: true, metricas: getMetrics() }));
const order = z.number().int().min(0).max(10000).default(0);
const sourceSchema = z.object({ nome: textField(120).min(2), url: httpUrl, ativo: z.boolean().default(true), ordem: order }).strict();
const lessonSchema = z.object({ lessonId: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/), titulo: textField(160).min(2), descricao: textField(500).min(2), conteudoHTML: z.string().min(1).max(50000), categoria: textField().min(1), nivel: z.enum(['basico', 'intermediario', 'avancado']).default('basico'), icone: z.string().regex(/^fa-[a-z0-9-]+$/).max(80).default('fa-book'), ativo: z.boolean().default(true), ordem: order }).strict();
const userSchema = z.object({ role: z.enum(['user', 'admin']).optional(), ativo: z.boolean().optional() }).strict().refine(value => Object.keys(value).length > 0);
export function sanitizeLesson(html) {
  return sanitizeHtml(html, { allowedTags: ['h2','h3','h4','p','br','strong','em','b','i','ul','ol','li','blockquote','a'], allowedAttributes: { a: ['href','title'] }, allowedSchemes: ['http','https'], allowProtocolRelative: false, disallowedTagsMode: 'discard' });
}
router.get('/resumo', async (req, res) => {
  try {
    const [totalUsuarios,totalFontes,totalLicoes,totalVerificacoes,ultimasVerificacoes] = await Promise.all([User.countDocuments(), Fonte.countDocuments(), ConteudoEdu.countDocuments(), Verificacao.countDocuments(), Verificacao.find().populate('userId','nome email').sort({ createdAt: -1 }).limit(10)]);
    return res.json({ sucesso: true, resumo: { totalUsuarios,totalFontes,totalLicoes,totalVerificacoes,ultimasVerificacoes } });
  } catch (error) { return databaseError(res, error, 'Erro ao carregar resumo.'); }
});
function contentRoutes(base, model, schema, key, plural) {
  router.get(base, async (req, res) => {
    try { return res.json({ sucesso: true, [plural]: await model.find().sort({ ordem: 1 }).limit(500) }); }
    catch (error) { return databaseError(res, error); }
  });
  router.post(base, async (req, res) => {
    const body = validate(schema, req.body, res); if (!body) return;
    if (body.conteudoHTML !== undefined) body.conteudoHTML = sanitizeLesson(body.conteudoHTML);
    try { return res.status(201).json({ sucesso: true, [key]: await model.create(body) }); }
    catch (error) { return databaseError(res, error); }
  });
  router.put(`${base}/:id`, validId, async (req, res) => {
    const body = validate(schema, req.body, res); if (!body) return;
    if (body.conteudoHTML !== undefined) body.conteudoHTML = sanitizeLesson(body.conteudoHTML);
    try {
      const item = await model.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true });
      if (!item) return res.status(404).json({ sucesso: false, erro: 'Registro não encontrado.' });
      return res.json({ sucesso: true, [key]: item });
    } catch (error) { return databaseError(res, error); }
  });
  router.delete(`${base}/:id`, validId, async (req, res) => {
    try {
      const item = await model.findByIdAndDelete(req.params.id);
      if (!item) return res.status(404).json({ sucesso: false, erro: 'Registro não encontrado.' });
      return res.json({ sucesso: true, mensagem: 'Registro excluído com sucesso.' });
    } catch (error) { return databaseError(res, error); }
  });
}
contentRoutes('/fontes', Fonte, sourceSchema, 'fonte', 'fontes');
contentRoutes('/licoes', ConteudoEdu, lessonSchema, 'licao', 'licoes');
router.get('/usuarios', async (req, res) => {
  try { return res.json({ sucesso: true, usuarios: await User.find().select('-senha -tokenVersion').sort({ createdAt: -1 }).limit(500) }); }
  catch (error) { return databaseError(res, error); }
});
router.put('/usuarios/:id', validId, async (req, res) => {
  if (req.params.id === String(req.user._id)) return res.status(400).json({ sucesso: false, erro: 'Você não pode alterar seu próprio status ou permissão.' });
  const body = validate(userSchema, req.body, res); if (!body) return;
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { $set: body, $inc: { tokenVersion: 1 } }, { new: true, runValidators: true }).select('-senha -tokenVersion');
    if (!user) return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado.' });
    return res.json({ sucesso: true, usuario: user });
  } catch (error) { return databaseError(res, error); }
});
router.get('/verificacoes', async (req, res) => {
  try { return res.json({ sucesso: true, verificacoes: await Verificacao.find().populate('userId', 'nome email').sort({ createdAt: -1 }).limit(100) }); }
  catch (error) { return databaseError(res, error); }
});
router.delete('/verificacoes/:id', validId, async (req, res) => {
  try {
    if (!(await Verificacao.findByIdAndDelete(req.params.id))) return res.status(404).json({ sucesso: false, erro: 'Registro não encontrado.' });
    return res.json({ sucesso: true, mensagem: 'Registro de verificação removido.' });
  } catch (error) { return databaseError(res, error); }
});
export default router;