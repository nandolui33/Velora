import type { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashOpaqueToken } from "@/lib/tokens";

export type InvitationLookup = {
  id: string;
  business_id: string;
  business_name: string;
  email_normalized: string;
  role: MembershipRole;
  professional_id: string | null;
  location_id: string | null;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
};

export async function findInvitationByToken(rawToken: string) {
  if (!rawToken) {
    return null;
  }

  const rows = await prisma.$queryRaw<InvitationLookup[]>`
    SELECT *
    FROM get_invitation_by_token(${hashOpaqueToken(rawToken)})
  `;

  return rows[0] ?? null;
}

export function invitationState(invitation: InvitationLookup) {
  if (invitation.accepted_at) {
    return "accepted" as const;
  }
  if (invitation.revoked_at) {
    return "revoked" as const;
  }
  if (invitation.expires_at.getTime() <= Date.now()) {
    return "expired" as const;
  }
  return "pending" as const;
}
