require('dotenv').config();
const express   = require('express');
const path      = require('path');
const mongoose  = require('mongoose');
const { verificarNoticia }  = require('./googleService');

let autenticarOpcional = async (req, res, next) => {
    // fallback pass-through (não quebra deploy/boot)
    req.user = null;
    next();
};

try {
    ({ autenticarOpcional } = require('./middleware/auth'));
} catch (e) {
    console.warn('⚠️ Falha ao carregar ../middleware/auth. Usando fallback no middleware opcional. Detalhe:', e.message);
}

let Verificacao;
try {
    Verificacao = require('./models/Verificacao');
} catch (e) {
    console.warn('⚠️ Falha ao carregar ../models/Verificacao. Desabilitando persistência de histórico. Detalhe:', e.message);
    Verificacao = null;
}

const Fonte       = require('./models/Fonte');
const ConteudoEdu = require('./models/ConteudoEdu');

const {
    analisarTextoLocalmente,
    calcularVeredictoFinal,
    obterRotuloVeredicto
} = require('./verificationEngine');

const app = express();

// ── MongoDB ────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ MONGO_URI não configurada nas variáveis de ambiente.');
}

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ MongoDB conectado');
        await seedFontesIniciais();
        await seedLicoesIniciais();
    })
    .catch(err => console.error('❌ MongoDB:', err.message));

// ── Middlewares ────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ── Rotas de módulos ───────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/historico', require('./routes/historico'));

// ── Gerador de Explicação Textual ──────────────────────────
/**
 * Gera um texto em português explicando POR QUE a notícia foi
 * classificada como verdadeira, suspeita ou falsa, com base nos
 * sinais detectados localmente e no resultado da API de fact-check.
 */
function gerarExplicacao(resultado) {
    const { porcentagem, veredito, alertasFalso = [], alertasConfiavel = [], dadosAPI, fonte } = resultado;

    const linhas = [];

    // Parágrafo de abertura baseado no veredito
    const aberturas = {
        'Provavelmente Falsa':      `O conteúdo analisado apresenta características fortemente associadas a desinformação.`,
        'Tende a ser falsa':        `O conteúdo analisado reúne vários sinais de alerta que indicam possível desinformação.`,
        'Inconclusivo / Verificar': `A análise não encontrou evidências suficientes para confirmar ou desmentir o conteúdo.`,
        'Tende a ser verdadeira':   `O conteúdo analisado apresenta características compatíveis com informação confiável.`,
        'Provavelmente Verdadeira': `O conteúdo analisado apresenta múltiplos indicadores de credibilidade e veracidade.`
    };
    linhas.push(aberturas[veredito] || `A análise atribuiu ao conteúdo uma pontuação de ${porcentagem}% de veracidade.`);

    // Menciona resultado da API se houver
    if (fonte === 'api' && dadosAPI?.resultados?.length > 0) {
        const r = dadosAPI.resultados[0];
        linhas.push(
            `Este conteúdo foi verificado por "${r.verificador}" em ${r.data_verificacao}, ` +
            `que classificou a alegação como "${r.avaliacao}". ` +
            `A checagem original pode ser lida em: ${r.url_verificacao}`
        );
    } else if (fonte === 'api') {
        linhas.push('A consulta a bancos de dados de fact-checking não retornou correspondências para este conteúdo, o que indica que o tema ainda não foi verificado por agências especializadas.');
    }

    // Sinais negativos detectados
    if (alertasFalso && alertasFalso.length > 0) {
        const grupos = {};
        alertasFalso.forEach(a => {
            const cat = a.categoria || 'Geral';
            if (!grupos[cat]) grupos[cat] = [];
            grupos[cat].push(a.label);
        });

        linhas.push('\n📍 Sinais de alerta identificados:');
        Object.entries(grupos).forEach(([cat, items]) => {
            linhas.push(`• ${cat}: ${items.join('; ')}.`);
        });
    }

    // Sinais positivos detectados
    if (alertasConfiavel && alertasConfiavel.length > 0) {
        linhas.push('\n✅ Elementos de credibilidade identificados:');
        alertasConfiavel.forEach(a => {
            linhas.push(`• ${a.label}.`);
        });
    }

    // Recomendação final
    const recomendacoes = {
        'Provavelmente Falsa':      'Recomendamos não compartilhar este conteúdo e, se possível, alertar quem o enviou sobre os riscos de difundir desinformação.',
        'Tende a ser falsa':        'Antes de compartilhar, busque a informação em ao menos duas fontes jornalísticas confiáveis da região ou nacionais.',
        'Inconclusivo / Verificar': 'Procure confirmar o conteúdo em veículos regionais confiáveis antes de compartilhá-lo.',
        'Tende a ser verdadeira':   'O conteúdo parece confiável, mas sempre vale conferir a fonte original antes de compartilhar.',
        'Provavelmente Verdadeira': 'O conteúdo parece confiável. Ao compartilhá-lo, cite a fonte original para ajudar a combater a desinformação.'
    };
    linhas.push('\n' + (recomendacoes[veredito] || ''));

    return linhas.join('\n');
}

// ── Rota principal de verificação ──────────────────────────
app.post('/api/verificar', autenticarOpcional, async (req, res) => {
    try {
        const { texto, cidade, categoria } = req.body;

        if (!texto || texto.trim().length === 0) {
            return res.status(400).json({ sucesso: false, erro: 'Texto não fornecido para verificação.' });
        }
        if (texto.trim().length < 10) {
            return res.status(400).json({ sucesso: false, erro: 'Texto muito curto. Forneça pelo menos 10 caracteres.' });
        }

        console.log(`📨 Verificando | cidade: ${cidade || '—'} | categoria: ${categoria || '—'} | user: ${req.user?.email || 'anônimo'}`);

        const dadosAPI = await verificarNoticia(texto.trim());

        // Análise local e cálculo do veredito final
        const analiseLocal = analisarTextoLocalmente(texto.trim());
        const resultado = calcularVeredictoFinal(dadosAPI, analiseLocal);
        const veredito = obterRotuloVeredicto(resultado.porcentagem);

        // Gera a explicação textual rica contendo os sinais identificados
        const explicacao = gerarExplicacao({
            porcentagem: resultado.porcentagem,
            veredito,
            alertasFalso: analiseLocal.alertasFalso,
            alertasConfiavel: analiseLocal.alertasConfiavel,
            dadosAPI,
            fonte: resultado.fonte
        });

        // Salva no histórico se o usuário estiver logado
        if (req.user) {
            await Verificacao.create({
                userId:      req.user._id,
                texto:       texto.trim().slice(0, 500),
                cidade:      cidade || '',
                categoria:   categoria || '',
                porcentagem: resultado.porcentagem,
                veredito,
                explicacao,
                fonte:       resultado.fonte,
                dadosAPI:    dadosAPI.resultados?.slice(0, 3) || []
            });
        }

        return res.json({
            sucesso: true,
            dados: {
                ...dadosAPI,
                porcentagem: resultado.porcentagem,
                veredito,
                explicacao,
                fonte: resultado.fonte,
                confianca: resultado.confianca
            }
        });

    } catch (error) {
        console.error('❌ Erro no endpoint /api/verificar:', error.message);
        let erroAmigavel = error.message || 'Erro interno no servidor.';
        if (/API key not valid|403/i.test(erroAmigavel)) {
            erroAmigavel = 'Chave da Google API inválida. Verifique GOOGLE_API_KEY no .env.';
        } else if (/quota|429/i.test(erroAmigavel)) {
            erroAmigavel = 'Limite de requisições da Google API excedido. Tente novamente em alguns minutos.';
        }
        return res.status(500).json({ sucesso: false, erro: erroAmigavel });
    }
});

// ── Fontes públicas (listagem para o front-end) ────────────
app.get('/api/fontes', async (req, res) => {
    try {
        const fontes = await Fonte.find({ ativo: true }).sort({ ordem: 1 });
        return res.json({ sucesso: true, fontes });
    } catch {
        return res.status(500).json({ sucesso: false, erro: 'Erro ao buscar fontes.' });
    }
});

// ── Lições educativas (listagem para o front-end) ──────────
app.get('/api/education', async (req, res) => {
    try {
        const licoes = await ConteudoEdu.find({ ativo: true }).sort({ ordem: 1 });
        return res.json({ sucesso: true, licoes });
    } catch (err) {
        return res.status(500).json({ sucesso: false, erro: 'Erro ao buscar lições educativas.' });
    }
});

// ── Health-check ───────────────────────────────────────────
app.get('/api/status', (req, res) => {
    res.json({
        status: 'ok',
        app: 'VerificaFato v2',
        apiKey: !!process.env.GOOGLE_API_KEY,
        mongo: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado',
        timestamp: new Date().toISOString()
    });
});

// Fallback: serve index.html para páginas do SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Seed: fontes iniciais no banco (se vazio) ──────────────
async function seedFontesIniciais() {
    const total = await Fonte.countDocuments();
    if (total > 0) return;
    const fontes = [
        { nome: 'Rádio Colméia (Cascavel)',  url: 'https://radiocolmeia.com.br',            ordem: 1 },
        { nome: 'Jornal O Paraná',           url: 'https://www.oparana.com.br',              ordem: 2 },
        { nome: 'Gazeta do Povo',            url: 'https://www.gazetadopovo.com.br',         ordem: 3 },
        { nome: 'Jornal de Toledo',          url: 'https://www.jornaldetoledo.com.br',       ordem: 4 },
        { nome: 'G1 Paraná',                 url: 'https://g1.globo.com/pr',                 ordem: 5 },
        { nome: 'Rádio Cultura Toledo',      url: 'https://www.radioculturatoledo.com.br',   ordem: 6 },
        { nome: 'Prefeituras do Paraná',     url: 'https://www.municipios.pr.gov.br',        ordem: 7 },
        { nome: 'TJ Paraná',                 url: 'https://www.tjpr.jus.br',                 ordem: 8 }
    ];
    await Fonte.insertMany(fontes);
    console.log('🌱 Fontes iniciais inseridas no banco.');
}

// ── Seed: lições iniciais no banco (se vazio) ──────────────
async function seedLicoesIniciais() {
    try {
        const total = await ConteudoEdu.countDocuments();
        if (total > 0) return;
        const licoes = [
            {
                lessonId: 'maiusculas',
                titulo: 'Atenção com excesso de maiúsculas',
                descricao: 'Textos com muitas letras maiúsculas podem indicar conteúdo sensacionalista.',
                categoria: 'formato',
                nivel: 'basico',
                icone: 'fa-exclamation-circle',
                ordem: 1,
                conteudoHTML: `
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
            {
                lessonId: 'alarmista',
                titulo: 'Palavras alarmistas e sensacionalistas',
                descricao: 'Termos como "urgente" e "bomba" tentam provocar reação imediata.',
                categoria: 'linguagem',
                nivel: 'basico',
                icone: 'fa-bell',
                ordem: 2,
                conteudoHTML: `
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
                    <p>Quando o cérebro sente urgência e emoção forte, tendemos a compartilhar ANTES de verificar. Isso é explorado pragmática e propositalmente por criadores de conteúdo sensacionalista.</p>
                    <h3>Dica importante:</h3>
                    <p>Se uma notícia é verdadeiramente importante e confiável, ela não precisa de palavras sensacionalistas para convencer você. Jornalismo sério deixa os fatos falarem por si.</p>
                `
            },
            {
                lessonId: 'fontes',
                titulo: 'Verificando as fontes',
                descricao: 'A origem da informação é uma das primeiras pistas de confiabilidade.',
                categoria: 'verificacao',
                nivel: 'intermediario',
                icone: 'fa-link',
                ordem: 3,
                conteudoHTML: `
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
                        <li>Câmaras Oficiais dos Municípios</li>
                    </ul>
                    <h3>Sinais de alerta em websites:</h3>
                    <ul>
                        <li>Muitos anúncios e pop-ups</li>
                        <li>Conteúdo publicado sem assinatura clara</li>
                        <li>Design amador ou descuidado</li>
                        <li>Nenhuma página "Sobre Nós" ou de contato</li>
                    </ul>
                `
            },
            {
                lessonId: 'contexto',
                titulo: 'A importância do contexto',
                descricao: 'Uma informação verdadeira pode ser distorcida quando aparece fora de contexto.',
                categoria: 'analise',
                nivel: 'intermediario',
                icone: 'fa-building',
                ordem: 4,
                conteudoHTML: `
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
            {
                lessonId: 'emocional',
                titulo: 'Manipulação emocional',
                descricao: 'Conteúdos falsos costumam explorar medo, raiva ou esperança para viralizar.',
                categoria: 'psicologia',
                nivel: 'avancado',
                icone: 'fa-heart-pulse',
                ordem: 5,
                conteudoHTML: `
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
                    <h3>Como proteger-se:</h3>
                    <ul>
                        <li>Pause antes de compartilhar - sinta a emoção</li>
                        <li>Faça a "regra de 24h": espere um dia antes de compartilhar</li>
                        <li>Se a notícia deixa você muito furioso, é motivo para desconfiar</li>
                        <li>Verifique os fatos antes de agir emocionalmente</li>
                    </ul>
                `
            },
            {
                lessonId: 'midia',
                titulo: 'Imagens manipuladas e deepfakes',
                descricao: 'Fotos, vídeos e prints também podem ser editados ou tirados de contexto.',
                categoria: 'midia',
                nivel: 'avancado',
                icone: 'fa-image',
                ordem: 6,
                conteudoHTML: `
                    <h3>A tecnologia dos Deep Fakes</h3>
                    <p>Imagens e vídeos são frequentemente manipulados ou tirados de contexto. Com avanços em inteligência artificial, agora é possível criar vídeos convincentes de pessoas dizendo coisas que nunca disseram.</p>
                    <h3>Tipos de manipulação visual:</h3>
                    <ul>
                        <li><strong>Foto de contexto errado:</strong> Imagem real de outro evento/lugar</li>
                        <li><strong>Imagem editada:</strong> Alteração de cores, faces ou elementos</li>
                        <li><strong>Deep Fake:</strong> Vídeo sintetizado com IA</li>
                        <li><strong>Screenshots de contexto falso:</strong> Prints manipulados de redes sociais</li>
                    </ul>
                    <h3>Como identificar imagens falsas:</h3>
                    <ul>
                        <li><strong>Pesquisa reversa:</strong> Clique direito → "Pesquisar imagem no Google"</li>
                        <li><strong>Observe artefatos:</strong> Bordas pixeladas, iluminação inconsistente</li>
                        <li><strong>Analise detalhes:</strong> Olhos, boca e cabelo em Deep Fakes</li>
                        <li><strong>Verifique a fonte:</strong> De onde vem o arquivo original?</li>
                    </ul>
                `
            }
        ];
        await ConteudoEdu.insertMany(licoes);
        console.log('🌱 Lições educativas iniciais inseridas no banco.');
    } catch (err) {
        console.error('❌ Erro no seed de lições:', err.message);
    }
}

// ── Start ──────────────────────────────────────────────────
// A Vercel detecta este servidor automaticamente pela chamada listen()
// (zero-config Express). A porta só é usada localmente.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 VerificaFato v2 rodando em http://localhost:${PORT}`);
    console.log(`🔑 Google API Key: ${process.env.GOOGLE_API_KEY ? 'configurada' : 'NÃO configurada'}`);
    console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'configurada' : 'usando padrão (defina no .env!)'}\n`);
});

module.exports = app;

