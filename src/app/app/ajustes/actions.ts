"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireOwner } from "@/lib/guards";
import { withTenant } from "@/lib/tenant";

const businessSchema = z.object({
  name: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(160).optional().or(z.literal("")),
  taxId: z.string().trim().max(40).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  website: z.string().trim().url().optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug no válido"),
  timezone: z.string().trim().min(1).max(80),
  currency: z.string().trim().length(3).toUpperCase(),
  minLeadMinutes: z.coerce.number().int().min(0).max(10080),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  slotIntervalMinutes: z.coerce.number().int().refine((value) =>
    [5, 10, 15, 20, 30, 60].includes(value),
  ),
  cancellationCutoffMinutes: z.coerce.number().int().min(0).max(10080),
  reminderHoursBefore: z.coerce.number().int().min(1).max(168),
});

const locationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  addressLine1: z.string().trim().min(3).max(160),
  addressLine2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(2).max(80),
  province: z.string().trim().max(80).optional().or(z.literal("")),
  postalCode: z.string().trim().min(4).max(12),
  countryCode: z.string().trim().length(2).toUpperCase(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
});

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

function errorRedirect(code: string): never {
  redirect(`/app/ajustes?error=${encodeURIComponent(code)}`);
}

function emptyToNull(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

export async function updateBusinessAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = businessSchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName"),
    taxId: formData.get("taxId"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    website: formData.get("website"),
    description: formData.get("description"),
    tagline: formData.get("tagline"),
    slug: formData.get("slug"),
    timezone: formData.get("timezone"),
    currency: formData.get("currency"),
    minLeadMinutes: formData.get("minLeadMinutes"),
    maxAdvanceDays: formData.get("maxAdvanceDays"),
    slotIntervalMinutes: formData.get("slotIntervalMinutes"),
    cancellationCutoffMinutes: formData.get("cancellationCutoffMinutes"),
    reminderHoursBefore: formData.get("reminderHoursBefore"),
  });

  if (!parsed.success) {
    errorRedirect("datos");
  }

  try {
    await withTenant(
      {
        businessId: ctx.business.id,
        userId: ctx.session.user.id,
        role: "owner",
      },
      async (tx) => {
        await tx.business.update({
          where: { id: ctx.business.id },
          data: {
            name: parsed.data.name,
            legalName: emptyToNull(parsed.data.legalName),
            taxId: emptyToNull(parsed.data.taxId),
            phone: emptyToNull(parsed.data.phone),
            email: emptyToNull(parsed.data.email),
            website: emptyToNull(parsed.data.website),
            description: emptyToNull(parsed.data.description),
            tagline: emptyToNull(parsed.data.tagline),
            slug: parsed.data.slug,
            timezone: parsed.data.timezone,
            currency: parsed.data.currency,
            minLeadMinutes: parsed.data.minLeadMinutes,
            maxAdvanceDays: parsed.data.maxAdvanceDays,
            slotIntervalMinutes: parsed.data.slotIntervalMinutes,
            cancellationCutoffMinutes: parsed.data.cancellationCutoffMinutes,
            reminderHoursBefore: parsed.data.reminderHoursBefore,
          },
        });

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "business.updated",
          entityType: "business",
          entityId: ctx.business.id,
        });
      },
    );
  } catch {
    errorRedirect("guardar");
  }

  revalidatePath("/app");
  revalidatePath("/app/ajustes");
  redirect("/app/ajustes?saved=business");
}

export async function updateLocationAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = locationSchema.safeParse({
    name: formData.get("name"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    city: formData.get("city"),
    province: formData.get("province"),
    postalCode: formData.get("postalCode"),
    countryCode: formData.get("countryCode"),
    phone: formData.get("phone"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    errorRedirect("sede");
  }

  try {
    await withTenant(
      {
        businessId: ctx.business.id,
        userId: ctx.session.user.id,
        role: "owner",
      },
      async (tx) => {
        const location = await tx.location.findFirst({
          where: { businessId: ctx.business.id, isDefault: true, active: true },
        });

        if (!location) {
          throw new Error("LOCATION_NOT_FOUND");
        }

        await tx.location.update({
          where: { id: location.id },
          data: {
            name: parsed.data.name,
            addressLine1: parsed.data.addressLine1,
            addressLine2: emptyToNull(parsed.data.addressLine2),
            city: parsed.data.city,
            province: emptyToNull(parsed.data.province),
            postalCode: parsed.data.postalCode,
            countryCode: parsed.data.countryCode,
            phone: emptyToNull(parsed.data.phone),
            email: emptyToNull(parsed.data.email),
          },
        });

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "location.updated",
          entityType: "location",
          entityId: location.id,
        });
      },
    );
  } catch {
    errorRedirect("sede_guardar");
  }

  revalidatePath("/app");
  revalidatePath("/app/ajustes");
  redirect("/app/ajustes?saved=location");
}

export async function updateHoursAction(formData: FormData) {
  const ctx = await requireOwner();
  const days = Array.from({ length: 7 }, (_, index) => index + 1);
  const rows: {
    weekday: number;
    opensAt: string;
    closesAt: string;
    closed: boolean;
  }[] = [];

  for (const weekday of days) {
    const closed = formData.get(`closed-${weekday}`) === "on";
    const opensAt = String(formData.get(`open-${weekday}`) ?? "09:00");
    const closesAt = String(formData.get(`close-${weekday}`) ?? "20:00");

    if (!timeRegex.test(opensAt) || !timeRegex.test(closesAt)) {
      errorRedirect("horario");
    }

    if (!closed && opensAt >= closesAt) {
      errorRedirect("horario");
    }

    rows.push({ weekday, opensAt, closesAt, closed });
  }

  try {
    await withTenant(
      {
        businessId: ctx.business.id,
        userId: ctx.session.user.id,
        role: "owner",
      },
      async (tx) => {
        const location = await tx.location.findFirst({
          where: { businessId: ctx.business.id, isDefault: true, active: true },
        });

        if (!location) {
          throw new Error("LOCATION_NOT_FOUND");
        }

        for (const row of rows) {
          await tx.businessHours.upsert({
            where: {
              businessId_locationId_weekday: {
                businessId: ctx.business.id,
                locationId: location.id,
                weekday: row.weekday,
              },
            },
            update: {
              opensAt: row.opensAt,
              closesAt: row.closesAt,
              closed: row.closed,
            },
            create: {
              businessId: ctx.business.id,
              locationId: location.id,
              weekday: row.weekday,
              opensAt: row.opensAt,
              closesAt: row.closesAt,
              closed: row.closed,
            },
          });
        }

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "business_hours.updated",
          entityType: "location",
          entityId: location.id,
        });
      },
    );
  } catch {
    errorRedirect("horario_guardar");
  }

  revalidatePath("/app");
  revalidatePath("/app/ajustes");
  redirect("/app/ajustes?saved=hours");
}

export async function publishBusinessAction() {
  const ctx = await requireOwner();

  try {
    await withTenant(
      {
        businessId: ctx.business.id,
        userId: ctx.session.user.id,
        role: "owner",
      },
      async (tx) => {
        const location = await tx.location.findFirst({
          where: { businessId: ctx.business.id, isDefault: true, active: true },
        });
        const hours = await tx.businessHours.count({
          where: { businessId: ctx.business.id, locationId: location?.id },
        });

        if (!location || hours < 7) {
          throw new Error("INCOMPLETE");
        }

        await tx.business.update({
          where: { id: ctx.business.id },
          data: { publishedAt: new Date() },
        });

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "business.published",
          entityType: "business",
          entityId: ctx.business.id,
        });
      },
    );
  } catch {
    redirect("/app/ajustes?error=publicar");
  }

  revalidatePath("/app");
  revalidatePath("/app/ajustes");
  redirect("/app/ajustes?saved=published");
}
