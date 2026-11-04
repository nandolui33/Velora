import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  app,
  cleanupFixture,
  createFixture,
  owner,
  withTenantApp,
  type Fixture,
} from "./helpers";

type PublicBusiness = {
  name: string;
  services: { name: string }[];
  professionals: { name: string }[];
  hours: { weekday: number }[];
};

describe("Fase 2: catálogo, equipo y lectura pública", () => {
  let fixture: Fixture;
  let draftBusinessId: string | null = null;

  beforeAll(async () => {
    fixture = await createFixture("phase2");

    await withTenantApp(fixture.businessId, async (tx) => {
      const category = await tx.serviceCategory.create({
        data: {
          businessId: fixture.businessId,
          name: "Cortes",
          slug: `cortes-${randomUUID().slice(0, 8)}`,
        },
      });

      await tx.service.update({
        where: { id: fixture.serviceId },
        data: { categoryId: category.id },
      });

      await tx.professionalService.create({
        data: {
          businessId: fixture.businessId,
          professionalId: fixture.professionalId,
          serviceId: fixture.serviceId,
        },
      });

      await tx.professionalSchedule.create({
        data: {
          businessId: fixture.businessId,
          professionalId: fixture.professionalId,
          locationId: fixture.locationId,
          weekday: 1,
          opensAt: "09:00",
          closesAt: "18:00",
        },
      });

      await tx.professionalTimeOff.create({
        data: {
          businessId: fixture.businessId,
          professionalId: fixture.professionalId,
          startsAt: new Date(Date.now() + 86_400_000),
          endsAt: new Date(Date.now() + 172_800_000),
          reason: "Test",
        },
      });

      await tx.businessHours.create({
        data: {
          businessId: fixture.businessId,
          locationId: fixture.locationId,
          weekday: 1,
          opensAt: "09:00",
          closesAt: "18:00",
        },
      });
    });

    draftBusinessId = (
      await owner.business.create({
        data: {
          name: "Borrador",
          slug: `borrador-${randomUUID().slice(0, 8)}`,
          status: "active",
          publishedAt: null,
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (draftBusinessId) {
      await owner.business.delete({ where: { id: draftBusinessId } });
    }
    await cleanupFixture(fixture);
  });

  it("devuelve el negocio publicado con servicios, equipo y horario", async () => {
    const slug = (
      await owner.business.findUniqueOrThrow({
        where: { id: fixture.businessId },
        select: { slug: true },
      })
    ).slug;

    const rows = await app.$queryRaw<{ data: PublicBusiness }[]>`
      SELECT get_public_business(${slug}) AS data
    `;
    const data = rows[0]?.data;

    expect(data).not.toBeNull();
    expect(data.name).toContain("Business phase2");
    expect(
      data.services.some((service) => service.name.startsWith("Corte phase2")),
    ).toBe(true);
    expect(
      data.professionals.some((professional) =>
        professional.name.startsWith("Pro phase2"),
      ),
    ).toBe(true);
    expect(data.hours.some((hour) => hour.weekday === 1)).toBe(true);
  });

  it("no devuelve un negocio en borrador", async () => {
    const draft = await owner.business.findUniqueOrThrow({
      where: { id: draftBusinessId! },
      select: { slug: true },
    });
    const rows = await app.$queryRaw<{ data: unknown }[]>`
      SELECT get_public_business(${draft.slug}) AS data
    `;

    expect(rows[0]?.data).toBeNull();
  });

  it("aísla las nuevas tablas de catálogo y equipo por empresa", async () => {
    const categories = await withTenantApp(fixture.businessId, (tx) =>
      tx.serviceCategory.count(),
    );
    const otherCategories = await withTenantApp(fixture.otherBusinessId, (tx) =>
      tx.serviceCategory.count(),
    );
    const schedules = await withTenantApp(fixture.businessId, (tx) =>
      tx.professionalSchedule.count(),
    );
    const otherSchedules = await withTenantApp(fixture.otherBusinessId, (tx) =>
      tx.professionalSchedule.count(),
    );

    expect(categories).toBe(1);
    expect(otherCategories).toBe(0);
    expect(schedules).toBe(1);
    expect(otherSchedules).toBe(0);
  });
});
