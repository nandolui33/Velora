import type { Prisma } from "@prisma/client";

type AuditInput = {
  businessId?: string | null;
  actorUserId?: string | null;
  actorType: "user" | "superadmin" | "system";
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function recordAudit(
  tx: Prisma.TransactionClient,
  input: AuditInput,
) {
  await tx.auditLog.create({
    data: {
      businessId: input.businessId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
    },
  });
}
