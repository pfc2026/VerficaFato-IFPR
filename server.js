require('dotenv').config();
const express = require('express');
const path = require('path');
const { verificarNoticia } = require('./googleService');

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// CORS para desenvolvimento
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ── Rota principal de verificação ──────────────────────────────────────────────
app.post('/api/verificar', async (req, res) => {
    try {
        const { texto, cidade, categoria } = req.body;

        if (!texto || texto.trim().length === 0) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Texto não fornecido para verificação.'
            });
        }

        if (texto.trim().length < 10) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Texto muito curto. Forneça pelo menos 10 caracteres.'
            });
        }

        console.log(`📨 Verificando | cidade: ${cidade || '—'} | categoria: ${categoria || '—'}`);
        console.log(`🔑 GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? 'configurada ✅' : 'ausente ❌'}`);

        const resultado = await verificarNoticia(texto.trim());

        return res.json({
            sucesso: true,
            dados: resultado
        });

    } catch (error) {
        console.error('❌ Erro no endpoint /api/verificar:', error.message);
        return res.status(500).json({
            sucesso: false,
            erro: error.message || 'Erro interno no servidor.'
        });
    }
});

// ── Health-check ───────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
    res.json({
        status: 'ok',
        app: 'VerificaFato',
        apiKey: !!process.env.GOOGLE_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// Fallback: serve index.html para qualquer rota não reconhecida
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 VerificaFato rodando em http://localhost:${PORT}`);
    console.log(`🔑 Google API Key: ${process.env.GOOGLE_API_KEY ? 'configurada' : 'NÃO configurada — defina no .env'}\n`);
});
