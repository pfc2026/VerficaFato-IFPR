// Índice de veracidade mostrado ao usuário (0–100).
// Fórmula pública e sem valores padrão:
//   - TensorFlow: probabilidade do modelo treinado de padrões de linguagem (data/modelo-padroes.json).
//   - Google Fact Check: média das avaliações das checagens encontradas (falso = 0, parcial = 50,
//     verdadeiro = 100), ponderada pela semelhança entre a checagem e o texto enviado.
//   - Só contam checagens com semelhança ≥ 0,5 com uma afirmação do texto (mesma alegação).
//   - Peso do Fact Check = 0,8 × semelhança da checagem mais parecida.
//   - Sem checagem: conhecimento geral do Gemini 60% + TensorFlow 40% (se o Gemini não conhecer o fato, só TensorFlow).
// Não há arredondamento para faixas, valor mínimo/máximo artificial nem número inventado.
import { estimateClassification } from '../public/js/ai-estimate.js';

const plain = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
// Converte a avaliação textual da agência em nota 0–100; null quando não dá para saber.
export function ratingScore(rating) {
  const r = plain(rating);
  if (!r) return null;
  if (/parcial|em parte|meia verdade|impreciso|exagerad|subestimad|depende|misto|mixed|half/.test(r)) return 50;
  if (/^(verdadeir|verdade|correto|true|confirmad|fato\b|procede)/.test(r) && !/nao|falso/.test(r)) return 100;
  if (/fals|fake|mentir|engan|distorc|fora de contexto|sem contexto|incorret|errad|boato|montagem|adulterad|manipulad|insustent|sem comprova|nao procede|nao e verdade|golpe|satira|false|pants/.test(r)) return 0;
  return null;
}
// Checagens só entram no número quando tratam praticamente da MESMA afirmação.
// Abaixo disso a checagem fala de outra alegação do mesmo tema (ex.: um boato sobre a Pfizer
// não diz nada sobre uma notícia verdadeira de vacina) e aparece apenas como referência.
export const SEMELHANCA_MINIMA = 0.5;
const negations = s => (plain(s).match(/\b(nao|nunca|nenhum|nenhuma|jamais|nem)\b/g) || []).length % 2;
export function factCheckComponent(reviews = [], comparacoes = [], claims = []) {
  const usable = [];
  for (const review of reviews) {
    let nota = ratingScore(review.avaliacao);
    if (nota === null) continue;
    const pairs = comparacoes.filter(c => c.evidenciaId === review.id)
      .map(c => ({ sim: Math.max(c.similaridadeLexical ?? 0, c.similaridadeSemantica ?? 0), claim: claims.find(a => a.id === c.afirmacaoId) }));
    const best = pairs.sort((a, b) => b.sim - a.sim)[0];
    const semelhanca = best?.sim ?? 0;
    if (semelhanca < SEMELHANCA_MINIMA) continue;
    // Se uma frase nega e a outra afirma ("vacina NÃO causa" x "vacina causa"), a avaliação vale ao contrário.
    const invertida = !!best.claim && negations(best.claim.texto) !== negations(review.texto_verificado);
    if (invertida) nota = 100 - nota;
    usable.push({ invertida, id: review.id, verificador: review.verificador, avaliacao: review.avaliacao, nota, semelhanca: +semelhanca.toFixed(3), url: review.url_verificacao, afirmacao: review.texto_verificado });
  }
  if (!usable.length) return null;
  const totalPeso = usable.reduce((s, u) => s + u.semelhanca, 0);
  const porcentagem = Math.round(usable.reduce((s, u) => s + u.nota * u.semelhanca, 0) / totalPeso);
  const melhor = Math.max(...usable.map(u => u.semelhanca));
  return { porcentagem, semelhancaMaxima: +melhor.toFixed(3), checagens: usable.sort((a, b) => b.semelhanca - a.semelhanca).slice(0, 5) };
}
// Conhecimento geral do Gemini: só entra quando NÃO há checagem publicada da mesma afirmação,
// e só quando o próprio Gemini diz conhecer o assunto (ele devolve null para fatos que não conhece).
export const PESO_GEMINI_SEM_CHECAGEM = 0.6;
export function calcularIndice({ tensorflow = null, factCheck = null, gemini = null } = {}) {
  const tf = Number.isInteger(tensorflow?.porcentagem) ? tensorflow.porcentagem : null;
  const fc = factCheck && Number.isInteger(factCheck.porcentagem) ? factCheck : null;
  const gm = !fc && Number.isInteger(gemini) && gemini >= 0 && gemini <= 100 ? gemini : null;
  if (tf === null && !fc && gm === null) return { status: 'indisponivel', porcentagem: null, classificacao: null, componentes: { tensorflow: null, factCheck: null, gemini: null } };
  const pesoFc = fc ? (tf === null ? 1 : +(0.8 * fc.semelhancaMaxima).toFixed(3)) : 0;
  const pesoGm = gm !== null ? (tf === null ? 1 : PESO_GEMINI_SEM_CHECAGEM) : 0;
  const pesoTf = tf === null ? 0 : +(1 - pesoFc - pesoGm).toFixed(3);
  const porcentagem = Math.round((fc ? fc.porcentagem * pesoFc : 0) + (gm !== null ? gm * pesoGm : 0) + (tf !== null ? tf * pesoTf : 0));
  return {
    status: 'disponivel', porcentagem, classificacao: estimateClassification(porcentagem),
    metodo: 'TensorFlow (padrões de linguagem) + Google Fact Check (checagens publicadas)' + (gm !== null ? ' + conhecimento geral do Gemini (sem checagem disponível)' : ''),
    componentes: {
      tensorflow: tf === null ? null : { porcentagem: tf, peso: pesoTf, sinais: tensorflow.sinais || [], modelo: tensorflow.modelo?.nome || null, acuraciaTeste: tensorflow.modelo?.metricas?.teste?.acuracia ?? null },
      factCheck: fc ? { porcentagem: fc.porcentagem, peso: pesoFc, semelhancaMaxima: fc.semelhancaMaxima, checagens: fc.checagens } : null,
      gemini: gm !== null ? { porcentagem: gm, peso: pesoGm } : null
    }
  };
}
