const mongoose = require('mongoose');

const VerificacaoSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    texto: { type: String, required: true },
    cidade: { type: String, default: '' },
    categoria: { type: String, default: '' },
    porcentagem: { type: Number, default: 50 },
    veredito: { type: String, default: 'INCONCLUSIVO' },
    explicacao: { type: String, default: '' },
    fonte: { type: String, default: 'local' },
    dadosAPI: { type: Array, default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Verificacao', VerificacaoSchema);

