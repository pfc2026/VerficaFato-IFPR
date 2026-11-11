# TensorFlow.js e modelos

## Recurso ativo sem pesos externos
O pacote @tensorflow/tfjs roda no backend CPU JavaScript, sem Python e sem extensões nativas. Havendo afirmações e checagens, a análise executa TF-IDF e cosseno somente sobre esses documentos. O texto integral alimenta as regras de linguagem e a análise jornalística; incluí-lo outra vez na matriz consumia vocabulário sem produzir uma comparação usada. Tensores temporários são descartados com tf.tidy. O carregamento do runtime é único por processo e uma falha permite nova tentativa. Limites: até 3.000 tokens por documento e 2.048 termos no vocabulário de comparação, distribuídos em rodadas entre documentos para não excluir inteiramente os últimos. A medida é lexical, não um classificador ou um modelo semântico treinado.

O tokenizador lexical normaliza Unicode NFC antes das minúsculas pt-BR; palavras com acentos compostos e decompostos são equivalentes. Não remove negações nem reduz nomes a radicais. O cosseno lexical é limitado a [0,1] para corrigir pequenos desvios de ponto flutuante; o semântico aceita [-1,1]. Sem pares, comparacoes fica vazio e comparacoesExecutadas é zero: carregar o runtime não representa uma inferência semântica executada.

Nenhum classificador de verdade, contradição ou manipulação foi treinado. As regras de estilo são descritas como regras, sem métricas de precisão inventadas.

## Modelo semântico opcional
TFJS_MODEL_DIR aponta a diretório confiável do operador. O carregador não baixa URLs. Ele espera:
- model.json no formato TensorFlow.js Layers e shards locais de até 100 MiB somados.
- vocab.json: mapa palavra→índice inteiro, compatível com o treinamento.
- model-card.json real, preenchido com proveniência, licença, limitações e avaliação do modelo.

Contrato do cartão: task="sentence-embedding", tokenizer="word-index-v1", languages contendo "pt" ou "pt-BR", maxLength inteiro 8..512, padToken e unknownToken inteiros não negativos de 32 bits (padrões 0 e 1); lowercase booleano corresponde exatamente ao pré-processamento do treinamento. normalization opcional aceita "none" (padrão) ou "NFC": o pré-processamento do modelo não é alterado sem essa declaração. validation.dataset precisa identificar dados REAIS e validation.metrics deve ter valores numéricos finitos. O modelo deve aceitar uma entrada de IDs de palavras (batch dinâmico,maxLength) e produzir uma única matriz de embeddings (batch,dimensões), com 1..8.192 dimensões. Vocabulário vazio, IDs inválidos, dimensões incompatíveis e saídas não finitas ou vetores nulos são rejeitados; o cálculo lexical continua disponível.

O tokenizador separa palavras Unicode/números/pontuação, aplica minúsculas pt-BR por padrão e completa/trunca à extensão declarada. Não conecte BERT/WordPiece/SentencePiece ou um modelo inglês a esse contrato: o pré-processamento seria incompatível. Exporte um modelo treinado especificamente para esse vocabulário ou implemente e teste um adaptador correto antes de ativar outro tokenizador.

Não há modelo compatível já validado incluído no repositório; fornecer pesos e avaliação em português é uma pendência de ativação, não funcionalidade simulada. Um cartão não prova a qualidade do modelo: a curadoria humana precisa revisar seus dados e métricas. Falha no carregamento deixa o cálculo lexical ativo e sinaliza a indisponibilidade sem conclusão factual substituta. O cache é separado por runtime e diretório absoluto, e uma carga que falhou não fica armazenada para sempre. Modelos carregados com sucesso permanecem em memória até reiniciar o processo; reinicie após substituir seus arquivos.

O contrato preserva tensorflow.disponivel/metodo/modelo/limitacoes e comparacoes. Acrescenta tensorflow.modeloSemantico (desativado, nao_executado, pronto ou indisponivel) e tensorflow.comparacoesExecutadas. disponivel indica o runtime, enquanto modeloSemantico informa a execução dos pesos opcionais. A interface pode mostrar os pares e os limites sem transformá-los em probabilidades de verdade.

A evolução de um modelo deve registrar corpus/licença/consentimento, divisão temporal/por fonte, proteção de dados, cobertura PT-BR, testes de negação/números/nomes, recuperação de checagens, avaliação de erro, versão e hash de pesos. Valide em dados independentes antes de disponibilizar o resultado como análise semântica. Embeddings nunca constituem evidência factual.

Ver [auditoria de 11/11/2026](AUDITORIA-ML-2026-11-11.md) para falhas reproduzidas, correções e testes. Documentação técnica consultada: [serialização de modelos TensorFlow.js](https://www.tensorflow.org/js/guide/save_load) e [API oficial 4.22.0](https://js.tensorflow.org/api/4.22.0/).
