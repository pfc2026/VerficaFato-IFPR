# VerificaFato IFPR

Aplicação Node.js/ES Modules para analisar notícias, mensagens e afirmações em português, recebidas por texto ou URL. Preserva conta, perfil, histórico, administração, fontes, educação e identidade visual do projeto existente.

## Aprender e praticar

A página inicial inclui checklist antes de compartilhar, dez aulas com referências, filtros por nível e quiz de cinco situações fictícias com respostas comentadas. O leitor pode marcar aulas como concluídas; o progresso fica somente no navegador. As aulas também abrem por endereço, como `/#licao-fontes`.

`public/js/education-content.js` reúne o currículo local. `GET /api/education` mantém esse material disponível sem MongoDB e acrescenta as aulas personalizadas do painel quando o banco está disponível. Revisões dos seis textos iniciais antigos são aplicadas apenas a registros reconhecidos como o seed intacto; edições administrativas são preservadas. A apresentação do resultado destaca a classificação por evidências e mantém o índice de linguagem identificado separadamente.

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
entrada/schema → extração segura → afirmações candidatas → consultas por afirmação e variações lexicais → TensorFlow.js → avaliação de evidências → indicadores originais → cartões de resultado → feedback complementar do Gemini.

O Google indexa verificações publicadas e não verifica qualquer notícia por conta própria. Cada avaliação é atribuída ao publicador, à afirmação original e à data. Resultados relacionados ficam visíveis para leitura, sem provar o conteúdo recebido. Notícias do acervo regional são apenas contexto.

As seis classificações são Verdadeiro, Falso, Parcialmente verdadeiro, Enganoso, Sem evidências suficientes e Não verificável. As primeiras quatro exigem correspondência textual, data válida e avaliação reconhecida de fonte configurada. Conflito, mistura de conclusões, consulta parcial, contexto relativo ou afirmação omitida tornam a conclusão geral inconclusiva. O medidor e os cartões originais foram restaurados. O percentual é um índice heurístico dos padrões do texto, sem calibração como probabilidade factual. A classificação por evidências é registrada separadamente.

A análise tem prazo total de 45 segundos e cancela chamadas externas quando o cliente encerra a conexão. O limite é 20.000 caracteres por conteúdo, oito afirmações por consulta e 2.000 caracteres por afirmação candidata; omissões são sinalizadas. A extração de afirmações/opiniões/previsões usa regras e tem limitações explícitas.

## IA e TensorFlow
TensorFlow.js executa TF-IDF/cosseno para comparar palavras. Isso é cálculo lexical real, sem treinamento e sem capacidade de julgar a verdade. Sensacionalismo é descrito por regras auditáveis. Um carregador de embeddings locais aceita somente modelo com contrato de português e avaliação documentada; nenhum modelo treinado ou métrica simulada é fornecido. Veja [MODELOS.md](docs/MODELOS.md).

A explicação por IA externa é opcional, com Gemini como provedor preferencial e OpenAI mantida como alternativa compatível. O exemplo usa AI_PROVIDER=gemini, GEMINI_API_KEY e GEMINI_MODEL; informe um identificador de modelo disponível na sua conta e compatível com saída estruturada. Não há modelo predefinido. Para ativar o envio, configure essas variáveis no servidor e altere ENABLE_AI_EXPLANATION para true. O padrão do exemplo continua false, sem envio ao Gemini ou à OpenAI.

GOOGLE_API_KEY pertence à Google Fact Check Tools API e é separada de GEMINI_API_KEY. Gemini acrescenta um comentário separado aos cartões originais; não altera os indicadores nem substitui a busca de checagens no Google ou a análise de linguagem com TensorFlow.js. Para usar OpenAI, selecione AI_PROVIDER=openai e configure OPENAI_API_KEY e OPENAI_MODEL, com um modelo disponível na conta que suporte Responses API e Structured Outputs.

O modelo produz um comentário breve em texto livre, limitado aos dados da análise. O contrato preserva a classificação, permite apenas IDs de afirmações/fontes recebidos e mantém os blocos factuais do servidor. URLs das referências são resolvidas no servidor. A validação rejeita campos extras, links na prosa, números não recebidos e algumas conclusões categóricas sem evidência. Essas guardas reduzem erros, mas não garantem a correção semântica de toda frase gerada. O cartão identifica o comentário como IA; indisponibilidade ou resposta inválida exibem um aviso local explícito. O modelo não recebe ferramentas de navegação ou execução.

## Coleta e migração
```powershell
npm run collect -- --help
npm run collect -- --source g1_parana --limit 5 --no-mongo
npm run collect -- --migrate-only --no-mongo
```
O último comando normaliza e reexporta o acervo local sem coletar páginas nem usar MongoDB. O acervo ativo foi consolidado em `data/noticias.json`, `data/noticias.jsonl` e `data/noticias.csv`, com nove registros únicos no mesmo contrato em português e sem duplicação por URL/hash. A importação PT/EN continua disponível para arquivos antigos fornecidos separadamente; o projeto ativo não distribui uma segunda cópia em `scraper/data/`. Veja [SCRAPER.md](docs/SCRAPER.md).

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
POST /api/verificar mantém {texto?,link?,cidade?,categoria?} e envelope {sucesso,dados}; envie apenas texto ou link. URL colada no campo texto também é detectada. dados.schemaVersion=2 inclui afirmacoes, resultados, fontes, analiseLinguagem, secoes e limitacoes. analiseVisual contém o medidor original, seus contadores, analiseLocal e dimensoes; feedbackGemini contém texto, status, provedor, modelo e referências. porcentagem e confianca na raiz continuam null porque a classificação factual não tem probabilidade calibrada; a pontuação visual fica explicitamente em analiseVisual. Registros antigos de histórico aparecem como legados; novas análises guardam o resultado integral.
Rotas de autenticação, perfil, histórico e CRUD administrativo mantêm seus caminhos. Senhas novas exigem 12 caracteres e até 72 bytes; senhas antigas continuam aceitas no login. Alterar senha revoga sessões existentes.

server.js é o servidor local; api/index.js reutiliza a mesma aplicação no Vercel e conecta ao banco sob demanda. Configure variáveis no ambiente de hospedagem. A migração não publicou nem alterou nenhum ambiente remoto. Em múltiplas instâncias, cache e rate limiting em memória são por instância: utilize limites compartilhados no gateway para produção distribuída.

Para a compatibilidade do carregador do Vercel, `sanitize-html` fica fixado em `2.18.1`, com override restrito à sua dependência `htmlparser2` em `10.1.0` (CommonJS). O parser ESM da versão 12 causava `ERR_REQUIRE_ESM` durante a inicialização da função. O override preserva a versão atual do sanitizador e a resolução do Cheerio.

O `vercel.json` também define instalação limpa com `npm ci` e `NODE_OPTIONS=--experimental-require-module` para as funções, conforme a [configuração oficial do Vercel](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration#experimental-nodejs-require-of-es-module). Assim, o runtime aceita a dependência ESM mesmo se essa combinação reaparecer no ambiente instalado. A reprodução isolada com `sanitize-html@2.18.1` e `htmlparser2@12` falha sem essa opção e passa com ela. Mantenha **os três arquivos** `vercel.json`, `package.json` e `package-lock.json` no mesmo commit; um redeploy do commit anterior não recebe a alteração local. No primeiro redeploy após a correção, não reutilize o cache de build antigo.

Se a configuração precisar ser aplicada diretamente no painel, adicione `NODE_OPTIONS` com valor `--experimental-require-module` nas variáveis de ambiente de Production e Preview e crie um novo deployment. Confira o commit de origem e o Root Directory do projeto para garantir que correspondem à pasta atualizada.

O teste `tests/runtime-compatibility.test.js` importa o handler com `--no-experimental-require-module` para reproduzir um carregador que não aceita `require()` de ESM. Também verifica a sanitização de HTML malformado e links perigosos após interpretação pelo navegador.

Documentos: [diagnóstico e plano](docs/MIGRACAO.md), [metodologia](docs/METODOLOGIA.md), [segurança](docs/SEGURANCA.md), [relatório de validação](docs/VALIDACAO.md), [relatório da entrega](docs/RELATORIO.md).

