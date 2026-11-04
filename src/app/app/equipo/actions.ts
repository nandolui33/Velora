"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireOwner } from "@/lib/guards";
import { withTenant } from "@/lib/tenant";

const professionalSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  title: z.string().trim().max(80).optional().or(z.literal("")),
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const assignmentSchema = z.object({
  professionalId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).default([]),
});

const scheduleSchema = z.object({
  professionalId: z.string().uuid(),
});

const timeOffSchema = z.object({
  professionalId: z.string().uuid(),
  startsAt: z.string().min(10),
  endsAt: z.string().min(10),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
});

const toggleSchema = z.object({
  professionalId: z.string().uuid(),
  active: z.enum(["true", "false"]),
});

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

function errorRedirect(code: string): never {
  redirect(`/app/equipo?error=${encodeURIComponent(code)}`);
}

export async function createProfessionalAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = professionalSchema.safeParse({
    displayName: formData.get("displayName"),
    title: formData.get("title"),
    bio: formData.get("bio"),
    color: formData.get("color") ?? "#111827",
  });

  if (!parsed.success) {
    errorRedirect("profesional");
  }

  try {
    await withTenant(
      {
        businessId: ctx.business.id,
        userId: ctx.session.user.id,
        role: "owner",
      },
      async (tx) => {
        const professional = await tx.professional.create({
          data: {
            businessId: ctx.business.id,
            displayName: parsed.data.displayName,
            title: parsed.data.title || null,
            bio: parsed.data.bio || null,
            color: parsed.data.color,
          },
        });

        const location = await tx.location.findFirst({
          where: { businessId: ctx.business.id, isDefault: true, active: true },
        });

        if (location) {
          await tx.professionalLocation.create({
            data: {
              businessId: ctx.business.id,
              professionalId: professional.id,
              locationId: location.id,
              isPrimary: true,
              active: true,
            },
          });
        }

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "professional.created",
          entityType: "professional",
          entityId: professional.id,
        });
      },
    );
  } catch {
    errorRedirect("profesional_guardar");
  }

  revalidatePath("/app/equipo");
  redirect("/app/equipo?saved=profesional");
}

export async function assignServicesAction(formData: FormData) {
  const ctx = await requireOwner();
  const serviceIds = formData.getAll("serviceIds").map(String);
  const parsed = assignmentSchema.safeParse({
    professionalId: formData.get("professionalId"),
    serviceIds,
  });

  if (!parsed.success) {
    errorRedirect("asignacion");
  }

  try {
    await withTenant(
      {
        businessId: ctx.business.id,
        userId: ctx.session.user.id,
        role: "owner",
      },
      async (tx) => {
        const professional = await tx.professional.findFirst({
          where: {
            id: parsed.data.professionalId,
            businessId: ctx.business.id,
          },
        });

        if (!professional) {
          throw new Error("PROFESSIONAL_NOT_FOUND");
        }

        const validServices = await tx.service.findMany({
          where: {
            businessId: ctx.business.id,
            id: { in: parsed.data.serviceIds },
          },
          select: { id: true },
        });

        await tx.professionalService.deleteMany({
          where: {
            businessId: ctx.business.id,
            professionalId: professional.id,
          },
        });

        if (validServices.length > 0) {
          await tx.professionalService.createMany({
            data: validServices.map((service) => ({
              businessId: ctx.business.id,
              professionalId: professional.id,
              serviceId: service.id,
              active: true,
            })),
          });
        }

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "professional.services_updated",
          entityType: "professional",
          entityId: professional.id,
          metadata: { serviceCount: validServices.length },
        });
      },
    );
  } catch {
    errorRedirect("asignacion_guardar");
  }

  revalidatePath("/app/equipo");
  redirect("/app/equipo?saved=servicios");
}

export async function updateProfessionalScheduleAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = scheduleSchema.safeParse({
    professionalId: formData.get("professionalId"),
  });

  if (!parsed.success) {
    errorRedirect("horario");
  }

  const rows: { weekday: number; opensAt: string; closesAt: string; active: boolean }[] = [];

  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const active = formData.get(`active-${weekday}`) === "on";
    const opensAt = String(formData.get(`open-${weekday}`) ?? "09:00");
    const closesAt = String(formData.get(`close-${weekday}`) ?? "20:00");

    if (!timeRegex.test(opensAt) || !timeRegex.test(closesAt)) {
      errorRedirect("horario");
    }
    if (active && opensAt >= closesAt) {
      errorRedirect("horario");
    }

    rows.push({ weekday, opensAt, closesAt, active });
  }

  try {
    await withTenant(
      {
        businessId: ctx.business.id,
        userId: ctx.session.user.id,
        role: "owner",
      },
      async (tx) => {
        const professional = await tx.professional.findFirst({
          where: {
            id: parsed.data.professionalId,
            businessId: ctx.business.id,
          },
        });
        const location = await tx.location.findFirst({
          where: { businessId: ctx.business.id, isDefault: true, active: true },
        });

        if (!professional || !location) {
          throw new Error("MISSING_CONTEXT");
        }

        for (const row of rows) {
          await tx.professionalSchedule.upsert({
            where: {
              businessId_professionalId_locationId_weekday: {
                businessId: ctx.business.id,
                professionalId: professional.id,
                locationId: location.id,
                weekday: row.weekday,
              },
            },
            update: {
              opensAt: row.opensAt,
              closesAt: row.closesAt,
              active: row.active,
            },
            create: {
              businessId: ctx.business.id,
              professionalId: professional.id,
              locationId: location.id,
              weekday: row.weekday,
              opensAt: row.opensAt,
              closesAt: row.closesAt,
              active: row.active,
            },
          });
        }

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "professional.schedule_updated",
          entityType: "professional",
          entityId: professional.id,
        });
      },
    );
  } catch {
    errorRedirect("horario_guardar");
  }

  revalidatePath("/app/equipo");
  redirect("/app/equipo?saved=horario");
}

export async function createTimeOffAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = timeOffSchema.safeParse({
    professionalId: formData.get("professionalId"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    errorRedirect("ausencia");
  }

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt
  ) {
    errorRedirect("ausencia");
  }

  try {
    await withTenant(
      {
        businessId: ctx.business.id,
        userId: ctx.session.user.id,
        role: "owner",
      },
      async (tx) => {
        const professional = await tx.professional.findFirst({
          where: {
            id: parsed.data.professionalId,
            businessId: ctx.business.id,
          },
        });

        if (!professional) {
          throw new Error("PROFESSIONAL_NOT_FOUND");
        }

        const timeOff = await tx.professionalTimeOff.create({
          data: {
            businessId: ctx.business.id,
            professionalId: professional.id,
            startsAt,
            endsAt,
            reason: parsed.data.reason || null,
          },
        });

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "professional.time_off_created",
          entityType: "professional_time_off",
          entityId: timeOff.id,
        });
      },
    );
  } catch {
    errorRedirect("ausencia_guardar");
  }

  revalidatePath("/app/equipo");
  redirect("/app/equipo?saved=ausencia");
}

export async function toggleProfessionalAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = toggleSchema.safeParse({
    professionalId: formData.get("professionalId"),
    active: formData.get("active"),
  });

  if (!parsed.success) {
    errorRedirect("profesional");
  }

  await withTenant(
    {
      businessId: ctx.business.id,
      userId: ctx.session.user.id,
      role: "owner",
    },
    async (tx) => {
      await tx.professional.updateMany({
        where: {
          id: parsed.data.professionalId,
          businessId: ctx.business.id,
        },
        data: { active: parsed.data.active === "true" },
      });

      await recordAudit(tx, {
        businessId: ctx.business.id,
        actorUserId: ctx.session.user.id,
        actorType: "user",
        action:
          parsed.data.active === "true"
            ? "professional.activated"
            : "professional.deactivated",
        entityType: "professional",
        entityId: parsed.data.professionalId,
      });
    },
  );

  revalidatePath("/app/equipo");
  redirect("/app/equipo");
}
