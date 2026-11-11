# Contexto Jurídico — contrato e fontes

Implementação e conferência inicial: 11/11/2026. A avaliação editorial final das respostas pertence ao usuário; a passagem dos testes técnicos não certifica a interpretação jurídica de qualquer caso concreto.

## Fluxo

O serviço existente do Gemini recebe a notícia, os sinais estruturados já calculados e os candidatos do catálogo na mesma requisição da análise jornalística. A seleção lexical prévia não decide que uma lei se aplica: reduz candidatos a temas concretos e a IA deve omitir relações genéricas ou insuficientes.

`services/legal-context.js` fornece:

- `legalCandidates(text, { now })`: candidatos cuja fonte foi previamente conferida, dentro do prazo de revisão e com sinais pertinentes no texto;
- `legalResponseSchema(candidates)`: contrato estruturado estrito para seleção de IDs, categoria, trecho literal e situação relatada;
- `validateLegalContext(raw, { text, candidates, now })`: validação independente, com saída canônica, ou `{ aplicavel: false, referencias: [] }`.

O carregamento de uma base ausente ou inválida também falha de forma isolada: desabilita referências jurídicas sem impedir a inicialização do servidor ou a análise principal. `/api/status`, em `servicos.baseJuridica`, informa `pronto`, `revisao_pendente` ou `indisponivel`, a quantidade de referências e as datas de conferência/revisão.

O modelo não escreve nome de lei, número de artigo, pena nem endereço de fonte no contrato jurídico. Esses campos vêm exclusivamente do catálogo revisado. Campos adicionais livres, inclusive uma URL oficial aparentemente plausível ou um artigo inventado, invalidam o item. Uma referência inválida não elimina outras referências válidas nem a análise jornalística.

## Evidência e categorias

Cada item selecionado contém `id`, `categoria`, `trecho_noticia`, `situacao_juridica` e `trecho_situacao`. Há limite de seis referências; a interface apresenta três inicialmente.

O trecho deve existir literalmente na notícia, conter o tema específico da referência e ser apoiado pelo contexto original da sentença. O validador considera a sentença original, inclusive palavras anteriores ao recorte: selecionar “foi condenado” dentro de “não foi condenado” não confirma condenação. A situação deve ter suporte dentro do trecho jurídico e na mesma sentença que descreve o tema, evitando aproveitar uma condenação de outro caso. Se apenas a etapa processual não puder ser vinculada com segurança, a referência legal válida é preservada com Situação não identificada, trecho de situação vazio e ressalva explícita; a etapa não comprovada não aparece.

`acontecimento_noticiado` se refere à conduta relatada. `publicacao` exige indicação direta de ação da publicação, como divulgar dados ou formular uma acusação; a frase “a reportagem relata que alguém é investigado” não constitui, por si só, risco atribuível à reportagem. Uma notícia sem fontes suficientes não gera automaticamente calúnia.

As situações são Suspeita, Investigação, Indiciamento, Denúncia, Processo judicial, Condenação, Absolvição ou Situação não identificada. Denúncia como etapa processual exige indicação de ato do Ministério Público ou recebimento judicial; reclamação ou boletim policial não são denúncia nessa acepção. Na falta de suporte, o modelo deve selecionar Situação não identificada e deixar o trecho de situação vazio.

Explicação, consequências e ressalvas são textos canônicos, com penas básicas separadas de hipóteses especiais. A relação com a notícia é montada pelo servidor a partir do trecho e do critério de pertinência, sempre de forma condicional. A marca `verificada: true` significa que lei, artigo e fonte pertencem à base conferida. Ela não certifica que o enquadramento ou uma infração se confirmaram no caso concreto.

## Fontes oficiais

O catálogo `data/legal-catalog.json` reúne 22 referências em 13 fontes oficiais. Foram consultados os textos atualizados da Câmara dos Deputados e os textos compilados do TSE. O Planalto bloqueou a leitura automatizada nesta sessão; não foi usado para fingir conferência de conteúdo indisponível.

| Tema | Dispositivos iniciais | Fonte conferida |
| --- | --- | --- |
| Código Penal | 312, 317, 333, 171, 138, 139 e 140, caput | [Câmara — Código Penal atualizado](https://www2.camara.leg.br/legin/fed/declei/1940-1949/decreto-lei-2848-7-dezembro-1940-412868-normaatualizada-pe.html) |
| Dados pessoais | LGPD 46, 48 e 52 | [Câmara — LGPD atualizada](https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html) |
| Desinformação eleitoral | Código Eleitoral 323 | [TSE — Código Eleitoral](https://www.tse.jus.br/legislacao/codigo-eleitoral/codigo-eleitoral-1/codigo-eleitoral-lei-nb0-4.737-de-15-de-julho-de-1965) |
| Resposta eleitoral | Lei 9.504/1997, 58, caput | [TSE — Lei das Eleições](https://www.tse.jus.br/legislacao/codigo-eleitoral/lei-das-eleicoes/lei-das-eleicoes-lei-nb0-9.504-de-30-de-setembro-de-1997) |
| Conteúdo eleitoral manipulado | Resolução 23.610/2019, 9º-C | [TSE — texto compilado, com alterações de 2026](https://www.tse.jus.br/legislacao/compilada/res/2019/resolucao-no-23-610-de-18-de-dezembro-de-2019?texto=compilado) |
| Intimidade e imagem | Constituição 5º, X | [Câmara — Constituição atualizada](https://www2.camara.leg.br/legin/fed/consti/1988/constituicao-1988-5-outubro-1988-322142-normaatualizada-pl.html) |
| Direito de resposta | Lei 13.188/2015, 2º | [Câmara — texto atualizado](https://www2.camara.leg.br/legin/fed/lei/2015/lei-13188-11-novembro-2015-781877-normaatualizada-pl.html) |
| Racismo e injúria racial | Lei 7.716/1989, 2º-A e 20 | [Câmara — texto atualizado](https://www2.camara.leg.br/legin/fed/lei/1989/lei-7716-5-janeiro-1989-356354-normaatualizada-pl.html) |
| Identificação de adolescente | ECA 143 | [Câmara — ECA atualizado](https://www2.camara.leg.br/legin/fed/lei/1990/lei-8069-13-julho-1990-372211-normaatualizada-pl.html) |
| Poluição | Lei 9.605/1998, 54 | [Câmara — texto atualizado em PDF](https://www2.camara.leg.br/legin/fed/lei/1998/lei-9605-12-fevereiro-1998-365397-normaatualizada-pl.pdf) |
| Publicidade enganosa | CDC 37 | [Câmara — CDC atualizado](https://www2.camara.leg.br/legin/fed/lei/1990/lei-8078-11-setembro-1990-365086-normaatualizada-pl.html) |
| Privacidade na internet | Marco Civil 7º, I | [Câmara — texto atualizado](https://www2.camara.leg.br/legin/fed/lei/2014/lei-12965-23-abril-2014-778630-normaatualizada-pl.html) |
| Uso de obras | Lei 9.610/1998, 29 | [Câmara — texto atualizado](https://www2.camara.leg.br/legin/fed/lei/1998/lei-9610-19-fevereiro-1998-365399-normaatualizada-pl.html) |

Cuidados incorporados:

- A LGPD exclui tratamento para fins exclusivamente jornalísticos e artísticos no art. 4º, II, a. As referências iniciais à LGPD tratam do incidente noticiado e não imputam irregularidade ao jornal por ter narrado o vazamento.
- O art. 323 do Código Eleitoral exige requisitos específicos: campanha ou propaganda, ciência da falsidade, relação com partido ou candidato e potencial de influenciar o eleitorado. A pena básica prevê detenção **ou** dias-multa, sem somá-los automaticamente.
- As sanções de suspensão referidas no art. 247, § 2º, do ECA possuem declaração de inconstitucionalidade indicada no próprio texto oficial; não foram inseridas como consequência aplicável.
- O catálogo não automatiza a responsabilidade de plataformas pelo art. 19 do Marco Civil, cujo exame requer consideração da jurisprudência.
- A referência autoral contempla as exceções do art. 46; notícia cultural ou menção ao nome de obra não demonstra violação.

## Atualização e extensão

A janela inicial vai de 11/11/2026 a **11/12/2026, 00:00 UTC**, no máximo 30 dias. Depois disso, novas análises não apresentam referências desse catálogo até nova conferência. Não existe consulta oficial em tempo real a cada notícia, nem atualização automática de penas ou normas. A análise jornalística permanece funcional quando o catálogo expira.

Para revisar ou ampliar a base:

1. Abra o texto oficial atualizado, confira identificação da norma, artigo, vigência, alterações, exceções e notas de controle de constitucionalidade pertinentes.
2. Adicione ou corrija a entrada em `data/legal-catalog.json`, com ID único, fonte oficial, artigo exato, critério concreto, sinais de elegibilidade, categorias e explicações condicionais.
3. Confira a fonte correspondente. Endereços aceitos são textos atualizados em `/legin/fed/` da Câmara ou legislação do TSE; outro órgão oficial exige ampliação explícita dessa política no serviço e seus testes.
4. Revise todas as entradas afetadas antes de avançar a data global de conferência e a próxima revisão, mantendo janela de até 30 dias. Não avance a data sem conferir o conteúdo.
5. Adicione testes positivos, negativos e de confusão de categorias/situações. Rode a suíte e faça a avaliação manual das respostas.

A base inicial pode crescer e não presume ser uma lista completa de legislação brasileira. Leis ainda não incluídas, artigos não conferidos e links sugeridos livremente pelo modelo são omitidos. Essa restrição é deliberada para não apresentar conteúdo não verificado como confirmado.

## Limites e testes

As regras de pertinência e de situação são guardas conservadoras; não são um sistema completo de interpretação jurídica, reconhecimento de pessoas ou resolução de ambiguidades. Casos legítimos com formulação diferente podem ser omitidos. Citações históricas, negações complexas e vários sujeitos na mesma sentença exigem avaliação editorial; não há afirmação de precisão jurídica definitiva.

`node --test tests/legal-context.test.js` executa 20 testes locais, cobrindo cultura/tempo, corrupção, dados pessoais, eleição, acusação não comprovada, erro factual sem crime, referências inventadas, falha isolada, prazo de revisão, citações cortadas para esconder negação, situação de outro caso, denúncia policial versus processual, perguntas sobre condenação e distinção entre acontecimento e publicação, inclusive relatos como “o jornal publicou que alguém é investigado”. Esses testes não chamam o Gemini e não medem, por si só, a qualidade das respostas do modelo. Os testes da integração e a validação real da API são descritos no [relatório principal da implementação](IMPLEMENTACAO-GEMINI-JURIDICO-2026-11-11.md).
