# DEPLOY.md — Despliegue, backups y runbook

Despliegue de referencia: VPS europeo con Docker Compose, PostgreSQL 16 y Caddy
como proxy con TLS automático.

## 1. Requisitos

- VPS con Docker y Docker Compose v2.
- Dominio apuntando al VPS (A/AAAA).
- Variables de entorno del proyecto en un `.env` junto al compose de producción.

## 2. Variables de entorno

```bash
DOMAIN=reservas.tudominio.com
AUTH_URL=https://reservas.tudominio.com
AUTH_SECRET=<openssl rand -base64 32>
POSTGRES_DB=velora
POSTGRES_OWNER_USER=velora_owner
POSTGRES_OWNER_PASSWORD=<secreto>
DATABASE_URL=postgresql://velora_app:<secreto>@postgres:5432/velora?schema=public
DIRECT_URL=postgresql://velora_owner:<secreto>@postgres:5432/velora?schema=public
EMAIL_SERVER=smtp://usuario:clave@smtp.proveedor:587
EMAIL_FROM=Velora <no-reply@tudominio.com>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
PRIVACY_POLICY_VERSION=1.0
```

El rol `velora_app` lo crea `docker/postgres/init.sql` en el primer arranque del
volumen. `DATABASE_URL` usa ese rol (sin `BYPASSRLS`); `DIRECT_URL` usa el owner
para migraciones.

## 3. Primer despliegue

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d postgres
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml up -d app worker caddy
```

Comprobaciones:

```bash
curl -fsS https://$DOMAIN/api/health
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
```

## 4. Actualizaciones

```bash
git pull
docker compose -f docker-compose.prod.yml build app worker
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml up -d app worker
```

## 5. Backups

Backup diario lógico comprimido (añadir a cron del VPS a las 03:00):

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U velora_owner -Fc velora > /srv/backups/velora-$(date +%F).dump
```

Retención sugerida: 14 diarios, 8 semanales y 12 mensuales, copiados fuera del
VPS (S3/R2 o similar). Cifrar si el destino no es de confianza.

## 6. Prueba de restauración (mensual)

```bash
docker compose -f docker-compose.prod.yml exec -T postgres createdb -U velora_owner velora_restore
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U velora_owner -d velora_restore --no-owner < /srv/backups/velora-2026-01-31.dump
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U velora_owner -d velora_restore -c "select count(*) from appointments;"
```

Se considera válido solo si el entorno limpio arranca, aplica migraciones y la
consulta devuelve el número esperado de citas. Registrar fecha y resultado.

## 7. Monitorización y alertas

- `GET /api/health`: comprueba la conexión a la base de datos.
- Logs de Caddy en `caddy_data` y de la app con `docker compose logs`.
- Alertas mínimas: healthcheck externo cada minuto, uso de disco > 80 %,
  contenedores reiniciando y backups fallidos.
- Revisar a diario la outbox: `select status, count(*) from notification_outbox
  group by status;` (fallidas = alerta).

## 8. Runbook de incidentes

| Síntoma | Primera acción |
|---|---|
| 502 desde Caddy | `docker compose ps`, logs de `app`, reiniciar `app`. |
| La web va lenta | Revisar pool de Postgres y `pg_stat_activity` por consultas largas. |
| Emails no salen | Logs de `worker`, estado de la outbox y `EMAIL_SERVER`. |
| Errores 500 en reservas | Logs de `app`; si hay `23P01`, es un conflicto esperado (409). |
| Restauración necesaria | Parar `app`, restaurar dump en una base limpia, apuntar `DATABASE_URL`, arrancar y validar health. |
| Fuga de datos | Suspender la empresa desde `/platform`, revocar sesiones y revisar `audit_logs`. |

## 9. Checklist de salida a producción

- [ ] TLS activo y HSTS verificado.
- [ ] `AUTH_SECRET` y contraseñas rotadas, fuera de git.
- [ ] Backup ejecutado y restauración probada en entorno limpio.
- [ ] Healthcheck externo y alertas activas.
- [ ] Dominio en cookie segura y callback de Google actualizado.
- [ ] Prueba de reserva real de extremo a extremo con un negocio piloto.
