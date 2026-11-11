# Correções do relatório de 04/11/2026

Versão publicada em produção: https://verfica-fato-ifpr.vercel.app/

Deployment: `dpl_8nmqDcdKTcWjUycaAkdCRzL94mZP`, estado `READY`.

| Item | Resultado |
| --- | --- |
| 1. Cadastro/login | Confirmada ausência de `JWT_SECRET` na Vercel. Adicionada chave aleatória de 48 bytes, guardada como segredo. Cadastro, login e perfil validados na produção. |
| 2. Mistura na extração | Corpo principal tem prioridade, recomendações são removidas e não se concatenam todos os parágrafos da página. Seletores ficam limitados à matéria principal quando identificada. Sem corpo confiável, o leitor precisa fornecer o texto. |
| 3. Notícias regionais | MongoDB e arquivo local usam o mesmo filtro conservador de pertinência. Sem correspondência, retornam vazio. A interface apresenta nomes de veículos e datas legíveis. |
| 4. Fonte contraditória | URL da publicação separada das referências citadas no texto. Rótulos, descrições e API esclarecem o escopo do indicador. |
| 5. Gemini não configurado | Integração opcional aparece como desativada. Falha transitória continua distinta. Google Fact Check permanece separado. |
| 6. Senhas | Orientação, atributos dos campos, JavaScript e servidor alinhados em mínimo de 12 caracteres e máximo de 72 bytes para senhas novas. Login continua aceitando senhas antigas. |
| 7. Páginas/indexação | Endereços inexistentes retornam HTTP 404. `robots.txt` retorna texto e `sitemap.xml` retorna XML válidos. |
| 8. Acessibilidade | Controles alternam entre Mostrar senha/Ocultar senha, com estado acessível e alvo de 44 px. Login, cadastro, confirmação e redefinição contemplados. |
| 9. Recuperação | Código completo com token aleatório, hash persistido, validade de 30 minutos, uso único atômico, limites de tentativas e revogação das sessões após redefinição. **Ativação de e-mail adiada pelo usuário**. Sem configuração, retorna 503 explícito. |
| 10. Transparência | Página de privacidade, dados, responsáveis e contato disponível na home, login e histórico. Explica conta, retenção, armazenamento local, serviços externos e suporte pelos mantenedores. |
| 11. Status | Prontidão do banco e autenticação verificada separadamente; indisponibilidade essencial retorna HTTP 503. Integrações opcionais aparecem como configuradas/desativadas. |
| 12. Avançado | Filtro sem aulas aparece como Em breve e desativado. É habilitado automaticamente quando houver conteúdo publicado. |
| 13. Espaços no celular | Espaços preservados nas quebras dos títulos. Conferido em viewport de 390 px, sem transbordamento horizontal. |
| 14. Compartilhamento | Ação renomeada Compartilhar site, com orientação de que não inclui a análise. Confirmação visível, tratamento de cancelamento e alternativa de copiar endereço. |
| 15. Prévias sociais | Metadados Open Graph/Twitter, imagem real do projeto e endereço canônico adicionados à home. |

## Validação

- Suíte completa: 212 testes passaram, sem falhas (`node --test --test-reporter=dot tests/*.test.js`).
- Sintaxe: 69 arquivos JavaScript e manifestos JSON válidos (`node scripts/check.js`).
- Regressões abrangem contaminação eleitoral em matéria de Terra plana, seleção da matéria principal, consultas regionais longas, recuperação, acessibilidade, compartilhamento e metadados.
- Navegador: resultado com IA desativada, acesso/cadastro, alternância Mostrar/Ocultar senha, títulos e largura no celular.
- Produção, sem novos dados: status 200, login inválido 401, perfil sem sessão 401, análise pública 200 sem notícias regionais irrelevantes, página de privacidade, metadados, 404, robots e sitemap.
- Após autorização explícita do usuário, teste real em produção: cadastro 201 → login 200 → perfil 200 → análise autenticada 200 → histórico com consulta persistida → exclusão da consulta 200. A conta temporária e seus registros foram removidos por filtro exato ao final.
- Recuperação sem e-mail: 503 com código `RECUPERACAO_INDISPONIVEL`, conforme adiamento solicitado. Não foi enviado e-mail real.

## Configuração e continuidade

Para ativar o e-mail futuramente, seguir [AUTENTICACAO.md](AUTENTICACAO.md) e configurar `RESEND_API_KEY`, `RECOVERY_EMAIL_FROM` verificado e `APP_URL` HTTPS. O comentário Gemini permanece opcional e desativado no ambiente publicado.

A publicação inicial foi feita diretamente dos arquivos locais revisados, sem incluir `.env`, segredos, dependências instaladas ou artefatos de teste. As correções e sua documentação estão reunidas no mesmo commit do GitHub. A branch `main` alimenta o deploy da Vercel e deve manter esse conjunto completo para preservar as correções.

Os logs da versão apresentaram aviso de depreciação `DEP0169` de `url.parse()` em dependências/runtime. As requisições validadas concluíram com os códigos esperados; esse aviso não impediu os fluxos testados.
