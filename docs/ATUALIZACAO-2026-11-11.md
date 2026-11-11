# Atualização do VerificaFato IFPR — 11/11/2026

Publicação das melhorias na análise de notícias, no Contexto Jurídico e na estabilidade da integração com o Gemini.

- Integração Gemini com respostas estruturadas, validação no servidor e mensagens específicas para falhas de autenticação, limite, rede, tempo e indisponibilidade.
- Contexto Jurídico integrado à análise jornalística, com 22 referências revisadas em 13 fontes oficiais. A seção aparece somente com referências aceitas pelo backend e distingue o acontecimento noticiado de possíveis problemas da publicação.
- Correções no cálculo lexical do TensorFlow e apresentação de seus resultados reais, com limites explícitos. Similaridade textual não é tratada como prova de veracidade.
- Segunda tentativa automática do Gemini após erros HTTP temporários, com espera controlada, respeito ao Retry-After e prazo total compartilhado de 20 segundos. Não repete erros de autenticação, configuração, JSON inválido ou recusa do modelo.
- Proteção contra espera indefinida durante a limpeza de uma conexão, mantendo o cancelamento e o limite de duas chamadas.
- Preservação do layout, das contas, do histórico, da recuperação de senha pela Brevo e dos filtros de pertinência das checagens.

Validação da versão: **324 testes automatizados aprovados**. A checagem de produção confirmou uma análise recuperada na segunda tentativa com Contexto Jurídico preservado. O Google ainda pode retornar indisponibilidade nas duas tentativas; nesse caso, o sistema mantém o aviso e a análise local, sem apresentar conteúdo gerado inexistente.

Aplicação: https://verfica-fato-ifpr.vercel.app

Detalhes da implementação inicial: [relatório técnico](IMPLEMENTACAO-GEMINI-JURIDICO-2026-11-11.md). A política atual de repetição está documentada no [README](../README.md).
