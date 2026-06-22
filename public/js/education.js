// ========== EDUCATION SECTION - LESSONS DATA ==========
const lessonsData = {
    maiusculas: {
        title: 'Atenção com excesso de maiúsculas',
        content: `
            <h3>Por que as maiúsculas são um sinal de alerta?</h3>
            <p>Textos com muitas LETRAS MAIÚSCULAS frequentemente indicam conteúdo sensacionalista ou de fake news. Essa é uma tática comum para chamar atenção e gerar reações emocionais.</p>
            
            <h3>O que observar:</h3>
            <ul>
                <li>Títulos completamente em maiúsculas</li>
                <li>Palavras-chave enfatizadas com CAPS LOCK</li>
                <li>Múltiplas exclamações ao final da frase!!!</li>
                <li>Uso excessivo de pontos de interrogação??????</li>
            </ul>

            <h3>Exemplos reais:</h3>
            <p><strong>Exemplo problemático:</strong><br>
            "VOCÊ NÃO VAI ACREDITAR NO QUE FAZEM ESCONDIDO!!! CLIQUE AGORA!!!"</p>
            
            <p><strong>Exemplo confiável:</strong><br>
            "Eleições municipais de 2024: principais candidatos anunciam propostas"</p>

            <h3>Como proteger-se:</h3>
            <ul>
                <li>Seja desconfiado de títulos em CAPS LOCK</li>
                <li>Procure a mesma notícia em fontes confiáveis</li>
                <li>Verifique se outras publicações respeitáveis reportam o mesmo fato</li>
                <li>Busque informações no site oficial da fonte</li>
            </ul>
        `
    },
    alarmista: {
        title: 'Palavras alarmistas e sensacionalistas',
        content: `
            <h3>O poder das palavras sensacionalistas</h3>
            <p>Fake news frequentemente usam palavras como "URGENTE", "BOMBA", "IMPACTANTE" e "REVELAÇÃO" para criar senso de imediatismo e urgência. Essas técnicas exploram a psicologia humana para gerar compartilhamentos impulsivos.</p>
            
            <h3>Palavras de alerta:</h3>
            <ul>
                <li>URGENTE / BREAKING NEWS</li>
                <li>BOMBA / EXPLOSIVO</li>
                <li>IMPACTANTE / CHOCANTE</li>
                <li>REVELAÇÃO / SECRETO</li>
                <li>VOCÊ NÃO SABIA</li>
                <li>MÉDICOS ODEIAM ESTE TRUQUE</li>
                <li>CONFIRA ANTES QUE REMOVAM</li>
            </ul>

            <h3>Por que funcionam?</h3>
            <p>Quando o cérebro sente urgência e emoção forte, tendemos a compartilhar ANTES de verificar. Isso é explorado propositalmente por criadores de conteúdo sensacionalista.</p>

            <h3>Dica importante:</h3>
            <p>Se uma notícia é verdadeiramente importante e confiável, ela não precisa de palavras sensacionalistas para convencer você. Jornalismo sério deixa os fatos falarem por si.</p>
        `
    },
    fontes: {
        title: 'Verificando as fontes',
        content: `
            <h3>A importância de verificar fontes</h3>
            <p>Uma das melhores formas de detectar fake news é verificar a origem da informação. Sempre procure a fonte original da notícia.</p>
            
            <h3>Passos para verificar:</h3>
            <ul>
                <li><strong>1. Encontre o link original:</strong> Clique no link da notícia e observe a URL</li>
                <li><strong>2. Verifique o domínio:</strong> É de um site de notícias conhecido e respeitável?</li>
                <li><strong>3. Pesquise a fonte:</strong> Busque "nome do site + críticas" ou "nome do site + confiável"</li>
                <li><strong>4. Procure em outro lugar:</strong> A mesma notícia aparece em outros jornais?</li>
                <li><strong>5. Veja se tem byline:</strong> Tem nome de jornalista e data clara?</li>
            </ul>

            <h3>Fontes confiáveis (Oeste do Paraná):</h3>
            <ul>
                <li>G1 Paraná</li>
                <li>Jornal O Paraná</li>
                <li>Gazeta do Povo</li>
                <li>Rádio Colmeia</li>
                <li>Tribunal de Justiça do Paraná</li>
                <li>Câmaras Municipais oficiais</li>
            </ul>

            <h3>Sinais de alerta em websites:</h3>
            <ul>
                <li>Muitos anúncios e pop-ups</li>
                <li>Conteúdo publicado sem assinatura clara</li>
                <li>Design amador ou descuidado</li>
                <li>Nenhuma página "Sobre Nós" ou contato</li>
            </ul>
        `
    },
    contexto: {
        title: 'A importância do contexto',
        content: `
            <h3>Contexto removido = Desinformação</h3>
            <p>Muitas fake news removem informação de contexto para distorcer significado. Uma frase verdadeira pode virar mentira quando tirada do seu contexto original.</p>
            
            <h3>Exemplos comuns:</h3>
            <p><strong>Com contexto removido:</strong><br>
            "Prefeito desvia milhões em recursos"</p>
            
            <p><strong>Com contexto completo:</strong><br>
            "Prefeito nega denúncia de possível desvio; investigação ainda está em fase inicial"</p>

            <h3>Técnicas usadas:</h3>
            <ul>
                <li><strong>Cherry-picking:</strong> Selecionar apenas dados que apoiam uma conclusão</li>
                <li><strong>Truncamento:</strong> Cortar trechos importantes de um discurso</li>
                <li><strong>Recontextualização:</strong> Usar citação verdadeira em contexto falso</li>
                <li><strong>Omissão:</strong> Deixar de contar parte importante da história</li>
            </ul>

            <h3>Como se proteger:</h3>
            <ul>
                <li>Sempre leia a notícia completa</li>
                <li>Procure reportagens investigativas aprofundadas</li>
                <li>Verifique se a notícia tem comentários ou resposta da pessoa mencionada</li>
                <li>Busque perspectivas de múltiplas fontes</li>
                <li>Pergunte-se: "Que informação está sendo omitida?"</li>
            </ul>
        `
    },
    emocional: {
        title: 'Manipulação emocional',
        content: `
            <h3>Emoções como arma</h3>
            <p>Fake news frequentemente exploram emoções (raiva, medo, esperança) para fazer com que você compartilhe sem pensar. Isso é chamado de "emotional hijacking".</p>
            
            <h3>Emoções mais exploradas:</h3>
            <ul>
                <li><strong>Raiva:</strong> Notícias sobre injustiça ou abuso</li>
                <li><strong>Medo:</strong> Alertas sobre saúde, segurança ou economia</li>
                <li><strong>Esperança:</strong> Promessas de solução milagrosa</li>
                <li><strong>Surpresa:</strong> Revelações surpreendentes</li>
                <li><strong>Diversão:</strong> Memes e conteúdo "viral"</li>
            </ul>

            <h3>O ciclo da manipulação emocional:</h3>
            <p>1. Notícia provoca emoção forte<br>
            2. Você compartilha impulsivamente<br>
            3. Amigos veem e compartilham também<br>
            4. Conteúdo se espalha rapidamente<br>
            5. Verificação de fatos chega tarde demais</p>

            <h3>Como proteger-se:</h3>
            <ul>
                <li>Pause antes de compartilhar - sinta a emoção</li>
                <li>Faça a "regra de 24h": espere um dia antes de compartilhar</li>
                <li>Se a notícia deixa você muito furioso, é motivo para desconfiar</li>
                <li>Verifique os fatos antes de agir emocionalmente</li>
                <li>Cultive a "higiene informacional"</li>
            </ul>

            <h3>Técnica do Fact-Check emocional:</h3>
            <p>Se você sente raiva intensa ao ler algo, faça 3 perguntas:<br>
            Essa emoção é propositalmente provocada?<br>
            Os fatos são realmente tão simples quanto parecem?<br>
            Existem outras perspectivas legítimas?</p>
        `
    },
    midia: {
        title: 'Imagens manipuladas e deepfakes',
        content: `
            <h3>A tecnologia dos Deep Fakes</h3>
            <p>Imagens e vídeos são frequentemente manipulados ou tirados de contexto. Com avanços em inteligência artificial, agora é possível criar vídeos convincentes de pessoas dizendo coisas que nunca disseram.</p>
            
            <h3>Tipos de manipulação visual:</h3>
            <ul>
                <li><strong>Foto de contexto errado:</strong> Imagem real de outro evento/lugar</li>
                <li><strong>Imagem editada:</strong> Alteração de cores, faces ou elementos</li>
                <li><strong>Deep Fake:</strong> Vídeo sintetizado com IA reproduzindo movimentos faciais</li>
                <li><strong>Screenshots de contexto falso:</strong> Prints manipulados de redes sociais</li>
                <li><strong>Vídeo retirado do contexto:</strong> Clipe genuíno mas acompanhado de legenda falsa</li>
            </ul>

            <h3>Como identificar imagens falsas:</h3>
            <ul>
                <li><strong>Pesquisa reversa:</strong> Clique direito → "Pesquisar imagem no Google"</li>
                <li><strong>Observe artefatos:</strong> Bordas pixeladas, iluminação inconsistente</li>
                <li><strong>Analise detalhes:</strong> Olhos, boca e cabelo em Deep Fakes</li>
                <li><strong>Verifique a fonte:</strong> De onde vem o arquivo original?</li>
                <li><strong>Som vs. Vídeo:</strong> Em Deep Fakes, pode haver dessincronia labial</li>
            </ul>

            <h3>Ferramentas de verificação:</h3>
            <ul>
                <li>Google Images (pesquisa reversa)</li>
                <li>TinEye - Busca inversa especializada</li>
                <li>InVID - Extensão Firefox para vídeos</li>
                <li>Snopes.com - Base de dados de fotos virais</li>
                <li>Bellingcat - Investigação visual</li>
            </ul>

            <h3>Dica importante:</h3>
            <p>Cuidado especialmente com vídeos "curtos" compartilhados por primeira vez em redes sociais. Vídeos reais geralmente aparecem em múltiplas fontes, com datas e contexto claro.</p>
        `
    }
};

// ========== TAB FILTERING SYSTEM ==========
function initializeEducationTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const educationCards = document.querySelectorAll('.education-card');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;

            // Atualizar botões ativos
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Filtrar cards
            educationCards.forEach(card => {
                if (filter === 'todos' || card.dataset.category === filter) {
                    card.classList.remove('hidden');
                    // Trigger animation
                    card.style.animation = 'none';
                    setTimeout(() => {
                        card.style.animation = 'slideIn 0.4s ease-out';
                    }, 10);
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });
}

// ========== LESSON MODAL SYSTEM ==========
function openLesson(lessonId) {
    const lesson = lessonsData[lessonId];
    if (!lesson) {
        console.error('Lição não encontrada:', lessonId);
        return;
    }

    const modal = document.getElementById('lessonModal');
    const title = document.getElementById('lessonTitle');
    const body = document.getElementById('lessonBody');

    title.textContent = lesson.title;
    body.innerHTML = lesson.content;

    modal.classList.add('show');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeLesson() {
    const modal = document.getElementById('lessonModal');
    modal.classList.add('closing');

    setTimeout(() => {
        modal.classList.remove('show', 'closing');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }, 300);
}

// ========== EVENT LISTENERS ==========
document.addEventListener('DOMContentLoaded', () => {
    initializeEducationTabs();

    // Fechar modal ao clicar fora
    const lessonModal = document.getElementById('lessonModal');
    if (lessonModal) {
        lessonModal.addEventListener('click', (e) => {
            if (e.target === lessonModal) {
                closeLesson();
            }
        });

        // Fechar modal com tecla Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lessonModal.classList.contains('show')) {
                closeLesson();
            }
        });
    }
});
