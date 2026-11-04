import { z } from "zod";
import { getPublicAvailability } from "@/modules/booking/public";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.coerce.number().int().min(1).max(7).optional(),
  professionalId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return Response.json(
      { error: "INVALID_INPUT", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const days = await getPublicAvailability({
    slug,
    serviceId: parsed.data.serviceId,
    serviceVariantId: parsed.data.variantId ?? null,
    professionalId: parsed.data.professionalId ?? null,
    date: parsed.data.date,
    days: parsed.data.days ?? 3,
  });

  if (!days) {
    return Response.json({ error: "BUSINESS_NOT_FOUND" }, { status: 404 });
  }

  return Response.json(
    { days },
    { headers: { "Cache-Control": "no-store" } },
  );
}
