# Fase 0 — Fundaciones implementadas

**Estado:** completada  
**Fecha:** 2026-11-04  
**Siguiente fase:** Fase 1 — Auth/tenancy/plataforma

---

## 1. Qué incluye

- Next.js 16 App Router + TypeScript estricto + Tailwind CSS 4.
- PostgreSQL 16 con dos roles: `velora_owner` (migraciones/seed) y `velora_app` (runtime, sin `BYPASSRLS`).
- Prisma ORM con migración inicial aplicada.
- RLS activo y forzado en las tablas de negocio.
- Claves compuestas para evitar referencias entre empresas.
- Dos exclusion constraints:
  - `appointments_no_overlap` para el profesional.
  - `resource_reservations_no_overlap` para cada recurso físico.
- Auth.js v5 con Google OAuth y enlace mágico por email.
- Seed de dos empresas, dos planes, profesionales, servicios, recursos y clientes.
- Pruebas de aislamiento y concurrencia con PostgreSQL real.
- CI con PostgreSQL de servicio.

## 2. Estructura

```text
src/
├── app/
│   ├── page.tsx                     # Landing
│   ├── login/                       # Google + enlace mágico
│   ├── app/                         # Panel protegido por sesión y membership
│   ├── platform/                    # Reservado a superadmin
│   └── api/
│       ├── auth/[...nextauth]/      # Auth.js
│       └── health/                  # Healthcheck
├── auth.ts                          # Configuración de Auth.js
├── lib/
│   ├── db.ts                        # Prisma singleton
│   ├── tenant.ts                    # withTenant / withUser
│   └── current-context.ts           # Sesión + membership + empresa
└── types/next-auth.d.ts
prisma/
├── schema.prisma
├── migrations/20261104153348_init/
└── seed.ts
tests/
├── helpers.ts
├── rls.test.ts
└── concurrency.test.ts
```

## 3. Cómo arrancar

```bash
npm install
cp .env.example .env
docker compose up -d postgres mailpit
npm run db:migrate
npm run db:seed
npm run dev
```

- App: `http://localhost:3000`
- PostgreSQL: `localhost:5433`
- Mailpit: `http://localhost:8025`

## 4. Pruebas

```bash
npm test
```

Resultado esperado:

- Sin contexto de empresa, RLS devuelve 0 filas.
- Un usuario solo ve sus memberships.
- 20 citas concurrentes para el mismo profesional: 1 éxito.
- 20 citas concurrentes para la misma cabina: 1 éxito.
- Un bloqueo y una reserva simultánea del mismo recurso: 1 éxito.

También se ejecutan:

```bash
npm run typecheck
npm run lint
npm run build
```

## 5. Auth.js

- Google OAuth y Nodemailer (enlace mágico).
- Sesiones en base de datos, no JWT.
- Sin contraseñas propias.
- El login está limitado en la práctica por la membership: `/app` muestra “sin acceso” si el usuario no pertenece a una empresa.
- El flujo de invitaciones se implementa en la Fase 1.
- Para probar el enlace mágico en local, el correo llega a Mailpit.
- Las credenciales de Google del `.env` son marcadores; hay que configurar un cliente OAuth propio de Velora.

## 6. Limitaciones conocidas

- MinIO no está incluido en Docker Compose porque el registro de imágenes no estaba disponible en el entorno local; el almacenamiento R2/S3 se incorpora en la fase de medios.
- No hay página pública ni motor de disponibilidad todavía.
- No hay plantillas sectoriales todavía; el esquema base está preparado.
- No hay invitaciones, planes editables ni panel de plataforma; corresponden a Fase 1.
- No se ha configurado un cliente OAuth real de Google todavía.
- `npm audit --omit=dev` está limpio; quedan vulnerabilidades moderadas en herramientas de desarrollo (ESLint), que se revisan en mantenimiento.

## 7. Próximos pasos

1. Fase 1: auth/tenancy/plataforma.
2. Invitaciones y RBAC.
3. Alta de empresas y planes manuales.
4. Suspensión/reactivación.
5. Ajustes del negocio y sede.

**No se debe empezar la Fase 2 sin cerrar la Fase 1.**
