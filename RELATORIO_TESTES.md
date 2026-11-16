# Relatório de testes — VerificaFato IFPR

**Data:** 15/11/2026, America/Sao_Paulo. Os registros UTC após 00h de 16/11 correspondem à noite de 15/11 no Brasil.

**Conclusão:** o fluxo executa processamento e integrações reais, mas **não está integralmente aprovado**. A suíte existente passou; testes adicionais encontraram defeitos de contrato, contexto temporal, validação da explicação e apresentação. Foi identificado também um registro de teste do acervo ativo sendo devolvido como referência regional em produção. Não se demonstrou precisão factual global nem uma probabilidade calibrada de verdade.

Esta auditoria não corrigiu nem publicou código. Foram criados este relatório e diagnósticos em `.artifacts/audit-2026-11-15/`. Alterações anteriores do projeto foram preservadas.

## 1. Versão e método

- Site: <https://verfica-fato-ifpr.vercel.app/>.
- Projeto Vercel: `prj_Qkxwa0H1qDd90Nic7NczfebjboMd`.
- Deployment auditado: `dpl_yfRRD6e1bYhna744UgxhL76PKeo6`, em produção e `READY`.
- Node local: `v22.18.0`.
- Os **69 arquivos de execução publicados** conferem com os hashes dos arquivos locais. O hash agregado permaneceu `a7f843cf53c3e9d8b9cf08da18a0e8909a87fcfb3566de4a72367230b6cf26ea` antes e depois da auditoria. Não houve alteração da aplicação ou da interface.
- Evidências de versão: [provenance.json](.artifacts/audit-2026-11-15/provenance.json), [source-before.json](.artifacts/audit-2026-11-15/source-before.json), [source-after.json](.artifacts/audit-2026-11-15/source-after.json).

Foi acompanhado o caminho **formulário → POST `/api/verificar` → extração/afirmações → Google Fact Check → TensorFlow → validação do backend → Gemini → apresentação**. Foram combinadas execução da suíte, testes adicionais, inspeção de código, API publicada e navegador real.

As modalidades são distintas:

| Modalidade | O que comprova | O que não comprova |
|---|---|---|
| Suíte local existente | Comportamentos cobertos pelos testes e pelas dependências controladas | Precisão jornalística ou disponibilidade real de todos os provedores |
| Falhas injetadas em HTTP/JSDOM/pipeline | Reação a entradas, respostas e indisponibilidades específicas | Ocorrência dessas falhas no provedor real |
| Navegador + servidor local controlado | Comportamento visual e dos eventos reais diante de erros forçados | Uma queda real de Google/Gemini |
| API e navegador em produção | Respostas efetivas da versão publicada para as entradas registradas | Comportamento de toda notícia, de todas as categorias ou sob carga |
| Fonte original consultada | Existência, pertinência e coerência da fonte amostrada | Auditoria independente de toda apuração publicada |

Não se aprovou um caso apenas por HTTP 200: foram examinados classificação, afirmações, seções, fontes/IDs, disponibilidade, índice, limitações e comportamento do formulário.

## 2. Resultado quantitativo das execuções

| Execução | Resultado | Situação |
|---|---|---|
| `npm test` no sandbox restrito | 348 aprovados; 27 falhas `connect EACCES 127.0.0.1` | **Bloqueado pelo ambiente**, não classificado como defeito da aplicação |
| `npm test` com acesso a localhost | **375/375 aprovados**, 0 falhas; aproximadamente 30,47 s | **Aprovado para a cobertura existente** |
| `npm run check` | **91 arquivos JavaScript** com sintaxe válida e manifestos JSON válidos | **Aprovado** |
| Sondagens adicionais JSDOM, HTML e `main.js` reais | 27 casos: 12 aprovados e 15 reprovados | Inclui repetições do mesmo defeito |
| Sondagens HTTP locais com analisador injetado | 16 casos: 11 aprovados e 5 reprovados | Cinco formatos de sucesso inválido foram aceitos |
| Sondagens de pipeline com falhas/prazos controlados | 5 casos: 4 aprovados e 1 reprovado | A exceção inesperada da explicação foi diagnosticada incorretamente |
| Bateria principal real da API | 14 POSTs sequenciais: 4 rejeições 400, 1 rejeição 422 e 9 respostas de análise 200 | Nenhum 500, JSON vazio/inválido ou timeout observado nessa bateria |
| Controle adicional real do acervo | 1 POST 200 | **Reprovado:** referência regional de teste retornada |
| Existência das fontes do acervo | 9 URLs consultadas por GET, seguindo redirects: 8 HTTP 200 e 1 HTTP 404 | **Reprovado para o acervo completo:** link de teste inexistente; duas páginas genéricas entre as disponíveis |
| GETs reais de páginas/rotas | 9 requisições; páginas/status/aulas disponíveis, histórico anônimo vazio, administração protegida por 401 | Aprovação limitada aos comportamentos efetivamente examinados |
| Navegador em produção | 6 envios à análise, com repetição de `example.com` entre as 5 entradas distintas, além de validações de entrada e inspeção móvel | Resultados e limitações detalhados abaixo |
| Navegador com falhas locais forçadas | 3 cenários | Resposta vazia e mensagem de rede reprovadas; recuperação de 503 aprovada |

As 21 reprovações nas 48 sondagens locais adicionais **não equivalem a 21 falhas diferentes**. Incluem repetições e manifestações do mesmo problema. Não se soma esta amostra à suíte como se fosse uma métrica de precisão.

Logs atuais: [npm-test.log](.artifacts/audit-2026-11-15/npm-test.log), [npm-test-unsandboxed.log](.artifacts/audit-2026-11-15/npm-test-unsandboxed.log), [npm-check.log](.artifacts/audit-2026-11-15/npm-check.log).

## 3. Matriz de integração real

Cada `LIVE-NN` conserva entrada e resposta em `.artifacts/audit-2026-11-15/live-live-NN.json`; [live-summary.json](.artifacts/audit-2026-11-15/live-summary.json) reúne as verificações de completude, tempos e repetição. As chamadas principais ocorreram aproximadamente entre 21h17 e 21h19, horário de São Paulo.

| ID | Entrada/procedimento | Resultado observado | Avaliação |
|---|---|---|---|
| LIVE-01 | `{}` | 400, erro JSON, sem parecer | **Aprovado** |
| LIVE-02 | `{"texto":{"bad":true}}` | 400, sem parecer | **Aprovado** |
| LIVE-03 | `{"texto":"oi"}` | 400, sem parecer | **Aprovado** |
| LIVE-04 | URL `ftp://example.com/noticia` | 400, sem parecer | **Aprovado** |
| LIVE-05 | `https://example.com/` | 422 `EMPTY_ARTICLE`, orientação para colar texto | **Aprovado:** não inventa extração |
| LIVE-06 | `A prefeitura anunciou uma nova escola em 2025.` | 200, Sem evidências suficientes, zero checagens, índice nulo | **Aprovado** quanto à incerteza |
| LIVE-07 | `Eu acho este jornal excelente.` | 200, Não verificável, Google não consultado, índice nulo | **Aprovado** |
| LIVE-08 | Repetir LIVE-06 depois de LIVE-07 | Mesmos hash, afirmação, classificação e índice | **Aprovado** para consistência A/B/A |
| LIVE-09 | `Ele fez isso ontem na cidade.` | 200, Sem evidências suficientes, índice nulo | **Aprovado** para não confirmar ambiguidade |
| LIVE-10 | Link Metrópoles abaixo | 200, 3.098 caracteres, 8 afirmações, 11 trechos omitidos, zero checagens, índice nulo | **Aprovado com cobertura parcial declarada** |
| LIVE-11 | Link Agência Gov abaixo | 200, 4.688 caracteres, 8 afirmações, 17 trechos omitidos, zero checagens, índice nulo | **Aprovado com cobertura parcial declarada** |
| LIVE-12 | Controle sintético com urgência e estudos, descrito na seção 5 | 200, Sem evidências suficientes, índice 50, pesos 18/18, sem fontes | Cálculo **autêntico**; apresentação **reprovada para o critério de não pontuar sem verificação factual** |
| LIVE-13 | Controle sintético com comunicado e `??`, descrito na seção 5 | 200, Não verificável, Google não consultado, índice 74, pesos 23/8 | Mesma ressalva; reproduzido também no navegador |
| LIVE-14 | Afirmação exata de uma checagem real do Estadão | 200, uma fonte pertinente, uma comparação TensorFlow, cosseno 1; conclusão inconclusiva porque faltou a data da checagem na API | Integração **aprovada**; classificação factual conclusiva real **bloqueada pelos metadados** |

Links efetivamente analisados:

- [Metrópoles](https://www.metropoles.com/colunas/mirelle-pinheiro/pf-faz-operacao-contra-esquema-de-desvio-de-emendas-parlamentares).
- [Agência Gov — Enem](https://agenciagov.ebc.com.br/noticias/202610/enem-integra-avaliacao-da-educacao-basica-entenda-as-novidades).

Nos nove sucessos da bateria principal, estavam presentes o catálogo das oito classificações/estados possíveis e as seis seções textuais preenchidas. Isso não significa que as oito classificações tenham ocorrido na amostra. Não foi encontrado ID de fonte utilizada inexistente na lista recebida. O Gemini respondeu realmente com status `ia`; não foi substituído por uma fixture nesta bateria. Isso não garante correção semântica de toda frase gerada.

Os textos extraídos de Metrópoles e Agência Gov possuem hashes distintos. Os acontecimentos desses artigos **não foram confirmados independentemente** por esta auditoria. A extração e o retorno conservador foram validados; a veracidade de todo o conteúdo não foi declarada aprovada.

Na repetição A/B/A, a prosa do Gemini variou, mas os dados factuais e o índice permaneceram iguais. Não houve indício de reutilização do resultado de B como resposta de A. Uma amostra pequena não exclui todos os defeitos de cache/concorrência possíveis.

## 4. Fluxo no navegador e demais páginas

Evidência consolidada: [browser-results.json](.artifacts/audit-2026-11-15/browser-results.json). O navegador usou a versão publicada; depois foi apontado para um servidor local de falhas controladas, identificado separadamente.

| Teste | Observação | Situação |
|---|---|---|
| Envio vazio | Mensagem em português; modal não abriu; botão habilitado | **Aprovado** |
| Protocolo FTP e texto `oi` | Rejeições específicas visíveis; nenhum resultado apresentado | **Aprovado** |
| Início de análise real | Botão desabilitado, spinner visível, `aria-busy=true` | **Aprovado** |
| Opinião real | Não verificável, índice `—`, explicação identificada como IA | **Aprovado com ressalva da mensagem TensorFlow** |
| Controle 74 | Não verificável e Google não consultado coexistem com medidor 74/100 | **Reprovado para o requisito atual**, ver F04 |
| Link sem artigo | Mensagem de extração identificada pelo diagnóstico do locator; estado final sem modal e com controles recuperados | **Aprovado com limitação da observação transitória** |
| Link Metrópoles | Corpo correto encaminhado ao resultado; 8 afirmações; índice `—`; omissões informadas | **Aprovado com cobertura parcial** |
| Controle de fonte real | Avaliação original Falso atribuída ao Estadão; link real; resultado geral conservador | **Aprovado com limite de data** |
| Detalhe TensorFlow | Uma comparação com valor lexical 1,000 e aviso de que não prova fatos | **Aprovado** |
| Viewport móvel 390×844 | Área do resultado: largura disponível e rolável ambas 327 px; sem overflow horizontal na amostra | **Aprovado na amostra** |
| Local: HTTP 200 `sucesso:true,dados:null` | Modal abriu como Registro legado, sem alerta de resposta inválida | **Reprovado**, F01 |
| Local: conexão encerrada pelo servidor | Alerta `Failed to fetch`; sem modal; controles recuperados | Mensagem **reprovada**; recuperação **aprovada**, F07 |
| Local: HTTP 503 | Mensagem em português; sem modal; controles recuperados | **Aprovado** |

Capturas: [opinião](.artifacts/audit-2026-11-15/ui-opiniao.jpg), [74 — estado](.artifacts/audit-2026-11-15/ui-74-nao-verificavel.jpg), [74 — medidor](.artifacts/audit-2026-11-15/ui-74-medidor.jpg), [Metrópoles](.artifacts/audit-2026-11-15/ui-link-metropoles.jpg), [comparação real](.artifacts/audit-2026-11-15/ui-controle-fonte-tensorflow.jpg), [móvel](.artifacts/audit-2026-11-15/ui-resultado-mobile.jpg), [resposta vazia local](.artifacts/audit-2026-11-15/ui-local-resposta-vazia.jpg), [rede local interrompida](.artifacts/audit-2026-11-15/ui-local-falha-rede.jpg).

Os nove GETs reais estão em [root-readonly.json](.artifacts/audit-2026-11-15/root-readonly.json):

- Página inicial, login, privacidade, histórico e administração entregaram HTML com o título esperado. Isso confirma disponibilidade das páginas, **não aprovação dos fluxos autenticados**.
- `/api/status`: 200, Mongo conectado e serviços configurados. Configuração declarada não equivale, isoladamente, a integração funcional; Google/Gemini foram exercitados separadamente.
- `/api/education`: 200, catálogo com 10 aulas.
- `/api/historico` sem autenticação: 200 com lista vazia; não houve exposição de histórico de outro usuário na amostra.
- `/api/admin/metricas` sem autenticação: 401, Autenticação necessária.

## 5. Investigação específica de 50 e 74

### Origem atual confirmada

Em `services/verification-indicators.js:83–98`, o índice só é calculado se há pesos positivos **e** de alerta. A fórmula atual é:

```text
arredondar(100 × pesoPositivo / (pesoPositivo + pesoAlerta))
```

Sem contraste, retorna `null`. Não existe atualmente retorno padrão de 50, teto de 74 ou bônus por comprimento no índice principal. A menção de um veículo conhecido também não pontua nesse índice. Os antigos valores registrados em artefatos históricos não são utilizados como resposta da aplicação; esses artefatos não integram o pacote de execução publicado.

Controles reais reproduzidos:

- **50:** `URGENTE!!! De acordo com o estudo de matemática, de acordo com a pesquisa de astronomia, resultados foram divulgados.` Pesos 18/18: `100 × 18 / 36 = 50`.
- **74:** `Segundo a Prefeitura de Toledo, o comunicado oficial trata do calendário escolar?? Confira os detalhes??` Pesos 23/8: `arredondar(100 × 23 / 31) = 74`.

Esses números são **cálculos determinísticos de regras textuais**, não porcentagens de verdade, respostas aleatórias ou evidências de checagem concluída. Os campos factuais `porcentagem` e `confianca` na raiz permaneceram `null`.

### Conformidade com a exigência desta auditoria

Apesar de não serem defaults, os números continuam possíveis quando a classificação é inconclusiva ou Não verificável. No caso 74, o Google nem foi consultado. A interface distingue o índice de uma probabilidade factual, mas isso **não cumpre a exigência estrita de suprimir pontuações quando não houve verificação/evidência suficiente**. Esta divergência foi registrada como F04, sem chamar o número de aleatório.

### Cache e consistência

- Google: chave por credencial/idioma/consulta, TTL de 10 minutos.
- `robots.txt`: cache por origem, TTL de 5 minutos.
- TensorFlow: runtime e modelos por diretório; não é cache de parecer.
- Não foi encontrado cache de pontuação/resultado completo neste fluxo.
- A/B/A com textos diferentes e testes locais com corpos iguais em domínios diferentes passaram. O índice usa o corpo extraído, não o endereço do site.
- A variação aleatória encontrada está na pequena espera de retry do Gemini, não no score ou no veredito.

## 6. Falhas confirmadas com reprodução

Prioridades: **P1 alta**, pode comprometer a conclusão apresentada; **P2 média**, compromete robustez, cobertura ou compreensão; **P3 baixa**, indicador auxiliar. Frequências abaixo referem-se aos casos executados, não à incidência geral em usuários.

### F01 — Sucesso vazio/incompleto aceito como parecer — P1

- **Entrada e passos:** enviar `A prefeitura anunciou uma nova biblioteca em 2025.` ao formulário real; em transporte controlado devolver HTTP 200 com `{"sucesso":true,"dados":null}`, `{"sucesso":true,"dados":{}}`, `{"sucesso":true,"dados":{"schemaVersion":2}}` ou `{"sucesso":true}`. Também foi injetado `{"sucesso":true,"dados":{"schemaVersion":2,"veredito":"Conteúdo verdadeiro"}}`, sem fontes/afirmações. JSON raiz `{}` é outro caso: ele não passa pela verificação de `sucesso` e não foi aceito como parecer.
- **Esperado:** rejeição do contrato, erro claro e nenhum parecer factual.
- **Obtido:** null/objeto vazio viram Registro legado; v2 vazio abre resultado inconclusivo; somente o rótulo verdadeiro é exibido como Conteúdo verdadeiro. O servidor também aceita saídas incompletas de um analisador injetado e devolve sucesso.
- **Evidência/frequência:** null, objeto vazio e v2 vazio repetidos **3/3 cada em JSDOM**; `dados` ausente e verdadeiro sem evidências **1/1 cada**. Confirmado **1/1 no navegador real com servidor local**, captura `ui-local-resposta-vazia.jpg`. Cinco variantes HTTP locais aceitaram saída inválida.
- **Causa confirmada:** `server.js:95` não valida a saída; `main.js:38–40` valida somente HTTP/sucesso; `result-renderer.js:61–76` aceita qualquer v2 ou converte ausência de dados em legado.
- **Impacto:** resposta parcial/defeituosa pode aparentar análise concluída e até mostrar um rótulo factual positivo sem fundamento.
- **Limite:** não ocorreu resposta vazia nas chamadas reais de produção desta auditoria. A falha foi provocada deliberadamente; não se demonstrou uma via pública de injetar esse envelope pelo texto de entrada.
- **Recomendação:** esquema de saída coerente no servidor e no cliente; separar renderização de novos resultados do tratamento de histórico legado.

### F02 — Expressões temporais relativas podem aproveitar checagem antiga — P1

- **Entrada:** `A prefeitura de Curitiba anunciou uma nova escola esta semana.` e variante `... neste mês.`.
- **Passos:** avaliar com metadados simulados de texto idêntico, avaliação Verdadeiro, domínio reconhecido e datas de checagem/alegação em agosto de 2025, durante a auditoria de novembro de 2026.
- **Esperado:** incerteza até resolver e comparar os períodos.
- **Obtido:** Conteúdo verdadeiro, evidência utilizável. Controle com `hoje` foi rejeitado.
- **Frequência/evidência:** **2/2 variantes vulneráveis**, 1/1 controle protegido; [code-audit-results.json](.artifacts/audit-2026-11-15/code-audit-results.json).
- **Causa confirmada:** lista incompleta em `services/evidence.js:48,103–104`; igualdade literal não fixa a semana/mês de referência.
- **Impacto/recomendação:** risco de atribuir uma checagem antiga ao presente. Exigir âncoras de contexto e regressões temporais. Não foi observada ocorrência equivalente em produção nesta amostra.

### F03 — JSON válido não impede invenção/contradição na prosa da IA — P1

- **Entrada do backend:** afirmação sobre escola, classificação Sem evidências suficientes, sem fontes.
- **Falhas injetadas:** feedback atribuindo uma escola em Marte ao “Instituto Horizonte”; outro dizendo que a notícia “não passa de uma mentira”, preservando o enum inconclusivo e referências vazias no JSON.
- **Esperado:** rejeitar afirmações/fontes não recebidas e contradição com o parecer.
- **Obtido/frequência:** ambas aceitas como explicação de IA, **2/2 respostas adversariais forçadas**.
- **Causa confirmada:** regex e IDs em `services/explanation.js:111–143,267` protegem apenas partes do contrato; fatos/entidades livres não são semanticamente conferidos.
- **Impacto:** comentário pode contradizer o rótulo correto ou introduzir fatos inventados.
- **Evidência:** `code-audit-results.json`, reprodução `code-audit.mjs`.
- **Limite/recomendação:** não foram observadas essas alucinações nas respostas reais amostradas. Reduzir prosa factual livre e ancorar blocos em trechos/IDs verificáveis; não prometer garantia semântica pela validação JSON.

### F04 — Índice numérico sem verificação factual — P2

- **Entradas/passos:** LIVE-12/LIVE-13 da seção 5; enviar e comparar classificação, estado Google e `analiseVisual.porcentagem`.
- **Esperado conforme o pedido:** ausência de pontuação quando não houve verificação/evidência suficiente.
- **Obtido:** 50 com resultado inconclusivo e zero fontes; 74 com Não verificável e Google não consultado. A interface informa que o índice não prova fatos.
- **Frequência:** **2/2 controles reais**; 74 também **1/1 no navegador**. Testes locais reproduziram esses índices durante falha de consulta Google.
- **Causa confirmada:** cálculo textual independente do estado factual; falta de condição de apresentação para os estados sem verificação.
- **Impacto/recomendação:** risco de interpretar a barra como credibilidade. Aplicar contrato explícito para suprimir o índice nessas situações, preservando os sinais descritivos. Não inventar novas pontuações para criar variação.
- **Evidências:** `live-live-12.json`, `live-live-13.json`, `browser-results.json`, `ui-74-medidor.jpg`.

### F05 — Data de calendário impossível pode fundamentar classificação — P2

- **Entrada:** metadados simulados válidos, exceto `data_verificacao:"2025-02-30"`.
- **Esperado:** rejeitar a data inexistente e preservar incerteza.
- **Obtido/frequência:** Conteúdo verdadeiro e evidência utilizável, **3/3**. Controle `2025-13-01` rejeitado 3/3; data válida aceita 3/3.
- **Causa confirmada:** `Date.parse` normaliza alguns dias impossíveis; `services/evidence.js:49–55` verifica finitude, não calendário estrito.
- **Impacto/recomendação:** metadados corrompidos podem ser aceitos. Validar componentes ISO/calendário e timezone de ambas as datas.
- **Evidência:** `code-audit-results.json`; não observada data impossível real no Google nesta amostra.

### F06 — TensorFlow carregado é descrito como análise executada — P2

- **Entrada:** opinião ou artigo sem checagens, runtime disponível e `comparacoesExecutadas:0`, modelo nulo.
- **Esperado:** distinguir disponibilidade, comparações realizadas e modelo treinado.
- **Obtido:** mensagem principal “TensorFlow.js: análise local executada”; detalhe explica que não houve comparação e que não existe modelo treinado em uso.
- **Frequência:** confirmado nos controles locais e em múltiplos resultados reais, incluindo opinião e Metrópoles no navegador.
- **Causa confirmada:** `result-renderer.js:333–334` consulta apenas `disponivel`; `tensorflow.js:125–134` marca o runtime antes de verificar pares.
- **Impacto/recomendação:** pode sugerir inferência inexistente. Usar contagem de comparações/estado do modelo na comunicação. Isso não significa ausência de todo processamento: extração e regras textuais executaram.
- **Evidências:** `code-tf-real-zero.json`, `browser-results.json`, respostas reais LIVE-10/LIVE-11.

### F07 — Falhas de rede/JSON mostram mensagens técnicas — P2

- **Entrada/passos:** formulário válido; rejeitar fetch, devolver corpo vazio, HTML em vez de JSON ou JSON `null`.
- **Esperado:** aviso compreensível em português, distinguindo rede e resposta inválida, com nova tentativa possível.
- **Obtido:** `Failed to fetch`, `Unexpected end of JSON input`, erro de token JSON ou `Cannot read properties of null`. Os controles são restaurados e o modal não abre.
- **Frequência:** quatro condições locais **1/1 cada**; interrupção de conexão local confirmada no navegador **1/1**.
- **Causa confirmada:** `main.js:38–44` expõe `error.message` sem normalização, salvo AbortError.
- **Impacto/recomendação:** erro visível, mas pouco acionável. Traduzir classes de falha e manter diagnóstico técnico seguro fora da mensagem ao usuário.
- **Evidências:** `local-ui-probes.json`, `ui-local-falha-rede.jpg`. Não foi provocada queda de rede do usuário ou dos provedores reais.

### F08 — Exceção inesperada da explicação aparece como IA desativada — P2

- **Entrada/passos:** analisador com `explain()` que lança uma exceção inesperada.
- **Esperado:** preservar o resultado e marcar explicação indisponível/falha.
- **Obtido/frequência:** estado `desativado`, motivo “IA opcional não configurada”, **1/1**.
- **Causa confirmada:** `services/analysis.js:135–136` usa fallback com `enabled:false`.
- **Impacto/recomendação:** oculta a natureza da falha. Usar fallback específico de indisponibilidade. As falhas HTTP/rede tratadas normalmente dentro de `generateExplanation` têm outro caminho e não devem ser confundidas com este caso.
- **Evidência:** `local-pipeline-probes.json`, PIPE-03; falha injetada, não ocorrência real observada.

### F09 — Opiniões e previsões comuns são tratadas como fatos — P2

- **Entradas:** `Esta cidade é maravilhosa.`, `Eu penso que a gestão foi ótima.`, `Daqui a dois anos a escola estará pronta.`.
- **Esperado:** opinião/previsão ou incerteza sobre o tipo.
- **Obtido/frequência:** `tipo:"fato"`, **3/3** no extrator.
- **Causa confirmada:** cobertura limitada das regras em `services/claims.js:15–19`.
- **Impacto/recomendação:** consultas desnecessárias e estado factual inadequado. Ampliar avaliação PT-BR e extração conservadora; a limitação já aparece genericamente no produto, mas continua reproduzível.
- **Evidência:** `code-audit-results.json`. Não se estimou taxa de erro num corpus representativo.

### F10 — Registro de teste ativo aparece como referência regional em produção — P2

- **Entrada:** `Uma notícia de teste de inicialização foi publicada no Paraná.`.
- **Passos:** enviar à API publicada; examinar `noticiasRegionais`, `fontes` e IDs utilizados. Também foram examinados ranking e fallback local.
- **Esperado:** dados de teste não serem oferecidos como referência jornalística.
- **Obtido:** HTTP 200 com “Notícia Teste de Inicialização”, atribuição `g1_parana`, URL `https://g1.globo.com/pr/teste-inicial`, fonte `n0`, tipo `noticia`, sem marca de simulação.
- **Frequência/evidências:** **1/1 em produção**, [catalog-live.json](.artifacts/audit-2026-11-15/catalog-live.json); reprodução em três camadas locais em [code-catalog.json](.artifacts/audit-2026-11-15/code-catalog.json).
- **Causa confirmada:** registro de teste no acervo ativo, sem filtro de proveniência/revisão no ranking/fallback. O renderer o apresenta no bloco de reportagens regionais.
- **Impacto:** dado de preenchimento é oferecido como contexto jornalístico e leva a uma página inexistente. Na checagem real de 21h46 de 15/11, a URL redirecionou por 301 para `/pr/teste-inicial/` e respondeu **404**, com título de página não encontrada da Globo. Frequência da checagem externa: **1/1**; não houve bloqueio 403 ou timeout nesse teste.
- **Proteção que funcionou:** geral Sem evidências suficientes, índice nulo e IDs de evidências utilizadas vazios. O registro **não foi promovido a prova factual**.
- **Recomendação:** retirar/quarentenar registros de teste e páginas genéricas, revisar JSON e coleção Mongo separadamente e registrar proveniência.
- **Observação adicional:** uma página `/empregos` da Rádio Colmeia também chegou ao contexto em teste local. A consulta externa confirmou HTTP 200, título de oportunidades de emprego e cabeçalho genérico capturado como notícia; `/ultimas-noticias` do G1 é igualmente uma página de listagem, disponível por HTTP 200. As seis URLs de artigos do G1 retornaram 200 com título/cabeçalho correspondentes ao acervo. Isso confirma existência e tema, sem validar os acontecimentos narrados. Evidência: [catalog-url-check.json](.artifacts/audit-2026-11-15/catalog-url-check.json). Os nove hashes do acervo conferem, o que prova integridade, não autenticidade.

### F11 — Cartão auxiliar ainda recebe bônus por nome de veículo — P3

- **Entrada/passos:** comparar `A biblioteca recebeu estudantes para ler novos livros.` com o mesmo texto acrescido de `G1`.
- **Esperado:** a mera menção a um veículo não comprovar qualidade das referências nem aumentar sua avaliação.
- **Obtido:** índice principal continua nulo, mas `dimensoes.fonte.pontuacao` passa de 0 para 15.
- **Causa confirmada:** parcela por menção de veículo em `verification-indicators.js:160–164`.
- **Impacto/recomendação:** indicador auxiliar pode sugerir referências melhores apenas pela marca. Rever seu critério separadamente. **Não é a causa do atual índice principal 50/74**, e não se deve confundir os dois números.
- **Evidência:** `code-audit-results.json`; uma comparação controlada.

## 7. Fontes e autenticidade: o que foi e não foi validado

O controle real utilizou a afirmação `Criança desenvolve autismo após receber 18 doses de vacina em um único dia`. O Google retornou uma [checagem do Estadão](https://www.estadao.com.br/estadao-verifica/18-vacinas-autismo-crianca-estados-unidos-falso/), com avaliação publicada Falso.

A publicação original foi efetivamente lida: 4.790 caracteres, mesma alegação e conclusão coerente com a avaliação indexada; foi extraída a data pública `2024-10-25T17:26:50-03:00`. O corpo integral não foi reproduzido no relatório. Evidências: [live-google-control.json](.artifacts/audit-2026-11-15/live-google-control.json), [live-control-source.json](.artifacts/audit-2026-11-15/live-control-source.json).

Na API de produção e no navegador, houve uma comparação real de TensorFlow com similaridade lexical 1. A API Google, porém, não forneceu `reviewDate`. O backend marcou a evidência como não utilizável e manteve Sem evidências suficientes. Essa preservação da incerteza está correta segundo o contrato atual; uma classificação factual conclusiva real ficou **bloqueada pela ausência do metadado**. Não se substituiu automaticamente a data da checagem pela data da alegação.

Conclusões de autenticidade:

- Há extração, consultas e comentários de IA reais; não é apenas uma tela preenchida com números aleatórios.
- Há um cálculo de TensorFlow real quando existem pares. Runtime disponível com zero pares não demonstra inferência, e não há classificador factual treinado/calibrado fornecido no projeto.
- A checagem real amostrada existe e é pertinente. Além dela, foram consultadas as nove URLs do acervo: seis artigos disponíveis com títulos correspondentes, duas páginas genéricas disponíveis e o link de teste com 404. Existência/tema não validam automaticamente as alegações que essas páginas ou o Google possam devolver.
- Metadados, igualdade textual e domínio reconhecido não equivalem à releitura integral de toda apuração.
- O acervo contém dado explícito de teste acessível pelo fluxo real de contexto, conforme F10.
- A prosa real amostrada foi cautelosa, mas os testes adversariais mostram que a validação não impede toda invenção.
- Não há avaliação rotulada independente para afirmar precisão, recall, ganho de qualidade ou calibração de percentuais.

## 8. Falhas de serviço, prazos e segurança funcional

Os testes locais adicionais confirmaram:

- Falha Google mantém incerteza, disponibilidade incompleta e nenhum ID de evidência utilizado no caso exercitado.
- Falha TensorFlow é declarada e não fabrica conclusão factual substituta.
- Respostas HTTP 500/503/429/504 controladas encerram o loading e permitem nova tentativa.
- Requisição frontend que não termina é abortada pelo prazo de **90 segundos**; mensagem em português e recuperação dos controles foram verificadas com relógio virtual.
- Prazo global de **45 segundos** do backend propaga cancelamento e retorna 504 `ANALYSIS_TIMEOUT`, também com relógio virtual.
- Uma análise já cancelada não chama o hook externo.
- Exceções internas da API não expuseram mensagens privadas nos testes de redação de erro.
- A suíte cobre conflitos de fontes, checagens apenas relacionadas, afirmações mistas, omissões, consultas incompletas, seis categorias e dois estados, SSRF/robots, contratos de IA/IDs, retries, cancelamento e isolamento de histórico/autenticação com fixtures.

Esses testes de indisponibilidade são **simulados/controlados**. Não se derrubou um provedor real nem se alegou ter observado uma indisponibilidade real que não ocorreu.

A consulta Vercel por logs `error/fatal`, entre 21h15m50 e 21h25m50 de 15/11 em São Paulo, não retornou registros. Evidência: [runtime-query.json](.artifacts/audit-2026-11-15/runtime-query.json). Isso não significa ausência de todos os problemas: erros tratados e falhas sem log podem não aparecer nesse filtro. Não foram expostas credenciais nos registros.

## 9. Recomendações em ordem de prioridade

1. **P1 — Contrato de saída:** impedir sucesso vazio/incompleto no servidor e no cliente; criar regressões para os formatos de F01, inclusive rótulo verdadeiro sem evidências.
2. **P1 — Contexto e datas:** impedir reutilização de períodos relativos antigos e validar calendário estritamente; medir falsos pareamentos por tempo, local, autoria e negação.
3. **P1 — Explicação da IA:** restringir conteúdo factual livre e ancorá-lo em evidências/trechos recebidos. Documentar que IDs/JSON válidos não garantem verdade da prosa.
4. **P2 — Remover dados de teste do contexto ativo:** revisar arquivo e banco, proveniência e páginas genéricas, sem presumir que corrigir o JSON limpa o MongoDB.
5. **P2 — Pontuação e disponibilidade:** aplicar a exigência de não mostrar score sem verificação/evidência suficiente e distinguir runtime TensorFlow de comparações realmente executadas.
6. **P2 — Erros:** normalizar mensagens de rede/JSON e distinguir integração indisponível de recurso desativado, com diagnósticos seguros.
7. **P2 — Cobertura:** avaliar extração de opiniões/previsões e metadados faltantes; considerar recuperação validada da data na fonte original, sem forçar classificações.
8. **P3 — Indicadores auxiliares:** rever pontuação por mera menção a veículo. Qualquer ajuste de modelo deve ter dados, avaliação independente e limitações verificáveis.

Nenhuma dessas recomendações foi aplicada nesta auditoria.

## 10. Limitações e itens bloqueados

| Item | Situação / o que falta |
|---|---|
| Seis classificações factuais em integração real | **Bloqueado/não validado integralmente.** Há cobertura controlada da suíte; o controle real pertinente não tinha data de checagem. Faltam amostras reais elegíveis e revisão das evidências de cada classe. |
| Precisão factual e calibração | **Não validado.** Faltam corpus rotulado independente, divisão temporal/por fonte e critérios de avaliação. |
| Conta, perfil, histórico autenticado, CRUD e recuperação por e-mail reais | **Bloqueado para integração real.** Não foram usadas credenciais nem criadas contas, enviados e-mails ou alterados registros. Faltam conta/ambiente de teste isolado e destinatário de testes; a suíte usa fixtures. |
| Queda real de Google/Gemini, quota esgotada e carga elevada | **Não induzido em produção.** Falhas equivalentes foram controladas localmente; faltam ambiente de homologação e orçamento/limites de teste de carga. |
| Perícia de imagem, áudio, vídeo e documentos | **Não disponível neste fluxo textual.** Não se validou adulteração de mídia por inspeção direta. |
| Conteúdo integral e sustentação factual de todas as fontes | **Não validado integralmente.** Uma checagem original foi lida. As nove URLs do acervo tiveram existência/títulos examinados: oito disponíveis e uma 404; seis são artigos e duas páginas genéricas. Alguns corpos foram limitados a 256 KiB na leitura. Faltam auditoria editorial e confronto de cada alegação com evidências independentes. |
| Todos os navegadores, dispositivos e acessibilidade completa | **Não validado integralmente.** Foram usados o navegador interno disponível, desktop e uma amostra móvel. Não houve auditoria completa com leitor de tela nem matriz de motores/dispositivos. |
| Fluxo real de compartilhamento e clipboard | **Não exercitado externamente nesta auditoria.** Coberto por testes locais, sem sobrescrever o clipboard ou enviar conteúdo a terceiros. |

Houve limitações da ferramenta de navegador: uma abertura inicial de aba expirou e foi recuperada; a mensagem de extração transitória desapareceu antes de uma leitura, e a repetição foi confirmada pelo diagnóstico do locator; um clique no detalhe de comparação expirou, mas a abertura por Enter funcionou. Esses incidentes de automação não foram classificados como bugs do site. O viewport temporário foi restaurado e o servidor local de falhas foi encerrado.

## 11. Evidências e repetição

- [local-findings.json](.artifacts/audit-2026-11-15/local-findings.json): resultados locais, frequências, locais de código e mapa da cobertura existente.
- [local-ui-probes.json](.artifacts/audit-2026-11-15/local-ui-probes.json), [local-api-probes.json](.artifacts/audit-2026-11-15/local-api-probes.json), [local-pipeline-probes.json](.artifacts/audit-2026-11-15/local-pipeline-probes.json): cada uma das 48 sondagens e seus resultados.
- [code-findings.md](.artifacts/audit-2026-11-15/code-findings.md), [code-audit-results.json](.artifacts/audit-2026-11-15/code-audit-results.json): reproduções adversariais e inspeção de código.
- [code-catalog.md](.artifacts/audit-2026-11-15/code-catalog.md), [catalog-live.json](.artifacts/audit-2026-11-15/catalog-live.json), [catalog-url-check.json](.artifacts/audit-2026-11-15/catalog-url-check.json): acervo, exposição real do registro de teste e checagem pública das nove URLs.
- [live-findings.md](.artifacts/audit-2026-11-15/live-findings.md), [live-summary.json](.artifacts/audit-2026-11-15/live-summary.json): integração real, inputs, outputs e consistência.
- [browser-results.json](.artifacts/audit-2026-11-15/browser-results.json): observações de interface e distinção entre produção e falhas forçadas locais.

Para repetir testes sem alterar o aplicativo:

```powershell
npm test
npm run check
node .artifacts/audit-2026-11-15/local-ui-probes.mjs
node .artifacts/audit-2026-11-15/local-api-probes.mjs
node .artifacts/audit-2026-11-15/local-pipeline-probes.mjs
node .artifacts/audit-2026-11-15/code-audit.mjs
node .artifacts/audit-2026-11-15/code-extra.mjs
node .artifacts/audit-2026-11-15/code-catalog.mjs
```

Os scripts `live-*`, `catalog-live.mjs` e `root-readonly.mjs` fazem chamadas reais e podem consumir quota; sua repetição não é equivalente a executar fixtures. O servidor `browser-fixture-server.mjs` serve os arquivos reais da aplicação com respostas deliberadamente defeituosas apenas em localhost. Os JSONs de artigos extensos foram reduzidos a hashes/extensões após inspeção, com registro de sanitização; não são cópias integrais redistribuídas das reportagens.

**Parecer final:** há processamento autêntico e preservação útil de incerteza, mas as falhas reproduzidas impedem aprovar irrestritamente a robustez e a confiabilidade da verificação. A prioridade é corrigir os defeitos comprovados e depois repetir os mesmos casos; variar números ou aceitar HTTP 200 como prova de funcionamento não resolve os problemas.
