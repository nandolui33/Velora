import Link from "next/link";
import { requireOwner } from "@/lib/guards";
import { withTenant } from "@/lib/tenant";
import {
  assignServicesAction,
  createProfessionalAction,
  createTimeOffAction,
  toggleProfessionalAction,
  updateProfessionalScheduleAction,
} from "./actions";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const savedMessages: Record<string, string> = {
  profesional: "Profesional creado.",
  servicios: "Servicios asignados.",
  horario: "Horario guardado.",
  ausencia: "Ausencia registrada.",
};

const errorMessages: Record<string, string> = {
  profesional: "Revisa los datos del profesional.",
  profesional_guardar: "No se pudo crear el profesional.",
  asignacion: "No se pudieron asignar los servicios.",
  asignacion_guardar: "No se pudieron guardar los servicios.",
  horario: "Revisa el horario del profesional.",
  horario_guardar: "No se pudo guardar el horario.",
  ausencia: "Revisa las fechas de la ausencia.",
  ausencia_guardar: "No se pudo registrar la ausencia.",
  limite_plan:
    "Tu plan no permite otro profesional activo. Desactiva uno o amplía el plan.",
};

export default async function TeamPage({ searchParams }: PageProps) {
  const ctx = await requireOwner();
  const params = await searchParams;

  const data = await withTenant(
    {
      businessId: ctx.business.id,
      userId: ctx.session.user.id,
      role: "owner",
    },
    async (tx) => {
      const professionals = await tx.professional.findMany({
        where: { businessId: ctx.business.id },
        include: {
          serviceLinks: { include: { service: true } },
          schedules: true,
          timeOff: { orderBy: { startsAt: "asc" } },
        },
        orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
      });
      const services = await tx.service.findMany({
        where: { businessId: ctx.business.id, active: true },
        orderBy: { name: "asc" },
      });
      const location = await tx.location.findFirst({
        where: { businessId: ctx.business.id, isDefault: true, active: true },
      });

      return { professionals, services, location };
    },
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            Equipo
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Profesionales
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Equipo, servicios que realiza cada persona y horario semanal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/servicios"
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
          >
            Servicios
          </Link>
          <Link
            href="/app/recursos"
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
          >
            Recursos
          </Link>
        </div>
      </div>

      {params.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {savedMessages[params.saved] ?? "Cambio guardado."}
        </p>
      ) : null}
      {params.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessages[params.error] ?? "No se pudo completar la operación."}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_0.5fr]">
        <section className="space-y-4">
          {data.professionals.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
              Todavía no hay profesionales. Crea el primero a la derecha.
            </div>
          ) : (
            data.professionals.map((professional) => {
              const scheduleByDay = new Map(
                professional.schedules.map((row) => [row.weekday, row]),
              );
              const assigned = new Set(
                professional.serviceLinks.map((link) => link.serviceId),
              );

              return (
                <article
                  key={professional.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 size-3 rounded-full"
                        style={{ backgroundColor: professional.color }}
                      />
                      <div>
                        <h2 className="text-lg font-semibold text-zinc-950">
                          {professional.displayName}
                        </h2>
                        <p className="text-sm text-zinc-500">
                          {professional.title ?? "Sin especialidad"} ·{" "}
                          {professional.active ? "Activo" : "Inactivo"}
                        </p>
                      </div>
                    </div>
                    <form action={toggleProfessionalAction}>
                      <input
                        type="hidden"
                        name="professionalId"
                        value={professional.id}
                      />
                      <input
                        type="hidden"
                        name="active"
                        value={professional.active ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                      >
                        {professional.active ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  </div>

                  {professional.bio ? (
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      {professional.bio}
                    </p>
                  ) : null}

                  <div className="mt-4 rounded-xl border border-zinc-100 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Servicios que realiza
                    </h3>
                    <form action={assignServicesAction} className="mt-2">
                      <input
                        type="hidden"
                        name="professionalId"
                        value={professional.id}
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        {data.services.map((service) => (
                          <label
                            key={service.id}
                            className="flex items-center gap-2 text-sm text-zinc-700"
                          >
                            <input
                              type="checkbox"
                              name="serviceIds"
                              value={service.id}
                              defaultChecked={assigned.has(service.id)}
                              className="size-4 rounded border-zinc-300"
                            />
                            {service.name}
                          </label>
                        ))}
                      </div>
                      <button
                        type="submit"
                        className="mt-3 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                      >
                        Guardar servicios
                      </button>
                    </form>
                  </div>

                  <details className="mt-3 rounded-xl border border-zinc-100 p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Horario semanal
                    </summary>
                    <form
                      action={updateProfessionalScheduleAction}
                      className="mt-3 space-y-2"
                    >
                      <input
                        type="hidden"
                        name="professionalId"
                        value={professional.id}
                      />
                      {weekdays.map((label, index) => {
                        const weekday = index + 1;
                        const row = scheduleByDay.get(weekday);
                        return (
                          <div
                            key={weekday}
                            className="grid items-center gap-2 sm:grid-cols-[100px_1fr_1fr_80px]"
                          >
                            <span className="text-xs text-zinc-600">{label}</span>
                            <input
                              name={`open-${weekday}`}
                              type="time"
                              defaultValue={row?.opensAt ?? "09:00"}
                              className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                            />
                            <input
                              name={`close-${weekday}`}
                              type="time"
                              defaultValue={row?.closesAt ?? "20:00"}
                              className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                            />
                            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                              <input
                                type="checkbox"
                                name={`active-${weekday}`}
                                defaultChecked={row?.active ?? weekday < 7}
                                className="size-4 rounded border-zinc-300"
                              />
                              Trabaja
                            </label>
                          </div>
                        );
                      })}
                      <button
                        type="submit"
                        className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white"
                      >
                        Guardar horario
                      </button>
                    </form>
                  </details>

                  <details className="mt-3 rounded-xl border border-zinc-100 p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Ausencias y vacaciones
                    </summary>
                    <div className="mt-3 space-y-2">
                      {professional.timeOff.length === 0 ? (
                        <p className="text-xs text-zinc-500">Sin ausencias.</p>
                      ) : (
                        professional.timeOff.map((item) => (
                          <p key={item.id} className="text-xs text-zinc-600">
                            {item.startsAt.toLocaleString("es-ES")} →{" "}
                            {item.endsAt.toLocaleString("es-ES")}
                            {item.reason ? ` · ${item.reason}` : ""}
                          </p>
                        ))
                      )}
                      <form
                        action={createTimeOffAction}
                        className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
                      >
                        <input
                          type="hidden"
                          name="professionalId"
                          value={professional.id}
                        />
                        <input
                          name="startsAt"
                          type="datetime-local"
                          required
                          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                        />
                        <input
                          name="endsAt"
                          type="datetime-local"
                          required
                          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                        />
                        <input
                          name="reason"
                          placeholder="Motivo"
                          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700"
                        >
                          Añadir
                        </button>
                      </form>
                    </div>
                  </details>
                </article>
              );
            })
          )}
        </section>

        <aside className="h-fit rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-950">
            Nuevo profesional
          </h2>
          <form action={createProfessionalAction} className="mt-3 space-y-3">
            <input
              name="displayName"
              required
              placeholder="Nombre visible"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
            />
            <input
              name="title"
              placeholder="Especialidad"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
            />
            <textarea
              name="bio"
              rows={2}
              placeholder="Biografía breve"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
            />
            <label className="flex items-center justify-between text-xs text-zinc-600">
              Color en agenda
              <input
                name="color"
                type="color"
                defaultValue="#6d28d9"
                className="h-9 w-16 rounded border border-zinc-300"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-violet-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800"
            >
              Crear profesional
            </button>
          </form>
          {!data.location ? (
            <p className="mt-3 text-xs text-amber-700">
              Configura una sede antes de crear el horario.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
