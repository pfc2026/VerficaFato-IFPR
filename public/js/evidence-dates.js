// Shared strict ISO calendar parser; civil dates use 00:00 UTC.
export function parseEvidenceDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) return null;
  const [,ys,ms,ds,hs,mins,ss,fraction,zone] = match;
  const [year,month,day] = [ys,ms,ds].map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month-1]) return null;
  const hour = Number(hs || 0), minute = Number(mins || 0), second = Number(ss || 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  let offset = 0;
  if (zone && zone !== 'Z') {
    const zoneHour = Number(zone.slice(1,3)), zoneMinute = Number(zone.slice(4));
    if (zoneHour > 14 || zoneMinute > 59 || (zoneHour === 14 && zoneMinute !== 0)) return null;
    offset = (zoneHour * 60 + zoneMinute) * (zone[0] === '+' ? 1 : -1);
  }
  const date = new Date(0);
  date.setUTCFullYear(year,month-1,day);
  date.setUTCHours(hour,minute,second,Number((fraction || '').padEnd(3,'0')));
  return {instant:date.getTime()-offset*60000,civil:[year,month,day],dateOnly:!zone};
}
