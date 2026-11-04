import { z } from "zod";
import { getPublicBookingTarget } from "@/modules/booking/public";
import { checkRateLimit, clientKey, rateLimitResponse } from "@/lib/rate-limit";
import { BookingError, createBooking } from "@/modules/scheduling/booking";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  serviceId: z.string().uuid(),
  serviceVariantId: z.string().uuid().nullish(),
  professionalId: z.string().uuid().nullish(),
  startsAt: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(500).nullish(),
  idempotencyKey: z.string().min(8).max(120).optional(),
  client: z.object({
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().max(80).nullish(),
    phone: z.string().trim().max(30).nullish(),
    email: z.string().trim().email().max(160).nullish(),
  }),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  const limit = checkRateLimit(`booking:${clientKey(request)}`, {
    limit: 10,
    windowMs: 60_000,
  });

  if (!limit.ok) {
    return rateLimitResponse(limit);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "INVALID_INPUT", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (!data.client.email && !data.client.phone) {
    return Response.json(
      { error: "INVALID_INPUT", message: "Hace falta un email o un teléfono" },
      { status: 400 },
    );
  }

  const target = await getPublicBookingTarget(slug);

  if (!target) {
    return Response.json({ error: "BUSINESS_NOT_FOUND" }, { status: 404 });
  }

  try {
    const result = await createBooking({
      businessId: target.businessId,
      locationId: target.locationId,
      serviceId: data.serviceId,
      serviceVariantId: data.serviceVariantId ?? null,
      professionalId: data.professionalId ?? null,
      startsAt: new Date(data.startsAt),
      client: {
        firstName: data.client.firstName,
        lastName: data.client.lastName ?? null,
        phone: data.client.phone ?? null,
        email: data.client.email ?? null,
      },
      clientNotes: data.notes ?? null,
      source: "online",
      idempotencyKey: data.idempotencyKey ?? null,
    });

    return Response.json(
      {
        booking: {
          reference: result.bookingReference,
          startsAt: result.startsAt,
          serviceEndsAt: result.serviceEndsAt,
          serviceName: result.serviceName,
          professionalName: result.professionalName,
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof BookingError) {
      return Response.json({ error: error.code }, { status: error.status });
    }

    console.error("public booking failed", error);

    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
