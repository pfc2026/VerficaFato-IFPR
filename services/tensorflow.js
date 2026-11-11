import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { languageIndicators } from './claims.js';
let runtimePromise;
const semanticModels = new WeakMap();
export function loadTensorflow() {
  return runtimePromise ||= import('@tensorflow/tfjs').then(async tf => { await tf.setBackend('cpu'); await tf.ready(); return tf; }).catch(error => {
    runtimePromise = undefined;
    throw error;
  });
}
function terms(text) { return (text.normalize('NFC').toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]+/gu) || []).slice(0,3000); }
export function lexicalSimilarities(tf, texts) {
  const tokenLists = texts.map(terms);
  const uniqueLists = tokenLists.map(tokens => [...new Set(tokens)]), vocabularySet = new Set();
  // Give each document representation before spending the bounded vocabulary on
  // later terms from long documents. Order must not erase entire later reviews.
  for (let offset = 0; vocabularySet.size < 2048 && uniqueLists.some(tokens => offset < tokens.length); offset++) {
    for (const tokens of uniqueLists) {
      if (tokens[offset] !== undefined) vocabularySet.add(tokens[offset]);
      if (vocabularySet.size === 2048) break;
    }
  }
  const vocabulary = [...vocabularySet];
  if (!vocabulary.length) return texts.map(() => texts.map(() => 0));
  const index = new Map(vocabulary.map((word,i) => [word,i]));
  const df = new Array(vocabulary.length).fill(0);
  tokenLists.forEach(tokens => new Set(tokens).forEach(word => { if(index.has(word)) df[index.get(word)]++; }));
  const rows = tokenLists.map(tokens => {
    const row = new Array(vocabulary.length).fill(0);
    for (const token of tokens) if (index.has(token)) row[index.get(token)]++;
    return row.map((frequency,i) => (frequency ? 1 + Math.log(frequency) : 0) * (Math.log((1 + texts.length)/(1 + df[i])) + 1));
  });
  return tf.tidy(() => {
    const matrix = tf.tensor2d(rows);
    const norms = matrix.square().sum(1,true).sqrt().maximum(1e-12);
    const normalized = matrix.div(norms);
    return normalized.matMul(normalized.transpose()).arraySync().map(row => row.map(value => Math.max(0,Math.min(1,value))));
  });
}
function localFile(root, filename) {
  if (typeof filename !== 'string' || !filename || path.isAbsolute(filename)) throw new Error('INVALID_MODEL_PATH');
  const absolute = path.resolve(root, filename);
  if (!absolute.startsWith(path.resolve(root) + path.sep)) throw new Error('INVALID_MODEL_PATH');
  return absolute;
}
async function readBounded(filename, max = 5 * 1024 * 1024) {
  if ((await stat(filename)).size > max) throw new Error('MODEL_TOO_LARGE');
  return readFile(filename);
}
async function loadSemanticModel(tf, directory) {
  const root = path.resolve(directory);
  const card = JSON.parse(await readBounded(path.join(root,'model-card.json')));
  if (card.task !== 'sentence-embedding' || card.tokenizer !== 'word-index-v1' ||
      !Array.isArray(card.languages) || !card.languages.some(l => ['pt','pt-BR'].includes(l)) ||
      typeof card.validation?.dataset !== 'string' || !card.validation.dataset.trim() ||
      !card.validation?.metrics || Array.isArray(card.validation.metrics) || !Object.keys(card.validation.metrics).length ||
      !Object.values(card.validation.metrics).every(value => typeof value === 'number' && Number.isFinite(value)) ||
      !Number.isInteger(card.maxLength) || card.maxLength < 8 || card.maxLength > 512 ||
      [card.padToken,card.unknownToken].some(value => value !== undefined && (!Number.isInteger(value) || value < 0 || value > 2147483647)) ||
      (card.lowercase !== undefined && typeof card.lowercase !== 'boolean') ||
      ![undefined,'none','NFC'].includes(card.normalization)) throw new Error('MODEL_CARD_INVALID');
  const vocabulary = JSON.parse(await readBounded(path.join(root,'vocab.json')));
  if (!vocabulary || typeof vocabulary !== 'object' || Array.isArray(vocabulary) || !Object.keys(vocabulary).length || Object.keys(vocabulary).length > 200000 ||
      !Object.values(vocabulary).every(n => Number.isInteger(n) && n >= 0 && n <= 2147483647)) throw new Error('VOCAB_INVALID');
  const manifest = JSON.parse(await readBounded(path.join(root,'model.json')));
  if (!manifest?.modelTopology || !Array.isArray(manifest.weightsManifest)) throw new Error('MODEL_MANIFEST_INVALID');
  const weightSpecs = [], buffers = [];
  let bytes = 0;
  for (const group of manifest.weightsManifest || []) {
    if (!Array.isArray(group.weights) || !Array.isArray(group.paths)) throw new Error('MODEL_MANIFEST_INVALID');
    weightSpecs.push(...group.weights);
    for (const filename of group.paths) {
      const buffer = await readBounded(localFile(root,filename),100*1024*1024);
      bytes += buffer.byteLength;
      if (bytes > 100*1024*1024) throw new Error('MODEL_TOO_LARGE');
      buffers.push(buffer);
    }
  }
  const buffer = Buffer.concat(buffers);
  const model = await tf.loadLayersModel({ load: async () => ({ modelTopology:manifest.modelTopology, weightSpecs, weightData: buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength) }) });
  const input = model.inputs[0]?.shape, output = model.outputs[0]?.shape;
  if (model.inputs.length !== 1 || model.outputs.length !== 1 || input?.length !== 2 || input[0] !== null ||
      (input[1] !== null && input[1] !== card.maxLength) || output?.length !== 2 ||
      !Number.isInteger(output[1]) || output[1] < 1 || output[1] > 8192) { model.dispose(); throw new Error('MODEL_SHAPE_INVALID'); }
  return { model, card, vocabulary };
}
function cachedSemanticModel(tf,directory) {
  let models = semanticModels.get(tf);
  if (!models) { models = new Map(); semanticModels.set(tf,models); }
  const key = path.resolve(directory);
  if (!models.has(key)) {
    const pending = loadSemanticModel(tf,key).catch(error => { models.delete(key); throw error; });
    models.set(key,pending);
  }
  return models.get(key);
}
function semanticSimilarities(tf, runtime, texts) {
  const { model, card, vocabulary } = runtime;
  return tf.tidy(() => {
    const rows = texts.map(text => {
      // Preserve the tokenizer used during training; NFC must be declared by the model card.
      const input = card.normalization === 'NFC' ? text.normalize('NFC') : text;
      const words = card.lowercase === false ? (input.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)||[]) : (input.toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)||[]);
      const ids = words.slice(0,card.maxLength).map(word => Object.hasOwn(vocabulary,word) ? vocabulary[word] : card.unknownToken ?? 1);
      while(ids.length < card.maxLength) ids.push(card.padToken ?? 0);
      return ids;
    });
    const embeddings = model.predict(tf.tensor2d(rows,undefined,'int32'));
    if (Array.isArray(embeddings) || embeddings.rank !== 2 || embeddings.shape[0] !== texts.length ||
        !Array.from(embeddings.dataSync()).every(Number.isFinite)) throw new Error('MODEL_OUTPUT_INVALID');
    const norms = embeddings.square().sum(1,true).sqrt();
    if (Array.from(norms.dataSync()).some(value => !Number.isFinite(value) || value < 1e-12)) throw new Error('MODEL_OUTPUT_INVALID');
    const normalized = embeddings.div(norms);
    return normalized.matMul(normalized.transpose()).arraySync().map(row => row.map(value => Math.max(-1,Math.min(1,value))));
  });
}
export async function analyzeLanguage(text, claims, reviews, { loader = loadTensorflow, modelDir = process.env.TFJS_MODEL_DIR } = {}) {
  const indicadores = languageIndicators(text);
  const base = { indicadores, tensorflow:{disponivel:false,metodo:'indisponível',modelo:null,modeloSemantico:modelDir ? 'nao_executado' : 'desativado',comparacoesExecutadas:0,limitacoes:[]}, comparacoes:[] };
  try {
    const tf = await loader();
    // Only these pairs are consumed. The full article used to exhaust the vocabulary
    // before later claims/reviews were reached, making identical pairs score zero.
    const documents = [...claims.map(c => c.texto),...reviews.map(r => r.texto_verificado)];
    base.tensorflow = {...base.tensorflow,disponivel:true,metodo:'TF-IDF e cosseno lexical',limitacoes:[
      'Similaridade lexical mede palavras em comum; não comprova equivalência de sentido nem veracidade.',
      'Sensacionalismo é identificado por regras transparentes, sem um classificador treinado.'
    ]};
    if (!claims.length || !reviews.length) {
      base.tensorflow.limitacoes.push('Não há pares de afirmações e checagens para comparar. Nenhuma similaridade foi calculada.');
      if (!modelDir) base.tensorflow.limitacoes.push('Modelo semântico treinado e avaliado para português não fornecido. Não foi executada inferência semântica.');
      return base;
    }
    const lexical = lexicalSimilarities(tf,documents);
    let semantic;
    if (modelDir) {
      try {
        const runtime = await cachedSemanticModel(tf,modelDir);
        semantic = semanticSimilarities(tf,runtime,documents);
        base.tensorflow.modelo = runtime.card.name || 'modelo local de embeddings';
        base.tensorflow.modeloSemantico = 'pronto';
        base.tensorflow.metodo += ' e embeddings locais';
        base.tensorflow.limitacoes.push('Embeddings auxiliam a recuperação; não detectam contradições nem substituem evidências.');
      } catch {
        base.tensorflow.modeloSemantico = 'indisponivel';
        base.tensorflow.limitacoes.push('O modelo semântico configurado não pôde ser carregado ou não atende ao contrato de português e avaliação.');
      }
    } else base.tensorflow.limitacoes.push('Modelo semântico treinado e avaliado para português não fornecido. Não foi executada inferência semântica.');
    base.comparacoes = claims.flatMap((claim,i) => reviews.map((review,j) => ({
      afirmacaoId:claim.id,evidenciaId:review.id,
      similaridadeLexical:lexical[i][claims.length+j],
      similaridadeSemantica:semantic ? semantic[i][claims.length+j] : null
    })));
    base.tensorflow.comparacoesExecutadas = base.comparacoes.length;
    return base;
  } catch {
    base.tensorflow.limitacoes.push('TensorFlow.js indisponível. A classificação usa somente evidências, sem inferência substituta inventada.');
    return base;
  }
}
