"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/guards";
import { recordAudit } from "@/lib/audit";
import { sendInvitationEmail } from "@/lib/email";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/tokens";
import { withPlatform } from "@/lib/tenant";

const createBusinessSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug no válido"),
  ownerEmail: z.string().trim().toLowerCase().email(),
  planCode: z.string().trim().min(1),
  trialDays: z.coerce.number().int().min(0).max(90),
});

const subscriptionSchema = z.object({
  businessId: z.string().uuid(),
  planCode: z.string().trim().min(1),
  trialDays: z.coerce.number().int().min(0).max(90),
});

const statusSchema = z.object({
  businessId: z.string().uuid(),
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().max(500).optional(),
});

const resendSchema = z.object({
  businessId: z.string().uuid(),
});

function errorRedirect(path: string, code: string): never {
  redirect(`${path}?error=${encodeURIComponent(code)}`);
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
}

function invitationUrl(token: string) {
  return `${appUrl()}/invitacion/${token}`;
}

export async function createBusinessAction(formData: FormData) {
  const session = await requireSuperadmin();
  const parsed = createBusinessSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    ownerEmail: formData.get("ownerEmail"),
    planCode: formData.get("planCode"),
    trialDays: formData.get("trialDays"),
  });

  if (!parsed.success) {
    errorRedirect("/platform/empresas", "datos");
  }

  const token = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let result: { businessId: string; businessName: string } | null = null;

  try {
    result = await withPlatform(async (tx) => {
      const existing = await tx.business.findUnique({
        where: { slug: parsed.data.slug },
        select: { id: true },
      });

      if (existing) {
        throw new Error("SLUG_TAKEN");
      }

      const plan = await tx.plan.findUnique({
        where: { code: parsed.data.planCode },
      });

      if (!plan) {
        throw new Error("PLAN_NOT_FOUND");
      }

      const business = await tx.business.create({
        data: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          status: "active",
          timezone: "Europe/Madrid",
          currency: "EUR",
          locale: "es-ES",
        },
      });

      const location = await tx.location.create({
        data: {
          businessId: business.id,
          name: "Sede principal",
          slug: "principal",
          addressLine1: "Pendiente de completar",
          city: "Pendiente",
          postalCode: "00000",
          countryCode: "ES",
          isDefault: true,
          active: true,
        },
      });

      const trialEndsAt =
        parsed.data.trialDays > 0
          ? new Date(Date.now() + parsed.data.trialDays * 24 * 60 * 60 * 1000)
          : null;

      await tx.subscription.create({
        data: {
          businessId: business.id,
          planId: plan.id,
          status: parsed.data.trialDays > 0 ? "trialing" : "active",
          trialEndsAt,
          provider: "manual",
        },
      });

      await tx.invitation.create({
        data: {
          businessId: business.id,
          emailNormalized: parsed.data.ownerEmail,
          role: "owner",
          locationId: location.id,
          tokenHash,
          invitedBy: session.user.id,
          expiresAt,
        },
      });

      await recordAudit(tx, {
        businessId: business.id,
        actorUserId: session.user.id,
        actorType: "superadmin",
        action: "business.created",
        entityType: "business",
        entityId: business.id,
        metadata: {
          planCode: plan.code,
          ownerEmail: parsed.data.ownerEmail,
        },
      });

      return { businessId: business.id, businessName: business.name };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "SLUG_TAKEN") {
      errorRedirect("/platform/empresas", "slug");
    }
    if (message === "PLAN_NOT_FOUND") {
      errorRedirect("/platform/empresas", "plan");
    }
    errorRedirect("/platform/empresas", "crear");
  }

  let emailFailed = false;

  try {
    await sendInvitationEmail({
      to: parsed.data.ownerEmail,
      businessName: result.businessName,
      invitationUrl: invitationUrl(token),
    });
  } catch {
    emailFailed = true;
  }

  revalidatePath("/platform");
  revalidatePath("/platform/empresas");
  redirect(
    `/platform/empresas/${result.businessId}?created=1${emailFailed ? "&warning=email" : ""}`,
  );
}

export async function updateSubscriptionAction(formData: FormData) {
  const session = await requireSuperadmin();
  const parsed = subscriptionSchema.safeParse({
    businessId: formData.get("businessId"),
    planCode: formData.get("planCode"),
    trialDays: formData.get("trialDays"),
  });

  if (!parsed.success) {
    errorRedirect("/platform/empresas", "datos");
  }

  try {
    await withPlatform(async (tx) => {
      const plan = await tx.plan.findUnique({
        where: { code: parsed.data.planCode },
      });

      if (!plan) {
        throw new Error("PLAN_NOT_FOUND");
      }

      const trialEndsAt =
        parsed.data.trialDays > 0
          ? new Date(Date.now() + parsed.data.trialDays * 24 * 60 * 60 * 1000)
          : null;

      await tx.subscription.update({
        where: { businessId: parsed.data.businessId },
        data: {
          planId: plan.id,
          status: parsed.data.trialDays > 0 ? "trialing" : "active",
          trialEndsAt,
        },
      });

      await recordAudit(tx, {
        businessId: parsed.data.businessId,
        actorUserId: session.user.id,
        actorType: "superadmin",
        action: "subscription.updated",
        entityType: "subscription",
        entityId: parsed.data.businessId,
        metadata: { planCode: plan.code, trialDays: parsed.data.trialDays },
      });
    });
  } catch {
    errorRedirect(
      `/platform/empresas/${parsed.data.businessId}`,
      "suscripcion",
    );
  }

  revalidatePath(`/platform/empresas/${parsed.data.businessId}`);
  redirect(`/platform/empresas/${parsed.data.businessId}?updated=plan`);
}

export async function setBusinessStatusAction(formData: FormData) {
  const session = await requireSuperadmin();
  const parsed = statusSchema.safeParse({
    businessId: formData.get("businessId"),
    status: formData.get("status"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    errorRedirect("/platform/empresas", "datos");
  }

  await withPlatform(async (tx) => {
    await tx.business.update({
      where: { id: parsed.data.businessId },
      data: { status: parsed.data.status },
    });

    await recordAudit(tx, {
      businessId: parsed.data.businessId,
      actorUserId: session.user.id,
      actorType: "superadmin",
      action:
        parsed.data.status === "suspended"
          ? "business.suspended"
          : "business.reactivated",
      entityType: "business",
      entityId: parsed.data.businessId,
      metadata: { reason: parsed.data.reason ?? null },
    });
  });

  revalidatePath("/platform");
  revalidatePath("/platform/empresas");
  revalidatePath(`/platform/empresas/${parsed.data.businessId}`);
  redirect(
    `/platform/empresas/${parsed.data.businessId}?updated=${parsed.data.status}`,
  );
}

export async function resendInvitationAction(formData: FormData) {
  const session = await requireSuperadmin();
  const parsed = resendSchema.safeParse({
    businessId: formData.get("businessId"),
  });

  if (!parsed.success) {
    errorRedirect("/platform/empresas", "datos");
  }

  const token = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let result: { email: string; businessName: string } | null = null;

  try {
    result = await withPlatform(async (tx) => {
      const business = await tx.business.findUnique({
        where: { id: parsed.data.businessId },
        select: { name: true },
      });

      const [owner, pendingInvitation, defaultLocation] = await Promise.all([
        tx.membership.findFirst({
          where: {
            businessId: parsed.data.businessId,
            role: "owner",
            status: "active",
          },
          include: { user: { select: { email: true } } },
        }),
        tx.invitation.findFirst({
          where: {
            businessId: parsed.data.businessId,
            acceptedAt: null,
            revokedAt: null,
          },
          orderBy: { createdAt: "desc" },
        }),
        tx.location.findFirst({
          where: { businessId: parsed.data.businessId, isDefault: true },
        }),
      ]);

      const email = pendingInvitation?.emailNormalized ?? owner?.user.email;

      if (!business || !email) {
        throw new Error("OWNER_NOT_FOUND");
      }

      await tx.invitation.updateMany({
        where: {
          businessId: parsed.data.businessId,
          emailNormalized: email.toLowerCase(),
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      await tx.invitation.create({
        data: {
          businessId: parsed.data.businessId,
          emailNormalized: email.toLowerCase(),
          role: "owner",
          locationId: defaultLocation?.id,
          tokenHash,
          invitedBy: session.user.id,
          expiresAt,
        },
      });

      await recordAudit(tx, {
        businessId: parsed.data.businessId,
        actorUserId: session.user.id,
        actorType: "superadmin",
        action: "invitation.resent",
        entityType: "invitation",
        entityId: parsed.data.businessId,
        metadata: { email },
      });

      return { email, businessName: business.name };
    });
  } catch {
    errorRedirect(
      `/platform/empresas/${parsed.data.businessId}`,
      "invitacion",
    );
  }

  try {
    await sendInvitationEmail({
      to: result.email,
      businessName: result.businessName,
      invitationUrl: invitationUrl(token),
    });
  } catch {
    errorRedirect(
      `/platform/empresas/${parsed.data.businessId}`,
      "email",
    );
  }

  revalidatePath(`/platform/empresas/${parsed.data.businessId}`);
  redirect(`/platform/empresas/${parsed.data.businessId}?updated=invitation`);
}
