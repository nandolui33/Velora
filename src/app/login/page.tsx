import Link from "next/link";
import { signInWithEmail, signInWithGoogle } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; checkEmail?: string }>;
};

const errors: Record<string, string> = {
  google: "No se pudo iniciar sesión con Google. Inténtalo de nuevo.",
  email: "Introduce un email válido.",
  email_send: "No se pudo enviar el enlace. Revisa el proveedor de email.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error ? errors[params.error] : null;
  const checkEmail = params.checkEmail === "1";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-2xl bg-violet-700 text-lg font-semibold text-white">
          V
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight">Velora</p>
          <p className="text-xs text-zinc-500">Acceso al panel</p>
        </div>
      </Link>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Entra en tu negocio
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Sin contraseñas. Usa Google o recibe un enlace mágico por email.
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        {checkEmail ? (
          <p
            role="status"
            className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            Revisa tu email. El enlace caduca en unos minutos.
          </p>
        ) : null}

        <form action={signInWithGoogle} className="mt-6">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
          >
            Continuar con Google
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200" />
          o
          <span className="h-px flex-1 bg-zinc-200" />
        </div>

        <form action={signInWithEmail} className="space-y-3">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-800"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="tu@negocio.es"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-800"
          >
            Recibir enlace de acceso
          </button>
        </form>

        <p className="mt-6 text-xs leading-5 text-zinc-500">
          El acceso está limitado a negocios dados de alta. Si tu cuenta no
          tiene acceso, contacta con soporte.
        </p>
      </div>
    </main>
  );
}
