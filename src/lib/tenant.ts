import type { MembershipRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type TenantContext = {
  businessId: string;
  userId: string | null;
  role: MembershipRole | "public";
  locationId?: string;
  professionalId?: string;
};

/**
 * Ejecuta una operación con contexto de empresa.
 *
 * `set_config(..., true)` es local a la transacción: no se filtra entre
 * conexiones del pool y, si falta contexto, RLS devuelve cero filas.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.business_id', ${ctx.businessId}, true)`;
      await tx.$queryRaw`SELECT set_config('app.user_id', ${ctx.userId ?? ""}, true)`;
      return fn(tx);
    },
    { timeout: 10_000 },
  );
}

/**
 * Contexto mínimo para resolver membresías de un usuario antes de conocer
 * la empresa activa. La política de `memberships` permite leer sus propias
 * filas mediante `app.user_id`.
 */
export async function withUser<T>(
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      return fn(tx);
    },
    { timeout: 10_000 },
  );
}
