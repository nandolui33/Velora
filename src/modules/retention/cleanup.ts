import { withPlatform } from "@/lib/tenant";

/**
 * Retención y minimización de datos (RGPD).
 *
 * - Anonimiza clientes sin actividad en los últimos `inactiveMonths` meses y sin
 *   citas futuras, conservando sus citas para las métricas agregadas.
 * - Purga claves de idempotencia caducadas y sesiones expiradas.
 *
 * Se ejecuta con contexto de plataforma porque recorre todas las empresas.
 */

export type RetentionResult = {
  anonymizedClients: number;
  purgedIdempotencyKeys: number;
  purgedSessions: number;
};

export async function runRetention(
  input: { now?: Date; inactiveMonths?: number } = {},
): Promise<RetentionResult> {
  const now = input.now ?? new Date();
  const inactiveMonths = Math.max(1, input.inactiveMonths ?? 24);

  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - inactiveMonths);

  return withPlatform(async (tx) => {
    const stale = await tx.client.findMany({
      where: {
        deletedAt: null,
        createdAt: { lt: cutoff },
        AND: [
          { OR: [{ lastVisitAt: null }, { lastVisitAt: { lt: cutoff } }] },
          { appointments: { none: { startsAt: { gte: now } } } },
        ],
      },
      select: { id: true },
      take: 500,
    });

    for (const client of stale) {
      await tx.consentRecord.updateMany({
        where: { clientId: client.id, revokedAt: null },
        data: { revokedAt: now },
      });

      await tx.client.update({
        where: { id: client.id },
        data: {
          firstName: "Cliente",
          lastName: null,
          email: null,
          emailNormalized: null,
          phoneRaw: null,
          phoneE164: null,
          notes: null,
          marketingConsent: false,
          anonymizedAt: now,
          deletedAt: now,
        },
      });
    }

    const keys = await tx.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    const sessions = await tx.session.deleteMany({
      where: { expires: { lt: now } },
    });

    return {
      anonymizedClients: stale.length,
      purgedIdempotencyKeys: keys.count,
      purgedSessions: sessions.count,
    };
  });
}
