import Link from "next/link";
import { requireOwner } from "@/lib/guards";
import { withTenant } from "@/lib/tenant";
import { listClients } from "@/modules/clients/queries";
import { localDateKey } from "@/modules/scheduling/time";

type SearchParams = { q?: string; page?: string };

function formatDate(value: Date | null, timezone: string) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireOwner();
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const data = await withTenant(
    { businessId: ctx.business.id, userId: ctx.session.user.id, role: "owner" },
    (tx) =>
      listClients(tx, {
        businessId: ctx.business.id,
        search,
        page,
        pageSize: 25,
      }),
  );

  const pageQuery = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    query.set("page", String(target));
    return `/app/clientes?${query.toString()}`;
  };

  const timezone = ctx.business.timezone;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Clientes</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {data.total} fichas{search ? ` para «${search}»` : ""} · {localDateKey(new Date(), timezone)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/clientes/export?format=csv"
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Exportar CSV
          </Link>
          <Link
            href="/app/clientes/export?format=json"
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Exportar JSON
          </Link>
        </div>
      </header>

      <form className="flex flex-wrap gap-2" action="/app/clientes">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Buscar por nombre, email o teléfono"
          className="min-w-64 flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          Buscar
        </button>
        {search ? (
          <Link
            href="/app/clientes"
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Limpiar
          </Link>
        ) : null}
      </form>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Última visita</th>
              <th className="px-4 py-3 font-medium">Citas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  No hay clientes que coincidan.
                </td>
              </tr>
            ) : null}
            {data.items.map((client) => (
              <tr key={client.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/app/clientes/${client.id}`}
                    className="font-medium text-zinc-900 hover:text-violet-700"
                  >
                    {client.firstName} {client.lastName ?? ""}
                  </Link>
                  {client.marketingConsent ? (
                    <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
                      Marketing
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  <p>{client.email ?? "—"}</p>
                  <p className="text-xs text-zinc-500">{client.phone ?? ""}</p>
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {formatDate(client.lastVisitAt, timezone)}
                </td>
                <td className="px-4 py-3 text-zinc-600">{client.appointmentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {data.pages > 1 ? (
        <nav className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">
            Página {data.page} de {data.pages}
          </span>
          <div className="flex gap-2">
            {data.page > 1 ? (
              <Link
                href={pageQuery(data.page - 1)}
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                ← Anterior
              </Link>
            ) : null}
            {data.page < data.pages ? (
              <Link
                href={pageQuery(data.page + 1)}
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Siguiente →
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
