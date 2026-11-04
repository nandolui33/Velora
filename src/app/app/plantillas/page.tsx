import Link from "next/link";
import { requireOwner } from "@/lib/guards";
import { sectorTemplates } from "@/lib/sector-templates";
import { applyTemplateAction } from "./actions";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const errorMessages: Record<string, string> = {
  plantilla: "La plantilla seleccionada no es válida.",
  aplicar: "No se pudo aplicar la plantilla. Revisa la sede principal.",
};

export default async function TemplatesPage({ searchParams }: PageProps) {
  const ctx = await requireOwner();
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            Catálogo
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Plantillas sectoriales
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Aplican una propuesta inicial de categorías, servicios, tipos de
            recurso y recursos. No borran ni duplican lo que ya existe.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/servicios"
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
          >
            Ver catálogo
          </Link>
          <Link
            href="/app"
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
          >
            Volver
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
        Plantilla actual:{" "}
        <strong>
          {ctx.business.sector
            ? sectorTemplates.find((t) => t.key === ctx.business.sector)?.label
            : "ninguna"}
        </strong>
        {ctx.business.templateVersion ? (
          <span className="text-violet-700">
            {" "}
            · versión {ctx.business.templateVersion}
          </span>
        ) : null}
      </div>

      {params.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Plantilla aplicada. Los elementos existentes se han conservado.
        </p>
      ) : null}

      {params.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessages[params.error] ?? "No se pudo aplicar la plantilla."}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sectorTemplates.map((template) => {
          const isCurrent = ctx.business.sector === template.key;
          return (
            <article
              key={template.key}
              className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">
                    {template.label}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    v{template.version}
                  </p>
                </div>
                {isCurrent ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Aplicada
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {template.description}
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-zinc-600">
                {template.services.slice(0, 4).map((service) => (
                  <li key={service.name}>
                    · {service.name} · {(service.priceCents / 100).toFixed(0)} €
                  </li>
                ))}
                {template.services.length > 4 ? (
                  <li className="text-zinc-400">
                    + {template.services.length - 4} servicios más
                  </li>
                ) : null}
              </ul>
              <p className="mt-3 text-xs text-zinc-500">
                {template.resourceTypes.length} tipo(s) de recurso ·{" "}
                {template.resourceTypes.length} recurso(s) inicial(es)
              </p>
              <form action={applyTemplateAction} className="mt-auto pt-5">
                <input type="hidden" name="sector" value={template.key} />
                <button
                  type="submit"
                  className={
                    isCurrent
                      ? "w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                      : "w-full rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800"
                  }
                >
                  {isCurrent ? "Volver a aplicar" : "Aplicar plantilla"}
                </button>
              </form>
            </article>
          );
        })}
      </div>
    </div>
  );
}
