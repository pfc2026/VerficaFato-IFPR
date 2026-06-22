// Elementos do DOM
const form = document.getElementById('verificationForm');
const newsText = document.getElementById('newsText');
const citySelect = document.getElementById('citySelect');
const categorySelect = document.getElementById('categorySelect');
const loadingSpinner = document.querySelector('.loading-spinner');
const btnText = document.querySelector('.btn-text');

// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

// Verificar tema salvo no localStorage
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

// Função para atualizar ícone do toggle
function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('i');
    if (theme === 'light') {
        icon.className = 'fas fa-sun';
    } else {
        icon.className = 'fas fa-moon';
    }
}

// Event listener para o toggle de tema
themeToggle.addEventListener('click', () => {
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

// Função para mostrar/esconder loading
function setLoadingState(isLoading) {
    loadingSpinner.style.display = isLoading ? 'inline-block' : 'none';
    btnText.style.display = isLoading ? 'none' : 'inline-block';
}

// Função para criar e mostrar o alerta
function showAlert(message, type = 'warning') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} glass-card alert-dismissible fade show`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'warning' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Inserir após o formulário
    form.parentNode.insertBefore(alertDiv, form.nextSibling);
    
    // Remover após 5 segundos
    setTimeout(() => alertDiv.remove(), 5000);
}

// Função para criar o modal de resultados
function createResultsModal() {
    const modalId = 'verificaOesteModal';
    let modal = document.getElementById(modalId);
    
    if (!modal) {
        const modalHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content glass-card">
                        <div class="modal-header border-0">
                            <h5 class="modal-title">
                                <i class="fas fa-search me-2"></i>
                                Resultado da Verificação
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="modalResults"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById(modalId);
    }
    
    return new bootstrap.Modal(modal);
}

// Handler do formulário
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const texto = newsText.value.trim();
    const cidade = citySelect.value;
    const categoria = categorySelect.value;
    
    if (!texto) {
        showAlert('Por favor, insira o texto da notícia para verificação.');
        return;
    }
    
    setLoadingState(true);
    
    try {
        // Fazer a verificação regional primeiro
        const regionalResult = await fetch('http://localhost:3000/api/verificar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                texto,
                cidade,
                categoria
            })
        });
        
        const data = await regionalResult.json();
        
        if (!data.sucesso) {
            throw new Error(data.erro || 'Erro ao verificar a notícia');
        }
        
        // Mostrar os resultados
        const modalResults = document.getElementById('modalResults');
        modalResults.innerHTML = `
            <div class="verification-results">
                <!-- Resultado Regional -->
                <div class="regional-result mb-4">
                    <div class="result-header glass-card p-3 mb-3">
                        <div class="d-flex align-items-center justify-content-between">
                            <div class="verdict-badge ${data.dados.encontrados ? 'verdadeira-verdict' : 'inconclusivo-verdict'}">
                                <i class="fas fa-check-circle me-2"></i>
                                ${data.dados.encontrados ? 'VERIFICADO' : 'EM ANÁLISE'}
                                ${cidade ? `<span class="region-badge">${citySelect.options[citySelect.selectedIndex].text}</span>` : ''}
                            </div>
                            <div class="found-info">
                                ${data.dados.encontrados ? 
                                    `<span class="badge bg-primary">${data.dados.quantidade} verificação(ões)</span>` : 
                                    '<span class="badge bg-warning">Sem verificações</span>'}
                            </div>
                        </div>
                    </div>

                    ${data.dados.encontrados ? `
                        <!-- Lista de Verificações -->
                        <div class="verifications-list">
                            ${data.dados.resultados.map(result => `
                                <div class="verification-item glass-card p-3 mb-3">
                                    <div class="d-flex justify-content-between align-items-start mb-2">
                                        <h6 class="mb-0">${result.titulo_verificacao}</h6>
                                        <span class="badge bg-${result.avaliacao.toLowerCase().includes('fals') ? 'danger' : 
                                                                result.avaliacao.toLowerCase().includes('verdad') ? 'success' : 'warning'}">
                                            ${result.avaliacao}
                                        </span>
                                    </div>
                                    
                                    <p class="text-muted small mb-3">${result.texto_verificado}</p>
                                    
                                    <div class="verification-meta d-flex flex-wrap align-items-center">
                                        <div class="me-3 mb-2">
                                            <i class="fas fa-user-check me-1"></i>
                                            <small>${result.verificador}</small>
                                        </div>
                                        <div class="me-3 mb-2">
                                            <i class="fas fa-calendar me-1"></i>
                                            <small>${result.data_verificacao}</small>
                                        </div>
                                        ${result.url_verificacao ? `
                                            <a href="${result.url_verificacao}" 
                                               target="_blank" 
                                               class="btn btn-sm btn-outline-primary ms-auto">
                                                <i class="fas fa-external-link-alt me-1"></i>
                                                Ver verificação completa
                                            </a>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="alert alert-info glass-card">
                            <div class="d-flex align-items-center mb-2">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Nenhuma verificação encontrada ainda</strong>
                            </div>
                            <p class="mb-0">
                                Não encontramos verificações para esta notícia no momento. 
                                Sugerimos:
                            </p>
                            <ul class="mb-0 mt-2">
                                <li>Verificar em fontes oficiais da região</li>
                                <li>Consultar os veículos de comunicação locais</li>
                                <li>Aguardar possíveis verificações futuras</li>
                            </ul>
                        </div>
                    `}

                    <!-- Dicas Regionais -->
                    <div class="regional-tips glass-card p-3 mt-3">
                        <h6 class="mb-3">
                            <i class="fas fa-lightbulb me-2"></i>
                            Fontes Confiáveis da Região
                        </h6>
                        <div class="row g-2">
                            ${REGIONAL_SOURCES.slice(0, 4).map(source => `
                                <div class="col-md-6">
                                    <div class="source-item">
                                        <i class="fas fa-check-circle me-2 text-success"></i>
                                        ${source}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Mostrar o modal
        const modal = createResultsModal();
        modal.show();
        
    } catch (error) {
        showAlert(error.message, 'danger');
    } finally {
        setLoadingState(false);
    }
});