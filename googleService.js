require('dotenv').config();
const fetch = require('node-fetch');

// Variáveis de ambiente configuradas para o Fact Check API
const API_KEY = process.env.GOOGLE_API_KEY;
const API_url_base = process.env.FACT_CHECK_BASE_URL; // Ex: 'https://factchecktools.googleapis.com'
const API_ENDPOINT = '/v1alpha1/claims:search'; 

async function verificarNoticia(texto) {
    try {
        if (!API_KEY || !API_url_base) {
            // Verifica se as chaves da API estão configuradas no .env
            throw new Error('Configuração da API ausente. Verifique GOOGLE_API_KEY e FACT_CHECK_BASE_URL no arquivo .env.');
        }

        if (!texto || texto.trim().length === 0) {
            throw new Error('Texto não fornecido para verificação.');
        }

        // Extrai palavras-chave do texto (primeiras 100 palavras)
        const palavrasChave = texto.trim()
            .split(/\s+/)
            .slice(0, 100)
            .join(' ');

        console.log('🔍 Buscando verificação de fatos para:', palavrasChave.substring(0, 100) + '...');

        // 1. CONSTRUÇÃO DA QUERY STRING
        const params = new URLSearchParams({
            query: palavrasChave, // A consulta de verificação com palavras-chave
            languageCode: 'pt-BR',
            pageSize: 10, // Limita o número de resultados
            key: API_KEY // Chave da API
        });
        
        // 2. CONSTRUÇÃO DA URL FINAL
        const finalUrl = `${API_url_base}${API_ENDPOINT}?${params.toString()}`;

        // 3. CHAMADA DA API (GET)
        const response = await fetch(finalUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText };
            }
            throw new Error(`Erro na API (${response.status} ${response.statusText}): ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        
        // 4. PROCESSAMENTO DA RESPOSTA
        const resultadosProcessados = [];
        
        if (data.claims && data.claims.length > 0) {
            data.claims.forEach(claim => {
                if (claim.claimReview && claim.claimReview.length > 0) {
                    // Pega o primeiro ClaimReview para simplificação
                    const review = claim.claimReview[0];
                    
                    resultadosProcessados.push({
                        alegacao: claim.text || 'Alegação não informada',
                        autor: claim.claimant || 'Autor Desconhecido',
                        verificador: review.publisher?.name || 'Verificador Desconhecido',
                        avaliacao: review.textualRating || 'N/A',
                        url_revisao: review.url || '#',
                        // Adiciona campos para manter a estrutura original de "link" e "titulo"
                        // Mapeia o resultado para algo semelhante a uma "notícia"
                        titulo: `[${review.textualRating || 'VERIFICAÇÃO'}] - ${claim.text}`,
                        link: review.url || '#',
                        snippet: `Verificado por ${review.publisher?.name || 'N/A'} - Avaliação: ${review.textualRating || 'N/A'}`
                    });
                }
            });
        }
        
        // 5. RETORNO DA FUNÇÃO
        return {
            encontrados: resultadosProcessados.length > 0,
            quantidade: resultadosProcessados.length,
            resultados: resultadosProcessados
        };

    } catch (error) {
        console.error('❌ Erro ao buscar verificação de fatos:', error);
        // Lança o erro para ser tratado pela aplicação que chama esta função
        throw error; 
    }
}

// O CX não é usado pela Fact Check API, mas é mantido para compatibilidade se for necessário para outras funções.
// const CX = process.env.GOOGLE_CSE_ID; 

module.exports = { verificarNoticia };