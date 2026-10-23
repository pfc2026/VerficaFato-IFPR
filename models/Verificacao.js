import mongoose from 'mongoose';
const VerificacaoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  texto: { type: String, required: true, maxlength: 20000 },
  cidade: { type: String, default: '', maxlength: 80 },
  categoria: { type: String, default: '', maxlength: 80 },
  porcentagem: { type: Number, default: null },
  confianca: { type: mongoose.Schema.Types.Mixed, default: null },
  veredito: { type: String, default: 'INCONCLUSIVO' },
  explicacao: { type: String, default: '' },
  fonte: { type: String, default: 'local' },
  dadosAPI: { type: Array, default: [] },
  schemaVer: { type: Number, default: 2 },
  resultado: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true, bufferCommands: false });
VerificacaoSchema.index({ userId: 1, createdAt: -1 });
export default mongoose.models.Verificacao || mongoose.model('Verificacao', VerificacaoSchema);