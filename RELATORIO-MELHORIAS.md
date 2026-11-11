# Melhorias do VerificaFato — 27/10/2026

- Criei a seção **Aprender**, com dez aulas: maiúsculas, sensacionalismo, fontes, contexto, emoções, imagens/deepfakes, fato/opinião/publicidade, números/gráficos, IA e correção de informações. Cada aula tem exemplo fictício, passos práticos, reflexão, referências e data de atualização.
- Acrescentei checklist com quatro perguntas antes de compartilhar e quiz de cinco situações, com explicação das respostas e opção de refazer.
- Incluí filtros por nível, links diretos para as aulas e progresso de leitura salvo no navegador após o leitor marcar uma aula como concluída.
- Simplifiquei a checagem para um campo que aceita texto ou link e reorganizei a página, os temas claro/escuro e a leitura no celular.
- Passei a destacar a conclusão baseada em evidências separadamente do índice de linguagem e acrescentei sugestões de aulas nos resultados.
- Mantive o catálogo educativo disponível sem banco de dados, com suporte às aulas personalizadas do painel e às desativações administrativas.

**Conferência:** 150 testes automatizados passaram; 15 verificações no navegador passaram, incluindo aulas, quiz, checagem por texto/link, teclado e telas de 1440, 390 e 320 pixels. As integrações externas foram simuladas nesses testes.

**Local:** a versão atualizada está em `C:\Users\Luiz\Documents\VerificaFato IFPR`, pasta configurada neste chat, preparada a partir da cópia encontrada. A prévia educativa usa o banco desconectado. Para executar no ambiente configurado do projeto, use `npm start` nessa pasta. A entrega é local.

**Correção posterior — links:** removi um bloqueio indevido que confundia diretivas de exibição nos buscadores (`noarchive` e `nosnippet`) com impedimento de leitura da notícia. A análise sob demanda continua verificando permissões de coleta, tipo de conteúdo e acesso à página. Acrescentei cinco testes de regressão; os 155 testes automatizados passaram. A prévia local foi reiniciada com a correção. A conferência do endereço específico depende do link utilizado.

**Correção posterior — Vercel:** fixei `sanitize-html` em `2.18.1` e seu parser `htmlparser2` em `10.1.0`, com override restrito ao sanitizador. Atualizei o lockfile sem alterar as versões das demais dependências e validei com `npm ci`. O erro `ERR_REQUIRE_ESM` foi reproduzido antes da mudança; a inicialização da API com o mesmo limite de carregamento passou depois. A suíte completa passou com 172 testes, incluindo verificações de sanitização. Para aplicar no Vercel, enviar `package.json` e `package-lock.json` e fazer redeploy sem cache de build. A publicação remota ainda precisa ser executada.

**Complemento da correção do Vercel:** o endereço público informado ainda respondeu HTTP 500 na conferência. Acrescentei a `vercel.json` a instalação por `npm ci` e a opção oficial `NODE_OPTIONS=--experimental-require-module`. Validei a opção com uma cópia isolada do parser ESM 12: o erro foi reproduzido sem ela e o carregamento e a sanitização passaram com ela. A suíte completa passou com 173 testes. O novo deploy precisa incluir `vercel.json`, além de `package.json` e `package-lock.json`; a alteração local não modifica automaticamente o site publicado.

**Correção aplicada em produção:** após a autorização da equipe, configurei `NODE_OPTIONS` no projeto `verfica-fato-ifpr` e refiz o deploy do commit publicado `8595117`. O deployment `dpl_9SMo1ViXYKD3LyKiXti3sY9gbti8` ficou READY. O endereço público e `/api/status` passaram a responder HTTP 200; uma análise enviada pelo formulário exibiu o resultado corretamente. A versão desse commit ainda mostra a página inicial antiga; as melhorias educativas estão nos arquivos locais preparados para o próximo commit.
