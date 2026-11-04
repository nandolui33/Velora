import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";
import { runRetention } from "@/modules/retention/cleanup";
import { owner, app, cleanupFixture, createFixture, type Fixture } from "./helpers";

describe("hardening: límites y retención", () => {
  it("limita peticiones por ventana fija y se reinicia al pasar la ventana", () => {
    resetRateLimits();
    const start = 1_000_000;

    const first = checkRateLimit("ip-1", { limit: 3, windowMs: 60_000, now: start });
    checkRateLimit("ip-1", { limit: 3, windowMs: 60_000, now: start + 1 });
    checkRateLimit("ip-1", { limit: 3, windowMs: 60_000, now: start + 2 });
    const fourth = checkRateLimit("ip-1", { limit: 3, windowMs: 60_000, now: start + 3 });

    expect(first.ok).toBe(true);
    expect(first.remaining).toBe(2);
    expect(fourth.ok).toBe(false);
    expect(fourth.remaining).toBe(0);

    const otherKey = checkRateLimit("ip-2", { limit: 3, windowMs: 60_000, now: start + 4 });
    expect(otherKey.ok).toBe(true);

    const afterWindow = checkRateLimit("ip-1", {
      limit: 3,
      windowMs: 60_000,
      now: start + 60_001,
    });
    expect(afterWindow.ok).toBe(true);
  });

  describe("retención", () => {
    let fixture: Fixture;

    beforeAll(async () => {
      fixture = await createFixture("retention");
    });

    afterAll(async () => {
      await cleanupFixture(fixture);
      await app.$disconnect();
    });

    it("anonimiza clientes inactivos y purga claves caducadas", async () => {
      const now = new Date();
      const old = new Date(now);
      old.setFullYear(old.getFullYear() - 3);

      const stale = await owner.client.create({
        data: {
          businessId: fixture.businessId,
          firstName: "Antiguo",
          email: `stale-${randomUUID().slice(0, 8)}@example.test`,
          emailNormalized: `stale-${randomUUID().slice(0, 8)}@example.test`,
          createdAt: old,
        },
      });

      const recent = await owner.client.create({
        data: {
          businessId: fixture.businessId,
          firstName: "Reciente",
          email: `recent-${randomUUID().slice(0, 8)}@example.test`,
          emailNormalized: `recent-${randomUUID().slice(0, 8)}@example.test`,
        },
      });

      await owner.idempotencyKey.create({
        data: {
          businessId: fixture.businessId,
          key: `expired-${randomUUID()}`,
          requestHash: "hash",
          responseStatus: 201,
          responseJson: {},
          expiresAt: new Date(now.getTime() - 60_000),
        },
      });

      const result = await runRetention({ now, inactiveMonths: 24 });

      expect(result.anonymizedClients).toBeGreaterThanOrEqual(1);
      expect(result.purgedIdempotencyKeys).toBeGreaterThanOrEqual(1);

      const staleAfter = await owner.client.findUniqueOrThrow({ where: { id: stale.id } });
      expect(staleAfter.anonymizedAt).not.toBeNull();
      expect(staleAfter.email).toBeNull();
      expect(staleAfter.firstName).toBe("Cliente");

      const recentAfter = await owner.client.findUniqueOrThrow({ where: { id: recent.id } });
      expect(recentAfter.anonymizedAt).toBeNull();
      expect(recentAfter.email).not.toBeNull();
    });
  });
});
