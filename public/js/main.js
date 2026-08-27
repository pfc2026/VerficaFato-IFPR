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

// ── Sinais de análise local (categorizados) ───────────────
// Cada sinal tem: regex, peso, label, categoria (para agrupar na UI)
const SINAIS_FALSO = [
    // Urgência / clickbait
    { regex: /\bURGENTE\b|\bURGENTÍSSIMO\b/g,                      peso: 10, label: 'Uso de "URGENTE" em maiúsculas', categoria: 'Urgência/Clickbait' },
    { regex: /compartilhe antes que (apaguem|removam|bloqueiem)/gi, peso: 18, label: 'Pedido de compartilhamento por medo de remoção', categoria: 'Urgência/Clickbait' },
    { regex: /repasse (para todos|isso)|envie para (todos|todo mundo)/gi, peso: 14, label: 'Pedido de reenvio em massa', categoria: 'Urgência/Clickbait' },
    { regex: /médicos odeiam|eles não querem que você saiba|ninguém está te contando/gi, peso: 16, label: 'Frase clickbait típica', categoria: 'Urgência/Clickbait' },
    { regex: /você não vai (acreditar|crer)/gi,                     peso: 12, label: 'Apelo a incredulidade ("você não vai acreditar")', categoria: 'Urgência/Clickbait' },
    { regex: /\bBOMBA\b|\bEXPLOSIVO\b|\bCHOCANTE\b|\bIMPACTANTE\b|\bBOMBÁSTICO\b/g, peso: 9, label: 'Linguagem sensacionalista', categoria: 'Urgência/Clickbait' },

    // Estrutura / formatação suspeita
    { regex: /[!]{2,}/g,                                  peso: 5,  label: 'Múltiplas exclamações seguidas', categoria: 'Estrutura do texto' },
    { regex: /[?]{2,}/g,                                  peso: 4,  label: 'Múltiplos pontos de interrogação seguidos', categoria: 'Estrutura do texto' },
    { regex: /\b[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]{6,}\b/g,               peso: 3,  label: 'Trechos inteiros em maiúsculas', categoria: 'Estrutura do texto', max: 4 },
    { regex: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,  peso: 2,  label: 'Uso de emojis no corpo do texto', categoria: 'Estrutura do texto', max: 3 },

    // Atribuição de fonte vaga ou ausente
    { regex: /confirmado por fontes( seguras| internas)?\b/gi,      peso: 9,  label: 'Fonte vaga ("fontes confirmam")', categoria: 'Fonte/Atribuição' },
    { regex: /disseram que|segundo dizem|alguns dizem|é o que circula/gi, peso: 7,  label: 'Atribuição vaga, sem nome ou veículo', categoria: 'Fonte/Atribuição' },
    { regex: /recebi (esse|este|essa|esta) (vídeo|áudio|texto|mensagem) (no|pelo) (whatsapp|zap)/gi, peso: 10, label: 'Origem declarada: corrente de WhatsApp', categoria: 'Fonte/Atribuição' },
    { regex: /print( da tela)?( anexo)?\b/gi,                        peso: 6,  label: 'Baseado em print/screenshot sem link', categoria: 'Fonte/Atribuição' },

    // Narrativa de conspiração / anti-instituição
    { regex: /mídia não mostra|grande mídia esconde|mídia tradicional silencia/gi, peso: 13, label: 'Narrativa de ocultação pela "grande mídia"', categoria: 'Conspiração/Desconfiança institucional' },
    { regex: /globo não vai (mostrar|noticiar)|censura(ram|do)?\b/gi, peso: 11, label: 'Alegação de censura', categoria: 'Conspiração/Desconfiança institucional' },
    { regex: /governo (esconde|oculta|mente sobre)/gi,                peso: 10, label: 'Acusação genérica de ocultação pelo governo', categoria: 'Conspiração/Desconfiança institucional' },
    { regex: /plano (secreto|oculto) (mundial|globalista)|nova ordem mundial/gi, peso: 16, label: 'Referência a teoria conspiratória global', categoria: 'Conspiração/Desconfiança institucional' },

    // Saúde / pseudociência (peso alto: risco real de dano)
    { regex: /vacina[s]?[^.]{0,40}(mata|matam|veneno|chip|5g|magnetiza|esteriliza)/gi, peso: 22, label: 'Desinformação sobre vacinas', categoria: 'Saúde/Pseudociência' },
    { regex: /cura (milagrosa|definitiva|secreta|natural)( para| de)? (câncer|covid|diabetes)/gi, peso: 18, label: 'Promessa de cura milagrosa', categoria: 'Saúde/Pseudociência' },
    { regex: /(indústria|big) farma (esconde|não quer)/gi,            peso: 14, label: 'Narrativa contra indústria farmacêutica', categoria: 'Saúde/Pseudociência' },
    { regex: /sem comprovação científica|não aprovado pela anvisa/gi, peso: 12, label: 'Tratamento sem aprovação/comprovação citado como eficaz', categoria: 'Saúde/Pseudociência' },

    // Política / eleitoral
    { regex: /fraude (eleitoral|nas urnas)|urnas? (fraudada|manipulada)/gi, peso: 16, label: 'Alegação de fraude eleitoral sem fonte', categoria: 'Política/Eleitoral' },
    { regex: /candidato [^.]{0,40}(preso|condenado) (?!.*(segundo|fonte|processo n))/gi, peso: 10, label: 'Acusação grave sobre candidato sem citar processo/fonte', categoria: 'Política/Eleitoral' },
];

const SINAIS_CONFIAVEL = [
    // Atribuição e fontes oficiais
    { regex: /segundo\s+(o\s+|a\s+)?(governo|prefeitura|secretaria|ministério)\s+(de|do|da)?\s*[\wÀ-ú]+/gi, peso: 11, label: 'Cita órgão oficial nomeado', categoria: 'Fonte/Atribuição' },
    { regex: /de acordo com (a |o )?(pesquisa|estudo|levantamento|relatório)/gi, peso: 9,  label: 'Referencia pesquisa/estudo/relatório', categoria: 'Fonte/Atribuição' },
    { regex: /https?:\/\/[^\s]+/gi,                                   peso: 7,  label: 'Contém link verificável como fonte', categoria: 'Fonte/Atribuição' },
    { regex: /publicado em \d{1,2}\/\d{1,2}\/\d{2,4}|em \d{1,2} de \w+ de \d{4}/gi, peso: 7, label: 'Data de publicação clara', categoria: 'Estrutura do texto' },
    { regex: /por\s+[A-ZÀ-Ú][\wÀ-ú]+\s+[A-ZÀ-Ú][\wÀ-ú]+,?\s*(da redação|repórter|jornalista)/gi, peso: 8, label: 'Assinatura de jornalista identificado', categoria: 'Fonte/Atribuição' },
    { regex: /nota oficial|comunicado oficial|decreto n[ºo°]?\s*\d+/gi, peso: 12, label: 'Cita documento ou nota oficial específica', categoria: 'Fonte/Atribuição' },
    { regex: /g1|gazeta do povo|folha de s\.?\s?paulo|o\s?estad[ãa]o|agência brasil|cnn brasil|band news/gi, peso: 9, label: 'Menciona veículo jornalístico reconhecido', categoria: 'Fonte/Atribuição' },
    { regex: /segundo (a |o )?(assessoria|porta-voz)/gi,              peso: 7,  label: 'Cita assessoria/porta-voz como fonte', categoria: 'Fonte/Atribuição' },

    // Linguagem mais neutra/factual
    { regex: /em nota,? (a|o)|afirmou em entrevista|declarou à reportagem/gi, peso: 6, label: 'Inclui declaração formal de uma das partes', categoria: 'Estrutura do texto' },
    { regex: /\b\d{1,3}([.,]\d+)?\s?%|\bR\$\s?\d/gi,                  peso: 4,  label: 'Contém dados numéricos/estatísticos específicos', categoria: 'Estrutura do texto', max: 3 },
];

// ── Mapeia avaliação textual da API (textualRating) para uma nota 0-100 ──
function mapearAvaliacaoAPI(textualRating) {
    const r = (textualRating || '').toLowerCase();

    // Falso / enganoso
    if (/\b(falso|fake|false|incorreto|mentira|inverdade|fraude|fabricado)\b/.test(r)) return 5;
    if (/\b(enganoso|misleading|distorcido|fora de contexto|parcialmente falso)\b/.test(r)) return 25;
    if (/\b(exagerado|impreciso|sem evidências?( suficientes)?|não comprovado)\b/.test(r)) return 35;

    // Neutro / em apuração
    if (/\b(inconclusivo|em apuração|controverso|depende|debatido)\b/.test(r)) return 50;

    // Parcialmente verdadeiro
    if (/\b(parcialmente verdadeiro|parcialmente correto|em parte verdadeiro)\b/.test(r)) return 60;

    // Verdadeiro / correto
    if (/\b(verdadeiro|true|correto|preciso|confirmado|comprovado)\b/.test(r)) return 95;

    return null; // avaliação não reconhecida — não soma confiança automática
}

// ── Análise local do texto (sinais de padrão) ─────────────
function analisarTextoLocalmente(texto) {
    let pesoFalso     = 0;
    let pesoConfiavel = 0;
    const alertasFalso     = [];
    const alertasConfiavel = [];

    SINAIS_FALSO.forEach(sinal => {
        const matches = texto.match(sinal.regex);
        if (matches) {
            const ocorrencias = matches.length;
            const limite = sinal.max || 3;
            pesoFalso += sinal.peso * Math.min(ocorrencias, limite);
            alertasFalso.push({ label: sinal.label, ocorrencias, categoria: sinal.categoria });
        }
    });

    SINAIS_CONFIAVEL.forEach(sinal => {
        const matches = texto.match(sinal.regex);
        if (matches) {
            const ocorrencias = matches.length;
            const limite = sinal.max || 2;
            pesoConfiavel += sinal.peso * Math.min(ocorrencias, limite);
            alertasConfiavel.push({ label: sinal.label, ocorrencias, categoria: sinal.categoria });
        }
    });

    // Bônus: texto mais longo e desenvolvido tende a ser mais factual
    if (texto.length > 300) pesoConfiavel += 4;
    if (texto.length > 600) pesoConfiavel += 4;

    // Penalidade: texto muito curto carregado de sinais de alerta é mais suspeito
    if (texto.length < 80 && pesoFalso > 0) pesoFalso += 8;

    // Calcula porcentagem de veracidade (0–100) só com base nos padrões do texto
    const total = pesoFalso + pesoConfiavel;
    let porcentagemLocal;
    if (total === 0) {
        porcentagemLocal = 50; // neutro — não há sinais nem para um lado nem para outro
    } else {
        const rawScore = (pesoConfiavel / (pesoFalso + pesoConfiavel)) * 100;
        // Comprime a escala para não soar overconfident: 8 a 92
        porcentagemLocal = Math.round(Math.max(8, Math.min(74, rawScore)));
    }

    return {
        porcentagemLocal,
        alertasFalso,
        alertasConfiavel,
        pesoFalso,
        pesoConfiavel
    };
}

// ── Combina avaliação da API (quando existe) com a análise local ──
// A API é tratada como evidência forte; a análise de padrões serve
// como contexto de apoio e nunca sozinha decide um veredito extremo
// quando há fact-checks reais disponíveis.
function calcularVeredictoFinal(data, analiseLocal) {
    const notasAPI = [];
    if (data?.encontrados && Array.isArray(data.resultados)) {
        data.resultados.forEach(r => {
            const nota = mapearAvaliacaoAPI(r.avaliacao);
            if (nota !== null) notasAPI.push(nota);
        });
    }

    if (notasAPI.length > 0) {
        // Usa a pior (mais baixa) avaliação entre os fact-checks como base —
        // se QUALQUER verificador respeitável marcou como falso, isso pesa muito.
        const piorNota  = Math.min(...notasAPI);
        const mediaNota = notasAPI.reduce((a, b) => a + b, 0) / notasAPI.length;
        const notaAPIFinal = Math.round(piorNota * 0.7 + mediaNota * 0.3);

        // API domina o resultado (85%), análise local participa pouco (15%)
        // só para refinar dentro da faixa, nunca para inverter o veredito da API.
        const porcentagem = Math.round(notaAPIFinal * 0.85 + analiseLocal.porcentagemLocal * 0.15);

        return {
            porcentagem: Math.max(2, Math.min(98, porcentagem)),
            fonte: 'api',
            confianca: notasAPI.length > 1 ? 'alta' : 'média',
            explicacao: notasAPI.length > 1
                ? `${notasAPI.length} verificações de fato encontradas para este conteúdo. O veredito prioriza a avaliação mais crítica entre elas.`
                : 'Uma verificação de fato profissional foi encontrada para este conteúdo e é o principal critério do veredito.'
        };
    }

    // Sem dados da API: depende inteiramente da análise de padrões textuais,
    // que é heurística e deve ser comunicada com confiança mais baixa.
    const totalSinais = analiseLocal.alertasFalso.length + analiseLocal.alertasConfiavel.length;
    return {
        porcentagem: analiseLocal.porcentagemLocal,
        fonte: 'local',
        confianca: totalSinais >= 4 ? 'média' : 'baixa',
        explicacao: totalSinais === 0
            ? 'Nenhum fact-check externo foi encontrado e o texto não apresenta padrões claros de risco ou confiabilidade. O resultado é inconclusivo.'
            : 'Nenhum fact-check externo foi encontrado. O veredito é estimado apenas por padrões de linguagem e estrutura do texto, o que é menos confiável que uma verificação humana.'
    };
}

// ── Cores e rótulos por porcentagem ──────────────────────
function veredicto(pct) {
    if (pct >= 75) return { cor: '#27AE60', bg: 'rgba(39,174,96,0.15)', label: 'Provavelmente Verdadeira',  icone: 'fa-circle-check',    classe: 'success' };
    if (pct >= 55) return { cor: '#7DCB7A', bg: 'rgba(125,203,122,0.15)', label: 'Tende a ser verdadeira',  icone: 'fa-circle-check',    classe: 'success' };
    if (pct >= 40) return { cor: '#F39C12', bg: 'rgba(243,156,18,0.15)', label: 'Inconclusivo / Verificar', icone: 'fa-circle-question',  classe: 'warning' };
    if (pct >= 20) return { cor: '#E67E22', bg: 'rgba(230,126,34,0.15)', label: 'Tende a ser falsa',        icone: 'fa-triangle-exclamation', classe: 'warning' };
    return             { cor: '#E74C3C', bg: 'rgba(231,76,60,0.15)',  label: 'Provavelmente Falsa',       icone: 'fa-circle-xmark',    classe: 'danger'  };
}

function ratingClass(avaliacao) {
    const v = (avaliacao || '').toLowerCase();
    if (/falso|false|enganoso|incorreto|mentira|fraude/.test(v))   return 'bg-danger';
    if (/verdadeiro|true|correto|preciso|confirmado/.test(v))      return 'bg-success';
    return 'bg-warning text-dark';
}

// ── Agrupa alertas por categoria para exibição organizada ──
function agruparPorCategoria(alertas) {
    const grupos = {};
    alertas.forEach(a => {
        const cat = a.categoria || 'Outros';
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(a);
    });
    return grupos;
}

function escaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>'"]/g, caractere => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[caractere]));
}

// ── Renderiza o modal ─────────────────────────────────────
function renderResults(data, texto, cidade, categoria) {
    const cityLabel = cidade || null;
    const categoriaLabel = categoria || null;

    const analiseLocal = analisarTextoLocalmente(texto);
    const veredito       = veredicto(data.porcentagem);
    const wordCount = texto.trim().split(/\s+/).filter(Boolean).length;
    const charCount = texto.length;
    const temLink   = /https?:\/\/[^\s]+/.test(texto);
    const temData   = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(texto);

    const confiancaInfo = {
        alta:  { cor: '#27AE60', label: 'Confiança alta',  desc: 'Baseado em múltiplas verificações profissionais.' },
        média: { cor: '#F39C12', label: 'Confiança média', desc: 'Baseado em uma verificação profissional ou em vários padrões textuais.' },
        baixa: { cor: '#E67E22', label: 'Confiança baixa', desc: 'Estimativa automática, sem verificação humana disponível.' }
    }[data.confianca || 'baixa'];
    const dimensoes = data.dimensoes || {};

    // ── Cabeçalho de badges ───────────────────────────────
    let html = `<div class="mb-3 d-flex align-items-center gap-2 flex-wrap">`;
    if (data.encontrados) {
        html += `<span class="badge bg-success fs-6"><i class="fas fa-check-circle me-1"></i>Verificada pela API</span>
                 <span class="badge bg-secondary">${data.quantidade} resultado(s)</span>`;
    } else if (data.apiDisponivel === false) {
        html += `<span class="badge bg-warning text-dark fs-6"><i class="fas fa-cloud-slash me-1"></i>Google indisponível</span>
                 <span class="badge bg-secondary">Análise local aplicada</span>`;
    } else {
        html += `<span class="badge bg-warning text-dark fs-6"><i class="fas fa-magnifying-glass me-1"></i>Análise local aplicada</span>`;
    }
    html += `<span class="badge" style="background:${confiancaInfo.cor}22;color:${confiancaInfo.cor};border:1px solid ${confiancaInfo.cor}55">
                <i class="fas fa-gauge-high me-1"></i>${confiancaInfo.label}
             </span>`;
    if (cityLabel) html += `<span class="badge bg-primary"><i class="fas fa-map-pin me-1"></i>${cityLabel}</span>`;
    if (categoriaLabel) html += `<span class="badge bg-secondary">${categoriaLabel}</span>`;
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
                <small style="opacity:0.7">${data.fonte === 'api' ? 'Baseado em verificação de fato profissional' : 'Baseado em análise de padrões do texto'}</small>
            </div>
            <div class="text-center">
                <div class="percentage-circle" style="
                    width:90px;height:90px;border-radius:50%;
                    background:conic-gradient(${veredito.cor} ${data.porcentagem * 3.6}deg, rgba(255,255,255,0.1) 0deg);
                    display:flex;align-items:center;justify-content:center;
                    box-shadow:0 0 0 6px ${veredito.cor}22;
                ">
                    <div style="width:66px;height:66px;border-radius:50%;background:var(--surface-solid,#16241b);
                                display:flex;flex-direction:column;align-items:center;justify-content:center;">
                        <span style="font-size:1.4rem;font-weight:800;color:${veredito.cor};line-height:1">${data.porcentagem}%</span>
                        <span style="font-size:0.55rem;opacity:0.7;text-transform:uppercase;color:var(--text-main)">veracidade</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="progress mb-1" style="height:10px;border-radius:8px;background:rgba(255,255,255,0.1)">
            <div class="progress-bar" role="progressbar"
                 style="width:${data.porcentagem}%;background:linear-gradient(90deg,${veredito.cor},${veredito.cor}bb);border-radius:8px;transition:width 1s ease"
                 aria-valuenow="${data.porcentagem}" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
        <div class="d-flex justify-content-between mb-3" style="font-size:0.7rem;opacity:0.6">
            <span>Falsa</span><span>Incerto</span><span>Verdadeira</span>
        </div>

        <div class="d-flex gap-2 align-items-start pt-2" style="border-top:1px solid ${veredito.cor}22">
            <i class="fas fa-circle-info mt-1" style="color:${veredito.cor};font-size:0.8rem"></i>
            <small style="opacity:0.85; white-space: pre-line;">${data.explicacao}</small>
        </div>
    </div>`;

    // ── Métricas rápidas ──────────────────────────────────
    html += `
    <div class="row g-2 mb-3">
        <div class="col-6 col-md-3">
            <div class="metric-card text-center p-2" style="background:var(--card-bg,rgba(255,255,255,0.08));border:1px solid var(--border,rgba(255,255,255,0.15));border-radius:12px">
                <div style="font-size:1.3rem;font-weight:700;color:${analiseLocal.alertasFalso.length > 3 ? '#E74C3C' : '#27AE60'}">${analiseLocal.alertasFalso.length}</div>
                <div style="font-size:0.7rem;opacity:0.7">sinais de alerta</div>
            </div>
        </div>
        <div class="col-6 col-md-3">
            <div class="metric-card text-center p-2" style="background:var(--card-bg,rgba(255,255,255,0.08));border:1px solid var(--border,rgba(255,255,255,0.15));border-radius:12px">
                <div style="font-size:1.3rem;font-weight:700;color:#27AE60">${analiseLocal.alertasConfiavel.length}</div>
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

    if (dimensoes.sensacionalismo || dimensoes.fonte || dimensoes.estrutura) {
        const dimensaoCard = (icone, titulo, item, cor) => item ? `
            <div class="col-12 col-md-4">
                <div class="analysis-card h-100">
                    <div class="d-flex justify-content-between align-items-center gap-2 mb-2">
                        <span class="analysis-card-title"><i class="fas ${icone} me-2" style="color:${cor}"></i>${titulo}</span>
                        <strong style="color:${cor}">${item.pontuacao}/100</strong>
                    </div>
                    <div class="progress analysis-progress mb-2" role="progressbar" aria-label="${titulo}" aria-valuenow="${item.pontuacao}" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-bar" style="width:${item.pontuacao}%;background:${cor}"></div>
                    </div>
                    <span class="analysis-level">${item.nivel || ''}</span>
                    <small>${item.descricao || ''}</small>
                </div>
            </div>` : '';

        html += `<section class="analysis-overview mb-3" aria-labelledby="analysisTitle">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <h6 id="analysisTitle" class="mb-0"><i class="fas fa-chart-simple me-2"></i>Leitura detalhada da notícia</h6>
                <small class="analysis-disclaimer">Indicadores automáticos, não prova definitiva</small>
            </div>
            <div class="row g-2">
                ${dimensaoCard('fa-bullhorn', 'Sensacionalismo', dimensoes.sensacionalismo, '#E67E22')}
                ${dimensaoCard('fa-link', 'Qualidade da fonte', dimensoes.fonte, '#27AE60')}
                ${dimensaoCard('fa-file-lines', 'Completude do texto', dimensoes.estrutura, '#3498DB')}
            </div>
            ${dimensoes.evidencia ? `<div class="analysis-evidence mt-2"><i class="fas fa-shield-halved me-2"></i>Evidência usada: <strong>${dimensoes.evidencia.tipo}</strong>${dimensoes.evidencia.quantidade ? ` (${dimensoes.evidencia.quantidade} resultado(s))` : ''}</div>` : ''}
        </section>`;
    }

    const informacoes = dimensoes.informacoes;
    if (informacoes) {
        const listaInformacao = (icone, titulo, itens, vazio = 'Não identificado') => `
            <div class="news-info-group">
                <strong><i class="fas ${icone} me-2"></i>${titulo}</strong>
            <div class="news-info-values">${itens?.length ? itens.map(item => `<span>${escaparHtml(item)}</span>`).join('') : `<em>${vazio}</em>`}</div>
            </div>`;
        html += `<section class="news-information mb-3" aria-labelledby="newsInfoTitle">
            <h6 id="newsInfoTitle" class="mb-3"><i class="fas fa-circle-info me-2"></i>Informações extraídas do texto</h6>
            <div class="news-claim"><span>Alegação principal</span><p>${escaparHtml(informacoes.alegacaoPrincipal || 'Não identificada')}</p></div>
            <div class="news-info-grid">
                ${listaInformacao('fa-key', 'Palavras importantes', informacoes.palavrasImportantes)}
                ${listaInformacao('fa-user-tag', 'Nomes e entidades', informacoes.entidades)}
                ${listaInformacao('fa-hashtag', 'Números e valores', informacoes.numeros)}
                ${listaInformacao('fa-calendar-days', 'Datas', informacoes.datas)}
            </div>
            ${informacoes.links?.length ? `<div class="news-links mt-3"><strong><i class="fas fa-link me-2"></i>Links encontrados</strong>${informacoes.links.map(link => `<a href="${escaparHtml(link)}" target="_blank" rel="noopener noreferrer">${escaparHtml(link)}</a>`).join('')}</div>` : ''}
        </section>`;
    }

    if (data.noticia?.url) {
        html += `<section class="article-source mb-3" aria-labelledby="sourceTitle">
            <div class="d-flex gap-2 align-items-start">
                <i class="fas fa-newspaper mt-1" style="color:#74b9ff"></i>
                <div class="flex-grow-1 min-width-0">
                    <h6 id="sourceTitle" class="mb-1">Fonte enviada</h6>
                    ${data.noticia.titulo ? `<strong class="article-source-title">${escaparHtml(data.noticia.titulo)}</strong>` : ''}
                    ${data.noticia.descricao ? `<p class="article-source-description mb-2">${escaparHtml(data.noticia.descricao)}</p>` : ''}
                    <a class="article-source-url" href="${escaparHtml(data.noticia.url)}" target="_blank" rel="noopener noreferrer">${escaparHtml(data.noticia.url)}</a>
                    <small class="d-block mt-2 ${data.noticia.conteudoObtido ? 'text-success' : 'text-warning'}">
                        <i class="fas ${data.noticia.conteudoObtido ? 'fa-circle-check' : 'fa-triangle-exclamation'} me-1"></i>
                        ${data.noticia.conteudoObtido ? 'Título e conteúdo da página foram analisados.' : `O conteúdo da página não foi lido. ${data.noticia.erroConteudo || 'A análise usou o link informado.'}`}
                    </small>
                </div>
            </div>
        </section>`;
    }

    // ── Sinais encontrados (agrupados por categoria) ──────
    if (analiseLocal.alertasFalso.length > 0 || analiseLocal.alertasConfiavel.length > 0) {
        html += `<div class="mb-3" style="background:var(--card-bg,rgba(255,255,255,0.06));border:1px solid var(--border,rgba(255,255,255,0.12));border-radius:14px;padding:1rem">
            <h6 class="mb-3"><i class="fas fa-magnifying-glass-chart me-2"></i>Padrões encontrados no texto</h6>`;

        if (analiseLocal.alertasFalso.length > 0) {
            const gruposFalso = agruparPorCategoria(analiseLocal.alertasFalso);
            html += `<div class="mb-3">
                <small class="text-uppercase fw-bold" style="color:#E74C3C;letter-spacing:.05em">
                    <i class="fas fa-triangle-exclamation me-1"></i>Sinais de alerta (${analiseLocal.alertasFalso.length})
                </small>
                ${Object.entries(gruposFalso).map(([cat, itens]) => `
                <div class="mt-2">
                    <div style="font-size:0.68rem;opacity:0.6;text-transform:uppercase;letter-spacing:.03em;margin-bottom:4px">${cat}</div>
                    <div class="d-flex flex-wrap gap-1">
                        ${itens.map(a => `
                        <span class="badge" style="background:rgba(231,76,60,0.2);color:#ff7675;border:1px solid rgba(231,76,60,0.35);font-weight:500">
                            <i class="fas fa-xmark me-1"></i>${a.label}${a.ocorrencias > 1 ? ` (×${a.ocorrencias})` : ''}
                        </span>`).join('')}
                    </div>
                </div>`).join('')}
            </div>`;
        }

        if (analiseLocal.alertasConfiavel.length > 0) {
            const gruposConfiavel = agruparPorCategoria(analiseLocal.alertasConfiavel);
            html += `<div>
                <small class="text-uppercase fw-bold" style="color:#27AE60;letter-spacing:.05em">
                    <i class="fas fa-circle-check me-1"></i>Sinais positivos (${analiseLocal.alertasConfiavel.length})
                </small>
                ${Object.entries(gruposConfiavel).map(([cat, itens]) => `
                <div class="mt-2">
                    <div style="font-size:0.68rem;opacity:0.6;text-transform:uppercase;letter-spacing:.03em;margin-bottom:4px">${cat}</div>
                    <div class="d-flex flex-wrap gap-1">
                        ${itens.map(a => `
                        <span class="badge" style="background:rgba(39,174,96,0.2);color:#55efc4;border:1px solid rgba(39,174,96,0.35);font-weight:500">
                            <i class="fas fa-check me-1"></i>${a.label}${a.ocorrencias > 1 ? ` (×${a.ocorrencias})` : ''}
                        </span>`).join('')}
                    </div>
                </div>`).join('')}
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
            <div class="col-6"><small>${analiseLocal.alertasFalso.length === 0 ? '✅' : '⚠️'} ${analiseLocal.alertasFalso.length === 0 ? 'Linguagem neutra' : 'Linguagem emocional/alarmista'}</small></div>
            <div class="col-6"><small>📝 ${wordCount} palavra(s) no total</small></div>
            <div class="col-6"><small>${data.encontrados ? '🌐' : '🔍'} ${data.encontrados ? `${data.quantidade} fact-check(s) consultado(s)` : 'Nenhum fact-check externo'}</small></div>
        </div>
    </div>`;

    // ── Resultados da API (se houver) ─────────────────────
    if (data.encontrados) {
        html += `<h6 class="mb-2"><i class="fas fa-globe me-2" style="color:#27AE60"></i>Verificações externas encontradas</h6>`;
        data.resultados.forEach(r => {
            const notaAPI = mapearAvaliacaoAPI(r.avaliacao);
            const corBorda = notaAPI === null ? '#F39C12' : notaAPI < 40 ? '#E74C3C' : notaAPI < 60 ? '#F39C12' : '#27AE60';
            html += `
            <div class="verification-item p-3 mb-2" style="border-left:4px solid ${corBorda};background:var(--card-bg,rgba(255,255,255,0.06));border-radius:0 12px 12px 0">
                <div class="d-flex justify-content-between align-items-start mb-1 gap-2 flex-wrap">
                    <h6 class="mb-0 flex-grow-1" style="font-size:0.9rem">${r.titulo_verificacao}</h6>
                    <span class="badge ${ratingClass(r.avaliacao)}">${r.avaliacao}</span>
                </div>
                <p class="mb-2" style="font-size:0.82rem;opacity:0.75">${r.texto_verificado}</p>
                ${r.autor_alegacao && r.autor_alegacao !== 'Autor desconhecido' ? `
                <p class="mb-2" style="font-size:0.78rem;opacity:0.65"><i class="fas fa-quote-left me-1"></i>Alegação atribuída a: <strong>${r.autor_alegacao}</strong></p>` : ''}
                <div class="d-flex flex-wrap align-items-center gap-3">
                    <small><i class="fas fa-user-check me-1" style="color:#27AE60"></i>${r.verificador}</small>
                    <small><i class="fas fa-calendar me-1" style="color:#F39C12"></i>${r.data_verificacao}</small>
                    ${r.url_verificacao && r.url_verificacao !== '#' ? `
                    <a href="${r.url_verificacao}" target="_blank" rel="noopener"
                       class="btn btn-sm ms-auto" style="background:rgba(39,174,96,0.2);color:#55efc4;border:1px solid rgba(39,174,96,0.3);font-size:0.78rem">
                        <i class="fas fa-external-link-alt me-1"></i>Ver verificação completa
                    </a>` : ''}
                </div>
            </div>`;
        });
    } else if (data.apiDisponivel === false) {
        html += `
        <div class="p-3 mb-3" style="background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.3);border-radius:12px">
            <div class="d-flex gap-2 align-items-start">
                <i class="fas fa-cloud-slash mt-1" style="color:#E74C3C"></i>
                <div>
                    <strong>A consulta ao Google Fact Check não pôde ser concluída</strong><br>
                    <small style="opacity:0.8">${data.erroAPI || 'Verifique a configuração da API.'} O resultado acima foi calculado pela análise local e não substitui uma checagem humana.</small>
                </div>
            </div>
        </div>`;
    } else {
        html += `
        <div class="p-3 mb-3" style="background:rgba(243,156,18,0.1);border:1px solid rgba(243,156,18,0.3);border-radius:12px">
            <div class="d-flex gap-2 align-items-start">
                <i class="fas fa-circle-info mt-1" style="color:#F39C12"></i>
                <div>
                    <strong>Nenhuma verificação externa indexada encontrada</strong><br>
                    <small style="opacity:0.8">
                        A Google Fact Check API funciona como uma busca sobre artigos de fact-check
                        já publicados por veículos como Aos Fatos, Lupa e Boatos.org. Ela só retorna algo
                        se essa alegação específica já tiver sido checada e indexada — por isso, mesmo
                        boatos virais conhecidos frequentemente não aparecem nela. <strong>Não encontrar
                        resultado aqui não confirma nem nega a veracidade do conteúdo.</strong>
                        O veredito acima é uma estimativa baseada em padrões de linguagem do texto.
                        Consulte as fontes confiáveis abaixo para confirmar manualmente.
                    </small>
                    ${data.palavrasChaveUsadas ? `
                    <div class="mt-2" style="font-size:0.72rem;opacity:0.6">
                        <i class="fas fa-magnifying-glass me-1"></i>Termos pesquisados: <em>${data.palavrasChaveUsadas}</em>
                    </div>` : ''}
                </div>
            </div>
        </div>`;
    }

    // ── Recomendação prática ──────────────────────────────
    html += `
    <div class="mb-3 p-3" style="background:var(--card-bg,rgba(255,255,255,0.06));border:1px solid var(--border,rgba(255,255,255,0.12));border-radius:14px">
        <h6 class="mb-2"><i class="fas fa-list-check me-2" style="color:${veredito.cor}"></i>O que fazer com essa informação</h6>
        <small style="opacity:0.85">
            ${data.porcentagem < 40
                ? 'Os indícios apontam para conteúdo falso ou enganoso. Evite compartilhar e, se possível, sinalize a fonte original como não confiável.'
                : data.porcentagem < 55
                ? 'O resultado é inconclusivo. Antes de compartilhar, busque a mesma informação em pelo menos duas fontes jornalísticas confiáveis listadas abaixo.'
                : data.porcentagem < 75
                ? 'Os sinais favorecem a veracidade, mas vale confirmar detalhes específicos (datas, números, nomes) na fonte original antes de compartilhar.'
                : 'Os indícios apontam para conteúdo verdadeiro. Ainda assim, é uma boa prática citar a fonte original ao compartilhar.'}
        </small>
    </div>`;

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
        ${data.fonte === 'api'
            ? 'O veredito acima prioriza verificações de fato profissionais. Mesmo assim, sempre confira a verificação completa antes de tomar decisões.'
            : 'A análise de padrões é automática e não substitui verificação jornalística humana.'}
        Sempre consulte fontes primárias antes de compartilhar.
    </p>`;

    return html;
}

// ── DOM refs ──────────────────────────────────────────────
const verificationForm = document.getElementById('verificationForm');
const newsTextEl       = document.getElementById('newsText');
const newsLinkEl       = document.getElementById('newsLink');
const charCounterEl    = document.getElementById('charCounter');
const submitBtn        = document.getElementById('submitBtn');
const btnTextEl        = submitBtn.querySelector('.btn-text');
const spinnerEl        = submitBtn.querySelector('.loading-spinner');
const shareBtnEl       = document.getElementById('shareBtn');

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

    if (!texto && !link) { showAlert('Preencha o texto ou cole um link.', 'warning'); return; }
    if (texto && link) { showAlert('Preencha apenas uma área: texto ou link da notícia.', 'warning'); return; }
    if (texto && texto.length < 10) { showAlert('Texto muito curto (mínimo 10 caracteres).', 'warning'); return; }

    setLoading(true);
    try {
        const token = localStorage.getItem('vf-token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res  = await fetch(`${API_BASE}/api/verificar`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ texto, link })
        });
        const data = await res.json();
        if (!res.ok || !data.sucesso) throw new Error(data.erro || `Erro ${res.status}`);

        document.getElementById('modalContent').innerHTML =
            renderResults(data.dados, texto || link, '', '');

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

// ── Menu de Navegação Dinâmico ────────────────────────────
function atualizarNav() {
    const nav = document.querySelector('.site-nav');
    if (!nav) return;

    const token = localStorage.getItem('vf-token');
    const user = JSON.parse(localStorage.getItem('vf-user') || 'null');

    // Mapeia links padrão
    let html = `
        <a href="/#inicio" class="nav-link">Verificar</a>
    `;

    if (token && user) {
        html += `<a href="/html/Historico.html" class="nav-link">Histórico</a>`;
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

    // Configura o evento do botão de logout
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

function abrirModalAcaoConta(acao, usuario) {
    const id = 'accountActionModal';
    document.getElementById(id)?.remove();
    const senha = acao === 'senha';
    const conteudo = senha ? `
        <form id="accountActionForm">
            <label for="accountCurrentPassword">Senha atual</label>
            <input id="accountCurrentPassword" class="form-control" type="password" autocomplete="current-password" required>
            <label for="accountNewPassword">Nova senha</label>
            <input id="accountNewPassword" class="form-control" type="password" minlength="6" autocomplete="new-password" required>
            <label for="accountConfirmPassword">Confirmar nova senha</label>
            <input id="accountConfirmPassword" class="form-control" type="password" minlength="6" autocomplete="new-password" required>
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
            if (!senha) {
                localStorage.setItem('vf-user', JSON.stringify(result.usuario));
                atualizarNav();
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
function mostrarModalPerfil() {
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
            const totalChecagens = u.totalVerificacoes ?? 0;
            const cityDisplay = u.cidade ? u.cidade : 'Não informada';
            
            const bodyEl = document.getElementById('profileModalBody');
            const avatar = u.fotoPerfil
                ? `<img class="profile-avatar-image" src="${escaparHtml(u.fotoPerfil)}" alt="Foto de ${escaparHtml(u.nome)}">`
                : `<span>${escaparHtml(u.nome.charAt(0).toUpperCase())}</span>`;
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
                    <i class="fas fa-exclamation-triangle me-2"></i>Erro ao carregar dados do perfil: ${data.erro}
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

// Inicializa a navegação
document.addEventListener('DOMContentLoaded', atualizarNav);