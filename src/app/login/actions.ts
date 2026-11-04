"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export async function signInWithGoogle() {
  try {
    await signIn("google", { redirectTo: "/app" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=google");
    }
    throw error;
  }
}

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email || !email.includes("@")) {
    redirect("/login?error=email");
  }

  try {
    await signIn("nodemailer", { email, redirectTo: "/app" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=email_send");
    }
    throw error;
  }
}
