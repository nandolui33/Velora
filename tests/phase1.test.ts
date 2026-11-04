import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashOpaqueToken, generateOpaqueToken } from "@/lib/tokens";
import {
  cleanupFixture,
  createFixture,
  owner,
  withPlatformApp,
  withTenantApp,
  type Fixture,
} from "./helpers";

describe("Fase 1: invitaciones, RLS y auditoría", () => {
  let fixture: Fixture;
  let rawToken: string;
  let platformBusinessId: string | null = null;

  beforeAll(async () => {
    fixture = await createFixture("phase1");
    rawToken = generateOpaqueToken();

    await owner.invitation.create({
      data: {
        businessId: fixture.businessId,
        emailNormalized: `invited-${randomUUID().slice(0, 8)}@example.test`,
        role: "owner",
        tokenHash: hashOpaqueToken(rawToken),
        invitedBy: fixture.userId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await withTenantApp(fixture.businessId, async (tx) => {
      await tx.businessHours.create({
        data: {
          businessId: fixture.businessId,
          locationId: fixture.locationId,
          weekday: 1,
          opensAt: "09:00",
          closesAt: "18:00",
        },
      });

      await tx.auditLog.create({
        data: {
          businessId: fixture.businessId,
          actorUserId: fixture.userId,
          actorType: "user",
          action: "test.created",
          entityType: "test",
          entityId: fixture.businessId,
        },
      });
    });
  });

  afterAll(async () => {
    if (platformBusinessId) {
      await owner.business.delete({ where: { id: platformBusinessId } });
    }
    await cleanupFixture(fixture);
  });

  it("resuelve una invitación por token sin contexto de tenant", async () => {
    const rows = await withPlatformApp((tx) =>
      tx.$queryRaw<
        { business_name: string; email_normalized: string }[]
      >`SELECT business_name, email_normalized FROM get_invitation_by_token(${hashOpaqueToken(rawToken)})`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].business_name).toContain("Business phase1");
    expect(rows[0].email_normalized).toContain("invited-");
  });

  it("no devuelve invitaciones con un token incorrecto", async () => {
    const rows = await withPlatformApp((tx) =>
      tx.$queryRaw<
        { business_name: string }[]
      >`SELECT business_name FROM get_invitation_by_token(${hashOpaqueToken("wrong-token")})`,
    );

    expect(rows).toHaveLength(0);
  });

  it("aísla invitaciones, horarios y auditoría por empresa", async () => {
    const invitationCount = await withTenantApp(
      fixture.businessId,
      (tx) => tx.invitation.count(),
    );
    const otherInvitationCount = await withTenantApp(
      fixture.otherBusinessId,
      (tx) => tx.invitation.count(),
    );
    const hoursCount = await withTenantApp(
      fixture.businessId,
      (tx) => tx.businessHours.count(),
    );
    const otherHoursCount = await withTenantApp(
      fixture.otherBusinessId,
      (tx) => tx.businessHours.count(),
    );
    const auditCount = await withTenantApp(
      fixture.businessId,
      (tx) => tx.auditLog.count(),
    );
    const otherAuditCount = await withTenantApp(
      fixture.otherBusinessId,
      (tx) => tx.auditLog.count(),
    );

    expect(invitationCount).toBe(1);
    expect(otherInvitationCount).toBe(0);
    expect(hoursCount).toBe(1);
    expect(otherHoursCount).toBe(0);
    expect(auditCount).toBe(1);
    expect(otherAuditCount).toBe(0);
  });

  it("permite a plataforma crear una empresa y registrar auditoría", async () => {
    platformBusinessId = await withPlatformApp(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: "Platform Test",
          slug: `platform-test-${randomUUID().slice(0, 8)}`,
          status: "active",
        },
      });

      await tx.auditLog.create({
        data: {
          businessId: business.id,
          actorType: "superadmin",
          action: "business.created",
          entityType: "business",
          entityId: business.id,
        },
      });

      return business.id;
    });

    const visible = await withTenantApp(platformBusinessId, (tx) =>
      tx.auditLog.count(),
    );
    expect(visible).toBe(1);
  });
});
