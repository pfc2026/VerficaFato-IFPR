# Auditoria de TensorFlow e inteligência de análise — 11/11/2026

## O que existe e está ativo

O backend usa @tensorflow/tfjs 4.22.0, CPU JavaScript, carregado uma vez por processo. Há um cálculo TF-IDF/cosseno e regras explícitas de linguagem; não há classificador treinado de falsidade, manipulação, contradição ou credibilidade. services/analysis.js chama analyzeLanguage depois de consultar checagens e encaminha suas comparações a evaluateClaim. As similaridades são anexadas às evidências; não determinam o veredito. A correspondência textual, a atribuição da avaliação publicada, a data, os limites da consulta e o conflito de evidências continuam controlando a classificação.

Não existe model.json, vocabulário de modelo ou shard de pesos nos diretórios de modelos/dados do projeto. O diretório models contém esquemas MongoDB, não modelos de aprendizado. TFJS_MODEL_DIR não está configurado no ambiente examinado. O catálogo data/noticias.json contém nove notícias com título, texto, URL, fonte, datas e hash, sem rótulos de verdade/manipulação, divisão treino/validação/teste ou dados de avaliação. CSV/JSONL são formatos do acervo de notícias, não conjuntos rotulados usados por treinamento. Não existe rotina fit/train no projeto.

Por isso não se realizou treinamento ou ajuste fino. Não há base para afirmar que a precisão factual ou semântica aumentou, nem para publicar métricas de um modelo inexistente. A avaliação qualitativa final das respostas continua com o usuário.

## Problemas reproduzidos e correções

| Problema | Antes | Depois |
|---|---|---|
| Texto integral ocupava o limite do vocabulário antes dos pares realmente usados | Artigo com 2.100 termos diferentes antes de “corrupção apurada”; afirmação e checagem idênticas recebiam cosseno **0** | A matriz usa afirmações e checagens; o mesmo par recebe **0,99999994** |
| Unicode composto/decomposto tinha tokenização diferente | “Corrupção apurada” e sua versão decomposta recebiam **0,24337445** | Normalização NFC lexical; o mesmo par recebe **0,99999994** |
| Documentos iniciais monopolizavam 2.048 termos | Documentos posteriores podiam ficar sem representação | Vocabulário montado em rodadas entre documentos, preservando o limite |
| Cosseno podia exceder 1 por arredondamento float32 | Resultado matematicamente inválido podia ser recusado pelo frontend | Resultado lexical limitado a [0,1] e semântico a [-1,1] |
| Uma única promise global armazenava qualquer modelo semântico | Mudar TFJS_MODEL_DIR reutilizava o primeiro modelo; uma falha inicial ficava permanente | Cache por runtime e diretório, com remoção de cargas rejeitadas |
| Cartão e saída eram aceitos com contrato insuficiente | IDs inválidos, dimensões incompatíveis e NaN não eram barrados previamente de forma consistente | Validação dos tokens, vocabulário, métricas numéricas, formas de entrada/saída e valores finitos; falha semântica preserva cálculo lexical |
| Consulta sem checagens executava matriz sem pares úteis | Cálculo desnecessário e ausência de resultado pouco explícita | Comparações vazias, contador zero e estado explícito de execução; modelo opcional não é carregado sem pares |
| Vocabulário acessado pela cadeia de protótipos | Palavra “constructor” podia ser interpretada como propriedade de Object | Somente propriedades próprias são índices de vocabulário |

Os números acima são regressões técnicas reproduzidas, não métricas de classificação jornalística. Nenhum resultado de estilo ou similaridade comprova um fato; uma negação pode compartilhar quase todas as palavras da afirmação.

## Fluxo até a interface e o Gemini

Antes desta alteração, analiseLinguagem.comparacoes e as similaridades nas evidências eram produzidas, mas result-renderer não as apresentava. O renderer também não distinguia runtime TensorFlow carregado de modelo semântico disponível. O contrato foi preservado e ampliado com modeloSemantico e comparacoesExecutadas para que a interface apresente a execução real e explique a ausência de pares, sem inventar resultados.

O payload anterior do Gemini recebia regras de linguagem e indicadores heurísticos, mas omitia o método/estado TensorFlow e suas comparações. Essa lacuna foi comunicada ao responsável pela integração, para encaminhar sinais estruturados e seus limites em conjunto com o texto. O Gemini é responsável pelas explicações contextuais; TensorFlow não gera prosa.

## Testes

`node --test tests/tensorflow.test.js`: **12 testes aprovados**, incluindo normalização Unicode, vocabulário limitado e cobertura de documentos posteriores, cosseno de notícia longa, negação, ausência de checagens, serialização e inferência de um modelo Layers real, descarte de tensores, troca de diretório, recuperação após falha de carga, propriedades herdadas, tokens/métricas inválidos, dimensões incompatíveis, NaN e indisponibilidade do runtime.

`node --test tests/analysis.test.js`: **27 testes aprovados**, incluindo fluxo texto/URL com TensorFlow real, evidências conflitantes, ausência/falha de checagens, falha do runtime, explicação e cancelamento. Não foram modificados testes anteriores.

Os modelos pequenos criados nos testes têm pesos constantes e metadados explicitamente identificados como fixtures sintéticas de contrato. Servem para testar serialização, carregamento e inferência; não avaliam compreensão do português ou precisão jornalística. Não foram colocados em produção. Após a comparação lexical de diagnóstico, o número de tensores vivos foi **zero**. O teste semântico aquece o cache e repete inferência cinco vezes sem aumentar os tensores vivos.

## Limites e próximos critérios de avaliação

- TF-IDF continua lexical, limitado a 3.000 tokens por documento e 2.048 termos de comparação; não distingue implicação, ironia ou contradição. A distribuição de vocabulário reduz exclusões, mas não elimina truncamento.
- O contrato de embeddings exige tokenizador word-index-v1 compatível com o treinamento. BERT/WordPiece/SentencePiece não podem ser conectados sem adaptador próprio e avaliação.
- Cartões com métricas não provam qualidade; dados, pesos e documentação precisam de curadoria humana. Modelos carregados com sucesso são mantidos em memória; reinicie o processo ao trocar seus arquivos.
- As regras de extração de afirmações reconhecem opiniões principalmente no início e tratam termos como “será” e “poderá” como previsão. Podem rotular mal fatos processuais futuros e opiniões atribuídas. O Gemini deve distinguir fatos, alegações e opiniões pelo contexto, sem tratar esse rótulo heurístico como certeza. Essas regras não foram alteradas sem um corpus de avaliação.
- Antes de introduzir classificador ou embeddings de produção, obter corpus PT-BR com proveniência/licença e rótulos revisados; separar treino/validação/teste por fonte e tempo, prevenir duplicatas e medir recuperação, falsos positivos, negações, nomes, números e calibração. Só depois comparar baseline e novo modelo em dados retidos.

Fontes técnicas: [guia oficial de serialização TensorFlow.js](https://www.tensorflow.org/js/guide/save_load), [referência oficial da API 4.22.0](https://js.tensorflow.org/api/4.22.0/).
