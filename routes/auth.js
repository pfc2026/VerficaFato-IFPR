import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User from '../models/User.js';
import Verificacao from '../models/Verificacao.js';
import { gerarToken, getSigningSecret, autenticarObrigatorio } from '../middleware/auth.js';
import { textField, emailField, passwordField, currentPasswordField, httpUrl, validate, databaseError } from '../middleware/validation.js';
const router = express.Router();
const registerSchema = z.object({ nome: textField().min(2), email: emailField, senha: passwordField, cidade: textField().optional() }).strict();
const loginSchema = z.object({ email: emailField, senha: currentPasswordField }).strict();
const profileSchema = z.object({ nome: textField().min(2).optional(), email: emailField.optional(), cidade: textField().optional(), fotoPerfil: z.union([z.literal(''), httpUrl.refine(value => value.length <= 500)]).optional(), senhaAtual: currentPasswordField.optional() }).strict();
const passwordSchema = z.object({ senhaAtual: currentPasswordField, novaSenha: passwordField }).strict();
export function dadosPublicos(user, totalVerificacoes) {
  return { id: user._id, _id: user._id, nome: user.nome, email: user.email, role: user.role, cidade: user.cidade, fotoPerfil: user.fotoPerfil || '', createdAt: user.createdAt, totalVerificacoes };
}
function authUnavailable(res, error) {
  if (error?.status === 503) return res.status(503).json({ sucesso: false, erro: 'Autenticação indisponível.' });
  return databaseError(res, error);
}
router.post('/registrar', async (req, res) => {
  const body = validate(registerSchema, req.body, res); if (!body) return;
  try {
    getSigningSecret();
    if (await User.exists({ email: body.email })) return res.status(409).json({ sucesso: false, erro: 'Já existe uma conta com esse e-mail.' });
    const user = await User.create({ ...body, senha: await bcrypt.hash(body.senha, 12), role: 'user' });
    return res.status(201).json({ sucesso: true, token: gerarToken(user._id, user.tokenVersion || 0), usuario: dadosPublicos(user) });
  } catch (error) { return authUnavailable(res, error); }
});
router.post('/entrar', async (req, res) => {
  const body = validate(loginSchema, req.body, res); if (!body) return;
  try {
    getSigningSecret();
    const user = await User.findOne({ email: body.email }).select('+senha');
    if (!user?.ativo || !(await bcrypt.compare(body.senha, user.senha))) return res.status(401).json({ sucesso: false, erro: 'E-mail ou senha incorretos.' });
    return res.json({ sucesso: true, token: gerarToken(user._id, user.tokenVersion || 0), usuario: dadosPublicos(user) });
  } catch (error) { return authUnavailable(res, error); }
});
async function profile(req, res) {
  try {
    const count = await Verificacao.countDocuments({ userId: req.user._id });
    return res.json({ sucesso: true, usuario: dadosPublicos(req.user, count) });
  } catch (error) { return databaseError(res, error, 'Não foi possível carregar o perfil.'); }
}
router.get('/me', autenticarObrigatorio, profile);
router.get('/perfil', autenticarObrigatorio, profile);
router.patch('/perfil', autenticarObrigatorio, async (req, res) => {
  const body = validate(profileSchema, req.body, res); if (!body) return;
  try {
    const { senhaAtual, ...updates } = body;
    if (!Object.keys(updates).length) return res.status(400).json({ sucesso: false, erro: 'Informe ao menos um campo para atualizar.' });
    if (body.email !== undefined) {
      const userWithPassword = await User.findById(req.user._id).select('+senha');
      if (!senhaAtual || !userWithPassword || !(await bcrypt.compare(senhaAtual, userWithPassword.senha))) return res.status(401).json({ sucesso: false, erro: 'Informe a senha atual correta para mudar o e-mail.' });
      if (await User.exists({ email: body.email, _id: { $ne: req.user._id } })) return res.status(409).json({ sucesso: false, erro: 'Esse e-mail já está em uso.' });
    }
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado.' });
    const count = await Verificacao.countDocuments({ userId: user._id });
    return res.json({ sucesso: true, mensagem: 'Perfil atualizado com sucesso.', usuario: dadosPublicos(user, count) });
  } catch (error) { return databaseError(res, error, 'Não foi possível atualizar o perfil.'); }
});
router.patch('/senha', autenticarObrigatorio, async (req, res) => {
  const body = validate(passwordSchema, req.body, res); if (!body) return;
  if (body.senhaAtual === body.novaSenha) return res.status(400).json({ sucesso: false, erro: 'A nova senha deve ser diferente da atual.' });
  try {
    const user = await User.findById(req.user._id).select('+senha');
    if (!user || !(await bcrypt.compare(body.senhaAtual, user.senha))) return res.status(401).json({ sucesso: false, erro: 'A senha atual está incorreta.' });
    user.senha = await bcrypt.hash(body.novaSenha, 12); user.tokenVersion = (user.tokenVersion || 0) + 1; await user.save();
    return res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso. Entre novamente para continuar.' });
  } catch (error) { return databaseError(res, error, 'Não foi possível alterar a senha.'); }
});
export default router;