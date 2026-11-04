-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('active', 'suspended', 'disabled');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('owner', 'professional');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'invited', 'disabled');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('confirmed', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('online', 'admin', 'phone', 'walk_in');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'partial', 'paid', 'waived');

-- CreateEnum
CREATE TYPE "PlanInterval" AS ENUM ('month', 'year');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'suspended', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMPTZ(3),
    "image" TEXT,
    "phone" TEXT,
    "is_superadmin" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "terms_accepted_at" TIMESTAMPTZ(3),
    "terms_version" TEXT,
    "privacy_accepted_at" TIMESTAMPTZ(3),
    "privacy_version" TEXT,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "tax_id" TEXT,
    "slug" TEXT NOT NULL,
    "status" "BusinessStatus" NOT NULL DEFAULT 'active',
    "published_at" TIMESTAMPTZ(3),
    "description" TEXT,
    "tagline" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logo_key" TEXT,
    "cover_key" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#111827',
    "theme_preset" TEXT NOT NULL DEFAULT 'clean',
    "socials" JSONB,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "locale" TEXT NOT NULL DEFAULT 'es-ES',
    "min_lead_minutes" INTEGER NOT NULL DEFAULT 120,
    "max_advance_days" INTEGER NOT NULL DEFAULT 60,
    "slot_interval_minutes" INTEGER NOT NULL DEFAULT 15,
    "cancellation_cutoff_minutes" INTEGER NOT NULL DEFAULT 1440,
    "reminder_hours_before" INTEGER NOT NULL DEFAULT 24,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT,
    "postal_code" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL DEFAULT 'ES',
    "phone" TEXT,
    "email" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'active',
    "professional_id" UUID,
    "permissions" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professionals" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "photo_key" TEXT,
    "color" TEXT NOT NULL DEFAULT '#111827',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "professionals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_locations" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "buffer_after_minutes" INTEGER NOT NULL DEFAULT 0,
    "price_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "image_key" TEXT,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "online_bookable" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_variants" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "buffer_after_minutes" INTEGER NOT NULL DEFAULT 0,
    "price_cents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_locations" (
    "business_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "price_cents" INTEGER,
    "duration_minutes" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_locations_pkey" PRIMARY KEY ("business_id","service_id","location_id")
);

-- CreateTable
CREATE TABLE "resource_types" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "resource_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "resource_type_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_resource_requirements" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "location_id" UUID,
    "resource_type_id" UUID NOT NULL,
    "resource_id" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_resource_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_blocks" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_reservations" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "appointment_id" UUID,
    "block_id" UUID,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "released_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "phone_raw" TEXT,
    "phone_e164" TEXT,
    "email" TEXT,
    "email_normalized" TEXT,
    "birth_date" DATE,
    "notes" TEXT,
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "privacy_accepted_at" TIMESTAMPTZ(3),
    "last_visit_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "anonymized_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "service_variant_id" UUID,
    "client_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "service_ends_at" TIMESTAMPTZ(3) NOT NULL,
    "blocked_until" TIMESTAMPTZ(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'confirmed',
    "source" "AppointmentSource" NOT NULL DEFAULT 'admin',
    "price_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "paid_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "payment_method" TEXT,
    "client_notes" TEXT,
    "internal_notes" TEXT,
    "cancellation_reason" TEXT,
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "interval" "PlanInterval" NOT NULL DEFAULT 'month',
    "trial_days" INTEGER NOT NULL DEFAULT 14,
    "max_professionals" INTEGER,
    "max_locations" INTEGER NOT NULL DEFAULT 1,
    "monthly_email_quota" INTEGER NOT NULL DEFAULT 1000,
    "features" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "trial_ends_at" TIMESTAMPTZ(3),
    "current_period_start" TIMESTAMPTZ(3),
    "current_period_end" TIMESTAMPTZ(3),
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "provider_customer_id" TEXT,
    "provider_subscription_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_idx" ON "sessions"("user_id", "expires");

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires");

-- CreateIndex
CREATE INDEX "verification_tokens_expires_idx" ON "verification_tokens"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_slug_key" ON "businesses"("slug");

-- CreateIndex
CREATE INDEX "businesses_status_published_at_idx" ON "businesses"("status", "published_at");

-- CreateIndex
CREATE INDEX "businesses_deleted_at_idx" ON "businesses"("deleted_at");

-- CreateIndex
CREATE INDEX "locations_business_id_active_idx" ON "locations"("business_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "locations_business_id_slug_key" ON "locations"("business_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "locations_business_id_id_key" ON "locations"("business_id", "id");

-- CreateIndex
CREATE INDEX "memberships_user_id_status_idx" ON "memberships"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_business_id_user_id_key" ON "memberships"("business_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_business_id_professional_id_key" ON "memberships"("business_id", "professional_id");

-- CreateIndex
CREATE INDEX "professionals_business_id_active_sort_order_idx" ON "professionals"("business_id", "active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "professionals_business_id_id_key" ON "professionals"("business_id", "id");

-- CreateIndex
CREATE INDEX "professional_locations_business_id_location_id_professional_idx" ON "professional_locations"("business_id", "location_id", "professional_id");

-- CreateIndex
CREATE UNIQUE INDEX "professional_locations_business_id_professional_id_location_key" ON "professional_locations"("business_id", "professional_id", "location_id");

-- CreateIndex
CREATE INDEX "services_business_id_active_sort_order_idx" ON "services"("business_id", "active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "services_business_id_id_key" ON "services"("business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "service_variants_business_id_service_id_name_key" ON "service_variants"("business_id", "service_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "service_variants_business_id_service_id_id_key" ON "service_variants"("business_id", "service_id", "id");

-- CreateIndex
CREATE INDEX "service_locations_business_id_location_id_service_id_idx" ON "service_locations"("business_id", "location_id", "service_id");

-- CreateIndex
CREATE INDEX "resource_types_business_id_active_sort_order_idx" ON "resource_types"("business_id", "active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "resource_types_business_id_id_key" ON "resource_types"("business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_types_business_id_key_key" ON "resource_types"("business_id", "key");

-- CreateIndex
CREATE INDEX "resources_business_id_location_id_resource_type_id_active_idx" ON "resources"("business_id", "location_id", "resource_type_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "resources_business_id_id_key" ON "resources"("business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "resources_business_id_location_id_code_key" ON "resources"("business_id", "location_id", "code");

-- CreateIndex
CREATE INDEX "service_resource_requirements_business_id_service_id_idx" ON "service_resource_requirements"("business_id", "service_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_resource_requirements_business_id_service_id_locati_key" ON "service_resource_requirements"("business_id", "service_id", "location_id", "resource_type_id", "resource_id");

-- CreateIndex
CREATE INDEX "resource_blocks_business_id_resource_id_starts_at_idx" ON "resource_blocks"("business_id", "resource_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "resource_blocks_business_id_id_key" ON "resource_blocks"("business_id", "id");

-- CreateIndex
CREATE INDEX "resource_reservations_business_id_resource_id_starts_at_idx" ON "resource_reservations"("business_id", "resource_id", "starts_at");

-- CreateIndex
CREATE INDEX "resource_reservations_appointment_id_idx" ON "resource_reservations"("appointment_id");

-- CreateIndex
CREATE INDEX "resource_reservations_block_id_idx" ON "resource_reservations"("block_id");

-- CreateIndex
CREATE INDEX "resource_reservations_released_at_idx" ON "resource_reservations"("released_at");

-- CreateIndex
CREATE INDEX "clients_business_id_last_name_first_name_idx" ON "clients"("business_id", "last_name", "first_name");

-- CreateIndex
CREATE INDEX "clients_business_id_last_visit_at_idx" ON "clients"("business_id", "last_visit_at");

-- CreateIndex
CREATE UNIQUE INDEX "clients_business_id_id_key" ON "clients"("business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_business_id_phone_e164_key" ON "clients"("business_id", "phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "clients_business_id_email_normalized_key" ON "clients"("business_id", "email_normalized");

-- CreateIndex
CREATE INDEX "appointments_business_id_starts_at_idx" ON "appointments"("business_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_business_id_professional_id_starts_at_idx" ON "appointments"("business_id", "professional_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_business_id_client_id_starts_at_idx" ON "appointments"("business_id", "client_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_business_id_status_starts_at_idx" ON "appointments"("business_id", "status", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_business_id_id_key" ON "appointments"("business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_business_id_key" ON "subscriptions"("business_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_trial_ends_at_idx" ON "subscriptions"("status", "trial_ends_at");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_locations" ADD CONSTRAINT "professional_locations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_locations" ADD CONSTRAINT "professional_locations_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_locations" ADD CONSTRAINT "professional_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_variants" ADD CONSTRAINT "service_variants_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_types" ADD CONSTRAINT "resource_types_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_resource_requirements" ADD CONSTRAINT "service_resource_requirements_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_resource_requirements" ADD CONSTRAINT "service_resource_requirements_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_resource_requirements" ADD CONSTRAINT "service_resource_requirements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_resource_requirements" ADD CONSTRAINT "service_resource_requirements_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_resource_requirements" ADD CONSTRAINT "service_resource_requirements_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_blocks" ADD CONSTRAINT "resource_blocks_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_blocks" ADD CONSTRAINT "resource_blocks_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_blocks" ADD CONSTRAINT "resource_blocks_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_reservations" ADD CONSTRAINT "resource_reservations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_reservations" ADD CONSTRAINT "resource_reservations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_reservations" ADD CONSTRAINT "resource_reservations_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_reservations" ADD CONSTRAINT "resource_reservations_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_reservations" ADD CONSTRAINT "resource_reservations_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "resource_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_variant_id_fkey" FOREIGN KEY ("service_variant_id") REFERENCES "service_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ============================================================
-- Velora Fase 0: constraints, RLS y privilegios
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Checks de dominio
ALTER TABLE "businesses"
  ADD CONSTRAINT "businesses_slug_format_check"
  CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

ALTER TABLE "businesses"
  ADD CONSTRAINT "businesses_slot_interval_check"
  CHECK ("slot_interval_minutes" IN (5, 10, 15, 20, 30, 60));

ALTER TABLE "services"
  ADD CONSTRAINT "services_duration_check"
  CHECK ("duration_minutes" > 0 AND "duration_minutes" <= 1440);

ALTER TABLE "services"
  ADD CONSTRAINT "services_buffer_check"
  CHECK ("buffer_after_minutes" >= 0 AND "price_cents" >= 0);

ALTER TABLE "service_resource_requirements"
  ADD CONSTRAINT "service_resource_requirements_quantity_check"
  CHECK ("quantity" > 0);

ALTER TABLE "resource_blocks"
  ADD CONSTRAINT "resource_blocks_time_check"
  CHECK ("ends_at" > "starts_at");

ALTER TABLE "resource_reservations"
  ADD CONSTRAINT "resource_reservations_time_check"
  CHECK ("ends_at" > "starts_at");

ALTER TABLE "resource_reservations"
  ADD CONSTRAINT "resource_reservations_one_owner_check"
  CHECK (num_nonnulls("appointment_id", "block_id") = 1);

ALTER TABLE "resource_reservations"
  ADD CONSTRAINT "resource_reservations_released_check"
  CHECK ("released_at" IS NULL OR "released_at" >= "created_at");

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_time_check"
  CHECK ("service_ends_at" > "starts_at" AND "blocked_until" >= "service_ends_at");

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_payment_check"
  CHECK ("paid_amount_cents" >= 0 AND "paid_amount_cents" <= "price_cents");

ALTER TABLE "clients"
  ADD CONSTRAINT "clients_contact_check"
  CHECK ("phone_e164" IS NOT NULL OR "email_normalized" IS NOT NULL OR "anonymized_at" IS NOT NULL);

-- Índices únicos parciales
CREATE UNIQUE INDEX IF NOT EXISTS "locations_one_default_per_business"
  ON "locations" ("business_id")
  WHERE "is_default" AND "active";

CREATE UNIQUE INDEX IF NOT EXISTS "memberships_one_active_owner"
  ON "memberships" ("business_id")
  WHERE "role" = 'owner' AND "status" = 'active';

-- Claves compuestas para aislar tenant
ALTER TABLE "professional_locations"
  ADD CONSTRAINT "professional_locations_professional_tenant_fk"
  FOREIGN KEY ("business_id", "professional_id") REFERENCES "professionals"("business_id", "id") ON DELETE CASCADE;

ALTER TABLE "professional_locations"
  ADD CONSTRAINT "professional_locations_location_tenant_fk"
  FOREIGN KEY ("business_id", "location_id") REFERENCES "locations"("business_id", "id") ON DELETE CASCADE;

ALTER TABLE "service_variants"
  ADD CONSTRAINT "service_variants_service_tenant_fk"
  FOREIGN KEY ("business_id", "service_id") REFERENCES "services"("business_id", "id") ON DELETE CASCADE;

ALTER TABLE "service_locations"
  ADD CONSTRAINT "service_locations_service_tenant_fk"
  FOREIGN KEY ("business_id", "service_id") REFERENCES "services"("business_id", "id") ON DELETE CASCADE;

ALTER TABLE "service_locations"
  ADD CONSTRAINT "service_locations_location_tenant_fk"
  FOREIGN KEY ("business_id", "location_id") REFERENCES "locations"("business_id", "id") ON DELETE CASCADE;

ALTER TABLE "resources"
  ADD CONSTRAINT "resources_location_tenant_fk"
  FOREIGN KEY ("business_id", "location_id") REFERENCES "locations"("business_id", "id") ON DELETE RESTRICT;

ALTER TABLE "resources"
  ADD CONSTRAINT "resources_type_tenant_fk"
  FOREIGN KEY ("business_id", "resource_type_id") REFERENCES "resource_types"("business_id", "id") ON DELETE RESTRICT;

ALTER TABLE "service_resource_requirements"
  ADD CONSTRAINT "service_resource_requirements_service_tenant_fk"
  FOREIGN KEY ("business_id", "service_id") REFERENCES "services"("business_id", "id") ON DELETE CASCADE;

ALTER TABLE "service_resource_requirements"
  ADD CONSTRAINT "service_resource_requirements_type_tenant_fk"
  FOREIGN KEY ("business_id", "resource_type_id") REFERENCES "resource_types"("business_id", "id") ON DELETE RESTRICT;

ALTER TABLE "service_resource_requirements"
  ADD CONSTRAINT "service_resource_requirements_resource_tenant_fk"
  FOREIGN KEY ("business_id", "resource_id") REFERENCES "resources"("business_id", "id") ON DELETE RESTRICT;

ALTER TABLE "resource_blocks"
  ADD CONSTRAINT "resource_blocks_location_tenant_fk"
  FOREIGN KEY ("business_id", "location_id") REFERENCES "locations"("business_id", "id") ON DELETE RESTRICT;

ALTER TABLE "resource_blocks"
  ADD CONSTRAINT "resource_blocks_resource_tenant_fk"
  FOREIGN KEY ("business_id", "resource_id") REFERENCES "resources"("business_id", "id") ON DELETE RESTRICT;

ALTER TABLE "resource_reservations"
  ADD CONSTRAINT "resource_reservations_location_tenant_fk"
  FOREIGN KEY ("business_id", "location_id") REFERENCES "locations"("business_id", "id") ON DELETE RESTRICT;

ALTER TABLE "resource_reservations"
  ADD CONSTRAINT "resource_reservations_resource_tenant_fk"
  FOREIGN KEY ("business_id", "resource_id") REFERENCES "resources"("business_id", "id") ON DELETE RESTRICT;

ALTER TABLE "resource_reservations"
  ADD CONSTRAINT "resource_reservations_appointment_tenant_fk"
  FOREIGN KEY ("business_id", "appointment_id") REFERENCES "appointments"("business_id", "id") ON DELETE CASCADE;

ALTER TABLE "resource_reservations"
  ADD CONSTRAINT "resource_reservations_block_tenant_fk"
  FOREIGN KEY ("business_id", "block_id") REFERENCES "resource_blocks"("business_id", "id") ON DELETE CASCADE;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_location_tenant_fk"
  FOREIGN KEY ("business_id", "location_id") REFERENCES "locations"("business_id", "id") ON DELETE RESTRICT;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_professional_tenant_fk"
  FOREIGN KEY ("business_id", "professional_id") REFERENCES "professionals"("business_id", "id") ON DELETE RESTRICT;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_service_tenant_fk"
  FOREIGN KEY ("business_id", "service_id") REFERENCES "services"("business_id", "id") ON DELETE RESTRICT;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_client_tenant_fk"
  FOREIGN KEY ("business_id", "client_id") REFERENCES "clients"("business_id", "id") ON DELETE RESTRICT;


-- Exclusividad de agenda: profesional
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "professional_id" WITH =,
    tstzrange("starts_at", "blocked_until", '[)') WITH &&
  )
  WHERE ("status" IN ('confirmed', 'completed'));

-- Exclusividad de recursos: citas y bloqueos compiten por el mismo recurso
ALTER TABLE "resource_reservations"
  ADD CONSTRAINT "resource_reservations_no_overlap"
  EXCLUDE USING gist (
    "business_id" WITH =,
    "resource_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("released_at" IS NULL);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE "businesses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "businesses" FORCE ROW LEVEL SECURITY;
CREATE POLICY "businesses_tenant" ON "businesses"
  USING ("id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "businesses_platform" ON "businesses"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "locations_tenant" ON "locations"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "locations_platform" ON "locations"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY "memberships_read" ON "memberships"
  USING (
    "business_id" = nullif(current_setting('app.business_id', true), '')::uuid
    OR "user_id" = nullif(current_setting('app.user_id', true), '')::uuid
    OR current_setting('app.platform', true) = 'on'
  );
CREATE POLICY "memberships_write" ON "memberships"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);

ALTER TABLE "professionals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "professionals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "professionals_tenant" ON "professionals"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "professionals_platform" ON "professionals"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "professional_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "professional_locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "professional_locations_tenant" ON "professional_locations"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "professional_locations_platform" ON "professional_locations"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services" FORCE ROW LEVEL SECURITY;
CREATE POLICY "services_tenant" ON "services"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "services_platform" ON "services"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "service_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_variants" FORCE ROW LEVEL SECURITY;
CREATE POLICY "service_variants_tenant" ON "service_variants"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "service_variants_platform" ON "service_variants"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "service_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "service_locations_tenant" ON "service_locations"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "service_locations_platform" ON "service_locations"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "resource_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resource_types" FORCE ROW LEVEL SECURITY;
CREATE POLICY "resource_types_tenant" ON "resource_types"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "resource_types_platform" ON "resource_types"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resources" FORCE ROW LEVEL SECURITY;
CREATE POLICY "resources_tenant" ON "resources"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "resources_platform" ON "resources"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "service_resource_requirements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_resource_requirements" FORCE ROW LEVEL SECURITY;
CREATE POLICY "service_resource_requirements_tenant" ON "service_resource_requirements"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "service_resource_requirements_platform" ON "service_resource_requirements"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "resource_blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resource_blocks" FORCE ROW LEVEL SECURITY;
CREATE POLICY "resource_blocks_tenant" ON "resource_blocks"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "resource_blocks_platform" ON "resource_blocks"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "resource_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resource_reservations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "resource_reservations_tenant" ON "resource_reservations"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "resource_reservations_platform" ON "resource_reservations"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clients" FORCE ROW LEVEL SECURITY;
CREATE POLICY "clients_tenant" ON "clients"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "clients_platform" ON "clients"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "appointments_tenant" ON "appointments"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "appointments_platform" ON "appointments"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_tenant" ON "subscriptions"
  USING ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK ("business_id" = nullif(current_setting('app.business_id', true), '')::uuid);
CREATE POLICY "subscriptions_platform" ON "subscriptions"
  USING (current_setting('app.platform', true) = 'on')
  WITH CHECK (current_setting('app.platform', true) = 'on');

-- Privilegios del rol de aplicación
GRANT USAGE ON SCHEMA public TO velora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO velora_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO velora_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO velora_app;
