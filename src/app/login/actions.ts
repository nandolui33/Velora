"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

function safeRedirectTo(value: FormDataEntryValue | null) {
  const redirectTo = String(value ?? "/app");
  return redirectTo.startsWith("/") && !redirectTo.startsWith("//")
    ? redirectTo
    : "/app";
}

export async function signInWithGoogle(formData: FormData) {
  const redirectTo = safeRedirectTo(formData.get("redirectTo"));

  try {
    await signIn("google", { redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=google&callbackUrl=${encodeURIComponent(redirectTo)}`);
    }
    throw error;
  }
}

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const redirectTo = safeRedirectTo(formData.get("redirectTo"));

  if (!email || !email.includes("@")) {
    redirect(`/login?error=email&callbackUrl=${encodeURIComponent(redirectTo)}`);
  }

  try {
    await signIn("nodemailer", { email, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(
        `/login?error=email_send&callbackUrl=${encodeURIComponent(redirectTo)}`,
      );
    }
    throw error;
  }
}
