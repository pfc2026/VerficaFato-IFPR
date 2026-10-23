# Diagnóstico e histórico da migração

Inspeção em 23/10/2026. A pasta configurada no chat não existia; o código foi encontrado em Documents/VerficaFato-IFPR-main (1)/VerficaFato-IFPR-main. Esta cópia não contém diretório .git.

## Estado inicial
Backend Express/Mongoose CommonJS duplicado em server.js e api/index.js. Frontend estático com autenticação, perfil, histórico, administração, fontes e educação. Na inspeção inicial, dez módulos Python implementavam coleta, extração e exportação; havia testes pytest e dados PT/EN. Esses itens foram preservados durante a migração e, na limpeza posterior, arquivados no ZIP de recuperação.
Google Fact Check estava integrado; não havia TensorFlow nem modelo generativo. Texto já era aceito, com limite cliente de 2000 caracteres. O resultado misturava estilo textual com veracidade e elevava correspondências regionais a 88% sem validação.

Problemas encontrados: SSRF e redirecionamentos sem validação; segredo JWT padrão público; expiração opcional; consultas sem schemas; CORS aberto; ausência de rate limit; XSS persistente em nomes/HTML e resultados externos; logs de conteúdo e erros externos; banco indisponível podia travar rotas; duplicação dos motores e backends.

## Etapas
1. Preservar originais modificados em .migration-backup durante a implementação, sem copiar segredos nem dados pessoais. Na limpeza posterior, compactar esses snapshots no ZIP de recuperação.
2. Converter backend, modelos, rotas e coletor para ES Modules, unificando deploy e servidor local.
3. Separar entrada, extração segura, afirmações, busca Google, análise TensorFlow, consolidação e explicação.
4. Aplicar classificação conservadora baseada em correspondências verificáveis, sem porcentagens arbitrárias; notícias regionais são contexto.
5. Evoluir somente os componentes de resultado das telas existentes.
6. Testar componentes reais e falhas de integrações com transportes injetados. Testes não usam chaves nem enviam notícias reais a terceiros.
7. Documentar credenciais, limites, modelos, operação e verificações executadas.

## Compatibilidade e limites
Envelope /api/verificar continua {sucesso,dados}; campos antigos porcentagem/confianca passam a null pois não existe metodologia calibrada. Histórico novo guarda resultado completo. Registros anteriores permanecem legados.
Durante a migração, Python, seus testes e os dados de origem foram preservados para conferência. A execução normal e a coleta já usavam Node.js.

## Limpeza posterior
Após a migração, os arquivos Python, os testes pytest, requirements.txt e os snapshots de .migration-backup foram retirados do projeto ativo e arquivados em backups/projeto-antes-da-limpeza-2026-10-23.zip. Os arquivos de dados foram consolidados no contrato português em data/noticias.json, data/noticias.jsonl e data/noticias.csv, com nove registros únicos e deduplicação por URL/hash; não há mais uma segunda cópia distribuída em scraper/data.

A consolidação normalizou duas URLs por variação de barra final; textos, hashes e datas foram mantidos. Uma versão alternativa de metadados de um registro permanece no ZIP.\n\nO ZIP é uma referência de recuperação local e fica fora do versionamento e do deploy. A documentação operacional usa somente os caminhos JavaScript ativos. O relatório da entrega está em [RELATORIO.md](RELATORIO.md); a rotina visual reproduzível está em scripts/visual-check.mjs e produz apenas artefatos temporários.
