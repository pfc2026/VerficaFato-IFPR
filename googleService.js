require('dotenv').config();
const fetch = require('node-fetch');

const API_KEY  = process.env.GOOGLE_API_KEY;
const BASE_URL = 'https://factchecktools.googleapis.com';
const ENDPOINT = '/v1alpha1/claims:search';

// ── Palavras irrelevantes para busca (stopwords em PT-BR) ─────────────────
const STOPWORDS = new Set([
    'a','o','as','os','de','da','do','das','dos','em','no','na','nos','nas',
    'um','uma','uns','umas','e','é','que','com','para','por','sem','sob',
    'sobre','entre','até','desde','após','antes','depois','como','mas',
    'ou','se','não','já','mais','muito','também','isso','isto','esse',
    'essa','este','esta','aquele','aquela','seu','sua','seus','suas',
    'meu','minha','foi','foram','será','serão','são','está','estão',
    'tem','têm','ter','sendo','sido','vai','vão','pode','podem','disse',
    'segundo','ainda','só','apenas','assim','quando','onde','porque',
    'pois','então','aí','lá','aqui','todo','toda','todos','todas',
    'outro','outra','outros','outras','nós','eles','elas','ele','ela',
    'eu','você','vocês'
]);

/**
 * Extrai as palavras-chave mais relevantes de um texto livre, removendo
 * stopwords e priorizando palavras com inicial maiúscula (nomes, lugares,
 * instituições) e palavras mais longas (mais específicas/raras).
 * A Google Fact Check API funciona como um motor de busca por palavras-
 * chave — não como um analisador de texto completo — então enviar uma
 * frase curta e específica tem muito mais chance de encontrar resultado
 * do que enviar o texto inteiro.
 */
function extrairPalavrasChave(texto, maxPalavras = 8) {
    const palavras = texto
        .replace(/https?:\/\/[^\s]+/g, ' ')           // remove links
        .replace(/[^\wÀ-ú\s]/g, ' ')                   // remove pontuação
        .split(/\s+/)
        .filter(Boolean);

    const candidatas = palavras.filter(p => {
        const limpa = p.toLowerCase();
        return p.length > 3 && !STOPWORDS.has(limpa);
    });

    // Pontua: nomes próprios (inicial maiúscula no meio do texto) e
    // palavras mais longas pontuam mais, pois tendem a ser mais específicas.
    const pontuadas = candidatas.map((p, idx) => {
        let pontos = p.length;
        if (/^[A-ZÀ-Ú]/.test(p) && idx > 0) pontos += 8;     // provável nome próprio
        if (/\d/.test(p)) pontos += 4;                         // números/datas são específicos
        return { palavra: p, pontos };
    });

    // Remove duplicadas mantendo a de maior pontuação
    const unicas = new Map();
    pontuadas.forEach(({ palavra, pontos }) => {
        const chave = palavra.toLowerCase();
        if (!unicas.has(chave) || unicas.get(chave) < pontos) {
            unicas.set(chave, pontos);
        }
    });

    return [...unicas.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxPalavras)
        .map(([palavra]) => palavra)
        .join(' ');
}

/**
 * Executa uma única chamada GET à Fact Check Tools API.
 */
async function buscarClaims(query, pageSize = 10) {
    const params = new URLSearchParams({
        key: API_KEY,
        query,
        languageCode: 'pt', // BCP-47 simples — "pt-BR" não é aceito corretamente pela API
        pageSize
    });

    const url = `${BASE_URL}${ENDPOINT}?${params.toString()}`;
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });

    if (!response.ok) {
        let msg = `Erro na API (${response.status} ${response.statusText})`;
        try {
            const body = await response.json();
            msg += `: ${body?.error?.message || JSON.stringify(body)}`;
        } catch (_) { /* ignora parse failure */ }
        throw new Error(msg);
    }

    return response.json();
}

function formatarResultados(data) {
    const resultados = [];
    if (!Array.isArray(data.claims)) return resultados;

    for (const claim of data.claims) {
        const reviews = Array.isArray(claim.claimReview) ? claim.claimReview : [];
        if (reviews.length === 0) continue;

        const review        = reviews[0];
        const publisherName = review.publisher?.name || 'Verificador desconhecido';
        const textualRating = review.textualRating   || 'N/A';
        const reviewUrl      = review.url             || '#';
        const claimText      = claim.text             || 'Alegação não informada';
        const claimant        = claim.claimant         || 'Autor desconhecido';

        let dataFormatada = '—';
        if (review.reviewDate) {
            try {
                dataFormatada = new Date(review.reviewDate)
                    .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            } catch (_) { /* mantém '—' */ }
        }

        resultados.push({
            texto_verificado:   claimText,
            autor_alegacao:     claimant,
            verificador:        publisherName,
            titulo_verificacao: review.title || `[${textualRating}] ${claimText.slice(0, 60)}`,
            avaliacao:          textualRating,
            url_verificacao:    reviewUrl,
            data_verificacao:   dataFormatada
        });
    }
    return resultados;
}

/**
 * Consulta a Google Fact Check Tools API e retorna os resultados formatados.
 *
 * IMPORTANTE — limitação conhecida da API: ela funciona como um motor de
 * busca sobre um banco de artigos de fact-check JÁ PUBLICADOS (ClaimReview),
 * não como um verificador de texto livre. Ela só retorna algo se aquela
 * alegação específica já foi checada por um veículo (Aos Fatos, Lupa,
 * Boatos.org etc.) E indexada pelo Google. Estudos mostram que mesmo
 * alegações virais conhecidas retornam resultado em menos de 20% das vezes.
 * Por isso, a ausência de resultado NÃO significa que o conteúdo é
 * verdadeiro — apenas que não há checagem publicada e indexada sobre ele.
 *
 * Para aumentar a chance de encontrar correspondência, fazemos até 2
 * tentativas em cascata: primeiro com palavras-chave extraídas do texto
 * (mais preciso para esta API), depois com um trecho mais literal como
 * fallback.
 *
 * @param {string} texto - Texto ou alegação a verificar.
 * @returns {Promise<{ encontrados: boolean, quantidade: number, resultados: object[], estrategia: string }>}
 */
async function verificarNoticia(texto) {
    if (!API_KEY) {
        throw new Error('GOOGLE_API_KEY não configurada. Verifique o arquivo .env');
    }
    if (!texto || texto.trim().length === 0) {
        throw new Error('Texto não fornecido para verificação.');
    }

    const textoLimpo = texto.trim();

    // ── Tentativa 1: palavras-chave extraídas (melhor para este tipo de busca) ──
    const palavrasChave = extrairPalavrasChave(textoLimpo, 8);
    console.log(`🔍 Fact Check API | tentativa 1 (palavras-chave): "${palavrasChave}"`);

    let data = palavrasChave ? await buscarClaims(palavrasChave) : { claims: [] };
    let resultados = formatarResultados(data);
    let estrategia = 'palavras-chave';

    // ── Tentativa 2: se nada encontrado, tenta um trecho mais literal e curto ──
    if (resultados.length === 0) {
        const trechoLiteral = textoLimpo.slice(0, 120);
        console.log(`🔍 Fact Check API | tentativa 2 (trecho literal): "${trechoLiteral}"`);
        data = await buscarClaims(trechoLiteral);
        resultados = formatarResultados(data);
        estrategia = 'trecho literal';
    }

    if (resultados.length === 0) {
        estrategia = 'nenhuma correspondência';
    }

    console.log(`✅ Fact Check API | ${resultados.length} resultado(s) | estratégia: ${estrategia}`);

    return {
        encontrados:  resultados.length > 0,
        quantidade:   resultados.length,
        resultados,
        estrategia,
        palavrasChaveUsadas: palavrasChave
    };
}

module.exports = { verificarNoticia, extrairPalavrasChave };
