-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "professional_id" UUID,
    "location_id" UUID,
    "token_hash" TEXT NOT NULL,
    "invited_by" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_hours" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "opens_at" TEXT NOT NULL,
    "closes_at" TEXT NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "business_id" UUID,
    "actor_user_id" UUID,
    "actor_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_business_id_email_normalized_idx" ON "invitations"("business_id", "email_normalized");

-- CreateIndex
CREATE INDEX "invitations_expires_at_idx" ON "invitations"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_business_id_location_id_weekday_key" ON "business_hours"("business_id", "location_id", "weekday");

-- CreateIndex
CREATE INDEX "audit_logs_business_id_created_at_idx" ON "audit_logs"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Fase 1: RLS, función de invitación y constraints
-- ============================================================

ALTER TABLE "business_hours"
  ADD CONSTRAINT "business_hours_location_tenant_fk"
  FOREIGN KEY ("business_id", "location_id") REFERENCES "locations"("business_id", "id") ON DELETE CASCADE;

ALTER TABLE "business_hours"
  ADD CONSTRAINT "business_hours_weekday_check"
  CHECK ("weekday" BETWEEN 1 AND 7);

CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token_hash text)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  business_name text,
  email_normalized text,
  role "MembershipRole",
  professional_id uuid,
  location_id uuid,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.business_id, b.name, i.email_normalized, i.role,
         i.professional_id, i.location_id, i.expires_at, i.accepted_at, i.revoked_at
  FROM invitations i
  JOIN businesses b ON b.id = i.business_id
  WHERE i.token_hash = p_token_hash;
$$;

REVOKE ALL ON FUNCTION get_invitation_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_invitation_by_token(text) TO velora_app;

ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "invitations_tenant" ON "invitations"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "invitations_platform" ON "invitations"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "business_hours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business_hours" FORCE ROW LEVEL SECURITY;
CREATE POLICY "business_hours_tenant" ON "business_hours"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "business_hours_platform" ON "business_hours"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_select" ON "audit_logs" FOR SELECT
  USING (
    "business_id" = nullif(current_setting('app.business_id', true), '')::uuid
    OR current_setting('app.platform', true) = 'on'
  );
CREATE POLICY "audit_logs_insert" ON "audit_logs" FOR INSERT
  WITH CHECK (
    "business_id" = nullif(current_setting('app.business_id', true), '')::uuid
    OR current_setting('app.platform', true) = 'on'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "invitations" TO velora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "business_hours" TO velora_app;
GRANT SELECT, INSERT ON "audit_logs" TO velora_app;
GRANT EXECUTE ON FUNCTION get_invitation_by_token(text) TO velora_app;