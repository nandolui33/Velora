import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { owner, app, cleanupFixture, createFixture, dateAt, withTenantApp, type Fixture } from "./helpers";
import { exportClients } from "@/modules/clients/export";
import { anonymizeClient, mergeClients, recordConsent, updateClientContact } from "@/modules/clients/mutations";
import { listClients } from "@/modules/clients/queries";
import { assertCanAddProfessional, getEffectivePlan, PlanLimitError } from "@/modules/plans/limits";
import { getDashboardStats } from "@/modules/stats/summary";

const TZ = "Europe/Madrid";
let slotIndex = 0;

async function createClientWithAppointment(
  fixture: Fixture,
  input: {
    email: string;
    phone: string;
    status?: "confirmed" | "completed" | "cancelled";
    priceCents?: number;
    paidAmountCents?: number;
    startsAt?: Date;
  },
) {
  const client = await owner.client.create({
    data: {
      businessId: fixture.businessId,
      firstName: "Cliente",
      lastName: `Prueba ${randomUUID().slice(0, 4)}`,
      email: input.email,
      emailNormalized: input.email.toLowerCase(),
      phoneE164: input.phone,
      privacyAcceptedAt: new Date(),
    },
  });

  slotIndex += 1;
  const startsAt = input.startsAt ?? new Date(dateAt(9).getTime() + slotIndex * 45 * 60_000);
  const appointment = await owner.appointment.create({
    data: {
      businessId: fixture.businessId,
      locationId: fixture.locationId,
      professionalId: fixture.professionalId,
      serviceId: fixture.serviceId,
      clientId: client.id,
      serviceName: "Corte y peinado",
      professionalName: "Ana",
      durationMinutes: 30,
      bufferAfterMinutes: 5,
      bookingReference: randomUUID().slice(0, 6).toUpperCase(),
      publicTokenHash: randomUUID().replaceAll("-", ""),
      startsAt,
      serviceEndsAt: new Date(startsAt.getTime() + 30 * 60_000),
      blockedUntil: new Date(startsAt.getTime() + 35 * 60_000),
      status: input.status ?? "completed",
      source: "admin",
      priceCents: input.priceCents ?? 1500,
      currency: "EUR",
      paidAmountCents: input.paidAmountCents ?? 0,
    },
  });

  return { client, appointment };
}

describe("fase 4: clientes, métricas y planes", () => {
  let fixture: Fixture;
  let planCode: string;

  beforeAll(async () => {
    fixture = await createFixture("phase4");
    planCode = `test-${randomUUID().slice(0, 6)}`;
  });

  afterAll(async () => {
    await owner.consentRecord.deleteMany({ where: { businessId: fixture.businessId } });
    await owner.subscription.deleteMany({ where: { businessId: fixture.businessId } });
    await owner.plan.deleteMany({ where: { code: planCode } });
    await cleanupFixture(fixture);
    await app.$disconnect();
  });

  it("la base impide dos fichas con el mismo email o teléfono", async () => {
    const email = `dup-${randomUUID().slice(0, 8)}@example.test`;
    await owner.client.create({
      data: {
        businessId: fixture.businessId,
        firstName: "Uno",
        emailNormalized: email,
        email,
      },
    });

    await expect(
      owner.client.create({
        data: {
          businessId: fixture.businessId,
          firstName: "Dos",
          emailNormalized: email,
          email,
        },
      }),
    ).rejects.toThrow();
  });

  it("busca por nombre, email o teléfono y pagina", async () => {
    const email = `busca-${randomUUID().slice(0, 8)}@example.test`;
    await createClientWithAppointment(fixture, { email, phone: "+34611111111" });

    const result = await withTenantApp(fixture.businessId, (tx) =>
      listClients(tx, { businessId: fixture.businessId, search: email.slice(0, 12) }),
    );

    expect(result.total).toBe(1);
    expect(result.items[0].email).toBe(email);

    const byPhone = await withTenantApp(fixture.businessId, (tx) =>
      listClients(tx, { businessId: fixture.businessId, search: "611111111" }),
    );

    expect(byPhone.total).toBeGreaterThanOrEqual(1);
  });

  it("rechaza un contacto que ya pertenece a otra ficha", async () => {
    const first = await createClientWithAppointment(fixture, {
      email: `dup-a-${randomUUID().slice(0, 8)}@example.test`,
      phone: "+34622222222",
    });
    const secondEmail = `dup-b-${randomUUID().slice(0, 8)}@example.test`;
    await createClientWithAppointment(fixture, {
      email: secondEmail,
      phone: "+34622999999",
    });

    await expect(
      withTenantApp(fixture.businessId, (tx) =>
        updateClientContact(tx, {
          businessId: fixture.businessId,
          clientId: first.client.id,
          actorUserId: fixture.userId,
          firstName: "Cliente",
          email: secondEmail,
          phone: "+34622222222",
        }),
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE_CONTACT" });

    const updated = await withTenantApp(fixture.businessId, (tx) =>
      updateClientContact(tx, {
        businessId: fixture.businessId,
        clientId: first.client.id,
        actorUserId: fixture.userId,
        firstName: "Cliente Actualizado",
        email: `dup-a-${randomUUID().slice(0, 4)}@example.test`,
        phone: "+34622222222",
      }),
    );

    expect(updated.firstName).toBe("Cliente Actualizado");
  });

  it("fusiona fichas: mueve citas y consentimientos y anonimiza el origen", async () => {
    const source = await createClientWithAppointment(fixture, {
      email: `merge-a-${randomUUID().slice(0, 8)}@example.test`,
      phone: "+34633333333",
    });
    const target = await createClientWithAppointment(fixture, {
      email: `merge-b-${randomUUID().slice(0, 8)}@example.test`,
      phone: "+34644444444",
    });

    const result = await withTenantApp(fixture.businessId, async (tx) => {
      await recordConsent(tx, {
        businessId: fixture.businessId,
        clientId: source.client.id,
        type: "marketing",
        granted: true,
        policyVersion: "1.0",
        source: "admin",
      });

      return mergeClients(tx, {
        businessId: fixture.businessId,
        sourceId: source.client.id,
        targetId: target.client.id,
        actorUserId: fixture.userId,
      });
    });

    expect(result.movedAppointments).toBe(1);

    const moved = await owner.appointment.findUniqueOrThrow({
      where: { id: source.appointment.id },
    });

    expect(moved.clientId).toBe(target.client.id);

    const sourceClient = await owner.client.findUniqueOrThrow({
      where: { id: source.client.id },
    });

    expect(sourceClient.anonymizedAt).not.toBeNull();
    expect(sourceClient.email).toBeNull();

    const consents = await owner.consentRecord.count({
      where: { clientId: target.client.id },
    });

    expect(consents).toBe(1);
  });

  it("anonimiza sin perder las métricas agregadas", async () => {
    const { client, appointment } = await createClientWithAppointment(fixture, {
      email: `anon-${randomUUID().slice(0, 8)}@example.test`,
      phone: "+34655555555",
      priceCents: 2000,
      paidAmountCents: 2000,
    });

    await withTenantApp(fixture.businessId, (tx) =>
      anonymizeClient(tx, {
        businessId: fixture.businessId,
        clientId: client.id,
        actorUserId: fixture.userId,
      }),
    );

    const anonymized = await owner.client.findUniqueOrThrow({
      where: { id: client.id },
    });

    expect(anonymized.firstName).toBe("Cliente");
    expect(anonymized.email).toBeNull();
    expect(anonymized.phoneE164).toBeNull();
    expect(anonymized.anonymizedAt).not.toBeNull();
    expect(anonymized.deletedAt).not.toBeNull();

    const appointmentAfter = await owner.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });

    expect(appointmentAfter.priceCents).toBe(2000);
    expect(appointmentAfter.clientId).toBe(client.id);
  });

  it("exporta solo los clientes de la empresa actual", async () => {
    const mine = `export-mine-${randomUUID().slice(0, 8)}@example.test`;
    const other = `export-other-${randomUUID().slice(0, 8)}@example.test`;

    await createClientWithAppointment(fixture, { email: mine, phone: "+34666666666" });
    await owner.client.create({
      data: {
        businessId: fixture.otherBusinessId,
        firstName: "Ajeno",
        emailNormalized: other,
        email: other,
      },
    });

    const csv = await withTenantApp(fixture.businessId, (tx) =>
      exportClients(tx, { businessId: fixture.businessId, format: "csv" }),
    );

    expect(csv.body).toContain("nombre,apellidos,email");
    expect(csv.body).toContain(mine);
    expect(csv.body).not.toContain(other);

    const json = await withTenantApp(fixture.businessId, (tx) =>
      exportClients(tx, { businessId: fixture.businessId, format: "json" }),
    );

    const parsed = JSON.parse(json.body) as { clients: { email: string }[] };
    expect(parsed.clients.some((row) => row.email === mine)).toBe(true);
    expect(parsed.clients.some((row) => row.email === other)).toBe(false);
  });

  it("calcula métricas del periodo con ingreso estimado y cobrado", async () => {
    const today = new Date();
    const startsAt = new Date(today);
    startsAt.setUTCHours(12, 0, 0, 0);

    await createClientWithAppointment(fixture, {
      email: `stats-${randomUUID().slice(0, 8)}@example.test`,
      phone: "+34677777777",
      status: "completed",
      priceCents: 3000,
      paidAmountCents: 1000,
      startsAt,
    });

    const stats = await withTenantApp(fixture.businessId, (tx) =>
      getDashboardStats(tx, {
        businessId: fixture.businessId,
        timezone: TZ,
        now: today,
      }),
    );

    expect(stats.completedCount).toBeGreaterThanOrEqual(1);
    expect(stats.estimatedCents).toBeGreaterThanOrEqual(3000);
    expect(stats.collectedCents).toBeGreaterThanOrEqual(1000);
    expect(stats.topServices[0]?.name).toBe("Corte y peinado");
  });

  it("aplica el límite del plan y permite overrides del superadministrador", async () => {
    const plan = await owner.plan.create({
      data: {
        code: planCode,
        name: "Plan test",
        priceCents: 0,
        currency: "EUR",
        features: { online_booking: true },
        maxProfessionals: 1,
        maxLocations: 1,
      },
    });

    await owner.subscription.create({
      data: {
        businessId: fixture.businessId,
        planId: plan.id,
        status: "active",
      },
    });

    const limits = await withTenantApp(fixture.businessId, (tx) =>
      getEffectivePlan(tx, fixture.businessId),
    );

    expect(limits.maxProfessionals).toBe(1);

    // La empresa ya tiene un profesional activo.
    await expect(
      withTenantApp(fixture.businessId, (tx) =>
        assertCanAddProfessional(tx, fixture.businessId),
      ),
    ).rejects.toBeInstanceOf(PlanLimitError);

    await owner.business.update({
      where: { id: fixture.businessId },
      data: { planOverrides: { maxProfessionals: 5 } },
    });

    const overridden = await withTenantApp(fixture.businessId, (tx) =>
      assertCanAddProfessional(tx, fixture.businessId),
    );

    expect(overridden.maxProfessionals).toBe(5);
  });
});
