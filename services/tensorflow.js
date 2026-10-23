import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { languageIndicators } from './claims.js';
let runtimePromise, semanticPromise;
export function loadTensorflow() {
  return runtimePromise ||= import('@tensorflow/tfjs').then(async tf => { await tf.setBackend('cpu'); await tf.ready(); return tf; });
}
function terms(text) { return (text.toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]+/gu) || []).slice(0,3000); }
export function lexicalSimilarities(tf, texts) {
  const tokenLists = texts.map(terms);
  const vocabulary = [...new Set(tokenLists.flat())].slice(0,2048);
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
    return normalized.matMul(normalized.transpose()).arraySync();
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
      !card.validation?.dataset || !Object.keys(card.validation?.metrics || {}).length ||
      !Number.isInteger(card.maxLength) || card.maxLength < 8 || card.maxLength > 512) throw new Error('MODEL_CARD_INVALID');
  const vocabulary = JSON.parse(await readBounded(path.join(root,'vocab.json')));
  if (!vocabulary || Array.isArray(vocabulary) || Object.keys(vocabulary).length > 200000 ||
      !Object.values(vocabulary).every(n => Number.isInteger(n) && n >= 0)) throw new Error('VOCAB_INVALID');
  const manifest = JSON.parse(await readBounded(path.join(root,'model.json')));
  const weightSpecs = [], buffers = [];
  let bytes = 0;
  for (const group of manifest.weightsManifest || []) {
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
  if (model.inputs.length !== 1 || model.outputs.length !== 1 || model.outputs[0].shape.length !== 2) { model.dispose(); throw new Error('MODEL_SHAPE_INVALID'); }
  return { model, card, vocabulary };
}
function semanticSimilarities(tf, runtime, texts) {
  const { model, card, vocabulary } = runtime;
  return tf.tidy(() => {
    const rows = texts.map(text => {
      const words = card.lowercase === false ? (text.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)||[]) : (text.toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)||[]);
      const ids = words.slice(0,card.maxLength).map(word => vocabulary[word] ?? card.unknownToken ?? 1);
      while(ids.length < card.maxLength) ids.push(card.padToken ?? 0);
      return ids;
    });
    const embeddings = model.predict(tf.tensor2d(rows,undefined,'int32'));
    const normalized = embeddings.div(embeddings.square().sum(1,true).sqrt().maximum(1e-12));
    return normalized.matMul(normalized.transpose()).arraySync();
  });
}
export async function analyzeLanguage(text, claims, reviews, { loader = loadTensorflow, modelDir = process.env.TFJS_MODEL_DIR } = {}) {
  const indicadores = languageIndicators(text);
  const base = { indicadores, tensorflow:{disponivel:false,metodo:'indisponível',modelo:null,limitacoes:[]}, comparacoes:[] };
  try {
    const tf = await loader();
    const documents = [text,...claims.map(c => c.texto),...reviews.map(r => r.texto_verificado)];
    const lexical = lexicalSimilarities(tf,documents);
    base.tensorflow = {disponivel:true,metodo:'TF-IDF e cosseno lexical',modelo:null,limitacoes:[
      'Similaridade lexical mede palavras em comum; não comprova equivalência de sentido nem veracidade.',
      'Sensacionalismo é identificado por regras transparentes, sem um classificador treinado.'
    ]};
    let semantic;
    if (modelDir) {
      try {
        const runtime = await (semanticPromise ||= loadSemanticModel(tf,modelDir));
        semantic = semanticSimilarities(tf,runtime,documents);
        base.tensorflow.modelo = runtime.card.name || 'modelo local de embeddings';
        base.tensorflow.metodo += ' e embeddings locais';
        base.tensorflow.limitacoes.push('Embeddings auxiliam a recuperação; não detectam contradições nem substituem evidências.');
      } catch {
        base.tensorflow.limitacoes.push('O modelo semântico configurado não pôde ser carregado ou não atende ao contrato de português e avaliação.');
      }
    } else base.tensorflow.limitacoes.push('Modelo semântico treinado e avaliado para português não fornecido. Não foi executada inferência semântica.');
    base.comparacoes = claims.flatMap((claim,i) => reviews.map((review,j) => ({
      afirmacaoId:claim.id,evidenciaId:review.id,
      similaridadeLexical:lexical[i+1][1+claims.length+j],
      similaridadeSemantica:semantic ? semantic[i+1][1+claims.length+j] : null
    })));
    return base;
  } catch {
    base.tensorflow.limitacoes.push('TensorFlow.js indisponível. A classificação usa somente evidências, sem inferência substituta inventada.');
    return base;
  }
}
