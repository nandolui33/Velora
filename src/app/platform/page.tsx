import Link from "next/link";
import { withPlatform } from "@/lib/tenant";

export default async function PlatformDashboardPage() {
  const data = await withPlatform(async (tx) => {
    const [businesses, active, trials, suspended, plans] = await Promise.all([
      tx.business.count(),
      tx.business.count({ where: { status: "active" } }),
      tx.subscription.count({ where: { status: "trialing" } }),
      tx.business.count({ where: { status: "suspended" } }),
      tx.plan.count({ where: { active: true } }),
    ]);

    const recent = await tx.business.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        subscriptions: { include: { plan: true } },
        memberships: {
          where: { role: "owner", status: "active" },
          include: { user: { select: { email: true } } },
        },
      },
    });

    return { businesses, active, trials, suspended, plans, recent };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-400">
          Resumen
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Estado de la plataforma
        </h1>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Empresas", data.businesses],
          ["Activas", data.active],
          ["En prueba", data.trials],
          ["Suspendidas", data.suspended],
          ["Planes", data.plans],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <p className="text-sm text-zinc-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Últimas empresas</h2>
          <Link
            href="/platform/empresas"
            className="text-xs font-medium text-violet-300 hover:text-violet-200"
          >
            Ver todas
          </Link>
        </div>
        <div className="divide-y divide-white/10">
          {data.recent.length === 0 ? (
            <p className="px-5 py-8 text-sm text-zinc-400">
              Todavía no hay empresas.
            </p>
          ) : (
            data.recent.map((business) => {
              const subscription = business.subscriptions[0];
              const owner = business.memberships[0]?.user.email;
              return (
                <Link
                  key={business.id}
                  href={`/platform/empresas/${business.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-white/5"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {business.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {business.slug} · {owner ?? "sin owner"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-zinc-300">
                      {subscription?.plan.name ?? "sin plan"}
                    </span>
                    <span className="text-zinc-500">
                      {business.status === "active" ? "Activa" : business.status}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
