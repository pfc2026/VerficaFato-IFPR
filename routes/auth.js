const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const router = express.Router();

const User = require('../models/User');
const Verificacao = require('../models/Verificacao');

const { gerarToken, verificarToken } = require('../middleware/auth');
const { autenticarObrigatorio } = require('../middleware/auth');

function dadosPublicos(user, totalVerificacoes) {
  return {
    id: user._id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    cidade: user.cidade,
    fotoPerfil: user.fotoPerfil || '',
    createdAt: user.createdAt,
    totalVerificacoes
  };
}


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
        cidade: user.cidade,
        fotoPerfil: user.fotoPerfil || ''
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
        cidade: user.cidade,
        fotoPerfil: user.fotoPerfil || ''
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

router.get('/perfil', autenticarObrigatorio, async (req, res) => {
  try {
    const totalVerificacoes = await Verificacao.countDocuments({ userId: req.user._id });
    return res.json({ sucesso: true, usuario: dadosPublicos(req.user, totalVerificacoes) });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: 'Não foi possível carregar o perfil.' });
  }
});

router.patch('/perfil', autenticarObrigatorio, async (req, res) => {
  try {
    const { nome, email, cidade, fotoPerfil, senhaAtual } = req.body;
    const atualizacoes = {};

    if (nome !== undefined) {
      if (typeof nome !== 'string' || nome.trim().length < 2 || nome.trim().length > 80) {
        return res.status(400).json({ sucesso: false, erro: 'O nome deve ter entre 2 e 80 caracteres.' });
      }
      atualizacoes.nome = nome.trim();
    }
    if (email !== undefined) {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ sucesso: false, erro: 'Informe um e-mail válido.' });
      }
      const usuarioComSenha = await User.findById(req.user._id).select('+senha');
      if (!senhaAtual || !usuarioComSenha || !(await bcrypt.compare(senhaAtual, usuarioComSenha.senha))) {
        return res.status(401).json({ sucesso: false, erro: 'Informe a senha atual correta para mudar o e-mail.' });
      }
      const emailNormalizado = email.trim().toLowerCase();
      const existe = await User.findOne({ email: emailNormalizado, _id: { $ne: req.user._id } });
      if (existe) return res.status(409).json({ sucesso: false, erro: 'Esse e-mail já está em uso.' });
      atualizacoes.email = emailNormalizado;
    }
    if (cidade !== undefined) {
      if (typeof cidade !== 'string' || cidade.length > 80) return res.status(400).json({ sucesso: false, erro: 'Cidade inválida.' });
      atualizacoes.cidade = cidade.trim();
    }
    if (fotoPerfil !== undefined) {
      if (fotoPerfil !== '' && (typeof fotoPerfil !== 'string' || !/^https?:\/\//i.test(fotoPerfil))) {
        return res.status(400).json({ sucesso: false, erro: 'A foto deve ser um link HTTPS válido.' });
      }
      if (typeof fotoPerfil === 'string' && fotoPerfil.length > 500) return res.status(400).json({ sucesso: false, erro: 'O link da foto é muito grande.' });
      atualizacoes.fotoPerfil = fotoPerfil;
    }

    const usuario = await User.findByIdAndUpdate(req.user._id, atualizacoes, { new: true, runValidators: true }).select('-senha');
    const totalVerificacoes = await Verificacao.countDocuments({ userId: usuario._id });
    return res.json({ sucesso: true, mensagem: 'Perfil atualizado com sucesso.', usuario: dadosPublicos(usuario, totalVerificacoes) });
  } catch (err) {
    console.error('Erro ao atualizar perfil:', err);
    return res.status(500).json({ sucesso: false, erro: 'Não foi possível atualizar o perfil.' });
  }
});

router.patch('/senha', autenticarObrigatorio, async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) return res.status(400).json({ sucesso: false, erro: 'Informe a senha atual e a nova senha.' });
    if (typeof novaSenha !== 'string' || novaSenha.length < 6) return res.status(400).json({ sucesso: false, erro: 'A nova senha deve ter pelo menos 6 caracteres.' });
    if (novaSenha === senhaAtual) return res.status(400).json({ sucesso: false, erro: 'A nova senha deve ser diferente da atual.' });
    const usuario = await User.findById(req.user._id);
    if (!usuario || !(await bcrypt.compare(senhaAtual, usuario.senha))) return res.status(401).json({ sucesso: false, erro: 'A senha atual está incorreta.' });
    usuario.senha = await bcrypt.hash(novaSenha, 10);
    await usuario.save();
    return res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso.' });
  } catch (err) {
    console.error('Erro ao alterar senha:', err);
    return res.status(500).json({ sucesso: false, erro: 'Não foi possível alterar a senha.' });
  }
});

module.exports = router;
