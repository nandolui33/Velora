"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireOwner } from "@/lib/guards";
import { withTenant } from "@/lib/tenant";

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
});

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(120),
  price: z.coerce.number().min(0).max(10000),
  onlineBookable: z.boolean(),
});

const variantSchema = z.object({
  serviceId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  price: z.coerce.number().min(0).max(10000),
});

const toggleSchema = z.object({
  serviceId: z.string().uuid(),
  active: z.enum(["true", "false"]),
});

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function errorRedirect(code: string): never {
  redirect(`/app/servicios?error=${encodeURIComponent(code)}`);
}

export async function createCategoryAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = categorySchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    errorRedirect("categoria");
  }

  try {
    await withTenant(
      {
        businessId: ctx.business.id,
        userId: ctx.session.user.id,
        role: "owner",
      },
      async (tx) => {
        const category = await tx.serviceCategory.create({
          data: {
            businessId: ctx.business.id,
            name: parsed.data.name,
            slug: slugify(parsed.data.name),
          },
        });

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "service_category.created",
          entityType: "service_category",
          entityId: category.id,
        });
      },
    );
  } catch {
    errorRedirect("categoria_guardar");
  }

  revalidatePath("/app/servicios");
  redirect("/app/servicios?saved=categoria");
}

export async function createServiceAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = serviceSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    description: formData.get("description"),
    durationMinutes: formData.get("durationMinutes"),
    bufferAfterMinutes: formData.get("bufferAfterMinutes"),
    price: formData.get("price"),
    onlineBookable: formData.get("onlineBookable") === "on",
  });

  if (!parsed.success) {
    errorRedirect("servicio");
  }

  try {
    await withTenant(
      {
        businessId: ctx.business.id,
        userId: ctx.session.user.id,
        role: "owner",
      },
      async (tx) => {
        const categoryId = parsed.data.categoryId || null;

        if (categoryId) {
          const category = await tx.serviceCategory.findFirst({
            where: { id: categoryId, businessId: ctx.business.id },
          });
          if (!category) {
            throw new Error("CATEGORY_NOT_FOUND");
          }
        }

        const service = await tx.service.create({
          data: {
            businessId: ctx.business.id,
            categoryId,
            name: parsed.data.name,
            description: parsed.data.description || null,
            durationMinutes: parsed.data.durationMinutes,
            bufferAfterMinutes: parsed.data.bufferAfterMinutes,
            priceCents: Math.round(parsed.data.price * 100),
            currency: ctx.business.currency,
            active: true,
            onlineBookable: parsed.data.onlineBookable,
          },
        });

        const location = await tx.location.findFirst({
          where: { businessId: ctx.business.id, isDefault: true, active: true },
        });

        if (location) {
          await tx.serviceLocation.create({
            data: {
              businessId: ctx.business.id,
              serviceId: service.id,
              locationId: location.id,
              active: true,
            },
          });
        }

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "service.created",
          entityType: "service",
          entityId: service.id,
        });
      },
    );
  } catch {
    errorRedirect("servicio_guardar");
  }

  revalidatePath("/app/servicios");
  redirect("/app/servicios?saved=servicio");
}

export async function createVariantAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = variantSchema.safeParse({
    serviceId: formData.get("serviceId"),
    name: formData.get("name"),
    durationMinutes: formData.get("durationMinutes"),
    price: formData.get("price"),
  });

  if (!parsed.success) {
    errorRedirect("variante");
  }

  try {
    await withTenant(
      {
        businessId: ctx.business.id,
        userId: ctx.session.user.id,
        role: "owner",
      },
      async (tx) => {
        const service = await tx.service.findFirst({
          where: { id: parsed.data.serviceId, businessId: ctx.business.id },
        });

        if (!service) {
          throw new Error("SERVICE_NOT_FOUND");
        }

        const variant = await tx.serviceVariant.create({
          data: {
            businessId: ctx.business.id,
            serviceId: service.id,
            name: parsed.data.name,
            durationMinutes: parsed.data.durationMinutes,
            priceCents: Math.round(parsed.data.price * 100),
          },
        });

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "service_variant.created",
          entityType: "service_variant",
          entityId: variant.id,
        });
      },
    );
  } catch {
    errorRedirect("variante_guardar");
  }

  revalidatePath("/app/servicios");
  redirect("/app/servicios?saved=variante");
}

export async function toggleServiceAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = toggleSchema.safeParse({
    serviceId: formData.get("serviceId"),
    active: formData.get("active"),
  });

  if (!parsed.success) {
    errorRedirect("servicio");
  }

  await withTenant(
    {
      businessId: ctx.business.id,
      userId: ctx.session.user.id,
      role: "owner",
    },
    async (tx) => {
      await tx.service.updateMany({
        where: { id: parsed.data.serviceId, businessId: ctx.business.id },
        data: { active: parsed.data.active === "true" },
      });

      await recordAudit(tx, {
        businessId: ctx.business.id,
        actorUserId: ctx.session.user.id,
        actorType: "user",
        action: parsed.data.active === "true" ? "service.activated" : "service.deactivated",
        entityType: "service",
        entityId: parsed.data.serviceId,
      });
    },
  );

  revalidatePath("/app/servicios");
  redirect("/app/servicios");
}
