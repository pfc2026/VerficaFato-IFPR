// Shared browser primitives: external values are always data.
export function element(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
export function safeWebUrl(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function appendSafeLink(parent, url, label, className = '') {
  const safe = safeWebUrl(url);
  const node = element(safe ? 'a' : 'span', className, label || url || 'Fonte sem endereço');
  if (safe) { node.href = safe; node.target = '_blank'; node.rel = 'noopener noreferrer'; }
  parent.append(node);
  return node;
}
export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('vf-user') || 'null'); } catch { return null; }
}
export function showNotice(message, type = 'warning') {
  const parent = document.getElementById('alertContainer');
  if (!parent) return;
  const variant = ['success','warning','danger','info'].includes(type) ? type : 'warning';
  const alert = element('div', 'alert alert-' + variant + ' alert-dismissible fade show shadow');
  alert.setAttribute('role', 'alert');
  alert.append(element('span', '', message));
  const close = element('button', 'btn-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Fechar');
  close.addEventListener('click', () => alert.remove());
  alert.append(close);
  parent.append(alert);
  setTimeout(() => alert.remove(), 6000);
}
export function button(label, className, action) {
  const node = element('button', className, label);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
// Rebuild lesson HTML from an inert document; discard executable elements
// and all attributes, restoring links only after HTTP(S) validation.
export function sanitizeLessonHtml(html) {
  const parsed = new DOMParser().parseFromString(String(html ?? ''), 'text/html');
  const output = element('div');
  const allowed = new Set(['P','BR','STRONG','EM','B','I','U','UL','OL','LI','H2','H3','H4','BLOCKQUOTE','A','CODE','PRE']);
  const drop = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','IMG','VIDEO','AUDIO','TEMPLATE','LINK','META','BASE']);
  function copy(source, target) {
    for (const child of source.childNodes) {
      if (child.nodeType === 3) { target.append(document.createTextNode(child.textContent)); continue; }
      if (child.nodeType !== 1 || drop.has(child.tagName)) continue;
      if (!allowed.has(child.tagName)) { copy(child, target); continue; }
      const clean = element(child.tagName.toLowerCase());
      if (child.tagName === 'A') {
        const href = safeWebUrl(child.getAttribute('href'));
        if (href) { clean.href = href; clean.rel = 'noopener noreferrer'; clean.target = '_blank'; }
      }
      copy(child, clean);
      target.append(clean);
    }
  }
  copy(parsed.body, output);
  return output.innerHTML;
}
