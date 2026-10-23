# TensorFlow.js e modelos

## Recurso ativo sem pesos externos
O pacote @tensorflow/tfjs roda no backend CPU JavaScript, sem Python e sem extensões nativas. Cada análise executa TF-IDF e cosseno sobre texto/afirmações/checagens. Tensores temporários são descartados com tf.tidy. O carregamento do runtime é único por processo. Limites: até 3.000 tokens por documento e 2.048 termos no vocabulário de comparação. A medida é lexical, não um classificador ou um modelo semântico treinado.

Nenhum classificador de verdade, contradição ou manipulação foi treinado. As regras de estilo são descritas como regras, sem métricas de precisão inventadas.

## Modelo semântico opcional
TFJS_MODEL_DIR aponta a diretório confiável do operador. O carregador não baixa URLs. Ele espera:
- model.json no formato TensorFlow.js Layers e shards locais de até 100 MiB somados.
- vocab.json: mapa palavra→índice inteiro, compatível com o treinamento.
- model-card.json real, preenchido com proveniência, licença, limitações e avaliação do modelo.

Contrato do cartão: task="sentence-embedding", tokenizer="word-index-v1", languages contendo "pt" ou "pt-BR", maxLength inteiro 8..512, padToken e unknownToken inteiros; lowercase corresponde exatamente ao pré-processamento do treinamento. validation.dataset e validation.metrics precisam descrever dados e métricas REAIS. O modelo deve aceitar uma entrada de IDs de palavras (batch,maxLength) e produzir uma única matriz de embeddings (batch,dimensões).

O tokenizador separa palavras Unicode/números/pontuação, aplica minúsculas pt-BR por padrão e completa/trunca à extensão declarada. Não conecte BERT/WordPiece/SentencePiece ou um modelo inglês a esse contrato: o pré-processamento seria incompatível. Exporte um modelo treinado especificamente para esse vocabulário ou implemente e teste um adaptador correto antes de ativar outro tokenizador.

Não há modelo compatível já validado incluído no repositório; fornecer pesos e avaliação em português é uma pendência de ativação, não funcionalidade simulada. Um cartão não prova a qualidade do modelo: a curadoria humana precisa revisar seus dados e métricas. Falha no carregamento deixa o cálculo lexical ativo e sinaliza a indisponibilidade sem conclusão factual substituta.

A evolução de um modelo deve registrar corpus/licença/consentimento, divisão temporal/por fonte, proteção de dados, cobertura PT-BR, testes de negação/números/nomes, recuperação de checagens, avaliação de erro, versão e hash de pesos. Valide em dados independentes antes de disponibilizar o resultado como análise semântica. Embeddings nunca constituem evidência factual.
