import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentContext } from "@/lib/current-context";

export async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session;
}

export async function requireSuperadmin() {
  const session = await auth();

  if (!session?.user?.isSuperadmin) {
    notFound();
  }

  return session;
}

export async function requireOwner() {
  const ctx = await getCurrentContext();

  if (!ctx?.membership || !ctx.business) {
    redirect("/app");
  }

  if (ctx.membership.role !== "owner" || ctx.business.status !== "active") {
    notFound();
  }

  return {
    ...ctx,
    membership: ctx.membership,
    business: ctx.business,
  };
}
