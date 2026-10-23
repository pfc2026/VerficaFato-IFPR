import express from 'express';
import Verificacao from '../models/Verificacao.js';
import { autenticarOpcional, autenticarObrigatorio } from '../middleware/auth.js';
import { validId, databaseError } from '../middleware/validation.js';
const router = express.Router();
router.get('/', autenticarOpcional, async (req, res) => {
  if (!req.user?._id) return res.json({ sucesso: true, itens: [] });
  try {
    const itens = await Verificacao.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
    return res.json({ sucesso: true, itens });
  } catch (error) { return databaseError(res, error, 'Erro ao buscar histórico.'); }
});
router.delete('/:id', autenticarObrigatorio, validId, async (req, res) => {
  try {
    const item = await Verificacao.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!item) return res.status(404).json({ sucesso: false, erro: 'Item não encontrado.' });
    return res.json({ sucesso: true, mensagem: 'Item removido do histórico com sucesso.' });
  } catch (error) { return databaseError(res, error, 'Erro ao excluir item do histórico.'); }
});
export default router;