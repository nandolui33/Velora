import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type EffectivePlan = {
  planCode: string | null;
  planName: string | null;
  status: string | null;
  maxProfessionals: number | null;
  maxLocations: number | null;
  features: Record<string, boolean>;
  overrides: Record<string, unknown>;
};

export class PlanLimitError extends Error {
  constructor(public readonly limit: number) {
    super("PLAN_LIMIT");
    this.name = "PlanLimitError";
  }
}

/** Plan efectivo de la empresa: suscripción + overrides del superadministrador. */
export async function getEffectivePlan(
  tx: Tx,
  businessId: string,
): Promise<EffectivePlan> {
  const [business, subscription] = await Promise.all([
    tx.business.findUnique({
      where: { id: businessId },
      select: { planOverrides: true },
    }),
    tx.subscription.findUnique({
      where: { businessId },
      include: { plan: true },
    }),
  ]);

  const overrides = (business?.planOverrides ?? {}) as Record<string, unknown>;
  const features = {
    ...((subscription?.plan.features ?? {}) as Record<string, boolean>),
    ...((overrides.features ?? {}) as Record<string, boolean>),
  };

  const overrideProfessionals = overrides.maxProfessionals;
  const overrideLocations = overrides.maxLocations;

  return {
    planCode: subscription?.plan.code ?? null,
    planName: subscription?.plan.name ?? null,
    status: subscription?.status ?? null,
    maxProfessionals:
      typeof overrideProfessionals === "number"
        ? overrideProfessionals
        : (subscription?.plan.maxProfessionals ?? null),
    maxLocations:
      typeof overrideLocations === "number"
        ? overrideLocations
        : (subscription?.plan.maxLocations ?? null),
    features,
    overrides,
  };
}

/** Lanza `PlanLimitError` si el plan no permite otro profesional activo. */
export async function assertCanAddProfessional(tx: Tx, businessId: string) {
  const plan = await getEffectivePlan(tx, businessId);

  if (plan.maxProfessionals === null) {
    return plan;
  }

  const count = await tx.professional.count({
    where: { businessId, active: true },
  });

  if (count >= plan.maxProfessionals) {
    throw new PlanLimitError(plan.maxProfessionals);
  }

  return plan;
}
