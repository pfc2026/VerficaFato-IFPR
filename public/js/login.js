import { getStoredUser } from './safe-dom.js';

        // Redireciona se já está logado
        const token = localStorage.getItem('vf-token');
        const user = getStoredUser();
        if (token && user) {
            window.location.href = user.role === 'admin' ? '/html/Admin.html' : '/';
        }

        function showTab(tab) {
            document.getElementById('panelEntrar').classList.toggle('active', tab === 'entrar');
            document.getElementById('panelCadastrar').classList.toggle('active', tab === 'cadastrar');
            document.getElementById('tabEntrar').classList.toggle('active', tab === 'entrar');
            document.getElementById('tabCadastrar').classList.toggle('active', tab === 'cadastrar');
        }

        function toggleSenha(inputId, btn) {
            const inp = document.getElementById(inputId);
            const show = inp.type === 'password';
            inp.type = show ? 'text' : 'password';
            btn.innerHTML = `<i class="fas fa-eye${show ? '-slash' : ''}"></i>`;
        }

        function mostrarMsg(id, texto, tipo) {
            const el = document.getElementById(id);
            el.textContent = texto;
            el.className = `msg-box ${tipo} show`;
        }

        function setLoadingBtn(btnId, spinId, on) {
            const btn  = document.getElementById(btnId);
            const spin = document.getElementById(spinId);
            btn.disabled = on;
            btn.querySelector('.btn-text').classList.toggle('d-none', on);
            spin.classList.toggle('d-none', !on);
        }

        async function fazerLogin() {
            const email = document.getElementById('loginEmail').value.trim();
            const senha = document.getElementById('loginSenha').value;
            if (!email || !senha) return mostrarMsg('msgEntrar', 'Preencha e-mail e senha.', 'error');

            setLoadingBtn('btnEntrar', 'spinEntrar', true);
            try {
                const res  = await fetch('/api/auth/entrar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, senha })
                });
                const data = await res.json();
                if (!data.sucesso) return mostrarMsg('msgEntrar', data.erro, 'error');

                localStorage.setItem('vf-token',   data.token);
                localStorage.setItem('vf-user',    JSON.stringify(data.usuario));
                mostrarMsg('msgEntrar', 'Login realizado! Redirecionando...', 'success');

                const destino = data.usuario.role === 'admin' ? '/html/Admin.html' : '/';
                setTimeout(() => window.location.href = destino, 800);
            } catch (e) {
                mostrarMsg('msgEntrar', 'Erro de conexão. Tente novamente.', 'error');
            } finally {
                setLoadingBtn('btnEntrar', 'spinEntrar', false);
            }
        }

        async function fazerCadastro() {
            const nome   = document.getElementById('cadNome').value.trim();
            const email  = document.getElementById('cadEmail').value.trim();
            const cidade = document.getElementById('cadCidade').value.trim();
            const senha  = document.getElementById('cadSenha').value;
            const senha2 = document.getElementById('cadSenha2').value;

            if (!nome || !email || !senha) return mostrarMsg('msgCadastrar', 'Preencha os campos obrigatórios.', 'error');
            if (senha !== senha2) return mostrarMsg('msgCadastrar', 'As senhas não coincidem.', 'error');
            if (senha.length < 12) return mostrarMsg('msgCadastrar', 'A senha deve ter pelo menos 12 caracteres.', 'error');

            setLoadingBtn('btnCadastrar', 'spinCadastrar', true);
            try {
                const res  = await fetch('/api/auth/registrar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome, email, senha, cidade })
                });
                const data = await res.json();
                if (!data.sucesso) return mostrarMsg('msgCadastrar', data.erro, 'error');

                localStorage.setItem('vf-token',   data.token);
                localStorage.setItem('vf-user',    JSON.stringify(data.usuario));
                mostrarMsg('msgCadastrar', 'Conta criada! Redirecionando...', 'success');
                setTimeout(() => window.location.href = '/', 800);
            } catch (e) {
                mostrarMsg('msgCadastrar', 'Erro de conexão. Tente novamente.', 'error');
            } finally {
                setLoadingBtn('btnCadastrar', 'spinCadastrar', false);
            }
        }

        // Permite Enter nos inputs
        document.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const isEntrar = document.getElementById('panelEntrar').classList.contains('active');
                isEntrar ? fazerLogin() : fazerCadastro();
            }
        });
    
document.querySelectorAll('[data-login-tab]').forEach(node=>node.addEventListener('click',event=>{event.preventDefault();showTab(node.dataset.loginTab);}));
document.querySelectorAll('[data-toggle-password]').forEach(node=>node.addEventListener('click',()=>toggleSenha(node.dataset.togglePassword,node)));
document.getElementById('btnEntrar').addEventListener('click',fazerLogin);
document.getElementById('btnCadastrar').addEventListener('click',fazerCadastro);
