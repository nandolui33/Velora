import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { withTenant } from "@/lib/tenant";
import { getEffectivePlan } from "@/modules/plans/limits";
import { getDashboardStats } from "@/modules/stats/summary";

const cards = [
  { key: "professionals", label: "Profesionales" },
  { key: "services", label: "Servicios" },
  { key: "resources", label: "Recursos" },
  { key: "clients", label: "Clientes" },
] as const;

export default async function AppDashboardPage() {
  const ctx = await getCurrentContext();

  if (!ctx) {
    redirect("/login");
  }

  if (!ctx.membership || !ctx.business) {
    if (ctx.session.user.isSuperadmin) {
      // El superadministrador no pertenece a ningún negocio: su panel es /platform.
      redirect("/platform");
    }

    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-amber-950">Sin acceso</h1>
        <p className="mt-2 text-sm leading-6 text-amber-800">
          Tu cuenta no tiene una empresa activa. Pide a un administrador que te
          invite o contacta con soporte.
        </p>
      </div>
    );
  }

  if (ctx.business.status !== "active") {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-amber-950">
          Negocio suspendido
        </h1>
        <p className="mt-2 text-sm leading-6 text-amber-800">
          El acceso del negocio está suspendido. Contacta con soporte de Velora
          para revisar la situación.
        </p>
      </div>
    );
  }

  const businessTimezone = ctx.business.timezone;

  const data = await withTenant(
    {
      businessId: ctx.membership.businessId,
      userId: ctx.session.user.id,
      role: ctx.membership.role,
    },
    async (tx) => {
      const [
        professionals,
        services,
        resources,
        clients,
        location,
        hours,
        subscription,
        stats,
        plan,
      ] = await Promise.all([
        tx.professional.count(),
        tx.service.count(),
        tx.resource.count(),
        tx.client.count(),
        tx.location.findFirst({
          where: { businessId: ctx.membership.businessId, isDefault: true },
        }),
        tx.businessHours.count({
          where: { businessId: ctx.membership.businessId },
        }),
        tx.subscription.findUnique({
          where: { businessId: ctx.membership.businessId },
          include: { plan: true },
        }),
        getDashboardStats(tx, {
          businessId: ctx.membership.businessId,
          timezone: businessTimezone,
        }),
        getEffectivePlan(tx, ctx.membership.businessId),
      ]);

      return {
        counts: { professionals, services, resources, clients },
        location,
        hours,
        subscription,
        stats,
        plan,
      };
    },
  );

  const checklist = [
    {
      label: "Datos del negocio",
      done: Boolean(ctx.business.phone || ctx.business.email),
    },
    {
      label: "Sede principal",
      done: Boolean(
        data.location && data.location.addressLine1 !== "Pendiente de completar",
      ),
    },
    {
      label: "Horario de 7 días",
      done: data.hours >= 7,
    },
    {
      label: "Negocio publicado",
      done: Boolean(ctx.business.publishedAt),
    },
    {
      label: "Catálogo de servicios",
      done: data.counts.services > 0,
    },
    {
      label: "Equipo",
      done: data.counts.professionals > 0,
    },
    {
      label: "Recursos físicos",
      done: data.counts.resources > 0,
    },
  ];
  const completed = checklist.filter((item) => item.done).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              {ctx.membership.role === "owner" ? "Propietario" : "Profesional"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
              {ctx.business.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Agenda, reservas y página pública en marcha. Revisa las citas del
              día, configura el catálogo y comparte tu página de reservas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
              {data.subscription?.plan.name ?? "Sin plan"} ·{" "}
              {data.subscription?.status ?? "sin suscripción"}
            </span>
            {ctx.membership.role === "owner" ? (
              <Link
                href={`/p/${ctx.business.slug}?preview=1`}
                target="_blank"
                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
              >
                Vista previa
              </Link>
            ) : null}
            {ctx.business.publishedAt ? (
              <Link
                href={`/p/${ctx.business.slug}`}
                target="_blank"
                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
              >
                Ver página pública
              </Link>
            ) : null}
            {ctx.membership.role === "owner" ? (
              <Link
                href="/app/ajustes"
                className="rounded-full bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-800"
              >
                Configurar
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.key}
            className="rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <p className="text-sm text-zinc-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              {data.counts[card.key]}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-950">
            Últimos {data.stats.periodDays} días
          </h2>
          <span className="text-xs text-zinc-500">
            {data.plan.planName ? `Plan ${data.plan.planName}` : "Sin plan"} ·{" "}
            {data.plan.maxProfessionals === null
              ? "profesionales ilimitados"
              : `máx. ${data.plan.maxProfessionals} profesionales`}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Citas hoy", value: String(data.stats.todayCount) },
            { label: "Esta semana", value: String(data.stats.weekCount) },
            { label: "Próximas", value: String(data.stats.upcomingCount) },
            { label: "Clientes nuevos", value: String(data.stats.newClients) },
          ].map((item) => (
            <article key={item.label} className="rounded-xl border border-zinc-100 px-3 py-2.5">
              <p className="text-xs text-zinc-500">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                {item.value}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl bg-zinc-50 px-3 py-2.5">
            <p className="text-xs text-zinc-500">Ingreso estimado</p>
            <p className="mt-1 text-lg font-semibold text-zinc-950">
              {new Intl.NumberFormat("es-ES", {
                style: "currency",
                currency: ctx.business.currency,
              }).format(data.stats.estimatedCents / 100)}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Citas completadas · {data.stats.completedCount}
            </p>
          </article>
          <article className="rounded-xl bg-zinc-50 px-3 py-2.5">
            <p className="text-xs text-zinc-500">Cobrado</p>
            <p className="mt-1 text-lg font-semibold text-zinc-950">
              {new Intl.NumberFormat("es-ES", {
                style: "currency",
                currency: ctx.business.currency,
              }).format(data.stats.collectedCents / 100)}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Canceladas: {data.stats.cancelledCount} · No presentados:{" "}
              {data.stats.noShowCount}
            </p>
          </article>
          <article className="rounded-xl bg-zinc-50 px-3 py-2.5">
            <p className="text-xs text-zinc-500">Servicios top</p>
            <ul className="mt-1 space-y-0.5 text-xs text-zinc-700">
              {data.stats.topServices.length === 0 ? (
                <li className="text-zinc-500">Sin datos aún.</li>
              ) : null}
              {data.stats.topServices.map((service) => (
                <li key={service.name} className="flex justify-between gap-2">
                  <span className="truncate">{service.name}</span>
                  <span className="font-medium">{service.count}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-950">
              Puesta en marcha
            </h2>
            <span className="text-xs text-zinc-500">
              {completed}/{checklist.length}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {checklist.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2.5"
              >
                <span className="text-sm text-zinc-700">{item.label}</span>
                <span
                  className={
                    item.done
                      ? "text-xs font-medium text-emerald-600"
                      : "text-xs font-medium text-amber-600"
                  }
                >
                  {item.done ? "Completado" : "Pendiente"}
                </span>
              </div>
            ))}
          </div>
          {ctx.membership.role === "owner" && completed < checklist.length ? (
            <Link
              href="/app/ajustes"
              className="mt-4 inline-flex rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800"
            >
              Completar configuración
            </Link>
          ) : null}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-950">Siguiente</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Revisa la agenda del día, confirma que los servicios tienen recursos
            asignados y comparte tu página de reservas con los clientes.
          </p>
          <div className="mt-4 space-y-2 text-sm text-zinc-600">
            <p>
              <span className="font-medium text-zinc-900">Sede:</span>{" "}
              {data.location?.city ?? "sin configurar"}
            </p>
            <p>
              <span className="font-medium text-zinc-900">Horario:</span>{" "}
              {data.hours >= 7 ? "completo" : `${data.hours}/7 días`}
            </p>
            <p>
              <span className="font-medium text-zinc-900">Estado:</span>{" "}
              {ctx.business.publishedAt ? "publicado" : "borrador"}
            </p>
          </div>
        </div>
      </section>

      <section id="agenda" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/app/agenda"
          className="rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-violet-300 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-zinc-950">Agenda</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Citas del día y de la semana, alta manual, movimiento y
            cancelación.
          </p>
          <span className="mt-3 inline-block text-xs font-semibold text-violet-700">
            Abrir agenda →
          </span>
        </Link>
        <Link
          href="/app/recursos"
          className="rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-violet-300 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-zinc-950">Recursos</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Cada recurso tiene su propia exclusion constraint: una cita y un
            bloqueo compiten por la misma cabina.
          </p>
          <span className="mt-3 inline-block text-xs font-semibold text-violet-700">
            Ver recursos →
          </span>
        </Link>
        <Link
          href={`/p/${ctx.business.slug}/reservar`}
          target="_blank"
          className="rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-violet-300 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-zinc-950">Reserva online</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {ctx.business.publishedAt
              ? "Tu página de reservas ya está activa y sin comisiones."
              : "Publica el negocio para activar la reserva online."}
          </p>
          <span className="mt-3 inline-block text-xs font-semibold text-violet-700">
            Ver página de reservas →
          </span>
        </Link>
      </section>
    </div>
  );
}
