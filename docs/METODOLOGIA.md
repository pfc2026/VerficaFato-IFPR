# Metodologia e limites

## Evidência e classificação
1. O texto é segmentado em português e separado em candidatos a fatos, opiniões/perguntas, previsões ou instruções por regras explícitas. Essa etapa pode errar e não é um modelo validado de extração de fatos.
2. Cada candidato factual gera uma consulta literal limitada e uma consulta de palavras-chave. Um pequeno dicionário PT-BR expande imunizante/vacina, imunização/vacinação e pleito/eleição. São variações lexicais; não se alegam paráfrases semânticas produzidas por modelo.
3. Todas as avaliações devolvidas, com limites de recursos, mantêm afirmação, autor, organização, idioma, data e URL. Nem toda checagem relacionada serve para o conteúdo enviado.
4. A classificação automática usa igualdade textual normalizada (NFC, espaços e pontuação final; maiúsculas e expoentes são preservados para distinguir, por exemplo, 1 MW de 1 mW e 10² de 102), domínio reconhecido, data de avaliação válida e não futura, ausência de referências temporais/pronominais ambíguas e mapeamento EXATO de rótulo. Negação, números, nomes e contexto textual não são removidos. As checagens são classificações publicadas atribuídas às fontes, não certificação independente feita pelo sistema.
5. Domínios padrão: Aos Fatos, Lupa, Boatos.org, Estadão, G1, AFP, Reuters, AP, FactCheck.org, PolitiFact e Full Fact. FACT_CHECK_TRUSTED_DOMAINS permite curadoria explícita; correspondência exige fronteira de domínio. A seleção de domínios não substitui leitura crítica.
6. Avaliações conflitantes ou não reconhecidas não são resolvidas por votação ou média. Consultas parcialmente indisponíveis, candidatos omitidos e combinações de vereditos permanecem Sem evidências suficientes.
7. As quatro classificações conclusivas representam o rótulo de uma checagem correspondente: verdadeiro, falso, parcialmente verdadeiro ou enganoso. Uma mistura de afirmações verdadeiras e falsas NÃO é automaticamente classificada como parcialmente verdadeira.
8. Sem fato candidato, a saída é Não verificável, com ressalva de possível erro das regras.

## Linguagem
TF-IDF usa frequências logarítmicas, IDF suavizado e normalização L2. O cosseno mede sobreposição lexical entre documentos, sem distinguir implicação, negação ou contradição. Não participa da regra de veracidade. O TensorFlow também processa textos vindos de URL pelo mesmo caminho.

Urgência, maiúsculas, pontuação e chamadas de compartilhamento são indicadores descritivos com o trecho que disparou a regra. Um texto correto pode ser sensacionalista; um texto falso pode ter linguagem neutra.

## Explicação por IA
O servidor produz blocos de explicação fundamentados no resultado estruturado. Gemini é o provedor preferencial da configuração de exemplo (AI_PROVIDER=gemini); OpenAI continua disponível com AI_PROVIDER=openai. Ambos organizam esses blocos e selecionam destaques autorizados. O contrato é o mesmo: um schema restrito e validação local rejeitam novos textos e IDs inventados. Essa restrição deliberada reduz liberdade conversacional para impedir que uma instrução na notícia crie evidências ou altere a classificação. O campo geracao.provedor registra o provedor selecionado.

ENABLE_AI_EXPLANATION=false mantém o envio externo desligado. Para habilitar Gemini, configure GEMINI_API_KEY e GEMINI_MODEL com um identificador disponível na conta e compatível com saída estruturada; nenhum modelo padrão é presumido. Para a alternativa OpenAI, configure OPENAI_API_KEY e OPENAI_MODEL. Falha do provedor, recusa, credenciais/modelo ausentes ou saída fora do contrato preservam a explicação local ancorada nas evidências.

GOOGLE_API_KEY é a chave da Google Fact Check Tools API e é separada de GEMINI_API_KEY. Gemini participa somente da organização da explicação; não substitui a consulta às checagens publicadas nem os cálculos de linguagem do TensorFlow.js.

O modelo não recebe chaves, dados de conta, banco ou ferramentas. Somente os candidatos e textos da análise são enviados quando o operador habilita o serviço. O conteúdo continua sendo dado não confiável.

## Sem números de confiança arbitrários
Não há conjunto rotulado, treinamento ou calibração que sustente probabilidade de verdade. porcentagem e confianca são null. Similaridades, quando usadas na recuperação, não são probabilidade factual. Nenhuma métrica de qualidade factual foi inventada. A avaliação futura deve medir cobertura de afirmações, precisão/recall de correspondência, falsos pareamentos (negação, data, pessoa e local), erros por classe e desempenho por domínio, idioma e período, usando divisão temporal e controle de vazamento.
