-- Alinea la base con el esquema de Prisma:
-- - las unicidades de clientes pasan a índices parciales (solo fichas activas);
--   los índices únicos antiguos quedan obsoletos.
-- - `notification_outbox` genera `id` y `updated_at` desde la aplicación.

DROP INDEX IF EXISTS "clients_business_id_email_normalized_key";
DROP INDEX IF EXISTS "clients_business_id_phone_e164_key";

ALTER TABLE "notification_outbox"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "updated_at" DROP DEFAULT;
