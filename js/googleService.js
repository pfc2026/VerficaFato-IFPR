require('dotenv').config();
const fetch = require('node-fetch');    
const API_KEY = process.env.GOOGLE_API_KEY;

async function verificarNoticia(texto) {
    try {
        if (!API_KEY) {
            throw new Error('API_KEY não configurada. Verifique o arquivo .env');
        }

        if (!texto || texto.trim().length === 0) {
            throw new Error('Texto não fornecido para verificação');
        }

        console.log('🔍 Verificando com Google API...');
        console.log('API Key:', API_KEY ? 'Configurada' : 'Não configurada');
        
        const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?languageCode=pt-BR&key=${API_KEY}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: texto.trim(),
                reviewPublisherSiteFilter: ""
            })
        });

        console.log('Status da resposta:', response.status);
        
        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Processa e formata os resultados
        const resultados = data.claims?.map(claim => ({
            texto_verificado: claim.text,
            verificador: claim.claimReview[0]?.publisher?.name || 'Desconhecido',
            titulo_verificacao: claim.claimReview[0]?.title || 'Sem título',
            url_verificacao: claim.claimReview[0]?.url || '',
            avaliacao: claim.claimReview[0]?.textualRating || 'Não avaliado',
            data_verificacao: new Date(claim.claimReview[0]?.reviewDate || null).toLocaleDateString('pt-BR')
        })) || [];
        
        return {
            encontrados: resultados.length > 0,
            quantidade: resultados.length,
            resultados: resultados
        };
        
    } catch (error) {
        console.error('❌ Erro na API:', error);
        throw new Error('Erro ao verificar a notícia: ' + error.message);
    }
}

// Exportar a função
module.exports = { verificarNoticia };
