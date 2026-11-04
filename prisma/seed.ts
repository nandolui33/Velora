import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL,
});

const ids = {
  locationA: "10000000-0000-4000-8000-000000000001",
  locationB: "10000000-0000-4000-8000-000000000002",
  professionalA: "20000000-0000-4000-8000-000000000001",
  professionalB: "20000000-0000-4000-8000-000000000002",
  serviceA: "30000000-0000-4000-8000-000000000001",
  serviceB: "30000000-0000-4000-8000-000000000002",
  resourceTypeA: "40000000-0000-4000-8000-000000000001",
  resourceTypeB: "40000000-0000-4000-8000-000000000002",
  resourceA: "50000000-0000-4000-8000-000000000001",
  resourceB: "50000000-0000-4000-8000-000000000002",
  clientA: "60000000-0000-4000-8000-000000000001",
  clientB: "60000000-0000-4000-8000-000000000002",
} as const;

async function main() {
  const solo = await prisma.plan.upsert({
    where: { code: "solo" },
    update: {},
    create: {
      code: "solo",
      name: "Solo",
      description: "Para autónomos y una silla.",
      priceCents: 1900,
      interval: "month",
      trialDays: 14,
      maxProfessionals: 1,
      maxLocations: 1,
      monthlyEmailQuota: 1000,
      features: {
        onlineBooking: true,
        serviceVariants: true,
        teamLogins: true,
        statsBasic: true,
        clientExport: true,
        emailReminders: true,
      },
      sortOrder: 1,
    },
  });

  await prisma.plan.upsert({
    where: { code: "salon" },
    update: {},
    create: {
      code: "salon",
      name: "Salón",
      description: "Para peluquerías y barberías pequeñas.",
      priceCents: 3400,
      interval: "month",
      trialDays: 14,
      maxProfessionals: 5,
      maxLocations: 1,
      monthlyEmailQuota: 3000,
      features: {
        onlineBooking: true,
        serviceVariants: true,
        teamLogins: true,
        statsBasic: true,
        clientExport: true,
        emailReminders: true,
      },
      sortOrder: 2,
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@example.test" },
    update: {},
    create: {
      name: "Propietaria Demo",
      email: "owner@example.test",
      emailVerified: new Date(),
      isSuperadmin: false,
    },
  });

  await prisma.user.upsert({
    where: { email: "superadmin@example.test" },
    update: {},
    create: {
      name: "Superadmin Demo",
      email: "superadmin@example.test",
      emailVerified: new Date(),
      isSuperadmin: true,
    },
  });

  const businessA = await prisma.business.upsert({
    where: { slug: "alcazar-peluqueros" },
    update: { name: "Alcázar Peluqueros" },
    create: {
      name: "Alcázar Peluqueros",
      slug: "alcazar-peluqueros",
      status: "active",
      publishedAt: new Date(),
      description: "Peluquería de barrio con trato cercano.",
      tagline: "Tu pelo, en buenas manos.",
      primaryColor: "#7c3aed",
      themePreset: "clean",
      timezone: "Europe/Madrid",
      currency: "EUR",
    },
  });

  const locationA = await prisma.location.upsert({
    where: {
      businessId_slug: { businessId: businessA.id, slug: "mostoles" },
    },
    update: {},
    create: {
      id: ids.locationA,
      businessId: businessA.id,
      name: "Alcázar Peluqueros — Móstoles",
      slug: "mostoles",
      addressLine1: "Avenida Carlos V 26",
      city: "Móstoles",
      province: "Madrid",
      postalCode: "28936",
      countryCode: "ES",
      isDefault: true,
      active: true,
    },
  });

  const professionalA = await prisma.professional.upsert({
    where: { id: ids.professionalA },
    update: {},
    create: {
      id: ids.professionalA,
      businessId: businessA.id,
      displayName: "Ana",
      title: "Peluquera",
      color: "#7c3aed",
      active: true,
    },
  });

  await prisma.professionalLocation.upsert({
    where: {
      businessId_professionalId_locationId: {
        businessId: businessA.id,
        professionalId: professionalA.id,
        locationId: locationA.id,
      },
    },
    update: {},
    create: {
      businessId: businessA.id,
      professionalId: professionalA.id,
      locationId: locationA.id,
      isPrimary: true,
      active: true,
    },
  });

  const serviceA = await prisma.service.upsert({
    where: { id: ids.serviceA },
    update: {},
    create: {
      id: ids.serviceA,
      businessId: businessA.id,
      name: "Corte y peinado",
      description: "Corte personalizado y peinado.",
      durationMinutes: 45,
      bufferAfterMinutes: 10,
      priceCents: 2500,
      currency: "EUR",
      active: true,
      onlineBookable: true,
    },
  });

  await prisma.serviceLocation.upsert({
    where: {
      businessId_serviceId_locationId: {
        businessId: businessA.id,
        serviceId: serviceA.id,
        locationId: locationA.id,
      },
    },
    update: {},
    create: {
      businessId: businessA.id,
      serviceId: serviceA.id,
      locationId: locationA.id,
      active: true,
    },
  });

  const resourceTypeA = await prisma.resourceType.upsert({
    where: {
      businessId_key: { businessId: businessA.id, key: "sillon" },
    },
    update: {},
    create: {
      id: ids.resourceTypeA,
      businessId: businessA.id,
      key: "sillon",
      name: "Sillón de peluquería",
      active: true,
    },
  });

  const resourceA = await prisma.resource.upsert({
    where: { id: ids.resourceA },
    update: {},
    create: {
      id: ids.resourceA,
      businessId: businessA.id,
      locationId: locationA.id,
      resourceTypeId: resourceTypeA.id,
      name: "Sillón 1",
      code: "S1",
      active: true,
    },
  });

  await prisma.serviceResourceRequirement.upsert({
    where: {
      businessId_serviceId_locationId_resourceTypeId_resourceId: {
        businessId: businessA.id,
        serviceId: serviceA.id,
        locationId: locationA.id,
        resourceTypeId: resourceTypeA.id,
        resourceId: resourceA.id,
      },
    },
    update: {},
    create: {
      businessId: businessA.id,
      serviceId: serviceA.id,
      locationId: locationA.id,
      resourceTypeId: resourceTypeA.id,
      resourceId: resourceA.id,
      quantity: 1,
      required: true,
    },
  });

  await prisma.client.upsert({
    where: { id: ids.clientA },
    update: {},
    create: {
      id: ids.clientA,
      businessId: businessA.id,
      firstName: "Cliente",
      lastName: "Demo A",
      phoneE164: "+34600000001",
      emailNormalized: "cliente.a@example.test",
      email: "cliente.a@example.test",
      privacyAcceptedAt: new Date(),
    },
  });

  await prisma.membership.upsert({
    where: {
      businessId_userId: {
        businessId: businessA.id,
        userId: owner.id,
      },
    },
    update: {},
    create: {
      businessId: businessA.id,
      userId: owner.id,
      role: "owner",
      status: "active",
    },
  });

  await prisma.subscription.upsert({
    where: { businessId: businessA.id },
    update: {},
    create: {
      businessId: businessA.id,
      planId: solo.id,
      status: "trialing",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const businessB = await prisma.business.upsert({
    where: { slug: "barberia-norte" },
    update: { name: "Barbería Norte" },
    create: {
      name: "Barbería Norte",
      slug: "barberia-norte",
      status: "active",
      publishedAt: new Date(),
      description: "Barbería clásica.",
      tagline: "Estilo clásico, actitud moderna.",
      primaryColor: "#0f766e",
      themePreset: "bold",
      timezone: "Europe/Madrid",
      currency: "EUR",
    },
  });

  const locationB = await prisma.location.upsert({
    where: {
      businessId_slug: { businessId: businessB.id, slug: "centro" },
    },
    update: {},
    create: {
      id: ids.locationB,
      businessId: businessB.id,
      name: "Barbería Norte — Centro",
      slug: "centro",
      addressLine1: "Calle Mayor 10",
      city: "Madrid",
      province: "Madrid",
      postalCode: "28013",
      countryCode: "ES",
      isDefault: true,
      active: true,
    },
  });

  const professionalB = await prisma.professional.upsert({
    where: { id: ids.professionalB },
    update: {},
    create: {
      id: ids.professionalB,
      businessId: businessB.id,
      displayName: "Luis",
      title: "Barbero",
      color: "#0f766e",
      active: true,
    },
  });

  await prisma.professionalLocation.upsert({
    where: {
      businessId_professionalId_locationId: {
        businessId: businessB.id,
        professionalId: professionalB.id,
        locationId: locationB.id,
      },
    },
    update: {},
    create: {
      businessId: businessB.id,
      professionalId: professionalB.id,
      locationId: locationB.id,
      isPrimary: true,
      active: true,
    },
  });

  const serviceB = await prisma.service.upsert({
    where: { id: ids.serviceB },
    update: {},
    create: {
      id: ids.serviceB,
      businessId: businessB.id,
      name: "Corte caballero",
      durationMinutes: 30,
      bufferAfterMinutes: 5,
      priceCents: 1500,
      currency: "EUR",
      active: true,
      onlineBookable: true,
    },
  });

  await prisma.serviceLocation.upsert({
    where: {
      businessId_serviceId_locationId: {
        businessId: businessB.id,
        serviceId: serviceB.id,
        locationId: locationB.id,
      },
    },
    update: {},
    create: {
      businessId: businessB.id,
      serviceId: serviceB.id,
      locationId: locationB.id,
      active: true,
    },
  });

  const resourceTypeB = await prisma.resourceType.upsert({
    where: {
      businessId_key: { businessId: businessB.id, key: "sillon" },
    },
    update: {},
    create: {
      id: ids.resourceTypeB,
      businessId: businessB.id,
      key: "sillon",
      name: "Sillón de barbero",
      active: true,
    },
  });

  await prisma.resource.upsert({
    where: { id: ids.resourceB },
    update: {},
    create: {
      id: ids.resourceB,
      businessId: businessB.id,
      locationId: locationB.id,
      resourceTypeId: resourceTypeB.id,
      name: "Sillón 1",
      code: "S1",
      active: true,
    },
  });

  await prisma.client.upsert({
    where: { id: ids.clientB },
    update: {},
    create: {
      id: ids.clientB,
      businessId: businessB.id,
      firstName: "Cliente",
      lastName: "Demo B",
      phoneE164: "+34600000002",
      emailNormalized: "cliente.b@example.test",
      email: "cliente.b@example.test",
      privacyAcceptedAt: new Date(),
    },
  });

  await prisma.membership.upsert({
    where: {
      businessId_userId: {
        businessId: businessB.id,
        userId: owner.id,
      },
    },
    update: {},
    create: {
      businessId: businessB.id,
      userId: owner.id,
      role: "owner",
      status: "active",
    },
  });

  console.log("Seed completed:", {
    businesses: [businessA.slug, businessB.slug],
    owner: owner.email,
    plans: 2,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
