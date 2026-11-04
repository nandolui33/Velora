import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { owner } from "./helpers";
import {
  app,
  cleanupFixture,
  createFixture,
  dateAt,
  withTenantApp,
  type Fixture,
} from "./helpers";

function appointmentData(
  fixture: Fixture,
  professionalId: string,
  startsAt: Date,
) {
  return {
    businessId: fixture.businessId,
    locationId: fixture.locationId,
    professionalId,
    serviceId: fixture.serviceId,
    clientId: fixture.clientId,
    startsAt,
    serviceEndsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
    blockedUntil: new Date(startsAt.getTime() + 35 * 60 * 1000),
    priceCents: 1500,
    currency: "EUR",
  };
}

describe("concurrencia de agenda y recursos", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture("concurrency");
  });

  afterEach(async () => {
    await owner.resourceReservation.deleteMany({
      where: { businessId: fixture.businessId },
    });
    await owner.appointment.deleteMany({
      where: { businessId: fixture.businessId },
    });
    await owner.resourceBlock.deleteMany({
      where: { businessId: fixture.businessId },
    });
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
    await app.$disconnect();
  });

  it("solo una de 20 citas concurrentes ocupa el mismo profesional", async () => {
    const startsAt = dateAt(10);

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        withTenantApp(fixture.businessId, (tx) =>
          tx.appointment.create({
            data: appointmentData(
              fixture,
              fixture.professionalId,
              startsAt,
            ),
          }),
        ),
      ),
    );

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(19);
  });

  it("solo una de 20 citas concurrentes ocupa la misma cabina con profesionales distintos", async () => {
    const startsAt = dateAt(12);
    const professionals = [];

    for (let i = 0; i < 20; i += 1) {
      professionals.push(
        await owner.professional.create({
          data: {
            businessId: fixture.businessId,
            displayName: `Concurrent Pro ${i}`,
            active: true,
          },
        }),
      );
    }

    const results = await Promise.allSettled(
      professionals.map((professional) =>
        withTenantApp(fixture.businessId, async (tx) => {
          const appointment = await tx.appointment.create({
            data: appointmentData(fixture, professional.id, startsAt),
          });

          return tx.resourceReservation.create({
            data: {
              businessId: fixture.businessId,
              locationId: fixture.locationId,
              resourceId: fixture.resourceId,
              appointmentId: appointment.id,
              startsAt,
              endsAt: new Date(startsAt.getTime() + 35 * 60 * 1000),
            },
          });
        }),
      ),
    );

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(19);

    const reservations = await owner.resourceReservation.count({
      where: {
        businessId: fixture.businessId,
        resourceId: fixture.resourceId,
      },
    });
    expect(reservations).toBe(1);
  });

  it("un bloqueo de recurso y una reserva simultánea no pueden solaparse", async () => {
    const startsAt = dateAt(16);
    const endsAt = new Date(startsAt.getTime() + 35 * 60 * 1000);

    const blockAttempt = withTenantApp(fixture.businessId, async (tx) => {
      const block = await tx.resourceBlock.create({
        data: {
          businessId: fixture.businessId,
          locationId: fixture.locationId,
          resourceId: fixture.resourceId,
          startsAt,
          endsAt,
          reason: "Limpieza",
        },
      });

      return tx.resourceReservation.create({
        data: {
          businessId: fixture.businessId,
          locationId: fixture.locationId,
          resourceId: fixture.resourceId,
          blockId: block.id,
          startsAt,
          endsAt,
        },
      });
    });

    const bookingAttempt = withTenantApp(fixture.businessId, async (tx) => {
      const appointment = await tx.appointment.create({
        data: appointmentData(fixture, fixture.professionalId, startsAt),
      });

      return tx.resourceReservation.create({
        data: {
          businessId: fixture.businessId,
          locationId: fixture.locationId,
          resourceId: fixture.resourceId,
          appointmentId: appointment.id,
          startsAt,
          endsAt,
        },
      });
    });

    const results = await Promise.allSettled([blockAttempt, bookingAttempt]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");

    expect(fulfilled).toHaveLength(1);
  });
});
