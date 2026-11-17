/**
 * Resolves the public URL of the deployment that is serving the request.
 *
 * `NEXT_PUBLIC_APP_URL` is the canonical production URL, so it is only used
 * when it matches the host actually being served. Preview deployments and
 * custom domains therefore keep their own origin instead of bouncing users to
 * production (or to `undefined/reset-password` when the variable is unset).
 */
export function resolveAppUrl(request: Request): string {
  const url = new URL(request.url);

  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = (forwardedHost ?? request.headers.get('host') ?? url.host)
    .split(',')[0]
    .trim();
  const proto = (request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', ''))
    .split(',')[0]
    .trim();

  const origin = host ? `${proto}://${host}` : url.origin;

  const canonical = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!canonical) return origin.replace(/\/$/, '');

  try {
    // Only prefer the canonical URL when this deployment is that URL.
    const canonicalHost = new URL(canonical).host;
    return canonicalHost === host ? canonical : origin.replace(/\/$/, '');
  } catch {
    return origin.replace(/\/$/, '');
  }
}
