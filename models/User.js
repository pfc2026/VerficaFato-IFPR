const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    senha: { type: String, required: true }, // hash bcrypt
    cidade: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    ativo: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// método auxiliar compatível (não obrigatório, mas útil)
UserSchema.methods.verificarSenha = async function (senhaPlano) {
  const bcrypt = require('bcryptjs');
  return bcrypt.compare(senhaPlano, this.senha);
};

module.exports = mongoose.model('User', UserSchema);

