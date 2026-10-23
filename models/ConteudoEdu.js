import mongoose from 'mongoose';
const ConteudoEduSchema = new mongoose.Schema({
  lessonId: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
  titulo: { type: String, required: true, trim: true, maxlength: 160 },
  descricao: { type: String, required: true, trim: true, maxlength: 500 },
  conteudoHTML: { type: String, required: true, maxlength: 50000 },
  categoria: { type: String, required: true, trim: true, maxlength: 80 },
  nivel: { type: String, enum: ['basico', 'intermediario', 'avancado'], default: 'basico' },
  icone: { type: String, default: 'fa-book', maxlength: 80 },
  ativo: { type: Boolean, default: true },
  ordem: { type: Number, default: 0, min: 0, max: 10000 }
}, { timestamps: true, bufferCommands: false });
export default mongoose.models.ConteudoEdu || mongoose.model('ConteudoEdu', ConteudoEduSchema);