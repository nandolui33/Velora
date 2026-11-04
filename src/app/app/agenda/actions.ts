"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireOwner } from "@/lib/guards";
import { withTenant } from "@/lib/tenant";
import {
  BookingError,
  cancelBooking,
  createBooking,
  rescheduleBooking,
} from "@/modules/scheduling/booking";
import { zonedTimeToUtc } from "@/modules/scheduling/time";

const createSchema = z.object({
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid().optional().or(z.literal("")),
  startsAt: z.string().min(10),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

const cancelSchema = z.object({
  appointmentId: z.string().uuid(),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
});

const rescheduleSchema = z.object({
  appointmentId: z.string().uuid(),
  professionalId: z.string().uuid().optional().or(z.literal("")),
  startsAt: z.string().min(10),
});

const blockSchema = z.object({
  resourceId: z.string().uuid(),
  startsAt: z.string().min(10),
  endsAt: z.string().min(10),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
});

/** Convierte un valor `datetime-local` en la zona de la sede a un instante UTC. */
function parseLocalDateTime(value: string, timezone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  return zonedTimeToUtc(timezone, year, month, day, hour, minute);
}

function backTo(params: Record<string, string>): never {
  const query = new URLSearchParams(params).toString();
  redirect(`/app/agenda?${query}`);
}

export async function createAppointmentAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = createSchema.safeParse({
    serviceId: formData.get("serviceId"),
    professionalId: formData.get("professionalId"),
    startsAt: formData.get("startsAt"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    backTo({ error: "cita_datos" });
  }

  const location = await withTenant(
    { businessId: ctx.business.id, userId: ctx.session.user.id, role: "owner" },
    (tx) =>
      tx.location.findFirst({
        where: { businessId: ctx.business.id, isDefault: true, active: true },
        select: { id: true, timezone: true },
      }),
  );

  if (!location) {
    backTo({ error: "cita_sede" });
  }

  const startsAt = parseLocalDateTime(
    parsed.data.startsAt,
    location.timezone ?? ctx.business.timezone,
  );

  if (!startsAt) {
    backTo({ error: "cita_fecha" });
  }

  try {
    await createBooking({
      businessId: ctx.business.id,
      locationId: location.id,
      serviceId: parsed.data.serviceId,
      professionalId: parsed.data.professionalId || null,
      startsAt,
      client: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
      },
      clientNotes: parsed.data.notes || null,
      source: "admin",
      createdBy: ctx.session.user.id,
    });
  } catch (error) {
    if (error instanceof BookingError) {
      backTo({ error: error.code.toLowerCase() });
    }
    throw error;
  }

  revalidatePath("/app/agenda");
  backTo({ saved: "cita" });
}

export async function cancelAppointmentAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = cancelSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    backTo({ error: "cancelar_datos" });
  }

  try {
    await cancelBooking({
      businessId: ctx.business.id,
      appointmentId: parsed.data.appointmentId,
      reason: parsed.data.reason || null,
      actorUserId: ctx.session.user.id,
      force: true,
    });
  } catch (error) {
    if (error instanceof BookingError) {
      backTo({ error: error.code.toLowerCase() });
    }
    throw error;
  }

  revalidatePath("/app/agenda");
  backTo({ saved: "cancelada" });
}

export async function rescheduleAppointmentAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = rescheduleSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    professionalId: formData.get("professionalId"),
    startsAt: formData.get("startsAt"),
  });

  if (!parsed.success) {
    backTo({ error: "mover_datos" });
  }

  const startsAt = parseLocalDateTime(parsed.data.startsAt, ctx.business.timezone);

  if (!startsAt) {
    backTo({ error: "mover_fecha" });
  }

  try {
    await rescheduleBooking({
      businessId: ctx.business.id,
      appointmentId: parsed.data.appointmentId,
      startsAt,
      professionalId: parsed.data.professionalId || undefined,
      actorUserId: ctx.session.user.id,
    });
  } catch (error) {
    if (error instanceof BookingError) {
      backTo({ error: error.code.toLowerCase() });
    }
    throw error;
  }

  revalidatePath("/app/agenda");
  backTo({ saved: "movida" });
}

export async function blockResourceAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = blockSchema.safeParse({
    resourceId: formData.get("resourceId"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    backTo({ error: "bloqueo_datos" });
  }

  const startsAt = parseLocalDateTime(parsed.data.startsAt, ctx.business.timezone);
  const endsAt = parseLocalDateTime(parsed.data.endsAt, ctx.business.timezone);

  if (!startsAt || !endsAt || endsAt.getTime() <= startsAt.getTime()) {
    backTo({ error: "bloqueo_fechas" });
  }

  try {
    await withTenant(
      { businessId: ctx.business.id, userId: ctx.session.user.id, role: "owner" },
      async (tx) => {
        const resource = await tx.resource.findFirst({
          where: { id: parsed.data.resourceId, businessId: ctx.business.id },
        });

        if (!resource) {
          throw new BookingError("RESOURCE_TAKEN");
        }

        const overlap = await tx.resourceReservation.findFirst({
          where: {
            businessId: ctx.business.id,
            resourceId: resource.id,
            releasedAt: null,
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { id: true },
        });

        if (overlap) {
          throw new BookingError("RESOURCE_TAKEN");
        }

        const block = await tx.resourceBlock.create({
          data: {
            businessId: ctx.business.id,
            locationId: resource.locationId,
            resourceId: resource.id,
            startsAt,
            endsAt,
            reason: parsed.data.reason || null,
          },
        });

        await tx.resourceReservation.create({
          data: {
            businessId: ctx.business.id,
            locationId: resource.locationId,
            resourceId: resource.id,
            blockId: block.id,
            startsAt,
            endsAt,
          },
        });

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "resource.blocked",
          entityType: "resource_block",
          entityId: block.id,
          metadata: {
            resourceId: resource.id,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
          },
        });
      },
    );
  } catch (error) {
    if (error instanceof BookingError) {
      backTo({ error: "recurso_ocupado" });
    }
    throw error;
  }

  revalidatePath("/app/agenda");
  backTo({ saved: "bloqueo" });
}
