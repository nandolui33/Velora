"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { recordAudit } from "@/lib/audit";
import { findInvitationByToken, invitationState } from "@/lib/invitations";
import { withTenant } from "@/lib/tenant";
import { hashOpaqueToken } from "@/lib/tokens";

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invitacion/${token}`)}`);
  }

  const invitation = await findInvitationByToken(token);

  if (!invitation || invitationState(invitation) !== "pending") {
    redirect(`/invitacion/${token}?error=invalid`);
  }

  const sessionEmail = session.user.email.toLowerCase().trim();

  if (sessionEmail !== invitation.email_normalized) {
    redirect(`/invitacion/${token}?error=email`);
  }

  await withTenant(
    {
      businessId: invitation.business_id,
      userId: session.user.id,
      role: "owner",
    },
    async (tx) => {
      const current = await tx.invitation.findUnique({
        where: { tokenHash: hashOpaqueToken(token) },
      });

      if (!current || current.acceptedAt || current.revokedAt) {
        throw new Error("La invitación ya no está disponible");
      }

      if (current.expiresAt.getTime() <= Date.now()) {
        throw new Error("La invitación ha caducado");
      }

      await tx.membership.upsert({
        where: {
          businessId_userId: {
            businessId: invitation.business_id,
            userId: session.user.id,
          },
        },
        update: {
          role: invitation.role,
          status: "active",
          professionalId: invitation.professional_id,
        },
        create: {
          businessId: invitation.business_id,
          userId: session.user.id,
          role: invitation.role,
          status: "active",
          professionalId: invitation.professional_id,
        },
      });

      if (invitation.professional_id && invitation.location_id) {
        await tx.professionalLocation.upsert({
          where: {
            businessId_professionalId_locationId: {
              businessId: invitation.business_id,
              professionalId: invitation.professional_id,
              locationId: invitation.location_id,
            },
          },
          update: { active: true },
          create: {
            businessId: invitation.business_id,
            professionalId: invitation.professional_id,
            locationId: invitation.location_id,
            isPrimary: true,
            active: true,
          },
        });
      }

      await tx.invitation.update({
        where: { id: current.id },
        data: { acceptedAt: new Date() },
      });

      await recordAudit(tx, {
        businessId: invitation.business_id,
        actorUserId: session.user.id,
        actorType: "user",
        action: "invitation.accepted",
        entityType: "invitation",
        entityId: current.id,
        metadata: { role: invitation.role },
      });
    },
  );

  redirect("/app");
}
