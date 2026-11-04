# HANDOFF — Traspaso entre ordenadores y sesiones

Documento para retomar el proyecto en otro ordenador o en una sesión nueva de
DSH sin perder contexto. El código vive en GitHub; este fichero resume el estado.

Última actualización: fase 5 en curso (hardening y despliegue hechos).

---

## 1. Repositorio y estado

- Repo: https://github.com/nandolui33/Velora
- Rama: `main`
- Últimos commits:
  - `2b3f873` feat(fase-5): hardening, retencion y despliegue
  - `fa34604` feat(fase-4): clientes, metricas, consentimientos y planes
  - `6889a62` feat(fase-3): agenda, disponibilidad y reservas
- Fases 0–4 completas. Fase 5: hardening y despliegue hechos; falta verificación
  en infraestructura (TLS, backups, monitorización) y el piloto real.

## 2. Arrancar en un ordenador nuevo

Requisitos: Node.js 22+, npm, Docker Desktop.

```bash
git clone https://github.com/nandolui33/Velora.git
cd Velora
npm install
# Crear .env y .env.local (no están en git)
docker compose up -d postgres mailpit
npm run db:migrate
npm run db:seed
npm run dev            # http://localhost:3001
npm run worker         # en otra terminal: outbox + retención
```

`.env` mínimo (desarrollo):

```env
DATABASE_URL="postgresql://velora_app:velora_app_dev@localhost:5433/velora?schema=public"
DIRECT_URL="postgresql://velora_owner:velora_owner_dev@localhost:5433/velora?schema=public"
AUTH_URL="http://localhost:3001"
AUTH_TRUST_HOST="true"
EMAIL_SERVER="smtp://localhost:1025"
EMAIL_FROM="Velora <no-reply@velora.test>"
NEXT_PUBLIC_APP_URL="http://localhost:3001"
```

`.env.local` (secretos locales, no subir): `AUTH_SECRET`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`.

## 3. Cuentas de prueba

- Owner: `owner@example.test`
- Superadmin: `superadmin@example.test`
- Sin contraseña: enlace mágico (se lee en Mailpit, `http://localhost:8025`) o
  Google OAuth. Los enlaces son de un solo uso: hay que abrir el correo más
  reciente y hacer un solo clic.

## 4. Dónde está cada cosa

| Área | Ruta |
|---|---|
| Motor de disponibilidad | `src/modules/scheduling/availability.ts` |
| Reservas y transacción | `src/modules/scheduling/booking.ts` |
| Carga de datos de agenda | `src/modules/scheduling/data.ts` |
| API pública | `src/app/api/v1/public/[slug]/` |
| Agenda del panel | `src/app/app/agenda/` |
| Reserva pública | `src/app/p/[slug]/reservar/` |
| Gestión de cita por token | `src/app/cita/[token]/` |
| Clientes, exportación | `src/app/app/clientes/`, `src/modules/clients/` |
| Métricas | `src/modules/stats/summary.ts` |
| Planes y overrides | `src/modules/plans/limits.ts` |
| Consentimientos y retención | `src/modules/retention/cleanup.ts`, `prisma/schema.prisma` |
| Notificaciones | `src/modules/notifications/`, `scripts/worker.ts` |
| Rate limiting y cabeceras | `src/lib/rate-limit.ts`, `next.config.ts` |
| Despliegue | `Dockerfile`, `docker-compose.prod.yml`, `Caddyfile`, `docs/DEPLOY.md` |
| Documentación por fase | `docs/PHASE-0.md` … `docs/PHASE-5.md` |

## 5. Verificación

```bash
npm run typecheck
npm run lint
npm test        # 46 pruebas: RLS, concurrencia, disponibilidad, reservas, clientes, planes, hardening
npm run build
```

Migraciones: `prisma/migrations/` (init, phase1, phase2, phase3, phase4).

## 6. Pendiente para la próxima sesión

1. Desplegar en VPS: `docker compose -f docker-compose.prod.yml` + Caddy; probar
   backup y restauración según `docs/DEPLOY.md`.
2. Suite E2E con Playwright en staging y auditoría Lighthouse/axe.
3. Editor de overrides de plan en `/platform` (hoy se aplican por
   `businesses.plan_overrides`).
4. Piloto con un negocio real y ajustes de UX.

## 7. Notas del entorno (DSH en Windows)

- El sandbox de DSH bloquea procesos hijos (npm, vitest, next, prisma, docker):
  esos comandos piden aprobación. Con el modo «acceso completo» dejan de pedirla.
- Git puede necesitar `-c http.sslBackend=openssl` si schannel falla.
- Caché de npm dentro del workspace: `npm install --cache C:\Fernando\IA\.npm-cache`.

## 8. Cómo usar este documento en una sesión nueva

Pide a DSH: «Lee `docs/HANDOFF.md` y `docs/PHASE-5.md` y continúa con el punto 1
de pendientes». Las conversaciones de DSH son locales y no se pueden importar ni
fusionar entre ordenadores; este fichero es el traspaso.
