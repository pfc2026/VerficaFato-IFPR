import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { analisarConteudo } from './services/analysis.js';
import { HttpError } from './services/errors.js';
import { requestMetrics } from './middleware/metrics.js';
import { autenticarOpcional, getSigningSecret } from './middleware/auth.js';
import { textField, httpUrl, validate } from './middleware/validation.js';
import authRoutes from './routes/auth.js';
import adminRoutes, { sanitizeLesson } from './routes/admin.js';
import historyRoutes from './routes/historico.js';
import Fonte from './models/Fonte.js';
import ConteudoEdu from './models/ConteudoEdu.js';
import Verificacao from './models/Verificacao.js';
import NoticiaColetada from './models/NoticiaColetada.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
mongoose.set('bufferCommands', false);
mongoose.set('maxTimeMS', 2500);
let databaseConnection;
export async function connectDatabase({ seed = false } = {}) {
  if (mongoose.connection.readyState === 1) return true;
  if (!process.env.MONGO_URI) return false;
  if (!databaseConnection) {
    databaseConnection = mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2500, connectTimeoutMS: 2500 })
      .then(async () => {
        if (seed) await Promise.all([seedFontesIniciais(), seedLicoesIniciais()]);
        return true;
      }).catch(() => false).finally(() => { databaseConnection = null; });
  }
  return databaseConnection;
}
const inputSchema = z.object({
  texto: z.string().trim().max(20000).optional(), link: z.union([z.literal(''), httpUrl]).optional(),
  cidade: textField().optional(), categoria: textField().optional()
}).strict().refine(value => Boolean(value.texto) !== Boolean(value.link), 'Envie somente texto ou link.').refine(value => !value.texto || value.texto.length >= 10, 'Forneça pelo menos 10 caracteres.');

export function createApp({ analyze = analisarConteudo, dbReady = () => mongoose.connection.readyState === 1, rateLimits = true } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestMetrics);
  if (process.env.TRUST_PROXY === '1' || process.env.VERCEL === '1') app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'], styleSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:', 'http:'], fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'data:'], connectSrc: ["'self'"],
    objectSrc: ["'none'"], frameAncestors: ["'none'"], upgradeInsecureRequests: null
  } }, crossOriginEmbedderPolicy: false, strictTransportSecurity: process.env.NODE_ENV === 'production' ? undefined : false }));
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = (process.env.APP_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
    const sameOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin && origin !== sameOrigin && !allowed.includes(origin)) return res.status(403).json({ sucesso: false, erro: 'Origem não autorizada.' });
    if (origin) {
      res.set('Access-Control-Allow-Origin', origin); res.vary('Origin');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });
  app.use(express.json({ limit: '64kb', strict: true }));
  app.use(express.urlencoded({ extended: false, limit: '64kb', parameterLimit: 20 }));
  app.use(express.static(path.join(directory, 'public'), { dotfiles: 'deny' }));
  const requiresDatabase = (req, res, next) => dbReady() ? next() : res.status(503).json({ sucesso: false, erro: 'Banco de dados temporariamente indisponível.' });
  if (rateLimits) {
    const options = { windowMs: 15 * 60 * 1000, standardHeaders: 'draft-8', legacyHeaders: false, message: { sucesso: false, erro: 'Muitas tentativas. Tente novamente em alguns minutos.' } };
    app.use('/api/auth', rateLimit({ ...options, limit: 30 }));
    app.use('/api/verificar', rateLimit({ ...options, limit: 30 }));
  }
  app.use('/api/auth', requiresDatabase, authRoutes);
  app.use('/api/admin', requiresDatabase, adminRoutes);
  app.use('/api/historico', requiresDatabase, historyRoutes);
  app.post('/api/verificar', autenticarOpcional, async (req, res, next) => {
    const body = validate(inputSchema, req.body, res); if (!body) return;
    try {
      const controller = new AbortController();
      res.once('close', () => { if (!res.writableFinished) controller.abort(); });
      const dados = await analyze(body, { signal: controller.signal, buscarRegionais: (text, url) => NoticiaColetada.buscarCorrespondentes(text, url) });
      if (req.user && dbReady()) {
        try {
          await Verificacao.create({ userId: req.user._id, texto: body.texto || body.link, cidade: body.cidade || '', categoria: body.categoria || '',
            porcentagem: null, confianca: null, veredito: dados.veredito, explicacao: dados.explicacao || '', fonte: dados.fonte || 'analise',
            dadosAPI: dados.resultados || [], schemaVer: 2, resultado: dados });
        } catch { dados.avisoHistorico = 'A análise foi concluída, mas não foi possível salvar no histórico.'; }
      }
      return res.json({ sucesso: true, dados });
    } catch (error) { return next(error); }
  });
  app.get('/api/fontes', requiresDatabase, async (req, res, next) => {
    try { return res.json({ sucesso: true, fontes: await Fonte.find({ ativo: true }).sort({ ordem: 1 }).limit(500) }); }
    catch (error) { return next(error); }
  });
  app.get('/api/education', requiresDatabase, async (req, res, next) => {
    try {
      const records = await ConteudoEdu.find({ ativo: true }).sort({ ordem: 1 }).limit(500).lean();
      return res.json({ sucesso: true, licoes: records.map(item => ({ ...item, conteudoHTML: sanitizeLesson(item.conteudoHTML) })) });
    } catch (error) { return next(error); }
  });
  app.get('/api/status', (req, res) => res.json({ status: dbReady() ? 'ok' : 'degradado', app: 'VerificaFato', mongo: dbReady() ? 'conectado' : 'desconectado', timestamp: new Date().toISOString() }));
  app.use('/api', (req, res) => res.status(404).json({ sucesso: false, erro: 'Rota não encontrada.' }));
  app.get('*', (req, res) => res.sendFile(path.join(directory, 'public/html/index.html')));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const proposed = error.status || error.statusCode;
    const status = [400, 401, 403, 404, 413, 422, 429, 503, 504].includes(proposed) ? proposed : 500;
    const message = status === 413 ? 'O conteúdo enviado excede o limite permitido.' : status === 400 ? 'Dados inválidos.' : status === 422 ? 'Não foi possível analisar esse conteúdo.' : status === 503 ? 'Serviço temporariamente indisponível.' : status === 504 ? 'O serviço demorou para responder.' : 'Não foi possível concluir a operação.';
    const trustedDomain = error instanceof HttpError;
    const code = typeof error.code === 'string' && /^[A-Z_]{2,50}$/.test(error.code) ? error.code : undefined;
    if (trustedDomain && code) res.locals.errorCode = code;
    return res.status(status).json({ sucesso: false, erro: trustedDomain && status < 500 ? error.message : message, ...(trustedDomain && code ? { codigo: code } : {}) });
  });
  return app;
}

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

const app = createApp();
export default app;
const directlyExecuted = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (directlyExecuted) {
  try { getSigningSecret(); } catch {
    console.error('Configure JWT_SECRET com ao menos 32 caracteres antes de iniciar o servidor.');
    process.exit(1);
  }
  await connectDatabase({ seed: true });
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`VerificaFato disponível na porta ${port}.`));
}