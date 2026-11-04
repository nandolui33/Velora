import Link from "next/link";
import { requireOwner } from "@/lib/guards";
import { withTenant } from "@/lib/tenant";
import {
  createRequirementAction,
  createResourceAction,
  createResourceTypeAction,
} from "./actions";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const savedMessages: Record<string, string> = {
  tipo: "Tipo de recurso creado.",
  recurso: "Recurso creado.",
  requisito: "Requisito guardado.",
};

const errorMessages: Record<string, string> = {
  tipo: "Revisa el nombre del tipo.",
  tipo_guardar: "No se pudo crear el tipo.",
  recurso: "Revisa los datos del recurso.",
  recurso_guardar: "No se pudo crear el recurso. Revisa el código y la sede.",
  requisito: "Revisa el servicio y el tipo de recurso.",
  requisito_guardar: "No se pudo guardar el requisito.",
};

export default async function ResourcesPage({ searchParams }: PageProps) {
  const ctx = await requireOwner();
  const params = await searchParams;

  const data = await withTenant(
    {
      businessId: ctx.business.id,
      userId: ctx.session.user.id,
      role: "owner",
    },
    async (tx) => {
      const resourceTypes = await tx.resourceType.findMany({
        where: { businessId: ctx.business.id },
        include: { resources: { orderBy: { name: "asc" } } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      const services = await tx.service.findMany({
        where: { businessId: ctx.business.id, active: true },
        orderBy: { name: "asc" },
      });
      const requirements = await tx.serviceResourceRequirement.findMany({
        where: { businessId: ctx.business.id },
        include: { service: true, resourceType: true },
        orderBy: { createdAt: "desc" },
      });

      return { resourceTypes, services, requirements };
    },
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            Recursos
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Cabinas, sillones y equipamiento
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Los recursos físicos se reservan junto al profesional. Las
            constraints de PostgreSQL impiden solapamientos.
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
            href="/app/equipo"
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
          >
            Equipo
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

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <section className="space-y-4">
          {data.resourceTypes.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
              No hay recursos todavía. Aplica una plantilla o crea un tipo.
            </div>
          ) : (
            data.resourceTypes.map((type) => (
              <article
                key={type.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-950">
                      {type.name}
                    </h2>
                    <p className="text-xs text-zinc-500">{type.key}</p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
                    {type.resources.length} recurso(s)
                  </span>
                </div>
                {type.description ? (
                  <p className="mt-2 text-sm text-zinc-600">{type.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {type.resources.map((resource) => (
                    <span
                      key={resource.id}
                      className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700"
                    >
                      {resource.name} · {resource.code}
                    </span>
                  ))}
                </div>
              </article>
            ))
          )}

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-950">
              Requisitos por servicio
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Indica qué tipo de recurso necesita cada servicio para poder
              reservarse.
            </p>
            <div className="mt-4 space-y-2">
              {data.requirements.length === 0 ? (
                <p className="text-sm text-zinc-500">Sin requisitos definidos.</p>
              ) : (
                data.requirements.map((requirement) => (
                  <div
                    key={requirement.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-100 px-3 py-2 text-xs"
                  >
                    <span className="text-zinc-700">
                      {requirement.service.name} → {requirement.resourceType.name}
                    </span>
                    <span className="text-zinc-500">
                      x{requirement.quantity}
                      {requirement.required ? " · obligatorio" : " · opcional"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <form
            action={createResourceTypeAction}
            className="rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <h2 className="text-sm font-semibold text-zinc-950">
              Nuevo tipo
            </h2>
            <input
              name="name"
              required
              placeholder="Cabina, sillón, lavacabezas..."
              className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
            />
            <input
              name="description"
              placeholder="Descripción opcional"
              className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Crear tipo
            </button>
          </form>

          <form
            action={createResourceAction}
            className="rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <h2 className="text-sm font-semibold text-zinc-950">
              Nuevo recurso
            </h2>
            <div className="mt-3 space-y-2">
              <select
                name="resourceTypeId"
                required
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
              >
                <option value="">Tipo de recurso</option>
                {data.resourceTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <input
                name="name"
                required
                placeholder="Cabina 1"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
              />
              <input
                name="code"
                required
                placeholder="CAB-1"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="mt-3 w-full rounded-xl bg-violet-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800"
            >
              Crear recurso
            </button>
          </form>

          <form
            action={createRequirementAction}
            className="rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <h2 className="text-sm font-semibold text-zinc-950">
              Nuevo requisito
            </h2>
            <div className="mt-3 space-y-2">
              <select
                name="serviceId"
                required
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
              >
                <option value="">Servicio</option>
                {data.services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <select
                name="resourceTypeId"
                required
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
              >
                <option value="">Tipo de recurso</option>
                {data.resourceTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-zinc-600">
                  Cantidad
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    defaultValue={1}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex items-end gap-2 pb-2 text-xs text-zinc-600">
                  <input
                    name="required"
                    type="checkbox"
                    defaultChecked
                    className="size-4 rounded border-zinc-300"
                  />
                  Obligatorio
                </label>
              </div>
            </div>
            <button
              type="submit"
              className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Guardar requisito
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
