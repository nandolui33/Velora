import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant";

export type PublicBusiness = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  primaryColor: string;
  themePreset: string;
  timezone: string;
  currency: string;
  location: {
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    province: string | null;
    postalCode: string;
    countryCode: string;
    phone: string | null;
    email: string | null;
  } | null;
  hours: {
    weekday: number;
    opensAt: string;
    closesAt: string;
    closed: boolean;
  }[];
  services: {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    priceCents: number;
    currency: string;
    category: string | null;
    variants: {
      name: string;
      durationMinutes: number;
      priceCents: number;
    }[];
  }[];
  professionals: {
    id: string;
    name: string;
    title: string | null;
    bio: string | null;
    color: string;
    services: string[];
  }[];
};

export async function getPublicBusiness(slug: string) {
  const rows = await prisma.$queryRaw<{ data: PublicBusiness | null }[]>`
    SELECT get_public_business(${slug}) AS data
  `;

  return rows[0]?.data ?? null;
}

export async function getBusinessPreview(businessId: string) {
  return withTenant(
    { businessId, userId: "", role: "owner" },
    async (tx): Promise<PublicBusiness | null> => {
      const business = await tx.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        return null;
      }

      const [location, hours, services, professionals] = await Promise.all([
        tx.location.findFirst({
          where: { businessId, isDefault: true, active: true },
        }),
        tx.businessHours.findMany({
          where: { businessId },
          orderBy: { weekday: "asc" },
        }),
        tx.service.findMany({
          where: { businessId, active: true },
          include: {
            category: true,
            variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
        tx.professional.findMany({
          where: { businessId, active: true },
          include: {
            serviceLinks: {
              where: { active: true },
              include: { service: true },
            },
          },
          orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
        }),
      ]);

      return {
        id: business.id,
        name: business.name,
        slug: business.slug,
        tagline: business.tagline,
        description: business.description,
        phone: business.phone,
        email: business.email,
        website: business.website,
        primaryColor: business.primaryColor,
        themePreset: business.themePreset,
        timezone: business.timezone,
        currency: business.currency,
        location: location
          ? {
              name: location.name,
              addressLine1: location.addressLine1,
              addressLine2: location.addressLine2,
              city: location.city,
              province: location.province,
              postalCode: location.postalCode,
              countryCode: location.countryCode,
              phone: location.phone,
              email: location.email,
            }
          : null,
        hours: hours.map((hour) => ({
          weekday: hour.weekday,
          opensAt: hour.opensAt,
          closesAt: hour.closesAt,
          closed: hour.closed,
        })),
        services: services.map((service) => ({
          id: service.id,
          name: service.name,
          description: service.description,
          durationMinutes: service.durationMinutes,
          priceCents: service.priceCents,
          currency: service.currency,
          category: service.category?.name ?? null,
          variants: service.variants.map((variant) => ({
            name: variant.name,
            durationMinutes: variant.durationMinutes,
            priceCents: variant.priceCents,
          })),
        })),
        professionals: professionals.map((professional) => ({
          id: professional.id,
          name: professional.displayName,
          title: professional.title,
          bio: professional.bio,
          color: professional.color,
          services: professional.serviceLinks.map((link) => link.service.name),
        })),
      };
    },
  );
}
