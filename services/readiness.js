import { authenticationReadiness } from '../middleware/auth.js';
import { passwordRecoveryReadiness } from './password-recovery.js';
import { legalCatalogReadiness } from './legal-context.js';

// Configuration readiness is distinct from a successful upstream request.
export function serviceReadiness(databaseReady) {
  const authentication = authenticationReadiness();
  const provider = process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'gemini');
  const aiConfigured = process.env.ENABLE_AI_EXPLANATION === 'true' &&
    ['gemini', 'openai'].includes(provider) && Boolean(provider === 'gemini'
      ? process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL
      : process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
  return {
    status: databaseReady && authentication.configurado ? 'ok' : 'degradado',
    servicos: {
      banco: { essencial: true, status: databaseReady ? 'pronto' : 'indisponivel' },
      autenticacao: { ...authentication, essencial: true, status: databaseReady && authentication.configurado ? 'pronto' : 'indisponivel' },
      analisePublica: { essencial: true, status: 'pronto' },
      recuperacaoSenha: { ...passwordRecoveryReadiness(), essencial: false },
      checagensGoogle: { essencial: false, status: process.env.GOOGLE_API_KEY ? 'configurado' : 'desativado' },
      comentarioIA: { essencial: false, status: aiConfigured ? 'configurado' : 'desativado' },
      baseJuridica: { essencial: false, ...legalCatalogReadiness() }
    }
  };
}
