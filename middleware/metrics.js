const startedAt = Date.now();
const counters = { requests: 0, durationMs: 0, maxDurationMs: 0, statuses: {}, errors: {} };
export function requestMetrics(req, res, next) {
  const start = performance.now();
  res.once('finish', () => {
    const elapsed = Math.max(0, performance.now() - start);
    counters.requests++; counters.durationMs += elapsed; counters.maxDurationMs = Math.max(counters.maxDurationMs, elapsed);
    const status = String(res.statusCode);
    counters.statuses[status] = (counters.statuses[status] || 0) + 1;
    if (res.statusCode >= 400) {
      const requested = res.locals.errorCode || `HTTP_${res.statusCode}`;
      const code = Object.hasOwn(counters.errors, requested) || Object.keys(counters.errors).length < 50 ? requested : 'OTHER';
      counters.errors[code] = (counters.errors[code] || 0) + 1;
    }
  });
  return next();
}
export function getMetrics() {
  return {
    startedAt: new Date(startedAt).toISOString(), uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    requests: counters.requests, averageDurationMs: counters.requests ? Math.round(counters.durationMs / counters.requests) : 0,
    maxDurationMs: Math.round(counters.maxDurationMs), statuses: { ...counters.statuses }, errors: { ...counters.errors },
    scope: 'processo atual; contadores agregados em memória, reiniciados com o processo'
  };
}