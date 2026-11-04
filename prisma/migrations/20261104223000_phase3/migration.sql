-- Fase 3: agenda, disponibilidad y reservas
-- ============================================================

-- 1. Snapshots de servicio y profesional, token de gestión y referencia
ALTER TABLE "appointments"
  ADD COLUMN "service_name" TEXT,
  ADD COLUMN "service_variant_name" TEXT,
  ADD COLUMN "professional_name" TEXT,
  ADD COLUMN "duration_minutes" INTEGER,
  ADD COLUMN "buffer_after_minutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "booking_reference" TEXT,
  ADD COLUMN "public_token_hash" TEXT,
  ADD COLUMN "created_by" UUID;

UPDATE "appointments" a
SET
  "service_name" = COALESCE(
    (SELECT s."name" FROM "services" s WHERE s."business_id" = a."business_id" AND s."id" = a."service_id"),
    'Servicio'
  ),
  "service_variant_name" = (
    SELECT v."name" FROM "service_variants" v
    WHERE v."business_id" = a."business_id" AND v."id" = a."service_variant_id"
  ),
  "professional_name" = COALESCE(
    (SELECT p."display_name" FROM "professionals" p WHERE p."business_id" = a."business_id" AND p."id" = a."professional_id"),
    'Profesional'
  ),
  "duration_minutes" = COALESCE(
    (SELECT v."duration_minutes" FROM "service_variants" v WHERE v."business_id" = a."business_id" AND v."id" = a."service_variant_id"),
    (SELECT s."duration_minutes" FROM "services" s WHERE s."business_id" = a."business_id" AND s."id" = a."service_id"),
    (EXTRACT(EPOCH FROM (a."service_ends_at" - a."starts_at")) / 60)::int
  ),
  "buffer_after_minutes" = COALESCE(
    (SELECT v."buffer_after_minutes" FROM "service_variants" v WHERE v."business_id" = a."business_id" AND v."id" = a."service_variant_id"),
    (SELECT s."buffer_after_minutes" FROM "services" s WHERE s."business_id" = a."business_id" AND s."id" = a."service_id"),
    0
  ),
  "booking_reference" = upper(substr(md5(a."id"::text || clock_timestamp()::text), 1, 6)),
  "public_token_hash" = md5(a."id"::text || random()::text);

ALTER TABLE "appointments"
  ALTER COLUMN "service_name" SET NOT NULL,
  ALTER COLUMN "professional_name" SET NOT NULL,
  ALTER COLUMN "duration_minutes" SET NOT NULL,
  ALTER COLUMN "booking_reference" SET NOT NULL,
  ALTER COLUMN "public_token_hash" SET NOT NULL;

CREATE UNIQUE INDEX "appointments_business_id_booking_reference_key"
  ON "appointments" ("business_id", "booking_reference");
CREATE UNIQUE INDEX "appointments_business_id_public_token_hash_key"
  ON "appointments" ("business_id", "public_token_hash");

-- 2. Deduplicación de clientes solo sobre fichas activas
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_business_id_phone_e164_key";
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_business_id_email_normalized_key";

CREATE UNIQUE INDEX "clients_business_id_phone_e164_active_key"
  ON "clients" ("business_id", "phone_e164")
  WHERE "phone_e164" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "clients_business_id_email_normalized_active_key"
  ON "clients" ("business_id", "email_normalized")
  WHERE "email_normalized" IS NOT NULL AND "deleted_at" IS NULL;

-- 3. Notificaciones y trabajos
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'sms', 'whatsapp');
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sending', 'sent', 'failed', 'cancelled');

CREATE TABLE "notification_outbox" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "business_id" UUID NOT NULL,
  "appointment_id" UUID,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'email',
  "template" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "recipient_name" TEXT,
  "subject" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "scheduled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "provider" TEXT,
  "provider_message_id" TEXT,
  "cost_micros" INTEGER NOT NULL DEFAULT 0,
  "dedupe_key" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_outbox_dedupe_key_key"
  ON "notification_outbox" ("dedupe_key");
CREATE INDEX "notification_outbox_status_scheduled_at_idx"
  ON "notification_outbox" ("status", "scheduled_at");
CREATE INDEX "notification_outbox_business_id_created_at_idx"
  ON "notification_outbox" ("business_id", "created_at");

ALTER TABLE "notification_outbox"
  ADD CONSTRAINT "notification_outbox_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_outbox"
  ADD CONSTRAINT "notification_outbox_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "idempotency_keys" (
  "business_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "response_status" INTEGER NOT NULL,
  "response_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("business_id", "key")
);

CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" ("expires_at");

ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "email_suppressions" (
  "email_normalized" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "source" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("email_normalized")
);

-- 4. Row Level Security para las tablas nuevas
ALTER TABLE "notification_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_outbox" FORCE ROW LEVEL SECURITY;
CREATE POLICY "notification_outbox_tenant" ON "notification_outbox"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "notification_outbox_platform" ON "notification_outbox"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_keys" FORCE ROW LEVEL SECURITY;
CREATE POLICY "idempotency_keys_tenant" ON "idempotency_keys"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "idempotency_keys_platform" ON "idempotency_keys"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "email_suppressions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_suppressions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "email_suppressions_platform" ON "email_suppressions"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

-- 5. Resolución pública del slug: única lectura permitida sin contexto de empresa
CREATE OR REPLACE FUNCTION public.resolve_business_slug(p_slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM businesses
  WHERE slug = p_slug
    AND deleted_at IS NULL
    AND status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_business_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_business_slug(text) TO velora_app;
