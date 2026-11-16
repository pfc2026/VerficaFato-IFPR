# Metodologia e limites

## Estimativa apresentada ao usuário

Por solicitação posterior do usuário em 16/11/2026, a apresentação principal passa a mostrar **Estimativa da IA**, com percentual e classificação, junto de um aviso pequeno e legível de que a IA pode cometer erros. Essa mudança substitui a política anterior de F04 que suprimia qualquer percentual quando o parecer por fontes era inconclusivo. Não converte o índice de linguagem antigo em porcentagem de verdade nem altera os critérios do parecer factual abaixo.

O Gemini recebe o texto completo disponível, as afirmações candidatas, os resultados Google pertinentes e seus estados de uso, os indicadores locais e as comparações realmente executadas pelo TensorFlow. Na mesma chamada usada para a explicação e o contexto jurídico, o modelo fornece uma estimativa subjetiva de plausibilidade factual. Pode usar conhecimento geral do próprio modelo; esse conhecimento não é apresentado como pesquisa externa ou fonte consultada. A avaliação do texto completo também não depende exclusivamente da classificação produzida pelas regras de extração.

`estimativaIA` contém `status`, `porcentagem`, `classificacao`, `provedor`, `modelo`, `metodo:estimativa_ia` e `motivos` autorizados. O percentual válido é um inteiro entre 0 e 100. A classificação é derivada no servidor, e não escolhida independentemente do número:

| Percentual da estimativa | Classificação apresentada |
| --- | --- |
| 0–30 | Provavelmente falso |
| 31–69 | Veracidade incerta |
| 70–100 | Provavelmente verdadeiro |

Essas faixas são uma convenção de apresentação, não limites obtidos por calibração ou medida de acurácia. O percentual não representa a proporção de fatos demonstrados nem a frequência medida de acertos do sistema. Ausência de checagem, disponibilidade do runtime, texto bem escrito e similaridade lexical alta não fornecem um score automático. Não há default 50/74, randomização ou substituição pelo antigo índice textual.

O estado `disponivel` exige número válido e classificação coerente. Em falha, ausência ou saída inválida do provedor, a estimativa é `indisponivel` e o percentual permanece null; não há número inventado como fallback. Opiniões, perguntas ou previsões sem acontecimento verificável podem ser `nao_aplicavel`, também sem percentual. O parecer factual e suas fontes continuam disponíveis independentemente da etapa opcional.

Motivos são IDs de um conjunto fechado e também dependem do contexto efetivo: não se autoriza alegar checagem concordante/discordante sem uma evidência utilizada correspondente, nem comparação textual ou sinais de linguagem que não existiram nesta análise. Se uma checagem utilizável já fundamentou Conteúdo verdadeiro e a IA propõe menos de 70, ou Falso e a IA propõe mais de 30, a estimativa contraditória é rejeitada e fica indisponível. O servidor não corrige o número com clamp nem o substitui por outro valor.

O resultado compacto prioriza percentual, classificação, comentário breve e fontes úteis. Afirmações e comparações ficam acessíveis em detalhes recolhíveis. “Continue aprendendo”, “O que fazer com essa informação” e o painel repetitivo de “Disponibilidade e limites” deixam o resultado; a seção “Como é feita a verificação” da página inicial descreve as funções e limites dos serviços.

## Evidência e classificação
1. O texto é segmentado em português e separado em candidatos a fatos, opiniões/perguntas, previsões ou instruções por regras explícitas. Essa etapa pode errar e não é um modelo validado de extração de fatos.
2. Cada candidato factual gera uma consulta literal limitada e uma consulta de palavras-chave. Um pequeno dicionário PT-BR expande imunizante/vacina, imunização/vacinação e pleito/eleição. São variações lexicais; não se alegam paráfrases semânticas produzidas por modelo.
3. Todas as avaliações devolvidas, com limites de recursos, mantêm afirmação, autor, organização, idioma, data e URL. Nem toda checagem relacionada serve para o conteúdo enviado.
4. A classificação automática do parecer por fontes, separada da estimativa da IA, usa igualdade textual normalizada (NFC, espaços e pontuação final; maiúsculas e expoentes são preservados para distinguir, por exemplo, 1 MW de 1 mW e 10² de 102), domínio reconhecido, organização identificada, URL HTTP(S) sem credenciais, datas de alegação e de avaliação obrigatórias, válidas e coerentes, ausência de referências temporais/pronominais ambíguas e mapeamento EXATO de rótulo. A alegação não pode ser posterior à checagem, e a checagem não pode ser futura. Negação, números, nomes e contexto textual não são removidos. As checagens são classificações publicadas atribuídas às fontes, não certificação independente feita pelo sistema.
5. Domínios padrão: Aos Fatos, Lupa, Boatos.org, Estadão, G1, AFP, Reuters, AP, FactCheck.org, PolitiFact e Full Fact. FACT_CHECK_TRUSTED_DOMAINS permite curadoria explícita; correspondência exige fronteira de domínio. A seleção de domínios não substitui leitura crítica.
6. Avaliações conflitantes ou não reconhecidas não são resolvidas por votação ou média. Consultas parcialmente indisponíveis, candidatos omitidos e combinações de vereditos permanecem Sem evidências suficientes.
7. As seis classificações representam o rótulo específico de uma checagem correspondente: Conteúdo verdadeiro, Parcialmente verdadeiro, Adulterado, Distorcido, Fora de contexto e Falso. Uma mistura de afirmações verdadeiras e falsas NÃO é automaticamente classificada como parcialmente verdadeira; a conclusão geral permanece inconclusiva quando não há um rótulo comum fundamentado. Cada afirmação conserva seu resultado, justificativa, constatações, limitações e IDs das fontes utilizadas.
8. Sem fato candidato, o parecer por fontes é Não verificável, com ressalva de possível erro das regras. Isso não impede que a etapa de IA avalie a factualidade do texto completo para sua estimativa separada.

Opiniões em primeira pessoa e avaliações subjetivas comuns são separadas de previsões, inclusive futuros verbais e expressões como “daqui a dois anos”. Relatar que alguém fez uma promessa é um fato candidato distinto do acontecimento prometido: a frase completa e a atribuição são preservadas. Segmentos de opinião e dados factuais podem ser mantidos separadamente em textos mistos. Essas regras PT-BR não substituem compreensão semântica nem têm precisão global medida.

### Datas e contexto relativo

`parseEvidenceDate` aceita `AAAA-MM-DD`, interpretada como 00:00 UTC, ou `AAAA-MM-DDTHH:mm:ss[.SSS]Z`/offset explícito `±HH:mm`, até ±14:00. Mês, dia, bissexto, horário e offset são validados antes da conversão. Datas de calendário inexistentes e timestamps locais sem fuso são recusados. Nenhuma data de execução, coleta ou HTTP substitui a data ausente da alegação ou da checagem.

Igualdade literal não resolve “hoje”, “esta semana”, “neste mês”, seus equivalentes e períodos relativos. Para utilizá-los, a fronteira interna exige contexto explícito com `origem: publicacao_verificada`, `dataPublicacao` e `fuso` IANA. O período da publicação de entrada é comparado ao período da alegação checada naquele fuso; semanas começam na segunda-feira. A API pública não aceita uma âncora declarada pelo texto do usuário nem a deduz automaticamente do relógio da análise. Sem âncora confiável ou com períodos incompatíveis, a evidência permanece sem uso conclusivo. Intervalos relativos ainda não resolvidos conservam a incerteza. Expressões temporais absolutas legítimas continuam disponíveis quando os demais requisitos são atendidos.

### Critérios e mapeamentos aceitos

O contrato central fica em `services/evidence.js`: `VERDICT_DEFINITIONS` descreve os critérios e `RATING_MAPPINGS` contém somente os rótulos inteiros aceitos. A normalização de rótulos remove acentos, converte para minúsculas e admite ponto/exclamação finais; não procura palavras dentro de frases.

| Classificação | Critério | Rótulos publicados aceitos |
| --- | --- | --- |
| Conteúdo verdadeiro | Confirmação da afirmação e de seus detalhes relevantes, com coerência de data, local, autoria e contexto. | verdadeiro, verdadeira, true, correto, correta, conteúdo verdadeiro |
| Parcialmente verdadeiro | Partes corretas e erros ou imprecisões relevantes dentro da mesma afirmação. | parcialmente verdadeiro, parcialmente verdadeira, parcialmente correto, parcialmente correta, partially true |
| Adulterado | Alteração material ou fabricação de mídia, documento, captura de tela ou citação que modifica seu significado. | adulterado, adulterada, imagem adulterada, vídeo adulterado, áudio adulterado, documento adulterado, captura de tela adulterada, citação adulterada |
| Distorcido | Apresentação enganosa de fatos reais por exagero, comparação inadequada, omissão ou interpretação. | distorcido, distorcida |
| Fora de contexto | Conteúdo autêntico associado a data, local, pessoa ou situação incorreta, ou privado do contexto original necessário. | fora de contexto, out of context |
| Falso | Afirmação central contradita ou fato comprovadamente inventado. | falso, falsa, false, incorreto, incorreta |

“Enganoso”, “enganosa”, “misleading”, rótulos compostos como “falso e adulterado” e qualquer outro rótulo ausente da tabela permanecem sem mapeamento factual específico. Nem o título da checagem nem a aparência do texto escolhem outra categoria. Uma avaliação exata de fonte reconhecida com rótulo não mapeado também impede que outra fonte mapeada encerre automaticamente a conclusão: o sistema não descarta uma possível divergência.

“Sem evidências suficientes” cobre ausência de evidências pertinentes, conflito e consultas incompletas. “Não verificável” cobre opiniões, previsões e outros trechos sem afirmação factual identificada, com ressalva das regras de extração. São estados complementares, não provas de falsidade ou verdade.

Google Fact Check fornece metadados, não o texto integral da apuração. O parecer atribui o rótulo, a afirmação, o título e a data à organização responsável. Para resultados parciais, distorcidos ou fora de contexto, não inventa as partes corretas/incorretas, o dado original nem outra data/local/pessoa quando esses detalhes não foram fornecidos: sinaliza a lacuna e oferece a publicação para leitura. A categoria Adulterado só decorre de rótulo específico de checagem correspondente; a aplicação não realizou perícia de imagem, áudio, vídeo ou documento e informa essa limitação.

## Linguagem
TF-IDF usa frequências logarítmicas, IDF suavizado e normalização L2. O cosseno mede sobreposição lexical entre documentos, sem distinguir implicação, negação ou contradição. Não decide o parecer por fontes e não é um classificador de verdade. Seus resultados são enviados ao modelo como apoio limitado à estimativa subjetiva, sem converter similaridade em probabilidade factual. O TensorFlow também processa textos vindos de URL pelo mesmo caminho. A metodologia e os detalhes recolhíveis distinguem runtime disponível, zero comparações, contagem lexical, modelo efetivamente utilizado e indisponibilidade. `modelo:null` não significa modelo treinado ativo; similaridade 1,000 não confirma um fato.

Urgência, maiúsculas, pontuação e chamadas de compartilhamento são indicadores descritivos com o trecho que disparou a regra. Um texto correto pode ser sensacionalista; um texto falso pode ter linguagem neutra.

## Índice textual técnico e sinais descritivos

`criarAnaliseVisual` continua centralizando a elegibilidade do antigo índice textual no contrato técnico. Ele exige classificação factual conclusiva e completa, consulta concluída de cada fato, ausência de conflito e evidência utilizável com correspondência exata, fonte reconhecida e classificação compatível. Sem essa condição, `analiseVisual.porcentagem`, `analiseLocal.porcentagemLocal` e as pontuações dos cartões locais são `null`; `indiceElegivel` é falso e `motivoIndice` explica o limite. A nova apresentação não usa esse índice nem seus cartões como porcentagem de veracidade; `estimativaIA` tem origem e validação próprias.

Havendo elegibilidade factual e sinais textuais positivos e de alerta, o índice é a razão determinística entre seus pesos, arredondada para 0–100. Sem contraste de sinais, permanece nulo. Comprimento e mera menção a G1, Agência Brasil ou outro veículo não produzem bônus no índice nem na dimensão de referências. Links, atribuição e datas encontrados no corpo podem ser descritos como referências presentes, sem que a citação prove qualidade ou verdade.

Avaliações do Google e reportagens regionais não entram em votação ou média desse índice textual. `porcentagem` e `confianca` factuais na raiz continuam nulas; o campo técnico tem escopo `padroes_textuais`, sem calibração factual. Histórico novo e demais consumidores preservam tanto o parecer por fontes quanto a estimativa da IA recebida, sem recalcular índices nem acrescentar percentual a um registro antigo que não o possuía.

### Acervo regional e proveniência

`services/article-eligibility.js` aplica a mesma política ao ranking e às consultas exatas por URL em MongoDB e no fallback local. Um contexto elegível precisa de título/corpo/fonte, URL pública sintaticamente válida, hash de conteúdo conferido, proveniência de artigo e revisão aprovada vinculadas à mesma URL e ao mesmo hash. Quarentena, sementes sintéticas identificadas e rotas de listagem não são elegíveis. A palavra “teste” em uma reportagem real não a torna sintética.

Os seis artigos locais revisados foram preservados como contexto, sem certificação factual. O registro de inicialização e as duas listagens auditadas estão em `data/noticias-quarentena.json`, com origens, hashes e motivos; JSON, JSONL e CSV ativos contêm somente os artigos revisados. Novas extrações recebem revisão pendente: um corpo delimitado, domínio conhecido ou HTTP 200 não os aprova automaticamente. Importações rejeitam registros sabidamente sintéticos/genéricos e preservam a origem para revisão.

`node scripts/review-archive.js --mongo` inspeciona o banco configurado sem escrever. `--mongo --apply` aplica somente correspondências exatas dos registros auditados, com backup original em `archive_review_backups` antes de marcar revisão/quarentena na coleção original. Não exclui documentos; mudanças concorrentes impedem alteração sem correspondência. O comando tem prazo total de 15 segundos e erros sanitizados. Alterar arquivos locais não demonstra saneamento do MongoDB nem publicação de uma versão; esses estados precisam de evidências próprias. Sem reportagem elegível, a análise declara a falta de contexto regional e não inventa substitutos.

## Parecer integrado e explicação por IA

O fluxo identifica afirmações, consulta checagens, executa comparações TensorFlow.js quando existem pares e valida as correspondências no backend antes de enviar o contexto ao Gemini. O modelo produz a estimativa separada e seleciona blocos autorizados de explicação em português. O parecer factual por fontes conserva classificação/estado, afirmações, justificativas atribuídas, constatações, IDs e limites. Google, TensorFlow e Gemini não representam três confirmações independentes nem uma votação: cada componente tem função distinta.

Gemini determina somente a nova estimativa subjetiva dentro do contrato autorizado e não altera o veredito por fontes, o antigo índice textual, a disponibilidade dos serviços ou as evidências utilizadas. OpenAI permanece como alternativa configurável, sem troca silenciosa de provedor. Resumo, orientação e feedback factual continuam como textos exatos do catálogo do servidor; motivos da estimativa usam IDs autorizados. Destaques apontam IDs de afirmações; referências apontam somente evidências autorizadas e os links são resolvidos no servidor. Citar um ID válido não autoriza prosa factual nova, paráfrase, entidade, fonte ou conclusão externa não sustentada. Atribuições e estado de verificação permanecem preservados.

Uma seleção de comentário fora do conjunto permitido é rejeitada, mesmo que seja JSON válido ou preserve o enum inconclusivo. O parecer por fontes continua disponível com explicação segura e estado de rejeição/falha; um campo de estimativa inválido não autoriza inventar score substituto. A proteção do comentário decorre da seleção exata e composição no servidor, não de um prompt, regex ou outro modelo avaliando prosa livre. Essa proteção estrutural não garante a precisão da estimativa subjetiva. A seleção jurídica opcional usa seu próprio campo validado e não altera a conclusão factual.

ENABLE_AI_EXPLANATION=false desliga o envio. Para habilitar Gemini, configure GEMINI_API_KEY e GEMINI_MODEL disponíveis na conta; para OpenAI, OPENAI_API_KEY e OPENAI_MODEL. GOOGLE_API_KEY é separada e pertence à Google Fact Check Tools API. Configuração desativada é distinta de erro inesperado, timeout, falha de provedor ou seleção rejeitada. Falhas da etapa opcional preservam o parecer validado e mostram explicação local com diagnóstico público seguro.

O modelo recebe somente texto/contexto, candidatos com classificações e constatações, evidências com seu estado de uso atribuído pelo backend, indicadores, fontes e limitações desta análise. Checagens relacionadas não se tornam provas pelo envio ao modelo. Chaves, dados de conta e banco não fazem parte do payload. Notícias e instruções citadas são dados não confiáveis; não há ferramentas disponíveis ao modelo. Falha do Gemini preserva o parecer local validado e informa a indisponibilidade da estimativa e da explicação por IA conforme o estado retornado; falha da consulta Google não é convertida em confirmação factual.

## Calibração e limites

Não há conjunto rotulado, treinamento ou calibração que sustente uma probabilidade estatística de verdade. A porcentagem de `estimativaIA` é uma opinião numérica do modelo com base no contexto recebido e em seu conhecimento geral, sujeita a erros, desatualização e inconsistência. Um aviso legível acompanha o resultado; as faixas de classificação não alegam precisão medida. `porcentagem` e `confianca` na raiz da resposta permanecem `null`. O índice técnico de `analiseVisual`, com escopo `padroes_textuais`, descreve somente padrões locais e não é a estimativa da IA. Similaridade lexical também não é probabilidade factual. Resultados históricos mantêm o parecer e a estimativa efetivamente registrados; não recebem score novo ou reclassificação sem nova consulta.

A avaliação futura deve medir cobertura de afirmações, precisão/recall de correspondência, falsos pareamentos (negação, data, pessoa e local), erros por classe e desempenho por domínio, idioma e período, usando divisão temporal e controle de vazamento. Nenhuma métrica de qualidade factual foi inventada.
