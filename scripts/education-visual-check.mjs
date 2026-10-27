// Repeatable browser QA: mocked analysis, no database connection or external analysis calls.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createApp } from '../server.js';
import { criarAnaliseVisual } from '../services/verification-indicators.js';
import { lessons, quizQuestions } from '../public/js/education-content.js';

const artifacts = path.resolve(import.meta.dirname, '../.artifacts');
await mkdir(artifacts, { recursive: true });
const text = 'Recebi um aviso dizendo que as aulas de amanhã foram canceladas.';
const fixture = {
  schemaVersion: 2, veredito: 'Sem evidências suficientes', texto: text,
  justificativa: 'Não encontramos evidências suficientes para confirmar a mensagem.',
  resultados: [], fontes: [], analiseVisual: criarAnaliseVisual(text), secoes: {},
  feedbackGemini: { status: 'indisponivel', texto: 'Comentário complementar não disponível.' }, limitacoes: []
};
const inputs = [];
const app = createApp({
  analyze: async input => { inputs.push(input); return structuredClone(fixture); },
  dbReady: () => false, rateLimits: false
});
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = path.join(artifacts, `education-chrome-profile-${process.pid}`);
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
  '--remote-allow-origins=*', `--user-data-dir=${profile}`, '--disable-background-networking',
  '--disable-component-update', 'about:blank'
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let stderr = '';
chrome.stderr.on('data', chunk => { stderr += chunk.toString(); });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
let commandId = 0;
const pending = new Map();
const consoleErrors = [];
const checks = [];
let send;
let evaluate;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await pause(125); }
  }
  assert.ok(port, `Chrome debugging unavailable: ${stderr.slice(-700)}`);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find(item => item.type === 'page');
  assert.ok(target, 'Chrome page target exists');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') consoleErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id); pending.delete(message.id); clearTimeout(request.timeout);
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
    }
  });
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
  evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const ready = async (expression, label = expression) => {
    for (let i = 0; i < 300; i++) { if (await evaluate(expression)) return; await pause(100); }
    throw new Error(`Browser readiness timeout: ${label}`);
  };
  const viewport = async (width, height = 900) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await pause(450);
  };
  const screenshot = async (name, full = false) => {
    const metrics = await send('Page.getLayoutMetrics');
    const options = { format: 'png', captureBeyondViewport: full };
    if (full) options.clip = { x: 0, y: 0, width: metrics.cssContentSize.width, height: metrics.cssContentSize.height, scale: 1 };
    const png = await send('Page.captureScreenshot', options);
    await writeFile(path.join(artifacts, name), Buffer.from(png.data, 'base64'));
    console.log(`Screenshot: ${name}`);
  };
  const layout = async label => {
    const result = await evaluate(`(() => {
      const selectors = ['body','.header-shell','.site-nav','.hero-shell','.verification-panel','.checklist-shell','.education-grid','.quiz-card','.method-shell','dialog[open]','.restored-results'];
      return { viewport: innerWidth, body: document.body.scrollWidth, parts: selectors.flatMap(selector => [...document.querySelectorAll(selector)].filter(node=>node.getBoundingClientRect().width>0).map(node => ({selector,scroll:node.scrollWidth,client:node.clientWidth,right:Math.round(node.getBoundingClientRect().right)}))) };
    })()`);
    assert.ok(result.body <= result.viewport + 1, `${label}: page overflow ${JSON.stringify(result)}`);
    for (const part of result.parts) assert.ok(part.scroll <= part.client + 1 && part.right <= result.viewport + 1, `${label}: element overflow ${JSON.stringify(part)}`);
    checks.push(`${label}: no horizontal overflow at ${result.viewport}px`);
  };
  const escape = async () => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  };
  await send('Page.enable'); await send('Runtime.enable');
  await viewport(1440, 1000);
  await send('Page.navigate', { url: origin });
  await ready("document.readyState === 'complete' && document.querySelectorAll('#educationGrid .lesson-card').length === 10 && Boolean(window.bootstrap?.Modal) && Boolean(window.darkModeManager)", 'home, ten lessons, Bootstrap and theme manager');
  await evaluate('document.fonts.ready.then(()=>true)');
  await evaluate("window.darkModeManager._applyTheme('light');true");
  await pause(450);
  await layout('Desktop light');
  await screenshot('education-home-desktop.png', true);
  await evaluate("document.getElementById('theme-toggle-btn').click();true");
  await pause(450);
  assert.equal(await evaluate("document.documentElement.getAttribute('data-theme')"), 'dark');
  await layout('Desktop dark');
  await screenshot('education-home-desktop-dark.png', true);
  await viewport(320, 780);
  await layout('Small mobile dark');
  await evaluate("document.getElementById('theme-toggle-btn').click();true");
  await pause(450);
  await layout('Small mobile light');
  await viewport(390, 844);
  await layout('Mobile light');
  await screenshot('education-home-mobile.png', true);

  // Level filters are immediately usable and retain the selection.
  await evaluate("document.querySelector('[data-level=intermediario]').click();true");
  assert.equal(await evaluate("document.querySelector('[data-level=intermediario]').getAttribute('aria-pressed')"), 'true');
  assert.equal(await evaluate("document.querySelectorAll('#educationGrid .lesson-card').length"), lessons.filter(lesson => lesson.nivel === 'intermediario').length);
  await evaluate("document.querySelector('[data-level=all]').click();document.querySelector('#educationGrid [data-open-lesson=fontes]').click();true");
  await ready("document.getElementById('lessonModal').open", 'native lesson dialog');
  await layout('Mobile lesson');
  await screenshot('education-lesson-mobile.png');
  await viewport(320, 780);
  await layout('Small mobile lesson');
  await viewport(390, 844);
  assert.ok((await evaluate("document.getElementById('lessonBody').textContent")).length > 1000);
  await escape();
  assert.equal(await evaluate("document.getElementById('lessonModal').open"), false);
  assert.equal(await evaluate("document.activeElement.dataset.openLesson"), 'fontes');
  await evaluate("document.querySelector('#educationGrid [data-open-lesson=fontes]').click();document.getElementById('completeLessonBtn').click();true");
  assert.ok((await evaluate("JSON.parse(localStorage.getItem('vf-lessons-completed'))")).includes('fontes'));
  await escape();
  await evaluate("document.querySelector('#educationGrid [data-open-lesson=fontes]').click();true");
  assert.equal(await evaluate("document.getElementById('completeLessonBtn').disabled"), true);
  await escape();
  checks.push('Lessons: filter, native dialog, Escape, focus return, completion and revisit');

  // Require a selection, show explained feedback, move through all questions and restart.
  await evaluate("document.querySelector('#quizContent form').requestSubmit();true");
  assert.match(await evaluate("document.querySelector('.quiz-feedback').textContent"), /Escolha uma alternativa/);
  for (let index = 0; index < quizQuestions.length; index++) {
    const question = quizQuestions[index];
    const choice = index === 1 ? (question.correta + 1) % question.opcoes.length : question.correta;
    await evaluate(`document.querySelector('#quizContent input[value="${choice}"]').click();document.querySelector('#quizContent form').requestSubmit();true`);
    assert.ok((await evaluate("document.querySelector('.quiz-feedback').textContent")).includes(question.explicacao));
    assert.equal(await evaluate("document.querySelector('#quizContent fieldset').disabled"), true);
    if (index === 1) {
      await viewport(320, 780);
      await layout('Small mobile quiz feedback');
      await viewport(390, 844);
      await evaluate("document.querySelector('#quizContent .quiz-feedback').scrollIntoView({block:'center'});true");
      await pause(450);
      await screenshot('education-quiz-mobile.png');
    }
    await evaluate("document.querySelector('#quizContent .quiz-actions button').click();true");
  }
  assert.match(await evaluate("document.querySelector('.quiz-result').textContent"), /4 de 5/);
  await evaluate("document.querySelector('.quiz-result button').click();true");
  assert.match(await evaluate("document.querySelector('.quiz-progress').textContent"), /Questão 1 de 5/);
  assert.equal(await evaluate("document.querySelector('#quizContent input:checked')"), null);
  checks.push('Quiz: required choice, correct and incorrect feedback, five questions, score and restart');

  // One combined input accepts both text and URL, and submits only one nonempty value.
  await evaluate(`document.getElementById('newsText').value=${JSON.stringify(text)};document.getElementById('verificationForm').requestSubmit();true`);
  await ready("Boolean(document.querySelector('#resultsModal.show .factual-summary'))", 'analysis result');
  await pause(350);
  assert.match(await evaluate("document.querySelector('.factual-summary').textContent"), /Sem evidências suficientes/);
  assert.match(await evaluate("document.querySelector('.credibility-meter').textContent"), /padrões|linguagem/i);
  assert.doesNotMatch(await evaluate("document.querySelector('.credibility-meter').textContent"), /Provavelmente Verdadeira|Tende a ser verdadeira/);
  assert.ok(await evaluate("document.querySelector('.factual-summary').compareDocumentPosition(document.querySelector('.credibility-meter')) & Node.DOCUMENT_POSITION_FOLLOWING"));
  await layout('Mobile result');
  await screenshot('education-result-mobile.png');
  await viewport(320, 780);
  await layout('Small mobile result');
  await viewport(390, 844);
  await evaluate("document.querySelector('#modalContent .learning-recommendations [data-open-lesson]').click();true");
  await ready("document.getElementById('lessonModal').open && !document.querySelector('#resultsModal.show')", 'result to lesson after Bootstrap hide');
  await escape();
  await evaluate("document.getElementById('newsText').value='https://example.org/aviso';document.getElementById('verificationForm').requestSubmit();true");
  await ready("Boolean(document.querySelector('#resultsModal.show'))", 'URL analysis result');
  await pause(350);
  assert.equal(inputs.length, 2);
  assert.equal(inputs[0].texto, text); assert.ok(!inputs[0].link);
  assert.equal(inputs[1].link, 'https://example.org/aviso'); assert.ok(!inputs[1].texto);
  await evaluate("bootstrap.Modal.getOrCreateInstance(document.getElementById('resultsModal')).hide();true");
  await ready("!document.querySelector('#resultsModal.show') && !document.querySelector('.modal-backdrop')", 'results close');
  checks.push('Verification: combined text and URL input, factual conclusion before language index, lesson recommendation');

  // Shared URLs work on a fresh navigation; saved progress survives the reload.
  await send('Page.navigate', { url: `${origin}/#licao-fontes` });
  await ready(`document.getElementById('lessonModal')?.open && document.getElementById('lessonTitle').textContent === ${JSON.stringify(lessons.find(lesson => lesson.lessonId === 'fontes').titulo)}`, 'direct lesson URL');
  assert.equal(await evaluate("document.getElementById('completeLessonBtn').disabled"), true);
  await escape();
  await viewport(390, 844);
  await evaluate("window.darkModeManager._applyTheme('dark');window.scrollTo(0,0);true");
  await pause(450);
  await layout('Mobile dark');
  await screenshot('education-home-mobile-dark.png', true);
  await evaluate("window.darkModeManager._applyTheme('light');true");
  assert.deepEqual(consoleErrors, [], `Browser runtime errors: ${JSON.stringify(consoleErrors)}`);
  checks.push('Direct lesson URL and saved progress survive navigation; no browser JavaScript exceptions');
  await writeFile(path.join(artifacts, 'education-visual-report.json'), JSON.stringify({ checks, inputs, consoleErrors }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks, inputs, consoleErrors }, null, 2));
  await send('Browser.close').catch(() => {});
} catch (error) {
  console.error(error.stack || error.message);
  if (evaluate) {
      try {
        console.error('Browser diagnostics: ' + JSON.stringify(await evaluate("({url:location.href,ready:document.readyState,lessons:document.querySelectorAll('.lesson-card').length,bootstrap:!!window.bootstrap,alerts:document.getElementById('alertContainer')?.textContent,dialogOpen:document.getElementById('lessonModal')?.open,overflow:[...document.querySelectorAll('.restored-results,.restored-results *')].filter(node=>node.getBoundingClientRect().width>0 && (node.scrollWidth>node.clientWidth+1 || node.getBoundingClientRect().right>document.querySelector('.restored-results').getBoundingClientRect().right+1 || node.getBoundingClientRect().left<document.querySelector('.restored-results').getBoundingClientRect().left-1)).map(node=>({tag:node.tagName,class:node.className,scroll:node.scrollWidth,client:node.clientWidth,left:Math.round(node.getBoundingClientRect().left),right:Math.round(node.getBoundingClientRect().right),text:node.textContent.slice(0,100)}))})")));
        const failure = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await writeFile(path.join(artifacts, 'education-failure.png'), Buffer.from(failure.data, 'base64'));
      }
    catch { /* Keep the original failure. */ }
  }
  process.exitCode = 1;
} finally {
  for (const request of pending.values()) clearTimeout(request.timeout);
  socket?.close();
  chrome.kill();
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
}
