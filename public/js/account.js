import { escapeHtml as escaparHtml, safeWebUrl } from './safe-dom.js';
const API_BASE = '';
function abrirModalAcaoConta(acao, usuario) {
    const id = 'accountActionModal';
    document.getElementById(id)?.remove();
    const senha = acao === 'senha';
    const conteudo = senha ? `
        <form id="accountActionForm">
            <label for="accountCurrentPassword">Senha atual</label>
            <input id="accountCurrentPassword" class="form-control" type="password" autocomplete="current-password" required>
            <label for="accountNewPassword">Nova senha</label>
            <input id="accountNewPassword" class="form-control" type="password" minlength="12" autocomplete="new-password" required>
            <label for="accountConfirmPassword">Confirmar nova senha</label>
            <input id="accountConfirmPassword" class="form-control" type="password" minlength="12" autocomplete="new-password" required>
            <button class="btn btn-verify w-100 mt-3" type="submit"><i class="fas fa-key me-2"></i>Salvar nova senha</button>
        </form>` : `
        <form id="accountActionForm">
            <label for="accountNewEmail">Novo e-mail</label>
            <input id="accountNewEmail" class="form-control" type="email" value="${escaparHtml(usuario.email)}" autocomplete="email" required>
            <label for="accountEmailPassword">Senha atual</label>
            <input id="accountEmailPassword" class="form-control" type="password" autocomplete="current-password" required>
            <small class="account-help">Você usará este e-mail no próximo acesso.</small>
            <button class="btn btn-verify w-100 mt-3" type="submit"><i class="fas fa-envelope me-2"></i>Salvar novo e-mail</button>
        </form>`;
    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="${id}" tabindex="-1" aria-labelledby="accountActionTitle" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-sm">
                <div class="modal-content glass-card account-action-modal">
                    <div class="modal-header border-0">
                        <h5 class="modal-title" id="accountActionTitle"><i class="fas ${senha ? 'fa-lock' : 'fa-envelope'} me-2"></i>${senha ? 'Mudar senha' : 'Mudar e-mail'}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
                    </div>
                    <div class="modal-body">${conteudo}<div id="accountActionMessage" class="account-message" role="status"></div></div>
                </div>
            </div>
        </div>`);
    const modalEl = document.getElementById(id);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('profileModal')).hide();
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
    const form = document.getElementById('accountActionForm');
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const payload = senha
            ? { senhaAtual: document.getElementById('accountCurrentPassword').value, novaSenha: document.getElementById('accountNewPassword').value }
            : { email: document.getElementById('accountNewEmail').value.trim(), senhaAtual: document.getElementById('accountEmailPassword').value };
        if (senha && payload.novaSenha !== document.getElementById('accountConfirmPassword').value) {
            document.getElementById('accountActionMessage').textContent = 'As novas senhas não coincidem.';
            document.getElementById('accountActionMessage').className = 'account-message error';
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/auth/${senha ? 'senha' : 'perfil'}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('vf-token')}` }, body: JSON.stringify(payload) });
            const result = await response.json();
            if (!response.ok || !result.sucesso) throw new Error(result.erro || 'Não foi possível salvar.');
            if (senha) {
                localStorage.removeItem('vf-token');
                localStorage.removeItem('vf-user');
                document.getElementById('accountActionMessage').textContent = 'Senha atualizada. Faça login novamente.';
                document.getElementById('accountActionMessage').className = 'account-message success';
                form.reset();
                setTimeout(() => window.location.assign('/html/Login.html'), 1200);
                return;
            }
            if (!senha) {
                localStorage.setItem('vf-user', JSON.stringify(result.usuario));
                window.dispatchEvent(new Event('vf-account-updated'));
            }
            document.getElementById('accountActionMessage').textContent = result.mensagem;
            document.getElementById('accountActionMessage').className = 'account-message success';
            form.reset();
        } catch (error) {
            document.getElementById('accountActionMessage').textContent = error.message;
            document.getElementById('accountActionMessage').className = 'account-message error';
        }
    });
}

// ── Modal de Perfil/Conta Dinâmico ────────────────────────
export function mostrarModalPerfil() {
    let modalEl = document.getElementById('profileModal');
    if (!modalEl) {
        const html = `
        <div class="modal fade" id="profileModal" tabindex="-1" aria-labelledby="profileModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content glass-card" style="background:var(--card-bg,rgba(25, 45, 30, 0.95)); border:1px solid var(--border,rgba(255,255,255,0.1)); border-radius:20px;">
                    <div class="modal-header border-0">
                        <h5 class="modal-title" id="profileModalLabel" style="color:var(--text-main,#fff)">
                            <i class="fas fa-id-card me-2" style="color:#27AE60"></i>Detalhes da Conta
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
                    </div>
                    <div class="modal-body" id="profileModalBody">
                        <div class="text-center py-3">
                            <div class="spinner-border text-success" role="status">
                                <span class="visually-hidden">Carregando...</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-0">
                        <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Fechar</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        modalEl = document.getElementById('profileModal');
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    const token = localStorage.getItem('vf-token');
    fetch(`${API_BASE}/api/auth/perfil`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.sucesso) {
            const u = data.usuario;
            const dataCriacao = new Date(u.createdAt).toLocaleDateString('pt-BR');
            const totalChecagens = Number(u.totalVerificacoes) || 0;
            const cityDisplay = u.cidade ? u.cidade : 'Não informada';
            
            const bodyEl = document.getElementById('profileModalBody');
            const fotoPerfil = safeWebUrl(u.fotoPerfil);
            const avatar = fotoPerfil
                ? `<img class="profile-avatar-image" src="${escaparHtml(fotoPerfil)}" alt="Foto de ${escaparHtml(u.nome)}">`
                : `<span>${escaparHtml(String(u.nome || '').charAt(0).toUpperCase())}</span>`;
            bodyEl.innerHTML = `
                <div class="profile-identity text-center mb-4">
                    <div class="avatar-circle mx-auto mb-3">${avatar}</div>
                    <h4 class="mb-1 profile-name">${escaparHtml(u.nome)}</h4>
                    <p class="profile-email mb-0">${escaparHtml(u.email)}</p>
                    <span class="badge mt-2 ${u.role === 'admin' ? 'bg-warning text-dark' : 'bg-success'}">
                        <i class="fas ${u.role === 'admin' ? 'fa-user-shield' : 'fa-user'} me-1"></i>
                        ${u.role === 'admin' ? 'Administrador' : 'Leitor / Usuário'}
                    </span>
                </div>
                <div class="profile-actions">
                    <button type="button" class="account-action-btn" data-account-action="email">
                        <i class="fas fa-envelope"></i><span><strong>Mudar e-mail</strong><small>Atualize o Gmail da conta</small></span><i class="fas fa-chevron-right"></i>
                    </button>
                    <button type="button" class="account-action-btn" data-account-action="senha">
                        <i class="fas fa-lock"></i><span><strong>Mudar senha</strong><small>Proteja sua conta com uma nova senha</small></span><i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                <div class="profile-details-list mt-4">
                    <div><span><i class="fas fa-envelope me-2"></i>E-mail</span><strong>${escaparHtml(u.email)}</strong></div>
                    <div><span><i class="fas fa-map-marker-alt me-2"></i>Cidade</span><strong>${escaparHtml(cityDisplay)}</strong></div>
                    <div><span><i class="fas fa-calendar-alt me-2"></i>Membro desde</span><strong>${dataCriacao}</strong></div>
                    <div><span><i class="fas fa-check-double me-2"></i>Verificações enviadas</span><strong>${totalChecagens}</strong></div>
                </div>
            `;
            bodyEl.querySelectorAll('[data-account-action]').forEach(button => {
                button.addEventListener('click', () => abrirModalAcaoConta(button.dataset.accountAction, u));
            });
        } else {
            document.getElementById('profileModalBody').innerHTML = `
                <div class="alert alert-danger mb-0">
                    <i class="fas fa-exclamation-triangle me-2"></i>Erro ao carregar dados do perfil: ${escaparHtml(data.erro)}
                </div>
            `;
        }
    })
    .catch(err => {
        document.getElementById('profileModalBody').innerHTML = `
            <div class="alert alert-danger mb-0">
                <i class="fas fa-exclamation-triangle me-2"></i>Erro de conexão com o servidor.
            </div>
        `;
    });
}

