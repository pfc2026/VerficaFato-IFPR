// verificationEngine.js — Motor de veracidade compartilhado entre back-end e front-end

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

function calcularVeredictoFinal(data, analiseLocal) {
    const notasAPI = [];
    if (data?.encontrados && Array.isArray(data.resultados)) {
        data.resultados.forEach(r => {
            const nota = mapearAvaliacaoAPI(r.avaliacao);
            if (nota !== null) notasAPI.push(nota);
        });
    }

    if (notasAPI.length > 0) {
        const piorNota  = Math.min(...notasAPI);
        const mediaNota = notasAPI.reduce((a, b) => a + b, 0) / notasAPI.length;
        const notaAPIFinal = Math.round(piorNota * 0.7 + mediaNota * 0.3);
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

function obterRotuloVeredicto(pct) {
    if (pct >= 75) return 'Provavelmente Verdadeira';
    if (pct >= 55) return 'Tende a ser verdadeira';
    if (pct >= 40) return 'Inconclusivo / Verificar';
    if (pct >= 20) return 'Tende a ser falsa';
    return 'Provavelmente Falsa';
}

module.exports = {
    SINAIS_FALSO,
    SINAIS_CONFIAVEL,
    mapearAvaliacaoAPI,
    analisarTextoLocalmente,
    calcularVeredictoFinal,
    obterRotuloVeredicto
};
