import { notFound } from "next/navigation";
import { getPublicBookingCatalog } from "@/modules/booking/public";
import { localDateKey, localParts } from "@/modules/scheduling/time";
import { BookingWizard } from "./booking-wizard";

export const dynamic = "force-dynamic";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalog = await getPublicBookingCatalog(slug);

  if (!catalog) {
    notFound();
  }

  const now = new Date();
  const todayKey = localDateKey(now, catalog.timezone);
  const [year, month, day] = todayKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 12));

  const dates = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const parts = localParts(date, catalog.timezone);

    return {
      key,
      label: new Intl.DateTimeFormat("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: catalog.timezone,
      }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12))),
    };
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
          Reserva online
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950">
          {catalog.name}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {catalog.locationName} · {catalog.addressLine}
        </p>
      </header>

      <BookingWizard
        catalog={{
          slug: catalog.slug,
          name: catalog.name,
          timezone: catalog.timezone,
          currency: catalog.currency,
          dates,
          services: catalog.services.map((service) => ({
            id: service.id,
            name: service.name,
            description: service.description,
            durationMinutes: service.durationMinutes,
            priceCents: service.priceCents,
            currency: service.currency,
            professionals: service.professionals,
            variants: service.variants,
          })),
        }}
      />
    </main>
  );
}
