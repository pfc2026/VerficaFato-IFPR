# Entrega e organização do VerificaFato — 23/10/2026

## Projeto
C:/Users/Luiz/Documents/VerficaFato-IFPR-main (1)/VerficaFato-IFPR-main

A pasta originalmente configurada no chat não existia. As alterações foram feitas nesta cópia localizada, que não contém .git. Não foram criados commits, PRs ou deploys.

## Implementado
- Backend e coletor Node.js/ES Modules; aplicação sem dependência de Python.
- Entrada por texto ou URL, afirmações individuais, Google Fact Check, fontes com datas e classificação conservadora baseada em evidências.
- TensorFlow.js no cálculo lexical e carregador opcional de modelo semântico avaliado para português.
- Gemini como provedor preferencial da explicação estruturada. OpenAI permanece como alternativa explícita, sem dependência adicional.
- Comentário complementar em linguagem natural pelo Gemini, separado dos resultados e indicadores calculados. Schema, referências por IDs e guardas locais; aviso explícito em caso de indisponibilidade.
- Modelo original restaurado a partir da imagem e do backup: medidor, contadores, três dimensões, extração, características e checagens externas. Feedback do Gemini acrescentado ao final. Histórico completo v2, perfil e administração preservados.
- Proteções contra SSRF, XSS e operadores Mongo; JWT estrito, sessões revogáveis, schemas, CSP/CORS, rate limiting, limites de recursos e métricas privadas.

## Gemini configurado e validado
A credencial fornecida foi salva somente no .env. A autenticação retornou HTTP 200 na listagem de modelos. Uma chamada real de geração com gemini-3.5-flash-lite retornou HTTP 200, passou pelo schema local e produziu geracao.status="ia" e geracao.provedor="gemini".
O primeiro modelo testado apresentou alta demanda; o modelo leve validado ficou configurado no ambiente.
A chamada de validação usou apenas texto técnico fictício. Não foram enviados dados de conta ou notícias do acervo. A chave não foi exibida nos diagnósticos, incluída no código ou copiada para o ZIP.

## Limpeza autorizada
Foram removidos da árvore ativa:
- Os onze arquivos .py, requirements.txt, caches __pycache__ e .pytest_cache.
- Os wrappers sem consumidores googleService.js e verificationEngine.js; o verificador de sintaxe foi ajustado.
- As cópias espalhadas em .migration-backup, os perfis temporários do Chrome e as capturas temporárias.
- As imagens sem referências principal.png e barra de pesquisa.png. A imagem Logo oficial.png e os recursos usados pelo layout foram preservados.
- A pasta de dados duplicada scraper/data, depois da consolidação e conferência dos registros.

O relatório está em docs/RELATORIO.md e o gerador visual em scripts/visual-check.mjs. Regras de exclusão foram simplificadas para proteger segredos, backup e arquivos temporários.

## Dados e recuperação
data/noticias.json, noticias.jsonl e noticias.csv contêm os mesmos nove registros em português, com nove URLs e nove hashes únicos. Textos, títulos, datas, origem, coleta e hashes foram preservados; duas URLs tiveram apenas a barra final normalizada.
As versões anteriores dos seis arquivos e a variante de metadados da listagem antiga permanecem no backup.

Backup original: backups/projeto-antes-da-limpeza-2026-10-23.zip, com 121 arquivos e manifesto SHA-256 verificado antes das exclusões. Inclui fontes anteriores, snapshots de migração, acervos originais e capturas. Não inclui .env, node_modules ou perfis de navegador. Está excluído do versionamento e do deploy.
SHA-256 do ZIP: 04bce7c29f4a46617a79f8186710dafa991f904c7cd838e5d5c4a51376e0a6ab.

Antes do retorno visual, também foi criado backups/antes-do-retorno-visual-2026-10-23.zip: 72 arquivos do projeto, com manifesto e hashes conferidos, sem .env, dependências ou outros backups.

## Validação final
**129 testes passaram; 51 arquivos JavaScript passaram na análise de sintaxe.** A auditoria npm anterior reportou zero vulnerabilidades conhecidas; as dependências não foram alteradas nesta rodada.
A restauração foi inspecionada em Chrome desktop de 1440 px e celular de 475 px, sem overflow horizontal. O exemplo da imagem retornou 50%, contadores 0/0/8/0 e dimensões 0/0/8. Uma nova chamada real do Gemini respondeu HTTP 200, gerou comentário livre válido e preservou a classificação calculada. Veja [VALIDACAO.md](VALIDACAO.md).

## Pendências técnicas
Nenhum modelo semântico treinado para português está incluído. O TensorFlow executa comparação lexical real; ativar embeddings exige pesos, vocabulário e avaliação compatíveis com [MODELOS.md](MODELOS.md).
MongoDB e Google Fact Check mantiveram suas configurações anteriores, sem uso real nesta rodada. Não houve atualização do banco remoto, coleta pública ou deploy. Cache, métricas e rate limit são por processo; produção distribuída requer infraestrutura compartilhada.

Execução e configuração: [README](../README.md) e [.env.example](../.env.example).
Referências: [metodologia](METODOLOGIA.md), [segurança](SEGURANCA.md), [coletor](SCRAPER.md).

