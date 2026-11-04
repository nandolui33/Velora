import Link from "next/link";
import { auth } from "@/auth";
import {
  findInvitationByToken,
  invitationState,
} from "@/lib/invitations";
import { acceptInvitation } from "./actions";

type InvitationPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  invalid: "La invitación no existe, ha caducado o ya se ha utilizado.",
  email:
    "Has iniciado sesión con otro email. Cierra sesión y entra con el email invitado.",
};

export default async function InvitationPage({
  params,
  searchParams,
}: InvitationPageProps) {
  const { token } = await params;
  const { error } = await searchParams;
  const invitation = await findInvitationByToken(token);
  const session = await auth();
  const state = invitation ? invitationState(invitation) : null;
  const sessionEmail = session?.user?.email?.toLowerCase().trim();
  const emailMatches =
    Boolean(invitation) && sessionEmail === invitation?.email_normalized;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-10">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-2xl bg-violet-700 text-lg font-semibold text-white">
          V
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight">Velora</p>
          <p className="text-xs text-zinc-500">Invitación</p>
        </div>
      </Link>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        {error ? (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {errorMessages[error] ?? "No se pudo completar la invitación."}
          </p>
        ) : null}

        {!invitation ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Invitación no válida
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              El enlace no existe o ha sido revocado. Pide una nueva invitación
              al administrador del negocio.
            </p>
          </>
        ) : state !== "pending" ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Invitación no disponible
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {state === "accepted"
                ? "Esta invitación ya se ha aceptado."
                : state === "expired"
                  ? "Esta invitación ha caducado."
                  : "Esta invitación ha sido revocada."}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              {invitation.business_name}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
              Acepta tu invitación
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Invitación para <strong>{invitation.email_normalized}</strong> con
              rol <strong>{invitation.role === "owner" ? "propietario" : "profesional"}</strong>.
            </p>

            {!session ? (
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/invitacion/${token}`)}`}
                className="mt-6 inline-flex rounded-xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-800"
              >
                Entrar para aceptar
              </Link>
            ) : emailMatches ? (
              <form action={acceptInvitation} className="mt-6">
                <input type="hidden" name="token" value={token} />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-800"
                >
                  Aceptar invitación
                </button>
              </form>
            ) : (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Estás conectado como <strong>{session.user.email}</strong>. Para
                aceptar, entra con <strong>{invitation.email_normalized}</strong>.
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
