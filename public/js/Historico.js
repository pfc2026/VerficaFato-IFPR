// Historico.js — VerificaFato

let itemsHistorico = [];

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

// ── Atualizar menu de navegação ──────────────────────────
function atualizarNav() {
  const nav = document.getElementById('siteNav');
  if (!nav) return;

  const token = getToken();
  const user = getUser();

  let html = `
    <a href="/#inicio" class="nav-link">Verificar</a>
  `;

  if (token && user) {
    html += `<a href="/Historico.html" class="nav-link active">Histórico</a>`;
    if (user.role === 'admin') {
      html += `<a href="/Admin.html" class="nav-link fw-bold text-warning">Painel Admin</a>`;
    }
    html += `
      <a href="#" id="profileBtn" class="nav-link text-success fw-semibold" style="margin-left: 10px;"><i class="fas fa-user-circle me-1"></i>Minha Conta</a>
      <a href="#" id="logoutBtn" class="nav-link text-danger"><i class="fas fa-sign-out-alt"></i> Sair</a>
    `;
  } else {
    html += `<a href="/Login.html" class="nav-link fw-bold text-success"><i class="fas fa-sign-in-alt me-1"></i> Entrar</a>`;
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

  const token = getToken();
  fetch('/api/auth/me', {
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
          bodyEl.innerHTML = `
              <div class="text-center mb-4">
                  <div class="avatar-circle mx-auto mb-3" style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #27AE60, #11998e); display: flex; align-items: center; justify-content: center; color: white; font-size: 2.2rem; font-weight: bold; box-shadow: 0 4px 15px rgba(39,174,96,0.3)">
                      ${u.nome.charAt(0).toUpperCase()}
                  </div>
                  <h4 class="mb-1" style="color:var(--text-main,#fff); font-weight:700;">${u.nome}</h4>
                  <span class="badge ${u.role === 'admin' ? 'bg-warning text-dark' : 'bg-success'}" style="font-size: 0.8rem; padding: 0.4em 0.8em; border-radius: 8px;">
                      <i class="fas ${u.role === 'admin' ? 'fa-user-shield' : 'fa-user'} me-1"></i>
                      ${u.role === 'admin' ? 'Administrador' : 'Leitor / Usuário'}
                  </span>
              </div>
              
              <div class="profile-details-list" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 1.25rem; text-align: left;">
                  <div class="mb-3 d-flex justify-content-between align-items-center" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                      <span class="text-muted small"><i class="fas fa-envelope me-2"></i>E-mail</span>
                      <strong style="color:var(--text-main,#fff); font-size:0.9rem;">${u.email}</strong>
                  </div>
                  <div class="mb-3 d-flex justify-content-between align-items-center" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                      <span class="text-muted small"><i class="fas fa-map-marker-alt me-2"></i>Cidade</span>
                      <strong style="color:var(--text-main,#fff); font-size:0.9rem;">${cityDisplay}</strong>
                  </div>
                  <div class="mb-3 d-flex justify-content-between align-items-center" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                      <span class="text-muted small"><i class="fas fa-calendar-alt me-2"></i>Membro desde</span>
                      <strong style="color:var(--text-main,#fff); font-size:0.9rem;">${dataCriacao}</strong>
                  </div>
                  <div class="d-flex justify-content-between align-items-center">
                      <span class="text-muted small"><i class="fas fa-check-double me-2"></i>Verificações enviadas</span>
                      <span class="badge bg-primary" style="font-size:0.9rem; padding: 0.35em 0.7em; font-weight:700;">${totalChecagens}</span>
                  </div>
              </div>
          `;
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

// ── Exibir alertas na tela ──────────────────────────────
function showAlert(msg, type = 'warning') {
  const container = document.getElementById('alertContainer');
  const id = `alert-${Date.now()}`;
  container.insertAdjacentHTML('beforeend', `
    <div id="${id}" class="alert alert-${type} alert-dismissible fade show shadow" role="alert">
      <i class="fas fa-${type === 'danger' ? 'circle-xmark' : type === 'success' ? 'circle-check' : 'triangle-exclamation'} me-2"></i>
      ${msg}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `);
  setTimeout(() => document.getElementById(id)?.remove(), 5000);
}

// ── Cores e ícones por porcentagem ──────────────────────
function obterInfoVeredicto(pct, labelOriginal) {
  const label = labelOriginal || (
    pct >= 75 ? 'Provavelmente Verdadeira' :
    pct >= 55 ? 'Tende a ser verdadeira' :
    pct >= 40 ? 'Inconclusivo / Verificar' :
    pct >= 20 ? 'Tende a ser falsa' : 'Provavelmente Falsa'
  );

  if (pct >= 75) return { cor: '#27AE60', bg: 'rgba(39,174,96,0.15)', label, icone: 'fa-circle-check' };
  if (pct >= 55) return { cor: '#7DCB7A', bg: 'rgba(125,203,122,0.15)', label, icone: 'fa-circle-check' };
  if (pct >= 40) return { cor: '#F39C12', bg: 'rgba(243,156,18,0.15)', label, icone: 'fa-circle-question' };
  if (pct >= 20) return { cor: '#E67E22', bg: 'rgba(230,126,34,0.15)', label, icone: 'fa-triangle-exclamation' };
  return { cor: '#E74C3C', bg: 'rgba(231,76,60,0.15)', label, icone: 'fa-circle-xmark' };
}

function ratingClass(avaliacao) {
  const v = (avaliacao || '').toLowerCase();
  if (/falso|false|enganoso|incorreto|mentira|fraude/.test(v)) return 'bg-danger';
  if (/verdadeiro|true|correto|preciso|confirmado/.test(v)) return 'bg-success';
  return 'bg-warning text-dark';
}

// ── Renderiza lista de histórico ─────────────────────────
function pintarHistorico(itens) {
  const container = document.getElementById('historico-list');
  if (!container) return;

  if (!itens || itens.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-search-minus fs-1 mb-3 opacity-50"></i>
        <p class="text-muted">Você ainda não realizou nenhuma verificação.</p>
        <a href="/" class="btn btn-verify btn-sm mt-2">Verificar agora</a>
      </div>
    `;
    return;
  }

  container.innerHTML = itens
    .map((v, idx) => {
      const verInfo = obterInfoVeredicto(v.porcentagem, v.veredito);
      const dataStr = new Date(v.createdAt).toLocaleString('pt-BR');
      const snippet = (v.texto || '').slice(0, 150) + ((v.texto || '').length > 150 ? '…' : '');

      return `
        <div class="query-item" id="query-${v._id}">
          <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
            <span class="text-muted small"><i class="far fa-calendar me-1"></i>${dataStr}</span>
            <span class="badge badge-veredito" style="background:${verInfo.bg};color:${verInfo.cor};border:1px solid ${verInfo.cor}44">
              <i class="fas ${verInfo.icone} me-1"></i>${verInfo.label} (${v.porcentagem}%)
            </span>
          </div>
          <p class="mb-3 fw-semibold" style="font-size:0.95rem;color:var(--text-main);">${snippet}</p>
          <div class="d-flex gap-2 justify-content-end">
            <button type="button" class="btn btn-outline-secondary btn-sm" onclick="verDetalhes(${idx})">
              <i class="fas fa-eye me-1"></i>Detalhes
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="excluirItem('${v._id}')">
              <i class="fas fa-trash-can me-1"></i>Excluir
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

// ── Renderiza modal de detalhes (histórico) ───────────────
function renderResultadosDetalhes(item) {
  const mappedData = {
    encontrados: item.fonte === 'api',
    quantidade: item.dadosAPI ? item.dadosAPI.length : 0,
    resultados: item.dadosAPI || [],
    porcentagem: item.porcentagem,
    veredito: item.veredito,
    explicacao: item.explicacao,
    fonte: item.fonte,
    confianca: item.dadosAPI && item.dadosAPI.length > 1 ? 'alta' : (item.dadosAPI && item.dadosAPI.length > 0 ? 'média' : 'baixa')
  };

  return renderResults(mappedData, item.texto, item.cidade, item.categoria);
}

// ── Funções de Apoio Unificadas para Renderização de Detalhes ──
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

const SINAIS_FALSO = [
    { regex: /\bURGENTE\b|\bURGENTÍSSIMO\b/g,                      peso: 10, label: 'Uso de "URGENTE" em maiúsculas', categoria: 'Urgência/Clickbait' },
    { regex: /compartilhe antes que (apaguem|removam|bloqueiem)/gi, peso: 18, label: 'Pedido de compartilhamento por medo de remoção', categoria: 'Urgência/Clickbait' },
    { regex: /repasse (para todos|isso)|envie para (todos|todo mundo)/gi, peso: 14, label: 'Pedido de reenvio em massa', categoria: 'Urgência/Clickbait' },
    { regex: /médicos odeiam|eles não querem que você saiba|ninguém está te contando/gi, peso: 16, label: 'Frase clickbait típica', categoria: 'Urgência/Clickbait' },
    { regex: /você não vai (acreditar|crer)/gi,                     peso: 12, label: 'Apelo a incredulidade ("você não vai acreditar")', categoria: 'Urgência/Clickbait' },
    { regex: /\bBOMBA\b|\bEXPLOSIVO\b|\bCHOCANTE\b|\bIMPACTANTE\b|\bBOMBÁSTICO\b/g, peso: 9, label: 'Linguagem sensacionalista', categoria: 'Urgência/Clickbait' },
    { regex: /[!]{2,}/g,                                  peso: 5,  label: 'Múltiplas exclamações seguidas', categoria: 'Estrutura do texto' },
    { regex: /[?]{2,}/g,                                  peso: 4,  label: 'Múltiplos pontos de interrogação seguidos', categoria: 'Estrutura do texto' },
    { regex: /\b[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]{6,}\b/g,               peso: 3,  label: 'Trechos inteiros em maiúsculas', categoria: 'Estrutura do texto', max: 4 },
    { regex: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,  peso: 2,  label: 'Uso de emojis no corpo do texto', categoria: 'Estrutura do texto', max: 3 },
    { regex: /confirmado por fontes( seguras| internas)?\b/gi,      peso: 9,  label: 'Fonte vaga ("fontes confirmam")', categoria: 'Fonte/Atribuição' },
    { regex: /disseram que|segundo dizem|alguns dizem|é o que circula/gi, peso: 7,  label: 'Atribuição vaga, sem nome ou veículo', categoria: 'Fonte/Atribuição' },
    { regex: /recebi (esse|este|essa|esta) (vídeo|áudio|texto|mensagem) (no|pelo) (whatsapp|zap)/gi, peso: 10, label: 'Origem declarada: corrente de WhatsApp', categoria: 'Fonte/Atribuição' },
    { regex: /print( da tela)?( anexo)?\b/gi,                        peso: 6,  label: 'Baseado em print/screenshot sem link', categoria: 'Fonte/Atribuição' },
    { regex: /mídia não mostra|grande mídia esconde|mídia tradicional silencia/gi, peso: 13, label: 'Narrativa de ocultação pela "grande mídia"', categoria: 'Conspiração/Desconfiança institucional' },
    { regex: /globo não vai (mostrar|noticiar)|censura(ram|do)?\b/gi, peso: 11, label: 'Alegação de censura', categoria: 'Conspiração/Desconfiança institucional' },
    { regex: /governo (esconde|oculta|mente sobre)/gi,                peso: 10, label: 'Acusação genérica de ocultação pelo governo', categoria: 'Conspiração/Desconfiança institucional' },
    { regex: /plano (secreto|oculto) (mundial|globalista)|nova ordem mundial/gi, peso: 16, label: 'Referência a teoria conspiratória global', categoria: 'Conspiração/Desconfiança institucional' },
    { regex: /vacina[s]?[^.]{0,40}(mata|matam|veneno|chip|5g|magnetiza|esteriliza)/gi, peso: 22, label: 'Desinformação sobre vacinas', categoria: 'Saúde/Pseudociência' },
    { regex: /cura (milagrosa|definitiva|secreta|natural)( para| de)? (câncer|covid|diabetes)/gi, peso: 18, label: 'Promessa de cura milagrosa', categoria: 'Saúde/Pseudociência' },
    { regex: /(indústria|big) farma (esconde|não quer)/gi,            peso: 14, label: 'Narrativa contra indústria farmacêutica', categoria: 'Saúde/Pseudociência' },
    { regex: /sem comprovação científica|não aprovado pela anvisa/gi, peso: 12, label: 'Tratamento sem aprovação/comprovação citado como eficaz', categoria: 'Saúde/Pseudociência' },
    { regex: /fraude (eleitoral|nas urnas)|urnas? (fraudada|manipulada)/gi, peso: 16, label: 'Alegação de fraude eleitoral sem fonte', categoria: 'Política/Eleitoral' },
    { regex: /candidato [^.]{0,40}(preso|condenado) (?!.*(segundo|fonte|processo n))/gi, peso: 10, label: 'Acusação grave sobre candidato sem citar processo/fonte', categoria: 'Política/Eleitoral' },
];

const SINAIS_CONFIAVEL = [
    { regex: /segundo\s+(o\s+|a\s+)?(governo|prefeitura|secretaria|ministério)\s+(de|do|da)?\s*[\wÀ-ú]+/gi, peso: 11, label: 'Cita órgão oficial nomeado', categoria: 'Fonte/Atribuição' },
    { regex: /de acordo com (a |o )?(pesquisa|estudo|levantamento|relatório)/gi, peso: 9,  label: 'Referencia pesquisa/estudo/relatório', categoria: 'Fonte/Atribuição' },
    { regex: /https?:\/\/[^\s]+/gi,                                   peso: 7,  label: 'Contém link verificável como fonte', categoria: 'Fonte/Atribuição' },
    { regex: /publicado em \d{1,2}\/\d{1,2}\/\d{2,4}|em \d{1,2} de \w+ de \d{4}/gi, peso: 7, label: 'Data de publicação clara', categoria: 'Estrutura do texto' },
    { regex: /por\s+[A-ZÀ-Ú][\wÀ-ú]+\s+[A-ZÀ-Ú][\wÀ-ú]+,?\s*(da redação|repórter|jornalista)/gi, peso: 8, label: 'Assinatura de jornalista identificado', categoria: 'Fonte/Atribuição' },
    { regex: /nota oficial|comunicado oficial|decreto n[ºo°]?\s*\d+/gi, peso: 12, label: 'Cita documento ou nota oficial específica', categoria: 'Fonte/Atribuição' },
    { regex: /g1|gazeta do povo|folha de s\.?\s?paulo|o\s?estad[ãa]o|agência brasil|cnn brasil|band news/gi, peso: 9, label: 'Menciona veículo jornalístico reconhecido', categoria: 'Fonte/Atribuição' },
    { regex: /segundo (a |o )?(assessoria|porta-voz)/gi,              peso: 7,  label: 'Cita assessoria/porta-voz como fonte', categoria: 'Fonte/Atribuição' },
    { regex: /em nota,? (a|o)|afirmou em entrevista|declarou à reportagem/gi, peso: 6, label: 'Inclui declaração formal de uma das partes', categoria: 'Estrutura do texto' },
    { regex: /\b\d{1,3}([.,]\d+)?\s?%|\bR\$\s?\d/gi,                  peso: 4,  label: 'Contém dados numéricos/estatísticos específicos', categoria: 'Estrutura do texto', max: 3 },
];

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

    if (texto.length > 300) pesoConfiavel += 4;
    if (texto.length > 600) pesoConfiavel += 4;
    if (texto.length < 80 && pesoFalso > 0) pesoFalso += 8;

    const total = pesoFalso + pesoConfiavel;
    let porcentagemLocal;
    if (total === 0) {
        porcentagemLocal = 50;
    } else {
        const rawScore = (pesoConfiavel / (pesoFalso + pesoConfiavel)) * 100;
        porcentagemLocal = Math.round(Math.max(8, Math.min(92, rawScore)));
    }

    return {
        porcentagemLocal,
        alertasFalso,
        alertasConfiavel,
        pesoFalso,
        pesoConfiavel
    };
}

function veredicto(pct) {
    if (pct >= 75) return { cor: '#27AE60', bg: 'rgba(39,174,96,0.15)', label: 'Provavelmente Verdadeira',  icone: 'fa-circle-check',    classe: 'success' };
    if (pct >= 55) return { cor: '#7DCB7A', bg: 'rgba(125,203,122,0.15)', label: 'Tende a ser verdadeira',  icone: 'fa-circle-check',    classe: 'success' };
    if (pct >= 40) return { cor: '#F39C12', bg: 'rgba(243,156,18,0.15)', label: 'Inconclusivo / Verificar', icone: 'fa-circle-question',  classe: 'warning' };
    if (pct >= 20) return { cor: '#E67E22', bg: 'rgba(230,126,34,0.15)', label: 'Tende a ser falsa',        icone: 'fa-triangle-exclamation', classe: 'warning' };
    return             { cor: '#E74C3C', bg: 'rgba(231,76,60,0.15)',  label: 'Provavelmente Falsa',       icone: 'fa-circle-xmark',    classe: 'danger'  };
}

function agruparPorCategoria(alertas) {
    const grupos = {};
    alertas.forEach(a => {
        const cat = a.categoria || 'Outros';
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(a);
    });
    return grupos;
}

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

    let html = `<div class="mb-3 d-flex align-items-center gap-2 flex-wrap">`;
    if (data.encontrados) {
        html += `<span class="badge bg-success fs-6"><i class="fas fa-check-circle me-1"></i>Verificada pela API</span>
                 <span class="badge bg-secondary">${data.quantidade} resultado(s)</span>`;
    } else {
        html += `<span class="badge bg-warning text-dark fs-6"><i class="fas fa-magnifying-glass me-1"></i>Análise local aplicada</span>`;
    }
    html += `<span class="badge" style="background:${confiancaInfo.cor}22;color:${confiancaInfo.cor};border:1px solid ${confiancaInfo.cor}55">
                <i class="fas fa-gauge-high me-1"></i>${confiancaInfo.label}
             </span>`;
    if (cityLabel) html += `<span class="badge bg-primary"><i class="fas fa-map-pin me-1"></i>${cityLabel}</span>`;
    if (categoriaLabel) html += `<span class="badge bg-secondary">${categoriaLabel}</span>`;
    html += `</div>`;

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
    }

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

function mapearAvaliacaoAPI(textualRating) {
    const r = (textualRating || '').toLowerCase();
    if (/\b(falso|fake|false|incorreto|mentira|inverdade|fraude|fabricado)\b/.test(r)) return 5;
    if (/\b(enganoso|misleading|distorcido|fora de contexto|parcialmente falso)\b/.test(r)) return 25;
    if (/\b(exagerado|impreciso|sem evidências?( suficientes)?|não comprovado)\b/.test(r)) return 35;
    if (/\b(inconclusivo|em apuração|controverso|depende|debatido)\b/.test(r)) return 50;
    if (/\b(parcialmente verdadeiro|parcialmente correto|em parte verdadeiro)\b/.test(r)) return 60;
    if (/\b(verdadeiro|true|correto|preciso|confirmado|comprovado)\b/.test(r)) return 95;
    return null;
}

// ── Abrir modal com detalhes da verificação ───────────────
function verDetalhes(idx) {
  const item = itemsHistorico[idx];
  if (!item) return;

  const modalBody = document.getElementById('modalContent');
  if (!modalBody) return;

  modalBody.innerHTML = renderResultadosDetalhes(item);

  const shareBtnEl = document.getElementById('shareBtn');
  if (shareBtnEl) {
    // Configura o compartilhamento específico do item do histórico
    shareBtnEl.onclick = () => {
      const d = { title: 'VerificaFato', text: `Consultei a veracidade da notícia no VerificaFato: "${item.texto.slice(0,60)}..." Veredito: ${item.veredito}`, url: window.location.origin };
      if (navigator.share) navigator.share(d).catch(() => {});
      else navigator.clipboard.writeText(window.location.origin)
        .then(() => showAlert('Link copiado!', 'success'))
        .catch(() => showAlert('Não foi possível copiar.', 'danger'));
    };
  }

  bootstrap.Modal.getOrCreateInstance(document.getElementById('resultsModal')).show();
}

// ── Excluir item do histórico ────────────────────────────
async function excluirItem(id) {
  if (!confirm('Deseja realmente remover esta verificação do seu histórico?')) return;

  const token = getToken();
  try {
    const res = await fetch(`/api/historico/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok || !data.sucesso) {
      throw new Error(data.erro || 'Erro ao remover item.');
    }

    showAlert('Verificação excluída com sucesso.', 'success');
    
    // Remove do array e atualiza a tela
    itemsHistorico = itemsHistorico.filter(x => x._id !== id);
    pintarHistorico(itemsHistorico);
  } catch (err) {
    showAlert(err.message, 'danger');
  }
}

// ── Carregar histórico do backend ────────────────────────
async function carregarHistorico() {
  const token = getToken();
  if (!token) {
    showAlert('Você precisa estar logado para acessar esta página.', 'danger');
    setTimeout(() => window.location.href = '/Login.html', 1500);
    return;
  }

  atualizarNav();

  const container = document.getElementById('historico-list');
  if (container) container.innerHTML = '<div class="text-center py-5"><span class="spinner-border spinner-border-sm me-2" role="status"></span>Carregando seu histórico…</div>';

  try {
    const res = await fetch('/api/historico', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok || !data.sucesso) {
      throw new Error(data.erro || 'Não foi possível carregar.');
    }

    itemsHistorico = data.itens || [];
    pintarHistorico(itemsHistorico);
  } catch (err) {
    if (container) container.innerHTML = `<div class="text-center py-5 text-danger"><i class="fas fa-triangle-exclamation me-2"></i>Erro: ${err.message}</div>`;
  }
}

window.addEventListener('DOMContentLoaded', carregarHistorico);

// Torna as funções globais para serem chamadas nos atributos onclick
window.verDetalhes = verDetalhes;
window.excluirItem = excluirItem;
