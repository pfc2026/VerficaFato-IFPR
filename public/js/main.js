// =========================================================
//  VerificaFato — main.js
// =========================================================

const API_BASE = '';

// ── Cidades ───────────────────────────────────────────────
const WESTERN_CITIES = [
    'Assis Chateaubriand','Braganey','Cafelândia','Campo Bonito',
    'Capitão Leônidas Marques','Cascavel','Catanduvas','Céu Azul',
    'Corbélia','Diamante do Sul','Diamante d\'Oeste','Entre Rios do Oeste',
    'Foz do Iguaçu','Guaraniaçu','Guaíra','Ibema','Iguatu',
    'Itaipulândia','Jesuítas','Jussara','Lindoeste','Marechal Cândido Rondon',
    'Maripá','Matelândia','Medianeira','Mercedes','Missal',
    'Nova Aurora','Nova Santa Rosa','Ouro Verde do Oeste','Palotina',
    'Pato Bragado','Quatro Pontes','Ramilândia','Santa Helena',
    'Santa Lúcia','Santa Tereza do Oeste','Santa Terezinha de Itaipu',
    'São José das Palmeiras','São Miguel do Iguaçu','São Pedro do Iguaçu',
    'Serranópolis do Iguaçu','Terra Roxa','Toledo','Três Barras do Paraná',
    'Tupãssi','Ubiratã','Vera Cruz do Oeste'
];

const REGIONAL_SOURCES = [
    { nome: 'Rádio Colméia (Cascavel)', url: 'https://radiocolmeia.com.br' },
    { nome: 'Jornal O Paraná',          url: 'https://www.oparana.com.br' },
    { nome: 'Gazeta do Povo',           url: 'https://www.gazetadopovo.com.br' },
    { nome: 'Jornal de Toledo',         url: 'https://www.jornaldetoledo.com.br' },
    { nome: 'G1 Paraná',               url: 'https://g1.globo.com/pr' },
    { nome: 'Rádio Cultura Toledo',     url: 'https://www.radioculturatoledo.com.br' },
    { nome: 'Prefeituras Oficiais',     url: 'https://www.municipios.pr.gov.br' },
    { nome: 'TJ Paraná',               url: 'https://www.tjpr.jus.br' }
];

// ── Sinais de análise local ───────────────────────────────
const SINAIS_FALSO = [
    { regex: /URGENTE|URGENTÍSSIMO/gi,                   peso: 15, label: 'Palavra "URGENTE" em maiúsculas' },
    { regex: /BOMBA|EXPLOSIVO|CHOCANTE|IMPACTANTE/gi,    peso: 12, label: 'Linguagem sensacionalista' },
    { regex: /compartilhe antes que apaguem/gi,          peso: 20, label: 'Pedido de compartilhamento urgente' },
    { regex: /médicos odeiam|eles não querem que você/gi,peso: 18, label: 'Frase clickbait típica' },
    { regex: /[!]{2,}/g,                                 peso: 8,  label: 'Múltiplas exclamações' },
    { regex: /[?]{2,}/g,                                 peso: 6,  label: 'Múltiplos pontos de interrogação' },
    { regex: /\b[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ]{5,}\b/g,              peso: 5,  label: 'Excesso de letras maiúsculas' },
    { regex: /mídia não mostra|grande mídia esconde/gi,  peso: 15, label: 'Narrativa anti-mídia' },
    { regex: /globo não vai mostrar|censura/gi,          peso: 14, label: 'Alegação de censura' },
    { regex: /vacina(.*)(mata|veneno|chip|5g)/gi,        peso: 20, label: 'Desinformação sobre vacinas' },
    { regex: /cura (milagrosa|definitiva|secreta)/gi,    peso: 18, label: 'Cura milagrosa' },
    { regex: /confirmado por fontes/gi,                  peso: 10, label: 'Fonte vaga ("fontes confirmam")' },
    { regex: /disseram que|segundo dizem/gi,             peso: 8,  label: 'Atribuição vaga de fonte' },
    { regex: /whatsapp|zap zap/gi,                       peso: 7,  label: 'Referência a corrente de WhatsApp' },
    { regex: /repasse para todos/gi,                     peso: 12, label: 'Pedido de reenvio em massa' },
];

const SINAIS_CONFIAVEL = [
    { regex: /segundo\s+(o\s+)?(governo|prefeitura|secretaria)/gi, peso: 10, label: 'Cita órgão oficial' },
    { regex: /de acordo com (pesquisa|estudo|levantamento)/gi,      peso: 10, label: 'Referencia pesquisa/estudo' },
    { regex: /https?:\/\/[^\s]+/gi,                                 peso: 8,  label: 'Contém link como fonte' },
    { regex: /publicado em \d{1,2}\/\d{1,2}\/\d{4}/gi,            peso: 8,  label: 'Data de publicação clara' },
    { regex: /jornalista|redação|reportagem/gi,                     peso: 6,  label: 'Menciona autoria jornalística' },
    { regex: /nota oficial|comunicado|decreto/gi,                   peso: 12, label: 'Documento ou nota oficial' },
    { regex: /g1|gazeta do povo|folha|estadão|agência brasil/gi,   peso: 10, label: 'Veículo jornalístico reconhecido' },
];

// ── Análise local do texto ────────────────────────────────
function analisarTextoLocalmente(texto) {
    let pesoFalso     = 0;
    let pesoConfiavel = 0;
    const alertasFalso     = [];
    const alertasConfiavel = [];

    SINAIS_FALSO.forEach(sinal => {
        const matches = texto.match(sinal.regex);
        if (matches) {
            const ocorrencias = matches.length;
            pesoFalso += sinal.peso * Math.min(ocorrencias, 3);
            alertasFalso.push({ label: sinal.label, ocorrencias });
        }
    });

    SINAIS_CONFIAVEL.forEach(sinal => {
        const matches = texto.match(sinal.regex);
        if (matches) {
            pesoConfiavel += sinal.peso;
            alertasConfiavel.push({ label: sinal.label });
        }
    });

    // Bônus: texto longo tende a ser mais confiável
    if (texto.length > 300) pesoConfiavel += 5;
    if (texto.length > 600) pesoConfiavel += 5;

    // Penalidade: texto muito curto e alarmista
    if (texto.length < 80 && pesoFalso > 0) pesoFalso += 10;

    // Calcula porcentagem de veracidade (0–100)
    const total = pesoFalso + pesoConfiavel || 1;
    const rawScore = Math.round((pesoConfiavel / total) * 100);

    // Ajusta para escala mais intuitiva: se não tem sinais negativos, começa em 50
    let porcentagem;
    if (pesoFalso === 0 && pesoConfiavel === 0) {
        porcentagem = 50; // neutro
    } else if (pesoFalso === 0) {
        porcentagem = Math.min(50 + rawScore, 95);
    } else {
        porcentagem = Math.max(5, Math.min(rawScore, 90));
    }

    return { porcentagem, alertasFalso, alertasConfiavel, pesoFalso, pesoConfiavel };
}

// ── Cores e rótulos por porcentagem ──────────────────────
function veredicto(pct) {
    if (pct >= 70) return { cor: '#27AE60', bg: 'rgba(39,174,96,0.15)', label: 'Provavelmente Verdadeira',  icone: 'fa-circle-check',    classe: 'success' };
    if (pct >= 45) return { cor: '#F39C12', bg: 'rgba(243,156,18,0.15)', label: 'Inconclusivo / Verificar', icone: 'fa-circle-question',  classe: 'warning' };
    return             { cor: '#E74C3C', bg: 'rgba(231,76,60,0.15)',  label: 'Provavelmente Falsa',       icone: 'fa-circle-xmark',    classe: 'danger'  };
}

function ratingClass(avaliacao) {
    const v = (avaliacao || '').toLowerCase();
    if (/falso|false|enganoso|incorreto|mentira/.test(v)) return 'bg-danger';
    if (/verdadeiro|true|correto|preciso/.test(v))        return 'bg-success';
    return 'bg-warning text-dark';
}

// ── Renderiza o modal ─────────────────────────────────────
function renderResults(data, texto, cidade, categoria) {
    const cityLabel = cidade
        ? citySelectEl.options[citySelectEl.selectedIndex]?.text || cidade
        : null;

    const analise  = analisarTextoLocalmente(texto);
    const veredito = veredicto(analise.porcentagem);
    const wordCount = texto.trim().split(/\s+/).filter(Boolean).length;
    const charCount = texto.length;
    const temLink   = /https?:\/\/[^\s]+/.test(texto);
    const temData   = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(texto);

    // ── Cabeçalho de badges ───────────────────────────────
    let html = `<div class="mb-3 d-flex align-items-center gap-2 flex-wrap">`;
    if (data.encontrados) {
        html += `<span class="badge bg-success fs-6"><i class="fas fa-check-circle me-1"></i>Verificada pela API</span>
                 <span class="badge bg-secondary">${data.quantidade} resultado(s)</span>`;
    } else {
        html += `<span class="badge bg-warning text-dark fs-6"><i class="fas fa-magnifying-glass me-1"></i>Análise local aplicada</span>`;
    }
    if (cityLabel) html += `<span class="badge bg-primary"><i class="fas fa-map-pin me-1"></i>${cityLabel}</span>`;
    if (categoria) html += `<span class="badge bg-secondary">${categoria}</span>`;
    html += `</div>`;

    // ── Medidor de veracidade ─────────────────────────────
    html += `
    <div class="credibility-meter p-4 mb-3" style="background:${veredito.bg};border:1px solid ${veredito.cor}33;border-radius:16px;">
        <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
            <div>
                <div class="d-flex align-items-center gap-2 mb-1">
                    <i class="fas ${veredito.icone} fs-4" style="color:${veredito.cor}"></i>
                    <span class="fw-bold fs-5" style="color:${veredito.cor}">${veredito.label}</span>
                </div>
                <small style="opacity:0.7">Baseado em análise de padrões do texto</small>
            </div>
            <div class="text-center">
                <div class="percentage-circle" style="
                    width:90px;height:90px;border-radius:50%;
                    background:conic-gradient(${veredito.cor} ${analise.porcentagem * 3.6}deg, rgba(255,255,255,0.1) 0deg);
                    display:flex;align-items:center;justify-content:center;
                    box-shadow:0 0 0 6px ${veredito.cor}22;
                ">
                    <div style="width:66px;height:66px;border-radius:50%;background:var(--surface-solid,#16241b);
                                display:flex;flex-direction:column;align-items:center;justify-content:center;">
                        <span style="font-size:1.4rem;font-weight:800;color:${veredito.cor};line-height:1">${analise.porcentagem}%</span>
                        <span style="font-size:0.55rem;opacity:0.7;text-transform:uppercase;color:var(--text-main)">veracidade</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="progress mb-1" style="height:10px;border-radius:8px;background:rgba(255,255,255,0.1)">
            <div class="progress-bar" role="progressbar"
                 style="width:${analise.porcentagem}%;background:linear-gradient(90deg,${veredito.cor},${veredito.cor}bb);border-radius:8px;transition:width 1s ease"
                 aria-valuenow="${analise.porcentagem}" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
        <div class="d-flex justify-content-between" style="font-size:0.7rem;opacity:0.6">
            <span>Improvável</span><span>Incerto</span><span>Provável</span>
        </div>
    </div>`;

    // ── Métricas rápidas ──────────────────────────────────
    html += `
    <div class="row g-2 mb-3">
        <div class="col-6 col-md-3">
            <div class="metric-card text-center p-2" style="background:var(--card-bg,rgba(255,255,255,0.08));border:1px solid var(--border,rgba(255,255,255,0.15));border-radius:12px">
                <div style="font-size:1.3rem;font-weight:700;color:${analise.alertasFalso.length > 3 ? '#E74C3C' : '#27AE60'}">${analise.alertasFalso.length}</div>
                <div style="font-size:0.7rem;opacity:0.7">sinais de alerta</div>
            </div>
        </div>
        <div class="col-6 col-md-3">
            <div class="metric-card text-center p-2" style="background:var(--card-bg,rgba(255,255,255,0.08));border:1px solid var(--border,rgba(255,255,255,0.15));border-radius:12px">
                <div style="font-size:1.3rem;font-weight:700;color:#27AE60">${analise.alertasConfiavel.length}</div>
                <div style="font-size:0.7rem;opacity:0.7">sinais positivos</div>
            </div>
        </div>
        <div class="col-6 col-md-3">
            <div class="metric-card text-center p-2" style="background:var(--card-bg,rgba(255,255,255,0.08));border:1px solid var(--border,rgba(255,255,255,0.15));border-radius:12px">
                <div style="font-size:1.3rem;font-weight:700">${wordCount}</div>
                <div style="font-size:0.7rem;opacity:0.7">palavras</div>
            </div>
        </div>
        <div class="col-6 col-md-3">
            <div class="metric-card text-center p-2" style="background:var(--card-bg,rgba(255,255,255,0.08));border:1px solid var(--border,rgba(255,255,255,0.15));border-radius:12px">
                <div style="font-size:1.3rem;font-weight:700;color:${data.encontrados ? '#27AE60' : '#F39C12'}">${data.encontrados ? data.quantidade : '0'}</div>
                <div style="font-size:0.7rem;opacity:0.7">fact-checks API</div>
            </div>
        </div>
    </div>`;

    // ── Sinais encontrados ────────────────────────────────
    if (analise.alertasFalso.length > 0 || analise.alertasConfiavel.length > 0) {
        html += `<div class="mb-3" style="background:var(--card-bg,rgba(255,255,255,0.06));border:1px solid var(--border,rgba(255,255,255,0.12));border-radius:14px;padding:1rem">
            <h6 class="mb-3"><i class="fas fa-magnifying-glass-chart me-2"></i>Padrões encontrados no texto</h6>`;

        if (analise.alertasFalso.length > 0) {
            html += `<div class="mb-2">
                <small class="text-uppercase fw-bold" style="color:#E74C3C;letter-spacing:.05em">
                    <i class="fas fa-triangle-exclamation me-1"></i>Sinais de alerta (${analise.alertasFalso.length})
                </small>
                <div class="mt-1 d-flex flex-wrap gap-1">
                    ${analise.alertasFalso.map(a => `
                    <span class="badge" style="background:rgba(231,76,60,0.2);color:#ff7675;border:1px solid rgba(231,76,60,0.35);font-weight:500">
                        <i class="fas fa-xmark me-1"></i>${a.label}${a.ocorrencias > 1 ? ` (×${a.ocorrencias})` : ''}
                    </span>`).join('')}
                </div>
            </div>`;
        }

        if (analise.alertasConfiavel.length > 0) {
            html += `<div>
                <small class="text-uppercase fw-bold" style="color:#27AE60;letter-spacing:.05em">
                    <i class="fas fa-circle-check me-1"></i>Sinais positivos (${analise.alertasConfiavel.length})
                </small>
                <div class="mt-1 d-flex flex-wrap gap-1">
                    ${analise.alertasConfiavel.map(a => `
                    <span class="badge" style="background:rgba(39,174,96,0.2);color:#55efc4;border:1px solid rgba(39,174,96,0.35);font-weight:500">
                        <i class="fas fa-check me-1"></i>${a.label}
                    </span>`).join('')}
                </div>
            </div>`;
        }
        html += `</div>`;
    }

    // ── Características do texto ──────────────────────────
    html += `
    <div class="mb-3 p-3" style="background:var(--card-bg,rgba(255,255,255,0.06));border:1px solid var(--border,rgba(255,255,255,0.12));border-radius:14px">
        <h6 class="mb-2"><i class="fas fa-file-lines me-2"></i>Características do texto</h6>
        <div class="row g-1">
            <div class="col-6"><small>${charCount > 200 ? '✅' : '⚠️'} Tamanho: ${charCount < 80 ? 'muito curto' : charCount < 200 ? 'curto' : charCount < 600 ? 'médio' : 'longo'} (${charCount} caracteres)</small></div>
            <div class="col-6"><small>${temLink ? '✅' : '❌'} ${temLink ? 'Contém link/fonte' : 'Sem link de fonte'}</small></div>
            <div class="col-6"><small>${temData ? '✅' : '❌'} ${temData ? 'Contém data' : 'Sem data clara'}</small></div>
            <div class="col-6"><small>${analise.alertasFalso.length === 0 ? '✅' : '⚠️'} ${analise.alertasFalso.length === 0 ? 'Linguagem neutra' : 'Linguagem emocional'}</small></div>
        </div>
    </div>`;

    // ── Resultados da API (se houver) ─────────────────────
    if (data.encontrados) {
        html += `<h6 class="mb-2"><i class="fas fa-globe me-2" style="color:#27AE60"></i>Verificações externas encontradas</h6>`;
        data.resultados.forEach(r => {
            html += `
            <div class="verification-item p-3 mb-2" style="border-left:4px solid #27AE60;background:var(--card-bg,rgba(255,255,255,0.06));border-radius:0 12px 12px 0">
                <div class="d-flex justify-content-between align-items-start mb-1 gap-2 flex-wrap">
                    <h6 class="mb-0 flex-grow-1" style="font-size:0.9rem">${r.titulo_verificacao}</h6>
                    <span class="badge ${ratingClass(r.avaliacao)}">${r.avaliacao}</span>
                </div>
                <p class="mb-2" style="font-size:0.82rem;opacity:0.75">${r.texto_verificado}</p>
                <div class="d-flex flex-wrap align-items-center gap-3">
                    <small><i class="fas fa-user-check me-1" style="color:#27AE60"></i>${r.verificador}</small>
                    <small><i class="fas fa-calendar me-1" style="color:#F39C12"></i>${r.data_verificacao}</small>
                    ${r.url_verificacao && r.url_verificacao !== '#' ? `
                    <a href="${r.url_verificacao}" target="_blank" rel="noopener"
                       class="btn btn-sm ms-auto" style="background:rgba(39,174,96,0.2);color:#55efc4;border:1px solid rgba(39,174,96,0.3);font-size:0.78rem">
                        <i class="fas fa-external-link-alt me-1"></i>Ver verificação
                    </a>` : ''}
                </div>
            </div>`;
        });
    } else {
        html += `
        <div class="p-3 mb-3" style="background:rgba(243,156,18,0.1);border:1px solid rgba(243,156,18,0.3);border-radius:12px">
            <div class="d-flex gap-2 align-items-start">
                <i class="fas fa-circle-info mt-1" style="color:#F39C12"></i>
                <div>
                    <strong>Nenhuma verificação externa encontrada</strong><br>
                    <small style="opacity:0.8">A Google Fact Check API não retornou resultados para esse texto. Isso não confirma nem nega a veracidade — consulte as fontes abaixo.</small>
                </div>
            </div>
        </div>`;
    }

    // ── Fontes recomendadas ───────────────────────────────
    html += `
    <div class="p-3" style="background:var(--card-bg,rgba(255,255,255,0.06));border:1px solid var(--border,rgba(255,255,255,0.12));border-radius:14px">
        <h6 class="mb-2"><i class="fas fa-lightbulb me-2" style="color:#F39C12"></i>Fontes confiáveis para confirmar</h6>
        <div class="row g-2">
            ${REGIONAL_SOURCES.map(s => `
            <div class="col-12 col-sm-6">
                <a href="${s.url}" target="_blank" rel="noopener"
                   style="display:flex;align-items:center;gap:0.5rem;font-size:0.82rem;text-decoration:none;opacity:0.85;transition:opacity .2s"
                   onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.85">
                    <i class="fas fa-check-circle" style="color:#27AE60;flex-shrink:0"></i>${s.nome}
                    <i class="fas fa-arrow-up-right-from-square" style="font-size:0.65rem;opacity:0.5;margin-left:auto"></i>
                </a>
            </div>`).join('')}
        </div>
    </div>`;

    // ── Aviso legal ───────────────────────────────────────
    html += `
    <p class="mt-3 mb-0 text-center" style="font-size:0.72rem;opacity:0.5">
        <i class="fas fa-circle-info me-1"></i>
        A análise de padrões é automática e não substitui verificação jornalística humana.
        Sempre consulte fontes primárias antes de compartilhar.
    </p>`;

    return html;
}

// ── DOM refs ──────────────────────────────────────────────
const verificationForm = document.getElementById('verificationForm');
const newsTextEl       = document.getElementById('newsText');
const newsLinkEl       = document.getElementById('newsLink');
const citySelectEl     = document.getElementById('citySelect');
const categorySelectEl = document.getElementById('categorySelect');
const charCounterEl    = document.getElementById('charCounter');
const submitBtn        = document.getElementById('submitBtn');
const btnTextEl        = submitBtn.querySelector('.btn-text');
const spinnerEl        = submitBtn.querySelector('.loading-spinner');
const shareBtnEl       = document.getElementById('shareBtn');

// Preenche cidades
WESTERN_CITIES.sort().forEach(city => {
    const opt = document.createElement('option');
    opt.value = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-');
    opt.textContent = city;
    citySelectEl.appendChild(opt);
});

// Contador de caracteres
newsTextEl.addEventListener('input', () => {
    const len = newsTextEl.value.length;
    charCounterEl.textContent = `${len} / 2000`;
    charCounterEl.classList.toggle('text-danger', len > 1800);
});

function setLoading(on) {
    submitBtn.disabled = on;
    btnTextEl.classList.toggle('d-none', on);
    spinnerEl.classList.toggle('d-none', !on);
}

function showAlert(msg, type = 'warning') {
    const container = document.getElementById('alertContainer');
    const id = `alert-${Date.now()}`;
    container.insertAdjacentHTML('beforeend', `
        <div id="${id}" class="alert alert-${type} alert-dismissible fade show shadow" role="alert">
            <i class="fas fa-${type==='danger'?'circle-xmark':type==='success'?'circle-check':'triangle-exclamation'} me-2"></i>
            ${msg}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `);
    setTimeout(() => document.getElementById(id)?.remove(), 5000);
}

// ── Submit ────────────────────────────────────────────────
verificationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto    = newsTextEl.value.trim();
    const link     = newsLinkEl.value.trim();
    const cidade   = citySelectEl.value;
    const categoria = categorySelectEl.value;

    if (!texto && !link) { showAlert('Preencha o texto ou cole um link.', 'warning'); return; }
    if (texto && texto.length < 10) { showAlert('Texto muito curto (mínimo 10 caracteres).', 'warning'); return; }

    setLoading(true);
    try {
        const res  = await fetch(`${API_BASE}/api/verificar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texto: texto || link, cidade, categoria })
        });
        const data = await res.json();
        if (!res.ok || !data.sucesso) throw new Error(data.erro || `Erro ${res.status}`);

        document.getElementById('modalContent').innerHTML =
            renderResults(data.dados, texto || link, cidade, categoria);

        bootstrap.Modal.getOrCreateInstance(document.getElementById('resultsModal')).show();
    } catch (err) {
        console.error(err);
        showAlert(`Erro: ${err.message}`, 'danger');
    } finally {
        setLoading(false);
    }
});

// ── Compartilhar ──────────────────────────────────────────
shareBtnEl?.addEventListener('click', () => {
    const d = { title:'VerificaFato', text:'Verifiquei uma notícia no VerificaFato!', url: window.location.href };
    if (navigator.share) navigator.share(d).catch(()=>{});
    else navigator.clipboard.writeText(d.url)
        .then(()=> showAlert('Link copiado!','success'))
        .catch(()=> showAlert('Não foi possível copiar.','danger'));
});
