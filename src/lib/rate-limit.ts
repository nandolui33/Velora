/**
 * Limitador de peticiones en memoria (ventana fija).
 *
 * Suficiente para una sola instancia. En un despliegue con varias réplicas se
 * sustituye por un almacén compartido (Redis/Upstash) manteniendo la misma
 * interfaz `checkRateLimit`.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
  now?: number;
};

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = options.now ?? Date.now();

  // Limpieza perezosa para que el mapa no crezca sin límite.
  if (now - lastSweep > 60_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(bucketKey);
      }
    }
    lastSweep = now;
  }

  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true, remaining: options.limit - 1, resetAt: now + options.windowMs };
  }

  current.count += 1;
  const remaining = options.limit - current.count;

  return {
    ok: remaining >= 0,
    remaining: Math.max(0, remaining),
    resetAt: current.resetAt,
  };
}

/** Identificador del cliente para limitar por IP (detrás de proxy incluido). */
export function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimitResponse(result: RateLimitResult) {
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));

  return Response.json(
    { error: "RATE_LIMITED", retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}

/** Solo para pruebas. */
export function resetRateLimits() {
  buckets.clear();
  lastSweep = 0;
}
