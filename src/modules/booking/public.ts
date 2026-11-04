import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import {
  dayRange,
  getAvailability,
  type AvailabilityDayDto,
} from "@/modules/scheduling/data";

export type BookingCatalogProfessional = {
  id: string;
  name: string;
  color: string;
};

export type BookingCatalogService = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  professionals: BookingCatalogProfessional[];
  variants: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
  }[];
};

export type BookingCatalog = {
  businessId: string;
  slug: string;
  name: string;
  timezone: string;
  currency: string;
  locationId: string;
  locationName: string;
  addressLine: string;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  cancellationCutoffMinutes: number;
  services: BookingCatalogService[];
  professionals: BookingCatalogProfessional[];
};

export type BusinessResolution = {
  businessId: string;
  slug: string;
  name: string;
  timezone: string;
};

/**
 * Resuelve un slug público a su empresa.
 *
 * Se apoya en `resolve_business_slug`, una función `SECURITY DEFINER` que es
 * la única lectura permitida fuera de un contexto de empresa: devuelve solo
 * el identificador, nunca datos del negocio.
 */
export async function resolveBusinessSlug(slug: string) {
  const rows = await prisma.$queryRaw<{ id: string | null }[]>`
    SELECT resolve_business_slug(${slug}) AS id
  `;

  return rows[0]?.id ?? null;
}

export async function getPublicBookingCatalog(
  slug: string,
): Promise<BookingCatalog | null> {
  const businessId = await resolveBusinessSlug(slug);

  if (!businessId) {
    return null;
  }

  return withTenant(
    { businessId, userId: "", role: "public" },
    async (tx) => {
      const business = await tx.business.findFirst({
        where: { id: businessId, status: "active", publishedAt: { not: null } },
      });

      if (!business) {
        return null;
      }

      const location = await tx.location.findFirst({
        where: { businessId, isDefault: true, active: true },
      });

      if (!location) {
        return null;
      }

      const [services, professionals, links] = await Promise.all([
        tx.service.findMany({
          where: {
            businessId,
            active: true,
            onlineBookable: true,
            locations: { some: { locationId: location.id, active: true } },
          },
          include: {
            variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
        tx.professional.findMany({
          where: {
            businessId,
            active: true,
            locations: { some: { locationId: location.id, active: true } },
          },
          orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
        }),
        tx.professionalService.findMany({
          where: { businessId, active: true },
          select: { professionalId: true, serviceId: true },
        }),
      ]);

      const professionalDtos = professionals.map((professional) => ({
        id: professional.id,
        name: professional.displayName,
        color: professional.color,
      }));

      const linksByService = new Map<string, Set<string>>();
      for (const link of links) {
        const set = linksByService.get(link.serviceId) ?? new Set<string>();
        set.add(link.professionalId);
        linksByService.set(link.serviceId, set);
      }

      return {
        businessId,
        slug: business.slug,
        name: business.name,
        timezone: location.timezone ?? business.timezone,
        currency: business.currency,
        locationId: location.id,
        locationName: location.name,
        addressLine: [
          location.addressLine1,
          location.addressLine2,
          location.city,
        ]
          .filter(Boolean)
          .join(", "),
        minLeadMinutes: business.minLeadMinutes,
        maxAdvanceDays: business.maxAdvanceDays,
        cancellationCutoffMinutes: business.cancellationCutoffMinutes,
        professionals: professionalDtos,
        services: services.map((service) => {
          const allowed = linksByService.get(service.id);
          const qualified =
            allowed && allowed.size > 0
              ? professionalDtos.filter((professional) => allowed.has(professional.id))
              : professionalDtos;

          return {
            id: service.id,
            name: service.name,
            description: service.description,
            durationMinutes: service.durationMinutes,
            priceCents: service.priceCents,
            currency: service.currency,
            professionals: qualified,
            variants: service.variants.map((variant) => ({
              id: variant.id,
              name: variant.name,
              durationMinutes: variant.durationMinutes,
              priceCents: variant.priceCents,
            })),
          };
        }),
      };
    },
  );
}

export async function getPublicBookingTarget(slug: string) {
  const businessId = await resolveBusinessSlug(slug);

  if (!businessId) {
    return null;
  }

  return withTenant(
    { businessId, userId: "", role: "public" },
    async (tx) => {
      const business = await tx.business.findFirst({
        where: { id: businessId, status: "active", publishedAt: { not: null } },
        select: { timezone: true },
      });

      if (!business) {
        return null;
      }

      const location = await tx.location.findFirst({
        where: { businessId, isDefault: true, active: true },
        select: { id: true, timezone: true },
      });

      if (!location) {
        return null;
      }

      return {
        businessId,
        locationId: location.id,
        timezone: location.timezone ?? business.timezone,
      };
    },
  );
}

export async function getPublicAvailability(input: {
  slug: string;
  serviceId: string;
  serviceVariantId?: string | null;
  professionalId?: string | null;
  date: string;
  days: number;
}): Promise<AvailabilityDayDto[] | null> {
  const businessId = await resolveBusinessSlug(input.slug);

  if (!businessId) {
    return null;
  }

  return withTenant(
    { businessId, userId: "", role: "public" },
    async (tx) => {
      const business = await tx.business.findFirst({
        where: { id: businessId, status: "active", publishedAt: { not: null } },
        select: { timezone: true, maxAdvanceDays: true },
      });

      if (!business) {
        return null;
      }

      const location = await tx.location.findFirst({
        where: { businessId, isDefault: true, active: true },
        select: { id: true, timezone: true },
      });

      if (!location) {
        return null;
      }

      const timezone = location.timezone ?? business.timezone;
      const days = Math.min(Math.max(1, input.days), 7);
      const range = dayRange(timezone, input.date, days);

      return getAvailability(tx, {
        businessId,
        locationId: location.id,
        serviceId: input.serviceId,
        serviceVariantId: input.serviceVariantId ?? null,
        professionalId: input.professionalId ?? null,
        from: range.from,
        to: range.to,
      });
    },
  );
}
