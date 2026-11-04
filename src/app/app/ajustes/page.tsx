import Link from "next/link";
import { requireOwner } from "@/lib/guards";
import { withTenant } from "@/lib/tenant";
import {
  publishBusinessAction,
  updateBusinessAction,
  updateHoursAction,
  updateLocationAction,
} from "./actions";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const weekdays = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

const savedMessages: Record<string, string> = {
  business: "Datos del negocio guardados.",
  location: "Sede actualizada.",
  hours: "Horario guardado.",
  published: "Negocio publicado. La página pública se construye en la Fase 2.",
};

const errorMessages: Record<string, string> = {
  datos: "Revisa los datos del negocio.",
  guardar: "No se pudo guardar el negocio.",
  sede: "Revisa los datos de la sede.",
  sede_guardar: "No se pudo guardar la sede.",
  horario: "Revisa el horario: la apertura debe ser anterior al cierre.",
  horario_guardar: "No se pudo guardar el horario.",
  publicar: "Para publicar necesitas una sede y los 7 días de horario.",
};

export default async function BusinessSettingsPage({ searchParams }: PageProps) {
  const ctx = await requireOwner();
  const params = await searchParams;

  const data = await withTenant(
    {
      businessId: ctx.business.id,
      userId: ctx.session.user.id,
      role: "owner",
    },
    async (tx) => {
      const business = await tx.business.findUnique({
        where: { id: ctx.business.id },
      });
      const locations = await tx.location.findMany({
        where: { businessId: ctx.business.id, active: true },
        orderBy: { isDefault: "desc" },
      });
      const location = locations[0];
      const hours = location
        ? await tx.businessHours.findMany({
            where: { businessId: ctx.business.id, locationId: location.id },
          })
        : [];

      return { business, locations, location, hours };
    },
  );

  if (!data.business) {
    return null;
  }

  const { business, location, hours } = data;
  const hoursByDay = new Map(hours.map((row) => [row.weekday, row]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            Configuración
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            {business.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Datos del negocio, sede, horario y publicación.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={
              business.publishedAt
                ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                : "rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
            }
          >
            {business.publishedAt ? "Publicado" : "Borrador"}
          </span>
          <Link
            href="/app"
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
          >
            Volver
          </Link>
        </div>
      </div>

      {params.saved ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {savedMessages[params.saved] ?? "Cambios guardados."}
        </p>
      ) : null}

      {params.error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorMessages[params.error] ?? "No se pudo completar la operación."}
        </p>
      ) : null}

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Datos del negocio</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Es la información que verá el cliente en la página pública.
            </p>
          </div>
          <form action={publishBusinessAction}>
            <button
              type="submit"
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              {business.publishedAt ? "Republicar" : "Publicar negocio"}
            </button>
          </form>
        </div>

        <form action={updateBusinessAction} className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-zinc-800">
            Nombre comercial
            <input
              name="name"
              required
              defaultValue={business.name}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Nombre fiscal
            <input
              name="legalName"
              defaultValue={business.legalName ?? ""}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            CIF/NIF
            <input
              name="taxId"
              defaultValue={business.taxId ?? ""}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Teléfono
            <input
              name="phone"
              defaultValue={business.phone ?? ""}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Email
            <input
              name="email"
              type="email"
              defaultValue={business.email ?? ""}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Web
            <input
              name="website"
              type="url"
              defaultValue={business.website ?? ""}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800 sm:col-span-2">
            Descripción
            <textarea
              name="description"
              rows={3}
              defaultValue={business.description ?? ""}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800 sm:col-span-2">
            Frase corta
            <input
              name="tagline"
              defaultValue={business.tagline ?? ""}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Slug público
            <input
              name="slug"
              required
              defaultValue={business.slug}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
            <span className="mt-1 block text-xs text-zinc-500">
              /p/{business.slug}
            </span>
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Zona horaria
            <input
              name="timezone"
              required
              defaultValue={business.timezone}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Moneda
            <input
              name="currency"
              required
              maxLength={3}
              defaultValue={business.currency}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Antelación mínima (min)
            <input
              name="minLeadMinutes"
              type="number"
              min={0}
              defaultValue={business.minLeadMinutes}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Antelación máxima (días)
            <input
              name="maxAdvanceDays"
              type="number"
              min={1}
              defaultValue={business.maxAdvanceDays}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Intervalo de slots (min)
            <select
              name="slotIntervalMinutes"
              defaultValue={business.slotIntervalMinutes}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            >
              {[5, 10, 15, 20, 30, 60].map((value) => (
                <option key={value} value={value}>
                  {value} minutos
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Cancelación (min antes)
            <input
              name="cancellationCutoffMinutes"
              type="number"
              min={0}
              defaultValue={business.cancellationCutoffMinutes}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Recordatorio (horas antes)
            <input
              name="reminderHoursBefore"
              type="number"
              min={1}
              defaultValue={business.reminderHoursBefore}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800"
            >
              Guardar negocio
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">Sede principal</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Dirección y contacto que se mostrarán en la página pública.
        </p>
        <form action={updateLocationAction} className="mt-6 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="name" value={location?.name ?? "Sede principal"} />
          <input type="hidden" name="countryCode" value={location?.countryCode ?? "ES"} />
          <label className="block text-sm font-medium text-zinc-800 sm:col-span-2">
            Dirección
            <input
              name="addressLine1"
              required
              defaultValue={location?.addressLine1 ?? ""}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800 sm:col-span-2">
            Dirección adicional
            <input
              name="addressLine2"
              defaultValue={location?.addressLine2 ?? ""}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Ciudad
            <input
              name="city"
              required
              defaultValue={location?.city ?? ""}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Provincia
            <input
              name="province"
              defaultValue={location?.province ?? ""}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Código postal
            <input
              name="postalCode"
              required
              defaultValue={location?.postalCode ?? ""}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            Teléfono de la sede
            <input
              name="phone"
              defaultValue={location?.phone ?? ""}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800 sm:col-span-2">
            Email de la sede
            <input
              name="email"
              type="email"
              defaultValue={location?.email ?? ""}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800"
            >
              Guardar sede
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">Horario comercial</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Se guarda por sede. La agenda y la disponibilidad lo usarán en la Fase 3.
        </p>
        <form action={updateHoursAction} className="mt-6 space-y-3">
          {weekdays.map((label, index) => {
            const weekday = index + 1;
            const row = hoursByDay.get(weekday);
            return (
              <div
                key={weekday}
                className="grid items-center gap-3 rounded-xl border border-zinc-100 px-3 py-3 sm:grid-cols-[120px_1fr_1fr_90px]"
              >
                <span className="text-sm font-medium text-zinc-800">{label}</span>
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  Abre
                  <input
                    name={`open-${weekday}`}
                    type="time"
                    defaultValue={row?.opensAt ?? "09:00"}
                    className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  Cierra
                  <input
                    name={`close-${weekday}`}
                    type="time"
                    defaultValue={row?.closesAt ?? "20:00"}
                    className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  <input
                    name={`closed-${weekday}`}
                    type="checkbox"
                    defaultChecked={row?.closed ?? weekday === 7}
                    className="size-4 rounded border-zinc-300"
                  />
                  Cerrado
                </label>
              </div>
            );
          })}
          <button
            type="submit"
            className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800"
          >
            Guardar horario
          </button>
        </form>
      </section>
    </div>
  );
}
