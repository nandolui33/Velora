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

  const counts = await withTenant(
    {
      businessId: ctx.membership.businessId,
      userId: ctx.session.user.id,
      role: ctx.membership.role,
    },
    async (tx) => {
      const [professionals, services, resources, clients] = await Promise.all([
        tx.professional.count(),
        tx.service.count(),
        tx.resource.count(),
        tx.client.count(),
      ]);

      return { professionals, services, resources, clients };
    },
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
          Empresa activa
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
          {ctx.business.name}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
          Fase 0 completada: RLS activo, Auth.js configurado y doble exclusividad
          de agenda y recursos probada. Los módulos funcionales llegan en las
          siguientes fases.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.key}
            className="rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <p className="text-sm text-zinc-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              {counts[card.key]}
            </p>
          </article>
        ))}
      </section>

      <section
        id="agenda"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
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
