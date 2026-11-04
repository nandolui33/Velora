-- Fase 4: clientes, consentimientos y límites de plan
-- ============================================================

CREATE TYPE "ConsentType" AS ENUM ('privacy', 'marketing', 'health');

CREATE TABLE "consent_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "business_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "type" "ConsentType" NOT NULL,
  "policy_version" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "source" TEXT NOT NULL,
  "ip_hash" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "revoked_at" TIMESTAMPTZ(3),
  CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consent_records_business_id_client_id_type_created_at_idx"
  ON "consent_records" ("business_id", "client_id", "type", "created_at" DESC);

ALTER TABLE "consent_records"
  ADD CONSTRAINT "consent_records_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "consent_records"
  ADD CONSTRAINT "consent_records_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Overrides de plan por empresa (superadministrador)
ALTER TABLE "businesses" ADD COLUMN "plan_overrides" JSONB;

ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "consent_records_tenant" ON "consent_records"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "consent_records_platform" ON "consent_records"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');
