require('dotenv').config();
const fetch = require('node-fetch');

const API_KEY = process.env.GOOGLE_API_KEY;

async function testGoogleFactCheckAPI(queryText) {
    try {
        if (!API_KEY) {
            throw new Error('API_KEY não configurada. Verifique o arquivo .env');
        }

        const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?languageCode=pt-BR&key=${API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: queryText,
                reviewPublisherSiteFilter: ""
            })
        });

        console.log('Status da resposta:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro na API: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Resposta da API:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Erro ao testar a API:', error.message);
    }
}

// Teste com um texto exemplo
const textoTeste = 'alta floresta';
testGoogleFactCheckAPI(textoTeste);
