require('dotenv').config();
const fetch = require('node-fetch');

const API_KEY       = process.env.GOOGLE_API_KEY;
const BASE_URL      = 'https://factchecktools.googleapis.com';
const ENDPOINT      = '/v1alpha1/claims:search';

/**
 * Consulta a Google Fact Check Tools API e retorna os resultados formatados.
 * @param {string} texto - Texto ou alegação a verificar.
 * @returns {Promise<{ encontrados: boolean, quantidade: number, resultados: object[] }>}
 */
async function verificarNoticia(texto) {
    if (!API_KEY) {
        throw new Error('GOOGLE_API_KEY não configurada. Verifique o arquivo .env');
    }

    if (!texto || texto.trim().length === 0) {
        throw new Error('Texto não fornecido para verificação.');
    }

    // A API aceita no máximo ~500 chars de query de forma confiável
    const query = texto.trim().slice(0, 500);

    console.log(`🔍 Fact Check API | query: "${query.slice(0, 80)}..."`);

    // ── Monta URL (GET é o método correto para esta API) ───────────────────────
    const params = new URLSearchParams({
        key:          API_KEY,
        query,
        languageCode: 'pt-BR',
        pageSize:     10
    });

    const url = `${BASE_URL}${ENDPOINT}?${params.toString()}`;

    const response = await fetch(url, {
        method:  'GET',
        headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
        let msg = `Erro na API (${response.status} ${response.statusText})`;
        try {
            const body = await response.json();
            msg += `: ${body?.error?.message || JSON.stringify(body)}`;
        } catch (_) { /* ignora parse failure */ }
        throw new Error(msg);
    }

    const data = await response.json();

    // ── Processa claims ────────────────────────────────────────────────────────
    const resultados = [];

    if (Array.isArray(data.claims)) {
        for (const claim of data.claims) {
            const reviews = Array.isArray(claim.claimReview) ? claim.claimReview : [];
            if (reviews.length === 0) continue;

            const review      = reviews[0];
            const publisherName = review.publisher?.name || 'Verificador desconhecido';
            const textualRating = review.textualRating   || 'N/A';
            const reviewUrl     = review.url             || '#';
            const claimText     = claim.text             || 'Alegação não informada';
            const claimant      = claim.claimant         || 'Autor desconhecido';

            // Data formatada
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
    }

    console.log(`✅ Fact Check API | ${resultados.length} resultado(s) encontrado(s)`);

    return {
        encontrados: resultados.length > 0,
        quantidade:  resultados.length,
        resultados
    };
}

module.exports = { verificarNoticia };
