# VerificaFato IFPR

Aplicação Node.js/ES Modules para analisar notícias, mensagens e afirmações em português, recebidas por texto ou URL. Preserva conta, perfil, histórico, administração, fontes, educação e identidade visual do projeto existente.

## Aprender e praticar

A página inicial inclui checklist antes de compartilhar, dez aulas com referências, filtros por nível e quiz de cinco situações fictícias com respostas comentadas. O leitor pode marcar aulas como concluídas; o progresso fica somente no navegador. As aulas também abrem por endereço, como `/#licao-fontes`.

`public/js/education-content.js` reúne o currículo local. `GET /api/education` mantém esse material disponível sem MongoDB e acrescenta as aulas personalizadas do painel quando o banco está disponível. Revisões dos seis textos iniciais antigos são aplicadas apenas a registros reconhecidos como o seed intacto; edições administrativas são preservadas. O resultado da análise é compacto e destaca uma estimativa percentual da IA e sua classificação; aulas e orientações gerais continuam nas áreas próprias da página inicial.

Para repetir a verificação de interação e layout, execute `node scripts/education-visual-check.mjs`. Ela usa análises simuladas e banco desconectado, sem chamadas a serviços de IA ou alteração de dados; as capturas ficam em `.artifacts/`.

## Executar
Requer Node.js 22.18 ou superior. Na pasta do projeto:
```powershell
npm ci
npm test
npm run check
npm start
```
Complete o arquivo .env existente a partir de [.env.example](.env.example), sem sobrescrever credenciais. Para iniciar o servidor local, JWT_SECRET deve conter pelo menos 32 caracteres aleatórios. Uma chave pode ser criada com:
```powershell
node --input-type=module -e "import {randomBytes} from 'node:crypto'; console.log(randomBytes(48).toString('base64url'))"
```
Guarde o valor somente no ambiente do servidor. Abra http://localhost:3000.

MongoDB é necessário para contas, histórico e CRUD. Sem banco, essas rotas respondem 503; a análise pública funciona em modo degradado. Configure GOOGLE_API_KEY para consultar checagens reais. Ausência de chave, falha de rede, falta de checagem ou modelo indisponível nunca produz confirmação factual.

## Análise
O mesmo pipeline atende texto e conteúdo extraído de URL:
entrada/schema → extração segura → afirmações candidatas → consultas por afirmação e variações lexicais → TensorFlow.js → validação de evidências no backend → estimativa e explicação estruturadas do Gemini → validação da resposta → resultado compacto.

O Google indexa verificações publicadas e não verifica qualquer notícia por conta própria. Cada avaliação é atribuída ao publicador, à afirmação original e à data. Resultados relacionados ficam visíveis para leitura, sem provar o conteúdo recebido. Notícias do acervo regional são apenas contexto.

A apresentação principal contém **Estimativa da IA**, com percentual de 0 a 100 e classificação derivada: até 30, **Provavelmente falso**; a partir de 70, **Provavelmente verdadeiro**; entre essas faixas, **Veracidade incerta**. É uma avaliação subjetiva do modelo sobre o conteúdo recebido, com aviso visível de que pode conter erros. Não é uma probabilidade estatística calibrada nem a contagem de fatos comprovados. A ausência de uma checagem Google não impõe um valor fixo ou prova de verdade/falsidade. Sem estimativa válida do provedor, a interface informa sua indisponibilidade, sem inventar 50, 74 ou outro número.

Separadamente, o parecer baseado em fontes conserva seis classificações: **Conteúdo verdadeiro, Parcialmente verdadeiro, Adulterado, Distorcido, Fora de contexto e Falso**, com os estados complementares **Sem evidências suficientes** e **Não verificável**. Essa conclusão factual exige correspondência textual, fonte identificada e reconhecida, datas válidas/coerentes, contexto não ambíguo e rótulo específico publicado. Conflito, mistura de conclusões, consulta parcial, contexto relativo ou afirmação omitida preservam a incerteza desse parecer. Cada afirmação conserva justificativa atribuída e IDs das fontes; a estimativa da IA não altera esse registro nem promove fontes relacionadas a evidências utilizadas.

Os critérios por fontes distinguem alteração material, apresentação enganosa de fatos reais e contexto incorreto. “Parcialmente verdadeiro” descreve partes corretas e erros na mesma afirmação; não resulta da mistura entre afirmações independentes. Metadados da API nem sempre discriminam essas partes ou o contexto original; a checagem é oferecida para leitura e a aplicação não realiza perícia de mídia. “Enganoso”/“misleading” e rótulos compostos não recebem categoria específica automaticamente; os [mapeamentos inteiros aceitos](docs/METODOLOGIA.md#critérios-e-mapeamentos-aceitos) estão centralizados em `RATING_MAPPINGS`. Disponibilidade, funções e limites dos serviços são explicados na seção “Como é feita a verificação”; o resultado mantém fontes e detalhes recolhíveis sem repetir painéis de orientação ou de aprendizagem.

O antigo índice heurístico de padrões textuais não é exibido como porcentagem de verdade. Seus dados locais continuam separados em `analiseVisual`, com escopo `padroes_textuais`, para os consumidores técnicos compatíveis; a elegibilidade anterior não é relaxada. O percentual principal vem de `estimativaIA`, e não de uma fórmula de linguagem ou da similaridade TensorFlow. `porcentagem` e `confianca` na raiz permanecem `null` para não confundir essa estimativa com uma medida factual calibrada.

A análise tem prazo total de 45 segundos e cancela chamadas externas quando o cliente encerra a conexão. O limite é 20.000 caracteres por conteúdo, oito afirmações por consulta e 2.000 caracteres por afirmação candidata; omissões são sinalizadas. A extração de afirmações/opiniões/previsões usa regras e tem limitações explícitas.

## IA e TensorFlow
TensorFlow.js executa TF-IDF/cosseno para comparar palavras. Isso é cálculo lexical real, sem treinamento e sem capacidade de julgar a verdade. Sensacionalismo é descrito por regras auditáveis. Um carregador de embeddings locais aceita somente modelo com contrato de português e avaliação documentada; nenhum modelo treinado ou métrica simulada é fornecido. Veja [MODELOS.md](docs/MODELOS.md).

A explicação por IA externa é opcional, com Gemini como provedor preferencial e OpenAI mantida como alternativa compatível. O exemplo usa AI_PROVIDER=gemini, GEMINI_API_KEY e GEMINI_MODEL; informe um identificador de modelo disponível na sua conta e compatível com saída estruturada. Não há modelo predefinido. Para ativar o envio, configure essas variáveis no servidor e altere ENABLE_AI_EXPLANATION para true. O padrão do exemplo continua false, sem envio ao Gemini ou à OpenAI.

GOOGLE_API_KEY pertence à Google Fact Check Tools API e é separada de GEMINI_API_KEY. Na mesma chamada, Gemini fornece uma estimativa numérica considerando o texto completo disponível, o parecer por fontes e os sinais reais do TensorFlow, além de selecionar a explicação autorizada. O modelo pode usar seu conhecimento geral na estimativa, sem apresentá-lo como fonte externa consultada. Ele não altera a classificação factual do backend, a disponibilidade dos serviços nem os IDs de evidências utilizadas. Os três componentes têm funções diferentes e não representam três confirmações independentes. Para usar OpenAI, selecione AI_PROVIDER=openai e configure OPENAI_API_KEY e OPENAI_MODEL, com um modelo disponível na conta que suporte Responses API e Structured Outputs; não há troca silenciosa de provedor.

Resumo, orientação e comentário factual continuam limitados aos blocos exatos compostos pelo servidor. Um ID existente não autoriza prosa factual livre, entidades, acontecimentos ou URLs novos; as referências só apontam às evidências elegíveis utilizadas. O campo numérico novo da estimativa e seus motivos autorizados são validados separadamente, com classificação derivada no servidor para manter coerência com o percentual. Resposta inválida, desativação, erro inesperado e timeout permanecem estados distintos e não geram pontuação substituta. O modelo não recebe ferramentas de navegação ou execução, e instruções presentes na notícia são dados não confiáveis.

Motivos que mencionam uma checagem ou uma comparação precisam corresponder ao que foi efetivamente encontrado/executado. Uma estimativa que contradiz uma conclusão factual já fundamentada de Verdadeiro/Falso é rejeitada, sem ajustar artificialmente seu número. A estimativa pode continuar disponível quando o parecer por fontes é inconclusivo, desde que o novo contrato seja válido e seu caráter subjetivo esteja identificado.

Na mesma chamada, o Gemini pode selecionar referências para **Contexto Jurídico**, com distinção entre o acontecimento relatado e riscos da própria publicação. A seção aparece somente com referências verificadas e pertinentes. Lei, artigo, explicação, consequências e link vêm de uma base revisada de fontes oficiais; o modelo escolhe IDs e trechos literais, sem gerar penas ou URLs livres. Uma falha jurídica não invalida o comentário jornalístico. A base inicial foi conferida em 11/11/2026 e precisa de revisão antes de 11/12/2026, 00:00 UTC; depois desse prazo deixa de fornecer novas referências. O estado da base aparece em `/api/status`. Consulte [CONTEXTO-JURIDICO.md](docs/CONTEXTO-JURIDICO.md) para fontes, limites e inclusão de outros dispositivos verificados.

Os resultados reais do TensorFlow aparecem em detalhes recolhíveis e são enviados ao Gemini como sinais estruturados limitados. O sistema não usa similaridade lexical como prova de verdade. A [auditoria de ML](docs/AUDITORIA-ML-2026-11-11.md) registra os defeitos reproduzidos, as correções e a ausência de dados para afirmar ganho de precisão factual.

Para repetir a validação real, com notícias sintéticas e as credenciais do servidor: `node scripts/verify-gemini-live.mjs`. O comando realiza chamadas externas e salva um relatório local em `.artifacts/gemini-live-results.json`, sem credenciais. `node scripts/legal-visual-check.mjs` verifica esses resultados no Chrome em desktop e celular; `--fixture` exercita seis referências com dados de teste explicitamente identificados, sem chamar Gemini. Falhas HTTP, rejeições de contrato e ausência de referências esperadas fazem o teste real falhar, mesmo se a rota responder HTTP 200. O Gemini recebe normalmente uma chamada para análise e seleção jurídica juntas. Após HTTP 408, 500, 502, 503 ou 504, pode haver uma única nova tentativa, com espera de aproximadamente um segundo e pequena variação aleatória; HTTP 429 só é repetido com `Retry-After` válido. A espera indicada pelo provedor é respeitada ou a repetição é abandonada se não couber no prazo. As duas tentativas e a espera compartilham os mesmos 20 segundos, dentro dos 45 segundos globais; cancelamento interrompe também a espera. Autenticação, configuração, falha de rede, resposta inválida e recusa do modelo não são repetidas. Não há troca silenciosa de modelo. `geracao.tentativas` e `geracao.httpProvedor` permitem conferir chamadas efetivas e último HTTP recebido, sem expor credenciais ou corpo do erro.

## Coleta e migração
```powershell
npm run collect -- --help
npm run collect -- --source g1_parana --limit 5 --no-mongo
npm run collect -- --migrate-only --no-mongo
```
O último comando normaliza e reexporta o acervo local sem coletar páginas nem usar MongoDB. O acervo ativo está em `data/noticias.json`, `data/noticias.jsonl` e `data/noticias.csv`, com seis artigos revisados no mesmo contrato em português e sem duplicação por URL/hash; três registros auditados foram preservados separadamente em `data/noticias-quarentena.json`. A importação PT/EN continua disponível para arquivos antigos fornecidos separadamente; o projeto ativo não distribui uma segunda cópia em `scraper/data/`. Veja [SCRAPER.md](docs/SCRAPER.md).

Durante a migração inicial, Python e os snapshots de código foram preservados para conferência. Na limpeza posterior, os arquivos Python, seus testes, `requirements.txt` e as cópias de `.migration-backup/` foram arquivados em [backups/projeto-antes-da-limpeza-2026-10-23.zip](backups/projeto-antes-da-limpeza-2026-10-23.zip) e retirados da árvore ativa. Execução, testes e coleta usam somente Node.js.

## Organização

```text
server.js              servidor local
api/                   entrada do deploy
services/              análise, evidências, Google, Gemini e transporte seguro
routes/ middleware/    APIs, autenticação e validação
models/                modelos MongoDB
scraper/               coleta regional em JavaScript
data/noticias.*        acervo único em JSON, JSONL e CSV
public/                interface, estilos e imagens utilizadas
tests/                 testes JavaScript
scripts/               verificações de código e QA visual
docs/                  metodologia, segurança, histórico e relatórios
backups/               arquivos ZIP de recuperação local
```

`backups/` fica excluído do versionamento e do deploy; mantenha o ZIP para recuperação local. Ele preserva os códigos e acervos anteriores, sem incluir o arquivo .env, dependências instaladas ou perfis temporários do navegador. Dependências, segredos e arquivos temporários também ficam fora desses envios. Para repetir a inspeção visual, execute `node scripts/visual-check.mjs`: ele usa um servidor local e serviços simulados, sem MongoDB ou credenciais reais, e gera capturas temporárias em `.artifacts/`. Essas capturas não fazem parte do código da aplicação.

## APIs e deploy
POST /api/verificar mantém {texto?,link?,cidade?,categoria?} e envelope {sucesso,dados}; envie apenas texto ou link. URL colada no campo texto também é detectada. dados.schemaVersion=2 inclui afirmacoes, resultados, fontes, analiseLinguagem, secoes, limitacoes, parecerIntegrado, estimativaIA e disponibilidade dos serviços. Servidor e cliente validam tipos, campos, IDs e coerência das evidências antes de aceitar sucesso; schemaVersion sozinho não valida um parecer. `estimativaIA` contém status, porcentagem inteira 0–100 ou null, classificacao derivada ou null, provedor/modelo, metodo `estimativa_ia` e motivos autorizados. Os estados `indisponivel` e `nao_aplicavel` não contêm score inventado. `analiseVisual` continua como dado técnico de padrões textuais e não alimenta o medidor principal por uma fórmula. feedbackGemini contém texto autorizado, status, provedor, modelo e referências. porcentagem e confianca na raiz continuam null porque não há probabilidade factual calibrada. Histórico guarda o parecer e a estimativa recebidos; registros antigos não ganham estimativa nova sem consulta, e uma resposta nova incompleta nunca é reinterpretada como legado.
Rotas de autenticação, perfil, histórico e CRUD administrativo mantêm seus caminhos. Senhas novas exigem 12 caracteres e até 72 bytes; senhas antigas continuam aceitas no login. Alterar senha revoga sessões existentes.

server.js é o servidor local; api/index.js reutiliza a mesma aplicação no Vercel e conecta ao banco sob demanda. Configure variáveis no ambiente de hospedagem. Alterar o código ou o acervo local não publica uma versão. O comando explícito `node scripts/review-archive.js --mongo --apply` altera o banco configurado, preservando os originais em backup antes de revisar/quarentenar registros; use `--mongo` sem `--apply` para inspecionar o plano. Em múltiplas instâncias, cache e rate limiting em memória são por instância: utilize limites compartilhados no gateway para produção distribuída.

Para a compatibilidade do carregador do Vercel, `sanitize-html` fica fixado em `2.18.1`, com override restrito à sua dependência `htmlparser2` em `10.1.0` (CommonJS). O parser ESM da versão 12 causava `ERR_REQUIRE_ESM` durante a inicialização da função. O override preserva a versão atual do sanitizador e a resolução do Cheerio.

O `vercel.json` também define instalação limpa com `npm ci` e `NODE_OPTIONS=--experimental-require-module` para as funções, conforme a [configuração oficial do Vercel](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration#experimental-nodejs-require-of-es-module). Assim, o runtime aceita a dependência ESM mesmo se essa combinação reaparecer no ambiente instalado. A reprodução isolada com `sanitize-html@2.18.1` e `htmlparser2@12` falha sem essa opção e passa com ela. Mantenha **os três arquivos** `vercel.json`, `package.json` e `package-lock.json` no mesmo commit; um redeploy do commit anterior não recebe a alteração local. No primeiro redeploy após a correção, não reutilize o cache de build antigo.

Se a configuração precisar ser aplicada diretamente no painel, adicione `NODE_OPTIONS` com valor `--experimental-require-module` nas variáveis de ambiente de Production e Preview e crie um novo deployment. Confira o commit de origem e o Root Directory do projeto para garantir que correspondem à pasta atualizada.

O teste `tests/runtime-compatibility.test.js` importa o handler com `--no-experimental-require-module` para reproduzir um carregador que não aceita `require()` de ESM. Também verifica a sanitização de HTML malformado e links perigosos após interpretação pelo navegador.

Documentos: [diagnóstico e plano](docs/MIGRACAO.md), [metodologia](docs/METODOLOGIA.md), [segurança](docs/SEGURANCA.md), [relatório de validação](docs/VALIDACAO.md), [relatório da entrega](docs/RELATORIO.md).

