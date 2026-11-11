import { createHash } from 'node:crypto';
import { lessons } from '../public/js/education-content.js';
import { sanitizeLesson } from '../routes/admin.js';

// Only untouched historical seed lessons receive the editorial revision.
// Edited lessons remain under the administrator's control.
const LEGACY_SEEDS = {
  maiusculas: ['cda1ba179d5b744931f814db7d87b24ba2aa271c08b93ef46158fbb894f8ef3e', 'Atenção com excesso de maiúsculas', 'Textos com muitas letras maiúsculas podem indicar conteúdo sensacionalista.', 'formato', 'basico', 'fa-exclamation-circle', 1],
  alarmista: ['575862dead31505d2a89b64f6fc25e195b59bcbef78c50757fcd325278fdbbba', 'Palavras alarmistas e sensacionalistas', 'Termos como "urgente" e "bomba" tentam provocar reação imediata.', 'linguagem', 'basico', 'fa-bell', 2],
  fontes: ['39520574fdce6d88ce10eaa2d349193166c39256874d14483da8ce3c75e5e523', 'Verificando as fontes', 'A origem da informação é uma das primeiras pistas de confiabilidade.', 'verificacao', 'intermediario', 'fa-link', 3],
  contexto: ['f4e7d272b9f52cf2bad7cabce9eaade65a30d75f397596f203e8cc91bd7654f0', 'A importância do contexto', 'Uma informação verdadeira pode ser distorcida quando aparece fora de contexto.', 'analise', 'intermediario', 'fa-building', 4],
  emocional: ['1fdb3a83ccc78eb34eee6508fb32c8fa5bb12d18a6e3c939435cff05d17950ee', 'Manipulação emocional', 'Conteúdos falsos costumam explorar medo, raiva ou esperança para viralizar.', 'psicologia', 'avancado', 'fa-heart-pulse', 5],
  midia: ['3c2f8475d7966e657a39b178941e585b9a3ec0bd7ae560f1c752525a1408cf71', 'Imagens manipuladas e deepfakes', 'Fotos, vídeos e prints também podem ser editados ou tirados de contexto.', 'midia', 'avancado', 'fa-image', 6]
};

function untouchedLegacy(record) {
  const legacy = LEGACY_SEEDS[record.lessonId];
  if (!legacy) return false;
  const metadata = ['titulo', 'descricao', 'categoria', 'nivel', 'icone', 'ordem'];
  if (!metadata.every((key, index) => record[key] === legacy[index + 1])) return false;
  const normalized = sanitizeLesson(record.conteudoHTML || '').replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex') === legacy[0];
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

function publicLesson(record, baseline) {
  const html = sanitizeLesson(record.conteudoHTML || '');
  const sameContent = baseline && html === sanitizeLesson(baseline.conteudoHTML);
  const words = html.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const time = record.tempoLeitura ?? (sameContent ? baseline.tempoLeitura : null);
  return {
    lessonId: record.lessonId,
    titulo: String(record.titulo || 'Lição educativa').slice(0, 160),
    descricao: String(record.descricao || '').slice(0, 500),
    conteudoHTML: html,
    categoria: String(record.categoria || 'verificacao').slice(0, 80),
    nivel: ['basico', 'intermediario', 'avancado'].includes(record.nivel) ? record.nivel : 'basico',
    icone: /^fa-[a-z0-9-]{1,76}$/.test(record.icone || '') ? record.icone : 'fa-book',
    ordem: Number.isFinite(record.ordem) ? Math.max(0, Math.min(10000, record.ordem)) : 100,
    tempoLeitura: Number.isFinite(time) ? Math.max(1, Math.min(30, Math.ceil(time))) : Math.max(1, Math.ceil(words / 180)),
    atualizadoEm: validDate(record.atualizadoEm || record.updatedAt) || (sameContent ? baseline.atualizadoEm : null),
    autoria: String(record.autoria || (sameContent ? baseline.autoria : 'VerificaFato · conteúdo educativo')).slice(0, 160),
    ativo: true
  };
}

export function educationCatalog(records = []) {
  const defaults = new Map(lessons.map(lesson => [lesson.lessonId, lesson]));
  const catalog = new Map(lessons.map(lesson => [lesson.lessonId, publicLesson(lesson, lesson)]));
  for (const record of records) {
    if (!record || typeof record.lessonId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(record.lessonId)) continue;
    const legacy = untouchedLegacy(record);
    const id = legacy && record.lessonId === 'alarmista' ? 'sensacionalismo' : record.lessonId;
    if (record.ativo === false) {
      catalog.delete(id);
      continue;
    }
    const baseline = defaults.get(id);
    catalog.set(id, legacy && baseline ? publicLesson(baseline, baseline) : publicLesson(record, baseline));
  }
  return [...catalog.values()].sort((left, right) => left.ordem - right.ordem || left.lessonId.localeCompare(right.lessonId));
}
