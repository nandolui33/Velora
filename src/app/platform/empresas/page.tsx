import Link from "next/link";
import { withPlatform } from "@/lib/tenant";
import { createBusinessAction } from "../actions";

type PageProps = {
  searchParams: Promise<{ error?: string; created?: string }>;
};

const errorMessages: Record<string, string> = {
  datos: "Revisa los datos. El slug, el email o los días de prueba no son válidos.",
  slug: "Ese slug ya está en uso. Prueba otro.",
  plan: "El plan seleccionado no existe.",
  crear: "No se pudo crear la empresa. Revisa los datos e inténtalo de nuevo.",
};

function statusLabel(status: string) {
  if (status === "active") return "Activa";
  if (status === "suspended") return "Suspendida";
  return "Desactivada";
}

export default async function PlatformBusinessesPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const data = await withPlatform(async (tx) => {
    const [businesses, plans] = await Promise.all([
      tx.business.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          subscriptions: { include: { plan: true } },
          memberships: {
            where: { role: "owner", status: "active" },
            include: { user: { select: { email: true } } },
          },
        },
      }),
      tx.plan.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    return { businesses, plans };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-400">
            Plataforma
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Empresas
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Alta manual, plan y estado de cada negocio.
          </p>
        </div>
      </div>

      {params.error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
        >
          {errorMessages[params.error] ?? "No se pudo completar la operación."}
        </p>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">
              Cartera de empresas
            </h2>
          </div>
          <div className="divide-y divide-white/10">
            {data.businesses.length === 0 ? (
              <p className="px-5 py-8 text-sm text-zinc-400">
                No hay empresas todavía.
              </p>
            ) : (
              data.businesses.map((business) => {
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
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {business.slug} · {owner ?? "sin owner"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-zinc-300">
                        {subscription?.plan.name ?? "sin plan"}
                      </span>
                      <span
                        className={
                          business.status === "active"
                            ? "text-emerald-300"
                            : "text-amber-300"
                        }
                      >
                        {statusLabel(business.status)}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <form
          action={createBusinessAction}
          className="h-fit rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <h2 className="text-sm font-semibold text-white">Nueva empresa</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            Se crea la sede principal, la suscripción y la invitación del owner.
          </p>

          <div className="mt-5 space-y-3">
            <label className="block text-xs font-medium text-zinc-300">
              Nombre comercial
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="Peluquería Centro"
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-400"
              />
            </label>

            <label className="block text-xs font-medium text-zinc-300">
              Slug público
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="peluqueria-centro"
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-400"
              />
            </label>

            <label className="block text-xs font-medium text-zinc-300">
              Email del propietario
              <input
                name="ownerEmail"
                type="email"
                required
                placeholder="owner@negocio.es"
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-400"
              />
            </label>

            <label className="block text-xs font-medium text-zinc-300">
              Plan
              <select
                name="planCode"
                required
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400"
              >
                {data.plans.map((plan) => (
                  <option key={plan.id} value={plan.code}>
                    {plan.name} · {(plan.priceCents / 100).toFixed(0)} €/mes
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-zinc-300">
              Días de prueba
              <input
                name="trialDays"
                type="number"
                min={0}
                max={90}
                defaultValue={14}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400"
              />
            </label>
          </div>

          <button
            type="submit"
            className="mt-5 w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
          >
            Crear empresa e invitar
          </button>
        </form>
      </section>
    </div>
  );
}
