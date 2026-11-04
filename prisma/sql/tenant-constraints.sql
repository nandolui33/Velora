-- Restaura las claves compuestas de tenant que Prisma no modela.
-- Ejecutar con el rol owner después de una migración que las elimine.

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

