import { showNotice, getStoredUser } from './safe-dom.js';
import { renderAnalysis, resultLabel } from './result-renderer.js';
import { mostrarModalPerfil } from './account.js';
import { detectInput, MAX_TEXT_LENGTH } from './input.js';
const showAlert = showNotice;
const verificationForm = document.getElementById('verificationForm');
const newsTextEl = document.getElementById('newsText');
const newsLinkEl = document.getElementById('newsLink');
const charCounterEl = document.getElementById('charCounter');
const submitBtn = document.getElementById('submitBtn');
let lastResult;
newsTextEl.addEventListener('input', () => {
  charCounterEl.textContent = newsTextEl.value.length.toLocaleString('pt-BR') + ' / 20.000';
  charCounterEl.classList.toggle('text-danger', newsTextEl.value.length > MAX_TEXT_LENGTH * 0.9);
});
function setLoading(on) {
  submitBtn.disabled = on;
  submitBtn.querySelector('.btn-text').classList.toggle('d-none', on);
  submitBtn.querySelector('.loading-spinner').classList.toggle('d-none', !on);
  verificationForm.setAttribute('aria-busy', String(on));
}
verificationForm.addEventListener('submit', async event => {
  event.preventDefault();
  let payload;
  try { payload = detectInput(newsTextEl.value, newsLinkEl.value); }
  catch (error) { showNotice(error.message); return; }
  setLoading(true);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const token = localStorage.getItem('vf-token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch('/api/verificar', {
      method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok || !data.sucesso) throw new Error(data.erro || 'Não foi possível analisar o conteúdo.');
    lastResult = renderAnalysis(document.getElementById('modalContent'), data.dados);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('resultsModal')).show();
  } catch (error) {
    showNotice(error.name === 'AbortError' ? 'A análise demorou mais que o esperado. Tente novamente em instantes.' : error.message, 'danger');
  } finally { clearTimeout(timeout); setLoading(false); }
});
document.getElementById('shareBtn')?.addEventListener('click', () => {
  const data = { title: 'VerificaFato', text: 'Consultei uma informação no VerificaFato. Resultado: ' + resultLabel(lastResult || {}), url: window.location.origin };
  if (navigator.share) navigator.share(data).catch(() => {});
  else navigator.clipboard?.writeText(data.url).then(() => showNotice('Link copiado!', 'success')).catch(() => showNotice('Não foi possível copiar.', 'danger'));
});
document.querySelectorAll('[data-close-lesson]').forEach(node => node.addEventListener('click', () => {
  document.getElementById('lessonModal').style.display = 'none';
}));
function atualizarNav() {
    const nav = document.querySelector('.site-nav');
    if (!nav) return;

    const token = localStorage.getItem('vf-token');
    const user = getStoredUser();

    // Mapeia links padrão
    let html = `
        <a href="/#inicio" class="nav-link">Verificar</a>
    `;

    if (token && user) {
        html += `<a href="/html/Historico.html" class="nav-link">Histórico</a>`;
        if (user.role === 'admin') {
            html += `<a href="/html/Admin.html" class="nav-link fw-bold text-warning">Painel Admin</a>`;
        }
        html += `
            <a href="#" id="profileBtn" class="nav-link text-success fw-semibold" style="margin-left: 10px;"><i class="fas fa-user-circle me-1"></i>Minha Conta</a>
            <a href="#" id="logoutBtn" class="nav-link text-danger"><i class="fas fa-sign-out-alt"></i> Sair</a>
        `;
    } else {
        html += `<a href="/html/Login.html" class="nav-link fw-bold text-success"><i class="fas fa-sign-in-alt me-1"></i> Entrar</a>`;
    }

    nav.innerHTML = html;

    // Configura o evento do botão de logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('vf-token');
            localStorage.removeItem('vf-user');
            window.location.href = '/';
        });
    }

    // Configura o evento do botão de perfil
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarModalPerfil();
        });
    }
}


window.addEventListener('vf-account-updated', atualizarNav);
document.addEventListener('DOMContentLoaded', atualizarNav);
