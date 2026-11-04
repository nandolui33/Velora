"use server";

import { redirect } from "next/navigation";
import { BookingError, cancelBookingByToken } from "@/modules/scheduling/booking";

export async function cancelByTokenAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const reason = String(formData.get("reason") ?? "");

  if (!token) {
    redirect("/");
  }

  try {
    await cancelBookingByToken({ token, reason: reason || null });
  } catch (error) {
    if (error instanceof BookingError) {
      redirect(`/cita/${encodeURIComponent(token)}?error=${error.code}`);
    }
    throw error;
  }

  redirect(`/cita/${encodeURIComponent(token)}?cancelled=1`);
}
