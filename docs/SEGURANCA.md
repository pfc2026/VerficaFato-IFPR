# Segurança e operação

## Correções aplicadas
- SSRF: somente HTTP/HTTPS, portas 80/443, sem credenciais; bloqueio de IP privado/reservado/loopback/link-local/metadados, IPv4 alternativo e IPv6 mapeado/transicional; todas as respostas DNS devem ser públicas. A conexão utiliza os IPs validados, sem segunda resolução. Cada redirecionamento é validado antes do acesso; downgrade HTTPS é recusado.
- Extração: robots por destino, limites de tempo/bytes/redirecionamentos/cabeçalhos, conteúdo HTML, sem contornar login/paywall, sem execução de scripts externos. Robots ausente 404/410 é distinto de proibição ou erro. Restrições noarchive/nosnippet impedem extração/armazenamento automatizado.
- APIs: Zod limita tipos, campos, tamanho e IDs. Objetos de operadores Mongo são recusados; atualizações usam allowlist e validação. Não há SQL no projeto.
- Autenticação: sem JWT_SECRET padrão; HS256, comparação de assinatura com tempo constante, expiração obrigatória e IDs válidos, conta ativa e versão de sessão. Novas senhas 12 caracteres e no máximo 72 bytes bcrypt; troca revoga sessões.
- Autorização: CRUD administrativo exige papel admin no servidor; histórico sempre usa o usuário autenticado. Dados de perfil não incluem hashes nem versão da sessão.
- XSS: campos externos/usuários são texto no DOM, URLs limitadas a HTTP(S), HTML educativo sanitizado na escrita, leitura e renderização. Scripts inline e eventos interpolados foram retirados. CSP restringe origens de scripts; estilos inline do design existente permanecem permitidos.
- Segredos: .env original preservado; chaves não vão ao cliente nem às mensagens de erro. A Fact Check Tools usa GOOGLE_API_KEY; a explicação Gemini usa GEMINI_API_KEY, configurada separadamente. As chaves são usadas somente no servidor. Logs/erros públicos não incluem notícia, credencial ou resposta bruta de provedor.
- Abuso: limite de payload 64 KiB, texto 20.000 caracteres, oito candidatos, filas limitadas, concorrência de análises/Google/IA limitada, cache TTL/LRU para Google e robots, prazo total de 45 segundos e cancelamento por desconexão, rate limiting nos endpoints públicos de custo/autenticação.
- Prompt injection: notícias, resultados e títulos são dados. Gemini e OpenAI usam schema restrito e validação local. O comentário é texto livre limitado; classificação e indicadores continuam definidos pelo servidor. Referências aceitam somente IDs recebidos, com URLs resolvidas no servidor. Links/HTML na prosa, novos números e alguns padrões categóricos sem evidência são recusados. Essas guardas não garantem a correção semântica de toda frase gerada. A IA não recebe ferramentas; falha, recusa ou resposta inválida exibem aviso local explícito.

Métricas agregadas de requisições, duração e códigos de erro ficam em memória e são acessíveis somente ao administrador em /api/admin/metricas. Não incluem conteúdo, IP, nomes ou e-mails.

## Provedor de explicação
O exemplo usa AI_PROVIDER=gemini e mantém ENABLE_AI_EXPLANATION=false. GEMINI_MODEL deve ser um identificador disponível na conta com saída estruturada; não há modelo presumido. A alternativa AI_PROVIDER=openai usa OPENAI_API_KEY e OPENAI_MODEL. geracao.provedor identifica o provedor selecionado. Habilitar Gemini não substitui a Google Fact Check Tools API nem o TensorFlow.js. Dados da análise só saem para o provedor selecionado quando a integração externa é explicitamente habilitada.

## Limites operacionais
Rate limiting, filas e cache são por processo. Para deploy com múltiplas instâncias use gateway/armazenamento compartilhado e limites de custo do provedor. TRUST_PROXY deve refletir um proxy confiável, não cabeçalhos arbitrários do cliente; Vercel usa configuração própria.

O frontend mantém tokens Bearer em localStorage para compatibilidade. As superfícies de XSS identificadas foram corrigidas, mas scripts de CDN permitidos continuam parte da confiança do site; avalie futuramente hospedar esses arquivos e usar cookies HttpOnly com proteção CSRF. Não há alegação de ausência absoluta de vulnerabilidades.

Na validação inicial da migração, banco e provedores reais não foram usados; rodadas posteriores de homologação são registradas em [VALIDACAO.md](VALIDACAO.md). Não houve rotação de segredos, alteração em banco de produção, coleta pública automática ou deploy. O código Python, seus testes e requirements.txt foram retirados do projeto ativo após a conferência da migração. Esse material e os snapshots de .migration-backup estão arquivados em backups/projeto-antes-da-limpeza-2026-10-23.zip, somente para recuperação local. O ZIP exclui o arquivo .env, node_modules e os perfis/caches temporários do navegador. A pasta backups fica fora do versionamento e do deploy; a aplicação não serve o ZIP nem usa seus arquivos em produção. O acervo ativo único contém nove registros em data/noticias.json, data/noticias.jsonl e data/noticias.csv. A rotina scripts/visual-check.mjs usa dados de teste e gera capturas temporárias, sem acessar banco ou credenciais reais.

## Fontes técnicas
- [Google claims.search](https://developers.google.com/fact-check/tools/api/reference/rest/v1alpha1/claims/search): buscas, paginação, idioma e ClaimReview.
- [Gemini Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output): saída por JSON Schema.
- [Gemini models.generateContent](https://ai.google.dev/api/generate-content): interface REST de geração.
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses): formato de saída restrito.
- [TensorFlow.js: carregar modelos](https://www.tensorflow.org/js/guide/save_load): artefatos e IOHandler.

