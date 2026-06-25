// =========================================================
//  VerificaFato — dark-mode.js
// =========================================================

class DarkModeManager {
    constructor() {
        this.KEY        = 'vf-theme';
        this.DARK       = 'dark';
        this.LIGHT      = 'light';
        this.HTML       = document.documentElement;
        this.BTN_ID     = 'theme-toggle-btn';
        this.WRAP_ID    = 'theme-toggle-container';
        this.init();
    }

    init() {
        this._applyTheme(this._savedTheme());
        this._createButton();
        this._watchSystem();
    }

    _savedTheme() {
        return localStorage.getItem(this.KEY)
            || (window.matchMedia('(prefers-color-scheme: dark)').matches ? this.DARK : this.LIGHT);
    }

    _applyTheme(theme) {
        if (theme === this.DARK) {
            this.HTML.setAttribute('data-theme', this.DARK);
        } else {
            this.HTML.removeAttribute('data-theme');
        }
        localStorage.setItem(this.KEY, theme);
        this._updateIcon();
    }

    toggle() {
        this._applyTheme(
            this.HTML.getAttribute('data-theme') === this.DARK ? this.LIGHT : this.DARK
        );
    }

    getCurrentTheme() {
        return this.HTML.getAttribute('data-theme') === this.DARK ? this.DARK : this.LIGHT;
    }

    _createButton() {
        // Injeta no container já existente no header
        const wrap = document.getElementById(this.WRAP_ID);
        if (!wrap) return;

        const btn = document.createElement('button');
        btn.id        = this.BTN_ID;
        btn.type      = 'button';
        btn.className = 'btn-theme-toggle';
        btn.setAttribute('aria-label', 'Alternar tema');
        btn.addEventListener('click', () => this.toggle());
        wrap.appendChild(btn);
        this._updateIcon();
    }

    _updateIcon() {
        const btn = document.getElementById(this.BTN_ID);
        if (!btn) return;
        const isDark = this.getCurrentTheme() === this.DARK;
        btn.innerHTML = isDark
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';
        btn.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
    }

    _watchSystem() {
        window.matchMedia('(prefers-color-scheme: dark)')
            .addEventListener?.('change', (e) => {
                if (!localStorage.getItem(this.KEY)) {
                    this._applyTheme(e.matches ? this.DARK : this.LIGHT);
                }
            });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.darkModeManager = new DarkModeManager(); });
} else {
    window.darkModeManager = new DarkModeManager();
}
