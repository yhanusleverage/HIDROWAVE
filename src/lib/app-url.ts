/**
 * URL pública da app — Vercel, Railway ou local.
 * Usar em API routes que fazem fetch interno (server → server).
 */
export function getServerBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL?.trim()) {
    return process.env.NEXT_PUBLIC_BASE_URL.trim().replace(/\/$/, '');
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}

export function getDeployPlatform(): 'railway' | 'vercel' | 'local' | 'unknown' {
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PUBLIC_DOMAIN) {
    return 'railway';
  }
  if (process.env.VERCEL) {
    return 'vercel';
  }
  if (process.env.NODE_ENV === 'development') {
    return 'local';
  }
  return 'unknown';
}
