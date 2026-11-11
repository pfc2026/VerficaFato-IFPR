import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initEducation, recommendedLessons } from '../public/js/education.js';
import { lessons, quizQuestions } from '../public/js/education-content.js';

function browser(t, { hash = '', stored, fetchImpl = async () => { throw new Error('offline'); }, storage } = {}) {
  const dom = new JSDOM(`<!doctype html><html lang="pt-BR"><body>
    <div id="educationFilters"></div><p id="educationStatus" role="status"></p>
    <p id="educationProgress" role="status"></p><div id="educationGrid"></div>
    <div id="quizContent"></div>
    <dialog id="lessonModal"><button data-close-lesson>Fechar</button>
      <h2 id="lessonTitle" tabindex="-1"></h2><p id="lessonMeta"></p>
      <div id="lessonBody"></div><button id="completeLessonBtn"></button>
    </dialog></body></html>`, { url: `https://verificafato.example/${hash}` });
  const original = { document: globalThis.document, window: globalThis.window, DOMParser: globalThis.DOMParser };
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.DOMParser = dom.window.DOMParser;
  const dialog = dom.window.document.getElementById('lessonModal');
  dialog.showModal = () => { dialog.setAttribute('open', ''); };
  dialog.close = () => { dialog.removeAttribute('open'); dialog.dispatchEvent(new dom.window.Event('close')); };
  if (stored !== undefined) dom.window.localStorage.setItem('vf-lessons-completed', stored);
  const app = initEducation({ fetchImpl, ...(storage !== undefined ? { storage } : {}) });
  t.after(() => { app.destroy(); Object.assign(globalThis, original); dom.window.close(); });
  return { dom, document: dom.window.document, app, dialog };
}

function submit(dom, form) {
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}

test('learning stays available when the API is unavailable; opening alone never completes a lesson', async t => {
  const { app, document, dialog } = browser(t);
  await app.ready;
  assert.equal(document.querySelectorAll('.lesson-card').length, lessons.length);
  const opener = document.querySelector('[data-open-lesson]');
  opener.focus(); opener.click();
  assert.equal(dialog.open, true);
  assert.equal(document.getElementById('lessonTitle').textContent, lessons[0].titulo);
  assert.ok(document.getElementById('lessonBody').textContent.length > 100);
  assert.match(document.getElementById('educationProgress').textContent, /^0 de /);
  document.querySelector('[data-close-lesson]').click();
  assert.equal(dialog.open, false);
  assert.equal(document.activeElement, opener);
});

test('an explicit completion is saved, reflected on the card and recovered next visit', async t => {
  const { app, document, dom } = browser(t);
  await app.ready;
  document.querySelector('[data-open-lesson]').click();
  document.getElementById('completeLessonBtn').click();
  const saved = JSON.parse(dom.window.localStorage.getItem('vf-lessons-completed'));
  assert.deepEqual(saved, [lessons[0].lessonId]);
  assert.match(document.getElementById('educationProgress').textContent, /^1 de /);
  assert.equal(document.querySelectorAll('.lesson-complete').length, 1);
  assert.equal(document.getElementById('completeLessonBtn').disabled, true);
});

test('corrupt or blocked storage never prevents reading, answering or marking a lesson', async t => {
  const { app, document, dialog } = browser(t, { stored: '{invalid', storage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } } });
  await app.ready;
  document.querySelector('[data-open-lesson]').click();
  document.getElementById('completeLessonBtn').click();
  assert.equal(dialog.open, true);
  assert.match(document.getElementById('educationProgress').textContent, /^1 de /);
  assert.ok(document.querySelector('#quizContent input'));
});

test('only valid stored IDs mark known lessons as completed', async t => {
  const { app, document } = browser(t, { stored: JSON.stringify([lessons[0].lessonId, { lessonId: lessons[1].lessonId }, 2, '<script>', lessons[0].lessonId, 'unknown-id']) });
  await app.ready;
  assert.equal(document.querySelectorAll('.lesson-complete').length, 1);
  assert.match(document.getElementById('educationProgress').textContent, /^1 de /);
});

test('a pending API refresh preserves a reader-selected level and keyboard focus', async t => {
  let resolveFetch;
  const { app, document } = browser(t, { fetchImpl: () => new Promise(resolve => { resolveFetch = resolve; }) });
  const basic = document.querySelector('[data-level="basico"]');
  basic.focus(); basic.click();
  resolveFetch({ ok: true, json: async () => ({ sucesso: true, licoes: lessons }) });
  await app.ready;
  assert.equal(basic.getAttribute('aria-pressed'), 'true');
  assert.equal(document.activeElement, basic);
  assert.equal(document.querySelectorAll('.lesson-card').length, lessons.filter(lesson => lesson.nivel === 'basico').length);
  assert.match(document.getElementById('educationStatus').textContent, /Básico/);
});

test('remote lesson markup, labels, links and unknown IDs cannot execute content', async t => {
  const attack = '<img src=x onerror="window.pwned=1"><script>window.pwned=2</script>';
  const remote = { lessonId: 'custom-lesson', titulo: attack, descricao: attack, conteudoHTML: `<h3 onclick="alert(1)">Título</h3><p>Texto</p>${attack}<a href="javascript:alert(1)">ruim</a><a href="https://example.org/fonte">fonte</a>`, nivel: '__proto__', autoria: attack };
  const { app, document, dom } = browser(t, { fetchImpl: async () => ({ ok: true, json: async () => ({ sucesso: true, licoes: [remote, { ...remote, lessonId: '<script>' }] }) }) });
  await app.ready;
  assert.equal(document.querySelectorAll('.lesson-card').length, 1);
  assert.ok(document.querySelector('.lesson-card').textContent.includes(attack));
  document.querySelector('[data-open-lesson]').click();
  assert.equal(document.querySelectorAll('script,img,svg,[onclick],[onerror],a[href^="javascript:"]').length, 0);
  const source = document.querySelector('#lessonBody a[href]');
  assert.equal(source.href, 'https://example.org/fonte');
  assert.equal(source.rel, 'noopener noreferrer');
  assert.equal(dom.window.pwned, undefined);
  assert.equal(app.openLesson('<script>'), false);
});

test('a shared lesson URL opens a remote lesson after the catalogue arrives', async t => {
  const custom = { ...lessons[0], lessonId: 'remote-only', titulo: 'Aula compartilhada' };
  const { app, document, dialog, dom } = browser(t, { hash: '#licao-remote-only', fetchImpl: async () => ({ ok: true, json: async () => ({ sucesso: true, licoes: [custom] }) }) });
  await app.ready;
  assert.equal(dialog.open, true);
  assert.equal(document.getElementById('lessonTitle').textContent, custom.titulo);
  assert.equal(dom.window.location.hash, '#licao-remote-only');
  document.querySelector('[data-close-lesson]').click();
  assert.equal(dom.window.location.hash, '#aprender');
});

test('a remote revision updates an open lesson without losing its reading position', async t => {
  const revision = { ...lessons[2], titulo: 'Aula atualizada pela equipe', conteudoHTML: '<h3>Conteúdo atualizado</h3><p>Confira o documento original.</p>' };
  const { app, document, dialog } = browser(t, {
    hash: '#licao-' + revision.lessonId,
    fetchImpl: async () => ({ ok: true, json: async () => ({ sucesso: true, licoes: [revision] }) })
  });
  assert.equal(dialog.open, true);
  dialog.scrollTop = 120;
  await app.ready;
  assert.equal(document.getElementById('lessonTitle').textContent, revision.titulo);
  assert.match(document.getElementById('lessonBody').textContent, /Conteúdo atualizado/);
  assert.equal(dialog.scrollTop, 120);
});

test('an intentionally empty catalogue closes unavailable lessons and removes dead quiz links', async t => {
  const { app, document, dialog, dom } = browser(t, {
    hash: '#licao-fontes',
    fetchImpl: async () => ({ ok: true, json: async () => ({ sucesso: true, licoes: [] }) })
  });
  const link = document.createElement('a');
  link.dataset.openLesson = 'fontes';
  document.body.append(link);
  assert.equal(dialog.open, true);
  await app.ready;
  assert.equal(dialog.open, false);
  assert.equal(document.querySelectorAll('.lesson-card').length, 0);
  assert.match(document.getElementById('educationProgress').textContent, /^0 de 0/);
  assert.equal(link.hidden, true);
  const form = document.querySelector('.quiz-form');
  form.querySelector('input').checked = true;
  submit(dom, form);
  assert.equal(document.querySelector('.quiz-feedback [data-open-lesson]'), null);
  assert.ok(document.querySelector('.quiz-feedback').textContent.includes(quizQuestions[0].explicacao));
});

test('quiz requires a choice, explains an incorrect answer and counts each question once', async t => {
  const { app, document, dom } = browser(t);
  await app.ready;
  let form = document.querySelector('.quiz-form');
  submit(dom, form);
  assert.match(document.querySelector('.quiz-feedback').textContent, /Escolha uma alternativa/);
  assert.match(document.querySelector('.quiz-progress').textContent, /1 de /);
  assert.equal(document.querySelector('.quiz-correct-answer'), null);
  for (let index = 0; index < quizQuestions.length; index++) {
    form = document.querySelector('.quiz-form');
    const question = quizQuestions[index];
    const choice = index === 0 ? (question.correta + 1) % question.opcoes.length : question.correta;
    form.querySelector(`input[value="${choice}"]`).checked = true;
    submit(dom, form);
    assert.ok(document.querySelector('.quiz-feedback').textContent.includes(question.explicacao));
    assert.equal(document.querySelector('fieldset').disabled, true);
    assert.equal(document.querySelector('.quiz-feedback').textContent.includes('Escolha uma alternativa'), false);
    submit(dom, form); // Repeated submission must not increase the score.
    document.querySelector('.quiz-actions button').click();
  }
  assert.match(document.querySelector('.quiz-result').textContent, new RegExp(`${quizQuestions.length - 1} de ${quizQuestions.length}`));
  document.querySelector('.quiz-result button').click();
  assert.match(document.querySelector('.quiz-progress').textContent, /Questão 1 de /);
  assert.equal(document.querySelector('input:checked'), null);
});

test('quiz links open the related explanation without resetting the exercise', async t => {
  const { app, document, dom, dialog } = browser(t);
  await app.ready;
  const form = document.querySelector('.quiz-form');
  form.querySelector('input').checked = true;
  submit(dom, form);
  const link = document.querySelector('.quiz-feedback [data-open-lesson]');
  link.click();
  assert.equal(dialog.open, true);
  assert.equal(document.getElementById('lessonTitle').textContent, lessons.find(lesson => lesson.lessonId === quizQuestions[0].lessonId).titulo);
  document.querySelector('[data-close-lesson]').click();
  assert.match(document.querySelector('.quiz-progress').textContent, /Questão 1 de /);
  assert.equal(document.querySelector('fieldset').disabled, true);
});

test('recommendations prioritize investigation skills and are limited to three valid lessons', () => {
  const ids = recommendedLessons({ analiseVisual: { analiseLocal: { alertasFalso: [{ label: 'Urgência/Clickbait' }, { label: 'Apelo emocional e medo' }] } }, fontes: [], resultados: [] });
  assert.deepEqual(ids, ['sensacionalismo', 'emocional', 'fontes']);
  assert.ok(recommendedLessons({}).includes('fontes'));
  assert.ok(recommendedLessons({ fontes: [{ url: 'https://example.org' }], resultados: [], texto: 'Uma mensagem sem data.' }).includes('contexto'));
  for (const id of ids) assert.ok(lessons.some(lesson => lesson.lessonId === id));
});
