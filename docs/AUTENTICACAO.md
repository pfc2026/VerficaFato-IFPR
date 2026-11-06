# Contas e recuperação de senha

Cadastro e login exigem uma conexão MongoDB e `JWT_SECRET` com pelo menos 32 caracteres e 32 bytes. Não existe chave padrão nem geração automática a cada inicialização. Na Vercel, configure a chave como variável sensível nos ambientes usados e publique uma nova versão para aplicar a alteração. Não reutilize a chave de testes e não compartilhe seu valor em mensagens, logs ou commits.

Senhas novas exigem pelo menos 12 caracteres e no máximo 72 bytes em UTF-8, limite do bcrypt. O login aceita senhas anteriores menores para permitir a migração. O backend usa bcrypt com custo 12. As sessões duram sete dias e usam uma versão de sessão no usuário; mudar ou redefinir a senha invalida as sessões anteriores.

## Configuração do e-mail

A recuperação usa a API HTTP real do Resend. Não há envio simulado nem links de recuperação expostos na resposta da API. Para ativar:

1. Conecte o Resend ao projeto Vercel e habilite o envio transacional na conta.
2. Verifique um domínio que você controla no Resend. Configure `RECOVERY_EMAIL_FROM` com um endereço desse domínio, por exemplo no formato `VerificaFato <conta@seu-dominio>`; não use o domínio de outra instituição sem autorização.
3. Configure `RESEND_API_KEY` exclusivamente no backend.
4. Configure `APP_URL` com a origem HTTPS pública do projeto, sem caminho, consulta, fragmento ou credenciais. O backend usa essa origem fixa para impedir a adulteração de links por cabeçalhos HTTP. HTTP só é aceito para localhost fora de produção.
5. Publique a configuração e valide com uma caixa de e-mail que você controla: solicite recuperação, abra o link, altere a senha, confirme o novo login, a recusa da senha anterior e a recusa do link já utilizado.

Enquanto as variáveis não estiverem completas, a solicitação responde HTTP 503 e `RECUPERACAO_INDISPONIVEL`. O status diferencia essa integração desativada da autenticação essencial. Configuração presente não comprova entrega, verificação do domínio ou disponibilidade do provedor; o teste de caixa de entrada continua necessário.

Referências oficiais: [enviar e-mail](https://resend.com/docs/api-reference/emails/send-email) e [verificar domínio](https://resend.com/docs/dashboard/domains/introduction).

## Fluxo e segurança

- `POST /api/auth/recuperar-senha` recebe `{ "email": "..." }`. A resposta aceita é genérica para não revelar a existência de uma conta. Contas inativas não recebem links.
- O link aponta para `/html/Login.html?reset=TOKEN`. O token usa 32 bytes aleatórios, vence em 30 minutos e só pode ser consumido uma vez. Somente seu hash SHA-256 fica no banco.
- Existe um intervalo mínimo de um minuto entre envios para a mesma conta, aplicado por atualização atômica. Um pedido posterior substitui o link anterior.
- `POST /api/auth/redefinir-senha` recebe `{ "token": "...", "senha": "..." }`. A atualização atômica consome o token, grava o novo hash de senha e incrementa a versão das sessões. Tentativas concorrentes com o mesmo token só permitem uma alteração.
- Os dois endpoints têm limite adicional de dez tentativas por IP a cada quinze minutos, além do limite geral de autenticação. Tokens inválidos ou vencidos não executam o cálculo de bcrypt.
- Mudanças de senha ou e-mail na conta removem links de recuperação pendentes. Campos internos de recuperação não são incluídos nos dados públicos do perfil.
- Falhas de entrega removem o token e registram somente uma mensagem genérica de erro no servidor, sem endereço, token ou detalhes do provedor. A resposta pública continua genérica para impedir a enumeração de contas.

Os testes automatizados usam repositórios e transportes controlados. Validam expiração, uso único, concorrência, invalidação das sessões, limites, contratos HTTP e montagem da chamada Resend; não enviam e-mail real nem substituem a validação de entrega após a configuração.
