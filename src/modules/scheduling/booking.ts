import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { recordAudit } from "@/lib/audit";
import { normalizeEmail, normalizePhone } from "@/lib/contact";
import { withTenant } from "@/lib/tenant";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/tokens";
import type { AvailabilitySlot } from "./availability";
import {
  computeProfessionalSlots,
  dayRange,
  loadSchedulingBase,
  type SchedulingBase,
} from "./data";
import { localDateKey, localParts } from "./time";

export type BookingSource = "online" | "admin" | "phone" | "walk_in";

export type BookingClientInput = {
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type CreateBookingInput = {
  businessId: string;
  locationId: string;
  serviceId: string;
  serviceVariantId?: string | null;
  professionalId?: string | null;
  startsAt: Date;
  client: BookingClientInput;
  clientNotes?: string | null;
  source: BookingSource;
  createdBy?: string | null;
  idempotencyKey?: string | null;
  requestHash?: string | null;
  now?: Date;
};

export type BookingResult = {
  appointmentId: string;
  bookingReference: string;
  startsAt: string;
  serviceEndsAt: string;
  professionalId: string;
  professionalName: string;
  serviceName: string;
  clientId: string;
  /** Solo viaja en el email de gestión. */
  manageToken: string;
};

export type BookingErrorCode =
  | "INVALID_INPUT"
  | "SERVICE_NOT_AVAILABLE"
  | "PROFESSIONAL_NOT_AVAILABLE"
  | "SLOT_TAKEN"
  | "RESOURCE_TAKEN"
  | "IDEMPOTENCY_CONFLICT"
  | "BOOKING_IN_PROGRESS"
  | "APPOINTMENT_NOT_FOUND"
  | "APPOINTMENT_NOT_CANCELLABLE"
  | "CANCELLATION_NOT_ALLOWED"
  | "SAME_SLOT";

const STATUS_BY_CODE: Record<BookingErrorCode, number> = {
  INVALID_INPUT: 400,
  SERVICE_NOT_AVAILABLE: 404,
  PROFESSIONAL_NOT_AVAILABLE: 409,
  SLOT_TAKEN: 409,
  RESOURCE_TAKEN: 409,
  IDEMPOTENCY_CONFLICT: 409,
  BOOKING_IN_PROGRESS: 409,
  APPOINTMENT_NOT_FOUND: 404,
  APPOINTMENT_NOT_CANCELLABLE: 409,
  CANCELLATION_NOT_ALLOWED: 409,
  SAME_SLOT: 400,
};

export class BookingError extends Error {
  readonly status: number;

  constructor(
    public readonly code: BookingErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "BookingError";
    this.status = STATUS_BY_CODE[code];
  }
}

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeBookingReference() {
  let value = "";

  for (let index = 0; index < 6; index += 1) {
    value += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  }

  return value;
}

export { normalizeEmail, normalizePhone } from "@/lib/contact";

function requestFingerprint(input: CreateBookingInput) {
  return JSON.stringify({
    businessId: input.businessId,
    locationId: input.locationId,
    serviceId: input.serviceId,
    serviceVariantId: input.serviceVariantId ?? null,
    professionalId: input.professionalId ?? null,
    startsAt: input.startsAt.toISOString(),
    client: {
      firstName: input.client.firstName,
      lastName: input.client.lastName ?? null,
      phone: normalizePhone(input.client.phone),
      email: normalizeEmail(input.client.email),
    },
    note: input.clientNotes ?? null,
  });
}

type Tx = Prisma.TransactionClient;

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function isExclusionViolation(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("23P01") ||
    message.includes("appointments_no_overlap") ||
    message.includes("resource_reservations_no_overlap")
  );
}

function rethrowConflict(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("appointments_no_overlap")) {
    throw new BookingError("SLOT_TAKEN");
  }

  if (message.includes("resource_reservations_no_overlap")) {
    throw new BookingError("RESOURCE_TAKEN");
  }

  if (message.includes("P2002") || isUniqueViolation(error)) {
    throw new BookingError("RESOURCE_TAKEN");
  }

  throw error;
}

async function lockProfessional(tx: Tx, businessId: string, professionalId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "professionals"
    WHERE "id" = ${professionalId}::uuid AND "business_id" = ${businessId}::uuid
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new BookingError("PROFESSIONAL_NOT_AVAILABLE");
  }
}

async function lockResources(tx: Tx, businessId: string, resourceIds: string[]) {
  for (const resourceId of [...new Set(resourceIds)].sort()) {
    await tx.$queryRaw`
      SELECT "id" FROM "resources"
      WHERE "id" = ${resourceId}::uuid AND "business_id" = ${businessId}::uuid
      FOR UPDATE
    `;
  }
}

async function assertNoDoubleBooking(
  tx: Tx,
  input: {
    businessId: string;
    professionalId: string;
    startsAt: Date;
    blockedUntil: Date;
    resourceIds: string[];
    ignoreAppointmentId?: string | null;
  },
) {
  const appointment = await tx.appointment.findFirst({
    where: {
      businessId: input.businessId,
      professionalId: input.professionalId,
      status: { in: ["confirmed", "completed"] },
      startsAt: { lt: input.blockedUntil },
      blockedUntil: { gt: input.startsAt },
      ...(input.ignoreAppointmentId
        ? { id: { not: input.ignoreAppointmentId } }
        : {}),
    },
    select: { id: true },
  });

  if (appointment) {
    throw new BookingError("SLOT_TAKEN");
  }

  if (input.resourceIds.length === 0) {
    return;
  }

  const reservation = await tx.resourceReservation.findFirst({
    where: {
      businessId: input.businessId,
      resourceId: { in: input.resourceIds },
      releasedAt: null,
      startsAt: { lt: input.blockedUntil },
      endsAt: { gt: input.startsAt },
      ...(input.ignoreAppointmentId
        ? { NOT: { appointmentId: input.ignoreAppointmentId } }
        : {}),
    },
    select: { id: true },
  });

  if (reservation) {
    throw new BookingError("RESOURCE_TAKEN");
  }
}

async function resolveClient(
  tx: Tx,
  businessId: string,
  client: BookingClientInput,
): Promise<{ clientId: string; email: string | null; firstName: string }> {
  const firstName = client.firstName?.trim() ?? "";
  const lastName = client.lastName?.trim() || null;
  const email = normalizeEmail(client.email);
  const phoneE164 = normalizePhone(client.phone);

  if (firstName.length < 2) {
    throw new BookingError("INVALID_INPUT");
  }

  if (!email && !phoneE164) {
    throw new BookingError("INVALID_INPUT");
  }

  const existing = await tx.client.findFirst({
    where: {
      businessId,
      deletedAt: null,
      OR: [
        ...(email ? [{ emailNormalized: email }] : []),
        ...(phoneE164 ? [{ phoneE164 }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return { clientId: existing.id, email: existing.emailNormalized, firstName };
  }

  const created = await tx.client.create({
    data: {
      businessId,
      firstName,
      lastName,
      email: client.email?.trim() || null,
      emailNormalized: email,
      phoneRaw: client.phone?.trim() || null,
      phoneE164,
      privacyAcceptedAt: new Date(),
    },
  });

  // El consentimiento de privacidad queda registrado con la reserva.
  await tx.consentRecord.create({
    data: {
      businessId,
      clientId: created.id,
      type: "privacy",
      policyVersion: process.env.PRIVACY_POLICY_VERSION ?? "1.0",
      granted: true,
      source: "online_booking",
    },
  });

  return { clientId: created.id, email, firstName };
}

function manageUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  return `${base}/cita/${encodeURIComponent(token)}`;
}

export function buildManageToken(businessId: string) {
  return `${businessId}.${generateOpaqueToken()}`;
}

export function parseManageToken(token: string) {
  const [businessId, secret] = token.split(".");

  if (!businessId || !secret) {
    return null;
  }

  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidLike.test(businessId)) {
    return null;
  }

  return { businessId, hash: hashOpaqueToken(secret) };
}

function payloadFor(
  base: Pick<
    SchedulingBase,
    | "businessName"
    | "locationName"
    | "addressLine"
    | "timezone"
    | "serviceName"
  >,
  appointment: {
    id: string;
    bookingReference: string;
    startsAt: Date;
    serviceEndsAt: Date;
    professionalName: string;
  },
  clientName: string,
  token: string,
) {
  return {
    bookingReference: appointment.bookingReference,
    businessName: base.businessName,
    locationName: base.locationName,
    address: base.addressLine,
    timezone: base.timezone,
    startsAt: appointment.startsAt.toISOString(),
    serviceEndsAt: appointment.serviceEndsAt.toISOString(),
    serviceName: base.serviceName,
    professionalName: appointment.professionalName,
    clientName,
    manageUrl: manageUrl(token),
  };
}

type OutboxPayload = Prisma.InputJsonValue;

async function enqueueOutbox(
  tx: Tx,
  input: {
    businessId: string;
    appointmentId: string;
    template: string;
    recipient: string;
    recipientName?: string | null;
    subject: string;
    payload: OutboxPayload;
    scheduledAt: Date;
    dedupeKey: string;
  },
) {
  await tx.notificationOutbox.upsert({
    where: { dedupeKey: input.dedupeKey },
    create: {
      businessId: input.businessId,
      appointmentId: input.appointmentId,
      template: input.template,
      recipient: input.recipient,
      recipientName: input.recipientName ?? null,
      subject: input.subject,
      payload: input.payload,
      scheduledAt: input.scheduledAt,
      dedupeKey: input.dedupeKey,
    },
    update: {},
  });
}

async function enqueueConfirmation(
  tx: Tx,
  input: {
    businessId: string;
    appointmentId: string;
    base: SchedulingBase;
    payload: OutboxPayload;
    clientEmail: string | null;
    clientName: string;
    businessEmail: string | null;
    startsAt: Date;
    now: Date;
  },
) {
  const prefix = `appointment:${input.appointmentId}`;

  if (input.clientEmail) {
    await enqueueOutbox(tx, {
      businessId: input.businessId,
      appointmentId: input.appointmentId,
      template: "appointment_confirmed",
      recipient: input.clientEmail,
      recipientName: input.clientName,
      subject: `Tu cita en ${input.base.businessName}`,
      payload: input.payload,
      scheduledAt: input.now,
      dedupeKey: `${prefix}:confirmed:client`,
    });

    const reminderAt = new Date(
      input.startsAt.getTime() - input.base.reminderHours * 60 * 60 * 1000,
    );

    if (reminderAt.getTime() > input.now.getTime() && input.base.reminderHours > 0) {
      await enqueueOutbox(tx, {
        businessId: input.businessId,
        appointmentId: input.appointmentId,
        template: "appointment_reminder",
        recipient: input.clientEmail,
        recipientName: input.clientName,
        subject: `Recordatorio de tu cita en ${input.base.businessName}`,
        payload: input.payload,
        scheduledAt: reminderAt,
        dedupeKey: `${prefix}:reminder:client`,
      });
    }
  }

  if (input.businessEmail) {
    await enqueueOutbox(tx, {
      businessId: input.businessId,
      appointmentId: input.appointmentId,
      template: "appointment_notice_business",
      recipient: input.businessEmail,
      recipientName: input.base.businessName,
      subject: `Nueva cita: ${input.clientName}`,
      payload: input.payload,
      scheduledAt: input.now,
      dedupeKey: `${prefix}:notice:business`,
    });
  }
}

async function findSlotForDay(
  tx: Tx,
  base: SchedulingBase,
  input: {
    professionalId: string | null;
    startsAt: Date;
    now: Date;
    ignoreAppointmentId?: string | null;
  },
): Promise<{ professionalId: string; professionalName: string; slot: AvailabilitySlot } | null> {
  const date = localDateKey(input.startsAt, base.timezone);
  const range = dayRange(base.timezone, date, 1);
  const results = await computeProfessionalSlots(tx, base, {
    from: range.from,
    to: range.to,
    professionalId: input.professionalId,
    now: input.now,
    ignoreAppointmentId: input.ignoreAppointmentId,
  });

  for (const result of results) {
    const slot = result.slots.find(
      (candidate) => candidate.startsAt.getTime() === input.startsAt.getTime(),
    );

    if (slot) {
      return {
        professionalId: result.professional.id,
        professionalName: result.professional.name,
        slot,
      };
    }
  }

  return null;
}

export async function createBooking(input: CreateBookingInput): Promise<BookingResult> {
  const now = input.now ?? new Date();
  const key = input.idempotencyKey?.trim() || null;
  const requestHash = input.requestHash ?? requestFingerprint(input);

  return withTenant(
    {
      businessId: input.businessId,
      userId: input.createdBy ?? "",
      role: input.source === "online" ? "public" : "owner",
    },
    async (tx) => {
      if (key) {
        const existing = await tx.idempotencyKey.findUnique({
          where: { businessId_key: { businessId: input.businessId, key } },
        });

        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new BookingError("IDEMPOTENCY_CONFLICT");
          }

          if (existing.responseStatus === 0) {
            throw new BookingError("BOOKING_IN_PROGRESS");
          }

          return existing.responseJson as unknown as BookingResult;
        }

        try {
          await tx.idempotencyKey.create({
            data: {
              businessId: input.businessId,
              key,
              requestHash,
              responseStatus: 0,
              responseJson: {},
              expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            },
          });
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new BookingError("BOOKING_IN_PROGRESS");
          }
          throw error;
        }
      }

      const base = await loadSchedulingBase(tx, {
        businessId: input.businessId,
        locationId: input.locationId,
        serviceId: input.serviceId,
        serviceVariantId: input.serviceVariantId,
      });

      if (!base) {
        throw new BookingError("SERVICE_NOT_AVAILABLE");
      }

      if (input.professionalId) {
        await lockProfessional(tx, base.businessId, input.professionalId);
      }

      let chosen = await findSlotForDay(tx, base, {
        professionalId: input.professionalId ?? null,
        startsAt: input.startsAt,
        now,
      });

      if (!chosen) {
        throw new BookingError("SLOT_TAKEN");
      }

      if (!input.professionalId) {
        // "Cualquiera disponible": se bloquea el profesional elegido y se
        // revalida el hueco ya serializado.
        await lockProfessional(tx, base.businessId, chosen.professionalId);
        chosen = await findSlotForDay(tx, base, {
          professionalId: chosen.professionalId,
          startsAt: input.startsAt,
          now,
        });

        if (!chosen) {
          throw new BookingError("SLOT_TAKEN");
        }
      }

      const professionalId = chosen.professionalId;
      const professionalName = chosen.professionalName;
      const slot = chosen.slot;
      const resourceIds = slot.resources.map((resource) => resource.resourceId);

      await lockResources(tx, base.businessId, resourceIds);
      await assertNoDoubleBooking(tx, {
        businessId: base.businessId,
        professionalId,
        startsAt: slot.startsAt,
        blockedUntil: slot.blockedUntil,
        resourceIds,
      });

      const client = await resolveClient(tx, base.businessId, input.client);
      const token = buildManageToken(base.businessId);
      const secret = token.slice(base.businessId.length + 1);

      let appointmentId: string | null = null;
      let bookingReferenceValue = "";

      for (let attempt = 0; attempt < 5 && !appointmentId; attempt += 1) {
        const reference = makeBookingReference();

        try {
          const created = await tx.appointment.create({
            data: {
              businessId: base.businessId,
              locationId: base.locationId,
              professionalId,
              serviceId: base.serviceId,
              serviceVariantId: input.serviceVariantId ?? null,
              serviceName: base.serviceName,
              serviceVariantName: base.serviceVariantName,
              professionalName,
              durationMinutes: base.durationMinutes,
              bufferAfterMinutes: base.bufferMinutes,
              clientId: client.clientId,
              startsAt: slot.startsAt,
              serviceEndsAt: slot.serviceEndsAt,
              blockedUntil: slot.blockedUntil,
              status: "confirmed",
              source: input.source,
              priceCents: base.priceCents,
              currency: base.currency,
              clientNotes: input.clientNotes ?? null,
              bookingReference: reference,
              publicTokenHash: hashOpaqueToken(secret),
              createdBy: input.createdBy ?? null,
            },
          });

          appointmentId = created.id;
          bookingReferenceValue = created.bookingReference;
        } catch (error) {
          const message = error instanceof Error ? error.message : "";

          if (isExclusionViolation(error)) {
            rethrowConflict(error);
          }

          if (isUniqueViolation(error) && message.includes("booking_reference")) {
            continue;
          }

          throw error;
        }
      }

      if (!appointmentId) {
        throw new BookingError("SLOT_TAKEN");
      }

      if (resourceIds.length > 0) {
        try {
          await tx.resourceReservation.createMany({
            data: resourceIds.map((resourceId) => ({
              businessId: base.businessId,
              locationId: base.locationId,
              resourceId,
              appointmentId,
              startsAt: slot.startsAt,
              endsAt: slot.blockedUntil,
            })),
          });
        } catch (error) {
          if (isExclusionViolation(error)) {
            rethrowConflict(error);
          }
          throw error;
        }
      }

      const payload = payloadFor(
        base,
        {
          id: appointmentId,
          bookingReference: bookingReferenceValue,
          startsAt: slot.startsAt,
          serviceEndsAt: slot.serviceEndsAt,
          professionalName,
        },
        client.firstName,
        token,
      );

      await enqueueConfirmation(tx, {
        businessId: base.businessId,
        appointmentId,
        base,
        payload,
        clientEmail: client.email,
        clientName: client.firstName,
        businessEmail: base.businessEmail,
        startsAt: slot.startsAt,
        now,
      });

      await recordAudit(tx, {
        businessId: base.businessId,
        actorUserId: input.createdBy ?? null,
        actorType: input.createdBy ? "user" : "system",
        action: "appointment.created",
        entityType: "appointment",
        entityId: appointmentId,
        metadata: {
          source: input.source,
          bookingReference: bookingReferenceValue,
          startsAt: slot.startsAt.toISOString(),
        },
      });

      const result: BookingResult = {
        appointmentId,
        bookingReference: bookingReferenceValue,
        startsAt: slot.startsAt.toISOString(),
        serviceEndsAt: slot.serviceEndsAt.toISOString(),
        professionalId,
        professionalName,
        serviceName: base.serviceName,
        clientId: client.clientId,
        manageToken: token,
      };

      if (key) {
        await tx.idempotencyKey.update({
          where: { businessId_key: { businessId: base.businessId, key } },
          data: {
            responseStatus: 201,
            responseJson: result as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return result;
    },
    { timeout: 20_000 },
  );
}

export type AppointmentView = {
  id: string;
  bookingReference: string;
  status: string;
  startsAt: Date;
  serviceEndsAt: Date;
  serviceName: string;
  professionalName: string;
  businessName: string;
  businessSlug: string;
  businessEmail: string | null;
  locationName: string;
  addressLine: string;
  timezone: string;
  clientName: string;
  clientEmail: string | null;
  cancellationCutoffMinutes: number;
  canCancel: boolean;
};

export async function getAppointmentByManageToken(
  token: string,
  now = new Date(),
): Promise<AppointmentView | null> {
  const parsed = parseManageToken(token);

  if (!parsed) {
    return null;
  }

  return withTenant(
    { businessId: parsed.businessId, userId: "", role: "public" },
    async (tx) => {
      const appointment = await tx.appointment.findFirst({
        where: { businessId: parsed.businessId, publicTokenHash: parsed.hash },
        include: {
          client: true,
          business: true,
          location: true,
        },
      });

      if (!appointment) {
        return null;
      }

      const cutoff = appointment.business.cancellationCutoffMinutes * 60_000;
      const canCancel =
        appointment.status === "confirmed" &&
        now.getTime() < appointment.startsAt.getTime() - cutoff;

      return {
        id: appointment.id,
        bookingReference: appointment.bookingReference,
        status: appointment.status,
        startsAt: appointment.startsAt,
        serviceEndsAt: appointment.serviceEndsAt,
        serviceName: appointment.serviceName,
        professionalName: appointment.professionalName,
        businessName: appointment.business.name,
        businessSlug: appointment.business.slug,
        businessEmail: appointment.business.email,
        locationName: appointment.location.name,
        addressLine: [
          appointment.location.addressLine1,
          appointment.location.city,
        ]
          .filter(Boolean)
          .join(", "),
        timezone: appointment.location.timezone ?? appointment.business.timezone,
        clientName: appointment.client.firstName,
        clientEmail: appointment.client.email,
        cancellationCutoffMinutes: appointment.business.cancellationCutoffMinutes,
        canCancel,
      };
    },
  );
}

async function cancelByAppointmentId(input: {
  businessId: string;
  appointmentId: string;
  reason?: string | null;
  actorUserId?: string | null;
  force?: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return withTenant(
    {
      businessId: input.businessId,
      userId: input.actorUserId ?? "",
      role: input.actorUserId ? "owner" : "public",
    },
    async (tx) => {
      const appointment = await tx.appointment.findFirst({
        where: { id: input.appointmentId, businessId: input.businessId },
        include: { client: true, business: true, location: true },
      });

      if (!appointment) {
        throw new BookingError("APPOINTMENT_NOT_FOUND");
      }

      if (appointment.status !== "confirmed") {
        throw new BookingError("APPOINTMENT_NOT_CANCELLABLE");
      }

      const cutoff = appointment.business.cancellationCutoffMinutes * 60_000;
      const limit = appointment.startsAt.getTime() - cutoff;

      if (!input.force && now.getTime() > limit) {
        throw new BookingError("CANCELLATION_NOT_ALLOWED");
      }

      await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: "cancelled",
          cancelledAt: now,
          cancelledBy: input.actorUserId ?? null,
          cancellationReason: input.reason ?? null,
        },
      });

      await tx.resourceReservation.updateMany({
        where: { appointmentId: appointment.id, releasedAt: null },
        data: { releasedAt: now },
      });

      await tx.notificationOutbox.updateMany({
        where: { appointmentId: appointment.id, status: "pending" },
        data: { status: "cancelled" },
      });

      const payload: OutboxPayload = {
        bookingReference: appointment.bookingReference,
        businessName: appointment.business.name,
        businessSlug: appointment.business.slug,
        locationName: appointment.location.name,
        address: [appointment.location.addressLine1, appointment.location.city]
          .filter(Boolean)
          .join(", "),
        timezone: appointment.location.timezone ?? appointment.business.timezone,
        startsAt: appointment.startsAt.toISOString(),
        serviceName: appointment.serviceName,
        professionalName: appointment.professionalName,
        clientName: appointment.client.firstName,
      };

      if (appointment.client.emailNormalized) {
        await enqueueOutbox(tx, {
          businessId: input.businessId,
          appointmentId: appointment.id,
          template: "appointment_cancelled_client",
          recipient: appointment.client.emailNormalized,
          recipientName: appointment.client.firstName,
          subject: `Cita cancelada en ${appointment.business.name}`,
          payload,
          scheduledAt: now,
          dedupeKey: `appointment:${appointment.id}:cancelled:client`,
        });
      }

      const businessEmail =
        appointment.business.email ?? appointment.location.email ?? null;

      if (businessEmail) {
        await enqueueOutbox(tx, {
          businessId: input.businessId,
          appointmentId: appointment.id,
          template: "appointment_cancelled_business",
          recipient: businessEmail,
          recipientName: appointment.business.name,
          subject: `Cita cancelada: ${appointment.client.firstName}`,
          payload,
          scheduledAt: now,
          dedupeKey: `appointment:${appointment.id}:cancelled:business`,
        });
      }

      await recordAudit(tx, {
        businessId: input.businessId,
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorUserId ? "user" : "system",
        action: "appointment.cancelled",
        entityType: "appointment",
        entityId: appointment.id,
        metadata: { reason: input.reason ?? null },
      });

      return { appointmentId: appointment.id, businessId: input.businessId };
    },
    { timeout: 20_000 },
  );
}

export async function cancelBookingByToken(input: {
  token: string;
  reason?: string | null;
  now?: Date;
}) {
  const parsed = parseManageToken(input.token);

  if (!parsed) {
    throw new BookingError("APPOINTMENT_NOT_FOUND");
  }

  const appointment = await withTenant(
    { businessId: parsed.businessId, userId: "", role: "public" },
    (tx) =>
      tx.appointment.findFirst({
        where: { businessId: parsed.businessId, publicTokenHash: parsed.hash },
        select: { id: true },
      }),
  );

  if (!appointment) {
    throw new BookingError("APPOINTMENT_NOT_FOUND");
  }

  return cancelByAppointmentId({
    businessId: parsed.businessId,
    appointmentId: appointment.id,
    reason: input.reason ?? null,
    now: input.now,
  });
}

export async function cancelBooking(input: {
  businessId: string;
  appointmentId: string;
  reason?: string | null;
  actorUserId: string;
  force?: boolean;
  now?: Date;
}) {
  return cancelByAppointmentId({ ...input, force: input.force ?? true });
}

export async function rescheduleBooking(input: {
  businessId: string;
  appointmentId: string;
  startsAt: Date;
  serviceId?: string;
  serviceVariantId?: string | null;
  professionalId?: string;
  actorUserId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return withTenant(
    { businessId: input.businessId, userId: input.actorUserId, role: "owner" },
    async (tx) => {
      const appointment = await tx.appointment.findFirst({
        where: { id: input.appointmentId, businessId: input.businessId },
        include: { client: true },
      });

      if (!appointment) {
        throw new BookingError("APPOINTMENT_NOT_FOUND");
      }

      if (appointment.status !== "confirmed") {
        throw new BookingError("APPOINTMENT_NOT_CANCELLABLE");
      }

      const serviceId = input.serviceId ?? appointment.serviceId;
      const base = await loadSchedulingBase(tx, {
        businessId: input.businessId,
        locationId: appointment.locationId,
        serviceId,
        serviceVariantId: input.serviceVariantId ?? appointment.serviceVariantId,
      });

      if (!base) {
        throw new BookingError("SERVICE_NOT_AVAILABLE");
      }

      const professionalId = input.professionalId ?? appointment.professionalId;

      if (
        appointment.startsAt.getTime() === input.startsAt.getTime() &&
        professionalId === appointment.professionalId &&
        serviceId === appointment.serviceId
      ) {
        throw new BookingError("SAME_SLOT");
      }

      await lockProfessional(tx, input.businessId, professionalId);

      const chosen = await findSlotForDay(tx, base, {
        professionalId,
        startsAt: input.startsAt,
        now,
        ignoreAppointmentId: appointment.id,
      });

      if (!chosen) {
        throw new BookingError("SLOT_TAKEN");
      }

      const resourceIds = chosen.slot.resources.map((resource) => resource.resourceId);

      await lockResources(tx, input.businessId, resourceIds);
      await assertNoDoubleBooking(tx, {
        businessId: input.businessId,
        professionalId,
        startsAt: chosen.slot.startsAt,
        blockedUntil: chosen.slot.blockedUntil,
        resourceIds,
        ignoreAppointmentId: appointment.id,
      });

      await tx.resourceReservation.updateMany({
        where: { appointmentId: appointment.id, releasedAt: null },
        data: { releasedAt: now },
      });

      const updated = await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          professionalId,
          professionalName: chosen.professionalName,
          serviceId: base.serviceId,
          serviceVariantId: input.serviceVariantId ?? appointment.serviceVariantId,
          serviceName: base.serviceName,
          serviceVariantName: base.serviceVariantName,
          durationMinutes: base.durationMinutes,
          bufferAfterMinutes: base.bufferMinutes,
          startsAt: chosen.slot.startsAt,
          serviceEndsAt: chosen.slot.serviceEndsAt,
          blockedUntil: chosen.slot.blockedUntil,
          priceCents: base.priceCents,
          currency: base.currency,
        },
      });

      if (resourceIds.length > 0) {
        try {
          await tx.resourceReservation.createMany({
            data: resourceIds.map((resourceId) => ({
              businessId: input.businessId,
              locationId: appointment.locationId,
              resourceId,
              appointmentId: appointment.id,
              startsAt: chosen.slot.startsAt,
              endsAt: chosen.slot.blockedUntil,
            })),
          });
        } catch (error) {
          if (isExclusionViolation(error)) {
            rethrowConflict(error);
          }
          throw error;
        }
      }

      await tx.notificationOutbox.updateMany({
        where: {
          appointmentId: appointment.id,
          status: "pending",
        },
        data: { status: "cancelled" },
      });

      const payload: OutboxPayload = {
        bookingReference: updated.bookingReference,
        businessName: base.businessName,
        locationName: base.locationName,
        address: base.addressLine,
        timezone: base.timezone,
        startsAt: updated.startsAt.toISOString(),
        serviceEndsAt: updated.serviceEndsAt.toISOString(),
        serviceName: updated.serviceName,
        professionalName: updated.professionalName,
        clientName: appointment.client.firstName,
      };

      if (appointment.client.emailNormalized) {
        await enqueueOutbox(tx, {
          businessId: input.businessId,
          appointmentId: appointment.id,
          template: "appointment_rescheduled",
          recipient: appointment.client.emailNormalized,
          recipientName: appointment.client.firstName,
          subject: `Tu cita en ${base.businessName} ha cambiado`,
          payload,
          scheduledAt: now,
          dedupeKey: `appointment:${appointment.id}:rescheduled:${updated.startsAt.getTime()}`,
        });
      }

      if (base.businessEmail) {
        await enqueueOutbox(tx, {
          businessId: input.businessId,
          appointmentId: appointment.id,
          template: "appointment_rescheduled_business",
          recipient: base.businessEmail,
          recipientName: base.businessName,
          subject: `Cita movida: ${appointment.client.firstName}`,
          payload,
          scheduledAt: now,
          dedupeKey: `appointment:${appointment.id}:rescheduled-business:${updated.startsAt.getTime()}`,
        });
      }

      await recordAudit(tx, {
        businessId: input.businessId,
        actorUserId: input.actorUserId,
        actorType: "user",
        action: "appointment.rescheduled",
        entityType: "appointment",
        entityId: appointment.id,
        metadata: {
          startsAt: updated.startsAt.toISOString(),
          professionalId,
        },
      });

      return { appointmentId: appointment.id };
    },
    { timeout: 20_000 },
  );
}

export function localDayLabel(date: Date, timezone: string) {
  const parts = localParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}
