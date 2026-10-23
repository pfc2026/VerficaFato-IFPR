import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
const UserSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
  senha: { type: String, required: true, select: false },
  cidade: { type: String, default: '', maxlength: 80 },
  fotoPerfil: { type: String, default: '', maxlength: 500 },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  ativo: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0, min: 0 }
}, { timestamps: true, bufferCommands: false });
UserSchema.methods.verificarSenha = function (password) { return bcrypt.compare(password, this.senha); };
export default mongoose.models.User || mongoose.model('User', UserSchema);