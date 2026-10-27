import { lessons, quizQuestions } from './education-content.js';
import { element, button, sanitizeLessonHtml } from './safe-dom.js';

const levels = { basico: 'Básico', intermediario: 'Intermediário', avancado: 'Avançado' };
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const array = value => Array.isArray(value) ? value : [];
const completionKey = 'vf-lessons-completed';
let availableLessonIds = new Set(lessons.map(lesson => lesson.lessonId));

export function isLessonAvailable(id) {
  return availableLessonIds.has(id);
}

// Suggestions are invitations to investigate; a language pattern is not a verdict.
export function recommendedLessons(data = {}) {
  if (!data || typeof data !== 'object') data = {};
  const visual = data.analiseVisual || {};
  const information = visual.dimensoes?.informacoes || data.dimensoes?.informacoes || {};
  const signals = [...array(visual.analiseLocal?.alertasFalso), ...array(data.analiseLocal?.alertasFalso), ...array(data.analiseLinguagem?.indicadores)]
    .map(item => typeof item === 'string' ? item : [item?.label, item?.categoria, item?.tipo].filter(value => typeof value === 'string').join(' ')).join(' ');
  const suggestions = [];
  if (/sensacional|clickbait|urgência|urgente|maiúscul/i.test(signals)) suggestions.push('sensacionalismo');
  if (/emoc|medo|alarm|compartilh|reenvio/i.test(signals)) suggestions.push('emocional');
  if (!array(data.fontes).length && !array(data.resultados).length) suggestions.push('fontes');
  const dates = array(information.datas);
  const original = [visual.texto, data.texto, data.resumo].filter(value => typeof value === 'string').join(' ');
  if (!dates.length && !/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2} de [a-zç]+ de \d{4}\b/i.test(original)) suggestions.push('contexto');
  if (!array(data.resultados).length) suggestions.push('ia');
  suggestions.push('fontes');
  return [...new Set(suggestions)].slice(0, 3);
}

function normalizeLesson(item) {
  if (!item || !validId(item.lessonId) || typeof item.titulo !== 'string' || !item.titulo.trim() || typeof item.conteudoHTML !== 'string' || item.ativo === false) return null;
  return {
    lessonId: item.lessonId,
    titulo: item.titulo.slice(0, 160),
    descricao: typeof item.descricao === 'string' ? item.descricao.slice(0, 500) : '',
    conteudoHTML: item.conteudoHTML.slice(0, 50000),
    nivel: Object.hasOwn(levels, item.nivel) ? item.nivel : 'basico',
    categoria: typeof item.categoria === 'string' ? item.categoria.slice(0, 80) : '',
    tempoLeitura: Number.isFinite(item.tempoLeitura) && item.tempoLeitura > 0 ? Math.ceil(item.tempoLeitura) : null,
    atualizadoEm: typeof item.atualizadoEm === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.atualizadoEm) ? item.atualizadoEm : '',
    autoria: typeof item.autoria === 'string' ? item.autoria.slice(0, 160) : '',
    ordem: Number.isFinite(item.ordem) ? item.ordem : 10000
  };
}

export function initEducation({ fetchImpl = globalThis.fetch, storage } = {}) {
  const grid = document.getElementById('educationGrid');
  const dialog = document.getElementById('lessonModal');
  if (!grid || !dialog) return { ready: Promise.resolve(), destroy() {} };

  const doc = document;
  const win = doc.defaultView || window;
  const filters = doc.getElementById('educationFilters');
  const status = doc.getElementById('educationStatus');
  const progress = doc.getElementById('educationProgress');
  const quizRoot = doc.getElementById('quizContent');
  const title = doc.getElementById('lessonTitle');
  const meta = doc.getElementById('lessonMeta');
  const body = doc.getElementById('lessonBody');
  const complete = doc.getElementById('completeLessonBtn');
  let catalog = lessons.map(normalizeLesson).filter(Boolean);
  availableLessonIds = new Set(catalog.map(lesson => lesson.lessonId));
  let filter = 'all';
  let currentLesson = null;
  let trigger = null;
  let destroyed = false;
  let quizIndex = 0;
  let score = 0;
  const completed = new Set();
  const listeners = [];
  const listen = (node, type, handler) => {
    if (!node) return;
    node.addEventListener(type, handler);
    listeners.push(() => node.removeEventListener(type, handler));
  };
  try {
    if (storage === undefined) storage = win.localStorage;
    const stored = JSON.parse(storage?.getItem(completionKey) || '[]');
    if (Array.isArray(stored)) stored.filter(validId).slice(0, 500).forEach(id => completed.add(id));
  } catch { /* Reading remains available when storage is blocked or invalid. */ }

  function setHash(hash) {
    try { win.history.replaceState(null, '', hash); } catch { /* Embedded or privacy-restricted context. */ }
  }
  function updateCompletion() {
    const total = catalog.filter(item => completed.has(item.lessonId)).length;
    if (progress) progress.textContent = `${total} de ${catalog.length} aulas concluídas neste navegador`;
    if (complete && currentLesson) {
      complete.textContent = completed.has(currentLesson.lessonId) ? 'Aula concluída ✓' : 'Marcar aula como concluída';
      complete.disabled = completed.has(currentLesson.lessonId);
    }
  }
  function updateLessonLinks() {
    doc.querySelectorAll('[data-open-lesson]').forEach(node => {
      node.hidden = !isLessonAvailable(node.dataset.openLesson);
    });
    doc.querySelectorAll('.learning-recommendations').forEach(section => {
      section.hidden = ![...section.querySelectorAll('[data-open-lesson]')].some(node => !node.hidden);
    });
  }
  function renderCatalog() {
    const focusedId = doc.activeElement?.closest('[data-open-lesson]')?.dataset.openLesson;
    const fragment = doc.createDocumentFragment();
    const visible = catalog.filter(item => filter === 'all' || item.nivel === filter);
    visible.forEach((lesson, index) => {
      const card = element('article', 'lesson-card');
      const top = element('div', 'lesson-meta');
      top.append(element('span', 'lesson-number', String(index + 1).padStart(2, '0')), element('span', '', levels[lesson.nivel]));
      if (lesson.tempoLeitura) top.append(element('span', '', `${lesson.tempoLeitura} min`));
      card.append(top, element('h3', '', lesson.titulo), element('p', '', lesson.descricao));
      if (completed.has(lesson.lessonId)) card.append(element('span', 'lesson-complete', '✓ Concluída'));
      const open = element('button', 'lesson-open', completed.has(lesson.lessonId) ? 'Revisitar aula →' : 'Começar aula →');
      open.type = 'button';
      open.dataset.openLesson = lesson.lessonId;
      open.setAttribute('aria-label', `${completed.has(lesson.lessonId) ? 'Revisitar' : 'Começar'}: ${lesson.titulo}`);
      card.append(open);
      fragment.append(card);
    });
    if (!visible.length) fragment.append(element('p', 'education-empty', 'Nenhuma aula neste nível. Explore outro filtro.'));
    grid.replaceChildren(fragment);
    if (focusedId && !dialog.open) [...grid.querySelectorAll('[data-open-lesson]')].find(node => node.dataset.openLesson === focusedId)?.focus({ preventScroll: true });
    if (status) status.textContent = `${visible.length} ${visible.length === 1 ? 'aula disponível' : 'aulas disponíveis'}${filter === 'all' ? '' : ` · ${levels[filter]}`}`;
    updateCompletion();
  }
  if (filters) {
    filters.replaceChildren();
    for (const [value, label] of [['all', 'Todas as aulas'], ...Object.entries(levels)]) {
      const node = button(label, 'education-filter', () => {
        filter = value;
        for (const item of filters.children) item.setAttribute('aria-pressed', String(item === node));
        renderCatalog();
      });
      node.dataset.level = value;
      node.setAttribute('aria-pressed', String(value === filter));
      filters.append(node);
    }
  }

  function renderLessonContent(lesson) {
    title.textContent = lesson.titulo;
    if (meta) {
      const date = lesson.atualizadoEm ? lesson.atualizadoEm.split('-').reverse().join('/') : '';
      meta.textContent = [levels[lesson.nivel], lesson.tempoLeitura ? `${lesson.tempoLeitura} min de leitura` : '', lesson.autoria, date ? `Atualizado em ${date}` : ''].filter(Boolean).join(' · ');
    }
    body.innerHTML = sanitizeLessonHtml(lesson.conteudoHTML);
  }
  function showLesson(lesson) {
    if (destroyed || !title || !body) return;
    currentLesson = lesson;
    renderLessonContent(lesson);
    updateCompletion();
    if (!dialog.open) dialog.showModal();
    doc.body.classList.add('reading-lesson');
    dialog.scrollTop = 0;
    title.focus({ preventScroll: true });
    setHash(`#licao-${lesson.lessonId}`);
  }
  function openLesson(id, source = null) {
    const lesson = catalog.find(item => item.lessonId === id);
    if (!lesson) return false;
    if (!dialog.open) trigger = source || doc.activeElement;
    const results = doc.getElementById('resultsModal');
    const bootstrap = win.bootstrap || globalThis.bootstrap;
    if (results?.classList.contains('show') && bootstrap?.Modal) {
      results.addEventListener('hidden.bs.modal', () => showLesson(lesson), { once: true });
      bootstrap.Modal.getOrCreateInstance(results).hide();
    } else showLesson(lesson);
    return true;
  }
  function openHashLesson() {
    const match = /^#licao-([a-zA-Z0-9_-]{1,80})$/.exec(win.location.hash);
    if (match && currentLesson?.lessonId !== match[1]) openLesson(match[1]);
  }
  listen(doc, 'click', event => {
    const opener = event.target.closest?.('[data-open-lesson]');
    if (opener && openLesson(opener.dataset.openLesson, opener)) event.preventDefault();
    if (event.target.closest?.('[data-close-lesson]') && dialog.open) dialog.close();
  });
  listen(dialog, 'click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  listen(dialog, 'close', () => {
    doc.body.classList.remove('reading-lesson');
    const returnId = currentLesson?.lessonId;
    currentLesson = null;
    if (win.location.hash.startsWith('#licao-')) setHash('#aprender');
    const resultTrigger = trigger?.closest?.('#resultsModal');
    if (trigger?.isConnected && (!resultTrigger || resultTrigger.classList.contains('show'))) trigger.focus({ preventScroll: true });
    else {
      const replacement = trigger?.dataset?.openLesson || returnId;
      [...grid.querySelectorAll('[data-open-lesson]')].find(node => node.dataset.openLesson === replacement)?.focus({ preventScroll: true });
    }
    trigger = null;
  });
  listen(complete, 'click', () => {
    if (!currentLesson) return;
    completed.add(currentLesson.lessonId);
    try { storage?.setItem(completionKey, JSON.stringify([...completed])); } catch { /* Session progress still works. */ }
    renderCatalog();
  });
  listen(win, 'hashchange', openHashLesson);

  function renderQuiz(focus = false) {
    if (!quizRoot) return;
    quizRoot.replaceChildren();
    if (quizIndex >= quizQuestions.length) {
      const result = element('div', 'quiz-result');
      const heading = element('h3', '', 'Cada checagem começa com uma boa pergunta.');
      heading.tabIndex = -1;
      result.append(heading, element('p', '', `Você acertou ${score} de ${quizQuestions.length} questões. Continue praticando: o mais importante é entender como investigar.`), button('Refazer o desafio', 'btn btn-verify', () => { quizIndex = 0; score = 0; renderQuiz(true); }));
      quizRoot.append(result);
      if (focus) heading.focus();
      return;
    }
    const question = quizQuestions[quizIndex];
    const form = element('form', 'quiz-form');
    const step = element('p', 'quiz-progress', `Questão ${quizIndex + 1} de ${quizQuestions.length}`);
    const fieldset = element('fieldset');
    const legend = element('legend', '', question.pergunta);
    legend.tabIndex = -1;
    const options = element('div', 'quiz-options');
    question.opcoes.forEach((option, index) => {
      const label = element('label', 'quiz-option');
      const input = element('input');
      input.type = 'radio'; input.name = 'quiz-answer'; input.value = String(index);
      label.append(input, element('span', '', option)); options.append(label);
    });
    fieldset.append(legend, options);
    const feedback = element('div', 'quiz-feedback');
    feedback.setAttribute('aria-live', 'polite'); feedback.tabIndex = -1;
    const actions = element('div', 'quiz-actions');
    const submit = element('button', 'btn btn-verify', 'Conferir resposta'); submit.type = 'submit';
    actions.append(submit);
    form.append(step, fieldset, feedback, actions);
    let answered = false;
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (answered) return;
      const selected = form.querySelector('input[name="quiz-answer"]:checked');
      if (!selected) { feedback.textContent = 'Escolha uma alternativa para conferir a explicação.'; form.querySelector('input')?.focus(); return; }
      answered = true;
      const correct = Number(selected.value) === question.correta;
      if (correct) score++;
      fieldset.disabled = true;
      feedback.classList.add(correct ? 'is-correct' : 'is-learning');
      feedback.replaceChildren();
      feedback.append(element('strong', '', correct ? 'Isso mesmo! ' : 'Vamos conferir: '), element('p', '', question.explicacao), element('p', 'quiz-correct-answer', `Resposta: ${question.opcoes[question.correta]}`));
      if (isLessonAvailable(question.lessonId)) {
        const related = element('button', 'lesson-open', 'Entenda o assunto na aula →'); related.type = 'button'; related.dataset.openLesson = question.lessonId;
        feedback.append(related);
      }
      actions.replaceChildren(button(quizIndex + 1 === quizQuestions.length ? 'Ver meu resultado' : 'Próxima questão →', 'btn btn-verify', () => { quizIndex++; renderQuiz(true); }));
      feedback.focus();
    });
    quizRoot.append(form);
    if (focus) legend.focus();
  }

  renderCatalog();
  renderQuiz();
  openHashLesson();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const ready = (async () => {
    try {
      if (typeof fetchImpl !== 'function') return;
      const response = await fetchImpl('/api/education', { signal: controller.signal });
      if (!response.ok) return;
      const data = await response.json();
      if (!data.sucesso || !Array.isArray(data.licoes) || destroyed) return;
      const incoming = data.licoes.slice(0, 500).map(normalizeLesson).filter(Boolean);
      // An intentionally empty catalogue is authoritative (all lessons may be disabled).
      if (data.licoes.length && !incoming.length) return;
      const unique = new Map(incoming.map(lesson => [lesson.lessonId, lesson]));
      catalog = [...unique.values()].sort((a, b) => a.ordem - b.ordem);
      availableLessonIds = new Set(catalog.map(lesson => lesson.lessonId));
      renderCatalog();
      updateLessonLinks();
      if (currentLesson) {
        const refreshed = catalog.find(item => item.lessonId === currentLesson.lessonId);
        if (refreshed) {
          const scroll = dialog.scrollTop;
          const active = doc.activeElement;
          const focusedHref = body.contains(active) ? active.getAttribute('href') : null;
          const bodyHadFocus = body.contains(active);
          currentLesson = refreshed;
          renderLessonContent(refreshed);
          updateCompletion();
          if (bodyHadFocus) {
            const replacement = focusedHref && [...body.querySelectorAll('a')].find(link => link.getAttribute('href') === focusedHref);
            (replacement || title).focus({ preventScroll: true });
          }
          dialog.scrollTop = scroll;
        } else if (dialog.open) dialog.close();
      } else openHashLesson();
    } catch { /* The built-in learning material remains available without the API. */ }
    finally { clearTimeout(timeout); }
  })();
  return {
    ready,
    openLesson,
    destroy() {
      destroyed = true;
      controller.abort();
      clearTimeout(timeout);
      listeners.forEach(remove => remove());
      if (dialog.open) dialog.close();
      doc.body.classList.remove('reading-lesson');
    }
  };
}
