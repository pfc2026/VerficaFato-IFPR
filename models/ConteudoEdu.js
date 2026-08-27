const mongoose = require('mongoose');

const ConteudoEduSchema = new mongoose.Schema(
  {
    // Identificador estável para a UI/seed (ex: 'maiusculas', 'alarmista')
    lessonId: { type: String, required: true, unique: true, trim: true },

    titulo: { type: String, required: true, trim: true },
    descricao: { type: String, required: true, trim: true },

    // HTML completo da lição
    conteudoHTML: { type: String, required: true },

    categoria: { type: String, required: true, trim: true },
    nivel: { type: String, default: 'basico', trim: true },
    icone: { type: String, default: 'fa-book', trim: true },

    ativo: { type: Boolean, default: true },
    ordem: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ConteudoEdu', ConteudoEduSchema);

