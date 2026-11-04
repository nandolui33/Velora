# Velora

**SaaS multiempresa de gestión de citas y reservas para negocios de belleza y bienestar.**

> **Estado del proyecto:** **Fase 0 implementada**. Existe un esqueleto ejecutable con Next.js App Router, TypeScript, PostgreSQL, Prisma, RLS, Auth.js, seed de dos empresas y pruebas de concurrencia de profesional y recurso. La Fase 1 (auth/tenancy/plataforma) es el siguiente paso.
>
> **Revisión 1.1:** incorpora el feedback sobre recursos físicos, plantillas sectoriales, autenticación estándar con Auth.js, concurrencia de recursos y relación empresa-sede-profesional-servicio-recurso.

Velora es el nombre de trabajo del producto. La marca paraguas del ecosistema de SaaS y la identidad definitiva quedan pendientes de decisión.

---

## 1. Qué es Velora

Velora permite a peluquerías, barberías, centros de estética, salones de uñas y pequeños negocios que trabajan con cita:

- Configurar su negocio, servicios, equipo y horarios.
- Gestionar la agenda desde el móvil o el ordenador.
- Tener su propia página pública de reservas, por ejemplo `/p/alcazar-peluqueros`.
- Recibir reservas online sin que el cliente tenga que registrarse.
- Gestionar su base de clientes y comunicaciones por email.
- Consultar estadísticas básicas del negocio.

No es un marketplace. El cliente reserva directamente con el establecimiento. Velora no compite por el tráfico ni cobra comisión por reserva: vende software de gestión con una suscripción predecible.

### Propuesta de valor

1. **Cada negocio tiene su propia página de reservas**, no un perfil dentro de un directorio.
2. **Multiempresa real desde el primer día**, con aislamiento de datos a nivel de aplicación y de base de datos.
3. **Sencillo y móvil primero**, pensado para personas sin conocimientos técnicos.
4. **Sin comisiones por reserva** ni dependencia de un marketplace.
5. **Coste bajo y predecible**, con infraestructura europea y proveedores modulares.
6. **Preparado para crecer** a decenas o cientos de establecimientos sin rehacer la arquitectura.

---

## 2. Alcance del MVP

### Incluido

| Área | Alcance |
|---|---|
| Plataforma | Alta manual de empresas, activación, suspensión, planes, límites y métricas globales. |
| Autenticación | Google OAuth y enlace mágico por email con **Auth.js**, invitaciones, sesiones revocables y roles. Sin contraseñas propias. |
| Negocio | Perfil, dirección, contacto, redes, logotipo, fotos, zona horaria, moneda, URL pública, políticas. |
| Multisede | Relación empresa-sede desde el inicio; una sede activa en el MVP, esquema preparado para varias. |
| Plantillas | Selección de actividad (barbería, peluquería, manicura, spa, cejas/pestañas, estética, masajes) y propuesta inicial de servicios, categorías, recursos y ajustes. |
| Servicios | Categorías, servicios, variantes de precio/duración, margen entre citas, profesionales asociados, requisitos de recursos, reserva online. |
| Equipo | Profesionales, servicios que realizan, sedes, horario semanal, excepciones, vacaciones, bloqueos, acceso opcional al panel. |
| Recursos | Tipos de recurso, recursos físicos por sede, requisitos por servicio, bloqueos y ocupación; cabinas, camillas, puestos, sillones, salas y equipamiento. |
| Agenda | Vista diaria y semanal, vista por profesional, vista de recursos (P1), creación/edición/cancelación, cambio de servicio o profesional, bloqueos, colores. |
| Reservas online | Página pública, selección de servicio/profesional/fecha/hora, asignación automática de recursos, datos del cliente, confirmación, cancelación mediante enlace seguro. |
| Clientes | Ficha, historial, notas, detección de duplicados, exportación y anonimización. |
| Comunicaciones | Confirmación al cliente, aviso al negocio, cancelación, recordatorio por email; arquitectura preparada para SMS/WhatsApp. |
| Estadísticas | Citas de hoy/semana, reservas futuras, cancelaciones, clientes nuevos, servicios top, ingresos estimados y cobros registrados manualmente. |
| Planes | Planes configurables, prueba, límites, funcionalidades, activación manual por superadministrador. |
| Cumplimiento | RGPD/LOPDGDD, consentimientos, registro de auditoría, retención, backups y derechos de las personas. |

### Fuera del MVP

- Marketplace, directorio o ranking de negocios.
- Pagos online, señales, TPV, caja, inventario, comisiones, propinas, tarjetas regalo, bonos y fidelización.
- SMS y WhatsApp (solo se deja la abstracción preparada).
- Campañas de marketing, listas de espera y programas de puntos.
- Google Calendar, Google Reserve, dominios personalizados y PWA.
- App móvil nativa.
- Multi-sede operativa en la interfaz (el modelo de datos la soporta, pero el MVP trabaja con una sede activa por empresa).
- Cuentas de cliente final y área privada para clientes.
- Facturación automática con Stripe (el MVP activa planes manualmente).
- Informes financieros avanzados.

El detalle funcional, las exclusiones y los criterios de aceptación están en [docs/PRODUCT.md](docs/PRODUCT.md).

---

## 3. Arquitectura en una página

```text
Cliente final ──HTTPS──┐
Negocio ───────HTTPS──┼──> Caddy / TLS
Superadmin ────HTTPS──┘        │
                               ▼
                    Next.js App Router (monolito modular)
                    ├── Web pública /p/[slug]
                    ├── Panel /app
                    ├── Plataforma /platform
                    ├── Recursos / recursos físicos
                    ├── Plantillas sectoriales
                    └── API /api/v1
                               │
              ┌────────────────┼─────────────────┐
              ▼                ▼                 ▼
        PostgreSQL 16     Worker pg-boss     R2 / S3
        (RLS + SQL)       (emails, jobs)     (imágenes)
                               │
                               ▼
                        Proveedor de email
```

Decisiones principales:

- **Monolito modular** en Next.js App Router + TypeScript. Sin microservicios en el MVP.
- **PostgreSQL desde el primer día**, no SQLite: las garantías de concurrencia, aislamiento y constraints son parte del producto.
- **Prisma ORM** con migraciones SQL para RLS, exclusion constraints e índices parciales.
- **Aislamiento por empresa** con `business_id` obligatorio, capa de acceso scoped y Row Level Security como defensa en profundidad.
- **Anti-doble-reserva** con bloqueo por profesional y por recurso, revalidación transaccional y **dos exclusion constraints** en PostgreSQL: una para la agenda del profesional y otra para la ocupación de cada recurso físico.
- **Recursos físicos** como ciudadanos de primera clase: tipos, recursos por sede, requisitos por servicio y reservas de recurso con constraint de exclusividad.
- **Plantillas sectoriales** versionadas que crean categorías, servicios, recursos y ajustes iniciales sin duplicar el motor.
- **Auth.js** con Google OAuth y enlace mágico por email, sesiones en base de datos e invitaciones; sin implementar contraseñas, recuperación ni rotación propias.
- **Email desacoplado** mediante cola persistente en PostgreSQL (`pg-boss`) y adaptador de proveedor.
- **Docker Compose** en un VPS europeo para el MVP, con backups y ruta de migración a servicios gestionados.
- **Sin pagos con tarjeta** en el MVP. No se almacenan datos de tarjetas.

El detalle está en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 4. Documentación

| Documento | Contenido |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Visión, personas, alcance, requisitos funcionales, modelo de negocio, métricas y riesgos de producto. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitectura, módulos, stack, flujos técnicos, despliegue, observabilidad y decisiones. |
| [docs/DATABASE.md](docs/DATABASE.md) | Modelo de datos, tablas, relaciones, constraints, índices, RLS y estrategia de migraciones. |
| [docs/USER-FLOWS.md](docs/USER-FLOWS.md) | Flujos de superadministrador, propietario, profesional y cliente final, con criterios de aceptación. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fases, backlog priorizado, estimación, costes de infraestructura y criterios de lanzamiento. |
| [docs/SECURITY.md](docs/SECURITY.md) | Modelo de amenazas, controles, RGPD, retención, backups, respuesta a incidentes y checklist. |
| [docs/PHASE-0.md](docs/PHASE-0.md) | Estado real de la Fase 0: estructura, arranque, pruebas y limitaciones conocidas. |

Lectura recomendada para aprobar la propuesta:

1. [docs/PRODUCT.md](docs/PRODUCT.md) — qué se construye y qué no.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — cómo se construye.
3. [docs/ROADMAP.md](docs/ROADMAP.md) — cuándo, en qué orden y a qué coste.
4. [docs/DATABASE.md](docs/DATABASE.md) y [docs/SECURITY.md](docs/SECURITY.md) — revisión técnica y de cumplimiento.

### Cambios incorporados en la revisión 1.1

- **Recursos físicos:** nuevo módulo `resources`, requisitos por servicio y reservas de recurso con exclusividad en PostgreSQL.
- **Plantillas sectoriales:** 7 actividades iniciales con servicios, categorías, recursos y ajustes propuestos, sin duplicar el motor.
- **Auth.js:** se sustituye la autenticación propia por Auth.js con Google OAuth y enlace mágico; se elimina la gestión de contraseñas.
- **Concurrencia de recursos:** además de la agenda del profesional, se protege cada recurso físico con su propia exclusion constraint.
- **Multisede:** relaciones N:N entre empresa, sede, profesional, servicio y recurso desde el primer esquema; una sede activa en la UI del MVP.
- **Empresites:** se revisa su OAuth propio; se reutiliza el conocimiento de configuración, no el código ni los secretos.

---

## 5. Stack previsto

| Capa | Elección | Motivo |
|---|---|---|
| Runtime | Node.js 22 LTS + npm | Runtime estable y soporte a largo plazo. |
| Framework | Next.js (App Router), React, TypeScript estricto | Un solo despliegue, SSR para la web pública, server actions para el panel. |
| Estilos | Tailwind CSS + componentes propios sobre Radix UI | Control visual, accesibilidad y bajo peso. |
| Datos | PostgreSQL 16 + Prisma ORM | Transacciones, constraints, RLS y tipado. |
| Auth | Auth.js v5 + Prisma Adapter; Google OAuth y enlace mágico | Auth estándar, sesiones en base de datos y menor superficie de seguridad propia. |
| Validación | Zod + React Hook Form | Esquemas compartidos cliente/servidor. |
| Cola | pg-boss sobre PostgreSQL | Menos infraestructura que Redis; suficiente para el MVP. |
| Email | Adaptador de proveedor (Brevo por defecto, Resend/SES como alternativas) | Proveedor europeo, coste bajo y posibilidad de cambiar. |
| Imágenes | S3-compatible (Cloudflare R2) + sharp | Fuera del contenedor, egress gratuito, re-encode seguro. |
| Despliegue | Docker Compose + Caddy en VPS europeo | Coste bajo, portabilidad y control. |
| Tests | Vitest + PostgreSQL real | Cubrir RLS, aislamiento y concurrencia; Playwright se añade en fases posteriores. |

Las versiones principales están fijadas en `package.json`. Las actualizaciones se revisan y prueban antes de aplicarlas.

---

## 6. Estructura prevista del repositorio

```text
velora/
├── src/
│   ├── app/
│   │   ├── (public)/p/[slug]/...        # Web pública y reservas
│   │   ├── (auth)/login/...             # Autenticación
│   │   ├── (app)/app/...                # Panel del negocio
│   │   ├── (platform)/platform/...      # Superadministración
│   │   └── api/v1/...                   # API pública versionada
│   ├── modules/
│   │   ├── auth/
│   │   ├── businesses/
│   │   ├── locations/
│   │   ├── memberships/
│   │   ├── services/
│   │   ├── professionals/
│   │   ├── resources/
│   │   ├── templates/
│   │   ├── scheduling/
│   │   ├── appointments/
│   │   ├── clients/
│   │   ├── notifications/
│   │   ├── plans/
│   │   ├── analytics/
│   │   └── audit/
│   ├── components/                      # UI reutilizable
│   ├── lib/                             # db, auth, tenant, email, storage, env
│   └── worker/                          # Proceso de trabajos en segundo plano
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docs/
├── scripts/
├── docker/
├── tests/
└── README.md
```

La estructura es una previsión; se ajustará en la Fase 0 sin cambiar los límites de módulo.

---

## 7. Puesta en marcha

Requisitos: Node.js 22, npm y Docker.

```bash
npm install
cp .env.example .env
docker compose up -d postgres mailpit
npm run db:migrate
npm run db:seed
npm run dev
```

Servicios locales:

- App: `http://localhost:3000`
- PostgreSQL: `localhost:5433` (se usa 5433 para no chocar con otros proyectos)
- Correo de desarrollo: Mailpit en `http://localhost:8025`

Comandos útiles:

```bash
npm test            # RLS + concurrencia de profesional y recurso
npm run typecheck
npm run lint
npm run build
npm run db:studio
```

> En la Fase 0 no se almacenan imágenes todavía; MinIO/R2 se incorpora en la fase de medios. El correo de desarrollo se envía a Mailpit.

### Credenciales locales

- Owner: `owner@example.test`
- Superadmin: `superadmin@example.test`
- No hay contraseñas: se entra con Google o enlace mágico. En local, el enlace mágico se lee en Mailpit.
- Las credenciales de Google de `.env` son marcadores de desarrollo; para probar Google hay que configurar un cliente OAuth propio.

### Base de datos y RLS

- `DATABASE_URL` usa el rol `velora_app` (sin `BYPASSRLS`).
- `DIRECT_URL` usa `velora_owner` para migraciones y seed.
- Las migraciones incluyen RLS, claves compuestas y dos exclusion constraints:
  - `appointments_no_overlap` para el profesional.
  - `resource_reservations_no_overlap` para cada recurso físico.
- Las pruebas crean empresas aisladas y comprueban que sin contexto no se devuelven filas.

---

## 8. Principios de trabajo

1. **Aprobar antes de implementar.** Este repositorio no avanza a código hasta recibir aprobación explícita.
2. **Fases pequeñas y verificables.** Cada fase termina con tests, revisión funcional y criterios de salida.
3. **No sobrearquitecturar.** Monolito modular, una base de datos, una cola sencilla y servicios gestionados solo cuando aporten valor.
4. **Seguridad y aislamiento por defecto.** Ninguna consulta de negocio se ejecuta sin contexto de empresa.
5. **Mobile-first real.** La agenda y el flujo de reserva se prueban primero en móvil.
6. **Documentación viva.** Las decisiones se registran como ADR y los documentos se actualizan con el código.

---

## 9. Decisiones pendientes de aprobación

| # | Decisión | Propuesta |
|---|---|---|
| D1 | Nombre del producto y marca paraguas | Usar **Velora** como nombre de trabajo; definir marca definitiva antes de la Fase 0. |
| D2 | Mercado inicial | España, español, EUR, zona horaria configurable con `Europe/Madrid` por defecto. |
| D3 | Sedes por empresa en el MVP | Una sede activa, pero relaciones N:N empresa-sede-profesional-servicio-recurso desde el inicio. |
| D4 | Modelo de precios | Hipótesis: 19 €/mes (1 profesional), 34 €/mes (hasta 5), 59 €/mes (hasta 12); 14 días de prueba. Validar antes de publicar. |
| D5 | Proveedor de email | Brevo (UE) como opción inicial; adaptador para cambiar a Resend/SES. |
| D6 | Infraestructura | VPS europeo con Docker Compose; ruta de migración a Postgres gestionado. |
| D7 | Auth | **Auth.js v5** con Google OAuth y enlace mágico, sesiones en base de datos. Sin contraseñas propias. |
| D8 | Cobros | Registro manual de cobro en la cita; sin TPV ni pagos online. |
| D9 | Recursos físicos | Tipos, recursos por sede y requisitos por servicio; exclusividad garantizada por constraint de PostgreSQL. |
| D10 | Plantillas sectoriales | 7 plantillas iniciales versionadas; aplicación no destructiva y editable. |
| D11 | Credenciales Google | Proyecto de Google Cloud compartido si conviene, pero **cliente OAuth propio y secreto propio de Velora**; no se copian secretos de Empresites. |

Si alguna de estas decisiones no encaja, debe corregirse antes de empezar la implementación.

---

## 10. Referencias funcionales

Estas referencias se han usado para estudiar funcionalidades y experiencia de usuario. **No se copian diseño, código ni identidad visual.**

- [Booksy Biz España](https://biz.booksy.com/es-es) — agenda, equipo, clientes, pagos, marketing y planes.
- [Precios de Booksy](https://biz.booksy.com/es-es/precios) — cuota base y suplemento por empleado.
- [Versum España](https://www.versum.com/m/es/) — gestión de salones, agenda, página de reservas, estadísticas e inventario.
- [Funciones de Versum](https://www.versum.com/m/es/funciones/) — ficha de cliente, agenda, recordatorios y equipo.
- [Planes de Versum](https://www.versum.com/m/es/planes/) — tramos por número de agendas/empleados.
- [Alcázar Peluqueros en Versum](https://alcazarpeluqueros.versum.com/) — ejemplo real de página pública de reservas.

---

## 11. Próximo paso

La **Fase 0** está completada:

- Repositorio Next.js App Router + TypeScript.
- Docker Compose con PostgreSQL y Mailpit.
- Esquema Prisma inicial.
- RLS, claves compuestas y dos exclusion constraints.
- Auth.js con Google y enlace mágico.
- Seed de dos empresas.
- Pruebas de aislamiento y concurrencia.

El siguiente paso es la **Fase 1: auth/tenancy/plataforma**, con alta de empresas, invitaciones, roles, suspensión y planes manuales. Las decisiones D1–D11 siguen siendo la referencia de alcance y deben confirmarse antes de ampliar módulos.
