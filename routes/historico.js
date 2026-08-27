const express = require('express');

const router = express.Router();

const Verificacao = require('../models/Verificacao');
const { autenticarOpcional, autenticarObrigatorio } = require('../middleware/auth');

// Retorna histórico do usuário logado (se houver token).
router.get('/', autenticarOpcional, async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.json({ sucesso: true, itens: [] });
    }

    const itens = await Verificacao.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({ sucesso: true, itens });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao buscar histórico.' });
  }
});

// Remove um registro específico do histórico (apenas se pertencer ao próprio usuário).
router.delete('/:id', autenticarObrigatorio, async (req, res) => {
  try {
    const item = await Verificacao.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!item) {
      return res.status(404).json({ sucesso: false, erro: 'Item não encontrado ou você não tem permissão para excluí-lo.' });
    }

    return res.json({ sucesso: true, mensagem: 'Item removido do histórico com sucesso.' });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao excluir item do histórico.' });
  }
});

module.exports = router;
