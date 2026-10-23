import mongoose from 'mongoose';
const FonteSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true, maxlength: 120 },
  url: { type: String, required: true, trim: true, maxlength: 2048 },
  ativo: { type: Boolean, default: true },
  ordem: { type: Number, default: 0, min: 0, max: 10000 }
}, { timestamps: true, bufferCommands: false });
export default mongoose.models.Fonte || mongoose.model('Fonte', FonteSchema);