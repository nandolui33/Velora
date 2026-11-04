import { auth } from "@/auth";
import { withTenant, withUser } from "@/lib/tenant";

export async function getCurrentContext() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const membership = await withUser(session.user.id, (tx) =>
    tx.membership.findFirst({
      where: {
        userId: session.user.id,
        status: "active",
      },
      orderBy: { createdAt: "asc" },
    }),
  );

  if (!membership) {
    return { session, membership: null, business: null };
  }

  const business = await withTenant(
    {
      businessId: membership.businessId,
      userId: session.user.id,
      role: membership.role,
    },
    (tx) =>
      tx.business.findUnique({
        where: { id: membership.businessId },
      }),
  );

  return { session, membership, business };
}
