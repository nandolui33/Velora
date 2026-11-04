# PHASE-3.md — Agenda, disponibilidad y reservas

**Estado:** completada.

**Objetivo:** una cita puede crearse desde el panel o desde la web pública, sin
solapamientos de profesional ni de recursos físicos, con confirmación y
cancelación por email.

---

## 1. Qué incluye

| Área | Implementación |
|---|---|
| Motor de disponibilidad | Función pura en `src/modules/scheduling/availability.ts`. Sin Prisma ni cookies. |
| Zona horaria y DST | `src/modules/scheduling/time.ts`: conversión hora local ↔ UTC con `Intl`, horas inexistentes descartadas y ambiguas resueltas a la primera ocurrencia. |
| Carga de datos | `src/modules/scheduling/data.ts`: horarios, excepciones, citas y ocupación de recursos en bloque; fusión de profesionales para "cualquiera disponible". |
| API pública | `GET /api/v1/public/[slug]/availability` y `POST /api/v1/public/[slug]/bookings`. |
| Agenda del panel | `/app/agenda`: vista diaria por profesional, vista semanal, alta de cita, movimiento, cancelación y bloqueo de recurso. |
| Reserva pública | `/p/[slug]/reservar`: servicio → profesional → día y hora → datos. Sin registro. |
| Gestión de la cita | `/cita/[token]`: detalle y cancelación con enlace del email. |
| Transacción de reserva | `src/modules/scheduling/booking.ts`: lock del profesional, locks de recursos por ID, revalidación, snapshots, idempotencia y outbox. |
| Notificaciones | `src/modules/notifications/`: plantillas + dispatcher con `FOR UPDATE SKIP LOCKED`, backoff 1/5/30 min y máximo 3 intentos. |
| Worker | `scripts/worker.ts` (`npm run worker`, `npm run worker -- --once`). |

## 2. Modelo de datos (migraciones de la fase)

- `appointments` añade `service_name`, `service_variant_name`, `professional_name`,
  `duration_minutes`, `buffer_after_minutes`, `booking_reference`,
  `public_token_hash` y `created_by`.
- Unicidades nuevas: `(business_id, booking_reference)` y `(business_id, public_token_hash)`.
- `clients`: las unicidades de teléfono y email pasan a índices **parciales**
  (`WHERE ... IS NOT NULL AND deleted_at IS NULL`), para permitir anonimización.
- `notification_outbox`, `idempotency_keys` y `email_suppressions` con RLS de
  tenant/plataforma.
- `resolve_business_slug(text)`: función `SECURITY DEFINER` que, fuera de
  contexto de empresa, solo devuelve el `id` de un slug publicado. Es la única
  lectura pública permitida; el resto pasa por RLS con contexto de empresa.

Las exclusion constraints (`appointments_no_overlap` y
`resource_reservations_no_overlap`) ya existían desde la migración inicial y son
la última garantía de exclusividad; la aplicación las acompaña con locks y
revalidación dentro de la transacción.

## 3. Decisiones

1. **Motor puro + carga aparte.** El cálculo se prueba sin base de datos, con
   DST, márgenes, ausencias y requisitos de recursos.
2. **Revalidación real en la transacción.** No se confía en la disponibilidad
   mostrada al cliente: se recalcula el día del profesional con los datos ya
   bloqueados y solo entonces se inserta.
3. **Orden de locks estable.** Profesional primero y recursos por `id`; evita
   deadlocks entre reservas concurrentes.
4. **Recursos en tabla propia de ocupación.** Citas y bloqueos insertan en
   `resource_reservations`, así una cabina y un mantenimiento compiten por la
   misma constraint.
5. **Token de gestión compuesto.** `businessId.secreto`: el `businessId` permite
   resolver el tenant sin una función adicional y el secreto (32 bytes) solo se
   guarda como hash SHA-256. El token viaja únicamente en el email.
6. **Idempotencia en la misma transacción.** La clave se reserva al principio y
   se guarda la respuesta al final; un reintento devuelve la misma reserva y un
   cuerpo distinto devuelve `IDEMPOTENCY_CONFLICT`.
7. **Outbox transaccional.** Los emails se encolan en la transacción de la cita;
   el worker los envía después. La cancelación anula los pendientes.
8. **Recordatorio programado.** Se crea a `starts_at - reminder_hours` y solo si
   esa hora aún no ha pasado; al mover la cita se anula y se reprograma.

## 4. Contrato de la API pública

```http
GET /api/v1/public/alcazar-peluqueros/availability
    ?serviceId=<uuid>&date=2026-11-05&days=3&professionalId=<uuid>&variantId=<uuid>
→ 200 { "days": [ { "date": "2026-11-05", "slots": [ { "startsAt": "...", "serviceEndsAt": "...", "professionalId": "...", "professionalName": "Ana", "professionalColor": "#...", "resources": [ { "id": "...", "name": "Sillón 1" } ] } ] } ] }
```

```http
POST /api/v1/public/alcazar-peluqueros/bookings
{ "serviceId": "...", "startsAt": "2026-11-05T08:00:00.000Z", "professionalId": null,
  "idempotencyKey": "...", "notes": null,
  "client": { "firstName": "Ana", "email": "ana@example.test", "phone": null } }
→ 201 { "booking": { "reference": "SCFMF8", "startsAt": "...", "serviceName": "...", "professionalName": "Ana" } }
→ 409 { "error": "SLOT_TAKEN" | "RESOURCE_TAKEN" | "IDEMPOTENCY_CONFLICT" }
```

La respuesta nunca incluye datos de otras empresas ni el token de gestión: el
token solo se envía por email.

## 5. Pruebas

`tests/availability.test.ts` (13 pruebas, sin base de datos):

- Rejilla de huecos, margen posterior y semántica `[inicio, fin)`.
- Antelación mínima y máxima.
- Ausencias del profesional y día cerrado.
- Cambio de hora de primavera y otoño en `Europe/Madrid`, y hora inexistente.
- Recursos: libres, cantidad, recurso concreto y asignación determinista.

`tests/booking.test.ts` (8 pruebas, contra PostgreSQL real):

- Cita con snapshots, recursos y avisos encolados.
- El hueco reservado deja de ofrecerse.
- Segunda reserva del mismo hueco → `SLOT_TAKEN`.
- 20 reservas simultáneas al mismo profesional → 1 éxito y 19 `SLOT_TAKEN`.
- 20 reservas simultáneas a la misma cabina con 20 profesionales → 1 éxito y
  conflictos `RESOURCE_TAKEN`/`SLOT_TAKEN`.
- Idempotencia y conflicto de clave.
- Cancelación: estado, liberación de recursos, anulación de pendientes y dos
  emails de cancelación.
- Movimiento de cita: libera la ocupación anterior y crea la nueva.

## 6. Cómo probarlo a mano

```bash
docker compose up -d postgres mailpit
npm run db:migrate && npm run db:seed
npm run dev          # terminal 1
npm run worker       # terminal 2
```

1. Abre `http://localhost:3001/p/alcazar-peluqueros/reservar`.
2. Reserva un hueco: aparece la confirmación con referencia.
3. `http://localhost:8025` muestra el email con el enlace de gestión.
4. Abre el enlace: puedes ver y cancelar la cita.
5. En el panel, `/app/agenda` muestra la cita, sus recursos y permite moverla o
   cancelarla.

## 7. Límites conocidos

- Sin vista de calendario por recurso (P1 del roadmap).
- El envío es síncrono por SMTP; en producción se sustituirá por Brevo tras la
  interfaz `EmailProvider`.
- Sin reintentos de UI automáticos: ante un conflicto se muestran alternativas
  reales y el cliente elige.
- La agenda no edita el horario del equipo desde la propia vista; se hace en
  `/app/equipo`.
