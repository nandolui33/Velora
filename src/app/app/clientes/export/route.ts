import { getCurrentContext } from "@/lib/current-context";
import { withTenant } from "@/lib/tenant";
import { exportClients, type ExportFormat } from "@/modules/clients/export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await getCurrentContext();

  if (!ctx?.membership || !ctx.business) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const business = ctx.business;

  if (ctx.membership.role !== "owner") {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(request.url);
  const format: ExportFormat = url.searchParams.get("format") === "json" ? "json" : "csv";

  const result = await withTenant(
    { businessId: business.id, userId: ctx.session.user.id, role: "owner" },
    (tx) => exportClients(tx, { businessId: business.id, format }),
  );

  return new Response(result.body, {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
