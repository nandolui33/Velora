import Link from "next/link";
import { requireOwner } from "@/lib/guards";
import { withTenant } from "@/lib/tenant";
import {
  createCategoryAction,
  createServiceAction,
  createVariantAction,
  toggleServiceAction,
} from "./actions";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const savedMessages: Record<string, string> = {
  categoria: "Categoría creada.",
  servicio: "Servicio creado.",
  variante: "Variante añadida.",
};

const errorMessages: Record<string, string> = {
  categoria: "Revisa el nombre de la categoría.",
  categoria_guardar: "No se pudo crear la categoría. Puede que el slug ya exista.",
  servicio: "Revisa los datos del servicio.",
  servicio_guardar: "No se pudo crear el servicio.",
  variante: "Revisa los datos de la variante.",
  variante_guardar: "No se pudo crear la variante.",
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export default async function ServicesPage({ searchParams }: PageProps) {
  const ctx = await requireOwner();
  const params = await searchParams;

  const data = await withTenant(
    {
      businessId: ctx.business.id,
      userId: ctx.session.user.id,
      role: "owner",
    },
    async (tx) => {
      const categories = await tx.serviceCategory.findMany({
        where: { businessId: ctx.business.id },
        orderBy: { sortOrder: "asc" },
      });
      const services = await tx.service.findMany({
        where: { businessId: ctx.business.id },
        include: {
          category: true,
          variants: { orderBy: { sortOrder: "asc" } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });

      return { categories, services };
    },
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            Catálogo
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Servicios
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Categorías, servicios y variantes de precio o duración.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/plantillas"
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
          >
            Plantillas
          </Link>
          <Link
            href="/app/equipo"
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
          >
            Equipo
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
          {data.services.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
              No hay servicios todavía. Aplica una plantilla o crea el primero.
            </div>
          ) : (
            data.services.map((service) => (
              <article
                key={service.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-violet-700">
                      {service.category?.name ?? "Sin categoría"}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-zinc-950">
                      {service.name}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      {service.durationMinutes} min ·{" "}
                      {money(service.priceCents, service.currency)} ·{" "}
                      {service.active ? "Activo" : "Inactivo"}
                    </p>
                  </div>
                  <form action={toggleServiceAction}>
                    <input type="hidden" name="serviceId" value={service.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={service.active ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                    >
                      {service.active ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </div>

                {service.description ? (
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {service.description}
                  </p>
                ) : null}

                {service.variants.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {service.variants.map((variant) => (
                      <li
                        key={variant.id}
                        className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700"
                      >
                        {variant.name} · {variant.durationMinutes} min ·{" "}
                        {money(variant.priceCents, service.currency)}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-medium text-violet-700">
                    Añadir variante
                  </summary>
                  <form
                    action={createVariantAction}
                    className="mt-3 grid gap-2 sm:grid-cols-[1fr_100px_110px_auto]"
                  >
                    <input type="hidden" name="serviceId" value={service.id} />
                    <input
                      name="name"
                      required
                      placeholder="Nombre de la variante"
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <input
                      name="durationMinutes"
                      type="number"
                      min={5}
                      defaultValue={service.durationMinutes}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <input
                      name="price"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={(service.priceCents / 100).toFixed(2)}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Añadir
                    </button>
                  </form>
                </details>
              </article>
            ))
          )}
        </section>

        <aside className="space-y-4">
          <form
            action={createCategoryAction}
            className="rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <h2 className="text-sm font-semibold text-zinc-950">
              Nueva categoría
            </h2>
            <input
              name="name"
              required
              placeholder="Color, Cortes, Masajes..."
              className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Crear categoría
            </button>
          </form>

          <form
            action={createServiceAction}
            className="rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <h2 className="text-sm font-semibold text-zinc-950">
              Nuevo servicio
            </h2>
            <div className="mt-3 space-y-3">
              <input
                name="name"
                required
                placeholder="Nombre del servicio"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
              />
              <select
                name="categoryId"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
              >
                <option value="">Sin categoría</option>
                {data.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <textarea
                name="description"
                rows={2}
                placeholder="Descripción breve"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-zinc-600">
                  Duración (min)
                  <input
                    name="durationMinutes"
                    type="number"
                    min={5}
                    defaultValue={30}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs text-zinc-600">
                  Precio (€)
                  <input
                    name="price"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue="0"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs text-zinc-600">
                  Margen (min)
                  <input
                    name="bufferAfterMinutes"
                    type="number"
                    min={0}
                    defaultValue={0}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex items-end gap-2 pb-2 text-xs text-zinc-600">
                  <input
                    name="onlineBookable"
                    type="checkbox"
                    defaultChecked
                    className="size-4 rounded border-zinc-300"
                  />
                  Reservable online
                </label>
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-violet-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800"
            >
              Crear servicio
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
