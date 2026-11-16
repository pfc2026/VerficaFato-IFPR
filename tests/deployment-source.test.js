import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectDeploymentSource } from '../scripts/deployment-source.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const article = 'A escola publicou o calendário das atividades do próximo semestre. O documento apresenta as datas de matrícula e o cronograma de aulas para os estudantes.';

test('deployment source includes the URL extractor and its transitive modules without local secrets', async () => {
  const source = await collectDeploymentSource();
  const files = new Set(source.entries.map(entry => entry.file));
  for (const file of ['api/index.js', 'services/extraction.js', 'scraper/extractors.js', 'scraper/normalizers.js', 'scraper/validators.js', 'scraper/models.js', 'data/legal-catalog.json', 'public/html/img/Logo oficial.png']) assert.ok(files.has(file), file);
  assert.ok(source.entries.every(entry => !/^(?:\.env|\.git\/|\.artifacts\/|backups\/|tests\/|node_modules\/)/.test(entry.file)));
  assert.ok(source.entries.every(entry => /^[a-f\d]{40}$/.test(entry.sha) && entry.size > 0));
  assert.match(source.sourceHash, /^[a-f\d]{64}$/);
  const config = JSON.parse(await readFile(path.join(projectRoot, 'vercel.json'), 'utf8'));
  const functionBuild = config.builds.find(build => build.src === 'api/index.js');
  assert.ok(functionBuild.config.includeFiles.includes('scraper/**'), 'The Vercel function must include the dynamically loaded scraper modules.');
});

test('the exact deployment source can analyze an accessible URL without the original checkout files', async t => {
  const artifacts = path.join(projectRoot, '.artifacts');
  await mkdir(artifacts, { recursive: true });
  const staged = await mkdtemp(path.join(artifacts, 'deployment-source-test-'));
  t.after(async () => {
    assert.ok(path.resolve(staged).startsWith(path.resolve(artifacts) + path.sep));
    await rm(staged, { recursive: true, force: true });
  });
  const source = await collectDeploymentSource();
  for (const entry of source.entries) {
    const destination = path.join(staged, entry.file);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(projectRoot, entry.file), destination);
  }
  // Staged relative imports resolve only inside this copy. npm packages resolve
  // from the ancestor node_modules, and no .env or external service is needed.
  const { obterConteudoDaUrl } = await import(pathToFileURL(path.join(staged, 'services/extraction.js')).href);
  const { analisarConteudo } = await import(pathToFileURL(path.join(staged, 'services/analysis.js')).href);
  const { generateExplanation } = await import(pathToFileURL(path.join(staged, 'services/explanation.js')).href);
  const requests = [];
  const get = async (url, options = {}) => {
    requests.push(url);
    if (new URL(url).pathname === '/robots.txt') return { url, status: 200, headers: { 'content-type': 'text/plain' }, text: 'User-agent: *\nAllow: /' };
    await options.beforeRequest?.(new URL(url));
    return { url, status: 200, headers: { 'content-type': 'text/html' }, text: '<article><h1>Calendário escolar</h1><p>' + article + '</p></article>' };
  };
  const result = await analisarConteudo({ link: 'https://deployment-fixture.example.org/noticia' }, {
    extract: (url, options) => obterConteudoDaUrl(url, { ...options, get }),
    check: async () => ({ apiDisponivel: true, status: 'ok', resultados: [] }),
    explain: result => generateExplanation(result, { enabled: false })
  });
  assert.equal(result.noticia.conteudoObtido, true);
  assert.equal(result.noticia.texto, article);
  assert.equal(result.tipoEntrada, 'url');
  assert.equal(result.veredito, 'Sem evidências suficientes');
  assert.equal(result.parecerIntegrado.versao, 1);
  assert.ok(requests.some(url => url.endsWith('/robots.txt')));
});
