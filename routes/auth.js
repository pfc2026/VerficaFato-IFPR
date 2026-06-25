const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const router = express.Router();

const User = require('../models/User');
const Verificacao = require('../models/Verificacao');

const { gerarToken, verificarToken } = require('../middleware/auth');


// POST /api/auth/registrar
router.post('/registrar', async (req, res) => {
  try {
    const { nome, email, senha, cidade } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ sucesso: false, erro: 'Nome, e-mail e senha são obrigatórios.' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ sucesso: false, erro: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const existe = await User.findOne({ email });
    if (existe) {
      return res.status(409).json({ sucesso: false, erro: 'Já existe uma conta com esse e-mail.' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const user = await User.create({
      nome,
      email,
      senha: senhaHash,
      cidade: cidade || '',
      role: 'user'
    });

    const token = gerarToken(user._id);

    return res.status(201).json({
      sucesso: true,
      token,
      usuario: {
        id: user._id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        cidade: user.cidade
      }
    });
  } catch (err) {
    console.error('Erro ao registrar:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao criar conta.' });
  }
});

// POST /api/auth/entrar
router.post('/entrar', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ sucesso: false, erro: 'E-mail e senha são obrigatórios.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ sucesso: false, erro: 'E-mail ou senha incorretos.' });
    }

    if (!user.ativo) {
      return res.status(401).json({ sucesso: false, erro: 'Conta desativada. Entre em contato com o suporte.' });
    }

    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) {
      return res.status(401).json({ sucesso: false, erro: 'E-mail ou senha incorretos.' });
    }

    const token = gerarToken(user._id);

    return res.json({
      sucesso: true,
      token,
      usuario: {
        id: user._id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        cidade: user.cidade
      }
    });
  } catch (err) {
    console.error('Erro ao entrar:', err);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao fazer login.' });
  }
});

// GET /api/auth/me (opcional, usado por telas se necessário)
router.get('/me', async (req, res) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ sucesso: false, erro: 'Token não fornecido.' });

  try {
    const token = auth.split(' ')[1];
    const decoded = verificarToken(token);
    if (!decoded?.id) return res.status(401).json({ sucesso: false, erro: 'Token inválido ou expirado.' });
    const user = await User.findById(decoded.id).select('-senha');

    if (!user) return res.status(401).json({ sucesso: false, erro: 'Usuário não encontrado.' });

    // Contagem de verificações do usuário
    const totalVerificacoes = await Verificacao.countDocuments({ userId: user._id });

    return res.json({
      sucesso: true,
      usuario: {
        ...user.toObject(),
        totalVerificacoes
      }
    });
  } catch (err) {
    return res.status(401).json({ sucesso: false, erro: 'Token inválido ou expirado.' });
  }
});

module.exports = router;
