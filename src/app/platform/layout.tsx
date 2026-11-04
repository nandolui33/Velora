import Link from "next/link";
import { requireSuperadmin } from "@/lib/guards";

const navigation = [
  { href: "/platform", label: "Resumen" },
  { href: "/platform/empresas", label: "Empresas" },
  { href: "/platform/planes", label: "Planes" },
];

export default async function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSuperadmin();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 px-4 py-6 sm:flex sm:flex-col">
          <Link href="/" className="flex items-center gap-3 px-2">
            <div className="grid size-9 place-items-center rounded-xl bg-violet-500 text-sm font-semibold text-white">
              V
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Velora</p>
              <p className="text-xs text-zinc-500">Plataforma</p>
            </div>
          </Link>
          <nav className="mt-10 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-zinc-400">
            {session.user.email}
            <br />
            Superadministrador
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-8">
            <div>
              <p className="text-sm font-semibold">Plataforma Velora</p>
              <p className="text-xs text-zinc-500">
                Empresas, planes y soporte
              </p>
            </div>
            <Link
              href="/app"
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/5"
            >
              Ir al panel
            </Link>
          </header>
          <main className="px-4 py-6 sm:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
