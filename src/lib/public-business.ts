import { prisma } from "@/lib/db";

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
