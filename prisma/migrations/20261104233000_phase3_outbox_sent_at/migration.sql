-- La outbox registra cuándo se envió cada notificación.
ALTER TABLE "notification_outbox"
  ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ(3);
