const mongoose = require('mongoose');

const FonteSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    ativo: { type: Boolean, default: true },
    ordem: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Fonte', FonteSchema);

