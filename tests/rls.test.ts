import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  app,
  cleanupFixture,
  createFixture,
  withTenantApp,
  withUserApp,
  type Fixture,
} from "./helpers";

describe("RLS y aislamiento por empresa", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture("rls");
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
    await app.$disconnect();
  });

  it("sin contexto de empresa no devuelve clientes", async () => {
    const clients = await app.client.findMany();
    expect(clients).toHaveLength(0);
  });

  it("con contexto de A solo devuelve clientes de A", async () => {
    const clients = await withTenantApp(fixture.businessId, (tx) =>
      tx.client.findMany({
        where: { businessId: fixture.businessId },
      }),
    );

    expect(clients).toHaveLength(1);
    expect(clients[0]?.businessId).toBe(fixture.businessId);
  });

  it("no permite insertar un cliente de otra empresa con contexto de A", async () => {
    await expect(
      withTenantApp(fixture.businessId, (tx) =>
        tx.client.create({
          data: {
            businessId: fixture.otherBusinessId,
            firstName: "Intruso",
            phoneE164: "+34999999999",
            emailNormalized: "intruso@example.test",
            email: "intruso@example.test",
          },
        }),
      ),
    ).rejects.toBeTruthy();
  });

  it("un usuario solo ve sus membresías", async () => {
    const memberships = await withUserApp(fixture.userId, (tx) =>
      tx.membership.findMany(),
    );

    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.businessId).toBe(fixture.businessId);
  });

  it("la empresa solo es visible con contexto de tenant", async () => {
    const visible = await withTenantApp(fixture.businessId, (tx) =>
      tx.business.findUnique({ where: { id: fixture.businessId } }),
    );
    const hidden = await app.business.findUnique({
      where: { id: fixture.businessId },
    });

    expect(visible?.id).toBe(fixture.businessId);
    expect(hidden).toBeNull();
  });
});
