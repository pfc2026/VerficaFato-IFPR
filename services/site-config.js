export const DEFAULT_SITE_URL = 'https://verfica-fato-ifpr.vercel.app';

export function siteUrl() {
  try {
    const url = new URL(process.env.APP_URL || DEFAULT_SITE_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return DEFAULT_SITE_URL;
    return url.origin;
  } catch { return DEFAULT_SITE_URL; }
}
