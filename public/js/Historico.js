import { element, button, showNotice, getStoredUser } from './safe-dom.js';
import { renderAnalysis, resultBadge, resultLabel } from './result-renderer.js';
import { mostrarModalPerfil } from './account.js';
const showAlert = showNotice;
let itemsHistorico = [];
const getToken = () => localStorage.getItem('vf-token');
const getUser = getStoredUser;
function atualizarNav() {
  const nav = document.getElementById('siteNav');
  if (!nav) return;

  const token = getToken();
  const user = getUser();

  let html = `
    <a href="/#inicio" class="nav-link">Verificar</a>
  `;

  if (token && user) {
    html += `<a href="/html/Historico.html" class="nav-link active">Histórico</a>`;
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


function pintarHistorico(itens) {
  const container = document.getElementById('historico-list');
  if (!container) return;
  container.replaceChildren();
  if (!itens.length) {
    const empty = element('div', 'text-center py-5');
    empty.append(element('p', 'text-muted', 'Você ainda não realizou nenhuma verificação.'));
    const link = element('a', 'btn btn-verify btn-sm', 'Verificar agora');
    link.href = '/';
    empty.append(link);
    container.append(empty);
    return;
  }
  itens.forEach((item, index) => {
    const card = element('article', 'query-item');
    const heading = element('div', 'd-flex justify-content-between align-items-start flex-wrap gap-2 mb-2');
    heading.append(element('span', 'text-muted small', new Date(item.createdAt).toLocaleString('pt-BR')), resultBadge(item));
    const content = String(item.texto || item.link || '');
    card.append(heading, element('p', 'mb-3 fw-semibold', content.slice(0,150) + (content.length > 150 ? '…' : '')));
    const actions = element('div', 'd-flex gap-2 justify-content-end');
    actions.append(button('Detalhes', 'btn btn-outline-secondary btn-sm', () => verDetalhes(index)), button('Excluir', 'btn btn-sm btn-outline-danger', () => excluirItem(item._id)));
    card.append(actions);
    container.append(card);
  });
}
function verDetalhes(index) {
  const item = itemsHistorico[index];
  if (!item) return;
  renderAnalysis(document.getElementById('modalContent'), item);
  const share = document.getElementById('shareBtn');
  if (share) share.onclick = () => {
    const data = {title:'VerificaFato',text:'Consulta no VerificaFato: ' + resultLabel(item),url:window.location.origin};
    if (navigator.share) navigator.share(data).catch(() => {});
    else navigator.clipboard?.writeText(data.url).then(() => showNotice('Link copiado!', 'success')).catch(() => showNotice('Não foi possível copiar.', 'danger'));
  };
  bootstrap.Modal.getOrCreateInstance(document.getElementById('resultsModal')).show();
}
async function excluirItem(id) {
  if (!confirm('Deseja realmente remover esta verificação do seu histórico?')) return;
  try {
    const response = await fetch('/api/historico/' + encodeURIComponent(id), {method:'DELETE',headers:{Authorization:'Bearer ' + getToken()}});
    const data = await response.json();
    if (!response.ok || !data.sucesso) throw new Error(data.erro || 'Não foi possível remover o registro.');
    itemsHistorico = itemsHistorico.filter(item => item._id !== id);
    pintarHistorico(itemsHistorico);
    showNotice('Verificação excluída.', 'success');
  } catch (error) { showNotice(error.message, 'danger'); }
}
async function carregarHistorico() {
  if (!getToken()) { window.location.href = '/html/Login.html'; return; }
  atualizarNav();
  const container = document.getElementById('historico-list');
  container.replaceChildren(element('p', 'text-center py-5', 'Carregando seu histórico…'));
  try {
    const response = await fetch('/api/historico', {headers:{Authorization:'Bearer ' + getToken()}});
    const data = await response.json();
    if (!response.ok || !data.sucesso) throw new Error(data.erro || 'Não foi possível carregar o histórico.');
    itemsHistorico = Array.isArray(data.itens) ? data.itens : [];
    pintarHistorico(itemsHistorico);
  } catch (error) { container.replaceChildren(element('p', 'text-center text-danger py-5', error.message)); }
}
window.addEventListener('vf-account-updated', atualizarNav);
window.addEventListener('DOMContentLoaded', carregarHistorico);
