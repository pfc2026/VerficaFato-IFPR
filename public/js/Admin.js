import { element, button, appendSafeLink, safeWebUrl, sanitizeLessonHtml, showNotice } from './safe-dom.js';
import { renderAnalysis, resultBadge } from './result-renderer.js';
import { mostrarModalPerfil } from './account.js';
const showAlert = showNotice;

function cell(row, value, className = '') { const node = element('td', className, value); row.append(node); return node; }
function tableState(id, columns, message) {
  const body = document.getElementById(id);
  if (!body) return null;
  const row = element('tr');
  const td = cell(row, message, 'text-center text-muted');
  td.colSpan = columns;
  body.replaceChildren(row);
  return body;
}
function actionGroup(row) { const target = cell(row); const group = element('div', 'btn-edit-actions d-flex gap-2'); target.append(group); return group; }
// Admin.js — VerificaFato

let currentTab = 'resumo';
let localFontes = [];
let localLicoes = [];
let localUsuarios = [];
let localVerificacoes = [];

function getToken() {
  return localStorage.getItem('vf-token');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('vf-user') || 'null');
  } catch {
    return null;
  }
}

// ── Exibir alertas na tela ──────────────────────────────
function atualizarNav() {
  const nav = document.getElementById('siteNav');
  if (!nav) return;

  const token = getToken();
  const user = getUser();

  let html = `
    <a href="/#inicio" class="nav-link">Verificar</a>
  `;

  if (token && user) {
    html += `<a href="/html/Historico.html" class="nav-link">Histórico</a>`;
    if (user.role === 'admin') {
      html += `<a href="/html/Admin.html" class="nav-link active fw-bold text-warning">Painel Admin</a>`;
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

// ── Modal de Perfil/Conta Dinâmico ────────────────────────
function switchTab(tab) {
  currentTab = tab;
  
  // Atualiza os botões das abas
  document.querySelectorAll('.tab-admin-btn').forEach(btn => btn.classList.toggle('active',btn.dataset.adminTab === tab));
  // Exibe o painel correto
  document.querySelectorAll('.panel-admin').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tab}`);
  });

  // Carrega os dados respectivos
  if (tab === 'resumo') carregarResumo();
  if (tab === 'fontes') carregarFontes();
  if (tab === 'licoes') carregarLicoes();
  if (tab === 'usuarios') carregarUsuarios();
  if (tab === 'verificacoes') carregarVerificacoes();
}

// ── Helper para Chamadas da API ──────────────────────────
async function fetchAdmin(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers }).catch(() => null);
  if (!response) throw new Error('Não foi possível conectar com o servidor.');

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.sucesso) {
    throw new Error(data?.erro || `Erro na requisição (${response.status})`);
  }

  return data;
}

// ── CARREGAR RESUMO / ESTADO GERAL ────────────────────────
async function carregarResumo() {
  const target = tableState('resumo-recentes-list',4,'Carregando…');
  try {
    const data = await fetchAdmin('/api/admin/resumo');
    for (const [id, key] of [['stat-usuarios','totalUsuarios'],['stat-fontes','totalFontes'],['stat-licoes','totalLicoes'],['stat-verificacoes','totalVerificacoes']]) document.getElementById(id).textContent = data.resumo[key];
    const items = Array.isArray(data.resumo.ultimasVerificacoes) ? data.resumo.ultimasVerificacoes : [];
    if (!items.length) { tableState('resumo-recentes-list',4,'Nenhuma atividade recente registrada.'); return; }
    target.replaceChildren();
    for (const item of items) {
      const row = element('tr');
      cell(row, item.userId ? String(item.userId.nome || '') + ' (' + String(item.userId.email || '') + ')' : 'Anônimo');
      const content = String(item.texto || item.link || '');
      const snippet = cell(row, content.slice(0,70) + (content.length > 70 ? '…' : ''));
      snippet.title = content;
      cell(row).append(resultBadge(item));
      cell(row, new Date(item.createdAt).toLocaleString('pt-BR'));
      target.append(row);
    }
  } catch(error) { tableState('resumo-recentes-list',4,'Não foi possível carregar.'); showNotice(error.message,'danger'); }
}

async function carregarFontes() {
  const target = tableState('fontes-table-body',5,'Carregando fontes…');
  try {
    const data = await fetchAdmin('/api/admin/fontes');
    localFontes = Array.isArray(data.fontes) ? data.fontes : [];
    if (!localFontes.length) { tableState('fontes-table-body',5,'Nenhuma fonte cadastrada.'); return; }
    target.replaceChildren();
    for (const item of localFontes) {
      const row = element('tr');
      cell(row,item.nome);
      appendSafeLink(cell(row),item.url,item.url,'text-info');
      cell(row,item.ordem);
      cell(row).append(element('span',item.ativo ? 'badge bg-success':'badge bg-danger',item.ativo ? 'Ativa':'Inativa'));
      const actions = actionGroup(row);
      actions.append(button('Editar','btn btn-sm btn-outline-light',()=>abrirModalFonte(item._id)),button('Excluir','btn btn-sm btn-outline-danger',()=>excluirFonte(item._id)));
      target.append(row);
    }
  } catch(error) { tableState('fontes-table-body',5,'Não foi possível carregar.'); showNotice(error.message,'danger'); }
}

function abrirModalFonte(id = null) {
  const title = document.getElementById('modalFonteTitle');
  const form = document.getElementById('formFonte');
  
  form.reset();
  document.getElementById('fonte-id').value = '';
  
  if (id) {
    title.textContent = 'Editar Fonte';
    const f = localFontes.find(x => x._id === id);
    if (f) {
      document.getElementById('fonte-id').value = f._id;
      document.getElementById('fonte-nome').value = f.nome;
      document.getElementById('fonte-url').value = f.url;
      document.getElementById('fonte-ordem').value = f.ordem;
      document.getElementById('fonte-ativo').checked = f.ativo;
    }
  } else {
    title.textContent = 'Adicionar Fonte';
  }
  
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalFonte')).show();
}

async function salvarFonte(e) {
  e.preventDefault();
  const id = document.getElementById('fonte-id').value;
  const nome = document.getElementById('fonte-nome').value.trim();
  const url = document.getElementById('fonte-url').value.trim();
  const ordem = parseInt(document.getElementById('fonte-ordem').value) || 0;
  const ativo = document.getElementById('fonte-ativo').checked;

  try {
    if (!safeWebUrl(url)) throw new Error('Informe uma URL HTTP ou HTTPS válida.');
    const payload = { nome, url, ordem, ativo };
    let data;
    if (id) {
      data = await fetchAdmin(`/api/admin/fontes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
      showAlert('Fonte atualizada com sucesso.', 'success');
    } else {
      data = await fetchAdmin('/api/admin/fontes', { method: 'POST', body: JSON.stringify(payload) });
      showAlert('Fonte criada com sucesso.', 'success');
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalFonte')).hide();
    carregarFontes();
  } catch (err) {
    showAlert(err.message, 'danger');
  }
}

async function excluirFonte(id) {
  if (!confirm('Deseja realmente remover esta fonte permanentemente?')) return;
  try {
    await fetchAdmin(`/api/admin/fontes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showAlert('Fonte excluída.', 'success');
    carregarFontes();
  } catch (err) {
    showAlert(err.message, 'danger');
  }
}

// ── CRUD LIÇÕES ─────────────────────────────────────────────
async function carregarLicoes() {
  const target = tableState('licoes-table-body',7,'Carregando lições…');
  try {
    const data = await fetchAdmin('/api/admin/licoes');
    localLicoes = Array.isArray(data.licoes) ? data.licoes : [];
    if (!localLicoes.length) { tableState('licoes-table-body',7,'Nenhuma lição cadastrada.'); return; }
    target.replaceChildren();
    for (const item of localLicoes) {
      const row = element('tr');
      for (const value of [item.lessonId,item.titulo,item.categoria,item.nivel,item.ordem]) cell(row,value);
      cell(row).append(element('span',item.ativo ? 'badge bg-success':'badge bg-danger',item.ativo ? 'Ativa':'Inativa'));
      actionGroup(row).append(button('Editar','btn btn-sm btn-outline-light',()=>abrirModalLicao(item._id)),button('Excluir','btn btn-sm btn-outline-danger',()=>excluirLicao(item._id)));
      target.append(row);
    }
  } catch(error) { tableState('licoes-table-body',7,'Não foi possível carregar.'); showNotice(error.message,'danger'); }
}

function abrirModalLicao(id = null) {
  const title = document.getElementById('modalLicaoTitle');
  const form = document.getElementById('formLicao');
  
  form.reset();
  document.getElementById('licao-id').value = '';
  document.getElementById('licao-lessonId').disabled = false;
  
  if (id) {
    title.textContent = 'Editar Lição';
    const l = localLicoes.find(x => x._id === id);
    if (l) {
      document.getElementById('licao-id').value = l._id;
      document.getElementById('licao-lessonId').value = l.lessonId;
      document.getElementById('licao-lessonId').disabled = true; // não deixa editar ID único
      document.getElementById('licao-titulo').value = l.titulo;
      document.getElementById('licao-descricao').value = l.descricao;
      document.getElementById('licao-categoria').value = l.categoria;
      document.getElementById('licao-nivel').value = l.nivel;
      document.getElementById('licao-icone').value = l.icone;
      document.getElementById('licao-ordem').value = l.ordem;
      document.getElementById('licao-ativo').checked = l.ativo;
      document.getElementById('licao-conteudoHTML').value = l.conteudoHTML;
    }
  } else {
    title.textContent = 'Criar Lição Educativa';
  }
  
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalLicao')).show();
}

async function salvarLicao(e) {
  e.preventDefault();
  const id = document.getElementById('licao-id').value;
  const lessonId = document.getElementById('licao-lessonId').value.trim().toLowerCase();
  const titulo = document.getElementById('licao-titulo').value.trim();
  const descricao = document.getElementById('licao-descricao').value.trim();
  const categoria = document.getElementById('licao-categoria').value;
  const nivel = document.getElementById('licao-nivel').value;
  const icone = document.getElementById('licao-icone').value.trim();
  const ordem = parseInt(document.getElementById('licao-ordem').value) || 0;
  const ativo = document.getElementById('licao-ativo').checked;
  const conteudoHTML = sanitizeLessonHtml(document.getElementById('licao-conteudoHTML').value);

  try {
    const payload = { lessonId, titulo, descricao, categoria, nivel, icone, ordem, ativo, conteudoHTML };
    if (id) {
      await fetchAdmin(`/api/admin/licoes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
      showAlert('Lição atualizada com sucesso.', 'success');
    } else {
      await fetchAdmin('/api/admin/licoes', { method: 'POST', body: JSON.stringify(payload) });
      showAlert('Lição criada com sucesso.', 'success');
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalLicao')).hide();
    carregarLicoes();
  } catch (err) {
    showAlert(err.message, 'danger');
  }
}

async function excluirLicao(id) {
  if (!confirm('Deseja realmente excluir esta lição?')) return;
  try {
    await fetchAdmin(`/api/admin/licoes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showAlert('Lição removida.', 'success');
    carregarLicoes();
  } catch (err) {
    showAlert(err.message, 'danger');
  }
}

// ── USUÁRIOS (ROLES & STATUS) ────────────────────────────────
async function carregarUsuarios() {
  const target = tableState('usuarios-table-body',5,'Carregando usuários…');
  try {
    const data = await fetchAdmin('/api/admin/usuarios');
    localUsuarios = Array.isArray(data.usuarios) ? data.usuarios : [];
    if (!localUsuarios.length) { tableState('usuarios-table-body',5,'Nenhum usuário encontrado.'); return; }
    target.replaceChildren();
    const current = getUser();
    for (const item of localUsuarios) {
      const row = element('tr');
      const self = (current?.id || current?._id) === item._id;
      cell(row,String(item.nome || '') + (self ? ' (Você)' : ''));
      cell(row,item.email);
      cell(row).append(element('span',item.role === 'admin' ? 'badge bg-warning text-dark':'badge bg-secondary',item.role === 'admin' ? 'Admin':'Usuário'));
      cell(row).append(element('span',item.ativo ? 'badge bg-success':'badge bg-danger',item.ativo ? 'Ativo':'Inativo'));
      const actions = actionGroup(row);
      if (self) actions.append(element('span','small text-muted','Sua conta'));
      else actions.append(button(item.ativo ? 'Desativar':'Reativar','btn btn-sm btn-outline-light',()=>alterarAcessoUsuario(item._id,Boolean(item.ativo))),button(item.role === 'admin' ? 'Tornar usuário':'Tornar admin','btn btn-sm btn-outline-light',()=>alterarRoleUsuario(item._id,item.role)));
      target.append(row);
    }
  } catch(error) { tableState('usuarios-table-body',5,'Não foi possível carregar.'); showNotice(error.message,'danger'); }
}

async function alterarAcessoUsuario(id, statusAtual) {
  const confirmMsg = statusAtual 
    ? 'Deseja desativar/banir esta conta? O usuário não conseguirá fazer login.' 
    : 'Deseja reativar esta conta?';
  if (!confirm(confirmMsg)) return;

  try {
    await fetchAdmin(`/api/admin/usuarios/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ ativo: !statusAtual })
    });
    showAlert('Acesso do usuário alterado.', 'success');
    carregarUsuarios();
  } catch (err) {
    showAlert(err.message, 'danger');
  }
}

async function alterarRoleUsuario(id, roleAtual) {
  const novaRole = roleAtual === 'admin' ? 'user' : 'admin';
  if (!confirm(`Confirmar promoção/demissão do usuário para: ${novaRole.toUpperCase()}?`)) return;

  try {
    await fetchAdmin(`/api/admin/usuarios/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ role: novaRole })
    });
    showAlert('Permissões alteradas com sucesso.', 'success');
    carregarUsuarios();
  } catch (err) {
    showAlert(err.message, 'danger');
  }
}

// ── GLOBAL LOGS / VERIFICAÇÕES ─────────────────────────────
async function carregarVerificacoes() {
  const target = tableState('verificacoes-table-body',5,'Carregando histórico global…');
  try {
    const data = await fetchAdmin('/api/admin/verificacoes');
    localVerificacoes = Array.isArray(data.verificacoes) ? data.verificacoes : [];
    if (!localVerificacoes.length) { tableState('verificacoes-table-body',5,'Nenhuma verificação encontrada.'); return; }
    target.replaceChildren();
    localVerificacoes.forEach((item,index) => {
      const row = element('tr');
      cell(row,item.userId ? String(item.userId.nome || '') + ' (' + String(item.userId.email || '') + ')' : 'Anônimo');
      const content = String(item.texto || item.link || '');
      const snippet = cell(row,content.slice(0,60) + (content.length > 60 ? '…' : ''));
      snippet.title = content;
      cell(row).append(resultBadge(item));
      cell(row,new Date(item.createdAt).toLocaleString('pt-BR'));
      actionGroup(row).append(button('Detalhes','btn btn-sm btn-outline-light',()=>verDetalhesGlobal(index)),button('Excluir','btn btn-sm btn-outline-danger',()=>excluirVerificacao(item._id)));
      target.append(row);
    });
  } catch(error) { tableState('verificacoes-table-body',5,'Não foi possível carregar.'); showNotice(error.message,'danger'); }
}

function verDetalhesGlobal(idx) {
  const item = localVerificacoes[idx];
  if (!item) return;

  const modalBody = document.getElementById('modalContent');
  if (!modalBody) return;

  renderAnalysis(modalBody,item);
  bootstrap.Modal.getOrCreateInstance(document.getElementById('resultsModal')).show();
}

async function excluirVerificacao(id) {
  if (!confirm('Deseja realmente remover esta verificação do registro global? Isso não pode ser desfeito.')) return;
  try {
    await fetchAdmin(`/api/admin/verificacoes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showAlert('Verificação removida com sucesso.', 'success');
    carregarVerificacoes();
  } catch (err) {
    showAlert(err.message, 'danger');
  }
}

// ── CHECAGEM DE AUTH NO BOOTSTRAP ──────────────────────────
async function verificarAcessoAdmin() {
  const token = getToken();
  const user = getUser();

  if (!token || !user || user.role !== 'admin') {
    showAlert('Acesso proibido. Redirecionando para a home...', 'danger');
    setTimeout(() => window.location.href = '/', 1500);
    return;
  }

  // Revela o painel e inicia carregamento
  document.getElementById('admin-main-section').style.display = 'block';
  atualizarNav();
  carregarResumo();
}

window.addEventListener('DOMContentLoaded', verificarAcessoAdmin);

// Globais para chamadas nos botões/formulários
window.switchTab = switchTab;
window.editarFonte = abrirModalFonte;
window.excluirFonte = excluirFonte;
window.editarLicao = abrirModalLicao;
window.excluirLicao = excluirLicao;
window.alterarAcessoUsuario = alterarAcessoUsuario;
window.alterarRoleUsuario = alterarRoleUsuario;
window.verDetalhesGlobal = verDetalhesGlobal;
window.excluirVerificacao = excluirVerificacao;
window.salvarFonte = salvarFonte;
window.salvarLicao = salvarLicao;
window.abrirModalFonte = () => abrirModalFonte(null);
window.abrirModalLicao = () => abrirModalLicao(null);
window.addEventListener('vf-account-updated',atualizarNav);
document.querySelectorAll('[data-admin-tab]').forEach(node=>node.addEventListener('click',()=>switchTab(node.dataset.adminTab)));
document.getElementById('formFonte').addEventListener('submit',salvarFonte);
document.getElementById('formLicao').addEventListener('submit',salvarLicao);
document.querySelector('[data-admin-action=fonte]').addEventListener('click',()=>abrirModalFonte());
document.querySelector('[data-admin-action=licao]').addEventListener('click',()=>abrirModalLicao());
