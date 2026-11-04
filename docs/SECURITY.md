# SECURITY.md — Seguridad, privacidad y cumplimiento

**Producto:** Velora (nombre de trabajo)  
**Documento:** modelo de seguridad y cumplimiento para aprobación  
**Versión:** 1.1  
**Estado:** diseño; Fase 0 implementada  
**Cambios v1.1:** Auth.js, recursos físicos, plantillas sectoriales y multisede.

> Este documento es una propuesta técnica y operativa. No constituye asesoramiento jurídico. La política de privacidad, los términos, el DPA y los periodos de retención deben revisarse con asesoría legal antes del lanzamiento.

---

## 1. Objetivo

Proteger:

- Los datos personales de los clientes finales.
- La agenda, los servicios y la información comercial de cada negocio.
- Las credenciales y sesiones de propietarios, profesionales y superadministradores.
- La disponibilidad del servicio.
- La reputación de los negocios y de la plataforma.

Y hacerlo con un coste proporcionado al tamaño del MVP, sin introducir complejidad que no aporte una reducción real de riesgo.

---

## 2. Activos

| Activo | Sensibilidad | Dónde vive |
|---|---|---|
| Datos de clientes finales | Alta | PostgreSQL |
| Citas e historial | Alta | PostgreSQL |
| Cuentas OAuth y sesiones | Crítica | Auth.js + PostgreSQL + cookie |
| Datos del negocio | Media | PostgreSQL |
| Imágenes y logotipos | Baja/media | R2 |
| Auditoría | Alta | PostgreSQL |
| Planes y suscripciones | Media | PostgreSQL |
| Secretos de aplicación | Crítica | Variables de entorno |
| Backups | Crítica | R2 cifrado |
| Emails | Media | Proveedor externo |
| Disponibilidad | Alta | Infraestructura |

---

## 3. Actores y confianza

| Actor | Confianza | Riesgo principal |
|---|---|---|
| Cliente final anónimo | Baja | Spam, reservas falsas, scraping, abuso. |
| Cliente con enlace de gestión | Media | Acceso a su propia cita; token robado. |
| Profesional | Media | Acceso indebido a datos de otros profesionales o empresas. |
| Propietario | Alta | Compromiso de cuenta; acciones destructivas. |
| Superadministrador | Muy alta | Acceso global; objetivo de phishing. |
| Empleado interno | Alta | Error humano o abuso. |
| Proveedor de email | Media | Fuga o mala configuración. |
| Proveedor cloud | Media | Fallo o acceso indebido. |
| Atacante externo | Ninguna | Credential stuffing, IDOR, XSS, DoS. |

### 3.1 Límites de confianza

```text
Navegador  ──HTTPS──>  Caddy  ──>  Next.js  ──>  PostgreSQL
   │                                   │
   │                                   ├──> R2
   │                                   └──> Outbox ──> Worker ──> Brevo
   │
   └── no se confía en nada que venga del cliente
```

Regla: **el navegador nunca es una fuente de verdad** para permisos, precios, límites, disponibilidad ni pertenencia a una empresa.

---

## 4. Modelo de amenazas (STRIDE)

| Amenaza | Ejemplo | Impacto | Mitigación |
|---|---|---|---|
| **Spoofing** | Robo de sesión, OAuth mal configurado, invitación interceptada. | Alto | Auth.js, Google OAuth, PKCE/state, cookies seguras, tokens hasheados, verificación de email. |
| **Tampering** | Cambiar `businessId`, precio o `professionalId` en una petición. | Alto | Contexto de tenant, validación de pertenencia, precio calculado en servidor, FKs compuestas. |
| **Repudiation** | Un usuario niega haber cancelado o modificado una cita. | Medio | Auditoría append-only con actor, IP hash y request ID. |
| **Information disclosure** | Ver clientes de otra empresa, respuestas con datos internos, logs con PII. | Crítico | RLS, repositorios scoped, DTOs públicos, redacción de logs, tests de aislamiento. |
| **Denial of service** | Spam de reservas, scraping de disponibilidad, subida de archivos grandes. | Medio | Rate limit, límites de payload, CAPTCHA opcional, índices y timeouts. |
| **Elevation of privilege** | Profesional accede a funciones de owner; superadmin comprometido. | Crítico | RBAC en servidor, rutas separadas, mínimo privilegio, auditoría, 2FA de Google y allowlist. |
| **SSRF** | URL maliciosa importada por un usuario (falsificación de peticiones del lado del servidor). | Medio | No se hacen peticiones a URLs de usuario en el MVP. |
| **XSS** | Nombre de servicio con HTML malicioso. | Alto | Escape de React, CSP, sanitización de contenido en emails, sin HTML libre. |
| **CSRF** | Formulario externo que cancela una cita. | Medio | `SameSite=Lax`, verificación de `Origin`, server actions, no mutaciones por GET. |
| **SQL injection** | Parámetro manipulado en una consulta. | Crítico | Prisma parametrizado y SQL etiquetado; nunca concatenar entrada. |
| **IDOR** | Cambiar un UUID en `/app/citas/{id}` (referencia directa insegura a objetos). | Crítico | Verificación de tenant y pertenencia en cada operación. |
| **Supply chain** | Dependencia comprometida. | Alto | Lockfile, auditoría, Dependabot, revisión de actualizaciones. |
| **Insider** | Empleado accede a datos sin necesidad. | Alto | Mínimo privilegio, auditoría, formación, revisión de accesos. |

---

## 5. Autenticación y sesiones

### 5.1 Auth.js y proveedores

La autenticación se delega en **Auth.js v5 + Prisma Adapter**.

- **Google OAuth:** proveedor principal.
- **Enlace mágico por email:** alternativa para usuarios sin Google.
- Auth.js gestiona `state`, PKCE, canje de código, validación del perfil, CSRF y sesión.
- No se implementan contraseñas, hashes, reset ni rotación propios.
- Se exige `email_verified` en el perfil de Google.
- Scopes mínimos: `openid email profile`.
- No se usan los tokens de Google para acceder a otras APIs.
- Se usa un **cliente OAuth propio de Velora** con redirect URIs exactas.
- Se puede compartir el proyecto/organización de Google Cloud con Empresites, pero **nunca el secreto del cliente OAuth**.
- No se copian credenciales del `.env` de Empresites.

**Por qué no se reutiliza su flujo:** Empresites implementa OAuth manual con `state` fijo, sesión HMAC sin estado y sin revocación central. Funciona como referencia de configuración, pero no como librería de autenticación.

### 5.2 Sesiones

- Estrategia de sesión en **base de datos**, no JWT.
- Cookie de Auth.js con `HttpOnly`, `Secure`, `SameSite=Lax` y `Path=/`.
- El token de sesión no se guarda en localStorage ni en el HTML.
- Duración máxima: 30 días; rotación al iniciar sesión.
- Revocación real: se borra la fila de `sessions`.
- “Cerrar todas las sesiones” borra todas las filas del usuario.
- El administrador puede revocar una sesión concreta.
- Al desactivar una cuenta se eliminan sus sesiones.
- No hay tokens HMAC de sesión propios.

### 5.3 Invitaciones y acceso

- La invitación es una entidad de negocio, no un mecanismo de autenticación.
- Token de 32 bytes; solo se guarda el hash.
- Caducidad: 7 días; un solo uso.
- La invitación incluye empresa, rol, sede y email.
- El usuario se autentica con Google o enlace mágico y después acepta la invitación.
- El email autenticado debe coincidir con el de la invitación.
- Si no hay invitación ni membership, el panel no muestra datos.
- El enlace mágico sustituye a la recuperación de contraseña.
- La solicitud de enlace mágico devuelve una respuesta genérica para no revelar si el email existe.

### 5.4 Protección de la cuenta

- Rate limit por IP y por email en inicio de sesión y enlace mágico.
- Backoff exponencial; no bloqueo permanente que permita DoS.
- 2FA de la cuenta de Google para superadministradores.
- Allowlist opcional de emails de plataforma.
- Notificación de nuevo acceso desde dispositivo desconocido (fase posterior).
- Superadministrador con acceso restringido, auditado y sin impersonación.

---

## 6. Autorización y aislamiento

### 6.1 Principios

- **Mínimo privilegio:** cada rol tiene solo lo necesario.
- **Verificación en servidor:** la UI puede ocultar un botón, pero el servidor siempre comprueba.
- **Tenant explícito:** ninguna consulta de negocio sin `business_id`.
- **Defensa en profundidad:** aplicación + RLS + constraints.

### 6.2 Matriz de permisos

| Acción | Superadmin | Owner | Professional |
|---|---:|---:|---:|
| Crear/eliminar empresa | ✅ | — | — |
| Ver todas las empresas | ✅ | — | — |
| Cambiar plan/límites | ✅ | — | — |
| Editar negocio | — | ✅ | — |
| Editar sedes | — | ✅ | — |
| Editar servicios | — | ✅ | — |
| Editar equipo | — | ✅ | — |
| Editar recursos | — | ✅ | — |
| Aplicar plantilla | — | ✅ | — |
| Ver agenda completa | — | ✅ | — |
| Ver su agenda | — | ✅ | ✅ |
| Ver recursos de su sede | — | ✅ | ✅ si se habilita |
| Crear cita para cualquier profesional | — | ✅ | — |
| Crear cita para sí mismo | — | ✅ | ✅ si está permitido |
| Editar/cancelar cita ajena | — | ✅ | — |
| Ver ficha de cliente | — | ✅ | Solo con cita propia |
| Exportar clientes | — | ✅ | — |
| Anonimizar cliente | — | ✅ | — |
| Ver estadísticas globales | ✅ | — | — |
| Ver estadísticas del negocio | — | ✅ | Limitadas, si se habilita |
| Acceder a auditoría global | ✅ | — | — |
| Acceder a auditoría del negocio | — | ✅ | — |

### 6.3 Aislamiento en base de datos

- `business_id NOT NULL` en tablas de negocio.
- RLS con `current_setting('app.business_id')`.
- `withTenant` obligatorio.
- FKs compuestas `(business_id, id)`.
- Sin contexto, las consultas devuelven 0 filas.
- La plataforma usa un contexto explícito y auditado.
- Profesionales y recursos se filtran además por sede y pertenencia.
- `resource_reservations` tiene su propia exclusion constraint por recurso.

### 6.4 Tests obligatorios

- Acceso a recurso de otra empresa por ID directo.
- Acceso a recurso de otra empresa por slug o email.
- Inserción con `business_id` ajeno.
- Profesional accediendo a agenda completa.
- Profesional accediendo a cliente sin cita.
- Profesional accediendo a una sede no asignada.
- Recurso de otra sede o empresa asignado a una cita.
- Dos citas ocupando el mismo recurso.
- Superadmin sin `is_superadmin`.
- Token de gestión de otra cita.
- Invitación aceptada con un email distinto.
- Sesión revocada que sigue intentando acceder.

---

## 7. Validación, XSS y CSRF

### 7.1 Entrada

- Zod en todos los bordes: formularios, route handlers, server actions, webhooks y jobs.
- Validación de tipos, longitudes, rangos, enums y formatos.
- Límite de tamaño de payload (por ejemplo, 1 MB en JSON; 5 MB en imágenes).
- Normalización de email y teléfono antes de guardar.
- Rechazo de campos desconocidos cuando aplique.
- No se confía en `businessId`, `price`, `role` ni `professionalId` enviados por el cliente.

### 7.2 Salida

- React escapa por defecto.
- `dangerouslySetInnerHTML` prohibido salvo contenido generado y sanitizado por el servidor.
- Emails: variables escapadas; no se inserta HTML del usuario.
- JSON-LD: se serializa con `JSON.stringify` y se escapan `<`/`>`.
- Errores: mensajes genéricos; sin stack traces ni SQL.

### 7.3 CSRF

- Cookies `SameSite=Lax`.
- Verificación de `Origin`/`Host` en mutaciones.
- Server actions de Next.js con protección de origen.
- No se permiten mutaciones por `GET`.
- Formularios críticos con token si se detecta un caso límite.

### 7.4 Cabeceras

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; img-src 'self' data: https://images.velora.app; ...
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Frame-Options: DENY
```

La CSP se ajusta a los recursos reales; no se usa `unsafe-inline` salvo necesidad justificada y documentada.

---

## 8. Rate limiting y abuso

| Superficie | Límite propuesto |
|---|---|
| Inicio de sesión (Auth.js/Google) | 10 / 15 min por IP |
| Enlace mágico | 3 / hora por email; 10 / hora por IP |
| Invitación | 10 / hora por empresa |
| Disponibilidad | 60 / min por IP |
| Reserva | 10 / hora por IP; 3 / hora por email/teléfono |
| API pública | 120 / min por IP |
| Webhook | Firma obligatoria; sin límite por IP |
| Subida de imágenes | 20 / hora por usuario |

- Contadores en PostgreSQL para consistencia entre instancias.
- Respuesta `429` con `Retry-After`.
- Honeypot en el formulario público.
- Turnstile opcional si aparece abuso; no se activa por defecto para no añadir fricción.
- Detección de patrones: muchas reservas desde una IP, emails desechables, teléfonos inválidos.

---

## 9. Archivos e imágenes

- Tipos permitidos: JPEG, PNG, WebP.
- **No se aceptan SVG** subidos por usuarios (XSS).
- Tamaño máximo: 5 MB.
- `sharp` re-encodea, elimina metadatos y genera WebP/AVIF.
- Se validan dimensiones mínimas y máximas.
- Claves aleatorias; nunca se usa el nombre original como ruta.
- Bucket público solo para imágenes; no para documentos.
- `Content-Type` se fija en la respuesta; no se infiere del usuario.
- Se borra el objeto anterior al reemplazar.
- No se permiten URLs remotas arbitrarías en el MVP (evita SSRF).

---

## 10. Secretos y configuración

- Secretos en variables de entorno, nunca en git.
- `.env.production` con permisos 600.
- Separación estricta entre staging y producción.
- Rotación documentada de claves de email, R2, base de datos y Google OAuth.
- `AUTH_SECRET` de al menos 32 bytes aleatorios.
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` propios de Velora; no se comparten con Empresites.
- Redirect URIs exactas en Google Cloud; sin comodines.
- No se imprimen secretos en logs ni en mensajes de error.
- GitHub Actions usa secretos cifrados; no se exponen en PRs de forks.
- Acceso SSH con clave, sin contraseña, firewall y usuario no root.
- Principio de mínimo privilegio para tokens de R2 y del proveedor de email.

---

## 11. Dependencias y cadena de suministro

- Lockfile comprometido.
- `pnpm audit` en CI.
- Dependabot o Renovate para actualizaciones.
- Revisión de cambios mayores antes de aplicar.
- No se instalan paquetes sin mantenimiento o con pocas descargas sin justificación.
- Imágenes Docker base oficiales y fijadas por digest en producción.
- Escaneo de imagen (Trivy o similar) en CI, al menos semanal.
- No se ejecutan scripts postinstall innecesarios.

---

## 12. Logs y auditoría

### 12.1 Logs

- JSON estructurado con `requestId`, `userId` (seudónimo), `businessId`, ruta, método, estado y latencia.
- **Nunca** loguear contraseñas, tokens, cookies, cuerpos completos con PII (datos personales identificables), tarjetas o emails completos.
- IP truncada o hash con sal.
- Retención de logs: 30 días.
- Acceso restringido.

### 12.2 Auditoría

Eventos mínimos:

- `auth.login`, `auth.logout`, `auth.magic_link_requested`, `auth.invitation_accepted`, `auth.session_revoked`.
- `business.created`, `business.updated`, `business.suspended`, `business.reactivated`.
- `member.invited`, `member.role_changed`, `member.disabled`.
- `service.created`, `service.updated`, `service.deactivated`.
- `professional.created`, `professional.updated`, `professional.deactivated`.
- `schedule.updated`, `schedule.exception_created`, `schedule.exception_deleted`.
- `appointment.created`, `appointment.updated`, `appointment.cancelled`, `appointment.completed`, `appointment.no_show`.
- `client.created`, `client.updated`, `client.exported`, `client.anonymized`, `client.merged`.
- `plan.changed`, `limit.override_added`.
- `platform.business_created`, `platform.business_suspended`.
- `data.export_requested`, `data.deletion_requested`.

Campos: actor, tenant, acción, entidad, metadata mínima, request ID, timestamp.  
La tabla es append-only; no se actualiza ni se borra desde la app.

---

## 13. Backups y continuidad

| Aspecto | MVP |
|---|---|
| Backup BD | `pg_dump -Fc` diario a R2, cifrado. |
| Retención | 30 diarios + 12 semanales. |
| Backups de imágenes | Versioning de R2 o copia semanal. |
| Cifrado | age/GPG para backups; cifrado en reposo del proveedor. |
| Restauración | Prueba mensual en entorno aislado. |
| RPO | 24 horas. |
| RTO | 4 horas. |
| Acceso | Solo personas autorizadas; auditoría. |
| Runbook | Documentado y probado. |

Un backup no verificado no cuenta como backup. La prueba de restauración es un criterio de lanzamiento.

---

## 14. Seguridad del email

- Dominio de envío dedicado (`mail.velora.app` o similar).
- SPF, DKIM y DMARC configurados y verificados.
- `From` con nombre del negocio y dirección de la plataforma; `Reply-To` del negocio.
- No se usa el email del cliente como `From`.
- TLS en tránsito.
- Webhook de rebotes y quejas; supresión automática.
- Límite de envío por empresa y por hora.
- Plantillas sin PII innecesaria en el asunto.
- Enlaces absolutos y firmados; sin redirecciones abiertas.
- No se envían datos de otras citas o clientes.

---

## 15. Seguridad de la web pública

- Sin cuenta de cliente; token opaco para gestionar una cita.
- El token se guarda hasheado; no se puede enumerar.
- La API devuelve solo los datos de la cita correspondiente.
- No se revela si un email o teléfono existe en la base de datos.
- Rate limit y honeypot.
- Validación de teléfono/email.
- Sin listados de clientes ni búsquedas globales.
- Sin indexación de páginas de gestión (`noindex`).
- Las páginas públicas solo muestran datos del negocio, no datos de clientes.

---

## 16. Seguridad de la plataforma

- `/platform` separado del panel de negocio.
- `is_superadmin` verificado en servidor en cada petición.
- Sin impersonación en el MVP.
- Sin acceso a credenciales ni sesiones de otros usuarios.
- Acciones destructivas con confirmación y motivo.
- Auditoría obligatoria.
- 2FA recomendado en Fase 5 y obligatorio antes de escalar el equipo.
- Revisión trimestral de cuentas con acceso.

---

## 17. RGPD y LOPDGDD

### 17.1 Roles

| Tratamiento | Rol de Velora | Rol del negocio |
|---|---|---|
| Cuenta, facturación y uso de la plataforma | Responsable | — |
| Datos de clientes finales y citas | Encargado | Responsable |
| Comunicaciones a clientes finales | Encargado | Responsable |
| Marketing propio de Velora | Responsable | — |

Velora debe firmar un **DPA** (Data Processing Agreement o acuerdo de encargado de tratamiento) con cada negocio y actuar solo según sus instrucciones documentadas.

### 17.2 Bases jurídicas

- **Ejecución de contrato:** prestación del servicio al negocio.
- **Interés legítimo:** seguridad, prevención de fraude, mejora del servicio (con evaluación).
- **Consentimiento:** comunicaciones de marketing y datos opcionales.
- **Obligación legal:** datos fiscales y contables.
- Para los datos de clientes finales, la base la determina el negocio; Velora no la redefine.

### 17.3 Registro de actividades

| Categoría | Titulares | Datos | Finalidad | Base | Conservación | Destinatarios |
|---|---|---|---|---|---|---|
| Cuenta de negocio | Owner, profesionales | Nombre, email, teléfono, cuenta Google/enlace mágico | Prestación del servicio | Contrato | Mientras dure la cuenta + 1 año | Hosting, email, Google |
| Clientes finales | Clientes del negocio | Nombre, teléfono, email, fecha de nacimiento, notas, historial | Gestión de citas | Contrato/consentimiento del negocio | Según política del negocio | Hosting, email |
| Citas | Clientes y profesionales | Fecha, servicio, profesional, importe | Agenda y estadísticas | Contrato | 5 años (propuesta) | Hosting |
| Comunicaciones | Clientes | Email, estado de envío | Confirmaciones y recordatorios | Contrato | 1 año | Proveedor de email |
| Auditoría | Usuarios | Acciones, IP hash | Seguridad y trazabilidad | Interés legítimo | 1 año | Hosting |
| Facturación | Negocio | Datos fiscales, plan | Cobro | Contrato/legal | Según obligación | Proveedor de pago (futuro) |

### 17.4 Minimización

- Solo se piden datos necesarios para la cita.
- La fecha de nacimiento es opcional.
- Las notas son opcionales y se advierte que no deben contener datos de salud no consentidos.
- No se piden documentos de identidad.
- No se almacenan datos de tarjetas.
- No se hace perfilado publicitario.

### 17.5 Consentimiento

- Aceptación de la política de privacidad al reservar: obligatoria, registrada con versión, timestamp e IP hash.
- Marketing: opcional, desmarcado por defecto, revocable.
- Si en el futuro se piden datos de salud: consentimiento explícito y campo específico, no notas libres.
- Se guarda el historial de consentimientos, no solo el estado actual.

### 17.6 Derechos

| Derecho | Cómo se atiende |
|---|---|
| Acceso | Exportación de la ficha y el historial. |
| Rectificación | Edición por el negocio. |
| Supresión | Anonimización; conservación de lo legalmente necesario. |
| Limitación | Marcar ficha como bloqueada (fase posterior) o restringir tratamiento. |
| Portabilidad | Exportación JSON/CSV. |
| Oposición | Baja de marketing; revisión de interés legítimo. |

Plazo: un mes desde la solicitud, prorrogable según normativa. El negocio atiende a su cliente; Velora le proporciona herramientas y soporte.

### 17.7 Subencargados

| Proveedor | Servicio | Ubicación | DPA |
|---|---|---|---|
| Hetzner | VPS / infraestructura | UE | Sí |
| Google | OAuth / identidad | UE/EE. UU. según configuración | Sí; evaluar transferencias |
| Cloudflare | R2 / DNS | UE (configurar jurisdicción) | Sí |
| Brevo | Email transaccional | UE | Sí |
| Sentry | Errores | Configurar región UE; scrubbing | Sí |
| GitHub | Código y CI | EE. UU. | Sí; evaluar transferencias |
| Monitor de uptime | Disponibilidad | UE/EE. UU. | Sí |

Lista sujeta a cambios; se publicará y se notificará a los negocios.

### 17.8 Transferencias internacionales

- Priorizar proveedores y regiones de la UE.
- Si un proveedor está fuera del EEE, usar SCCs (cláusulas contractuales tipo), evaluar la transferencia (TIA, Transfer Impact Assessment) y documentarlo.
- R2 se configura con jurisdicción UE cuando esté disponible.
- Sentry se configura en región UE y con scrubbing de PII.

### 17.9 Cookies

- Solo cookies esenciales: sesión y preferencia de empresa.
- Sin analytics ni píxeles en el MVP.
- Si se añaden, consentimiento previo y política de cookies.
- No se usa cookie banner si solo hay cookies esenciales, pero se documenta.

### 17.10 Seguridad de datos personales

- Cifrado en tránsito (TLS 1.2+).
- Cifrado en reposo del proveedor; backups cifrados.
- Control de acceso y mínimo privilegio.
- Registro de accesos y acciones.
- Retención y borrado.
- Formación del personal con acceso.
- Confidencialidad y offboarding.

### 17.11 Evaluación de impacto

No se prevé una DPIA (evaluación de impacto en protección de datos) obligatoria para el MVP, pero se hará una **evaluación de necesidad** antes del lanzamiento. Si se añaden datos de salud, geolocalización precisa, perfilado o monitorización sistemática a gran escala, se revisará.

---

## 18. Retención

| Dato | Periodo propuesto | Acción |
|---|---|---|
| Cuenta de negocio | Duración + 1 año | Baja y anonimización. |
| Citas completadas | 5 años | Conservar; anonimizar PII al final. |
| Citas canceladas | 2 años | Agregar y eliminar detalle. |
| Clientes inactivos | 3 años desde la última visita | Aviso y anonimización. |
| Comunicaciones | 1 año | Borrar. |
| Auditoría | 1 año | Borrar o archivar. |
| Sesiones | 30 días tras expirar | Borrar. |
| Tokens | 30 días tras expirar | Borrar. |
| Backups | 30 días + 12 semanales | Rotación. |
| Logs | 30 días | Borrar. |

Periodos a validar con asesoría legal. El negocio puede configurar una retención menor si su política lo permite.

---

## 19. Respuesta a incidentes

### 19.1 Fases

1. **Detección:** alerta, informe de usuario, revisión de logs.
2. **Contención:** revocar sesiones, bloquear IP, desactivar integración, aislar servicio.
3. **Evaluación:** alcance, datos afectados, causa raíz.
4. **Erradicación:** corregir vulnerabilidad, rotar secretos.
5. **Recuperación:** restaurar servicio, verificar integridad.
6. **Notificación:** AEPD en 72 h si hay riesgo; negocios afectados; personas si alto riesgo.
7. **Post-mortem:** sin culpables, con acciones y plazo.

### 19.2 Contacto

- Responsable de seguridad interno.
- Canal de reporte: `security@...` (definir).
- Registro de incidentes con fechas y decisiones.

### 19.3 Escenarios preparados

- Fuga de datos entre empresas.
- Robo de sesión de superadministrador.
- Compromiso del cliente OAuth de Google o de su secreto.
- Doble ocupación de un recurso por fallo de validación.
- Compromiso del proveedor de email.
- Borrado accidental de datos.
- Ransomware en el VPS.
- Caída prolongada.
- Envío masivo erróneo.

---

## 20. Desarrollo seguro

- Revisión de código obligatoria para cambios sensibles.
- Threat modeling en fases de diseño.
- Tests de seguridad en CI.
- Escaneo de secretos (gitleaks) y dependencias.
- Migraciones revisadas y probadas.
- Staging separado.
- No se usan datos reales en desarrollo.
- Formación básica en OWASP Top 10.
- Política de disclosure de vulnerabilidades.

---

## 21. Checklist de lanzamiento

### Autenticación

- [ ] Auth.js configurado con Google y enlace mágico.
- [ ] Cliente OAuth propio de Velora; sin secretos de Empresites.
- [ ] `state`/PKCE y redirect URIs verificadas.
- [ ] Cookies `Secure`, `HttpOnly`, `SameSite`.
- [ ] Rate limit de inicio de sesión y enlace mágico.
- [ ] Tokens de invitación de un solo uso y hasheados.
- [ ] Revocación de sesiones probada.
- [ ] Sin contraseñas almacenadas.
- [ ] Sin secretos en logs.

### Aislamiento

- [ ] RLS activo y forzado.
- [ ] `withTenant` en todas las consultas de negocio.
- [ ] Tests de cross-tenant verdes.
- [ ] FKs compuestas en relaciones críticas.
- [ ] Exclusión de profesional y de recurso probadas.
- [ ] Sin endpoints públicos que devuelvan datos internos.

### Aplicación

- [ ] Validación Zod en todos los bordes.
- [ ] CSRF y cabeceras configuradas.
- [ ] CSP sin `unsafe-inline` innecesario.
- [ ] Subida de imágenes validada y re-encodeada.
- [ ] Rate limiting activo.
- [ ] Errores sin stack traces.
- [ ] Dependencias auditadas.

### Datos

- [ ] Backups diarios cifrados.
- [ ] Restauración probada.
- [ ] Retención implementada.
- [ ] Exportación y anonimización funcionando.
- [ ] Consentimientos registrados con versión.

### Legal

- [ ] Política de privacidad.
- [ ] Términos de servicio.
- [ ] DPA con el negocio.
- [ ] Registro de actividades.
- [ ] Lista de subencargados.
- [ ] Política de cookies.
- [ ] Procedimiento de derechos.
- [ ] Evaluación de DPIA.

### Operación

- [ ] HTTPS y HSTS.
- [ ] Firewall y SSH con clave.
- [ ] Monitorización y alertas.
- [ ] Runbook de incidentes.
- [ ] Contacto de seguridad.
- [ ] Plan de comunicación de brechas.

---

## 22. Decisiones abiertas

| # | Decisión | Propuesta |
|---|---|---|
| S1 | ¿Auth propio o Auth.js? | **Auth.js v5** con Google y enlace mágico, sesiones en BD. Sin contraseñas propias. |
| S2 | ¿2FA para superadmin en MVP? | 2FA de Google; llave de seguridad antes de escalar el equipo. |
| S3 | ¿Retención de citas 5 años? | Validar con asesoría. |
| S4 | ¿Proveedor de email EU? | Brevo; alternativa Resend/SES. |
| S5 | ¿Sentry EU? | Configurar región UE y scrubbing. |
| S6 | ¿Cifrado de disco del VPS? | Evaluar LUKS o volumen cifrado. |
| S7 | ¿Credenciales Google? | Cliente OAuth propio de Velora; proyecto compartido opcional, secreto separado. |
| S8 | ¿Notificación de nuevas sesiones? | Fase posterior. |
| S9 | ¿DPIA? | Evaluación de necesidad antes del lanzamiento. |
| S10 | ¿Canal de seguridad? | `security@` y formulario de disclosure. |

---

## 23. Referencias

- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Auth.js — documentación](https://authjs.dev/)
- [Google Identity — OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [AEPD — RGPD](https://www.aepd.es/)
- [Reglamento (UE) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [LOPDGDD](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673)
- [Cloudflare R2 — cumplimiento y regiones](https://developers.cloudflare.com/r2/)
- [Hetzner — protección de datos](https://www.hetzner.com/legal/privacy-policy/)
