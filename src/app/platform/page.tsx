import { notFound } from "next/navigation";
import { auth } from "@/auth";

export default async function PlatformPage() {
  const session = await auth();

  if (!session?.user?.isSuperadmin) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
        Plataforma
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
        Superadministración
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
        Área reservada al equipo de Velora. El alta de empresas, planes y
        métricas globales se implementa en la Fase 1.
      </p>
    </main>
  );
}
