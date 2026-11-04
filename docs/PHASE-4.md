# PHASE-4.md — Clientes, estadísticas, planes y RGPD

**Estado:** completada (con dos piezas aparcadas: editor visual de overrides de
plan y retención automática programada).

**Objetivo:** pasar de "reservas" a "gestión del negocio": fichas de clientes con
historial, métricas del periodo, consentimientos, exportación y anonimización, y
límites de plan aplicados de verdad.

---

## 1. Qué incluye

| Área | Implementación |
|---|---|
| Listado de clientes | `/app/clientes` con búsqueda por nombre, email o teléfono, paginación y contador de citas. |
| Ficha de cliente | `/app/clientes/[id]`: datos editables, última visita, métricas, consentimientos, historial y duplicados. |
| Deduplicación | Índices únicos parciales por email y teléfono (solo fichas activas) + aviso de posibles duplicados. |
| Fusión manual | `mergeClients`: mueve citas y consentimientos, recalcula la última visita y anonimiza la ficha origen. |
| Exportación | `/app/clientes/export?format=csv\|json`, limitada por RLS a la empresa actual. |
| Anonimización | Borra los datos personales, revoca consentimientos y conserva las citas para las métricas. |
| Estadísticas | `getDashboardStats`: citas de hoy y de la semana, próximas, nuevas, completadas, canceladas, no presentados, ingreso estimado vs cobrado y servicios top. |
| Consentimientos | Tabla `consent_records` con tipo, versión de política, origen y revocación. Alta desde la ficha y desde la reserva online. |
| Límites de plan | `plan.maxProfessionals` aplicado al crear o reactivar profesionales, con overrides por empresa (`businesses.plan_overrides`). |
| Onboarding | Checklist en el panel con los pasos hasta publicar y acceso directo a la configuración. |

## 2. Modelo de datos

- `consent_records`: `business_id`, `client_id`, `type` (`privacy`, `marketing`,
  `health`), `policy_version`, `granted`, `source`, `ip_hash`, `user_agent`,
  `created_at`, `revoked_at`. RLS de tenant y plataforma.
- `businesses.plan_overrides` (`jsonb`): límites y features que el
  superadministrador puede ajustar sin tocar la suscripción.
- Los índices únicos de clientes son **parciales**:
  `WHERE phone_e164 IS NOT NULL AND deleted_at IS NULL` (y el equivalente de
  email), de forma que anonimizar libera el contacto sin romper la unicidad.

## 3. Decisiones

1. **La anonimización no borra citas.** Se limpian los datos personales y la
   ficha queda fuera de listados y exportaciones, pero las citas permanecen para
   métricas agregadas y para la agenda histórica.
2. **Fusión explícita, nunca automática.** Si dos fichas comparten email o
   teléfono se avisa en la ficha; fusionar es una acción manual con auditoría
   (`client.merged`).
3. **Exportación con RLS.** El endpoint usa `withTenant`, así que aunque la
   consulta no filtre por empresa a mano, la política de base de datos lo hace.
4. **Límites efectivos = plan + override.** Un override numérico del negocio
   gana al plan; si no hay suscripción, el límite es ilimitado (entorno local).
5. **Consentimiento ligado a la reserva.** Al crear un cliente desde la reserva
   online se registra un consentimiento de privacidad con `source =
   online_booking` y la versión de `PRIVACY_POLICY_VERSION` (por defecto `1.0`).

## 4. Pruebas

`tests/phase4.test.ts` (8 pruebas, PostgreSQL real):

- La base rechaza dos fichas con el mismo email.
- Búsqueda por email y teléfono con paginación.
- Contacto duplicado → `DUPLICATE_CONTACT`; edición válida actualiza la ficha.
- Fusión: mueve citas, mueve consentimientos, anonimiza el origen.
- Anonimización: borra PII y conserva la cita y su importe.
- Exportación CSV/JSON: contiene los clientes propios y ninguno de otra empresa.
- Métricas: citas completadas, ingreso estimado, cobrado y servicio top.
- Plan de 1 profesional bloquea al segundo (`PlanLimitError`) y el override lo
  permite.

## 5. Cómo probarlo a mano

```bash
npm run db:migrate && npm run db:seed
npm run dev
```

1. Entra como `owner@example.test` (enlace mágico en Mailpit).
2. `/app/clientes`: busca por teléfono, abre una ficha y revisa el historial.
3. Exporta CSV y JSON: solo deben aparecer clientes de Alcázar.
4. Registra un consentimiento de marketing y anonimiza una ficha de prueba.
5. `/app`: comprueba las métricas del periodo y el plan efectivo.
6. `/app/equipo`: con un plan de 1 profesional, crear el segundo muestra el aviso
   de límite.

## 6. Límites conocidos

- No hay editor visual de overrides en `/platform`; se aplican por API/DB
  (`businesses.plan_overrides`). El panel de plataforma muestra los planes.
- La retención automática programada (purga por antigüedad) queda para la fase de
  hardening; hoy la anonimización es manual y auditada.
- La atribución de Empresites y las herramientas de soporte no entran en esta
  fase.
