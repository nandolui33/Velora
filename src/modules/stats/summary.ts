import type { Prisma } from "@prisma/client";
import { dayRange } from "@/modules/scheduling/data";
import { addLocalDays, localDateKey } from "@/modules/scheduling/time";

type Tx = Prisma.TransactionClient;

export type DashboardStats = {
  todayCount: number;
  weekCount: number;
  upcomingCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  newClients: number;
  estimatedCents: number;
  collectedCents: number;
  topServices: { name: string; count: number }[];
  periodDays: number;
};

function keyFromParts(parts: { year: number; month: number; day: number }) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/**
 * Métricas del panel para los últimos `days` días, con el día y la semana
 * actuales calculados en la zona horaria del negocio.
 */
export async function getDashboardStats(
  tx: Tx,
  input: { businessId: string; timezone: string; now?: Date; days?: number },
): Promise<DashboardStats> {
  const now = input.now ?? new Date();
  const timezone = input.timezone;
  const days = Math.min(Math.max(input.days ?? 30, 7), 92);

  const todayKey = localDateKey(now, timezone);
  const [year, month, day] = todayKey.split("-").map(Number);
  const todayRange = dayRange(timezone, todayKey, 1);

  const weekAnchor = new Date(Date.UTC(year, month - 1, day));
  const weekOffset = (weekAnchor.getUTCDay() + 6) % 7;
  weekAnchor.setUTCDate(weekAnchor.getUTCDate() - weekOffset);
  const weekRange = dayRange(timezone, weekAnchor.toISOString().slice(0, 10), 7);

  const periodStartKey = keyFromParts(addLocalDays({ year, month, day }, -(days - 1)));
  const periodRange = dayRange(timezone, periodStartKey, days);

  const [
    todayCount,
    weekCount,
    upcomingCount,
    statusCounts,
    newClients,
    revenue,
    topServicesRaw,
  ] = await Promise.all([
    tx.appointment.count({
      where: {
        businessId: input.businessId,
        status: { in: ["confirmed", "completed"] },
        startsAt: { gte: todayRange.from, lt: todayRange.to },
      },
    }),
    tx.appointment.count({
      where: {
        businessId: input.businessId,
        status: { in: ["confirmed", "completed"] },
        startsAt: { gte: weekRange.from, lt: weekRange.to },
      },
    }),
    tx.appointment.count({
      where: {
        businessId: input.businessId,
        status: "confirmed",
        startsAt: { gte: now },
      },
    }),
    tx.appointment.groupBy({
      by: ["status"],
      where: {
        businessId: input.businessId,
        startsAt: { gte: periodRange.from, lt: periodRange.to },
      },
      _count: { _all: true },
    }),
    tx.client.count({
      where: {
        businessId: input.businessId,
        deletedAt: null,
        createdAt: { gte: periodRange.from, lt: periodRange.to },
      },
    }),
    tx.appointment.aggregate({
      where: {
        businessId: input.businessId,
        status: "completed",
        startsAt: { gte: periodRange.from, lt: periodRange.to },
      },
      _sum: { priceCents: true, paidAmountCents: true },
    }),
    tx.appointment.groupBy({
      by: ["serviceName"],
      where: {
        businessId: input.businessId,
        status: "completed",
        startsAt: { gte: periodRange.from, lt: periodRange.to },
      },
      _count: { serviceName: true },
      orderBy: { _count: { serviceName: "desc" } },
      take: 5,
    }),
  ]);

  const byStatus = new Map(statusCounts.map((row) => [row.status, row._count._all]));

  return {
    todayCount,
    weekCount,
    upcomingCount,
    completedCount: byStatus.get("completed") ?? 0,
    cancelledCount: byStatus.get("cancelled") ?? 0,
    noShowCount: byStatus.get("no_show") ?? 0,
    newClients,
    estimatedCents: revenue._sum.priceCents ?? 0,
    collectedCents: revenue._sum.paidAmountCents ?? 0,
    topServices: topServicesRaw.map((row) => ({
      name: row.serviceName,
      count: row._count.serviceName,
    })),
    periodDays: days,
  };
}
