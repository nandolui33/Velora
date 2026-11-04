-- Rol de aplicación sin privilegios de owner ni BYPASSRLS.
-- Las migraciones se ejecutan con velora_owner.
CREATE ROLE velora_app LOGIN PASSWORD 'velora_app_dev'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

GRANT CONNECT ON DATABASE velora TO velora_app;
GRANT USAGE ON SCHEMA public TO velora_app;

ALTER DEFAULT PRIVILEGES FOR ROLE velora_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO velora_app;

ALTER DEFAULT PRIVILEGES FOR ROLE velora_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO velora_app;

ALTER DEFAULT PRIVILEGES FOR ROLE velora_owner IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO velora_app;
