"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireOwner } from "@/lib/guards";
import { getSectorTemplate } from "@/lib/sector-templates";
import { withTenant } from "@/lib/tenant";

const applySchema = z.object({
  sector: z.enum([
    "barberia",
    "peluqueria",
    "manicura",
    "spa",
    "cejas_pestanas",
    "estetica",
    "masajes",
  ]),
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

export async function applyTemplateAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = applySchema.safeParse({
    sector: formData.get("sector"),
  });

  if (!parsed.success) {
    redirect("/app/plantillas?error=plantilla");
  }

  const template = getSectorTemplate(parsed.data.sector);

  if (!template) {
    redirect("/app/plantillas?error=plantilla");
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
          where: {
            businessId: ctx.business.id,
            isDefault: true,
            active: true,
          },
        });

        if (!location) {
          throw new Error("LOCATION_NOT_FOUND");
        }

        const resourceTypeByKey = new Map<string, string>();
        let resourceTypesCreated = 0;
        let resourcesCreated = 0;

        for (const [index, item] of template.resourceTypes.entries()) {
          const resourceType = await tx.resourceType.upsert({
            where: {
              businessId_key: {
                businessId: ctx.business.id,
                key: item.key,
              },
            },
            update: {
              name: item.name,
              description: item.description ?? null,
              active: true,
              sortOrder: index,
            },
            create: {
              businessId: ctx.business.id,
              key: item.key,
              name: item.name,
              description: item.description ?? null,
              active: true,
              sortOrder: index,
            },
          });

          resourceTypeByKey.set(item.key, resourceType.id);

          const code = `${item.key}-1`;
          const existingResource = await tx.resource.findFirst({
            where: {
              businessId: ctx.business.id,
              locationId: location.id,
              code,
            },
          });

          if (!existingResource) {
            await tx.resource.create({
              data: {
                businessId: ctx.business.id,
                locationId: location.id,
                resourceTypeId: resourceType.id,
                name: item.resourceName,
                code,
                active: true,
                sortOrder: index,
              },
            });
            resourcesCreated += 1;
          }

          resourceTypesCreated += 1;
        }

        let servicesCreated = 0;
        let requirementsCreated = 0;

        for (const [index, item] of template.services.entries()) {
          const categorySlug = slugify(item.category);
          const category = await tx.serviceCategory.upsert({
            where: {
              businessId_slug: {
                businessId: ctx.business.id,
                slug: categorySlug,
              },
            },
            update: { name: item.category, active: true },
            create: {
              businessId: ctx.business.id,
              name: item.category,
              slug: categorySlug,
              active: true,
            },
          });

          const existing = await tx.service.findFirst({
            where: {
              businessId: ctx.business.id,
              name: item.name,
            },
          });

          let serviceId = existing?.id;

          if (!serviceId) {
            const service = await tx.service.create({
              data: {
                businessId: ctx.business.id,
                categoryId: category.id,
                name: item.name,
                description: item.description ?? null,
                durationMinutes: item.durationMinutes,
                priceCents: item.priceCents,
                currency: ctx.business.currency,
                active: true,
                onlineBookable: true,
                sortOrder: index,
              },
            });
            serviceId = service.id;
            servicesCreated += 1;
          }

          await tx.serviceLocation.upsert({
            where: {
              businessId_serviceId_locationId: {
                businessId: ctx.business.id,
                serviceId,
                locationId: location.id,
              },
            },
            update: { active: true },
            create: {
              businessId: ctx.business.id,
              serviceId,
              locationId: location.id,
              active: true,
            },
          });

          if (item.requiredResourceKey) {
            const resourceTypeId = resourceTypeByKey.get(item.requiredResourceKey);

            if (resourceTypeId) {
              const existingRequirement = await tx.serviceResourceRequirement.findFirst({
                where: {
                  businessId: ctx.business.id,
                  serviceId,
                  locationId: location.id,
                  resourceTypeId,
                  resourceId: null,
                },
              });

              if (!existingRequirement) {
                await tx.serviceResourceRequirement.create({
                  data: {
                    businessId: ctx.business.id,
                    serviceId,
                    locationId: location.id,
                    resourceTypeId,
                    quantity: 1,
                    required: true,
                  },
                });
                requirementsCreated += 1;
              }
            }
          }
        }

        await tx.business.update({
          where: { id: ctx.business.id },
          data: {
            sector: template.key,
            templateVersion: template.version,
            templateAppliedAt: new Date(),
          },
        });

        await recordAudit(tx, {
          businessId: ctx.business.id,
          actorUserId: ctx.session.user.id,
          actorType: "user",
          action: "template.applied",
          entityType: "business",
          entityId: ctx.business.id,
          metadata: {
            sector: template.key,
            version: template.version,
            servicesCreated,
            resourceTypesCreated,
            resourcesCreated,
            requirementsCreated,
          },
        });
      },
    );
  } catch {
    redirect("/app/plantillas?error=aplicar");
  }

  revalidatePath("/app");
  revalidatePath("/app/servicios");
  revalidatePath("/app/equipo");
  revalidatePath("/app/recursos");
  revalidatePath("/app/plantillas");
  redirect(`/app/plantillas?saved=${parsed.data.sector}`);
}
