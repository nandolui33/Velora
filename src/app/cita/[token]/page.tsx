import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppointmentByManageToken } from "@/modules/scheduling/booking";
import { cancelByTokenAction } from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  CANCELLATION_NOT_ALLOWED:
    "Ya no puedes cancelar online: falta menos del plazo permitido. Contacta con el negocio.",
  APPOINTMENT_NOT_CANCELLABLE: "Esta cita ya no se puede cancelar.",
  APPOINTMENT_NOT_FOUND: "No encontramos esa cita.",
};

function formatWhen(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function ManageAppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ cancelled?: string; error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const appointment = await getAppointmentByManageToken(decodeURIComponent(token));

  if (!appointment) {
    notFound();
  }

  const cancelled = query.cancelled === "1";
  const errorMessage = query.error ? errorMessages[query.error] : null;
  const isCancelled = appointment.status === "cancelled";

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
          {appointment.businessName}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
          {isCancelled ? "Cita cancelada" : "Tu cita"}
        </h1>

        {cancelled && !isCancelled ? (
          <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            La cita se ha cancelado correctamente.
          </p>
        ) : null}

        {isCancelled ? (
          <p role="status" className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            Esta cita está cancelada. Puedes reservar de nuevo cuando quieras.
          </p>
        ) : null}

        {errorMessage ? (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Servicio</dt>
            <dd className="font-medium text-zinc-900">{appointment.serviceName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Profesional</dt>
            <dd className="font-medium text-zinc-900">{appointment.professionalName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Fecha</dt>
            <dd className="text-right font-medium text-zinc-900">
              {formatWhen(appointment.startsAt, appointment.timezone)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Sede</dt>
            <dd className="text-right text-zinc-900">
              {appointment.locationName}
              {appointment.addressLine ? ` · ${appointment.addressLine}` : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Referencia</dt>
            <dd className="font-mono text-zinc-900">{appointment.bookingReference}</dd>
          </div>
        </dl>

        {appointment.canCancel ? (
          <form action={cancelByTokenAction} className="mt-6 space-y-3">
            <input type="hidden" name="token" value={decodeURIComponent(token)} />
            <label className="block text-xs font-medium text-zinc-700">
              Motivo (opcional)
              <input
                name="reason"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Cancelar mi cita
            </button>
            <p className="text-[11px] text-zinc-500">
              Puedes cancelar hasta {appointment.cancellationCutoffMinutes} minutos
              antes del inicio.
            </p>
          </form>
        ) : !isCancelled ? (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Ya no puedes cancelar online: falta menos del plazo permitido
            ({appointment.cancellationCutoffMinutes} minutos). Contacta con el
            negocio si necesitas cambiarla.
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href={`/p/${appointment.businessSlug}`}
            className="text-sm font-medium text-violet-700"
          >
            ← Volver a {appointment.businessName}
          </Link>
          <Link
            href={`/p/${appointment.businessSlug}/reservar`}
            className="text-sm font-medium text-violet-700"
          >
            Reservar otra cita
          </Link>
        </div>
      </div>
    </main>
  );
}
