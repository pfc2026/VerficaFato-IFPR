// routes/historico.js — VerificaFato
const express = require('express');
const router  = express.Router();

const Verificacao = require('../models/Verificacao');
const { autenticarObrigatorio } = require('../middleware/auth');

// ── GET /api/historico ─────────────────────────────────────
// Lista as verificações do usuário logado (mais recentes primeiro)
router.get('/', autenticarObrigatorio, async (req, res) => {
    try {
        const pagina  = Math.max(1, parseInt(req.query.pagina)  || 1);
        const limite  = Math.min(50, parseInt(req.query.limite) || 20);
        const skip    = (pagina - 1) * limite;

        const [itens, total] = await Promise.all([
            Verificacao.find({ userId: req.user._id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limite)
                .lean(),
            Verificacao.countDocuments({ userId: req.user._id })
        ]);

        return res.json({
            sucesso: true,
            total,
            pagina,
            paginas: Math.ceil(total / limite),
            itens
        });
    } catch (err) {
        console.error('❌ GET /api/historico:', err.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro ao buscar histórico.' });
    }
});

// ── GET /api/historico/:id ─────────────────────────────────
router.get('/:id', autenticarObrigatorio, async (req, res) => {
    try {
        const item = await Verificacao.findOne({
            _id:    req.params.id,
            userId: req.user._id
        }).lean();

        if (!item) {
            return res.status(404).json({ sucesso: false, erro: 'Verificação não encontrada.' });
        }

        return res.json({ sucesso: true, item });
    } catch (err) {
        console.error('❌ GET /api/historico/:id:', err.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro ao buscar verificação.' });
    }
});

// ── DELETE /api/historico/:id ──────────────────────────────
router.delete('/:id', autenticarObrigatorio, async (req, res) => {
    try {
        const resultado = await Verificacao.findOneAndDelete({
            _id:    req.params.id,
            userId: req.user._id
        });

        if (!resultado) {
            return res.status(404).json({ sucesso: false, erro: 'Verificação não encontrada.' });
        }

        return res.json({ sucesso: true, mensagem: 'Verificação removida.' });
    } catch (err) {
        console.error('❌ DELETE /api/historico/:id:', err.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro ao remover verificação.' });
    }
});

// ── DELETE /api/historico ──────────────────────────────────
// Limpa todo o histórico do usuário logado
router.delete('/', autenticarObrigatorio, async (req, res) => {
    try {
        const { deletedCount } = await Verificacao.deleteMany({ userId: req.user._id });
        return res.json({ sucesso: true, mensagem: `${deletedCount} verificações removidas.` });
    } catch (err) {
        console.error('❌ DELETE /api/historico:', err.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro ao limpar histórico.' });
    }
});

module.exports = router;
