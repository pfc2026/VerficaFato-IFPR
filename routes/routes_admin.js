// routes/admin.js — VerificaFato
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');

const User        = require('../models/User');
const Verificacao = require('../models/Verificacao');
const Fonte       = require('../models/Fonte');
const ConteudoEdu = require('../models/ConteudoEdu');
const { autenticarAdmin } = require('../middleware/auth');

// Todas as rotas abaixo exigem token de administrador
router.use(autenticarAdmin);

// ── GET /api/admin/resumo ──────────────────────────────────
router.get('/resumo', async (req, res) => {
    try {
        const [totalUsuarios, totalVerificacoes, totalFontes, totalLicoes,
               verificacoesHoje, usuariosAtivos] = await Promise.all([
            User.countDocuments(),
            Verificacao.countDocuments(),
            Fonte.countDocuments({ ativo: true }),
            ConteudoEdu.countDocuments({ ativo: true }),
            Verificacao.countDocuments({
                createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
            }),
            User.countDocuments({ ativo: true })
        ]);

        // Distribuição de vereditos
        const distribuicao = await Verificacao.aggregate([
            { $group: { _id: '$veredito', total: { $sum: 1 } } },
            { $sort: { total: -1 } }
        ]);

        // Categorias mais verificadas
        const categorias = await Verificacao.aggregate([
            { $match: { categoria: { $ne: '' } } },
            { $group: { _id: '$categoria', total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $limit: 5 }
        ]);

        return res.json({
            sucesso: true,
            resumo: {
                totalUsuarios,
                usuariosAtivos,
                totalVerificacoes,
                verificacoesHoje,
                totalFontes,
                totalLicoes,
                distribuicaoVereditos: distribuicao,
                categoriasMaisVerificadas: categorias
            }
        });
    } catch (err) {
        console.error('❌ GET /api/admin/resumo:', err.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro ao gerar resumo.' });
    }
});

// ── GET /api/admin/usuarios ────────────────────────────────
router.get('/usuarios', async (req, res) => {
    try {
        const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
        const limite = Math.min(100, parseInt(req.query.limite) || 30);
        const busca  = req.query.busca || '';

        const filtro = busca
            ? { $or: [
                { nome:  { $regex: busca, $options: 'i' } },
                { email: { $regex: busca, $options: 'i' } }
              ] }
            : {};

        const [usuarios, total] = await Promise.all([
            User.find(filtro)
                .select('-senha')
                .sort({ createdAt: -1 })
                .skip((pagina - 1) * limite)
                .limit(limite)
                .lean(),
            User.countDocuments(filtro)
        ]);

        return res.json({ sucesso: true, total, pagina, usuarios });
    } catch (err) {
        console.error('❌ GET /api/admin/usuarios:', err.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro ao listar usuários.' });
    }
});

// ── PUT /api/admin/usuarios/:id ────────────────────────────
router.put('/usuarios/:id', async (req, res) => {
    try {
        const { nome, email, role, ativo, novaSenha } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado.' });

        if (nome  !== undefined) user.nome  = nome.trim();
        if (email !== undefined) user.email = email.trim().toLowerCase();
        if (role  !== undefined && ['user','admin'].includes(role)) user.role = role;
        if (ativo !== undefined) user.ativo = Boolean(ativo);
        if (novaSenha && novaSenha.length >= 6) {
            user.senha = await bcrypt.hash(novaSenha, 10);
        }

        await user.save();
        return res.json({ sucesso: true, mensagem: 'Usuário atualizado.' });
    } catch (err) {
        console.error('❌ PUT /api/admin/usuarios/:id:', err.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar usuário.' });
    }
});

// ── DELETE /api/admin/usuarios/:id ────────────────────────
router.delete('/usuarios/:id', async (req, res) => {
    try {
        if (req.params.id === String(req.user._id)) {
            return res.status(400).json({ sucesso: false, erro: 'Você não pode excluir sua própria conta pelo painel.' });
        }
        await User.findByIdAndDelete(req.params.id);
        await Verificacao.deleteMany({ userId: req.params.id });
        return res.json({ sucesso: true, mensagem: 'Usuário e histórico removidos.' });
    } catch (err) {
        console.error('❌ DELETE /api/admin/usuarios/:id:', err.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro ao excluir usuário.' });
    }
});

// ── GET /api/admin/verificacoes ────────────────────────────
router.get('/verificacoes', async (req, res) => {
    try {
        const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
        const limite = Math.min(100, parseInt(req.query.limite) || 30);

        const [itens, total] = await Promise.all([
            Verificacao.find()
                .sort({ createdAt: -1 })
                .skip((pagina - 1) * limite)
                .limit(limite)
                .populate('userId', 'nome email')
                .lean(),
            Verificacao.countDocuments()
        ]);

        return res.json({ sucesso: true, total, pagina, itens });
    } catch (err) {
        console.error('❌ GET /api/admin/verificacoes:', err.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro ao listar verificações.' });
    }
});

// ── Fontes ─────────────────────────────────────────────────
// GET /api/admin/fontes
router.get('/fontes', async (req, res) => {
    try {
        const fontes = await Fonte.find().sort({ ordem: 1 }).lean();
        return res.json({ sucesso: true, fontes });
    } catch (err) {
        return res.status(500).json({ sucesso: false, erro: 'Erro ao listar fontes.' });
    }
});

// POST /api/admin/fontes
router.post('/fontes', async (req, res) => {
    try {
        const { nome, url, ordem } = req.body;
        if (!nome || !url) return res.status(400).json({ sucesso: false, erro: 'Nome e URL são obrigatórios.' });
        const fonte = await Fonte.create({ nome: nome.trim(), url: url.trim(), ordem: ordem || 0 });
        return res.status(201).json({ sucesso: true, fonte });
    } catch (err) {
        return res.status(500).json({ sucesso: false, erro: 'Erro ao criar fonte.' });
    }
});

// PUT /api/admin/fontes/:id
router.put('/fontes/:id', async (req, res) => {
    try {
        const { nome, url, ativo, ordem } = req.body;
        const fonte = await Fonte.findByIdAndUpdate(
            req.params.id,
            { nome, url, ativo, ordem },
            { new: true, runValidators: true }
        );
        if (!fonte) return res.status(404).json({ sucesso: false, erro: 'Fonte não encontrada.' });
        return res.json({ sucesso: true, fonte });
    } catch (err) {
        return res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar fonte.' });
    }
});

// DELETE /api/admin/fontes/:id
router.delete('/fontes/:id', async (req, res) => {
    try {
        await Fonte.findByIdAndDelete(req.params.id);
        return res.json({ sucesso: true, mensagem: 'Fonte removida.' });
    } catch (err) {
        return res.status(500).json({ sucesso: false, erro: 'Erro ao remover fonte.' });
    }
});

// ── Lições educativas ──────────────────────────────────────
// GET /api/admin/licoes
router.get('/licoes', async (req, res) => {
    try {
        const licoes = await ConteudoEdu.find().sort({ ordem: 1 }).lean();
        return res.json({ sucesso: true, licoes });
    } catch (err) {
        return res.status(500).json({ sucesso: false, erro: 'Erro ao listar lições.' });
    }
});

// POST /api/admin/licoes
router.post('/licoes', async (req, res) => {
    try {
        const { lessonId, titulo, descricao, conteudoHTML, categoria, nivel, icone, ordem } = req.body;
        if (!lessonId || !titulo || !descricao || !conteudoHTML || !categoria) {
            return res.status(400).json({ sucesso: false, erro: 'Campos obrigatórios ausentes.' });
        }
        const licao = await ConteudoEdu.create({ lessonId, titulo, descricao, conteudoHTML, categoria, nivel, icone, ordem });
        return res.status(201).json({ sucesso: true, licao });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ sucesso: false, erro: 'lessonId já existe.' });
        return res.status(500).json({ sucesso: false, erro: 'Erro ao criar lição.' });
    }
});

// PUT /api/admin/licoes/:id
router.put('/licoes/:id', async (req, res) => {
    try {
        const licao = await ConteudoEdu.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!licao) return res.status(404).json({ sucesso: false, erro: 'Lição não encontrada.' });
        return res.json({ sucesso: true, licao });
    } catch (err) {
        return res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar lição.' });
    }
});

// DELETE /api/admin/licoes/:id
router.delete('/licoes/:id', async (req, res) => {
    try {
        await ConteudoEdu.findByIdAndDelete(req.params.id);
        return res.json({ sucesso: true, mensagem: 'Lição removida.' });
    } catch (err) {
        return res.status(500).json({ sucesso: false, erro: 'Erro ao remover lição.' });
    }
});

module.exports = router;
