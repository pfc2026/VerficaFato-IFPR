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

## Indicadores e apresentação originais

A interface mantém o medidor circular, a barra, os quatro contadores, as dimensões Sensacionalismo/Qualidade da fonte/Completude, as informações extraídas, as características do texto e as checagens externas do modelo anterior. As regras foram recuperadas do backup e convertidas para ES Modules em services/verification-indicators.js, com os mesmos pesos e limites locais.

O cenário da imagem fornecida pelo usuário retorna índice 50%, confiança heurística baixa, zero sinais negativos/positivos, oito palavras e dimensões 0/0/8. O número não é probabilidade de veracidade. As legendas explicam essa distinção.

A ponderação antiga de resultados da API recebe somente evidências exatas já validadas pelo pipeline factual, com consulta completa e sem conflito. Resultados apenas relacionados, falhas parciais e presença no acervo regional não elevam o medidor. A classificação factual permanece independente do estilo do texto. Isso preserva os cartões e parâmetros locais sem tratar uma reportagem relacionada como confirmação.

## Feedback complementar por IA

Gemini gera um comentário natural separado, acrescentado ao fim dos cartões originais. Não determina classificação nem pontuação. OpenAI permanece como alternativa configurável. Ambos usam o mesmo contrato estruturado de seis campos: resumo e orientação selecionam textos autorizados; destaques selecionam IDs de afirmações; feedback contém o comentário; referencias seleciona IDs de fontes; classificacao deve repetir a calculada pelo servidor.

O servidor limita o comentário a 20–1.800 caracteres, valida o JSON e os IDs, impede referências duplicadas e monta links a partir das fontes recebidas. Também rejeita links/HTML na prosa, números não presentes nos dados e padrões de conclusão categórica quando o resultado é inconclusivo ou não verificável. Essas guardas não constituem verificação semântica completa da prosa; o modelo ainda pode interpretar dados incorretamente. A interface identifica o texto como gerado por IA e recomenda conferir fontes/contexto.

ENABLE_AI_EXPLANATION=false desliga o envio. Para habilitar Gemini, configure GEMINI_API_KEY e GEMINI_MODEL disponíveis na conta; para OpenAI, OPENAI_API_KEY e OPENAI_MODEL. GOOGLE_API_KEY é separada e pertence à Google Fact Check Tools API. Falha, recusa ou resposta inválida mostram no cartão um aviso local, sem fingir que foi escrito pelo Gemini.

O modelo recebe somente texto/contexto, candidatos, indicadores, fontes e limitações desta análise. Chaves, dados de conta e banco não fazem parte do payload. Notícias e instruções citadas são dados não confiáveis; não há ferramentas disponíveis ao modelo.

## Calibração e limites

Não há conjunto rotulado, treinamento ou calibração que sustente probabilidade de verdade. porcentagem e confianca da classificação factual, na raiz da resposta, são null. O índice visual original fica em analiseVisual e é identificado como heurístico. Similaridade lexical também não é probabilidade factual.

A avaliação futura deve medir cobertura de afirmações, precisão/recall de correspondência, falsos pareamentos (negação, data, pessoa e local), erros por classe e desempenho por domínio, idioma e período, usando divisão temporal e controle de vazamento. Nenhuma métrica de qualidade factual foi inventada.
