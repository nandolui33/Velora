import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signOutAction } from "./actions";

const navigation = [
  { href: "/app", label: "Resumen" },
  { href: "/app/agenda", label: "Agenda" },
  { href: "/app/clientes", label: "Clientes" },
  { href: "/app/servicios", label: "Servicios" },
  { href: "/app/equipo", label: "Equipo" },
  { href: "/app/recursos", label: "Recursos" },
  { href: "/app/plantillas", label: "Plantillas" },
  { href: "/app/ajustes", label: "Ajustes" },
];

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white px-4 py-6 sm:flex sm:flex-col">
          <Link href="/" className="flex items-center gap-3 px-2">
            <div className="grid size-9 place-items-center rounded-xl bg-violet-700 text-sm font-semibold text-white">
              V
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Velora</p>
              <p className="text-xs text-zinc-500">Fase 5</p>
            </div>
          </Link>

          <nav className="mt-10 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
              >
                {item.label}
              </Link>
            ))}
            {session.user.isSuperadmin ? (
              <Link
                href="/platform"
                className="block rounded-xl px-3 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-50"
              >
                Plataforma
              </Link>
            ) : null}
          </nav>

          <div className="mt-auto rounded-2xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-500">
            Sesión de {session.user.email ?? "usuario"}.
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 sm:px-8">
            <div>
              <p className="text-sm font-semibold text-zinc-950">
                Panel del negocio
              </p>
              <p className="text-xs text-zinc-500">
                Agenda, clientes y negocio
              </p>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Salir
              </button>
            </form>
          </header>
          <main className="px-4 py-6 sm:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
