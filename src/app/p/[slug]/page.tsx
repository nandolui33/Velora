import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import {
  getBusinessPreview,
  getPublicBusiness,
} from "@/lib/public-business";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

const weekdayNames = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);

  if (!business) {
    return { title: "Negocio no encontrado · Velora" };
  }

  return {
    title: `${business.name} · Reservas`,
    description:
      business.tagline ??
      business.description ??
      `Reserva cita en ${business.name}.`,
    openGraph: {
      title: business.name,
      description:
        business.tagline ??
        business.description ??
        `Reserva cita en ${business.name}.`,
      type: "website",
    },
  };
}

export default async function PublicBusinessPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { preview } = await searchParams;
  let business = await getPublicBusiness(slug);
  let isPreview = false;

  if (!business && preview === "1") {
    const ctx = await getCurrentContext();

    if (
      ctx?.membership?.role === "owner" &&
      ctx.business?.slug === slug &&
      ctx.business.status === "active"
    ) {
      business = await getBusinessPreview(ctx.business.id);
      isPreview = Boolean(business);
    }
  }

  if (!business) {
    notFound();
  }

  const servicesByCategory = new Map<string, typeof business.services>();
  for (const service of business.services) {
    const key = service.category ?? "Servicios";
    const list = servicesByCategory.get(key) ?? [];
    list.push(service);
    servicesByCategory.set(key, list);
  }

  const address = business.location
    ? [
        business.location.addressLine1,
        business.location.addressLine2,
        `${business.location.postalCode} ${business.location.city}`,
        business.location.province,
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: business.name,
    description: business.description ?? undefined,
    telephone: business.phone ?? business.location?.phone ?? undefined,
    email: business.email ?? business.location?.email ?? undefined,
    url: business.website ?? undefined,
    address: business.location
      ? {
          "@type": "PostalAddress",
          streetAddress: business.location.addressLine1,
          addressLocality: business.location.city,
          postalCode: business.location.postalCode,
          addressCountry: business.location.countryCode,
        }
      : undefined,
    openingHoursSpecification: business.hours
      .filter((hour) => !hour.closed)
      .map((hour) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${
          ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][
            hour.weekday - 1
          ]
        }`,
        opens: hour.opensAt,
        closes: hour.closesAt,
      })),
  };

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c"),
        }}
      />

      {isPreview ? (
        <div className="bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800">
          Vista previa del borrador · solo visible para el propietario ·{" "}
          <Link href="/app/ajustes" className="underline">
            volver a ajustes
          </Link>
        </div>
      ) : null}

      <header className="border-b border-zinc-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <p className="text-sm font-semibold tracking-tight">
            {business.name}
          </p>
          <Link
            href="#servicios"
            className="rounded-full px-4 py-2 text-xs font-semibold text-white"
            style={{ backgroundColor: business.primaryColor }}
          >
            Ver servicios
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: business.primaryColor }}
            >
              Reserva tu cita
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              {business.name}
            </h1>
            {business.tagline ? (
              <p className="mt-3 text-lg text-zinc-600">{business.tagline}</p>
            ) : null}
            {business.description ? (
              <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-600">
                {business.description}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {business.services.length > 0 ? (
                <Link
                  href={`/p/${business.slug}/reservar`}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: business.primaryColor }}
                >
                  Reservar cita
                </Link>
              ) : null}
              <p className="text-xs text-zinc-500">
                Reserva online sin registro. Recibirás la confirmación por email.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
            <h2 className="text-sm font-semibold">Dónde estamos</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {address ?? "Dirección pendiente de configurar."}
            </p>
            <div className="mt-4 space-y-1 text-sm text-zinc-600">
              {business.phone ?? business.location?.phone ? (
                <p>{business.phone ?? business.location?.phone}</p>
              ) : null}
              {business.email ?? business.location?.email ? (
                <p>{business.email ?? business.location?.email}</p>
              ) : null}
              {business.website ? (
                <a
                  href={business.website}
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {business.website}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section id="servicios" className="border-t border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">Servicios</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Precios y duraciones orientativas. La reserva online llegará en la
            Fase 3.
          </p>

          {business.services.length === 0 ? (
            <p className="mt-8 text-sm text-zinc-500">
              El negocio está preparando su catálogo.
            </p>
          ) : (
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              {Array.from(servicesByCategory.entries()).map(
                ([category, services]) => (
                  <div key={category}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {category}
                    </h3>
                    <div className="mt-3 space-y-2">
                      {services.map((service) => (
                        <article
                          key={service.id}
                          className="rounded-2xl border border-zinc-200 bg-white p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-semibold">
                                {service.name}
                              </h4>
                              <p className="mt-1 text-xs text-zinc-500">
                                {service.durationMinutes} min
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold">
                              {money(service.priceCents, service.currency)}
                            </p>
                          </div>
                          {service.description ? (
                            <p className="mt-2 text-xs leading-5 text-zinc-600">
                              {service.description}
                            </p>
                          ) : null}
                          {service.variants.length > 0 ? (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {service.variants.map((variant) => (
                                <li
                                  key={variant.name}
                                  className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600"
                                >
                                  {variant.name} ·{" "}
                                  {money(variant.priceCents, service.currency)}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Equipo</h2>
            <div className="mt-5 space-y-3">
              {business.professionals.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  El equipo se está configurando.
                </p>
              ) : (
                business.professionals.map((professional) => (
                  <article
                    key={professional.id}
                    className="rounded-2xl border border-zinc-200 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="size-10 rounded-full"
                        style={{ backgroundColor: professional.color }}
                      />
                      <div>
                        <h3 className="text-sm font-semibold">
                          {professional.name}
                        </h3>
                        <p className="text-xs text-zinc-500">
                          {professional.title ?? "Profesional"}
                        </p>
                      </div>
                    </div>
                    {professional.bio ? (
                      <p className="mt-3 text-xs leading-5 text-zinc-600">
                        {professional.bio}
                      </p>
                    ) : null}
                    {professional.services.length > 0 ? (
                      <p className="mt-2 text-xs text-zinc-500">
                        {professional.services.join(" · ")}
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Horario</h2>
            <div className="mt-5 space-y-2">
              {business.hours.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Horario pendiente de configurar.
                </p>
              ) : (
                business.hours.map((hour) => (
                  <div
                    key={hour.weekday}
                    className="flex items-center justify-between border-b border-zinc-100 py-2 text-sm"
                  >
                    <span className="text-zinc-600">
                      {weekdayNames[hour.weekday - 1]}
                    </span>
                    <span className="font-medium">
                      {hour.closed
                        ? "Cerrado"
                        : `${hour.opensAt} – ${hour.closesAt}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-100 py-8 text-center text-xs text-zinc-500">
        {business.name} · Hecho con Velora
      </footer>
    </main>
  );
}
