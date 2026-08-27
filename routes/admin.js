const express = require('express');
const { autenticarAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Fonte = require('../models/Fonte');
const Verificacao = require('../models/Verificacao');
const ConteudoEdu = require('../models/ConteudoEdu');

const router = express.Router();

// Aplica autenticação de Administrador para todas as rotas deste arquivo
router.use(autenticarAdmin);

// ── GET /api/admin/resumo ───────────────────────────────────
router.get('/resumo', async (req, res) => {
  try {
    const totalUsuarios = await User.countDocuments();
    const totalFontes = await Fonte.countDocuments();
    const totalLicoes = await ConteudoEdu.countDocuments();
    const totalVerificacoes = await Verificacao.countDocuments();

    // Últimas 10 verificações realizadas
    const ultimasVerificacoes = await Verificacao.find()
      .populate('userId', 'nome email')
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({
      sucesso: true,
      resumo: {
        totalUsuarios,
        totalFontes,
        totalLicoes,
        totalVerificacoes,
        ultimasVerificacoes
      }
    });
  } catch (err) {
    console.error('Erro no resumo admin:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro ao carregar dados do resumo.' });
  }
});

// ── CRUD Fontes ─────────────────────────────────────────────
router.get('/fontes', async (req, res) => {
  try {
    const fontes = await Fonte.find().sort({ ordem: 1 });
    return res.json({ sucesso: true, fontes });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao listar fontes.' });
  }
});

router.post('/fontes', async (req, res) => {
  try {
    const { nome, url, ativo, ordem } = req.body;
    if (!nome || !url) {
      return res.status(400).json({ sucesso: false, erro: 'Nome e URL são obrigatórios.' });
    }
    const fonte = await Fonte.create({ nome, url, ativo: ativo !== false, ordem: ordem || 0 });
    return res.status(201).json({ sucesso: true, fonte });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao criar fonte.' });
  }
});

router.put('/fontes/:id', async (req, res) => {
  try {
    const { nome, url, ativo, ordem } = req.body;
    if (!nome || !url) {
      return res.status(400).json({ sucesso: false, erro: 'Nome e URL são obrigatórios.' });
    }
    const fonte = await Fonte.findByIdAndUpdate(
      req.params.id,
      { nome, url, ativo, ordem },
      { new: true }
    );
    if (!fonte) return res.status(404).json({ sucesso: false, erro: 'Fonte não encontrada.' });
    return res.json({ sucesso: true, fonte });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar fonte.' });
  }
});

router.delete('/fontes/:id', async (req, res) => {
  try {
    const fonte = await Fonte.findByIdAndDelete(req.params.id);
    if (!fonte) return res.status(404).json({ sucesso: false, erro: 'Fonte não encontrada.' });
    return res.json({ sucesso: true, mensagem: 'Fonte excluída com sucesso.' });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao excluir fonte.' });
  }
});

// ── CRUD Lições (Conteúdo Educativo) ───────────────────────
router.get('/licoes', async (req, res) => {
  try {
    const licoes = await ConteudoEdu.find().sort({ ordem: 1 });
    return res.json({ sucesso: true, licoes });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao listar lições.' });
  }
});

router.post('/licoes', async (req, res) => {
  try {
    const { lessonId, titulo, descricao, conteudoHTML, categoria, nivel, icone, ativo, ordem } = req.body;
    if (!lessonId || !titulo || !descricao || !conteudoHTML || !categoria) {
      return res.status(400).json({ sucesso: false, erro: 'Campos obrigatórios ausentes.' });
    }
    const licao = await ConteudoEdu.create({
      lessonId,
      titulo,
      descricao,
      conteudoHTML,
      categoria,
      nivel: nivel || 'basico',
      icone: icone || 'fa-book',
      ativo: ativo !== false,
      ordem: ordem || 0
    });
    return res.status(201).json({ sucesso: true, licao });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ sucesso: false, erro: 'Já existe uma lição com este ID (lessonId).' });
    }
    return res.status(500).json({ sucesso: false, erro: 'Erro ao criar lição.' });
  }
});

router.put('/licoes/:id', async (req, res) => {
  try {
    const { lessonId, titulo, descricao, conteudoHTML, categoria, nivel, icone, ativo, ordem } = req.body;
    if (!lessonId || !titulo || !descricao || !conteudoHTML || !categoria) {
      return res.status(400).json({ sucesso: false, erro: 'Campos obrigatórios ausentes.' });
    }
    const licao = await ConteudoEdu.findByIdAndUpdate(
      req.params.id,
      { lessonId, titulo, descricao, conteudoHTML, categoria, nivel, icone, ativo, ordem },
      { new: true }
    );
    if (!licao) return res.status(404).json({ sucesso: false, erro: 'Lição não encontrada.' });
    return res.json({ sucesso: true, licao });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar lição.' });
  }
});

router.delete('/licoes/:id', async (req, res) => {
  try {
    const licao = await ConteudoEdu.findByIdAndDelete(req.params.id);
    if (!licao) return res.status(404).json({ sucesso: false, erro: 'Lição não encontrada.' });
    return res.json({ sucesso: true, mensagem: 'Lição excluída com sucesso.' });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao excluir lição.' });
  }
});

// ── Usuários (Bloqueio / Promoção) ─────────────────────────
router.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await User.find().select('-senha').sort({ createdAt: -1 });
    return res.json({ sucesso: true, usuarios });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao listar usuários.' });
  }
});

router.put('/usuarios/:id', async (req, res) => {
  try {
    const { role, ativo } = req.body;

    // Impede o admin logado de alterar a si mesmo para evitar auto-bloqueio ou auto-rebaixamento
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ sucesso: false, erro: 'Você não pode alterar seu próprio status ou permissão.' });
    }

    const updates = {};
    if (role !== undefined) updates.role = role;
    if (ativo !== undefined) updates.ativo = ativo;

    const usuario = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-senha');
    if (!usuario) return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado.' });
    return res.json({ sucesso: true, usuario });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar usuário.' });
  }
});

// ── Verificações (Monitoramento Global) ────────────────────
router.get('/verificacoes', async (req, res) => {
  try {
    const verificacoes = await Verificacao.find()
      .populate('userId', 'nome email')
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({ sucesso: true, verificacoes });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao carregar verificações.' });
  }
});

router.delete('/verificacoes/:id', async (req, res) => {
  try {
    const verificacao = await Verificacao.findByIdAndDelete(req.params.id);
    if (!verificacao) return res.status(404).json({ sucesso: false, erro: 'Registro de verificação não encontrado.' });
    return res.json({ sucesso: true, mensagem: 'Registro de verificação removido.' });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Erro ao remover registro de verificação.' });
  }
});

module.exports = router;
