import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { owner, app, cleanupFixture, createFixture, dateAt, type Fixture } from "./helpers";
import {
  BookingError,
  cancelBookingByToken,
  createBooking,
  getAppointmentByManageToken,
  rescheduleBooking,
} from "@/modules/scheduling/booking";
import { getAvailability } from "@/modules/scheduling/data";
import { withTenant } from "@/lib/tenant";

function client(email?: string) {
  return {
    firstName: "Ana",
    lastName: "García",
    phone: "+34600123456",
    email: email ?? `ana-${randomUUID().slice(0, 8)}@example.test`,
  };
}

function bookingInput(fixture: Fixture, startsAt: Date, email?: string) {
  return {
    businessId: fixture.businessId,
    locationId: fixture.locationId,
    serviceId: fixture.serviceId,
    professionalId: fixture.professionalId,
    startsAt,
    client: client(email),
    source: "online" as const,
  };
}

describe("reservas y agenda", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture("booking");

    await owner.business.update({
      where: { id: fixture.businessId },
      data: { email: "negocio@example.test", cancellationCutoffMinutes: 60 },
    });

    for (let weekday = 1; weekday <= 7; weekday += 1) {
      await owner.businessHours.create({
        data: {
          businessId: fixture.businessId,
          locationId: fixture.locationId,
          weekday,
          opensAt: "09:00",
          closesAt: "18:00",
          closed: false,
        },
      });

      await owner.professionalSchedule.create({
        data: {
          businessId: fixture.businessId,
          locationId: fixture.locationId,
          professionalId: fixture.professionalId,
          weekday,
          opensAt: "09:00",
          closesAt: "18:00",
          active: true,
        },
      });
    }
  });

  beforeEach(async () => {
    await owner.notificationOutbox.deleteMany({
      where: { businessId: fixture.businessId },
    });
    await owner.idempotencyKey.deleteMany({
      where: { businessId: fixture.businessId },
    });
    await owner.resourceReservation.deleteMany({
      where: { businessId: fixture.businessId },
    });
    await owner.appointment.deleteMany({
      where: { businessId: fixture.businessId },
    });
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
    await app.$disconnect();
  });

  it("crea la cita con snapshots, recursos y avisos encolados", async () => {
    const startsAt = dateAt(10);
    const result = await createBooking(bookingInput(fixture, startsAt));

    const appointment = await owner.appointment.findUniqueOrThrow({
      where: { id: result.appointmentId },
    });

    expect(appointment.serviceName).toContain("Corte");
    expect(appointment.professionalName).toContain("Pro");
    expect(appointment.durationMinutes).toBe(30);
    expect(appointment.bookingReference).toBe(result.bookingReference);
    expect(appointment.publicTokenHash).not.toBe(result.manageToken);

    const reservations = await owner.resourceReservation.findMany({
      where: { appointmentId: appointment.id },
    });

    expect(reservations).toHaveLength(1);
    expect(reservations[0].resourceId).toBe(fixture.resourceId);
    expect(reservations[0].releasedAt).toBeNull();

    const outbox = await owner.notificationOutbox.findMany({
      where: { appointmentId: appointment.id },
      orderBy: { template: "asc" },
    });

    const templates = outbox.map((row) => row.template);

    expect(templates).toContain("appointment_confirmed");
    expect(templates).toContain("appointment_notice_business");

    const confirmation = outbox.find((row) => row.template === "appointment_confirmed");
    const payload = confirmation?.payload as { manageUrl?: string };

    expect(payload.manageUrl).toContain("/cita/");
  });

  it("deja de ofrecer el hueco reservado", async () => {
    const startsAt = dateAt(10);
    await createBooking(bookingInput(fixture, startsAt));

    const days = await withTenant(
      { businessId: fixture.businessId, userId: "", role: "public" },
      (tx) =>
        getAvailability(tx, {
          businessId: fixture.businessId,
          locationId: fixture.locationId,
          serviceId: fixture.serviceId,
          from: new Date(startsAt.getTime() - 6 * 60 * 60 * 1000),
          to: new Date(startsAt.getTime() + 6 * 60 * 60 * 1000),
        }),
    );

    const starts = days.flatMap((day) => day.slots.map((slot) => slot.startsAt));

    expect(starts).not.toContain(startsAt.toISOString());
  });

  it("rechaza la segunda reserva del mismo hueco", async () => {
    const startsAt = dateAt(10);
    await createBooking(bookingInput(fixture, startsAt));

    await expect(createBooking(bookingInput(fixture, startsAt))).rejects.toMatchObject({
      code: "SLOT_TAKEN",
    });
  });

  it("20 reservas simultáneas al mismo hueco: 1 éxito y 19 SLOT_TAKEN", async () => {
    const startsAt = dateAt(12);

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => createBooking(bookingInput(fixture, startsAt))),
    );

    const fulfilled = results.filter((result) => result.status === "fulfilled");

    expect(fulfilled).toHaveLength(1);

    for (const result of results) {
      if (result.status === "rejected") {
        expect(result.reason).toBeInstanceOf(BookingError);
        expect((result.reason as BookingError).code).toBe("SLOT_TAKEN");
      }
    }

    const count = await owner.appointment.count({
      where: { businessId: fixture.businessId, startsAt },
    });

    expect(count).toBe(1);
  });

  it("la clave de idempotencia devuelve la misma reserva", async () => {
    const startsAt = dateAt(14);
    const key = `idem-${randomUUID()}`;
    const input = bookingInput(fixture, startsAt);

    const first = await createBooking({ ...input, idempotencyKey: key });
    const second = await createBooking({ ...input, idempotencyKey: key });

    expect(second.appointmentId).toBe(first.appointmentId);

    await expect(
      createBooking({
        ...input,
        client: client("otra@example.test"),
        idempotencyKey: key,
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("cancelar libera recursos y avisa al cliente y al negocio", async () => {
    const startsAt = dateAt(10);
    const result = await createBooking(bookingInput(fixture, startsAt));

    await cancelBookingByToken({ token: result.manageToken, reason: "No puedo" });

    const appointment = await owner.appointment.findUniqueOrThrow({
      where: { id: result.appointmentId },
    });

    expect(appointment.status).toBe("cancelled");
    expect(appointment.cancelledAt).not.toBeNull();
    expect(appointment.cancellationReason).toBe("No puedo");

    const reservations = await owner.resourceReservation.findMany({
      where: { appointmentId: appointment.id },
    });

    expect(reservations.every((row) => row.releasedAt !== null)).toBe(true);

    const pending = await owner.notificationOutbox.findMany({
      where: { appointmentId: appointment.id, status: "pending" },
    });

    // Solo quedan pendientes los avisos de cancelación; los anteriores se anulan.
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((row) => row.template.startsWith("appointment_cancelled"))).toBe(true);

    const cancelledEmails = await owner.notificationOutbox.findMany({
      where: {
        appointmentId: appointment.id,
        template: { in: ["appointment_cancelled_client", "appointment_cancelled_business"] },
      },
    });

    expect(cancelledEmails).toHaveLength(2);

    const view = await getAppointmentByManageToken(result.manageToken);
    expect(view?.status).toBe("cancelled");
    expect(view?.canCancel).toBe(false);
  });

  it("mover la cita libera la ocupación anterior y crea la nueva", async () => {
    const startsAt = dateAt(10);
    const result = await createBooking(bookingInput(fixture, startsAt));
    const newStartsAt = dateAt(14);

    await rescheduleBooking({
      businessId: fixture.businessId,
      appointmentId: result.appointmentId,
      startsAt: newStartsAt,
      actorUserId: fixture.userId,
    });

    const appointment = await owner.appointment.findUniqueOrThrow({
      where: { id: result.appointmentId },
    });

    expect(appointment.startsAt.getTime()).toBe(newStartsAt.getTime());

    const reservations = await owner.resourceReservation.findMany({
      where: { appointmentId: appointment.id },
    });

    const active = reservations.filter((row) => row.releasedAt === null);

    expect(active).toHaveLength(1);
    expect(active[0].startsAt.getTime()).toBe(newStartsAt.getTime());
    expect(reservations.length).toBeGreaterThan(active.length);
  });

  it("20 reservas simultáneas a la misma cabina: 1 éxito y conflictos de recurso", async () => {
    const startsAt = dateAt(14);
    const professionals: string[] = [];

    for (let index = 0; index < 20; index += 1) {
      const professional = await owner.professional.create({
        data: {
          businessId: fixture.businessId,
          displayName: `Cabina ${index}`,
          active: true,
        },
      });

      await owner.professionalLocation.create({
        data: {
          businessId: fixture.businessId,
          professionalId: professional.id,
          locationId: fixture.locationId,
          active: true,
        },
      });

      for (let weekday = 1; weekday <= 7; weekday += 1) {
        await owner.professionalSchedule.create({
          data: {
            businessId: fixture.businessId,
            locationId: fixture.locationId,
            professionalId: professional.id,
            weekday,
            opensAt: "09:00",
            closesAt: "18:00",
            active: true,
          },
        });
      }

      professionals.push(professional.id);
    }

    const results = await Promise.allSettled(
      professionals.map((professionalId) =>
        createBooking({
          ...bookingInput(fixture, startsAt),
          professionalId,
          client: client(),
        }),
      ),
    );

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(19);

    const codes = rejected.map((result) => (result.reason as BookingError).code);

    expect(
      codes.every((code) => code === "RESOURCE_TAKEN" || code === "SLOT_TAKEN"),
    ).toBe(true);
    expect(codes.filter((code) => code === "RESOURCE_TAKEN").length).toBeGreaterThan(0);

    const active = await owner.resourceReservation.count({
      where: {
        businessId: fixture.businessId,
        resourceId: fixture.resourceId,
        releasedAt: null,
      },
    });

    expect(active).toBe(1);
  });
});
