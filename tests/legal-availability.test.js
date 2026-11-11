import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { legalCatalogReadiness, legalCandidates } from '../services/legal-context.js';

const workspace = path.resolve(import.meta.dirname,'..');
const artifactRoot = path.join(workspace,'.artifacts');
const serviceSource = await readFile(path.join(workspace,'services/legal-context.js'),'utf8');
const catalogSource = await readFile(path.join(workspace,'data/legal-catalog.json'),'utf8');
const catalog = JSON.parse(catalogSource);
const news = 'Um agente público está sendo investigado por possível corrupção passiva, após suspeita de receber propina.';
const now = new Date('2026-11-11T18:00:00Z');

async function isolatedModule(t,asset) {
  await mkdir(artifactRoot,{recursive:true});
  const directory = await mkdtemp(path.join(artifactRoot,'legal-availability-'));
  t.after(async () => {
    // Only remove the exact generated directory directly inside the artifact root.
    const absolute = path.resolve(directory);
    assert.equal(path.dirname(absolute),path.resolve(artifactRoot));
    assert.match(path.basename(absolute),/^legal-availability-/);
    await rm(absolute,{recursive:true,force:true});
  });
  const serviceDirectory = path.join(directory,'services');
  await mkdir(serviceDirectory);
  const filename = path.join(serviceDirectory,'legal-context.js');
  await writeFile(filename,serviceSource);
  if (asset !== undefined) {
    const dataDirectory = path.join(directory,'data');
    await mkdir(dataDirectory);
    await writeFile(path.join(dataDirectory,'legal-catalog.json'),asset);
  }
  // zod resolves from the existing workspace node_modules; no install or network.
  return import(pathToFileURL(filename).href);
}

function assertUnavailable(module) {
  assert.deepEqual(module.legalCatalogReadiness({now}),{
    status:'indisponivel',referencias:0,verificadoEm:null,revisarAte:null
  });
  assert.deepEqual(module.legalCandidates(news,{now}),[]);
  assert.equal(module.legalResponseSchema([]).properties.referencias.maxItems,0);
  assert.deepEqual(module.validateLegalContext({aplicavel:true,referencias:[{
    id:'cp-317',categoria:'acontecimento_noticiado',trecho_noticia:news,
    situacao_juridica:'Investigação',trecho_situacao:'está sendo investigado por possível corrupção passiva'
  }]},{text:news,candidates:[{id:'cp-317'}],now}),{aplicavel:false,referencias:[]});
}

test('missing optional legal catalog does not reject the module import or fabricate candidates',async t => {
  const module = await isolatedModule(t,undefined);
  assertUnavailable(module);
});

test('malformed JSON and structurally corrupt legal assets fail closed without crashing import',async t => {
  for (const asset of ['{invalid','null','[]','{}',JSON.stringify({...catalog,referencias:[]})]) {
    const module = await isolatedModule(t,asset);
    assertUnavailable(module);
  }
});

test('invalid regex or untrusted official URL disables only the optional legal catalog',async t => {
  const badRegex = structuredClone(catalog);
  badRegex.referencias[0].sinais = ['['];
  const badUrl = structuredClone(catalog);
  badUrl.fontes.cp = 'https://unverified.example.org/invented-law';
  for (const asset of [badRegex,badUrl]) {
    const module = await isolatedModule(t,JSON.stringify(asset));
    assertUnavailable(module);
  }
});

test('exact reviewed asset copied with the service keeps valid legal references available',async t => {
  const module = await isolatedModule(t,catalogSource);
  const readiness = module.legalCatalogReadiness({now});
  assert.equal(readiness.status,'pronto');
  assert.equal(readiness.referencias,catalog.referencias.length);
  assert.equal(readiness.verificadoEm,'2026-11-11');
  assert.equal(readiness.revisarAte,'2026-12-11');
  assert.ok(module.legalCandidates(news,{now}).some(item => item.id === 'cp-317'));
});

test('review readiness has fixed inclusive verification and exclusive expiry boundaries',() => {
  for (const timestamp of ['2026-11-11T00:00:00Z','2026-11-11T18:00:00Z','2026-12-10T23:59:59.999Z']) {
    assert.equal(legalCatalogReadiness({now:new Date(timestamp)}).status,'pronto',timestamp);
    assert.ok(legalCandidates(news,{now:new Date(timestamp)}).length > 0,timestamp);
  }
  for (const timestamp of ['2026-11-10T23:59:59.999Z','2026-12-11T00:00:00Z','2030-01-01T00:00:00Z','invalid']) {
    const readiness = legalCatalogReadiness({now:new Date(timestamp)});
    assert.equal(readiness.status,'revisao_pendente',timestamp);
    assert.equal(readiness.referencias,catalog.referencias.length);
    assert.deepEqual(legalCandidates(news,{now:new Date(timestamp)}),[],timestamp);
  }
});

test('an overlong review window cannot keep the reviewed legal catalog enabled',async t => {
  const asset = {...catalog,revisar_ate:'2027-01-11'};
  const module = await isolatedModule(t,JSON.stringify(asset));
  assert.equal(module.legalCatalogReadiness({now}).status,'revisao_pendente');
  assert.deepEqual(module.legalCandidates(news,{now}),[]);
});
