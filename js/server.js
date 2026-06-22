// server.js
require('dotenv').config();
const express = require('express');
const { verificarNoticia } = require('./googleService');

const app = express();
app.use(express.json());
app.use(express.static('public')); // Servir arquivos estáticos

// Configurar CORS para desenvolvimento
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
app.post('/api/verificar', async (req, res) => {
    try {
        const { texto } = req.body;
        
        if (!texto || texto.trim().length === 0) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Texto não fornecido para verificação'
            });
        }
        
        console.log('📨 Recebido:', texto);
        console.log('🔑 API Key configurada:', !!process.env.GOOGLE_API_KEY);
        
        // Chamar a API do Google
        const resultado = await verificarNoticia(texto);
        
        res.json({
            sucesso: true,
            dados: resultado
        });
        
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

// Rota de teste
app.get('/teste', (req, res) => {
    res.json({ mensagem: 'Servidor funcionando! ✅' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});