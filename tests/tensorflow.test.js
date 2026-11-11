import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { analyzeLanguage, loadTensorflow, lexicalSimilarities } from '../services/tensorflow.js';

const claim = { id:'a1', texto:'A investigação apura possível corrupção.' };
const review = { id:'e1', texto_verificado:claim.texto };
const card = {
  name:'fixture de contrato, sem treinamento',task:'sentence-embedding',tokenizer:'word-index-v1',
  languages:['pt-BR'],maxLength:8,padToken:0,unknownToken:1,lowercase:true,
  validation:{dataset:'fixture sintética de integração; não avalia precisão',metrics:{contract:1}}
};

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(),'verificafato-tf-'));
  t.after(() => rm(directory,{recursive:true,force:true}));
  return directory;
}
async function writeFixture(tf,directory,{metadata={},inputLength=8,nonFinite=false,vocabulary}={}) {
  const model = tf.sequential();
  model.add(tf.layers.embedding({inputDim:16,outputDim:2,inputLength,embeddingsInitializer:'ones'}));
  model.add(tf.layers.globalAveragePooling1d({}));
  if (nonFinite) {
    const weights = tf.fill([16,2],Number.NaN);
    model.layers[0].setWeights([weights]);
    weights.dispose();
  }
  try {
    await model.save({save:async artifacts => {
      await writeFile(path.join(directory,'model.json'),JSON.stringify({
        modelTopology:artifacts.modelTopology,
        weightsManifest:[{paths:['weights.bin'],weights:artifacts.weightSpecs}]
      }));
      await writeFile(path.join(directory,'weights.bin'),Buffer.from(artifacts.weightData));
      return {modelArtifactsInfo:{dateSaved:new Date(),modelTopologyType:'JSON'}};
    }});
  } finally { model.dispose(); }
  await writeFile(path.join(directory,'model-card.json'),JSON.stringify({...card,...metadata}));
  await writeFile(path.join(directory,'vocab.json'),JSON.stringify(vocabulary || {'a':2,'investigação':3,'apura':4,'possível':5,'corrupção':6,'.':7}));
}

test('NFC and decomposed accents represent the same lexical text without tensor leaks',async () => {
  const tf = await loadTensorflow(), before = tf.memory().numTensors;
  const matrix = lexicalSimilarities(tf,['Corrupção apurada','Corrupção apurada']);
  assert.ok(matrix[0][1] > 0.9999);
  assert.equal(tf.memory().numTensors,before);
});

test('bounded vocabulary keeps later documents represented and cosine within its range',async () => {
  const tf = await loadTensorflow();
  const long = Array.from({length:2200},(_,index) => 'termo'+index).join(' ');
  const matrix = lexicalSimilarities(tf,[long,'corrupção apurada','corrupção apurada']);
  assert.ok(matrix[1][2] > 0.9999);
  assert.ok(matrix.flat().every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  assert.deepEqual(lexicalSimilarities(tf,[]),[]);
  assert.deepEqual(lexicalSimilarities(tf,['','']),[[0,0],[0,0]]);
});

test('full article cannot exhaust vocabulary before the actual claim and review pair',async () => {
  const article = Array.from({length:2200},(_,index) => 'termo'+index).join(' ')+claim.texto;
  const result = await analyzeLanguage(article,[claim],[review],{modelDir:''});
  assert.ok(result.comparacoes[0].similaridadeLexical > 0.9999);
  assert.equal(result.tensorflow.comparacoesExecutadas,1);
  assert.equal(result.comparacoes[0].similaridadeSemantica,null);
});

test('negated statements may have high lexical overlap and remain unproven by similarity',async () => {
  const result = await analyzeLanguage(claim.texto,[claim],[{...review,texto_verificado:'A investigação não apura possível corrupção.'}],{modelDir:''});
  assert.ok(result.comparacoes[0].similaridadeLexical > 0.5);
  assert.equal(result.comparacoes[0].similaridadeSemantica,null);
  assert.ok(result.tensorflow.limitacoes.some(value => value.includes('não comprova equivalência de sentido nem veracidade')));
  assert.equal('veredito' in result,false);
});

test('no review means no invented comparison or unnecessary semantic model load',async () => {
  const tf = await loadTensorflow(), before = tf.memory().numTensors;
  const result = await analyzeLanguage(claim.texto,[claim],[],{modelDir:'missing-model-directory'});
  assert.equal(result.tensorflow.disponivel,true);
  assert.equal(result.tensorflow.comparacoesExecutadas,0);
  assert.equal(result.tensorflow.modeloSemantico,'nao_executado');
  assert.deepEqual(result.comparacoes,[]);
  assert.equal(tf.memory().numTensors,before);
  assert.ok(result.tensorflow.limitacoes.some(value => value.includes('Nenhuma similaridade foi calculada')));
});

test('real serialized Layers model produces semantic pairs and releases inference tensors',async t => {
  const tf = await loadTensorflow(), directory = await temporaryDirectory(t);
  await writeFixture(tf,directory);
  const first = await analyzeLanguage(claim.texto,[claim],[review],{modelDir:directory});
  assert.equal(first.tensorflow.modeloSemantico,'pronto');
  assert.equal(first.tensorflow.modelo,card.name);
  assert.ok(first.comparacoes[0].similaridadeSemantica > 0.9999);
  const before = tf.memory().numTensors;
  for (let index = 0; index < 5; index++) await analyzeLanguage(claim.texto,[claim],[review],{modelDir:directory});
  assert.equal(tf.memory().numTensors,before);
});

test('semantic cache is separated by configured model directory',async t => {
  const tf = await loadTensorflow(), firstDir = await temporaryDirectory(t), secondDir = await temporaryDirectory(t);
  await writeFixture(tf,firstDir,{metadata:{name:'fixture A'}});
  await writeFixture(tf,secondDir,{metadata:{name:'fixture B'}});
  const first = await analyzeLanguage(claim.texto,[claim],[review],{modelDir:firstDir});
  const second = await analyzeLanguage(claim.texto,[claim],[review],{modelDir:secondDir});
  assert.equal(first.tensorflow.modelo,'fixture A');
  assert.equal(second.tensorflow.modelo,'fixture B');
});

test('failed semantic load can recover after the same model directory is repaired',async t => {
  const tf = await loadTensorflow(), directory = await temporaryDirectory(t);
  const failed = await analyzeLanguage(claim.texto,[claim],[review],{modelDir:directory});
  assert.equal(failed.tensorflow.modeloSemantico,'indisponivel');
  assert.ok(failed.comparacoes[0].similaridadeLexical > 0.9999);
  await writeFixture(tf,directory);
  const repaired = await analyzeLanguage(claim.texto,[claim],[review],{modelDir:directory});
  assert.equal(repaired.tensorflow.modeloSemantico,'pronto');
});

test('word-index lookup never treats inherited Object properties as vocabulary IDs',async t => {
  const tf = await loadTensorflow(), directory = await temporaryDirectory(t);
  await writeFixture(tf,directory);
  const result = await analyzeLanguage('constructor investigado',[{...claim,texto:'constructor investigado'}],[review],{modelDir:directory});
  assert.equal(result.tensorflow.modeloSemantico,'pronto');
  assert.ok(Number.isFinite(result.comparacoes[0].similaridadeSemantica));
});

test('invalid model card tokens and fabricated nonnumeric metrics are rejected',async t => {
  const tf = await loadTensorflow();
  for (const metadata of [{padToken:-1},{unknownToken:1.5},{validation:{dataset:'fixture',metrics:{accuracy:'ótima'}}},{normalization:'unsupported'}]) {
    const directory = await temporaryDirectory(t);
    await writeFixture(tf,directory,{metadata});
    const result = await analyzeLanguage(claim.texto,[claim],[review],{modelDir:directory});
    assert.equal(result.tensorflow.disponivel,true);
    assert.equal(result.tensorflow.modeloSemantico,'indisponivel');
    assert.equal(result.comparacoes[0].similaridadeSemantica,null);
    assert.ok(result.comparacoes[0].similaridadeLexical > 0.9999);
  }
});

test('incompatible input dimensions and nonfinite embeddings preserve the lexical analysis',async t => {
  const tf = await loadTensorflow();
  for (const config of [{inputLength:9},{nonFinite:true}]) {
    const directory = await temporaryDirectory(t);
    await writeFixture(tf,directory,config);
    const result = await analyzeLanguage(claim.texto,[claim],[review],{modelDir:directory});
    assert.equal(result.tensorflow.disponivel,true);
    assert.equal(result.tensorflow.modeloSemantico,'indisponivel');
    assert.equal(result.tensorflow.modelo,null);
    assert.equal(result.comparacoes[0].similaridadeSemantica,null);
    assert.ok(result.comparacoes[0].similaridadeLexical > 0.9999);
    assert.doesNotMatch(JSON.stringify(result),/NaN|Infinity/);
  }
});

test('TensorFlow initialization failure retains audited language rules and reports no comparisons',async () => {
  const result = await analyzeLanguage('URGENTE!!! '+claim.texto,[claim],[review],{loader:async () => { throw Error('private model failure'); }});
  assert.equal(result.tensorflow.disponivel,false);
  assert.equal(result.tensorflow.comparacoesExecutadas,0);
  assert.deepEqual(result.comparacoes,[]);
  assert.ok(result.indicadores.length > 0);
  assert.doesNotMatch(JSON.stringify(result),/private model failure/);
});
