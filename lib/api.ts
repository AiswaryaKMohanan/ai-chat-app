export function jsonError(message: string, status: number, headers?: HeadersInit): Response {
  return Response.json({ error: message }, { status, headers });
}

const hits = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 10_000;

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Sliding-window rate limit per client IP. Returns a 429 response when the
 * limit is exceeded, otherwise null.
 *
 * State is held in memory, so on serverless/edge it is per-instance and only a
 * first line of defence. Swap for a shared store (e.g. Upstash Redis) when
 * running more than one instance.
 */
export function rateLimit(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number
): Response | null {
  const now = Date.now();
  const key = `${scope}:${clientIp(req)}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    const retryAfter = Math.ceil((recent[0] + windowMs - now) / 1000);
    return jsonError('Too many requests. Please wait a moment and try again.', 429, {
      'Retry-After': String(retryAfter),
    });
  }

  if (hits.size >= MAX_TRACKED_KEYS) hits.clear();
  recent.push(now);
  hits.set(key, recent);
  return null;
}
