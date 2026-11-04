import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { withTenant } from "@/lib/tenant";

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
      ]);

      return {
        counts: { professionals, services, resources, clients },
        location,
        hours,
        subscription,
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
              Fase 1: configuración del negocio, sede, horario y publicación.
              La agenda y las reservas llegan en la Fase 3.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
              {data.subscription?.plan.name ?? "Sin plan"} ·{" "}
              {data.subscription?.status ?? "sin suscripción"}
            </span>
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
            La Fase 2 añadirá plantillas sectoriales, servicios, equipo y
            recursos. La Fase 3 construirá la agenda y la reserva pública.
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
        <article className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-950">Agenda</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            El motor de disponibilidad y la agenda visual se construyen en la
            Fase 3, sobre estas tablas y constraints.
          </p>
        </article>
        <article
          id="recursos"
          className="rounded-2xl border border-zinc-200 bg-white p-5"
        >
          <h2 className="text-sm font-semibold text-zinc-950">Recursos</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Cada recurso tiene su propia exclusion constraint. Una cita y un
            bloqueo compiten por la misma cabina.
          </p>
        </article>
        <article
          id="servicios"
          className="rounded-2xl border border-zinc-200 bg-white p-5"
        >
          <h2 className="text-sm font-semibold text-zinc-950">Servicios</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Servicios y variantes ya existen en el esquema; la plantilla
            sectorial se incorpora en la Fase 2.
          </p>
        </article>
      </section>
    </div>
  );
}
