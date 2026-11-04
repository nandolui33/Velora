import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/guards";
import { withTenant } from "@/lib/tenant";
import { getClientDetail } from "@/modules/clients/queries";
import {
  addConsentAction,
  anonymizeClientAction,
  mergeClientAction,
  updateClientAction,
} from "./actions";

const errorMessages: Record<string, string> = {
  cliente_datos: "Revisa los datos: faltan el nombre o algún contacto.",
  duplicate_contact: "Ya existe otra ficha con ese email o teléfono.",
  invalid_contact: "Hace falta un email o un teléfono válido.",
  consentimiento_datos: "No se pudo registrar el consentimiento.",
  fusion_datos: "No se pudo fusionar: revisa las fichas.",
  same_client: "No puedes fusionar una ficha consigo misma.",
  already_anonymized: "Esa ficha ya está anonimizada.",
  anonimizar_confirmar: "Escribe ANONIMIZAR para confirmar.",
};

const consentLabels: Record<string, string> = {
  privacy: "Privacidad",
  marketing: "Marketing",
  health: "Datos de salud",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No presentado",
};

function formatDateTime(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatDate(value: Date | null, timezone: string) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    dateStyle: "medium",
  }).format(value);
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(cents / 100);
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const ctx = await requireOwner();
  const { id } = await params;
  const query = await searchParams;

  const detail = await withTenant(
    { businessId: ctx.business.id, userId: ctx.session.user.id, role: "owner" },
    (tx) => getClientDetail(tx, { businessId: ctx.business.id, clientId: id }),
  );

  if (!detail) {
    notFound();
  }

  const timezone = ctx.business.timezone;
  const currency = ctx.business.currency;
  const { client, metrics } = detail;
  const isAnonymized = Boolean(client.anonymizedAt);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/clientes" className="text-xs font-medium text-violet-700">
            ← Clientes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
            {client.firstName} {client.lastName ?? ""}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Alta {formatDate(client.createdAt, timezone)} · última visita{" "}
            {formatDate(client.lastVisitAt, timezone)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase">
          {client.marketingConsent ? (
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">Marketing</span>
          ) : null}
          {isAnonymized ? (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600">Anonimizado</span>
          ) : null}
        </div>
      </header>

      {query.error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessages[query.error] ?? "No se pudo completar la operación."}
        </p>
      ) : null}

      {query.saved ? (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Cambios guardados.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Visitas completadas", value: String(metrics.completedVisits) },
          { label: "Canceladas", value: String(metrics.cancellations) },
          { label: "Ingreso estimado", value: formatMoney(metrics.estimatedCents, currency) },
          { label: "Cobrado", value: formatMoney(metrics.collectedCents, currency) },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">{card.label}</p>
            <p className="mt-2 text-xl font-semibold text-zinc-950">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Datos de contacto</h2>
          <form action={updateClientAction} className="mt-3 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="clientId" value={client.id} />
            <label className="text-xs font-medium text-zinc-700">
              Nombre
              <input name="firstName" defaultValue={client.firstName} required className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-medium text-zinc-700">
              Apellidos
              <input name="lastName" defaultValue={client.lastName ?? ""} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-medium text-zinc-700">
              Email
              <input name="email" type="email" defaultValue={client.email ?? ""} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-medium text-zinc-700">
              Teléfono
              <input name="phone" inputMode="tel" defaultValue={client.phone ?? ""} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-medium text-zinc-700">
              Fecha de nacimiento
              <input
                name="birthDate"
                type="date"
                defaultValue={client.birthDate ? client.birthDate.toISOString().slice(0, 10) : ""}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-zinc-700 sm:col-span-2">
              Notas
              <textarea name="notes" rows={2} defaultValue={client.notes ?? ""} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
            </label>
            <button type="submit" className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white sm:col-span-2">
              Guardar datos
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-900">Consentimientos</h2>
            <form action={addConsentAction} className="mt-3 grid gap-2">
              <input type="hidden" name="clientId" value={client.id} />
              <div className="grid grid-cols-2 gap-2">
                <select name="type" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
                  <option value="privacy">Privacidad</option>
                  <option value="marketing">Marketing</option>
                  <option value="health">Datos de salud</option>
                </select>
                <select name="granted" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
                  <option value="on">Concedido</option>
                  <option value="off">Retirado</option>
                </select>
              </div>
              <label className="text-xs font-medium text-zinc-700">
                Versión de la política
                <input name="policyVersion" defaultValue="1.0" className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
              </label>
              <button type="submit" className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                Registrar consentimiento
              </button>
            </form>

            <ul className="mt-3 space-y-1.5 text-xs">
              {detail.consents.length === 0 ? (
                <li className="text-zinc-500">Sin registros.</li>
              ) : null}
              {detail.consents.map((consent) => (
                <li key={consent.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2 py-1.5">
                  <span className="text-zinc-700">
                    {consentLabels[consent.type]} · v{consent.policyVersion}
                  </span>
                  <span className={consent.granted && !consent.revokedAt ? "text-emerald-600" : "text-zinc-500"}>
                    {consent.granted && !consent.revokedAt ? "Sí" : "No"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {detail.duplicates.length > 0 && !isAnonymized ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h2 className="text-sm font-semibold text-amber-950">Posibles duplicados</h2>
              <ul className="mt-2 space-y-2 text-xs text-amber-900">
                {detail.duplicates.map((duplicate) => (
                  <li key={duplicate.id} className="rounded-lg bg-white/60 px-2 py-1.5">
                    <p className="font-medium">
                      {duplicate.firstName} {duplicate.lastName ?? ""} · {duplicate.email ?? duplicate.phone ?? ""}
                    </p>
                    <form action={mergeClientAction} className="mt-1">
                      <input type="hidden" name="sourceId" value={client.id} />
                      <input type="hidden" name="targetId" value={duplicate.id} />
                      <button type="submit" className="rounded-lg border border-amber-300 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100">
                        Fusionar en esta ficha
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-5 text-amber-800">
                Se moverán las citas y consentimientos a la otra ficha; esta quedará anonimizada.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Historial de citas</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="py-2 pr-4 font-medium">Servicio</th>
                <th className="py-2 pr-4 font-medium">Profesional</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 pr-4 font-medium">Importe</th>
                <th className="py-2 font-medium">Cobrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {detail.appointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-500">
                    Sin citas todavía.
                  </td>
                </tr>
              ) : null}
              {detail.appointments.map((appointment) => (
                <tr key={appointment.id}>
                  <td className="py-2 pr-4 text-zinc-700">{formatDateTime(appointment.startsAt, timezone)}</td>
                  <td className="py-2 pr-4 text-zinc-700">{appointment.serviceName}</td>
                  <td className="py-2 pr-4 text-zinc-600">{appointment.professionalName}</td>
                  <td className="py-2 pr-4 text-zinc-600">{statusLabels[appointment.status] ?? appointment.status}</td>
                  <td className="py-2 pr-4 text-zinc-700">{formatMoney(appointment.priceCents, currency)}</td>
                  <td className="py-2 text-zinc-600">{formatMoney(appointment.paidAmountCents, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!isAnonymized ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-semibold text-red-900">Anonimizar ficha</h2>
          <p className="mt-1 text-xs leading-5 text-red-800">
            Borra los datos personales y conserva las citas para las métricas. No
            se puede deshacer. Escribe <strong>ANONIMIZAR</strong> para confirmar.
          </p>
          <form action={anonymizeClientAction} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="clientId" value={client.id} />
            <input
              name="confirm"
              placeholder="ANONIMIZAR"
              className="w-40 rounded-lg border border-red-300 px-2 py-1.5 text-sm"
            />
            <button type="submit" className="rounded-xl border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100">
              Anonimizar
            </button>
          </form>
        </section>
      ) : (
        <p className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
          Esta ficha está anonimizada. Sus citas se conservan para las métricas
          agregadas.
        </p>
      )}
    </div>
  );
}
