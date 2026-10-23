/** Normalização determinística de texto, URLs e datas, sem inventar datas ausentes. */
const TRACKING = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'msclkid', 'ref', 'referrer']);
const MONTHS = { janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

export function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').replace(/\r\n?/g, '\n')
    .replace(/\p{C}/gu, char => char === '\n' || char === '\t' ? char : '')
    .split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}

export function normalizeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (TRACKING.has(key.toLowerCase())) url.searchParams.delete(key);
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
    return url.href;
  } catch { return value.trim(); }
}

function validParts(year, month, day, hour = 0, minute = 0, second = 0) {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
const pad = n => String(n).padStart(2, '0');
function formatParts(year, month, day, hour = 0, minute = 0, second = 0, fraction = '', zone = '') {
  if (!validParts(+year, +month, +day, +hour, +minute, +second)) return null;
  if (zone && zone !== 'Z') {
    const match = /^([+-])(\d{2}):?(\d{2})$/.exec(zone);
    if (!match || +match[2] > 23 || +match[3] > 59) return null;
    zone = `${match[1]}${match[2]}:${match[3]}`;
  }
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${fraction}${zone === 'Z' ? '+00:00' : zone}`;
}

export function parseAndNormalizeDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(text);
  if (match) return formatParts(match[1], match[2], match[3], match[4] || 0, match[5] || 0, match[6] || 0, match[7] || '', match[8] || '');
  match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  if (match) return formatParts(match[3], match[2], match[1], match[4] || 0, match[5] || 0, match[6] || 0);
  match = /^(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  if (match) return formatParts(match[1], match[2], match[3], match[4] || 0, match[5] || 0, match[6] || 0);
  match = /(?:^|\s)(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})(?:\s+(?:às?\s+)?(\d{1,2})[h:](\d{2}))?/iu.exec(text.toLowerCase());
  if (match && MONTHS[match[2]]) return formatParts(match[3], MONTHS[match[2]], match[1], match[4] || 0, match[5] || 0);
  return null;
}