require('dotenv').config();

const app = require('./api/index');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 VerificaFato v2 (local) rodando em http://localhost:${PORT}`);
    console.log(`🔑 Google API Key: ${process.env.GOOGLE_API_KEY ? 'configurada' : 'NÃO configurada'}`);
    console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'configurada' : 'usando padrão (defina no .env!)'}\n`);
});
