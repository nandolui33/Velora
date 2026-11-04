import Link from "next/link";

const modules = [
  {
    title: "Agenda",
    body: "Citas por profesional y sede, con estados y cobro manual.",
  },
  {
    title: "Recursos",
    body: "Cabinas, camillas, puestos y sillones con exclusividad real.",
  },
  {
    title: "Plantillas",
    body: "Siete sectores, un único motor y configuración inicial editable.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 sm:py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-violet-700 text-lg font-semibold text-white shadow-sm">
            V
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">Velora</p>
            <p className="text-xs text-zinc-500">Belleza y bienestar</p>
          </div>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 font-medium text-zinc-700 transition hover:bg-white hover:shadow-sm"
          >
            Entrar
          </Link>
          <Link
            href="/app"
            className="rounded-full bg-zinc-900 px-4 py-2 font-medium text-white transition hover:bg-zinc-700"
          >
            Ir al panel
          </Link>
        </nav>
      </header>

      <section className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
            Fase 2 · Catálogo y página pública
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
            La agenda que también entiende de cabinas y camillas.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
            Velora es un SaaS multiempresa para peluquerías, barberías, centros
            de estética, spas y salones de uñas. Una cita puede necesitar un
            profesional y un recurso físico al mismo tiempo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800"
            >
              Probar el acceso
            </Link>
            <Link
              href="/app"
              className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
            >
              Ver panel de demo
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <div>
              <p className="text-sm font-semibold">Hoy · Móstoles</p>
              <p className="text-xs text-zinc-500">Alcázar Peluqueros</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Abierto
            </span>
          </div>
          <div className="space-y-3 pt-4">
            {[
              ["09:30", "Ana", "Corte y peinado", "Sillón 1"],
              ["11:00", "Ana", "Color", "Sillón 1"],
              ["12:30", "Luis", "Corte caballero", "Sillón 1"],
            ].map(([time, pro, service, resource]) => (
              <div
                key={`${time}-${pro}`}
                className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3"
              >
                <div className="w-12 text-sm font-semibold text-zinc-700">
                  {time}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {service}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {pro} · {resource}
                  </p>
                </div>
                <span className="size-2 rounded-full bg-violet-500" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-t border-zinc-200 py-10 sm:grid-cols-3">
        {modules.map((module) => (
          <article
            key={module.title}
            className="rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <h2 className="text-sm font-semibold text-zinc-950">
              {module.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{module.body}</p>
          </article>
        ))}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 py-6 text-xs text-zinc-500">
        <span>Velora · Fase 2</span>
        <span>Next.js · TypeScript · PostgreSQL · Prisma</span>
      </footer>
    </main>
  );
}
