import Link from "next/link";
import { requireOwner } from "@/lib/guards";
import { withTenant } from "@/lib/tenant";
import { dayRange } from "@/modules/scheduling/data";
import {
  localDateKey,
  localTimeLabel,
} from "@/modules/scheduling/time";
import {
  blockResourceAction,
  cancelAppointmentAction,
  createAppointmentAction,
  rescheduleAppointmentAction,
} from "./actions";

type SearchParams = {
  date?: string;
  view?: string;
  professional?: string;
  error?: string;
  saved?: string;
};

const knownErrors: Record<string, string> = {
  cita_datos: "Revisa los datos de la cita.",
  cita_fecha: "La hora indicada no es válida.",
  cita_sede: "El negocio necesita una sede activa.",
  slot_taken: "Ese hueco acaba de ocuparse. Elige otro.",
  resource_taken: "Los recursos de ese hueco están ocupados.",
  professional_not_available: "El profesional no está disponible.",
  service_not_available: "El servicio no se ofrece en esta sede.",
  invalid_input: "Falta el nombre o un email o teléfono del cliente.",
  recurso_ocupado: "El recurso ya está ocupado en ese intervalo.",
  cancelar_datos: "No se pudo cancelar la cita.",
  mover_datos: "Revisa los datos para mover la cita.",
  mover_fecha: "La nueva hora no es válida.",
};

function parseKey(value: string | undefined, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function keyToDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(key: string, days: number) {
  const date = keyToDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(key: string) {
  const date = keyToDate(key);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function dayLabel(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireOwner();
  const params = await searchParams;
  const timezone = ctx.business.timezone;
  const today = localDateKey(new Date(), timezone);
  const date = parseKey(params.date, today);
  const view = params.view === "week" ? "week" : "day";
  const professionalFilter = params.professional ?? "";

  const rangeStart = view === "week" ? startOfWeek(date) : date;
  const days = view === "week" ? 7 : 1;
  const range = dayRange(timezone, rangeStart, days);
  const dayKeys = Array.from({ length: days }, (_, index) => addDays(rangeStart, index));

  const data = await withTenant(
    { businessId: ctx.business.id, userId: ctx.session.user.id, role: "owner" },
    async (tx) => {
      const [professionals, services, resources, appointments, location] =
        await Promise.all([
          tx.professional.findMany({
            where: { businessId: ctx.business.id, active: true },
            orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
          }),
          tx.service.findMany({
            where: { businessId: ctx.business.id, active: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          }),
          tx.resource.findMany({
            where: { businessId: ctx.business.id, active: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          }),
          tx.appointment.findMany({
            where: {
              businessId: ctx.business.id,
              status: { in: ["confirmed", "completed"] },
              startsAt: { gte: range.from, lt: range.to },
              ...(professionalFilter ? { professionalId: professionalFilter } : {}),
            },
            orderBy: { startsAt: "asc" },
            include: {
              client: { select: { firstName: true, lastName: true, phoneE164: true } },
              resourceReservations: {
                where: { releasedAt: null },
                include: { resource: { select: { name: true } } },
              },
            },
          }),
          tx.location.findFirst({
            where: { businessId: ctx.business.id, isDefault: true, active: true },
            select: { timezone: true },
          }),
        ]);

      return { professionals, services, resources, appointments, location };
    },
  );

  const locationTimezone = data.location?.timezone ?? timezone;
  const visibleProfessionals = professionalFilter
    ? data.professionals.filter((professional) => professional.id === professionalFilter)
    : data.professionals;

  const byProfessional = new Map<string, typeof data.appointments>();
  const byDay = new Map<string, typeof data.appointments>();

  for (const appointment of data.appointments) {
    const list = byProfessional.get(appointment.professionalId) ?? [];
    list.push(appointment);
    byProfessional.set(appointment.professionalId, list);

    const key = localDateKey(appointment.startsAt, locationTimezone);
    const dayList = byDay.get(key) ?? [];
    dayList.push(appointment);
    byDay.set(key, dayList);
  }

  const previousKey = addDays(rangeStart, view === "week" ? -7 : -1);
  const nextKey = addDays(rangeStart, view === "week" ? 7 : 1);
  const todayKey = today;

  const baseQuery = (overrides: Record<string, string>) => {
    const query = new URLSearchParams({
      date,
      view,
      ...(professionalFilter ? { professional: professionalFilter } : {}),
      ...overrides,
    });
    return `/app/agenda?${query.toString()}`;
  };

  const nowLabel = localTimeLabel(new Date(), locationTimezone);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Agenda</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {data.appointments.length} citas · ahora son las {nowLabel} ({locationTimezone})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={baseQuery({ date: previousKey })}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            ← Anterior
          </Link>
          <Link
            href={baseQuery({ date: todayKey })}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Hoy
          </Link>
          <Link
            href={baseQuery({ date: nextKey })}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Siguiente →
          </Link>
          <div className="flex overflow-hidden rounded-full border border-zinc-300 text-xs">
            <Link
              href={baseQuery({ view: "day" })}
              className={`px-3 py-1.5 ${view === "day" ? "bg-violet-700 text-white" : "text-zinc-700 hover:bg-zinc-50"}`}
            >
              Día
            </Link>
            <Link
              href={baseQuery({ view: "week" })}
              className={`px-3 py-1.5 ${view === "week" ? "bg-violet-700 text-white" : "text-zinc-700 hover:bg-zinc-50"}`}
            >
              Semana
            </Link>
          </div>
        </div>
      </header>

      {params.error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {knownErrors[params.error] ?? "No se pudo completar la operación."}
        </p>
      ) : null}

      {params.saved ? (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Cambios guardados.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          href={baseQuery({ professional: "" })}
          className={`rounded-full border px-3 py-1.5 font-medium ${professionalFilter ? "border-zinc-300 text-zinc-700 hover:bg-zinc-50" : "border-violet-700 bg-violet-700 text-white"}`}
        >
          Todo el equipo
        </Link>
        {data.professionals.map((professional) => (
          <Link
            key={professional.id}
            href={baseQuery({ professional: professional.id })}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-medium ${professionalFilter === professional.id ? "border-violet-700 bg-violet-700 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"}`}
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: professional.color }}
            />
            {professional.displayName}
          </Link>
        ))}
      </div>

      {view === "day" ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProfessionals.length === 0 ? (
            <p className="text-sm text-zinc-600">No hay profesionales activos.</p>
          ) : null}
          {visibleProfessionals.map((professional) => {
            const appointments = byProfessional.get(professional.id) ?? [];
            return (
              <div key={professional.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: professional.color }} />
                    {professional.displayName}
                  </h2>
                  <span className="text-xs text-zinc-500">{appointments.length} citas</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{dayLabel(date)}</p>

                <ul className="mt-4 space-y-2">
                  {appointments.length === 0 ? (
                    <li className="rounded-xl bg-zinc-50 px-3 py-4 text-xs text-zinc-500">
                      Sin citas.
                    </li>
                  ) : null}
                  {appointments.map((appointment) => (
                    <li key={appointment.id} className="rounded-xl border border-zinc-200 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-zinc-900">
                          {localTimeLabel(appointment.startsAt, locationTimezone)}–{localTimeLabel(appointment.serviceEndsAt, locationTimezone)}
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-zinc-400">
                          {appointment.bookingReference}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-800">{appointment.serviceName}</p>
                      <p className="text-xs text-zinc-600">
                        {appointment.client.firstName} {appointment.client.lastName ?? ""}
                        {appointment.client.phoneE164 ? ` · ${appointment.client.phoneE164}` : ""}
                      </p>
                      {appointment.resourceReservations.length > 0 ? (
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {appointment.resourceReservations.map((reservation) => reservation.resource.name).join(" · ")}
                        </p>
                      ) : null}

                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] font-medium text-violet-700">
                          Mover o cancelar
                        </summary>
                        <div className="mt-2 space-y-2 border-t border-zinc-100 pt-2">
                          <form action={rescheduleAppointmentAction} className="space-y-1.5">
                            <input type="hidden" name="appointmentId" value={appointment.id} />
                            <select
                              name="professionalId"
                              defaultValue={appointment.professionalId}
                              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                            >
                              {data.professionals.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.displayName}
                                </option>
                              ))}
                            </select>
                            <input
                              type="datetime-local"
                              name="startsAt"
                              required
                              defaultValue={`${localDateKey(appointment.startsAt, locationTimezone)}T${localTimeLabel(appointment.startsAt, locationTimezone)}`}
                              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                            />
                            <button type="submit" className="w-full rounded-lg bg-zinc-900 px-2 py-1.5 text-xs font-semibold text-white">
                              Mover cita
                            </button>
                          </form>
                          <form action={cancelAppointmentAction}>
                            <input type="hidden" name="appointmentId" value={appointment.id} />
                            <button type="submit" className="w-full rounded-lg border border-red-200 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                              Cancelar cita
                            </button>
                          </form>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dayKeys.map((key) => {
            const appointments = byDay.get(key) ?? [];
            return (
              <div key={key} className="rounded-2xl border border-zinc-200 bg-white p-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900">{dayLabel(key)}</h2>
                  <span className="text-[11px] text-zinc-500">{appointments.length}</span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {appointments.length === 0 ? (
                    <li className="text-xs text-zinc-400">—</li>
                  ) : null}
                  {appointments.map((appointment) => (
                    <li key={appointment.id} className="rounded-lg bg-zinc-50 px-2 py-1.5">
                      <p className="text-xs font-semibold text-zinc-900">
                        {localTimeLabel(appointment.startsAt, locationTimezone)} · {appointment.professionalName}
                      </p>
                      <p className="text-xs text-zinc-700">{appointment.serviceName}</p>
                      <p className="text-[11px] text-zinc-500">{appointment.client.firstName}</p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Nueva cita</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Se valida contra la disponibilidad real; si el hueco se ocupa, se avisa.
          </p>
          <form action={createAppointmentAction} className="mt-4 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-medium text-zinc-700">
                Servicio
                <select name="serviceId" required className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
                  {data.services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.durationMinutes} min)
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-zinc-700">
                Profesional
                <select name="professionalId" className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
                  <option value="">Cualquiera disponible</option>
                  {data.professionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-xs font-medium text-zinc-700">
              Fecha y hora
              <input
                type="datetime-local"
                name="startsAt"
                required
                defaultValue={`${date}T10:00`}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-medium text-zinc-700">
                Nombre
                <input name="firstName" required className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-medium text-zinc-700">
                Apellidos
                <input name="lastName" className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-medium text-zinc-700">
                Teléfono
                <input name="phone" inputMode="tel" className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-medium text-zinc-700">
                Email
                <input name="email" type="email" className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
              </label>
            </div>

            <label className="block text-xs font-medium text-zinc-700">
              Nota para el negocio
              <textarea name="notes" rows={2} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
            </label>

            <button type="submit" className="w-full rounded-xl bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-800">
              Crear cita
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Bloquear recurso</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Mantenimiento, limpieza o uso interno. Impide reservas en ese intervalo.
          </p>
          <form action={blockResourceAction} className="mt-4 space-y-2">
            <label className="block text-xs font-medium text-zinc-700">
              Recurso
              <select name="resourceId" required className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
                {data.resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-medium text-zinc-700">
                Desde
                <input type="datetime-local" name="startsAt" required defaultValue={`${date}T09:00`} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-medium text-zinc-700">
                Hasta
                <input type="datetime-local" name="endsAt" required defaultValue={`${date}T10:00`} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
              </label>
            </div>
            <label className="block text-xs font-medium text-zinc-700">
              Motivo
              <input name="reason" className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
            </label>
            <button type="submit" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
              Bloquear
            </button>
          </form>

          <p className="mt-4 text-xs leading-5 text-zinc-500">
            Zona horaria de la sede: {locationTimezone}. Los cambios en la agenda
            se aplican al instante y avisan por email si hay cola de envío activa.
          </p>
        </div>
      </section>
    </div>
  );
}
