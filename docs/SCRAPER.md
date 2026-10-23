# Coleta regional em JavaScript

O coletor usa Node.js com ES Modules. Os arquivos Python, o teste pytest e requirements.txt foram preservados durante a migração e retirados do projeto ativo na limpeza posterior. A implementação anterior e os snapshots de .migration-backup estão disponíveis em `backups/projeto-antes-da-limpeza-2026-10-23.zip`. Não há necessidade de instalar Python, Selenium Python, pandas ou pymongo para executar a aplicação, os testes ou a coleta atual.

## Execução

Na raiz do projeto, depois de `npm ci`:

```sh
npm run collect -- --source g1_parana --limit 5 --no-mongo
npm run collect -- --all --limit 10 --no-mongo
npm run collect -- --output-dir data/coleta-local --no-mongo
node scraper/coleta.js --help
```

Fontes preservadas: `g1_parana`, `o_parana`, `gazeta_do_povo`, `jornal_de_toledo`, `radio_colmeia` e `radio_cultura_toledo`. A configuração está em `scraper/config.js`. A coleta respeita os seletores, domínios permitidos, expressões de caminho e limites por fonte; cada layout pode exigir manutenção quando o portal mudar. Nenhuma coleta real foi necessária para executar os testes.

O limite deve ser um inteiro entre 1 e 500 por fonte. `--all` equivale a `--source all`; ambas as formas são aceitas. Códigos de saída: `0` para execução concluída, `1` para argumentos/configuração inválidos ou falha fatal e `2` para execução com falhas isoladas de coleta/persistência. As métricas são registradas em JSON sem o corpo das páginas, credenciais ou URLs fornecidas pelo usuário.

## Dados e migração do acervo

O contrato é preservado:

```json
{
  "titulo": "Título da notícia",
  "data_publicacao": null,
  "texto": "Texto extraído da matéria.",
  "url": "https://portal.example.com/noticia",
  "fonte": "identificador_da_fonte",
  "coletado_em": "2026-10-23T12:00:00.000Z",
  "content_hash": "SHA-256 hexadecimal de 64 caracteres"
}
```

`data_publicacao` permanece `null` quando não há informação temporal confiável. A normalização de texto usa Unicode NFC, em vez do NFKC antigo: isso preserva diferenças de significado como `10²` versus `102`, evitando falsas correspondências factuais. Datas com offset conservam o fuso da publicação. Datas sem fuso não recebem um offset inventado. `coletado_em` é UTC. O hash combina `titulo.trim().toLowerCase() + '|' + texto.trim().toLowerCase()` com SHA-256 em UTF-8, como no Python; hashes históricos válidos são preservados.

`StorageManager.loadRecords(paths)` lê o contrato português e os nomes antigos `title`, `text`, `date`, `source`, `collected_at`, mapeando-os para os campos atuais. A importação descarta duplicatas por URL normalizada ou hash e dá preferência à primeira origem informada.

O acervo ativo está consolidado em `data/noticias.json`, `data/noticias.jsonl` e `data/noticias.csv`. Os três arquivos representam os mesmos nove registros únicos em formatos diferentes; `scraper/data/` deixou de ser uma segunda origem distribuída junto da aplicação. A consolidação normalizou duas URLs por variação de barra final, preservando texto, hash e datas; uma versão alternativa de metadados permanece no backup. As versões anteriores, inclusive o contrato em inglês, estão no ZIP de recuperação `backups/projeto-antes-da-limpeza-2026-10-23.zip`.

Para normalizar e reexportar apenas o acervo local, sem coletar páginas nem usar MongoDB:

```sh
npm run collect -- --migrate-only --no-mongo
```

`--migrate-only` e `--no-import-legacy` continuam aceitos por compatibilidade. Sem uma origem legada presente, não há importação adicional automática. Destinos alternativos de `--output-dir` não importam o acervo do projeto automaticamente. Para trazer um arquivo PT/EN antigo recuperado do backup ou fornecido separadamente, use a importação programática em um destino explícito:

```js
import { StorageManager } from './scraper/storage.js';
await StorageManager.importLegacyRecords(['caminho/origem.json'], 'caminho/novo/noticias.json');
```

As saídas são `noticias.json` (UTF-8, lista estruturada com escrita em temporário exclusivo e substituição), `noticias.jsonl` e `noticias.csv` (UTF-8 com BOM, delimitador `;`). As três exportações são idempotentes por URL/hash, inclusive quando chamadas individualmente. Aspas, quebras de linha e delimitadores CSV são escapados. Células que possam ser interpretadas como fórmula por uma planilha recebem apóstrofo protetor; o JSON conserva o texto original.

JSON/JSONL inválidos interrompem a gravação daquele formato e são preservados para reparo. Um CSV antigo com cabeçalho inglês deve ser mantido na origem e exportado para outro destino, evitando misturar ordens diferentes de colunas. Locks exclusivos por arquivo impedem duas instâncias de sobrescreverem simultaneamente a mesma saída. Se um processo for encerrado à força e deixar `.lock`, verifique que nenhuma coleta está rodando antes de remover manualmente esse lock. Não há transação conjunta entre os três arquivos e MongoDB; uma interrupção pode deixar formatos temporariamente diferentes e a repetição da exportação repara o acervo sem duplicá-lo.

MongoDB é opcional, configurado por `MONGO_URI`, `MONGO_DB_NAME` e `MONGO_COLLECTION`. A gravação usa índice único de URL, `bulkWrite` com `$setOnInsert` e encerramento do cliente em `finally`. `--no-mongo` desativa a integração mesmo quando existe configuração. A coleção padrão continua `noticias_coletadas`.

Registros históricos de listagens ou dados de teste são preservados e não se tornam evidência de veracidade. A nova descoberta evita URLs de listagem comuns (`ultimas-noticias`, `empregos`, categorias, tags, autores) e a própria capa. Notícias do acervo servem como contexto; uma correspondência lexical ou a presença em um portal não confirma uma afirmação.

## Requisições e restrições de acesso

Todas as requisições HTTP, incluindo `robots.txt`, redirecionamentos e recursos do navegador, passam por `services/safe-http.js`. Esse cliente valida URL e DNS, bloqueia IPs privados/reservados e formas alternativas de loopback, fixa a conexão nos IPs públicos validados, limita portas, tamanho, tempo e número de redirects e impede downgrade HTTPS. A descoberta faz cache preliminar de validação por hostname dentro de uma página; cada acesso real mantém validação própria no transporte seguro.

O coletor consulta `robots.txt` antes da página e antes de cada destino de redirect. HTTP 404/410 no robots indica ausência de restrição publicada; 401/403, outros erros HTTP ou indisponibilidade impedem a coleta. A decisão é conservadora. `noarchive`/`nosnippet` em `X-Robots-Tag` ou em metatag também impedem persistir o artigo. O coletor não contorna paywalls ou login.

HTTP 429 e 5xx e falhas temporárias recebem tentativas limitadas com backoff e jitter. `Retry-After` é respeitado com teto de 30 segundos. Outros 4xx não recebem retry. O padrão é uma pausa de um segundo entre matérias, sem concorrência indiscriminada. Um artigo/fonte com falha não interrompe as outras fontes. A extração usa HTML estrutural, OpenGraph, `time` e JSON-LD e não executa o conteúdo recebido.

## Compatibilidade de `--selenium`

A opção antiga continua aceita e usa um adaptador opcional Playwright/Chromium em JavaScript. Não usa Python nem Selenium Python. Para habilitar o pacote e o navegador em ambiente próprio:

```sh
npm install --save-optional playwright
npx playwright install chromium
npm run collect -- --source g1_parana --limit 1 --selenium --no-mongo
```

O navegador é criado com sandbox e `javaScriptEnabled: false`. Scripts externos, XHR/fetch, workers, WebSockets, WebRTC, formulários POST, mídia, fontes e imagens não são executados/carregados. Somente documentos e estilos de domínios permitidos podem passar pela interceptação, sempre usando o mesmo transporte seguro. Há teto de 40 requisições, 8 MiB transferidos e 2 MiB de HTML final por página. Contextos e navegador são encerrados mesmo após falha.

Essa restrição atende ao requisito de não executar conteúdo recebido de páginas verificadas. Consequentemente, `--selenium` oferece renderização estática em navegador e não preserva a antiga execução de JavaScript de sites dinâmicos. Quando a matéria depende desse código, ela deve ser analisada com o texto copiado e colado; não há fallback silencioso que execute scripts. Ausência do pacote, do Chromium, do sandbox ou da capacidade de bloquear WebSockets gera falha orientativa. A renderização real com navegador não foi homologada por estes testes; as verificações do adaptador usam objetos simulados e não abrem sites.

## Testes e mapa da migração

```sh
node --test tests/scraper.test.js
```

A suíte JavaScript cobre os dez cenários do antigo `tests/test_scraper.py`, agora disponível somente no ZIP de recuperação: quatro campos do artigo, variações de layout, data ausente, URLs inválidas, deduplicação, timeouts/HTTP, JSON UTF-8 idempotente, falhas de persistência, continuidade da coleta e fechamento do navegador. Também cobre robots por redirect, bloqueio de scripts, importação inglês→português, corrupção preservada, escrita concorrente, CSV seguro, MongoDB com `finally` e métricas/códigos da CLI. DNS, transporte, tempos de espera, MongoDB e navegador são simulados; arquivos usam diretórios temporários isolados.

| Python arquivado no ZIP | JavaScript atual | Responsabilidade |
| --- | --- | --- |
| `config.py` | `config.js` | Fontes e parâmetros ambientais |
| `models.py` | `models.js` | Contrato e hash |
| `normalizers.py` | `normalizers.js` | Texto, URL e datas |
| `validators.py` | `validators.js` | Validação e política de URL |
| `extractors.py` | `extractors.js` | DOM, metadados e JSON-LD |
| `collectors.py` | `collectors.js` | HTTP/robots e navegador estático opcional |
| `deduplicator.py` | `deduplicator.js` | URLs e hashes |
| `storage.py` | `storage.js` | Arquivos e MongoDB |
| `coleta.py` | `coleta.js` | Pipeline, métricas e CLI |
| `__init__.py` | exports ESM por módulo | Imports sem inicialização Python |

Requests foi substituído pelo transporte seguro comum; BeautifulSoup por Cheerio; RobotFileParser por robots-parser; pymongo pelo driver mongodb já utilizado no projeto; pytest por node:test. pandas não era usado e não recebeu dependência equivalente desnecessária. O antigo webdriver-manager deixa de ser necessário.