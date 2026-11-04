import nodemailer, { type Transporter } from "nodemailer";
import { withPlatform } from "@/lib/tenant";
import { renderEmail, type NotificationPayload } from "./templates";

/**
 * Dispatcher de la outbox transaccional.
 *
 * Reclama filas pendientes con `FOR UPDATE SKIP LOCKED`, envía por SMTP y
 * actualiza el estado. Reintenta con backoff exponencial (1, 5 y 30 minutos)
 * y marca `failed` al tercer intento fallido.
 */

type OutboxRow = {
  id: string;
  business_id: string;
  appointment_id: string | null;
  channel: "email" | "sms" | "whatsapp";
  template: string;
  recipient: string;
  subject: string | null;
  payload: unknown;
  attempts: number;
};

export type DispatchResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

const MAX_ATTEMPTS = 3;
const BACKOFF_MINUTES = [1, 5, 30];

let cachedTransport: Transporter | null = null;

function transport() {
  if (!process.env.EMAIL_SERVER) {
    throw new Error("EMAIL_SERVER no está configurado");
  }

  cachedTransport ??= nodemailer.createTransport(process.env.EMAIL_SERVER);
  return cachedTransport;
}

function fromAddress() {
  return process.env.EMAIL_FROM ?? "Velora <no-reply@velora.test>";
}

/** Reclama hasta `limit` notificaciones pendientes para este proceso. */
async function claim(limit: number) {
  return withPlatform((tx) =>
    tx.$queryRaw<OutboxRow[]>`
      UPDATE "notification_outbox"
      SET "status" = 'sending', "updated_at" = now()
      WHERE "id" IN (
        SELECT "id" FROM "notification_outbox"
        WHERE "status" = 'pending' AND "scheduled_at" <= now()
        ORDER BY "scheduled_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "business_id", "appointment_id", "channel", "template",
                "recipient", "subject", "payload", "attempts"
    `,
  );
}

async function isSuppressed(email: string) {
  const rows = await withPlatform((tx) =>
    tx.emailSuppression.findUnique({ where: { emailNormalized: email } }),
  );

  return Boolean(rows);
}

async function markSent(id: string, providerMessageId: string | null) {
  await withPlatform((tx) =>
    tx.notificationOutbox.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: new Date(),
        provider: "smtp",
        providerMessageId,
        lastError: null,
      },
    }),
  );
}

async function markFailed(id: string, error: string, attempts: number) {
  await withPlatform((tx) =>
    tx.notificationOutbox.update({
      where: { id },
      data: {
        status: "failed",
        attempts,
        lastError: error.slice(0, 500),
      },
    }),
  );
}

async function retryLater(id: string, error: string, attempts: number) {
  const minutes = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
  const scheduledAt = new Date(Date.now() + minutes * 60_000);

  await withPlatform((tx) =>
    tx.notificationOutbox.update({
      where: { id },
      data: {
        status: "pending",
        attempts,
        lastError: error.slice(0, 500),
        scheduledAt,
      },
    }),
  );
}

async function markCancelled(id: string, reason: string) {
  await withPlatform((tx) =>
    tx.notificationOutbox.update({
      where: { id },
      data: { status: "cancelled", lastError: reason.slice(0, 500) },
    }),
  );
}

export async function processOutbox(
  options: { limit?: number } = {},
): Promise<DispatchResult> {
  const limit = Math.min(Math.max(1, options.limit ?? 20), 200);
  const rows = await claim(limit);
  const result: DispatchResult = {
    processed: rows.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const row of rows) {
    try {
      if (row.channel !== "email") {
        await markCancelled(row.id, `Canal no soportado: ${row.channel}`);
        result.skipped += 1;
        continue;
      }

      if (await isSuppressed(row.recipient.toLowerCase())) {
        await markCancelled(row.id, "Destinatario suprimido por rebote o queja");
        result.skipped += 1;
        continue;
      }

      const rendered = renderEmail(
        row.template,
        (row.payload ?? {}) as NotificationPayload,
      );

      if (!rendered) {
        await markCancelled(row.id, `Plantilla desconocida: ${row.template}`);
        result.skipped += 1;
        continue;
      }

      const info = await transport().sendMail({
        to: row.recipient,
        from: fromAddress(),
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      await markSent(row.id, info.messageId ?? null);
      result.sent += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      const message = error instanceof Error ? error.message : String(error);

      if (attempts >= MAX_ATTEMPTS) {
        await markFailed(row.id, message, attempts);
        result.failed += 1;
      } else {
        await retryLater(row.id, message, attempts);
      }
    }
  }

  return result;
}
