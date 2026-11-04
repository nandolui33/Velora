"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/guards";
import { withTenant } from "@/lib/tenant";
import {
  anonymizeClient,
  ClientError,
  mergeClients,
  recordConsent,
  updateClientContact,
} from "@/modules/clients/mutations";

const updateSchema = z.object({
  clientId: z.string().uuid(),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
});

const consentSchema = z.object({
  clientId: z.string().uuid(),
  type: z.enum(["privacy", "marketing", "health"]),
  granted: z.enum(["on", "off"]),
  policyVersion: z.string().trim().min(1).max(20),
});

const mergeSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
});

const anonymizeSchema = z.object({
  clientId: z.string().uuid(),
  confirm: z.literal("ANONIMIZAR"),
});

function backTo(clientId: string, params: Record<string, string>): never {
  const query = new URLSearchParams(params).toString();
  redirect(`/app/clientes/${clientId}?${query}`);
}

function parseBirthDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

export async function updateClientAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = updateSchema.safeParse({
    clientId: formData.get("clientId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
    birthDate: formData.get("birthDate"),
  });

  if (!parsed.success) {
    backTo(String(formData.get("clientId") ?? ""), { error: "cliente_datos" });
  }

  try {
    await withTenant(
      { businessId: ctx.business.id, userId: ctx.session.user.id, role: "owner" },
      (tx) =>
        updateClientContact(tx, {
          businessId: ctx.business.id,
          clientId: parsed.data.clientId,
          actorUserId: ctx.session.user.id,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName || null,
          email: parsed.data.email || null,
          phone: parsed.data.phone || null,
          notes: parsed.data.notes || null,
          birthDate: parseBirthDate(parsed.data.birthDate),
        }),
    );
  } catch (error) {
    if (error instanceof ClientError) {
      backTo(parsed.data.clientId, { error: error.code.toLowerCase() });
    }
    throw error;
  }

  revalidatePath(`/app/clientes/${parsed.data.clientId}`);
  backTo(parsed.data.clientId, { saved: "datos" });
}

export async function addConsentAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = consentSchema.safeParse({
    clientId: formData.get("clientId"),
    type: formData.get("type"),
    granted: formData.get("granted"),
    policyVersion: formData.get("policyVersion") ?? "1.0",
  });

  if (!parsed.success) {
    backTo(String(formData.get("clientId") ?? ""), { error: "consentimiento_datos" });
  }

  try {
    await withTenant(
      { businessId: ctx.business.id, userId: ctx.session.user.id, role: "owner" },
      (tx) =>
        recordConsent(tx, {
          businessId: ctx.business.id,
          clientId: parsed.data.clientId,
          type: parsed.data.type,
          granted: parsed.data.granted === "on",
          policyVersion: parsed.data.policyVersion,
          source: "admin",
        }),
    );
  } catch (error) {
    if (error instanceof ClientError) {
      backTo(parsed.data.clientId, { error: error.code.toLowerCase() });
    }
    throw error;
  }

  revalidatePath(`/app/clientes/${parsed.data.clientId}`);
  backTo(parsed.data.clientId, { saved: "consentimiento" });
}

export async function mergeClientAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = mergeSchema.safeParse({
    sourceId: formData.get("sourceId"),
    targetId: formData.get("targetId"),
  });

  if (!parsed.success) {
    backTo(String(formData.get("sourceId") ?? ""), { error: "fusion_datos" });
  }

  try {
    await withTenant(
      { businessId: ctx.business.id, userId: ctx.session.user.id, role: "owner" },
      (tx) =>
        mergeClients(tx, {
          businessId: ctx.business.id,
          sourceId: parsed.data.sourceId,
          targetId: parsed.data.targetId,
          actorUserId: ctx.session.user.id,
        }),
    );
  } catch (error) {
    if (error instanceof ClientError) {
      backTo(parsed.data.sourceId, { error: error.code.toLowerCase() });
    }
    throw error;
  }

  revalidatePath("/app/clientes");
  backTo(parsed.data.targetId, { saved: "fusionado" });
}

export async function anonymizeClientAction(formData: FormData) {
  const ctx = await requireOwner();
  const parsed = anonymizeSchema.safeParse({
    clientId: formData.get("clientId"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    backTo(String(formData.get("clientId") ?? ""), { error: "anonimizar_confirmar" });
  }

  try {
    await withTenant(
      { businessId: ctx.business.id, userId: ctx.session.user.id, role: "owner" },
      (tx) =>
        anonymizeClient(tx, {
          businessId: ctx.business.id,
          clientId: parsed.data.clientId,
          actorUserId: ctx.session.user.id,
        }),
    );
  } catch (error) {
    if (error instanceof ClientError) {
      backTo(parsed.data.clientId, { error: error.code.toLowerCase() });
    }
    throw error;
  }

  revalidatePath("/app/clientes");
  redirect("/app/clientes?saved=anonimizado");
}
