import Link from "next/link";
import { notFound } from "next/navigation";
import { nowMs } from "@/lib/time";
import { withPlatform } from "@/lib/tenant";
import {
  resendInvitationAction,
  setBusinessStatusAction,
  updateSubscriptionAction,
} from "../../actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    warning?: string;
    updated?: string;
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  datos: "Revisa los datos del formulario.",
  suscripcion: "No se pudo actualizar el plan.",
  invitacion: "No se pudo reenviar la invitación.",
  email: "La operación se guardó, pero el email no se pudo enviar.",
};

export default async function PlatformBusinessDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = await searchParams;

  const data = await withPlatform(async (tx) => {
    const business = await tx.business.findUnique({
      where: { id },
      include: {
        locations: { orderBy: { createdAt: "asc" } },
        subscriptions: { include: { plan: true } },
        memberships: {
          include: { user: { select: { email: true, name: true } } },
        },
        invitations: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 15,
        },
      },
    });

    if (!business) {
      return null;
    }

    const [professionals, services, clients, resources, plans] =
      await Promise.all([
        tx.professional.count({ where: { businessId: id } }),
        tx.service.count({ where: { businessId: id } }),
        tx.client.count({ where: { businessId: id } }),
        tx.resource.count({ where: { businessId: id } }),
        tx.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      ]);

    return {
      business,
      counts: { professionals, services, clients, resources },
      plans,
    };
  });

  if (!data) {
    notFound();
  }

  const { business, counts, plans } = data;
  const currentTime = nowMs();
  const subscription = business.subscriptions[0];
  const owner = business.memberships.find((m) => m.role === "owner");
  const defaultLocation = business.locations.find((l) => l.isDefault);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/platform/empresas"
            className="text-xs font-medium text-violet-300 hover:text-violet-200"
          >
            ← Empresas
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {business.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {business.slug} · {owner?.user.email ?? "sin owner"} ·{" "}
            {defaultLocation?.city ?? "sin sede"}
          </p>
        </div>
        <span
          className={
            business.status === "active"
              ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300"
              : "rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300"
          }
        >
          {business.status === "active" ? "Activa" : "Suspendida"}
        </span>
      </div>

      {query.error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {errorMessages[query.error] ?? "No se pudo completar la operación."}
        </p>
      ) : null}

      {query.created ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Empresa creada. La invitación se ha enviado a {owner?.user.email ?? "el propietario"}.
          {query.warning === "email"
            ? " No se pudo enviar el email; usa Reenviar invitación."
            : " En local, revisa Mailpit."}
        </p>
      ) : null}

      {query.updated ? (
        <p className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-200">
          Cambio guardado: {query.updated}.
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Profesionales", counts.professionals],
          ["Servicios", counts.services],
          ["Clientes", counts.clients],
          ["Recursos", counts.resources],
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

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold text-white">Suscripción</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Plan actual: {subscription?.plan.name ?? "sin plan"} ·{" "}
            {subscription?.status ?? "sin suscripción"}
          </p>
          <form action={updateSubscriptionAction} className="mt-4 space-y-3">
            <input type="hidden" name="businessId" value={business.id} />
            <label className="block text-xs font-medium text-zinc-300">
              Plan
              <select
                name="planCode"
                defaultValue={subscription?.plan.code ?? plans[0]?.code}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400"
              >
                {plans.map((plan) => (
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
                defaultValue={
                  subscription?.trialEndsAt
                    ? Math.max(
                        0,
                        Math.ceil(
                          (subscription.trialEndsAt.getTime() - currentTime) /
                            (24 * 60 * 60 * 1000),
                        ),
                      )
                    : 0
                }
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400"
            >
              Guardar plan
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold text-white">Estado y soporte</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Suspender bloquea el acceso público en fases posteriores.
          </p>
          <form action={setBusinessStatusAction} className="mt-4 space-y-3">
            <input type="hidden" name="businessId" value={business.id} />
            <label className="block text-xs font-medium text-zinc-300">
              Estado
              <select
                name="status"
                defaultValue={business.status === "suspended" ? "suspended" : "active"}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400"
              >
                <option value="active">Activa</option>
                <option value="suspended">Suspendida</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-zinc-300">
              Motivo
              <input
                name="reason"
                placeholder="Impago, solicitud del cliente..."
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-400"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/5"
            >
              Actualizar estado
            </button>
          </form>

          <form action={resendInvitationAction} className="mt-4">
            <input type="hidden" name="businessId" value={business.id} />
            <button
              type="submit"
              className="w-full rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/5"
            >
              Reenviar invitación al owner
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold text-white">
            Invitaciones recientes
          </h2>
          <div className="mt-3 space-y-2">
            {business.invitations.length === 0 ? (
              <p className="text-sm text-zinc-400">No hay invitaciones.</p>
            ) : (
              business.invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs"
                >
                  <p className="font-medium text-zinc-200">
                    {invitation.emailNormalized}
                  </p>
                  <p className="mt-0.5 text-zinc-500">
                    {invitation.role} ·{" "}
                    {invitation.acceptedAt
                      ? "aceptada"
                      : invitation.revokedAt
                        ? "revocada"
                        : invitation.expiresAt.getTime() < currentTime
                          ? "caducada"
                          : "pendiente"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold text-white">Auditoría</h2>
          <div className="mt-3 space-y-2">
            {business.auditLogs.length === 0 ? (
              <p className="text-sm text-zinc-400">Sin acciones registradas.</p>
            ) : (
              business.auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-white/10 px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-medium text-zinc-200">{log.action}</p>
                    <p className="text-zinc-500">
                      {log.actorType} · {log.entityType}
                    </p>
                  </div>
                  <time className="shrink-0 text-zinc-500">
                    {log.createdAt.toLocaleString("es-ES")}
                  </time>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
