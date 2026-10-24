# Validação executada — 23/10/2026

Windows, Node.js v22.18.0, npm 10.9.3. Pasta: Documents/VerficaFato-IFPR-main (1)/VerficaFato-IFPR-main.

## Resultado após restauração dos cartões e feedback do Gemini
- npm test: **129 testes; 129 passaram; zero falhas, cancelados ou ignorados**.
- npm run check: **51 arquivos JavaScript (.js/.mjs) com sintaxe válida**, manifestos JSON válidos.
- Auditoria npm da migração: zero vulnerabilidades conhecidas reportadas após corrigir proxy-addr. Nenhuma dependência foi alterada na integração Gemini/limpeza; não há garantia de ausência absoluta de vulnerabilidades.

| Arquivo | Testes | Cobertura |
|---|---:|---|
| tests/analysis.test.js | 27 | Entrada, afirmações, evidência, TensorFlow, explicação, falhas, limites e cancelamento |
| tests/backend.test.js | 21 | HTTP, JWT, autorização, conta, histórico, sanitização, rate limit, métricas e pipeline real |
| tests/frontend.test.js | 15 | Cartões/medidor originais, feedback separado, DOM, XSS, URLs, legado, perfil e administração |
| tests/gemini.test.js | 20 | REST/header, schema, prosa complementar, referências reais, veredito, números/URLs, bloqueios, falhas e cancelamento |
| tests/safe-http.test.js | 6 | SSRF, DNS, IP fixado na conexão, redirects, tempo, bytes e regras por destino |
| tests/scraper.test.js | 28 | Extração, datas, persistência, importação EN/PT, deduplicação, coletores e encerramento |
| tests/verification-indicators.test.js | 12 | Pesos, limites e extrações originais, cenário da imagem, ponderação validada e integração por texto/URL |

## Cenários e regressões
Os quatorze cenários solicitados estão cobertos: URL, texto integral, afirmação curta, múltiplas afirmações, checagem correspondente, nenhum resultado, sensacionalismo com evidência favorável, neutralidade com evidência contrária, falha Google, falha TensorFlow, SSRF/prompt injection, entrada longa/inválida, conflito de evidências e indisponibilidade da IA.

Regressões distinguem 10² de 102 e 1 MW de 1 mW, mantêm negações/contexto, impedem conclusões globais que ignorem trechos omitidos e tratam resultados parciais como inconclusivos. O teste Gemini exige o enum REST APPLICATION_JSON, validado no serviço real.

As chamadas externas da suíte são simuladas. TensorFlow.js e pipeline HTTP também são exercitados de fato. MongoDB é simulado; persistência usa diretórios temporários. Nenhum teste da suíte precisa usar a credencial real.

## Teste real do Gemini
Após a autorização e o fornecimento da chave:
1. A credencial foi salva no .env, sem eco, sem inclusão em código/backup.
2. A listagem de modelos respondeu HTTP 200.
3. O campo de formato foi alinhado ao enum APPLICATION_JSON da API; um teste inicial identificou essa incompatibilidade.
4. O primeiro modelo respondeu 503 por alta demanda. gemini-3.5-flash-lite respondeu HTTP 200 e a explicação foi aprovada pelo schema local, com status="ia".
5. O modelo validado ficou configurado no .env.
6. Após restaurar os cartões, uma nova chamada com texto técnico fictício respondeu HTTP 200 com feedbackGemini.status="ia". O comentário em prosa passou pelo novo schema e a classificação factual permaneceu Sem evidências suficientes.

Somente mensagens técnicas fictícias foram usadas nas gerações. Nenhum conteúdo de conta, notícia ou acervo foi enviado. A validação não demonstra precisão factual do modelo; a classificação continua definida pelo servidor.

## Acervo e limpeza
Antes das exclusões, foi criado e validado o ZIP backups/projeto-antes-da-limpeza-2026-10-23.zip, com 121 arquivos e manifesto SHA-256. Todas as entradas foram conferidas, sem .env ou node_modules.
A união dos acervos foi verificada nos três formatos: nove registros, nove URLs, nove hashes e os mesmos sete campos. Textos, títulos, datas e hashes foram preservados; duas URLs perderam a barra final. As origens anteriores estão no ZIP.

Python, requirements, caches, wrappers sem uso e imagens sem referência foram retirados. Logo, dependências e recursos ativos foram mantidos. Não houve gravação em MongoDB nem coleta pública.

## Inspeção visual
Chrome headless com fixture local, sem banco ou APIs reais: página inicial em 1440 e 390 px; resultado em 1440 e 475 px. Não houve overflow horizontal. Os cartões originais e o bloco adicional do Gemini foram inspecionados no topo e no fim do modal.

O cenário da imagem retornou 50%, contadores 0/0/8/0 e dimensões 0/0/8. A pontuação permanece identificada como índice heurístico. O feedback do cenário visual foi simulado e identificado como exemplo; a chamada real do Gemini foi validada separadamente.

scripts/visual-check.mjs gera capturas em .artifacts/. O servidor e o Chrome exclusivos do QA foram encerrados. Os dois backups locais preservam o código anterior à limpeza e o código anterior ao retorno visual, com manifestos conferidos.

## Limites restantes
Não houve homologação real de MongoDB/Google Fact Check ou deploy. Não há modelo semântico treinado fornecido ou métricas de qualidade factual inventadas. O modelo local opcional precisa ser avaliado em português antes de ativação.

