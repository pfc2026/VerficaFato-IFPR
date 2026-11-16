// Treina o modelo TensorFlow.js de padrões de linguagem (desinformação x jornalismo).
// Entrada: data/treino-tf.json (scripts/coletar-treino-tf.mjs + scripts/coletar-jornalismo-rss.mjs)
// Saída:   data/modelo-padroes.json (topologia + pesos + métricas medidas em frases separadas do treino)
import { readFile, writeFile } from 'node:fs/promises';
import * as tf from '@tensorflow/tfjs';
import { extractFeatures, FEATURE_NAMES, FEATURE_SIZE, STYLE_NAMES } from '../services/padroes-features.js';

await tf.setBackend('cpu');
const { exemplos } = JSON.parse(await readFile(new URL('../data/treino-tf.json', import.meta.url), 'utf8'));
// Embaralhamento determinístico (semente fixa) para o resultado ser reproduzível.
let seed = 42; const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// O feed do g1 domina o volume; limitamos para não aprender só o estilo de um veículo.
const g1 = shuffle(exemplos.filter(e => e.origem === 'rss:g1.globo.com')).slice(0, 6000);
const usados = [...exemplos.filter(e => e.origem !== 'rss:g1.globo.com'), ...g1];
const byClass = [0, 1].map(l => shuffle(usados.filter(e => e.rotulo === l)));
const split = cls => [cls.slice(0, Math.floor(cls.length * 0.8)), cls.slice(Math.floor(cls.length * 0.8))];
const [[tr0, te0], [tr1, te1]] = byClass.map(split);
const train = shuffle([...tr0, ...tr1]), test = [...te0, ...te1];
const w0 = train.length / (2 * tr0.length), w1 = train.length / (2 * tr1.length);
const featCache = new Map();
const feats = e => { if (!featCache.has(e.texto)) featCache.set(e.texto, extractFeatures(e.texto)); return featCache.get(e.texto); };

const model = tf.sequential();
model.add(tf.layers.dense({ inputShape: [FEATURE_SIZE], units: 16, activation: 'relu', kernelRegularizer: tf.regularizers.l2({ l2: 1e-4 }), kernelInitializer: tf.initializers.glorotUniform({ seed: 7 }) }));
model.add(tf.layers.dropout({ rate: 0.2, seed: 3 }));
// Saída em logit; a análise aplica sigmoid para obter a probabilidade 0–1.
model.add(tf.layers.dense({ units: 1, activation: 'linear', kernelInitializer: tf.initializers.glorotUniform({ seed: 8 }) }));
const optimizer = tf.train.adam(0.003);
const BATCH = 256, EPOCHS = 6;
for (let epoch = 0; epoch < EPOCHS; epoch++) {
  const order = shuffle(train);
  for (let i = 0; i < order.length; i += BATCH) {
    const batch = order.slice(i, i + BATCH);
    tf.tidy(() => {
      const xs = tf.tensor2d(batch.map(feats)), ys = tf.tensor2d(batch.map(e => [e.rotulo]));
      const sw = tf.tensor2d(batch.map(e => [e.rotulo ? w1 : w0]));
      optimizer.minimize(() => {
        const loss = tf.losses.sigmoidCrossEntropy(ys, model.apply(xs, { training: true }), sw);
        return model.losses.length ? loss.add(tf.addN(model.losses)) : loss;
      });
    });
  }
  process.stdout.write('época ' + (epoch + 1) + '/' + EPOCHS + '\n');
}
function evaluate(rows) {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < rows.length; i += 1024) {
    const part = rows.slice(i, i + 1024);
    const p = tf.tidy(() => tf.sigmoid(model.predict(tf.tensor2d(part.map(feats)))).dataSync());
    part.forEach((e, k) => { const y = p[k] >= 0.5 ? 1 : 0; if (y && e.rotulo) tp++; else if (!y && !e.rotulo) tn++; else if (y) fp++; else fn++; });
  }
  return { exemplos: rows.length, acuracia: +((tp + tn) / rows.length).toFixed(3),
    acertoJornalismo: +(tp / Math.max(1, tp + fn)).toFixed(3), acertoDesinformacao: +(tn / Math.max(1, tn + fp)).toFixed(3) };
}
const metrics = { treino: evaluate(train), teste: evaluate(test) };
console.log('Exemplos usados: desinformação', byClass[0].length, '| jornalismo/verdadeiro', byClass[1].length);
console.log('Treino', metrics.treino); console.log('Teste (frases nunca vistas no treino)', metrics.teste);
let artifacts;
await model.save(tf.io.withSaveHandler(async a => { artifacts = a; return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } }; }));
await writeFile(new URL('../data/modelo-padroes.json', import.meta.url), JSON.stringify({
  nome: 'VerificaFato padrões de linguagem v1', tarefa: 'probabilidade de o texto se parecer com jornalismo/alegações verdadeiras (1) e não com alegações classificadas como falsas por agências de checagem (0)',
  atributos: FEATURE_NAMES, estilo: STYLE_NAMES, treinadoEm: new Date().toISOString(), metricas: metrics,
  dados: { desinformacao: byClass[0].length, jornalismo: byClass[1].length },
  modelTopology: artifacts.modelTopology, weightSpecs: artifacts.weightSpecs, weightData: Buffer.from(artifacts.weightData).toString('base64')
}));
console.log('modelo salvo em data/modelo-padroes.json');
