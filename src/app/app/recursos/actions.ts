"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireOwner } from "@/lib/guards";
import { withTenant } from "@/lib/tenant";

const typeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

const resourceSchema = z.object({
  resourceTypeId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().min(1).max(40),
});

const requirementSchema = z.object({
  serviceId: z.string().uuid(),
  resourceTypeId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(10),
  required: z.boolean(),
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
  redirect(`/app/recursos?error=${encodeURIComponent(code)}`);
}

export async function createResourceTypeAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = typeSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    errorRedirect("tipo");
  }

  try {
    await withTenant(
      {
        businessId: ctx.business.id,
        userId: ctx.session.user.id,
        role: "owner",
      },
      async (tx) => {
        const type = await tx.resourceType.create({
          data: {
            businessId: ctx.business.id,
            key: slugify(parsed.data.name),
            name: parsed.data.name,
            description: parsed.data.description || null,
          },
        });

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "resource_type.created",
          entityType: "resource_type",
          entityId: type.id,
        });
      },
    );
  } catch {
    errorRedirect("tipo_guardar");
  }

  revalidatePath("/app/recursos");
  redirect("/app/recursos?saved=tipo");
}

export async function createResourceAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = resourceSchema.safeParse({
    resourceTypeId: formData.get("resourceTypeId"),
    name: formData.get("name"),
    code: formData.get("code"),
  });

  if (!parsed.success) {
    errorRedirect("recurso");
  }

  try {
    await withTenant(
      {
        businessId: ctx.business.id,
        userId: ctx.session.user.id,
        role: "owner",
      },
      async (tx) => {
        const [type, location] = await Promise.all([
          tx.resourceType.findFirst({
            where: {
              id: parsed.data.resourceTypeId,
              businessId: ctx.business.id,
            },
          }),
          tx.location.findFirst({
            where: {
              businessId: ctx.business.id,
              isDefault: true,
              active: true,
            },
          }),
        ]);

        if (!type || !location) {
          throw new Error("MISSING_CONTEXT");
        }

        const resource = await tx.resource.create({
          data: {
            businessId: ctx.business.id,
            locationId: location.id,
            resourceTypeId: type.id,
            name: parsed.data.name,
            code: parsed.data.code,
            active: true,
          },
        });

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "resource.created",
          entityType: "resource",
          entityId: resource.id,
        });
      },
    );
  } catch {
    errorRedirect("recurso_guardar");
  }

  revalidatePath("/app/recursos");
  redirect("/app/recursos?saved=recurso");
}

export async function createRequirementAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = requirementSchema.safeParse({
    serviceId: formData.get("serviceId"),
    resourceTypeId: formData.get("resourceTypeId"),
    quantity: formData.get("quantity"),
    required: formData.get("required") === "on",
  });

  if (!parsed.success) {
    errorRedirect("requisito");
  }

  try {
    await withTenant(
      {
        businessId: ctx.business.id,
        userId: ctx.session.user.id,
        role: "owner",
      },
      async (tx) => {
        const [service, type, location] = await Promise.all([
          tx.service.findFirst({
            where: { id: parsed.data.serviceId, businessId: ctx.business.id },
          }),
          tx.resourceType.findFirst({
            where: {
              id: parsed.data.resourceTypeId,
              businessId: ctx.business.id,
            },
          }),
          tx.location.findFirst({
            where: {
              businessId: ctx.business.id,
              isDefault: true,
              active: true,
            },
          }),
        ]);

        if (!service || !type || !location) {
          throw new Error("MISSING_CONTEXT");
        }

        const existing = await tx.serviceResourceRequirement.findFirst({
          where: {
            businessId: ctx.business.id,
            serviceId: service.id,
            locationId: location.id,
            resourceTypeId: type.id,
            resourceId: null,
          },
        });

        if (!existing) {
          await tx.serviceResourceRequirement.create({
            data: {
              businessId: ctx.business.id,
              serviceId: service.id,
              locationId: location.id,
              resourceTypeId: type.id,
              quantity: parsed.data.quantity,
              required: parsed.data.required,
            },
          });

          await recordAudit(tx, {
            businessId: ctx.business.id,
            actorUserId: ctx.session.user.id,
            actorType: "user",
            action: "service_resource_requirement.created",
            entityType: "service",
            entityId: service.id,
            metadata: { resourceTypeId: type.id, quantity: parsed.data.quantity },
          });
        }
      },
    );
  } catch {
    errorRedirect("requisito_guardar");
  }

  revalidatePath("/app/recursos");
  redirect("/app/recursos?saved=requisito");
}
