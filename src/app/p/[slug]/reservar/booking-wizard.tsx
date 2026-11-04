"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Professional = { id: string; name: string; color: string };

export type WizardCatalog = {
  slug: string;
  name: string;
  timezone: string;
  currency: string;
  dates: { key: string; label: string }[];
  services: {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    priceCents: number;
    currency: string;
    professionals: Professional[];
    variants: { id: string; name: string; durationMinutes: number; priceCents: number }[];
  }[];
};

type Slot = {
  startsAt: string;
  serviceEndsAt: string;
  professionalId: string;
  professionalName: string;
  professionalColor: string;
  resources: { id: string; name: string }[];
};

const errorMessages: Record<string, string> = {
  SLOT_TAKEN: "Ese hueco acaba de ocuparse. Elige otro horario.",
  RESOURCE_TAKEN: "El recurso necesario acaba de ocuparse. Prueba otro horario.",
  SERVICE_NOT_AVAILABLE: "Ese servicio ya no está disponible.",
  PROFESSIONAL_NOT_AVAILABLE: "Ese profesional ya no está disponible.",
  INVALID_INPUT: "Revisa los datos: hacen falta el nombre y un email o teléfono.",
  IDEMPOTENCY_CONFLICT: "La reserva cambió mientras la enviabas. Vuelve a intentarlo.",
  BUSINESS_NOT_FOUND: "Este negocio ya no acepta reservas.",
};

function formatTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatFullDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function BookingWizard({ catalog }: { catalog: WizardCatalog }) {
  const [serviceId, setServiceId] = useState(catalog.services[0]?.id ?? "");
  const [variantId, setVariantId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState(catalog.dates[0]?.key ?? "");
  const [slotsState, setSlotsState] = useState<{ key: string; slots: Slot[] }>({
    key: "",
    slots: [],
  });
  const [selected, setSelected] = useState<Slot | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    reference: string;
    startsAt: string;
    professionalName: string;
  } | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
  });
  const idempotencyKey = useRef("");

  const service = catalog.services.find((item) => item.id === serviceId);
  const requestKey = `${serviceId}|${variantId}|${professionalId}|${date}`;
  const slots = slotsState.key === requestKey ? slotsState.slots : [];
  const loading = Boolean(serviceId && date) && slotsState.key !== requestKey;
  const selectedSlot =
    slots.find((slot) => slot.startsAt === selected?.startsAt) ?? null;

  useEffect(() => {
    idempotencyKey.current = crypto.randomUUID();
  }, []);

  useEffect(() => {
    if (!serviceId || !date) {
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ serviceId, date, days: "1" });

    if (professionalId) params.set("professionalId", professionalId);
    if (variantId) params.set("variantId", variantId);

    fetch(`/api/v1/public/${catalog.slug}/availability?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data: { days?: { slots: Slot[] }[] }) => {
        setSlotsState({ key: requestKey, slots: data.days?.[0]?.slots ?? [] });
      })
      .catch((cause) => {
        if (cause instanceof Error && cause.name !== "AbortError") {
          setError("No se pudo cargar la disponibilidad. Inténtalo de nuevo.");
        }
      });

    return () => controller.abort();
  }, [requestKey, serviceId, professionalId, date, variantId, catalog.slug]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSlot) {
      setError("Elige un horario antes de confirmar.");
      return;
    }

    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch(`/api/v1/public/${catalog.slug}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          serviceVariantId: variantId || null,
          professionalId: professionalId || selectedSlot.professionalId,
          startsAt: selectedSlot.startsAt,
          notes: form.notes || null,
          idempotencyKey: idempotencyKey.current,
          client: {
            firstName: form.firstName,
            lastName: form.lastName || null,
            phone: form.phone || null,
            email: form.email || null,
          },
        }),
      });

      const payload = (await response.json()) as {
        booking?: { reference: string; startsAt: string; professionalName: string };
        error?: string;
      };

      if (!response.ok || !payload.booking) {
        setError(
          errorMessages[payload.error ?? ""] ??
            "No se pudo completar la reserva. Inténtalo de nuevo.",
        );
        setStatus("idle");
        return;
      }

      setResult(payload.booking);
      setStatus("done");
    } catch {
      setError("No hay conexión con el servidor. Inténtalo de nuevo.");
      setStatus("idle");
    }
  }

  if (status === "done" && result) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Reserva confirmada
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-emerald-950">
          ¡Te esperamos!
        </h2>
        <p className="mt-3 text-sm text-emerald-900">
          {result.professionalName} · {formatFullDate(result.startsAt, catalog.timezone)}
        </p>
        <p className="mt-1 text-sm text-emerald-900">
          Referencia <span className="font-mono font-semibold">{result.reference}</span>
        </p>
        <p className="mt-4 text-sm text-emerald-800">
          Te hemos enviado un email con los detalles y un enlace para cancelar si
          lo necesitas.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/p/${catalog.slug}`}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Volver al negocio
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">1. Elige el servicio</h2>
          <div className="mt-3 space-y-2">
            {catalog.services.map((item) => (
              <label
                key={item.id}
                className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                  serviceId === item.id
                    ? "border-violet-500 bg-violet-50"
                    : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span>
                  <input
                    type="radio"
                    name="service"
                    className="sr-only"
                    checked={serviceId === item.id}
                    onChange={() => {
                      setServiceId(item.id);
                      setVariantId("");
                      setProfessionalId("");
                      setSelected(null);
                    }}
                  />
                  <span className="block font-semibold text-zinc-900">{item.name}</span>
                  <span className="block text-xs text-zinc-500">
                    {item.durationMinutes} min
                    {item.description ? ` · ${item.description}` : ""}
                  </span>
                </span>
                <span className="whitespace-nowrap text-sm font-semibold text-zinc-900">
                  {formatPrice(item.priceCents, item.currency)}
                </span>
              </label>
            ))}
          </div>

          {service && service.variants.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-zinc-700">Variante</p>
              <select
                value={variantId}
                onChange={(event) => {
                  setVariantId(event.target.value);
                  setSelected(null);
                }}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
              >
                <option value="">Duración y precio estándar</option>
                {service.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name} · {variant.durationMinutes} min ·{" "}
                    {formatPrice(variant.priceCents, service.currency)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">2. Profesional</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setProfessionalId("");
                setSelected(null);
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                professionalId === ""
                  ? "border-violet-700 bg-violet-700 text-white"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Cualquiera disponible
            </button>
            {(service?.professionals ?? []).map((professional) => (
              <button
                key={professional.id}
                type="button"
                onClick={() => {
                  setProfessionalId(professional.id);
                  setSelected(null);
                }}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  professionalId === professional.id
                    ? "border-violet-700 bg-violet-700 text-white"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: professional.color }}
                />
                {professional.name}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">3. Día y hora</h2>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {catalog.dates.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  setDate(option.key);
                  setSelected(null);
                }}
                className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-medium ${
                  date === option.key
                    ? "border-violet-700 bg-violet-700 text-white"
                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-zinc-500">Buscando huecos…</p>
            ) : slots.length === 0 ? (
              <p className="rounded-xl bg-zinc-50 px-3 py-4 text-sm text-zinc-500">
                No quedan huecos ese día. Prueba otro.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() => setSelected(slot)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                      selectedSlot?.startsAt === slot.startsAt
                        ? "border-violet-700 bg-violet-700 text-white"
                        : "border-zinc-300 text-zinc-800 hover:bg-zinc-50"
                    }`}
                  >
                    {formatTime(slot.startsAt, catalog.timezone)}
                    {!professionalId ? (
                      <span className="ml-1 text-[10px] font-normal opacity-70">
                        {slot.professionalName}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <aside className="h-fit rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">4. Tus datos</h2>

        {selectedSlot ? (
          <p className="mt-2 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-900">
            {formatFullDate(selectedSlot.startsAt, catalog.timezone)} ·{" "}
            {selectedSlot.professionalName}
          </p>
        ) : (
          <p className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
            Elige un horario para continuar.
          </p>
        )}

        <form onSubmit={submit} className="mt-4 space-y-2">
          <input
            required
            placeholder="Nombre"
            value={form.firstName}
            onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Apellidos"
            value={form.lastName}
            onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            inputMode="tel"
            placeholder="Teléfono"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="¿Algo que debamos saber? (opcional)"
            rows={2}
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />

          <p className="text-[11px] leading-5 text-zinc-500">
            Al reservar aceptas la política de cancelación del negocio. Usaremos
            tus datos solo para gestionar la cita.
          </p>

          {error ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!selectedSlot || status === "submitting"}
            className="w-full rounded-xl bg-violet-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "submitting" ? "Confirmando…" : "Confirmar reserva"}
          </button>
        </form>
      </aside>
    </div>
  );
}
