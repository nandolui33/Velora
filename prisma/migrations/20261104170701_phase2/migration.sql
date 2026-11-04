-- CreateEnum
CREATE TYPE "BusinessSector" AS ENUM ('barberia', 'peluqueria', 'manicura', 'spa', 'cejas_pestanas', 'estetica', 'masajes');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "sector" "BusinessSector",
ADD COLUMN     "template_applied_at" TIMESTAMPTZ(3),
ADD COLUMN     "template_version" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "category_id" UUID;

-- CreateTable
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_services" (
    "business_id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_services_pkey" PRIMARY KEY ("business_id","professional_id","service_id")
);

-- CreateTable
CREATE TABLE "professional_schedules" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "opens_at" TEXT NOT NULL,
    "closes_at" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_time_off" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "location_id" UUID,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_time_off_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_business_id_slug_key" ON "service_categories"("business_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_business_id_id_key" ON "service_categories"("business_id", "id");

-- CreateIndex
CREATE INDEX "professional_services_business_id_service_id_professional_i_idx" ON "professional_services"("business_id", "service_id", "professional_id");

-- CreateIndex
CREATE INDEX "professional_schedules_business_id_location_id_weekday_idx" ON "professional_schedules"("business_id", "location_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "professional_schedules_business_id_professional_id_location_key" ON "professional_schedules"("business_id", "professional_id", "location_id", "weekday");

-- CreateIndex
CREATE INDEX "professional_time_off_business_id_professional_id_starts_at_idx" ON "professional_time_off"("business_id", "professional_id", "starts_at");

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_schedules" ADD CONSTRAINT "professional_schedules_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_schedules" ADD CONSTRAINT "professional_schedules_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_schedules" ADD CONSTRAINT "professional_schedules_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_time_off" ADD CONSTRAINT "professional_time_off_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_time_off" ADD CONSTRAINT "professional_time_off_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_time_off" ADD CONSTRAINT "professional_time_off_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Fase 2: RLS, constraints y lectura pública
-- ============================================================

ALTER TABLE "service_categories"
  ADD CONSTRAINT "service_categories_business_tenant_fk"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;

ALTER TABLE "services"
  ADD CONSTRAINT "services_category_tenant_fk"
  FOREIGN KEY ("business_id", "category_id") REFERENCES "service_categories"("business_id", "id") ON DELETE RESTRICT;

ALTER TABLE "professional_services"
  ADD CONSTRAINT "professional_services_professional_tenant_fk"
  FOREIGN KEY ("business_id", "professional_id") REFERENCES "professionals"("business_id", "id") ON DELETE CASCADE;

ALTER TABLE "professional_services"
  ADD CONSTRAINT "professional_services_service_tenant_fk"
  FOREIGN KEY ("business_id", "service_id") REFERENCES "services"("business_id", "id") ON DELETE CASCADE;

ALTER TABLE "professional_schedules"
  ADD CONSTRAINT "professional_schedules_professional_tenant_fk"
  FOREIGN KEY ("business_id", "professional_id") REFERENCES "professionals"("business_id", "id") ON DELETE CASCADE;

ALTER TABLE "professional_schedules"
  ADD CONSTRAINT "professional_schedules_location_tenant_fk"
  FOREIGN KEY ("business_id", "location_id") REFERENCES "locations"("business_id", "id") ON DELETE CASCADE;

ALTER TABLE "professional_schedules"
  ADD CONSTRAINT "professional_schedules_weekday_check"
  CHECK ("weekday" BETWEEN 1 AND 7);

ALTER TABLE "professional_time_off"
  ADD CONSTRAINT "professional_time_off_professional_tenant_fk"
  FOREIGN KEY ("business_id", "professional_id") REFERENCES "professionals"("business_id", "id") ON DELETE CASCADE;


ALTER TABLE "professional_time_off"
  ADD CONSTRAINT "professional_time_off_interval_check"
  CHECK ("ends_at" > "starts_at");

CREATE OR REPLACE FUNCTION get_public_business(p_slug text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'slug', b.slug,
    'tagline', b.tagline,
    'description', b.description,
    'phone', b.phone,
    'email', b.email,
    'website', b.website,
    'primaryColor', b.primary_color,
    'themePreset', b.theme_preset,
    'timezone', b.timezone,
    'currency', b.currency,
    'location', (
      SELECT jsonb_build_object(
        'name', l.name,
        'addressLine1', l.address_line1,
        'addressLine2', l.address_line2,
        'city', l.city,
        'province', l.province,
        'postalCode', l.postal_code,
        'countryCode', l.country_code,
        'phone', l.phone,
        'email', l.email
      )
      FROM locations l
      WHERE l.business_id = b.id AND l.active = true
      ORDER BY l.is_default DESC, l.created_at ASC
      LIMIT 1
    ),
    'hours', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'weekday', h.weekday,
        'opensAt', h.opens_at,
        'closesAt', h.closes_at,
        'closed', h.closed
      ) ORDER BY h.weekday)
      FROM business_hours h
      WHERE h.business_id = b.id
    ), '[]'::jsonb),
    'services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'description', s.description,
        'durationMinutes', s.duration_minutes,
        'priceCents', s.price_cents,
        'currency', s.currency,
        'category', c.name,
        'variants', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'name', v.name,
            'durationMinutes', v.duration_minutes,
            'priceCents', v.price_cents
          ) ORDER BY v.sort_order, v.name)
          FROM service_variants v
          WHERE v.service_id = s.id AND v.active = true
        ), '[]'::jsonb)
      ) ORDER BY c.sort_order NULLS LAST, s.sort_order, s.name)
      FROM services s
      LEFT JOIN service_categories c ON c.id = s.category_id
      WHERE s.business_id = b.id AND s.active = true AND s.online_bookable = true
    ), '[]'::jsonb),
    'professionals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.display_name,
        'title', p.title,
        'bio', p.bio,
        'color', p.color,
        'services', COALESCE((
          SELECT jsonb_agg(s.name ORDER BY s.name)
          FROM professional_services ps
          JOIN services s ON s.id = ps.service_id
          WHERE ps.professional_id = p.id AND ps.active = true AND s.active = true
        ), '[]'::jsonb)
      ) ORDER BY p.sort_order, p.display_name)
      FROM professionals p
      WHERE p.business_id = b.id AND p.active = true
    ), '[]'::jsonb)
  )
  FROM businesses b
  WHERE b.slug = p_slug
    AND b.status = 'active'
    AND b.published_at IS NOT NULL
    AND b.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION get_public_business(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_business(text) TO velora_app;

ALTER TABLE "service_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY "service_categories_tenant" ON "service_categories"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "service_categories_platform" ON "service_categories"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "professional_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "professional_services" FORCE ROW LEVEL SECURITY;
CREATE POLICY "professional_services_tenant" ON "professional_services"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "professional_services_platform" ON "professional_services"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "professional_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "professional_schedules" FORCE ROW LEVEL SECURITY;
CREATE POLICY "professional_schedules_tenant" ON "professional_schedules"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "professional_schedules_platform" ON "professional_schedules"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "professional_time_off" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "professional_time_off" FORCE ROW LEVEL SECURITY;
CREATE POLICY "professional_time_off_tenant" ON "professional_time_off"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "professional_time_off_platform" ON "professional_time_off"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

GRANT SELECT, INSERT, UPDATE, DELETE ON "service_categories" TO velora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "professional_services" TO velora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "professional_schedules" TO velora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "professional_time_off" TO velora_app;
GRANT EXECUTE ON FUNCTION get_public_business(text) TO velora_app;