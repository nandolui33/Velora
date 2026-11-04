import { withPlatform } from "@/lib/tenant";

export default async function PlatformPlansPage() {
  const plans = await withPlatform((tx) =>
    tx.plan.findMany({ orderBy: { sortOrder: "asc" } }),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-400">
          Plataforma
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Planes
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Catálogo de planes y límites. La edición visual de límites llega en
          una fase posterior; el alta manual ya permite asignar plan.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
                <p className="mt-1 text-xs text-zinc-500">{plan.code}</p>
              </div>
              <p className="text-xl font-semibold text-white">
                {(plan.priceCents / 100).toFixed(0)} €
              </p>
            </div>
            <p className="mt-3 text-sm text-zinc-400">{plan.description}</p>
            <dl className="mt-5 space-y-2 text-xs text-zinc-300">
              <div className="flex justify-between gap-3">
                <dt>Profesionales</dt>
                <dd>{plan.maxProfessionals ?? "Ilimitados"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Sedes</dt>
                <dd>{plan.maxLocations}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Emails/mes</dt>
                <dd>{plan.monthlyEmailQuota}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Prueba</dt>
                <dd>{plan.trialDays} días</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
