import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { rankRegionalNews, regionalTerms } from '../services/regional-news.js';
const NoticiaColetadaSchema = new mongoose.Schema({
  titulo: { type: String, required: true, trim: true }, texto: { type: String, required: true },
  data_publicacao: { type: String, default: null }, url: { type: String, required: true, unique: true, trim: true },
  fonte: { type: String, required: true, trim: true }, coletado_em: { type: String, required: true }, content_hash: { type: String, required: true }
}, { timestamps: true, collection: 'noticias_coletadas', bufferCommands: false });
NoticiaColetadaSchema.index({ titulo: 'text', texto: 'text' }, { weights: { titulo: 10, texto: 2 }, default_language: 'portuguese' });
// Matches are related publications, never proof that the submitted claim is true.
NoticiaColetadaSchema.statics.buscarCorrespondentes = async function (textoBusca, urlBusca = '') {
  const link = typeof urlBusca === 'string' ? urlBusca.trim() : '';
  const terms = regionalTerms(textoBusca);
  if (this.db.readyState === 1) {
    try {
      if (link) {
        const exact = await this.findOne({ url: link }).maxTimeMS(1500).lean();
        if (exact) return [{ ...exact, correspondencia: 'url' }];
      }
      if (terms.length) {
        const related = await this.find({ $text: { $search: terms.slice(0, 100).join(' ') } }, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } }).limit(30).maxTimeMS(1500).lean();
        const relevant = rankRegionalNews(related, textoBusca);
        if (relevant.length) return relevant;
      }
    } catch { /* A local archive can still supply related publications. */ }
  }
  try {
    const records = JSON.parse(await readFile(new URL('../data/noticias.json', import.meta.url), 'utf8'));
    if (!Array.isArray(records)) return [];
    if (link) { const exact = records.find(item => item.url === link); if (exact) return [{ ...exact, correspondencia: 'url' }]; }
    return rankRegionalNews(records, textoBusca);
  } catch { return []; }
};
export default mongoose.models.NoticiaColetada || mongoose.model('NoticiaColetada', NoticiaColetadaSchema);
