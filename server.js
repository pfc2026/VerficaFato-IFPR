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
import adminRoutes from './routes/admin.js';
import historyRoutes from './routes/historico.js';
import Fonte from './models/Fonte.js';
import ConteudoEdu from './models/ConteudoEdu.js';
import Verificacao from './models/Verificacao.js';
import NoticiaColetada from './models/NoticiaColetada.js';
import { lessons } from './public/js/education-content.js';
import { educationCatalog } from './services/education.js';

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
  app.get('/api/education', async (req, res) => {
    if (!dbReady()) return res.json({ sucesso: true, licoes: educationCatalog(), origem: 'local' });
    try {
      // Include inactive records so a disabled default lesson stays hidden.
      const records = await ConteudoEdu.find({}).sort({ ordem: 1 }).limit(500).lean();
      return res.json({ sucesso: true, licoes: educationCatalog(records), origem: 'catalogo' });
    } catch {
      return res.json({ sucesso: true, licoes: educationCatalog(), origem: 'local' });
    }
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
        await ConteudoEdu.insertMany(lessons);
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
