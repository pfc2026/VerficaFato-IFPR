/**
 * ========== SISTEMA DE DARK MODE ==========
 * Gerencia alternância entre tema claro e escuro
 * Persiste a preferência do usuário usando localStorage
 * Executa sem modificar a estrutura HTML existente
 */

class DarkModeManager {
    constructor() {
        this.STORAGE_KEY = 'theme-preference';
        this.THEME_DARK = 'dark';
        this.THEME_LIGHT = 'light';
        this.DEFAULT_THEME = 'light';
        this.HTML_ELEMENT = document.documentElement;
        this.BUTTON_ID = 'theme-toggle-btn';
        this.BUTTON_CONTAINER_ID = 'theme-toggle-container';
        
        // Inicializa o sistema
        this.init();
    }

    /**
     * Inicializa o gerenciador de dark mode
     */
    init() {
        // Carrega tema preferido ou detecta preferência do sistema
        this.loadThemePreference();
        
        // Cria botão de alternância
        this.createThemeToggleButton();
        
        // Aplica evento de detecção de mudança de preferência do sistema
        this.watchSystemThemePreference();
        
        console.log('✅ Dark Mode Manager inicializado');
    }

    /**
     * Carrega a preferência de tema salva ou detecta a preferência do sistema
     */
    loadThemePreference() {
        const savedTheme = localStorage.getItem(this.STORAGE_KEY);
        
        if (savedTheme) {
            // Usa tema salvo
            this.setTheme(savedTheme);
        } else {
            // Detecta preferência do sistema
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const systemTheme = prefersDark ? this.THEME_DARK : this.THEME_LIGHT;
            this.setTheme(systemTheme);
        }
    }

    /**
     * Define o tema e persiste a preferência
     * @param {string} theme - 'dark' ou 'light'
     */
    setTheme(theme) {
        if (theme === this.THEME_DARK) {
            this.HTML_ELEMENT.setAttribute('data-theme', this.THEME_DARK);
            document.body.setAttribute('data-theme', this.THEME_DARK);
            localStorage.setItem(this.STORAGE_KEY, this.THEME_DARK);
        } else {
            this.HTML_ELEMENT.removeAttribute('data-theme');
            document.body.removeAttribute('data-theme');
            localStorage.setItem(this.STORAGE_KEY, this.THEME_LIGHT);
        }
        
        // Atualiza ícone do botão
        this.updateToggleButton();
    }

    /**
     * Alterna entre tema escuro e claro
     */
    toggleTheme() {
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === this.THEME_DARK ? this.THEME_LIGHT : this.THEME_DARK;
        this.setTheme(newTheme);
    }

    /**
     * Retorna o tema atual
     * @returns {string} 'dark' ou 'light'
     */
    getCurrentTheme() {
        return this.HTML_ELEMENT.getAttribute('data-theme') === this.THEME_DARK 
            ? this.THEME_DARK 
            : this.THEME_LIGHT;
    }

    /**
     * Cria o botão de alternância de tema dinamicamente
     */
    createThemeToggleButton() {
        // Verifica se o container já existe
        let container = document.getElementById(this.BUTTON_CONTAINER_ID);
        
        if (!container) {
            // Cria container para o botão
            container = document.createElement('div');
            container.id = this.BUTTON_CONTAINER_ID;
            container.className = 'theme-toggle';
            
            // Insere no início do body
            document.body.insertBefore(container, document.body.firstChild);
        }
        
        // Remove botão anterior se existir
        const existingBtn = document.getElementById(this.BUTTON_ID);
        if (existingBtn) {
            existingBtn.remove();
        }
        
        // Cria novo botão
        const button = document.createElement('button');
        button.id = this.BUTTON_ID;
        button.type = 'button';
        button.className = 'btn-theme-toggle';
        button.setAttribute('aria-label', 'Alternar modo escuro/claro');
        button.setAttribute('title', 'Alternar tema');
        
        // Adiciona ícone e evento
        this.updateToggleButton();
        button.addEventListener('click', () => this.toggleTheme());
        
        // Insere o botão no container
        container.appendChild(button);
    }

    /**
     * Atualiza o ícone do botão de acordo com o tema atual
     */
    updateToggleButton() {
        const button = document.getElementById(this.BUTTON_ID);
        if (!button) return;
        
        const currentTheme = this.getCurrentTheme();
        
        if (currentTheme === this.THEME_DARK) {
            // Se estiver em dark mode, mostra ícone de sol (para voltar ao claro)
            button.innerHTML = '<i class="fas fa-sun"></i>';
            button.setAttribute('aria-label', 'Ativar modo claro');
        } else {
            // Se estiver em light mode, mostra ícone de lua (para ativar dark mode)
            button.innerHTML = '<i class="fas fa-moon"></i>';
            button.setAttribute('aria-label', 'Ativar modo escuro');
        }
    }

    /**
     * Observa mudanças na preferência do sistema
     */
    watchSystemThemePreference() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Para navegadores que suportam addEventListener
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', (e) => {
                // Só aplica se o usuário não tiver salvado preferência
                if (!localStorage.getItem(this.STORAGE_KEY)) {
                    this.setTheme(e.matches ? this.THEME_DARK : this.THEME_LIGHT);
                }
            });
        }
    }
}

/**
 * Inicializa o Dark Mode Manager quando o DOM estiver pronto
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.darkModeManager = new DarkModeManager();
    });
} else {
    // Documento já carregado
    window.darkModeManager = new DarkModeManager();
}
