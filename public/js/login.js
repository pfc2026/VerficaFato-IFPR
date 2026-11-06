export function validateNewPassword(senha, confirmation) {
  if (senha.length < 12) return 'A senha deve ter pelo menos 12 caracteres.';
  if (new TextEncoder().encode(senha).length > 72) return 'A senha deve ter no máximo 72 bytes. Letras acentuadas e emojis podem ocupar mais de um byte.';
  if (senha !== confirmation) return 'As senhas não coincidem.';
  return '';
}

export function initLogin({ doc = document, win = window, fetchImpl = globalThis.fetch } = {}) {
  if (!doc.getElementById('panelEntrar')) return;
  const get = id => doc.getElementById(id);
  const storage = win.localStorage;
  let resetToken = new URL(win.location.href).searchParams.get('reset') || '';
  if (resetToken) win.history.replaceState(null, '', win.location.pathname);
  let storedUser;
  try { storedUser = JSON.parse(storage.getItem('vf-user') || 'null'); } catch { /* Ignore an invalid local session. */ }
  if (!resetToken && storage.getItem('vf-token') && storedUser) {
    win.location.href = storedUser.role === 'admin' ? '/html/Admin.html' : '/';
  }

  const panels = { entrar: 'Entrar', cadastrar: 'Cadastrar', recuperar: 'Recuperar', redefinir: 'Redefinir' };
  function showTab(tab) {
    if (!panels[tab]) return;
    for (const [key, suffix] of Object.entries(panels)) get('panel' + suffix).classList.toggle('active', key === tab);
    get('tabEntrar').classList.toggle('active', tab === 'entrar');
    get('tabCadastrar').classList.toggle('active', tab === 'cadastrar');
    get('panel' + panels[tab]).querySelector('input')?.focus();
  }
  function message(panel, value, type = 'error') {
    const target = get('msg' + panel);
    target.textContent = value;
    target.className = 'msg-box ' + type + ' show';
    target.setAttribute('role', 'status');
  }
  function loading(panel, value) {
    get('btn' + panel).disabled = value;
    get('btn' + panel).querySelector('.btn-text').classList.toggle('d-none', value);
    get('spin' + panel).classList.toggle('d-none', !value);
    get('panel' + panel).setAttribute('aria-busy', String(value));
  }
  async function send(panel, path, body, onSuccess) {
    if (get('btn' + panel).disabled) return;
    loading(panel, true);
    try {
      const response = await fetchImpl('/api/auth/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok || !data.sucesso) return message(panel, data.erro || 'Não foi possível concluir. Tente novamente.');
      onSuccess(data);
    } catch { message(panel, 'Erro de conexão. Tente novamente.'); }
    finally { loading(panel, false); }
  }
  function saveSession(data) {
    storage.setItem('vf-token', data.token);
    storage.setItem('vf-user', JSON.stringify(data.usuario));
  }
  function validEmail(id, panel) {
    if (!get(id).value.trim() || !get(id).checkValidity()) { message(panel, 'Informe um e-mail válido.'); get(id).focus(); return false; }
    return true;
  }
  const actions = {
    Entrar() {
      if (!validEmail('loginEmail', 'Entrar')) return;
      const senha = get('loginSenha').value;
      if (!senha) return message('Entrar', 'Preencha e-mail e senha.');
      return send('Entrar', 'entrar', { email: get('loginEmail').value.trim(), senha }, data => {
        saveSession(data);
        message('Entrar', 'Login realizado! Redirecionando...', 'success');
        win.setTimeout(() => { win.location.href = data.usuario.role === 'admin' ? '/html/Admin.html' : '/'; }, 800);
      });
    },
    Cadastrar() {
      const nome = get('cadNome').value.trim();
      if (!nome) return message('Cadastrar', 'Preencha os campos obrigatórios.');
      if (!validEmail('cadEmail', 'Cadastrar')) return;
      const senha = get('cadSenha').value;
      const error = validateNewPassword(senha, get('cadSenha2').value);
      if (error) return message('Cadastrar', error);
      return send('Cadastrar', 'registrar', { nome, email: get('cadEmail').value.trim(), cidade: get('cadCidade').value.trim(), senha }, data => {
        saveSession(data);
        message('Cadastrar', 'Conta criada! Redirecionando...', 'success');
        win.setTimeout(() => { win.location.href = '/'; }, 800);
      });
    },
    Recuperar() {
      if (!validEmail('recEmail', 'Recuperar')) return;
      return send('Recuperar', 'recuperar-senha', { email: get('recEmail').value.trim() }, () => {
        message('Recuperar', 'Se houver uma conta com esse e-mail, enviaremos um link para redefinir a senha. Confira também a caixa de spam.', 'success');
      });
    },
    Redefinir() {
      if (!resetToken) return message('Redefinir', 'O link é inválido. Solicite outro link de recuperação.');
      const senha = get('resetSenha').value;
      const error = validateNewPassword(senha, get('resetSenha2').value);
      if (error) return message('Redefinir', error);
      return send('Redefinir', 'redefinir-senha', { token: resetToken, senha }, () => {
        resetToken = '';
        storage.removeItem('vf-token'); storage.removeItem('vf-user');
        get('resetSenha').value = ''; get('resetSenha2').value = '';
        showTab('entrar');
        message('Entrar', 'Senha redefinida. Entre com a nova senha.', 'success');
      });
    }
  };
  doc.querySelectorAll('[data-login-tab]').forEach(node => node.addEventListener('click', event => { event.preventDefault(); showTab(node.dataset.loginTab); }));
  doc.querySelectorAll('[data-toggle-password]').forEach(node => node.addEventListener('click', () => {
    const input = get(node.dataset.togglePassword);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    node.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    node.setAttribute('aria-pressed', String(show));
    node.querySelector('i').className = 'fas fa-eye' + (show ? '-slash' : '');
  }));
  for (const panel of Object.values(panels)) {
    get('btn' + panel).addEventListener('click', actions[panel]);
    get('panel' + panel).addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target.tagName === 'INPUT') { event.preventDefault(); actions[panel](); }
    });
  }
  if (resetToken) showTab('redefinir');
  return { showTab, actions };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') initLogin();
