import { analisarConteudo } from '../../services/analysis.js';
import { generateExplanation } from '../../services/explanation.js';

// Positive wire fixtures use the same pipeline that builds production results.
// Only external dependencies are controlled; the result contract is not copied.
const base = await analisarConteudo({ texto: 'A prefeitura anunciou uma nova biblioteca em 2025.' }, {
  check: async () => ({ apiDisponivel: true, resultados: [] }),
  nlp: async () => ({ indicadores: [], comparacoes: [], tensorflow: {
    disponivel: true, comparacoesExecutadas: 0, modelo: null, metodo: 'runtime disponível sem pares', limitacoes: []
  } }),
  explain: result => generateExplanation(result, { enabled: false })
});

export function analysisFixture(overrides = {}) {
  return { ...structuredClone(base), ...overrides };
}
