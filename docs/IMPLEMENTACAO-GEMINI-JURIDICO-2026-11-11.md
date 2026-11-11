# Relatório técnico — Gemini, TensorFlow e Contexto Jurídico

Implementação e validação local em 11/11/2026. A arquitetura existente foi preservada: entrada → extração/afirmações → Google Fact Check e TensorFlow → avaliação de evidências → explicação Gemini → renderizador compartilhado com o histórico.

As correções e a nova seção foram implementadas. A suíte final passou com **287 testes, zero falhas e nenhum teste ignorado**. Houve análises reais válidas nos seis cenários editoriais solicitados, em chamadas de rodadas distintas, incluindo apresentação no DOM. A disponibilidade do Google continuou intermitente: algumas tentativas retornaram HTTP 503. A aprovação editorial da qualidade das respostas permanece com o usuário.

## Diagnóstico do Gemini

A configuração local já tinha `ENABLE_AI_EXPLANATION=true`, `AI_PROVIDER=gemini`, `GEMINI_API_KEY` presente e `GEMINI_MODEL=gemini-3.5-flash-lite`. A chave não foi impressa, substituída ou enviada ao frontend. O projeto usa REST com `fetch`, sem SDK Gemini para migrar.

O endpoint `v1beta/models/{model}:generateContent`, o header `x-goog-api-key` e o contrato `generationConfig.responseFormat.text.schema` funcionaram em chamadas reais: HTTP 200, `finishReason=STOP`, JSON validado e `geracao.status=ia`. Portanto, não há evidência de chave inválida, modelo permanentemente incompatível ou formato REST quebrado nessa configuração. O formato foi confrontado com a [referência oficial do Google](https://aistudio.google.com/api-reference/generate-content).

A falha efetivamente reproduzida foi **HTTP 503 do provedor**, intercalada com respostas válidas. O código anterior escondia autenticação, quota, timeout, rede e contrato inválido sob o mesmo aviso genérico. Essa falta de diagnóstico foi corrigida. Não é possível atribuir retrospectivamente toda falha anterior da implantação à mesma causa sem seus logs e variáveis de produção.

O sandbox inicial também bloqueou DNS externo, localhost e algumas operações de arquivo temporário. Os testes afetados foram repetidos com execução autorizada fora dessas restrições; esses bloqueios locais não foram tratados como defeitos do software. Uma interrupção temporária da revisão automática de aprovação foi resolvida ao retomar a execução.

Foram comparados modelos disponíveis na listagem da conta sem alterar o `.env`. Outros modelos também apresentaram 503; um identificador antigo listado pelo Google retornou 404 ao gerar. O modelo configurado foi preservado, sem troca silenciosa ou repetição automática de chamadas.

## Correções e comportamento

- Gemini: códigos públicos seguros para autenticação, limite, timeout, rede, configuração, indisponibilidade e resposta inválida; nenhuma mensagem bruta do provedor é devolvida ao cliente.
- Prazo da chamada aumentado de 10 para 20 segundos, respeitando os 45 segundos globais; timeout também cobre a leitura do corpo da resposta.
- Notícia integral até 20.000 caracteres e até 24 comparações estruturadas do TensorFlow chegam ao Gemini, junto de método, estado, limitações e tipos heurísticos de afirmação.
- Resumo, orientação, fontes, indicadores e veredito existentes foram preservados. Uma falha externa mostra indisponibilidade explícita, mantendo apenas a análise local efetivamente executada.
- A orientação ao modelo diferencia alegação, opinião, fato verificado e hipótese jurídica. Ausência de checagens não impede contextualizar condicionalmente uma investigação relatada.
- TensorFlow: corrigidos Unicode, esgotamento do vocabulário por artigo longo, arredondamentos fora da faixa do cosseno, cache semântico por runtime/diretório, recuperação de carga e validação de entradas/saídas do modelo.
- Interface: comparações reais e estado do TensorFlow passaram a aparecer em detalhes recolhíveis. Quando faltam pares ou pesos, não são criadas métricas para preencher a interface.

Na reprodução numérica, um par idêntico após texto longo passou de cosseno 0 para aproximadamente 0,99999994; grafias equivalentes em NFC/NFD passaram de aproximadamente 0,24337 para 0,99999994. Isso demonstra correção do cálculo lexical, **não aumento comprovado da precisão factual**. Não há pesos, corpus rotulado ou modelo treinado fornecido; `TFJS_MODEL_DIR` está ausente. Nenhum treinamento foi realizado. Consulte a [auditoria de ML](AUDITORIA-ML-2026-11-11.md).

## Contexto Jurídico

A mesma chamada de geração pode produzir `contexto_juridico`. O Gemini seleciona IDs de candidatos, categoria, trecho literal da notícia e situação jurídica com seu trecho de suporte. O backend fornece nome da lei, artigo, explicação, consequências, ressalvas e fonte a partir de **22 referências previamente conferidas em 13 fontes oficiais**, abrangendo as famílias de legislação solicitadas.

O modelo não pode escrever livremente artigos, penas ou URLs jurídicas. IDs desconhecidos, campos adicionais, fontes inventadas, trechos inexistentes, categorias incompatíveis e relações sem suporte são descartados. Se apenas a etapa processual não puder ser vinculada ao fato, ela passa a “Situação não identificada”, com ressalva. Uma referência rejeitada não elimina as demais nem o comentário jornalístico válido.

Há guardas para não transformar título cultural em corrupção; notícia sem fontes em calúnia; denúncia na delegacia em denúncia processual; “não foi condenado” ou pergunta sobre condenação em condenação confirmada; nem o relato de uma investigação em infração da publicação. A LGPD é contextualizada no incidente da empresa, respeitando sua exceção para tratamento exclusivamente jornalístico.

A seção usa o estilo existente, balança da justiça, categorias explícitas, cards expansíveis e até três referências iniciais; outras três podem ser abertas. Se não houver referência aceita, a seção inteira fica oculta. O histórico usa o mesmo renderizador e apresenta a data de conferência da fonte.

Base ausente, inválida ou expirada desabilita somente as referências jurídicas. `/api/status` expõe o estado seguro em `servicos.baseJuridica`. Fontes, critérios, exceções e processo de extensão estão em [CONTEXTO-JURIDICO.md](CONTEXTO-JURIDICO.md).

## Arquivos desta implementação

O workspace já continha diversas alterações anteriores. A tabela identifica os arquivos trabalhados nesta solicitação, sem atribuir a ela todas as diferenças existentes no Git.

| Área | Arquivos |
| --- | --- |
| Serviços | `services/explanation.js`, `services/analysis.js`, `services/tensorflow.js`, `services/legal-context.js`, `services/readiness.js` |
| Base oficial | `data/legal-catalog.json` |
| Interface | `public/js/result-renderer.js`, `public/css/style.css` |
| Configuração e documentação | `vercel.json`, `.env.example`, `README.md`, `docs/MODELOS.md`, `docs/AUDITORIA-ML-2026-11-11.md`, `docs/CONTEXTO-JURIDICO.md`, este relatório |
| Testes | `tests/gemini.test.js`, `tests/ai-diagnostics.test.js`, `tests/integrated-context.test.js`, `tests/tensorflow.test.js`, `tests/legal-context.test.js`, `tests/legal-availability.test.js`, `tests/legal-frontend.test.js`, `tests/frontend-analysis-details.test.js` |
| Verificação executável | `scripts/verify-gemini-live.mjs`, `scripts/legal-visual-check.mjs` |

Não foram adicionadas dependências, removidas funcionalidades importantes ou alterados o layout principal e a navegação. O catálogo foi incluído explicitamente no empacotamento Vercel. Não houve publicação de uma nova implantação.

## Testes e evidências

`npm test`: **287/287 aprovados**, incluindo autenticação, recuperação, histórico, extração, SSRF, coleta, compatibilidade de runtime e indicadores anteriores. Log: `.artifacts/final-tests-2026-11-11.log`.

`npm run check`: **80 arquivos JavaScript com sintaxe válida**, além de manifestos JSON válidos. Os últimos arquivos jurídicos também passaram por `node --check` após sua revisão final.

| Cenário solicitado | Resultado técnico |
| --- | --- |
| Evento cultural comum | Testes locais e chamada real: análise válida, sem seção jurídica |
| Investigação de corrupção | Testes locais e chamada real: CP 317, acontecimento noticiado, situação Investigação, sem conclusão de culpa |
| Vazamento de dados | Testes locais e chamada real: LGPD 46 aceita; seleção adicional sem trecho suficiente foi descartada |
| Desinformação eleitoral | Testes locais e chamada real: Código Eleitoral 323, acontecimento noticiado, situação Investigação |
| Acusação não comprovada | Testes locais e chamada real: incerteza jornalística, sem inferir calúnia por ausência de fontes |
| Informação incorreta sem crime | Teste com checagem correspondente mantém Falso e nenhum crime; chamada real do cenário de correção mantém análise válida sem inventar lei |
| Falha da API | 401/403, 400/404, 429, 503, 504, rede, timeout e JSON inválido simulados; 503 também observado de fato; sem credenciais na resposta |
| Referência inválida | Lei/ID/artigo/URL inventados, recortes, situações de outro caso e catálogo indisponível rejeitados ou isolados conforme o campo |
| Compatibilidade | Suíte completa, rota HTTP real com provedor simulado, TensorFlow real e renderizador compartilhado aprovados |

Nas chamadas reais, não bastou HTTP 200: o script exigiu JSON validado, `geracao.status=ia`, feedback correspondente no DOM, pertinência jurídica esperada e exatamente **uma chamada Gemini por notícia**. Google Fact Check e TensorFlow também foram executados de fato; banco e acervo regional ficaram fora desse smoke test. Os seis cenários tiveram passagens reais em rodadas distintas; não houve uma rodada única com seis sucessos consecutivos, devido aos 503 intermitentes. As chamadas reais com notícias sintéticas não garantem resultados equivalentes para qualquer notícia.

Evidência preservada de corrupção: `.artifacts/gemini-live-corrupcao-validado.json`. O resultado eleitoral está em `.artifacts/gemini-live-results.json` e no arquivo datado correspondente. O script passou a arquivar cada nova execução para preservar resultados anteriores.

Chrome desktop 1440 px e celular 390 px: resultado real de LGPD e, depois, eleitoral inspecionados, com **zero estouro horizontal**. A fixture explicitamente identificada exercitou seis referências, três iniciais, abertura das demais e comparações TensorFlow reais, sem chamada Gemini. Evidências: `.artifacts/legal-visual-report.json`, `.artifacts/legal-visual-fixture-report.json` e capturas `legal-*.png`; os resultados com origem real e fixture são identificados separadamente.

## Limitações e configuração

Não é necessária uma segunda API jurídica ou uma nova chave. A ativação usa as variáveis Gemini já existentes no servidor; credenciais de produção precisam ser configuradas no ambiente da implantação, que não foi publicado nem auditado remotamente nesta tarefa.

A disponibilidade externa permanece sujeita aos 503 do Google. O tratamento foi corrigido e as respostas válidas foram demonstradas; o código não pode garantir disponibilidade do provedor. Não foram inventados resultados para contornar essas falhas.

O catálogo é uma fotografia revisada, sem atualização oficial em tempo real. Sua janela atual termina em **10/12/2026 às 21h de Brasília** (11/12/2026, 00:00 UTC). É necessário conferir as fontes antes de renovar as datas. Normas ainda não incluídas ou não verificadas são omitidas; a ampliação documentada admite outros dispositivos oficiais após revisão.

Regras de linguagem, associação de sujeitos e pertinência jurídica continuam conservadoras e podem omitir casos legítimos ou exigir ajuste editorial. Não há métrica de precisão jurídica ou factual aprovada, nem fine-tuning sem corpus. O MongoDB real não foi validado nestes testes; seus contratos e fluxos anteriores passaram pela suíte automatizada com isolamento.

A avaliação final da precisão, contextualização e utilidade das respostas deve ser feita manualmente pelo usuário, conforme solicitado.
