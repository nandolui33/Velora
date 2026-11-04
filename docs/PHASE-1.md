# Fase 1 — Auth, tenancy y plataforma

**Estado:** completada  
**Fecha:** 2026-11-04  
**Siguiente fase:** Fase 2 — servicios, equipo y recursos (completada; ver [PHASE-2.md](PHASE-2.md))

---

## 1. Qué incluye

- Invitaciones con token opaco de un solo uso:
  - token bruto solo en el email;
  - SHA-256 en `invitations.token_hash`;
  - caducidad de 7 días;
  - aceptación autenticada y comprobación de email.
- RBAC:
  - `owner`: configura negocio, sede, horario y publicación.
  - `professional`: accede al panel, pero no a ajustes.
  - `superadmin`: accede a `/platform`.
- Plataforma:
  - resumen de empresas y planes;
  - alta manual de empresa, sede, suscripción e invitación del owner;
  - detalle con plan, estado, invitaciones y auditoría;
  - cambio de plan y días de prueba;
  - suspensión y reactivación;
  - reenvío de invitación.
- Configuración del negocio:
  - datos fiscales y de contacto;
  - slug público, zona horaria, moneda y reglas de agenda;
  - sede principal;
  - horario semanal de 7 días;
  - publicación.
- Auditoría append-only para acciones de plataforma y negocio.
- RLS y `SECURITY DEFINER` solo para resolver la invitación por token.

## 2. Modelos nuevos

| Tabla | Uso |
|---|---|
| `invitations` | Invitaciones por empresa, email, rol y token hash. |
| `business_hours` | Horario semanal por sede. |
| `audit_logs` | Traza de acciones de plataforma y negocio. |

La función `get_invitation_by_token(hash)` permite leer una invitación sin contexto de tenant, sin abrir la tabla a consultas arbitrarias. Devuelve solo los datos necesarios para la pantalla de aceptación.

## 3. Flujos

### Alta de empresa

1. Superadmin entra en `/platform/empresas`.
2. Crea empresa, slug, email del owner, plan y días de prueba.
3. En una transacción se crean empresa, sede principal, suscripción e invitación.
4. Se envía el email al owner con `/invitacion/{token}`.
5. El owner abre el enlace, inicia sesión con el mismo email y acepta.
6. Se crea la membership y la invitación queda aceptada.
7. El owner entra en `/app` y completa ajustes, sede, horario y publicación.

### Suspensión

1. Superadmin cambia el estado a `suspended` con un motivo.
2. Se registra `business.suspended` en auditoría.
3. La página pública y la agenda deberán respetar el estado en fases posteriores.

### Configuración del negocio

- Solo `owner` puede acceder a `/app/ajustes`.
- Un `professional` recibe 404.
- Guardar negocio, sede u horario registra auditoría.
- Publicar exige una sede y los 7 días de horario.

## 4. Pruebas

`tests/phase1.test.ts` cubre:

- resolución de invitación por token;
- token incorrecto;
- aislamiento de invitaciones, horarios y auditoría entre empresas;
- creación de empresa con contexto de plataforma y auditoría.

También se mantienen las pruebas de RLS y de concurrencia de profesional, recurso y bloqueo.

## 5. Limitaciones conocidas

- La edición visual de planes y límites aún no existe; se asignan planes del catálogo.
- No se aplican límites de plan al crear profesionales/sedes; llegarán con los módulos correspondientes.
- No hay selector de múltiples empresas; el MVP usa una membership activa.
- No hay página pública `/p/[slug]` todavía; `publishedAt` ya se persiste.
- No hay plantillas sectoriales; corresponden a Fase 2.
- El email local se captura en Mailpit, no se entrega a Gmail.
- La vinculación automática de Google por email está limitada a desarrollo; en producción habrá un flujo explícito o invitaciones verificadas.
- No se ha implementado recuperación de invitaciones caducadas desde el panel salvo reenviar una nueva.

## 6. Criterio de salida

- `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` pasan.
- Superadmin puede crear una empresa y enviar la invitación.
- El owner acepta la invitación y accede a `/app`.
- Un professional no puede abrir `/app/ajustes`.
- El owner guarda negocio, sede y horario, y publica.
- Las acciones quedan en `audit_logs`.
