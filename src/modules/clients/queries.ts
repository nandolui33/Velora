import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type ClientListItem = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  lastVisitAt: Date | null;
  createdAt: Date;
  marketingConsent: boolean;
  appointmentCount: number;
};

export type ClientDetail = {
  client: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    birthDate: Date | null;
    notes: string | null;
    marketingConsent: boolean;
    privacyAcceptedAt: Date | null;
    lastVisitAt: Date | null;
    createdAt: Date;
    anonymizedAt: Date | null;
  };
  consents: {
    id: string;
    type: "privacy" | "marketing" | "health";
    policyVersion: string;
    granted: boolean;
    source: string;
    createdAt: Date;
    revokedAt: Date | null;
  }[];
  appointments: {
    id: string;
    startsAt: Date;
    serviceName: string;
    professionalName: string;
    status: string;
    priceCents: number;
    paidAmountCents: number;
    paymentStatus: string;
  }[];
  metrics: {
    completedVisits: number;
    cancellations: number;
    noShows: number;
    estimatedCents: number;
    collectedCents: number;
  };
  duplicates: { id: string; firstName: string; lastName: string | null; email: string | null; phone: string | null }[];
};

export async function listClients(
  tx: Tx,
  input: { businessId: string; search?: string; page?: number; pageSize?: number },
) {
  const search = input.search?.trim() ?? "";
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 5), 100);
  const page = Math.max(input.page ?? 1, 1);

  const where: Prisma.ClientWhereInput = {
    businessId: input.businessId,
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phoneE164: { contains: search } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    tx.client.count({ where }),
    tx.client.findMany({
      where,
      orderBy: [{ lastVisitAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { appointments: true } } },
    }),
  ]);

  const items: ClientListItem[] = rows.map((row) => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phoneE164 ?? row.phoneRaw,
    lastVisitAt: row.lastVisitAt,
    createdAt: row.createdAt,
    marketingConsent: row.marketingConsent,
    appointmentCount: row._count.appointments,
  }));

  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getClientDetail(
  tx: Tx,
  input: { businessId: string; clientId: string },
): Promise<ClientDetail | null> {
  const client = await tx.client.findFirst({
    where: { id: input.clientId, businessId: input.businessId },
  });

  if (!client) {
    return null;
  }

  const [consents, appointments, duplicates] = await Promise.all([
    tx.consentRecord.findMany({
      where: { businessId: input.businessId, clientId: client.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    tx.appointment.findMany({
      where: { businessId: input.businessId, clientId: client.id },
      orderBy: { startsAt: "desc" },
      take: 100,
      select: {
        id: true,
        startsAt: true,
        serviceName: true,
        professionalName: true,
        status: true,
        priceCents: true,
        paidAmountCents: true,
        paymentStatus: true,
      },
    }),
    tx.client.findMany({
      where: {
        businessId: input.businessId,
        deletedAt: null,
        id: { not: client.id },
        OR: [
          ...(client.emailNormalized ? [{ emailNormalized: client.emailNormalized }] : []),
          ...(client.phoneE164 ? [{ phoneE164: client.phoneE164 }] : []),
          ...(client.phoneRaw ? [{ phoneRaw: client.phoneRaw }] : []),
        ],
      },
      take: 5,
      select: { id: true, firstName: true, lastName: true, email: true, phoneE164: true },
    }),
  ]);

  const completed = appointments.filter((appointment) => appointment.status === "completed");

  return {
    client: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phoneE164 ?? client.phoneRaw,
      birthDate: client.birthDate,
      notes: client.notes,
      marketingConsent: client.marketingConsent,
      privacyAcceptedAt: client.privacyAcceptedAt,
      lastVisitAt: client.lastVisitAt,
      createdAt: client.createdAt,
      anonymizedAt: client.anonymizedAt,
    },
    consents: consents.map((consent) => ({
      id: consent.id,
      type: consent.type,
      policyVersion: consent.policyVersion,
      granted: consent.granted,
      source: consent.source,
      createdAt: consent.createdAt,
      revokedAt: consent.revokedAt,
    })),
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      startsAt: appointment.startsAt,
      serviceName: appointment.serviceName,
      professionalName: appointment.professionalName,
      status: appointment.status,
      priceCents: appointment.priceCents,
      paidAmountCents: appointment.paidAmountCents,
      paymentStatus: appointment.paymentStatus,
    })),
    metrics: {
      completedVisits: completed.length,
      cancellations: appointments.filter((appointment) => appointment.status === "cancelled").length,
      noShows: appointments.filter((appointment) => appointment.status === "no_show").length,
      estimatedCents: completed.reduce((sum, appointment) => sum + appointment.priceCents, 0),
      collectedCents: completed.reduce((sum, appointment) => sum + appointment.paidAmountCents, 0),
    },
    duplicates: duplicates.map((duplicate) => ({
      id: duplicate.id,
      firstName: duplicate.firstName,
      lastName: duplicate.lastName,
      email: duplicate.email,
      phone: duplicate.phoneE164,
    })),
  };
}
