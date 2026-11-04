import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";

if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
  throw new Error("DATABASE_URL and DIRECT_URL are required for tests");
}

const appUrl = new URL(process.env.DATABASE_URL);
appUrl.searchParams.set("connection_limit", "30");
appUrl.searchParams.set("pool_timeout", "30");

// El cliente de aplicación compartido con `src/lib/db` recibe un pool amplio
// para que las pruebas de concurrencia no agoten las conexiones.
process.env.DATABASE_URL = appUrl.toString();

export const owner = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL,
});

export const app = new PrismaClient({
  datasourceUrl: appUrl.toString(),
});

export async function withTenantApp<T>(
  businessId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return app.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.business_id', ${businessId}, true)`;
      return fn(tx);
    },
    { timeout: 20_000 },
  );
}

export async function withUserApp<T>(
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return app.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      return fn(tx);
    },
    { timeout: 20_000 },
  );
}

export async function withPlatformApp<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return app.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.platform', 'on', true)`;
      return fn(tx);
    },
    { timeout: 20_000 },
  );
}

export type Fixture = {
  businessId: string;
  otherBusinessId: string;
  locationId: string;
  serviceId: string;
  professionalId: string;
  clientId: string;
  resourceTypeId: string;
  resourceId: string;
  userId: string;
};

export async function createFixture(label: string): Promise<Fixture> {
  const suffix = `${label}-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const business = await owner.business.create({
    data: {
      name: `Business ${suffix}`,
      slug: `business-${suffix}`,
      status: "active",
      publishedAt: new Date(),
    },
  });

  const otherBusiness = await owner.business.create({
    data: {
      name: `Other ${suffix}`,
      slug: `other-${suffix}`,
      status: "active",
      publishedAt: new Date(),
    },
  });

  const location = await owner.location.create({
    data: {
      businessId: business.id,
      name: "Sede principal",
      slug: `sede-${suffix}`,
      addressLine1: "Calle Falsa 123",
      city: "Madrid",
      postalCode: "28001",
      countryCode: "ES",
      isDefault: true,
      active: true,
    },
  });

  const professional = await owner.professional.create({
    data: {
      businessId: business.id,
      displayName: `Pro ${suffix}`,
      active: true,
    },
  });

  const service = await owner.service.create({
    data: {
      businessId: business.id,
      name: `Corte ${suffix}`,
      durationMinutes: 30,
      bufferAfterMinutes: 5,
      priceCents: 1500,
      currency: "EUR",
      active: true,
      onlineBookable: true,
    },
  });

  await owner.professionalLocation.create({
    data: {
      businessId: business.id,
      professionalId: professional.id,
      locationId: location.id,
      isPrimary: true,
      active: true,
    },
  });

  await owner.serviceLocation.create({
    data: {
      businessId: business.id,
      serviceId: service.id,
      locationId: location.id,
      active: true,
    },
  });

  const resourceType = await owner.resourceType.create({
    data: {
      businessId: business.id,
      key: `sillon-${suffix}`,
      name: "Sillón",
      active: true,
    },
  });

  const resource = await owner.resource.create({
    data: {
      businessId: business.id,
      locationId: location.id,
      resourceTypeId: resourceType.id,
      name: "Sillón 1",
      code: `S1-${suffix}`,
      active: true,
    },
  });

  await owner.serviceResourceRequirement.create({
    data: {
      businessId: business.id,
      serviceId: service.id,
      locationId: location.id,
      resourceTypeId: resourceType.id,
      resourceId: resource.id,
      quantity: 1,
      required: true,
    },
  });

  const client = await owner.client.create({
    data: {
      businessId: business.id,
      firstName: "Cliente",
      lastName: "Demo",
      phoneE164: `+346${String(Date.now()).slice(-8)}`,
      emailNormalized: `cliente-${suffix}@example.test`,
      email: `cliente-${suffix}@example.test`,
      privacyAcceptedAt: new Date(),
    },
  });

  await owner.client.create({
    data: {
      businessId: otherBusiness.id,
      firstName: "Cliente",
      lastName: "Otro",
      phoneE164: `+347${String(Date.now()).slice(-8)}`,
      emailNormalized: `otro-${suffix}@example.test`,
      email: `otro-${suffix}@example.test`,
      privacyAcceptedAt: new Date(),
    },
  });

  const user = await owner.user.create({
    data: {
      name: "Owner Test",
      email: `owner-${suffix}@example.test`,
      emailVerified: new Date(),
    },
  });

  await owner.membership.create({
    data: {
      businessId: business.id,
      userId: user.id,
      role: "owner",
      status: "active",
    },
  });

  return {
    businessId: business.id,
    otherBusinessId: otherBusiness.id,
    locationId: location.id,
    serviceId: service.id,
    professionalId: professional.id,
    clientId: client.id,
    resourceTypeId: resourceType.id,
    resourceId: resource.id,
    userId: user.id,
  };
}

export async function cleanupFixture(fixture: Fixture) {
  await owner.resourceReservation.deleteMany({
    where: { businessId: fixture.businessId },
  });
  await owner.appointment.deleteMany({
    where: { businessId: fixture.businessId },
  });
  await owner.resourceBlock.deleteMany({
    where: { businessId: fixture.businessId },
  });
  await owner.serviceResourceRequirement.deleteMany({
    where: { businessId: fixture.businessId },
  });
  await owner.resource.deleteMany({
    where: { businessId: fixture.businessId },
  });
  await owner.resourceType.deleteMany({
    where: { businessId: fixture.businessId },
  });
  await owner.membership.deleteMany({
    where: { businessId: fixture.businessId },
  });
  await owner.client.deleteMany({
    where: { businessId: fixture.businessId },
  });
  await owner.professionalLocation.deleteMany({
    where: { businessId: fixture.businessId },
  });
  await owner.professional.deleteMany({
    where: { businessId: fixture.businessId },
  });
  await owner.serviceLocation.deleteMany({
    where: { businessId: fixture.businessId },
  });
  await owner.service.deleteMany({
    where: { businessId: fixture.businessId },
  });
  await owner.location.deleteMany({
    where: { businessId: fixture.businessId },
  });
  await owner.business.deleteMany({
    where: { id: { in: [fixture.businessId, fixture.otherBusinessId] } },
  });
  await owner.user.deleteMany({
    where: { id: fixture.userId },
  });
}

export function dateAt(hour: number, minute = 0, dayOffset = 1) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + dayOffset);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}
