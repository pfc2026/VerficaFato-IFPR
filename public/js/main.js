import { showNotice, getStoredUser } from './safe-dom.js';
import { renderAnalysis } from './result-renderer.js';
import { shareSite } from './share.js';
import { mostrarModalPerfil } from './account.js';
import { detectInput, MAX_TEXT_LENGTH } from './input.js';
import { initEducation } from './education.js';
import { assertAnalysisEnvelope, INVALID_RESULT_MESSAGE } from './result-contract.js';
const showAlert = showNotice;
const verificationForm = document.getElementById('verificationForm');
const newsTextEl = document.getElementById('newsText');
const newsLinkEl = document.getElementById('newsLink');
const charCounterEl = document.getElementById('charCounter');
const submitBtn = document.getElementById('submitBtn');
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
  try { payload = detectInput(newsTextEl.value, newsLinkEl?.value || ''); }
  catch (error) { showNotice(error.message); return; }
  setLoading(true);
  const modalElement = document.getElementById('resultsModal');
  bootstrap.Modal.getInstance?.(modalElement)?.hide();
  document.getElementById('modalContent').replaceChildren();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const token = localStorage.getItem('vf-token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch('/api/verificar', {
      method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal
    });
    let data;
    try { data = await response.json(); }
    catch { throw Object.assign(new Error(INVALID_RESULT_MESSAGE), { code:'INVALID_RESPONSE' }); }
    if (!response.ok) {
      const messages = {429:'Muitas consultas. Aguarde alguns minutos e tente novamente.',500:'Não foi possível concluir a análise. Tente novamente em instantes.',503:'Serviço temporariamente indisponível. Tente novamente em instantes.',504:'O serviço demorou para responder. Tente novamente em instantes.'};
      const safeValidation = [400,401,403,413,422].includes(response.status) && typeof data?.erro === 'string' && data.erro.length <= 350 && !/[<>\n]|stack|TypeError|SyntaxError|Failed to fetch/i.test(data.erro);
      throw Object.assign(new Error(safeValidation ? data.erro : messages[response.status] || 'Não foi possível analisar o conteúdo. Tente novamente.'),{code:'HTTP_FAILURE'});
    }
    renderAnalysis(document.getElementById('modalContent'), assertAnalysisEnvelope(data));
    document.getElementById('shareStatus').textContent = '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('resultsModal')).show();
  } catch (error) {
    const safeCodes=['INVALID_RESPONSE','INVALID_ANALYSIS_RESULT','HTTP_FAILURE'];
    const message=error.name==='AbortError' ? 'A análise demorou mais que o esperado. Tente novamente em instantes.' : safeCodes.includes(error.code) ? error.message : 'Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.';
    console.warn('Falha na análise', {codigo:safeCodes.includes(error.code)?error.code:error.name==='AbortError'?'CLIENT_TIMEOUT':'CONNECTION_FAILURE'});
    showNotice(message, 'danger');
  } finally { clearTimeout(timeout); setLoading(false); }
});
document.getElementById('shareBtn')?.addEventListener('click', () => shareSite());
function atualizarNav() {
    const nav = document.querySelector('.site-nav');
    if (!nav) return;

    const token = localStorage.getItem('vf-token');
    const user = getStoredUser();

    // Mapeia links padrão
    let html = `
        <a href="/#inicio" class="nav-link">Verificar</a>
        <a href="/#aprender" class="nav-link">Aprender</a>
        <a href="/#desafio" class="nav-link">Quiz</a>
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
if (document.readyState !== 'loading') atualizarNav();
initEducation();
