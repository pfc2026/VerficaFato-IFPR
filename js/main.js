// Configurações da API
const API_CONFIG = {
    baseURL: 'http://localhost:3000',
    endpoints: {
        verify: '/api/verificar'
    }
};

// Elementos do DOM
const verificationForm = document.getElementById('verificationForm');
const newsText = document.getElementById('newsText');
const citySelect = document.getElementById('citySelect');
const categorySelect = document.getElementById('categorySelect');
const loadingSpinner = document.querySelector('.loading-spinner');
const btnText = document.querySelector('.btn-text');

// Municípios do Oeste do Paraná
const WESTERN_CITIES = [
    'Cascavel', 'Foz do Iguaçu', 'Toledo', 'Marechal Cândido Rondon', 
    'Medianeira', 'Laranjeiras do Sul', 'Francisco Beltrão', 'Pato Branco',
    'Matelândia', 'Santa Tereza do Oeste', 'Santa Terezinha de Itaipu'
    // ... adicione mais 43 municípios
];

// Fontes regionais confiáveis
const REGIONAL_SOURCES = [
    'Rádio Colméia',
    'Cascavel News', 
    'Jornal O Paraná',
    'Rádio Clube',
    'Tribuna do Paraná',
    'Gazeta do Povo - Regional',
    'Rádio Cultura',
    'Jornal de Toledo'
];

// Simulação de verificação regional
async function simulateRegionalVerification(text, city, category) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Lógica específica para a região
            const regionalIndicators = {
                fake: ['prefeitura de ' + city, 'câmara municipal', 'urgente região', 'compartilhe cascavel'],
                true: ['secretaria de saúde', 'detran regional', 'universidade estadual']
            };
            
            const hasFakeIndicators = regionalIndicators.fake.some(indicator => 
                text.toLowerCase().includes(indicator)
            );
            
            const hasTrueIndicators = regionalIndicators.true.some(indicator =>
                text.toLowerCase().includes(indicator)
            );
            
            let verdict, confidence, explanation;
            
            if (hasFakeIndicators && !hasTrueIndicators) {
                verdict = 'FALSA';
                confidence = 88;
                explanation = `Notícia sobre ${city} apresenta padrões comuns de desinformação regional.`;
            } else if (hasTrueIndicators) {
                verdict = 'VERDADEIRA';
                confidence = 92;
                explanation = `Informação condiz com fontes oficiais da região de ${city}.`;
            } else {
                verdict = 'INCONCLUSIVO';
                confidence = 65;
                explanation = `Recomenda-se verificar em fontes oficiais de ${city}.`;
            }
            
            const result = {
                id: Date.now(),
                text: text.substring(0, 100) + '...',
                verdict: verdict,
                confidence: confidence,
                city: city,
                category: category,
                sources: getRegionalSources(city),
                explanation: explanation,
                regionalTips: getRegionalTips(city),
                timestamp: new Date().toISOString()
            };
            
            resolve(result);
        }, 2000);
    });
}

// Obter fontes específicas da cidade
function getRegionalSources(city) {
    const citySources = {
        'cascavel': ['Rádio Colméia', 'Cascavel News', 'Jornal O Paraná'],
        'foz-do-iguacu': ['Rádio Clube', 'Jornal de Foz', 'Tribuna do Paraná'],
        'toledo': ['Jornal de Toledo', 'Rádio Cultura Toledo'],
        'marechal': ['Rádio Difusora', 'Jornal O Presente']
    };
    
    return citySources[city] || ['Fontes Regionais', 'Veículos Locais'];
}

// Dicas específicas por cidade
function getRegionalTips(city) {
    const tips = {
        'cascavel': 'Verifique no site da Prefeitura de Cascavel',
        'foz-do-iguacu': 'Consulte o portal da Itaipu Binacional',
        'toledo': 'Confirme na Câmara Municipal de Toledo',
        'marechal': 'Veja no site da Prefeitura de Marechal'
    };
    
    return tips[city] || 'Consulte fontes oficiais do município';
}

// Função para mostrar/esconder o loading
function setLoadingState(isLoading) {
    if (isLoading) {
        loadingSpinner.style.display = 'inline-block';
        btnText.style.display = 'none';
    } else {
        loadingSpinner.style.display = 'none';
        btnText.style.display = 'inline-block';
    }
}

// Criar o modal de resultados se não existir
function createResultsModal() {
    if (!document.getElementById('resultsModal')) {
        const modalHTML = `
            <div class="modal fade" id="resultsModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content glass-card">
                        <div class="modal-header border-0">
                            <h5 class="modal-title">
                                <i class="fas fa-check-double me-2"></i>
                                Verificação Regional
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="modalContent">
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    return new bootstrap.Modal(document.getElementById('resultsModal'));
}

// Atualizar o manipulador do formulário
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const texto = newsText.value.trim();
    const selectedCity = citySelect.value;
    const selectedCategory = categorySelect.value;
    
    if (!texto) {
        showAlert('Por favor, insira o texto da notícia para verificação.', 'warning');
        return;
    }
    
    setLoadingState(true);
    
    try {
        // Fazer requisição para o backend
        const response = await fetch(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.verify}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                texto,
                cidade: selectedCity,
                categoria: selectedCategory
            })
        });
        
        const data = await response.json();
        
        if (!data.sucesso) {
            throw new Error(data.erro || 'Erro ao verificar a notícia');
        }

        // Combinar resultados da API com verificação regional
        const regionalResult = await simulateRegionalVerification(texto, selectedCity, selectedCategory);
        
        // Preparar o conteúdo do modal
        const modalContent = document.getElementById('modalContent');
        const resultsHTML = `
            <div class="verification-results">
                <!-- Resultado Regional -->
                <div class="regional-result mb-4">
                    <div class="result-header d-flex align-items-center mb-3">
                        <div class="verdict-badge ${regionalResult.verdict.toLowerCase()}-verdict">
                            ${regionalResult.verdict}
                            ${selectedCity ? `<span class="region-badge">${citySelect.options[citySelect.selectedIndex].text}</span>` : ''}
                        </div>
                        <div class="confidence-meter ms-auto">
                            <i class="fas fa-chart-bar me-2"></i>${regionalResult.confidence}% confiança
                        </div>
                    </div>
                    
                    <div class="result-explanation glass-card p-3 mb-3">
                        <h6><i class="fas fa-info-circle me-2"></i>Análise Regional:</h6>
                        <p class="mb-0">${regionalResult.explanation}</p>
                    </div>

                    <div class="regional-sources glass-card p-3">
                        <h6><i class="fas fa-newspaper me-2"></i>Fontes Locais:</h6>
                        <ul class="list-unstyled mb-0">
                            ${regionalResult.sources.map(source => `
                                <li><i class="fas fa-check-circle me-2 text-success"></i>${source}</li>
                            `).join('')}
                        </ul>
                    </div>
                </div>

                <!-- Verificações Google -->
                <div class="google-verifications mt-4">
                    <h6 class="section-title">
                        <i class="fab fa-google me-2"></i>
                        Verificações Encontradas
                    </h6>

                    ${!data.dados.encontrados ? `
                        <div class="alert alert-info glass-card">
                            <i class="fas fa-info-circle me-2"></i>
                            Não encontramos verificações externas para esta notícia no momento.
                            <hr>
                            <small>Dica: Continue monitorando, pois novas verificações podem surgir.</small>
                        </div>
                    ` : `
                        <div class="verifications-list">
                            ${data.dados.resultados.map(result => `
                                <div class="verification-item glass-card p-3 mb-3">
                                    <div class="d-flex justify-content-between align-items-start mb-2">
                                        <h6 class="mb-0">${result.titulo_verificacao}</h6>
                                        <span class="badge bg-primary">${result.avaliacao}</span>
                                    </div>
                                    <p class="text-muted small mb-2">${result.texto_verificado}</p>
                                    <div class="verification-meta d-flex align-items-center">
                                        <small class="me-3">
                                            <i class="fas fa-user-check me-1"></i>
                                            ${result.verificador}
                                        </small>
                                        <small>
                                            <i class="fas fa-calendar me-1"></i>
                                            ${result.data_verificacao}
                                        </small>
                                        ${result.url_verificacao ? `
                                            <a href="${result.url_verificacao}" 
                                               target="_blank" 
                                               class="btn btn-sm btn-outline-primary ms-auto">
                                                Ver verificação completa
                                            </a>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;

        modalContent.innerHTML = resultsHTML;
        
        // Mostrar o modal
        const modal = createResultsModal();
        modal.show();
        
    } catch (error) {
        console.error('Erro na verificação:', error);
        showAlert('Erro ao verificar notícia. Tente novamente.', 'error');
    } finally {
        setLoadingState(false);
    }
}

// Mostrar resultados combinados (API Google + Regional)
function showCombinedResults(googleData, regionalResult) {
    const resultHTML = `
        <div class="modal fade" id="resultModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-map-marker-alt me-2"></i>
                            Verificação - ${regionalResult.city || 'Região Oeste'}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Análise Regional -->
                        <div class="regional-analysis mb-4">
                            <h6 class="border-bottom pb-2">
                                <i class="fas fa-map me-2"></i>Análise Regional
                            </h6>
                            <div class="text-center my-3">
                                <div class="verdict-badge ${regionalResult.verdict === 'FALSA' ? 'badge-false' : regionalResult.verdict === 'VERDADEIRA' ? 'badge-true' : 'badge-inconclusive'}">
                                    ${regionalResult.verdict}
                                    <span class="region-badge">${regionalResult.city || 'Oeste PR'}</span>
                                </div>
                            </div>
                            <p>${regionalResult.explanation}</p>
                            
                            <div class="regional-tips p-3 bg-light rounded">
                                <h6><i class="fas fa-lightbulb me-2"></i>Fontes Locais Recomendadas:</h6>
                                <ul class="mb-0">
                                    ${regionalResult.sources.map(source => `<li>${source}</li>`).join('')}
                                </ul>
                            </div>
                        </div>

                        <!-- Verificações do Google -->
                        <div class="google-analysis mt-4">
                            <h6 class="border-bottom pb-2">
                                <i class="fab fa-google me-2"></i>Verificações Encontradas
                            </h6>
                            
                            ${!googleData.encontrados ? `
                                <div class="alert alert-info">
                                    <i class="fas fa-info-circle me-2"></i>
                                    Nenhuma verificação externa encontrada para esta notícia.
                                </div>
                            ` : `
                                <div class="verification-list">
                                    ${googleData.resultados.map(result => `
                                        <div class="verification-item p-3 border-bottom">
                                            <h6>${result.titulo_verificacao}</h6>
                                            <div class="d-flex justify-content-between align-items-center mb-2">
                                                <span class="badge bg-primary">${result.avaliacao}</span>
                                                <small class="text-muted">
                                                    <i class="fas fa-calendar me-1"></i>
                                                    ${result.data_verificacao}
                                                </small>
                                            </div>
                                            <p class="text-muted small">${result.texto_verificado}</p>
                                            <div class="d-flex justify-content-between align-items-center">
                                                <small>
                                                    <i class="fas fa-user-check me-1"></i>
                                                    ${result.verificador}
                                                </small>
                                                ${result.url_verificacao ? `
                                                    <a href="${result.url_verificacao}" 
                                                       target="_blank" 
                                                       class="btn btn-sm btn-outline-primary">
                                                        Ver verificação
                                                    </a>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            `}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                        <button type="button" class="btn btn-primary" onclick="shareRegionalResult('${regionalResult.city}')">
                            <i class="fas fa-share me-2"></i>Compartilhar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', resultHTML);
    const modal = new bootstrap.Modal(document.getElementById('resultModal'));
    modal.show();
    elements.newsText.value = '';
}

// Compartilhar resultado regional
function shareRegionalResult(city) {
    const shareText = `Verifiquei uma notícia de ${city || 'Oeste do Paraná'} no VerificaOeste!`;
    
    if (navigator.share) {
        navigator.share({
            title: 'VerificaOeste - Notícias do Oeste do Paraná',
            text: shareText,
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(shareText + ' ' + window.location.href);
        showAlert('Informações copiadas para a área de transferência!', 'success');
    }
}

// CSS adicional para versão regional
const regionalCSS = `
    .badge-inconclusive {
        background: linear-gradient(135deg, var(--warning), #E67E22);
        color: white;
    }
    
    .regional-tips {
        border-left: 4px solid var(--secondary);
    }
`;

// Adicionar CSS regional
const regionalStyle = document.createElement('style');
regionalStyle.textContent = regionalCSS;
document.head.appendChild(regionalStyle);