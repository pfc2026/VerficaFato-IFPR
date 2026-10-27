// Conteúdo editorial local: as aulas continuam acessíveis sem conexão com o banco.
const editorial = {
  atualizadoEm: '2026-10-27',
  autoria: 'VerificaFato · material educativo',
  ativo: true
};

const references = `
  <h3>Para aprofundar</h3>
  <p>Explore atividades e conceitos no <a href="https://educamidia.org.br/guia/">Guia da Educação Midiática, do EducaMídia</a> e propostas de investigação na <a href="https://www.unesco.org/mil4teachers/en/module4/unit5">unidade de educação midiática e desinformação da UNESCO</a>. Essas referências orientam a abordagem educativa; os cenários desta aula são fictícios.</p>
`;

export const lessons = [
  {
    ...editorial,
    lessonId: 'maiusculas',
    titulo: 'Maiúsculas não são evidência',
    descricao: 'Aprenda a separar o jeito de escrever das evidências que sustentam uma mensagem.',
    categoria: 'linguagem',
    nivel: 'basico',
    icone: 'fa-font',
    ordem: 1,
    tempoLeitura: 3,
    conteudoHTML: `
      <h3>Uma mensagem no grupo</h3>
      <p><strong>Situação fictícia:</strong> alguém envia “ATENÇÃO! AS AULAS DE AMANHÃ FORAM CANCELADAS!!!”. Outra pessoa escreve a mesma informação sem maiúsculas: “As aulas de amanhã foram canceladas”. Qual das mensagens está comprovada? Com esses trechos, ainda não sabemos.</p>
      <p>Maiúsculas, exclamações e emojis podem chamar atenção ou expressar emoção. Também aparecem em avisos legítimos, conversas informais e recursos de acessibilidade. Já um texto calmo pode apresentar uma informação inventada. O estilo ajuda a perceber como uma mensagem tenta nos envolver, mas não determina sua veracidade.</p>
      <h3>O que investigar</h3>
      <ol>
        <li><strong>Reescreva a afirmação.</strong> Retire a pontuação e identifique o que é verificável: “Haverá cancelamento das aulas de determinada escola em determinada data”.</li>
        <li><strong>Procure a origem.</strong> Quem tomou a decisão? Busque o comunicado no canal oficial da instituição, acessado diretamente, em vez de confiar apenas no nome exibido no print.</li>
        <li><strong>Confira os detalhes.</strong> Veja data, turno, unidade e público atingido. Um aviso de outra escola ou de outro ano pode circular novamente.</li>
        <li><strong>Compare a mensagem com o documento.</strong> A publicação original realmente diz que todas as aulas foram canceladas? Há alguma condição que ficou de fora?</li>
      </ol>
      <p>Se você não encontrar o comunicado, registre o que falta e procure a secretaria por um contato conhecido. A falta de um resultado de busca não transforma automaticamente a mensagem em mentira. Ela indica que a informação continua sem confirmação suficiente.</p>
      <h3>Antes de compartilhar</h3>
      <p>Encaminhe o endereço do comunicado com a data e o contexto, quando houver confirmação. Evite trocar a investigação por uma avaliação da escrita de quem enviou a mensagem.</p>
      <p><strong>Para pensar:</strong> quais documentos você pediria para confirmar as duas versões do aviso, independentemente da quantidade de exclamações?</p>
      ${references}
    `
  },
  {
    ...editorial,
    lessonId: 'sensacionalismo',
    titulo: 'Desconfie da pressa, investigue',
    descricao: 'Entenda como títulos e pedidos de urgência influenciam sua decisão de compartilhar.',
    categoria: 'linguagem',
    nivel: 'basico',
    icone: 'fa-bullhorn',
    ordem: 2,
    tempoLeitura: 3,
    conteudoHTML: `
      <h3>“Compartilhe antes que apaguem”</h3>
      <p><strong>Situação fictícia:</strong> uma publicação anuncia “BOLSA PARA TODOS! CADASTRE-SE HOJE OU PERCA A CHANCE”. Ela traz o nome de uma instituição conhecida e um link encurtado. Você quer ajudar os colegas, mas a promessa e o prazo merecem investigação.</p>
      <p>Títulos podem selecionar o detalhe mais chamativo de uma história. Pedidos de urgência diminuem o tempo que dedicamos a ler, comparar e perguntar. Isso é um motivo para pausar, não uma prova de falsidade: inscrições e alertas legítimos também podem ter prazos curtos.</p>
      <h3>Uma pausa em quatro passos</h3>
      <ol>
        <li><strong>Leia além do título.</strong> Identifique quem oferece a bolsa, quais critérios existem, qual o prazo e onde está o edital. “Para todos” pode omitir restrições importantes.</li>
        <li><strong>Acesse a instituição por conta própria.</strong> Digite o endereço conhecido ou procure o canal oficial. Não é necessário abrir o link recebido para começar a verificação.</li>
        <li><strong>Encontre a evidência da promessa.</strong> Confira o edital completo e suas alterações. Compare valores, datas, requisitos e endereço de inscrição com a publicação.</li>
        <li><strong>Observe o pedido de ação.</strong> Há cobrança inesperada ou solicitação de dados sem explicação? Antes de fornecer qualquer informação, confirme o procedimento com a instituição.</li>
      </ol>
      <p>Uma frase como “ninguém quer que você saiba” pode estimular curiosidade e desconfiança sem apresentar provas. Pergunte qual fato está sendo afirmado e qual documento permitiria verificá-lo. A popularidade da postagem e os comentários de outras pessoas não substituem essa evidência.</p>
      <h3>Compartilhe com contexto</h3>
      <p>Se a oportunidade for confirmada, prefira encaminhar o edital ou a página original, explicando os requisitos. Se continuar incerta, diga exatamente o que não conseguiu confirmar e evite ampliar uma promessa que pode induzir colegas ao erro.</p>
      <p><strong>Para pensar:</strong> que informação mudaria sua decisão sobre a postagem: um título mais tranquilo ou um edital que corresponda à oferta?</p>
      ${references}
    `
  },
  {
    ...editorial,
    lessonId: 'fontes',
    titulo: 'Siga o caminho da informação',
    descricao: 'Investigue autoria, documentos e confirmação independente sem julgar pela aparência do site.',
    categoria: 'fontes',
    nivel: 'basico',
    icone: 'fa-link',
    ordem: 3,
    tempoLeitura: 4,
    conteudoHTML: `
      <h3>De onde veio esse número?</h3>
      <p><strong>Situação fictícia:</strong> um perfil afirma que “a biblioteca vai ganhar mil livros” e cita apenas “uma pesquisa”. Três blogs repetem a frase. Antes de contar isso como três confirmações, precisamos descobrir se todos copiaram a mesma publicação.</p>
      <p>Uma fonte é o caminho pelo qual chegamos a uma informação: uma pessoa, reportagem, documento, conjunto de dados ou registro. Uma fonte primária tem relação direta com o fato investigado, como o edital de uma compra. Isso não a torna infalível: o documento ainda precisa ser interpretado dentro de seus limites.</p>
      <h3>Construa uma pequena trilha de evidências</h3>
      <ol>
        <li><strong>Identifique a autoria.</strong> Quem publicou? A página informa responsáveis, contato e possíveis interesses? Um nome conhecido é um ponto de partida, não uma garantia para toda afirmação.</li>
        <li><strong>Abra a referência original.</strong> Procure o relatório, edital, entrevista ou registro citado. Confira se ele realmente contém o número e se trata da mesma biblioteca.</li>
        <li><strong>Examine a precisão.</strong> Mil livros foram comprados, doados, prometidos ou já entregues? Essas situações descrevem fatos diferentes. Anote a data e o trecho relevante.</li>
        <li><strong>Busque confirmação independente.</strong> Compare com outra apuração que tenha consultado documentos ou pessoas por conta própria. Repetições da mesma origem não acrescentam evidências independentes.</li>
      </ol>
      <p>A aparência de um site, seu domínio e sua popularidade podem ajudar a identificar quem publica, mas não resolvem a checagem. Um portal sofisticado pode errar; um documento simples pode conter uma evidência importante. Priorize o que pode ser examinado e a transparência sobre como a informação foi obtida.</p>
      <h3>Deixe seu caminho visível</h3>
      <p>Guarde o link, o título, a data e uma anotação do que cada fonte demonstra. Ao compartilhar uma conclusão, permita que outras pessoas percorram o mesmo caminho e percebam as incertezas restantes.</p>
      <p><strong>Para pensar:</strong> os três blogs trouxeram novas provas ou apenas fizeram a mesma afirmação circular?</p>
      ${references}
    `
  },
  {
    ...editorial,
    lessonId: 'contexto',
    titulo: 'Confira a data e o contexto',
    descricao: 'Uma publicação pode ser autêntica e ainda assim ser usada para contar uma história diferente.',
    categoria: 'contexto',
    nivel: 'basico',
    icone: 'fa-calendar-days',
    ordem: 4,
    tempoLeitura: 3,
    conteudoHTML: `
      <h3>Um aviso antigo chega como novidade</h3>
      <p><strong>Situação fictícia:</strong> circula uma notícia sobre suspensão do transporte escolar com a legenda “aconteceu hoje”. A reportagem existe, mas foi publicada dois anos antes e se refere a outro município. O texto original pode estar correto, enquanto o novo compartilhamento induz a uma conclusão errada.</p>
      <p>Contexto é o conjunto de informações que dá sentido a uma afirmação: quando e onde algo ocorreu, quem foi afetado, o que veio antes e quais condições estavam presentes. Recortes podem retirar esses elementos sem mudar as palavras do trecho apresentado.</p>
      <h3>Reconstrua a história</h3>
      <ol>
        <li><strong>Separe as datas.</strong> Confira a data do acontecimento, a de publicação e a de eventual atualização. A data de compartilhamento no seu grupo não é necessariamente nenhuma dessas.</li>
        <li><strong>Localize o lugar e o público.</strong> Veja se o aviso trata da sua cidade, da mesma unidade e dos mesmos estudantes. Nomes semelhantes podem causar confusão.</li>
        <li><strong>Leia o conteúdo completo.</strong> Procure condições, ressalvas e a frase anterior ou posterior à citação. Compare a legenda recebida com a informação original.</li>
        <li><strong>Procure desdobramentos.</strong> Houve correção, retomada do serviço ou mudança de decisão? Consulte publicações posteriores e os canais responsáveis.</li>
      </ol>
      <p>Notícias antigas continuam úteis para pesquisa e memória. O problema é apresentá-las como se descrevessem a situação atual sem esclarecer a época. Da mesma forma, uma foto verdadeira de uma enchente em outra cidade não comprova uma ocorrência no seu bairro.</p>
      <h3>Mostre o contexto ao corrigir</h3>
      <p>Você pode escrever: “A reportagem é de outra data e se refere a outro município; este é o link original”. Essa explicação é mais informativa do que chamar todo o conteúdo de falso. Se a situação atual continuar desconhecida, diga isso com clareza.</p>
      <p><strong>Para pensar:</strong> qual detalhe ausente muda o sentido do aviso recebido: a data, o lugar, o público ou mais de um deles?</p>
      ${references}
    `
  },
  {
    ...editorial,
    lessonId: 'emocional',
    titulo: 'Quando a mensagem mexe com você',
    descricao: 'Reconheça reações de medo, raiva e identificação e transforme a reação em investigação.',
    categoria: 'linguagem',
    nivel: 'basico',
    icone: 'fa-heart',
    ordem: 5,
    tempoLeitura: 3,
    conteudoHTML: `
      <h3>A vontade de ajudar também pede cuidado</h3>
      <p><strong>Situação fictícia:</strong> uma mensagem com foto de um estudante pede doações urgentes e diz “se você se importa, envie para todos”. Você sente vontade de ajudar imediatamente. Essa reação é compreensível, mas ainda faltam informações sobre a origem e o destino do pedido.</p>
      <p>Mensagens podem despertar medo, raiva, esperança, solidariedade ou orgulho. Sentir emoção não significa ter sido enganado, e um relato emocionante pode ser verdadeiro. A tarefa é perceber quando a reação ocupa o lugar da investigação e nos leva a compartilhar antes de conferir.</p>
      <h3>Transforme a reação em perguntas</h3>
      <ol>
        <li><strong>Nomeie sua reação.</strong> Pense: “Estou com pressa porque fiquei preocupado”. Faça uma pausa suficiente para ler o pedido inteiro e identificar o fato que precisa de confirmação.</li>
        <li><strong>Investigue a origem.</strong> Procure a publicação inicial, a data e quem organiza a campanha. Uma mensagem encaminhada por alguém de confiança pode ter começado em uma origem desconhecida.</li>
        <li><strong>Confirme por outro caminho.</strong> Busque contato conhecido da organização ou da pessoa responsável, sem usar apenas os dados da corrente. Confira se a campanha continua ativa e se o destino da doação corresponde ao divulgado.</li>
        <li><strong>Questione sua preferência.</strong> Você exigiria as mesmas provas se a mensagem contrariasse o que já pensa? Faça esse teste também com conteúdos que parecem confirmar sua opinião.</li>
      </ol>
      <p>Frases que culpam quem não encaminha ou prometem que o compartilhamento, sozinho, resolverá uma situação não demonstram que o pedido é legítimo. Procure informações verificáveis sem expor desnecessariamente dados pessoais de quem aparece na mensagem.</p>
      <h3>Converse sem atacar</h3>
      <p>Ao pedir uma fonte, explique sua dúvida: “Quero ajudar, mas você tem a publicação original e a data?”. Isso abre espaço para a investigação e evita transformar uma correção em um julgamento da pessoa.</p>
      <p><strong>Para pensar:</strong> que evidência você procuraria antes de agir, mesmo se a mensagem parecesse confirmar uma preocupação sua?</p>
      ${references}
    `
  },
  {
    ...editorial,
    lessonId: 'midia',
    titulo: 'Imagens, prints e deepfakes',
    descricao: 'Procure a origem de fotos, vídeos e capturas antes de aceitar a legenda que os acompanha.',
    categoria: 'midia',
    nivel: 'intermediario',
    icone: 'fa-image',
    ordem: 6,
    tempoLeitura: 4,
    conteudoHTML: `
      <h3>A imagem não conta tudo sozinha</h3>
      <p><strong>Situação fictícia:</strong> um vídeo atribui a um diretor a frase “as bolsas serão canceladas”. O trecho tem poucos segundos e circula sem link. Ele pode ser um recorte de outra conversa, conter uma edição ou até ter sido produzido com inteligência artificial. Também pode registrar uma fala autêntica. A aparência isolada não decide entre essas possibilidades.</p>
      <p>Uma imagem verdadeira pode receber uma legenda errada. Prints podem perder data, endereço e sequência da conversa. Deepfakes são conteúdos que simulam a aparência ou a voz de uma pessoa com recursos de IA. Olhos, iluminação ou movimentos estranhos podem levantar perguntas, mas sua presença ou ausência não comprova autenticidade.</p>
      <h3>Rastreie antes de concluir</h3>
      <ol>
        <li><strong>Procure a publicação original.</strong> Peça o link e pesquise palavras da fala ou da legenda. Busque a gravação completa em canais ligados ao evento ou à pessoa mencionada.</li>
        <li><strong>Compare contexto e sequência.</strong> Ouça o que veio antes e depois. Veja data, local, participantes e se o trecho recebeu cortes que alteram o sentido.</li>
        <li><strong>Investigue a imagem.</strong> Uma busca reversa pode ajudar a encontrar usos anteriores de uma foto ou de um quadro do vídeo. Um resultado mais antigo é uma pista para conferir; a ausência de resultados não prova que a imagem é nova ou verdadeira.</li>
        <li><strong>Busque evidências adicionais.</strong> Consulte o comunicado original, registros do evento e apurações independentes. Ferramentas automáticas de detecção podem errar e não devem decidir a checagem sozinhas.</li>
      </ol>
      <p>Evite enviar imagens com dados pessoais para serviços desconhecidos. Se não conseguir rastrear o material, descreva a limitação: “Não encontrei a gravação completa”. Não é preciso escolher uma conclusão categórica quando as evidências não permitem isso.</p>
      <p><strong>Para pensar:</strong> o que seria mais útil para investigar a fala do diretor: ampliar o rosto no vídeo ou encontrar a gravação original e o comunicado sobre as bolsas?</p>
      ${references}
    `
  },
  {
    ...editorial,
    lessonId: 'fato-opiniao',
    titulo: 'Fato, opinião ou publicidade?',
    descricao: 'Identifique o tipo de mensagem e quais partes podem ser investigadas com evidências.',
    categoria: 'conceitos',
    nivel: 'basico',
    icone: 'fa-comments',
    ordem: 7,
    tempoLeitura: 3,
    conteudoHTML: `
      <h3>Nem toda frase pede a mesma checagem</h3>
      <p><strong>Situação fictícia:</strong> um perfil publica: “A biblioteca abre às oito. É o melhor lugar do campus. Compre este curso para estudar melhor”. As três frases aparecem na mesma postagem, mas cumprem funções diferentes e exigem perguntas diferentes.</p>
      <p>Uma afirmação factual descreve algo que pode ser confrontado com registros e observações, como o horário de abertura. Uma opinião expressa uma avaliação, como considerar um lugar o melhor. Publicidade busca promover uma oferta e pode misturar opiniões com afirmações verificáveis. Sátira usa humor e exagero, mas pode perder esse contexto quando compartilhada em recortes.</p>
      <h3>Leia em camadas</h3>
      <ol>
        <li><strong>Separe as afirmações.</strong> Uma postagem não precisa receber um único rótulo. Destaque horários, números, promessas e avaliações pessoais, procurando analisar cada parte.</li>
        <li><strong>Formule a pergunta verificável.</strong> “Qual é o horário atual da biblioteca?” pode ser respondida por um aviso atualizado. “É o melhor lugar?” depende dos critérios e das preferências de quem fala.</li>
        <li><strong>Observe a intenção e a identificação.</strong> Há venda, patrocínio, comissão, humor ou comentário pessoal? Procure informações sobre quem publica e possíveis interesses na mensagem.</li>
        <li><strong>Confira as premissas.</strong> Uma opinião pode usar um dado errado para se sustentar. Mesmo quando não se pode checar a preferência, é possível investigar o número ou o acontecimento citado.</li>
      </ol>
      <p>Previsões sobre o futuro também exigem cuidado. Você pode investigar as evidências e as condições de uma previsão, mas não tratar o resultado futuro como um fato já ocorrido. Frases vagas podem precisar de esclarecimento antes de uma checagem.</p>
      <h3>Uma resposta mais precisa</h3>
      <p>Em vez de dizer apenas “essa postagem é verdadeira”, explique qual parte foi confirmada, qual é opinião e qual continua sem comprovação. Isso ajuda outras pessoas a compreender os limites da sua conclusão.</p>
      <p><strong>Para pensar:</strong> quais trechos da postagem sobre a biblioteca você conseguiria verificar hoje e que fonte escolheria para cada um?</p>
      ${references}
    `
  },
  {
    ...editorial,
    lessonId: 'estatisticas',
    titulo: 'O que os números deixam de fora',
    descricao: 'Leia percentuais e gráficos conferindo a base de comparação, os eixos e o período.',
    categoria: 'dados',
    nivel: 'intermediario',
    icone: 'fa-chart-column',
    ordem: 8,
    tempoLeitura: 4,
    conteudoHTML: `
      <h3>Dobrou, mas de quanto para quanto?</h3>
      <p><strong>Situação fictícia:</strong> uma postagem anuncia que “as inscrições no clube de ciências cresceram 100%”. No mês anterior havia dez inscritos; neste mês há vinte. O crescimento percentual está correto, mas conhecer os valores absolutos ajuda a entender seu tamanho e seu significado.</p>
      <p>Um percentual depende de uma base. O aumento de dez para vinte é de dez pessoas, equivalente a 100% das dez iniciais. Já passar de 10% para 20% dos estudantes representa aumento de dez pontos percentuais e crescimento relativo de 100%. São formas diferentes de descrever uma mudança.</p>
      <h3>Quatro perguntas para um gráfico</h3>
      <ol>
        <li><strong>Qual é a base?</strong> Procure numerador, denominador e tamanho da amostra. “Metade dos respondentes” não significa necessariamente metade de todos os alunos da instituição.</li>
        <li><strong>O que os eixos mostram?</strong> Leia unidades, intervalos e origem da escala. Um eixo vertical que começa perto dos valores observados pode ampliar visualmente uma diferença. Isso pede explicação e comparação, não uma conclusão automática de fraude.</li>
        <li><strong>Qual é o período?</strong> Compare intervalos equivalentes e veja se datas importantes foram omitidas. Uma semana de inscrições não deve ser comparada diretamente com um mês inteiro sem esclarecer a diferença.</li>
        <li><strong>De onde vieram os dados?</strong> Abra a tabela ou o relatório original e confira o método de coleta. Pergunte quem respondeu, quando e quais limitações foram informadas.</li>
      </ol>
      <p>Dois acontecimentos que variam juntos não demonstram, por si só, que um causou o outro. O aumento das inscrições pode coincidir com uma campanha de divulgação, mas também com mudança de horário ou abertura de vagas. Uma explicação causal exige investigação adicional.</p>
      <h3>Explique sem esconder a escala</h3>
      <p>Uma descrição útil do exemplo seria: “As inscrições passaram de dez para vinte entre os dois meses”. Assim, a pessoa pode entender tanto o crescimento relativo quanto o número de participantes.</p>
      <p><strong>Para pensar:</strong> que informação falta quando você lê apenas “90% aprovaram”, sem saber quem respondeu e quantas pessoas participaram?</p>
      ${references}
    `
  },
  {
    ...editorial,
    lessonId: 'ia',
    titulo: 'IA ajuda, evidências decidem',
    descricao: 'Entenda as possibilidades da análise automática e o significado de um resultado inconclusivo.',
    categoria: 'ia',
    nivel: 'basico',
    icone: 'fa-robot',
    ordem: 9,
    tempoLeitura: 4,
    conteudoHTML: `
      <h3>Uma resposta segura de si pode estar errada</h3>
      <p><strong>Situação fictícia:</strong> um assistente de IA afirma que um novo edital foi publicado e apresenta um título convincente. Você procura no portal da instituição e não encontra o documento. A explicação produzida pela ferramenta, sozinha, ainda não confirma a existência do edital.</p>
      <p>Ferramentas de IA podem ajudar a organizar perguntas, resumir materiais e localizar aspectos que merecem investigação. Também podem produzir informações incorretas, referências inexistentes ou interpretações inadequadas. Fluência e segurança na escrita não são medidas de precisão.</p>
      <h3>Use a ferramenta como apoio</h3>
      <ol>
        <li><strong>Identifique a tarefa realizada.</strong> A ferramenta leu um documento, pesquisou checagens ou apenas analisou a linguagem? Essas atividades produzem informações diferentes e têm limites diferentes.</li>
        <li><strong>Abra as fontes.</strong> Confira se os links existem, se os documentos citados dizem o que foi resumido e se as datas e o contexto correspondem à afirmação recebida.</li>
        <li><strong>Separe estilo de veracidade.</strong> Um índice de padrões de linguagem não é a probabilidade de uma notícia ser verdadeira. Termos alarmistas ou uma escrita neutra não substituem evidências sobre o acontecimento.</li>
        <li><strong>Registre o que permanece desconhecido.</strong> “Sem evidências suficientes” significa que os dados disponíveis não sustentam uma conclusão. Isso não equivale a “falso” nem a “verdadeiro”.</li>
      </ol>
      <p>No VerificaFato, a análise automática deve ser lida junto das fontes, das datas e das limitações apresentadas. A busca pode não encontrar uma checagem publicada, e um serviço pode estar indisponível. Nenhuma dessas situações resolve, por si só, a questão investigada.</p>
      <h3>Continue por outro caminho</h3>
      <p>Para o edital do exemplo, consulte a página de editais e entre em contato com a instituição por um canal conhecido. Evite inserir dados pessoais de colegas em ferramentas externas quando eles não forem necessários à investigação.</p>
      <p><strong>Para pensar:</strong> qual evidência permitiria confirmar o edital: outra resposta de IA ou o documento original publicado pela instituição?</p>
      ${references}
    `
  },
  {
    ...editorial,
    lessonId: 'correcao',
    titulo: 'Compartilhou errado? Corrija',
    descricao: 'Aprenda a corrigir uma informação com clareza, respeito e uma fonte que outras pessoas possam conferir.',
    categoria: 'cidadania',
    nivel: 'basico',
    icone: 'fa-arrow-rotate-left',
    ordem: 10,
    tempoLeitura: 3,
    conteudoHTML: `
      <h3>A correção faz parte do cuidado</h3>
      <p><strong>Situação fictícia:</strong> você compartilhou no grupo da turma que uma prova seria adiada. Depois, encontrou o calendário atualizado e percebeu que o aviso tratava de outra turma. Agora é possível corrigir a informação e ajudar quem já a recebeu.</p>
      <p>Errar ao compartilhar pode acontecer. Uma correção útil deixa claro o que mudou, apresenta a informação verificada e permite consultar a fonte. Apagar a postagem pode reduzir novas visualizações, mas talvez não alcance quem já leu, anotou ou encaminhou a mensagem.</p>
      <h3>Corrija em quatro passos</h3>
      <ol>
        <li><strong>Interrompa o compartilhamento.</strong> Antes de encaminhar uma nova versão, confira se você identificou corretamente a data, a turma e o documento relevante.</li>
        <li><strong>Avise no mesmo espaço.</strong> Quando possível, responda à mensagem original ou publique uma correção clara no grupo em que o erro circulou. Assim, quem viu o aviso consegue relacionar as duas informações.</li>
        <li><strong>Apresente a informação confirmada primeiro.</strong> Escreva, por exemplo: “Correção: a prova da nossa turma está mantida. O aviso que enviei se referia a outra turma”. Inclua o calendário ou o comunicado atualizado.</li>
        <li><strong>Explique a fonte e os limites.</strong> Diga onde e quando consultou o documento. Se parte do assunto continuar incerta, informe exatamente essa parte e procure esclarecimento antes de concluir.</li>
      </ol>
      <p>Evite transformar a correção em um ataque a quem enviou a mensagem. Uma pergunta como “você tem a publicação original?” costuma ajudar mais a investigação do que uma acusação. Também não é necessário repetir detalhes pessoais ou conteúdo ofensivo para explicar o erro.</p>
      <h3>Deixe uma trilha de atualização</h3>
      <p>Se você administra uma página, pode acrescentar uma nota com data, informação corrigida e link para a fonte. Quando descobrir que uma checagem sua estava incompleta, atualize a conclusão com a mesma transparência. Corrigir com evidências demonstra como o conhecimento pode ser revisto.</p>
      <p><strong>Para pensar:</strong> quem precisa receber a correção do aviso sobre a prova, e qual documento permitirá conferir a informação atual?</p>
      ${references}
    `
  }
];

export const quizQuestions = [
  {
    id: 'aviso-escolar',
    lessonId: 'fontes',
    pergunta: 'Cenário fictício: um print no grupo diz que amanhã não haverá aula, mas não mostra data nem link. Qual é o melhor primeiro passo?',
    opcoes: [
      'Conferir o comunicado no canal conhecido da escola e verificar a data e a turma.',
      'Compartilhar com outra turma para descobrir se a maioria recebeu o mesmo aviso.',
      'Aceitar o aviso porque o print usa o logotipo da escola.'
    ],
    correta: 0,
    explicacao: 'Procure a origem e confira data, unidade e público do comunicado. Um logotipo pode ser copiado, e muitas pessoas repetirem a mesma mensagem não cria confirmação independente.'
  },
  {
    id: 'noticia-antiga',
    lessonId: 'contexto',
    pergunta: 'Cenário fictício: uma reportagem verdadeira de dois anos atrás volta a circular com a legenda “aconteceu hoje”. Como avaliar esse compartilhamento?',
    opcoes: [
      'A legenda é confiável porque a reportagem original existe.',
      'A reportagem pode ser autêntica, mas a nova legenda apresenta um contexto enganoso.',
      'A reportagem inteira se torna falsa apenas por ser antiga.'
    ],
    correta: 1,
    explicacao: 'Data e contexto fazem parte da verificação. Uma reportagem antiga pode estar correta sobre sua época e ser usada de forma enganosa ao descrever uma situação atual.'
  },
  {
    id: 'resultado-inconclusivo',
    lessonId: 'ia',
    pergunta: 'Cenário fictício: uma ferramenta não encontra checagens publicadas sobre uma afirmação. O que é possível concluir?',
    opcoes: [
      'A afirmação é falsa porque não apareceu na busca.',
      'A afirmação é verdadeira porque ninguém a desmentiu.',
      'A busca não resolveu a questão; é preciso investigar fontes e contexto.'
    ],
    correta: 2,
    explicacao: 'Não encontrar checagens pode refletir limites de cobertura, termos de busca ou um assunto recente. Ausência de resultado não confirma nem nega a afirmação.'
  },
  {
    id: 'inscricoes-clube',
    lessonId: 'estatisticas',
    pergunta: 'Cenário fictício: as inscrições de um clube passaram de 10 para 20. Qual descrição apresenta o percentual e a base de comparação?',
    opcoes: [
      'O número de inscritos cresceu 100%, passando de 10 para 20.',
      'O número de inscritos cresceu 10%, pois entraram 10 pessoas.',
      'O número de inscritos cresceu 200%, pois agora há 20 pessoas.'
    ],
    correta: 0,
    explicacao: 'O aumento foi de 10 pessoas em relação às 10 iniciais: 10 ÷ 10 = 100%. Informar os valores absolutos evita que o percentual seja interpretado sem conhecer a escala.'
  },
  {
    id: 'video-recortado',
    lessonId: 'midia',
    pergunta: 'Cenário fictício: um vídeo curto atribui uma fala ao diretor. A imagem parece natural, mas não há origem identificada. O que ajuda mais a investigar?',
    opcoes: [
      'Aceitar a fala, já que o rosto não apresenta defeitos visíveis.',
      'Procurar a gravação completa, sua publicação original e registros que confirmem o contexto.',
      'Decidir apenas pelo resultado de um detector automático de IA.'
    ],
    correta: 1,
    explicacao: 'A aparência do vídeo e os detectores automáticos não bastam para comprovar autenticidade. A gravação completa, a origem, a data e evidências adicionais ajudam a avaliar edição e contexto.'
  }
];
