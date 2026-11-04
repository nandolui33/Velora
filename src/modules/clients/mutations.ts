import type { Prisma } from "@prisma/client";
import { recordAudit } from "@/lib/audit";
import { normalizeEmail, normalizePhone } from "@/lib/contact";

type Tx = Prisma.TransactionClient;

export type ClientErrorCode =
  | "CLIENT_NOT_FOUND"
  | "INVALID_CONTACT"
  | "DUPLICATE_CONTACT"
  | "SAME_CLIENT"
  | "ALREADY_ANONYMIZED";

const STATUS: Record<ClientErrorCode, number> = {
  CLIENT_NOT_FOUND: 404,
  INVALID_CONTACT: 400,
  DUPLICATE_CONTACT: 409,
  SAME_CLIENT: 400,
  ALREADY_ANONYMIZED: 409,
};

export class ClientError extends Error {
  readonly status: number;

  constructor(public readonly code: ClientErrorCode) {
    super(code);
    this.name = "ClientError";
    this.status = STATUS[code];
  }
}

async function clientExists(tx: Tx, businessId: string, clientId: string) {
  const client = await tx.client.findFirst({
    where: { id: clientId, businessId },
  });

  if (!client) {
    throw new ClientError("CLIENT_NOT_FOUND");
  }

  return client;
}

export async function recordConsent(
  tx: Tx,
  input: {
    businessId: string;
    clientId: string;
    type: "privacy" | "marketing" | "health";
    granted: boolean;
    policyVersion: string;
    source: string;
    ipHash?: string | null;
    userAgent?: string | null;
  },
) {
  await clientExists(tx, input.businessId, input.clientId);

  return tx.consentRecord.create({
    data: {
      businessId: input.businessId,
      clientId: input.clientId,
      type: input.type,
      granted: input.granted,
      policyVersion: input.policyVersion,
      source: input.source,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function updateClientContact(
  tx: Tx,
  input: {
    businessId: string;
    clientId: string;
    actorUserId: string;
    firstName: string;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    birthDate?: Date | null;
  },
) {
  const email = normalizeEmail(input.email);
  const phoneE164 = normalizePhone(input.phone);
  const firstName = input.firstName.trim();

  if (firstName.length < 2) {
    throw new ClientError("INVALID_CONTACT");
  }

  if (!email && !phoneE164) {
    throw new ClientError("INVALID_CONTACT");
  }

  await clientExists(tx, input.businessId, input.clientId);

  const duplicate = await tx.client.findFirst({
    where: {
      businessId: input.businessId,
      deletedAt: null,
      id: { not: input.clientId },
      OR: [
        ...(email ? [{ emailNormalized: email }] : []),
        ...(phoneE164 ? [{ phoneE164 }] : []),
      ],
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ClientError("DUPLICATE_CONTACT");
  }

  const updated = await tx.client.update({
    where: { id: input.clientId },
    data: {
      firstName,
      lastName: input.lastName?.trim() || null,
      email: input.email?.trim() || null,
      emailNormalized: email,
      phoneRaw: input.phone?.trim() || null,
      phoneE164,
      notes: input.notes?.trim() || null,
      birthDate: input.birthDate ?? null,
    },
  });

  await recordAudit(tx, {
    businessId: input.businessId,
    actorUserId: input.actorUserId,
    actorType: "user",
    action: "client.updated",
    entityType: "client",
    entityId: updated.id,
  });

  return updated;
}

/** Anonimiza la ficha y conserva las métricas agregadas de sus citas. */
export async function anonymizeClient(
  tx: Tx,
  input: { businessId: string; clientId: string; actorUserId: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const client = await clientExists(tx, input.businessId, input.clientId);

  if (client.anonymizedAt) {
    throw new ClientError("ALREADY_ANONYMIZED");
  }

  await tx.consentRecord.updateMany({
    where: { businessId: input.businessId, clientId: client.id, revokedAt: null },
    data: { revokedAt: now },
  });

  const appointments = await tx.appointment.count({ where: { clientId: client.id } });

  const anonymized = await tx.client.update({
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

  await recordAudit(tx, {
    businessId: input.businessId,
    actorUserId: input.actorUserId,
    actorType: "user",
    action: "client.anonymized",
    entityType: "client",
    entityId: anonymized.id,
    metadata: { appointments },
  });

  return anonymized;
}

/** Fusiona dos fichas: mueve citas y consentimientos y anonimiza el origen. */
export async function mergeClients(
  tx: Tx,
  input: {
    businessId: string;
    sourceId: string;
    targetId: string;
    actorUserId: string;
    now?: Date;
  },
) {
  if (input.sourceId === input.targetId) {
    throw new ClientError("SAME_CLIENT");
  }

  const now = input.now ?? new Date();
  const source = await clientExists(tx, input.businessId, input.sourceId);
  const target = await clientExists(tx, input.businessId, input.targetId);

  if (source.anonymizedAt) {
    throw new ClientError("ALREADY_ANONYMIZED");
  }

  const movedAppointments = await tx.appointment.updateMany({
    where: { businessId: input.businessId, clientId: source.id },
    data: { clientId: target.id },
  });

  await tx.consentRecord.updateMany({
    where: { businessId: input.businessId, clientId: source.id },
    data: { clientId: target.id },
  });

  const lastVisit = await tx.appointment.findFirst({
    where: {
      businessId: input.businessId,
      clientId: target.id,
      status: "completed",
    },
    orderBy: { startsAt: "desc" },
    select: { startsAt: true },
  });

  await tx.client.update({
    where: { id: target.id },
    data: {
      lastVisitAt: lastVisit?.startsAt ?? target.lastVisitAt,
      marketingConsent: target.marketingConsent || source.marketingConsent,
    },
  });

  await tx.client.update({
    where: { id: source.id },
    data: {
      email: null,
      emailNormalized: null,
      phoneRaw: null,
      phoneE164: null,
      anonymizedAt: now,
      deletedAt: now,
    },
  });

  await recordAudit(tx, {
    businessId: input.businessId,
    actorUserId: input.actorUserId,
    actorType: "user",
    action: "client.merged",
    entityType: "client",
    entityId: target.id,
    metadata: { sourceId: source.id, appointments: movedAppointments.count },
  });

  return { targetId: target.id, movedAppointments: movedAppointments.count };
}

/** Actualiza la última visita de un cliente a partir de sus citas completadas. */
export async function refreshLastVisit(tx: Tx, businessId: string, clientId: string) {
  const lastVisit = await tx.appointment.findFirst({
    where: { businessId, clientId, status: "completed" },
    orderBy: { startsAt: "desc" },
    select: { startsAt: true },
  });

  await tx.client.update({
    where: { id: clientId },
    data: { lastVisitAt: lastVisit?.startsAt ?? null },
  });
}
