// Indicadores heurísticos originais, preservados para a apresentação visual. Não são prova factual.

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
    { regex: /vacina[s]?[^.]{0,40}(mata|matam|veneno|chip|5g|magnetiza|esteriliza)/gi, peso: 22, label: 'Menção a alegações sobre vacinas', categoria: 'Saúde/Pseudociência' },
    { regex: /cura (milagrosa|definitiva|secreta|natural)( para| de)? (câncer|covid|diabetes)/gi, peso: 18, label: 'Promessa de cura milagrosa', categoria: 'Saúde/Pseudociência' },
    { regex: /(indústria|big) farma (esconde|não quer)/gi,            peso: 14, label: 'Narrativa contra indústria farmacêutica', categoria: 'Saúde/Pseudociência' },
    { regex: /sem comprovação científica|não aprovado pela anvisa/gi, peso: 12, label: 'Menção à falta de comprovação ou aprovação de tratamento', categoria: 'Saúde/Pseudociência' },

    // Política / eleitoral
    { regex: /fraude (eleitoral|nas urnas)|urnas? (fraudada|manipulada)/gi, peso: 16, label: 'Menção a alegação de fraude eleitoral', categoria: 'Política/Eleitoral' },
    { regex: /candidato [^.]{0,40}(preso|condenado) (?!.*(segundo|fonte|processo n))/gi, peso: 10, label: 'Acusação grave sobre candidato sem citar processo/fonte', categoria: 'Política/Eleitoral' },
];

const SINAIS_CONFIAVEL = [
    // Atribuição e fontes oficiais
    { regex: /segundo\s+(o\s+|a\s+)?(governo|prefeitura|secretaria|ministério)\s+(de|do|da)?\s*[\wÀ-ú]+/gi, peso: 11, label: 'Cita órgão oficial nomeado', categoria: 'Fonte/Atribuição' },
    { regex: /de acordo com (a |o )?(pesquisa|estudo|levantamento|relatório)/gi, peso: 9,  label: 'Referencia pesquisa/estudo/relatório', categoria: 'Fonte/Atribuição' },
    { regex: /https?:\/\/[^\s]+/gi,                                   peso: 7,  label: 'Contém link citado como fonte', categoria: 'Fonte/Atribuição' },
    { regex: /publicado em \d{1,2}\/\d{1,2}\/\d{2,4}|em \d{1,2} de \w+ de \d{4}/gi, peso: 7, label: 'Data de publicação clara', categoria: 'Estrutura do texto' },
    { regex: /por\s+[A-ZÀ-Ú][\wÀ-ú]+\s+[A-ZÀ-Ú][\wÀ-ú]+,?\s*(da redação|repórter|jornalista)/gi, peso: 8, label: 'Assinatura de jornalista identificado', categoria: 'Fonte/Atribuição' },
    { regex: /nota oficial|comunicado oficial|decreto n[ºo°]?\s*\d+/gi, peso: 12, label: 'Cita documento ou nota oficial específica', categoria: 'Fonte/Atribuição' },
    { regex: /g1|gazeta do povo|folha de s\.?\s?paulo|o\s?estad[ãa]o|agência brasil|cnn brasil|band news/gi, peso: 9, apenasDescritivo: true, label: 'Menciona veículo jornalístico reconhecido', categoria: 'Fonte/Atribuição' },
    { regex: /segundo (a |o )?(assessoria|porta-voz)/gi,              peso: 7,  label: 'Cita assessoria/porta-voz como fonte', categoria: 'Fonte/Atribuição' },

    // Linguagem mais neutra/factual
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
            if (!sinal.apenasDescritivo) pesoConfiavel += sinal.peso * Math.min(ocorrencias, limite);
            alertasConfiavel.push({ label: sinal.label, ocorrencias, categoria: sinal.categoria });
        }
    });

    // This is a descriptive balance of observed text signals, never a factual
    // probability. With no contrast, a default 50 or a saturated 74/100 would
    // imply a measurement that was not made. Length and publisher names cannot
    // supply that missing measurement.
    const indiceDisponivel = pesoFalso > 0 && pesoConfiavel > 0;
    const porcentagemLocal = indiceDisponivel
        ? Math.round(100 * pesoConfiavel / (pesoFalso + pesoConfiavel))
        : null;

    return {
        porcentagemLocal,
        alertasFalso,
        alertasConfiavel,
        pesoFalso,
        pesoConfiavel,
        indiceDisponivel
    };
}

function limitar(valor, minimo = 0, maximo = 100) {
    return Math.max(minimo, Math.min(maximo, Math.round(valor)));
}

function extrairInformacoesNoticia(texto) {
    const palavrasIgnoradas = new Set([
        'para', 'como', 'mais', 'essa', 'esse', 'isso', 'sobre', 'entre', 'quando',
        'onde', 'porque', 'também', 'ainda', 'muito', 'pode', 'podem', 'segundo',
        'foram', 'estão', 'está', 'com', 'sem', 'uma', 'uns', 'das', 'dos', 'que'
    ]);
    const palavras = texto.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]{3,}/g) || [];
    const frequencia = new Map();
    palavras.forEach(palavra => {
        const chave = palavra.toLowerCase();
        if (!palavrasIgnoradas.has(chave)) frequencia.set(chave, (frequencia.get(chave) || 0) + 1);
    });

    const palavrasImportantes = [...frequencia.entries()]
        .sort((a, b) => (b[1] - a[1]) || (b[0].length - a[0].length))
        .slice(0, 10)
        .map(([palavra]) => palavra);
    const entidades = [...new Set(texto.match(/\b[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-Za-zÀ-ÿ'-]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-Za-zÀ-ÿ'-]+){0,3}/g) || [])]
        .filter(item => item.length > 3)
        .filter(item => !/^(URGENTE|ATENÇÃO|COMPARTILHE|IMPORTANTE)$/i.test(item))
        .slice(0, 8);
    const datas = [...new Set(texto.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2} de [A-Za-zÀ-ÿ]+ de \d{4}\b/gi) || [])].slice(0, 5);
    const textoSemDatas = texto.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2} de [A-Za-zÀ-ÿ]+ de \d{4}\b/gi, ' ');
    const numeros = [...new Set(textoSemDatas.match(/\b(?:R\$\s?)?\d[\d.,]*(?:\s?%|\s?(?:mil|milhões?|bilhões?))?\b/gi) || [])].slice(0, 8);
    const links = [...new Set((texto.match(/https?:\/\/[^\s)]+/gi) || []).map(link => link.replace(/[.,!?;:]+$/, '')))].slice(0, 5);
    const primeiraFrase = texto.split(/(?<=[.!?])\s+/)[0]?.trim() || texto.trim();

    return {
        palavrasImportantes,
        entidades,
        numeros,
        datas,
        links,
        alegacaoPrincipal: primeiraFrase.slice(0, 240),
        quantidadePalavras: palavras.length,
        quantidadeCaracteres: texto.length
    };
}

function analisarDimensoesNoticia(texto, analiseLocal, dadosAPI = {}) {
    const alerta = analiseLocal.alertasFalso;
    const categorias = new Set(alerta.map(item => item.categoria));
    const temLink = /https?:\/\/[^\s]+/i.test(texto);
    const temData = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2} de [a-zá-ú]+ de \d{4}\b/i.test(texto);
    const temAtribuicao = /\b(segundo|conforme|de acordo com|afirmou|declarou|informou)\b/i.test(texto);
    const quantidadePalavras = texto.trim().split(/\s+/).filter(Boolean).length;

    const pontosSensacionalismo =
        (categorias.has('Urgência/Clickbait') ? 38 : 0) +
        (categorias.has('Conspiração/Desconfiança institucional') ? 25 : 0) +
        (alerta.some(item => item.label.includes('exclamações')) ? 15 : 0) +
        (alerta.some(item => item.label.includes('maiúsculas')) ? 10 : 0) +
        (alerta.some(item => item.label.includes('emojis')) ? 5 : 0);

    const qualidadeFonte = limitar(
        (temLink ? 40 : 0) +
        (temAtribuicao ? 25 : 0) +
        (temData ? 20 : 0)
    );
    const completude = limitar(
        (quantidadePalavras >= 80 ? 35 : quantidadePalavras >= 35 ? 20 : 8) +
        (temData ? 20 : 0) +
        (temAtribuicao ? 25 : 0) +
        (temLink ? 20 : 0)
    );
    const temFactCheck = Boolean(dadosAPI.encontrados && dadosAPI.resultados?.length);

    return {
        informacoes: extrairInformacoesNoticia(texto),
        sensacionalismo: {
            pontuacao: limitar(pontosSensacionalismo),
            nivel: pontosSensacionalismo >= 60 ? 'alto' : pontosSensacionalismo >= 30 ? 'moderado' : 'baixo',
            descricao: pontosSensacionalismo >= 60
                ? 'Muitos recursos emocionais, urgência ou linguagem de impacto.'
                : pontosSensacionalismo >= 30
                    ? 'Há alguns recursos de impacto que merecem conferência.'
                    : 'Poucos sinais de linguagem sensacionalista foram identificados.'
        },
        fonte: {
            pontuacao: qualidadeFonte,
            nivel: qualidadeFonte >= 70 ? 'boa' : qualidadeFonte >= 35 ? 'parcial' : 'fraca',
            escopo: 'referencias_no_texto',
            descricao: temLink
                ? 'O texto analisado contém link(s) de referência. A URL da publicação é apresentada separadamente e não comprova suas afirmações.'
                : 'Não foram identificados links de referência no corpo do texto analisado. A URL da publicação, quando enviada, é apresentada separadamente.'
        },
        estrutura: {
            pontuacao: completude,
            nivel: completude >= 70 ? 'completa' : completude >= 40 ? 'parcial' : 'insuficiente',
            descricao: `${quantidadePalavras} palavra(s), ${temData ? 'com' : 'sem'} data e ${temAtribuicao ? 'com' : 'sem'} atribuição identificada.`
        },
        evidencia: {
            tipo: temFactCheck ? 'fact-check externo' : 'indícios textuais',
            quantidade: dadosAPI.quantidade || 0,
            verificacaoExterna: temFactCheck
        }
    };
}

function calcularVeredictoFinal(data, analiseLocal) {
    // The historical export name is kept for callers, but this is only a text index.
    // Published ratings never enter the score: they belong to the evidence pipeline.
    return {
        porcentagem: data?.indiceElegivel === true ? analiseLocal.porcentagemLocal : null,
        fonte: 'local',
        confianca: null,
        explicacao: 'Índice descritivo de linguagem, estrutura e referências citadas no texto. Não representa probabilidade de verdade, confiança factual ou autenticação de mídia. A classificação depende exclusivamente das evidências validadas.'
    };
}

function obterRotuloVeredicto(pct) {
    if (typeof pct !== 'number' || !Number.isFinite(pct)) return 'Indicadores indisponíveis';
    if (pct >= 75) return 'Mais referências e sinais formais';
    if (pct >= 55) return 'Alguns sinais formais no texto';
    if (pct >= 40) return 'Padrões mistos no texto';
    if (pct >= 20) return 'Padrões que pedem atenção';
    return 'Mais padrões de alerta';
}

export {
    SINAIS_FALSO,
    SINAIS_CONFIAVEL,
    analisarTextoLocalmente,
    calcularVeredictoFinal,
    extrairInformacoesNoticia,
    analisarDimensoesNoticia,
    obterRotuloVeredicto
};

export const AVISO_HEURISTICO = 'Pontuação heurística dos padrões do texto, sem calibração estatística. Não é probabilidade de verdade nem prova definitiva de verdade, falsidade ou adulteração.';

// Evidence counts are kept separate from the local text index.
export function criarAnaliseVisual(texto, { afirmacoes = [], classificacao, incompleta = false } = {}) {
    const analiseLocal = analisarTextoLocalmente(texto);
    const classificacoesConcluidas = new Set(['Conteúdo verdadeiro', 'Falso', 'Parcialmente verdadeiro', 'Adulterado', 'Distorcido', 'Fora de contexto']);
    const evidencias = new Map();
    if (!incompleta && classificacoesConcluidas.has(classificacao)) {
        for (const afirmacao of afirmacoes) {
            if (afirmacao.tipo !== 'fato' || afirmacao.consultaCompleta !== true || afirmacao.conflito || !classificacoesConcluidas.has(afirmacao.veredito)) continue;
            for (const evidencia of afirmacao.evidencias || []) {
                if (evidencia.utilizavel !== true || evidencia.correspondencia !== 'exata' || evidencia.fonteReconhecida !== true || evidencia.classificacaoPublicada !== afirmacao.veredito || !classificacoesConcluidas.has(evidencia.classificacaoPublicada)) continue;
                const chave = evidencia.id || `${evidencia.url_verificacao}|${evidencia.avaliacao}`;
                evidencias.set(chave, evidencia);
            }
        }
    }
    const resultados = [...evidencias.values()];
    const fatos = afirmacoes.filter(afirmacao => afirmacao.tipo === 'fato');
    // This gate depends on validated evidence for every factual claim, not on
    // textual style, provider configuration or mere search-result presence.
    const indiceElegivel = !incompleta && classificacoesConcluidas.has(classificacao) && fatos.length > 0 && fatos.every(afirmacao =>
        afirmacao.consultaCompleta === true && !afirmacao.conflito && afirmacao.veredito === classificacao &&
        (afirmacao.evidencias || []).some(evidencia => evidencias.has(evidencia.id || `${evidencia.url_verificacao}|${evidencia.avaliacao}`))
    );
    const dadosAPI = { encontrados: resultados.length > 0, quantidade: resultados.length, resultados, indiceElegivel };
    const calculo = calcularVeredictoFinal(dadosAPI, analiseLocal);
    const dimensoes = analisarDimensoesNoticia(texto, analiseLocal, dadosAPI);
    if (!indiceElegivel) {
        analiseLocal.porcentagemLocal = null;
        analiseLocal.indiceDisponivel = false;
        for (const nome of ['fonte', 'estrutura', 'sensacionalismo']) dimensoes[nome].pontuacao = null;
    }
    return {
        escopo: 'padroes_textuais',
        porcentagem: calculo.porcentagem,
        veredito: obterRotuloVeredicto(calculo.porcentagem),
        confianca: calculo.confianca,
        fonte: calculo.fonte,
        indiceElegivel,
        motivoIndice: !indiceElegivel ? 'Sem verificação factual completa com evidência elegível; os sinais abaixo são apenas descritivos.' :
            analiseLocal.indiceDisponivel ? 'Verificação factual elegível; o índice descreve somente padrões do texto.' : 'Não há contraste de sinais textuais para calcular um índice.',
        analiseLocal,
        dimensoes,
        texto,
        explicacao: calculo.explicacao,
        quantidadePalavras: texto.trim().split(/\s+/).filter(Boolean).length,
        quantidadeCaracteres: texto.length,
        aviso: AVISO_HEURISTICO,
        heuristico: true
    };
}
