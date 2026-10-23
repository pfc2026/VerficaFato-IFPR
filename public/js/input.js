import { safeWebUrl } from './safe-dom.js';
export const MAX_TEXT_LENGTH = 20000;
export function detectInput(textValue, linkValue = '') {
  const texto = String(textValue || '').trim();
  const link = String(linkValue || '').trim();
  if (!texto && !link) throw new Error('Cole um texto, uma afirmação ou um link para analisar.');
  if (texto && link) throw new Error('Preencha apenas um campo: texto ou link da notícia.');
  const content = link || texto;
  const looksLikeUrl = /^\S+:\/\/\S+$/.test(content) || /^https?:[^\s]*$/i.test(content);
  if (link || looksLikeUrl) {
    const safe = safeWebUrl(content);
    if (!safe) throw new Error('Informe um link HTTP ou HTTPS válido, sem usuário e senha.');
    if (safe.length > 2048) throw new Error('O link excede o limite de 2.048 caracteres.');
    return { texto: '', link: safe };
  }
  if (texto.length < 10) throw new Error('A afirmação deve conter pelo menos 10 caracteres.');
  if (texto.length > MAX_TEXT_LENGTH) throw new Error('O texto excede o limite de 20.000 caracteres.');
  return { texto, link: '' };
}
