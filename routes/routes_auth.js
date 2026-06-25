// routes/auth.js — VerificaFato
const express  = require('express');
const bcrypt   = require('bcryptjs');
const router   = express.Router();

const User = require('../models/User');
const { gerarToken, autenticarObrigatorio } = require('../middleware/auth');

// ── POST /api/auth/cadastrar ───────────────────────────────
router.post('/cadastrar', async (req, res) => {
    try {
        const { nome, email, senha, cidade } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ sucesso: false, erro: 'Nome, e-mail e senha são obrigatórios.' });
        }
        if (senha.length < 6) {
            return res.status(400).json({ sucesso: false, erro: 'A senha deve ter pelo menos 6 caracteres.' });
        }

        const emailNorm = email.trim().toLowerCase();
        const existe = await User.findOne({ email: emailNorm });
        if (existe) {
            return res.status(409).json({ sucesso: false, erro: 'E-mail já cadastrado.' });
        }

        const hash = await bcrypt.hash(senha, 10);
        const user = await User.create({
            nome:  nome.trim(),
            email: emailNorm,
            senha: hash,
            cidade: cidade?.trim() || ''
        });

        const token = gerarToken(user._id);

        return res.status(201).json({
            sucesso: true,
            token,
            usuario: {
                id:     user._id,
                nome:   user.nome,
                email:  user.email,
                cidade: user.cidade,
                role:   user.role
            }
        });
    } catch (err) {
        console.error('❌ /api/auth/cadastrar:', err.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro interno ao cadastrar.' });
    }
});

// ── POST /api/auth/entrar ──────────────────────────────────
router.post('/entrar', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ sucesso: false, erro: 'E-mail e senha são obrigatórios.' });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) {
            return res.status(401).json({ sucesso: false, erro: 'E-mail ou senha incorretos.' });
        }
        if (!user.ativo) {
            return res.status(401).json({ sucesso: false, erro: 'Conta desativada. Entre em contato com o suporte.' });
        }

        const senhaOk = await bcrypt.compare(senha, user.senha);
        if (!senhaOk) {
            return res.status(401).json({ sucesso: false, erro: 'E-mail ou senha incorretos.' });
        }

        const token = gerarToken(user._id);

        return res.json({
            sucesso: true,
            token,
            usuario: {
                id:     user._id,
                nome:   user.nome,
                email:  user.email,
                cidade: user.cidade,
                role:   user.role
            }
        });
    } catch (err) {
        console.error('❌ /api/auth/entrar:', err.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro interno ao fazer login.' });
    }
});

// ── GET /api/auth/perfil ───────────────────────────────────
router.get('/perfil', autenticarObrigatorio, async (req, res) => {
    try {
        return res.json({
            sucesso: true,
            usuario: {
                id:        req.user._id,
                nome:      req.user.nome,
                email:     req.user.email,
                cidade:    req.user.cidade,
                role:      req.user.role,
                criadoEm:  req.user.createdAt
            }
        });
    } catch (err) {
        console.error('❌ /api/auth/perfil:', err.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro ao buscar perfil.' });
    }
});

// ── PUT /api/auth/perfil ───────────────────────────────────
router.put('/perfil', autenticarObrigatorio, async (req, res) => {
    try {
        const { nome, cidade, senhaAtual, novaSenha } = req.body;

        const user = await User.findById(req.user._id);

        if (nome)   user.nome   = nome.trim();
        if (cidade !== undefined) user.cidade = cidade.trim();

        if (novaSenha) {
            if (!senhaAtual) {
                return res.status(400).json({ sucesso: false, erro: 'Informe a senha atual para alterá-la.' });
            }
            const ok = await bcrypt.compare(senhaAtual, user.senha);
            if (!ok) {
                return res.status(401).json({ sucesso: false, erro: 'Senha atual incorreta.' });
            }
            if (novaSenha.length < 6) {
                return res.status(400).json({ sucesso: false, erro: 'A nova senha deve ter pelo menos 6 caracteres.' });
            }
            user.senha = await bcrypt.hash(novaSenha, 10);
        }

        await user.save();

        return res.json({
            sucesso: true,
            usuario: {
                id:     user._id,
                nome:   user.nome,
                email:  user.email,
                cidade: user.cidade,
                role:   user.role
            }
        });
    } catch (err) {
        console.error('❌ PUT /api/auth/perfil:', err.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar perfil.' });
    }
});

module.exports = router;
