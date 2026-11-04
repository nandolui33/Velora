# PRODUCT.md — Visión, alcance y requisitos del MVP

**Producto:** Velora (nombre de trabajo)  
**Documento:** propuesta funcional para aprobación  
**Versión:** 1.1  
**Estado:** diseño; Fase 0 implementada  
**Mercado inicial:** España, español, EUR  
**Cambios v1.1:** recursos físicos, plantillas sectoriales, Auth.js, concurrencia de recursos y relaciones multisede.

---

## 1. Resumen ejecutivo

Velora es un SaaS multiempresa para negocios de belleza y bienestar que trabajan con cita. Su objetivo no es crear otro marketplace, sino dar a cada establecimiento **su propio software de gestión y su propia página de reservas**, con una experiencia móvil excelente y un precio predecible.

El MVP debe permitir este recorrido completo:

1. El superadministrador da de alta una peluquería y envía una invitación al propietario.
2. El propietario elige su actividad y aplica una plantilla de sector.
3. El propietario configura el negocio, sede, servicios, equipo, recursos y horarios.
4. El sistema publica una página en `/p/[slug]`.
5. Un cliente entra desde el móvil, elige servicio, profesional y hora, y reserva sin crear cuenta.
6. El sistema asigna el profesional y los recursos físicos necesarios (cabina, camilla, puesto, sillón o sala), sin solapar ninguno.
7. El propietario ve la cita en su agenda y recibe un aviso por email.
8. El cliente recibe confirmación y recordatorio, y puede cancelar mediante un enlace seguro.
9. El propietario consulta métricas básicas y gestiona su base de clientes.

El MVP se apoya en cinco decisiones fuertes:

- **Multiempresa real desde la primera tabla**, no un añadido posterior.
- **PostgreSQL desde el primer día**, porque la concurrencia y el aislamiento son requisitos de producto, no detalles de infraestructura.
- **Recursos físicos de primera clase**, porque una cita puede necesitar simultáneamente un profesional y una cabina.
- **Plantillas sectoriales sobre un único motor**, para cubrir barbería, peluquería, manicura, spa, cejas/pestañas, estética y masajes sin siete aplicaciones.
- **Un monolito modular**, porque es la forma más rápida y barata de llegar a un producto comercializable sin hipotecar el crecimiento.

---

## 2. Problema y oportunidad

### 2.1 Problema del negocio

Los pequeños salones gestionan citas con una mezcla de papel, WhatsApp, llamadas y hojas de cálculo. Esto produce:

- Llamadas interrumpiendo el trabajo.
- Citas apuntadas dos veces o perdidas.
- Ausencias y cancelaciones de última hora.
- Dificultad para ver la carga real de cada profesional.
- Cabinas, camillas o puestos asignados dos veces a la misma hora.
- Pérdida de historial y de oportunidades de fidelización.
- Una presencia digital pobre: un perfil de Google, una web antigua o solo redes sociales.

Las soluciones grandes resuelven muchas cosas, pero introducen complejidad, dependencia de un marketplace y precios que crecen con cada empleado. Muchos negocios pequeños no necesitan TPV, inventario, comisiones o marketing avanzado: necesitan **una agenda fiable y una página de reservas que funcione**.

### 2.2 Oportunidad

- El mercado de belleza está fragmentado y tiene alta penetración de móvil.
- Los negocios cada vez aceptan más el software por suscripción, pero son sensibles al precio y al tiempo de implantación.
- Empresites puede identificar negocios con baja digitalización y convertirlos en clientes con un proceso comercial propio.
- Un producto sencillo, español, con soporte cercano y sin comisiones puede diferenciarse frente a plataformas internacionales.

### 2.3 Por qué ahora

- La contratación de software SaaS por pequeños negocios se ha normalizado.
- Los proveedores cloud europeos permiten operar con costes muy bajos.
- La IA y las herramientas de desarrollo reducen el coste de construir y mantener un producto vertical.
- La integración comercial con Empresites permite un canal de captación sin construir un marketplace.

---

## 3. Personas

### 3.1 Propietaria / propietario del negocio

**Perfil:** Ana, 42 años, peluquería con 4 profesionales en una ciudad mediana. Trabaja 9 horas al día con las manos ocupadas. Usa el móvil para todo.

**Objetivos:**
- Reducir llamadas y mensajes para pedir cita.
- Evitar huecos y dobles reservas.
- Saber cómo va la semana sin hacer cuentas.
- Que su equipo use la agenda sin formación técnica.

**Frustraciones:**
- Que un software sea más complicado que el papel.
- Pagar por funciones que no usa.
- Depender de un marketplace que muestra a su competencia.
- Perder clientes por no contestar a tiempo.

**Criterio de éxito:** en menos de 30 minutos tiene su página publicada y recibe su primera reserva online.

### 3.2 Profesional / empleado

**Perfil:** Luis, 29 años, barbero. Quiere ver su agenda del día desde el móvil y saber quién viene y qué servicio tiene.

**Objetivos:**
- Consultar solo sus citas.
- Crear o mover una cita si el propietario le da permiso.
- Ver los datos necesarios del cliente, sin acceder a toda la base de datos.

**Frustraciones:**
- Que le obliguen a usar un ordenador.
- Ver una agenda llena de citas de otros compañeros.
- No saber si un cliente es nuevo o tiene alguna observación.

### 3.3 Cliente final

**Perfil:** Marta, 34 años, reserva desde el móvil a las 22:30, cuando se acuerda. No quiere descargar una app ni crear una cuenta.

**Objetivos:**
- Ver precios, servicios y horas disponibles de forma clara.
- Reservar en menos de dos minutos.
- Recibir confirmación y recordatorio.
- Poder cancelar sin llamar.

**Frustraciones:**
- Formularios largos.
- Horarios que parecen libres pero ya no lo están.
- No saber dónde es el local ni cómo contactar.
- Que le obliguen a registrarse.

### 3.4 Superadministrador SaaS

**Perfil:** persona del equipo que da de alta negocios, activa planes, resuelve incidencias y consulta métricas globales.

**Objetivos:**
- Crear una empresa y entregar el acceso al propietario en minutos.
- Suspender una cuenta impagada o conflictiva sin tocar la base de datos.
- Ver el estado de los negocios y detectar problemas.
- Cambiar límites o funcionalidades sin desplegar código.

### 3.5 Prospecto de Empresites (no es usuario de Velora)

Empresites identifica negocios que necesitan digitalización. Velora recibe una referencia externa del prospecto, pero **no depende de Empresites para funcionar**. La relación se limita a atribución comercial: origen, identificador externo, URL de origen, estado y fecha de conversión.

---

## 4. Propuesta de valor y posicionamiento

### 4.1 Promesa

> **Tu agenda y tu página de reservas, sin marketplace y sin comisiones. Sencillo, móvil y a tu precio.**

### 4.2 Diferenciación

| Dimensión | Velora | Booksy / Versum |
|---|---|---|
| Modelo | Software de gestión con página propia | Software + marketplace / ecosistema amplio |
| Comisiones por reserva | No | Booksy tiene Boost y pagos; depende del plan |
| Complejidad | MVP acotado, móvil primero | Amplio catálogo de funciones |
| Precio | Predecible, sin coste por reserva | Cuota base + suplementos por empleado / tramos |
| Datos | Aislamiento estricto por empresa | Plataforma multiusuario |
| Recursos físicos | Cabinas, camillas, puestos, sillones y salas con exclusividad | Gestión variable según plan/producto |
| Implantación | Plantilla por sector + edición | Configuración más amplia |
| Marca | Página personalizable del negocio | Perfil dentro de una plataforma |

### 4.3 Lo que Velora no será

- Un directorio donde los clientes comparan negocios.
- Una app de consumo con marketplace.
- Un TPV, un sistema de inventario o un CRM avanzado en el MVP.
- Una copia visual de Booksy o Versum.

---

## 5. Análisis de referencias funcionales

### 5.1 Booksy Biz

**Qué aporta:**
- Agenda central con vista de calendario.
- Gestión de equipo y reservas online 24/7.
- Ficha de cliente, historial y marketing.
- Pagos integrados, protección contra ausencias, listas de espera.
- Plan único con todas las funciones y suplemento por usuario adicional.

**Referencia de precio observada:** 34,99 €/mes + IVA, con 8 €/mes por empleado adicional; prueba de 7 días; funciones de pago y Boost aparte.

**Qué tomar:** la agenda como pantalla principal, la simplicidad del plan único, la reserva 24/7 y la importancia del recordatorio.

**Qué evitar:** la complejidad de un producto que intenta cubrir todo, la dependencia de un marketplace y una navegación sobrecargada para un negocio de 1 a 5 personas.

### 5.2 Versum

**Qué aporta:**
- Agenda, ficha de cliente, historial, página web de reservas.
- Recordatorios SMS/email, estadísticas, empleados, comisiones, inventario, tarjetas regalo.
- Planes por número de agendas/empleados: 25 €, 39 €, 69 €, 109 €/mes.
- Prueba de 14 días.

**Qué tomar:** la página pública de reservas, la ficha de cliente con historial, el recordatorio automático y la estructura de planes por tamaño.

**Qué evitar:** la acumulación de módulos que no son necesarios para el MVP; la sensación de software de gestión tradicional en algunas pantallas.

### 5.3 Alcázar Peluqueros (Versum)

**Qué aporta:**
- Página pública sencilla con servicios, precios, categorías, equipo, opiniones y localización.
- Reserva por servicio con flujo directo.
- Contenido real de un negocio: precios, servicios de caballero, tratamientos, dirección.

**Qué tomar:** la claridad de servicios y precios, la navegación por categorías y la presencia de equipo/localización.

**Qué mejorar en Velora:**
- Flujo móvil más guiado, con disponibilidad real y sin pasos innecesarios.
- Información de políticas, duración y profesional antes de confirmar.
- Confirmación con enlace de cancelación y archivo `.ics`.
- Diseño más actual, rápido y accesible.

### 5.4 Conclusiones del análisis

1. La agenda y la reserva online son el núcleo; todo lo demás es secundario.
2. La ficha de cliente y el recordatorio reducen ausencias y justifican la suscripción.
3. Los precios del mercado permiten un producto más simple y algo más barato.
4. La página pública debe ser propia, rápida y personalizable, no un perfil genérico.
5. La gestión de recursos físicos es un diferenciador real en spa, estética y masajes; no basta con la agenda del profesional.
6. Las plantillas sectoriales reducen el tiempo de implantación sin multiplicar el motor.
7. No se debe competir por número de funciones; se debe competir por facilidad de uso y confianza.

---

## 6. Alcance del MVP

### 6.1 Incluido (P0)

- Alta manual de empresas por superadministrador.
- Autenticación con **Auth.js**: Google OAuth y enlace mágico por email, invitaciones y sesiones revocables. Sin contraseñas propias.
- Roles: superadministrador, propietario y profesional.
- Configuración del negocio, sede activa, logo, fotos, contacto, redes, zona horaria, moneda y URL pública.
- Relaciones N:N entre empresa, sede, profesional, servicio y recurso desde el esquema inicial.
- **Plantillas sectoriales** para barbería, peluquería, manicura, spa, cejas/pestañas, estética y masajes.
- Catálogo de servicios con categorías, variantes, duración, precio, margen y profesionales.
- **Requisitos de recursos por servicio**: tipo de recurso, cantidad y recurso concreto opcional.
- Gestión de profesionales con sedes, horario semanal, excepciones, vacaciones y bloqueos.
- **Gestión de recursos físicos**: cabinas, camillas, puestos de manicura, sillones, salas de spa y equipamiento compartido.
- Agenda diaria y semanal, vista general y por profesional, creación/edición/cancelación, cambio de servicio/profesional.
- Página pública de reservas con disponibilidad en tiempo real.
- Reserva sin cuenta, asignación automática de profesional y recursos, confirmación por email, cancelación mediante enlace seguro.
- Base de clientes con historial, notas, deduplicación, exportación y anonimización.
- Emails transaccionales: confirmación, aviso al negocio, cancelación y recordatorio.
- Estadísticas básicas y diferenciación entre ingreso estimado y cobro registrado.
- Planes, límites, prueba y activación manual.
- Auditoría, RGPD y backups.
- Atribución opcional de Empresites.

### 6.2 Fuera del MVP (P2 o posterior)

- Marketplace, búsqueda de negocios, rankings o reseñas públicas.
- Pagos online, señales, TPV, caja, inventario, comisiones, propinas, tarjetas regalo, bonos y fidelización.
- SMS y WhatsApp.
- Campañas de marketing, segmentación avanzada y automatizaciones.
- Lista de espera y reprogramación automática.
- Google Calendar, Google Reserve y sincronización externa.
- Dominios personalizados y PWA instalable.
- Multi-sede operativa completa en la interfaz (el esquema N:N sí está preparado).
- Horarios y reglas avanzadas por recurso (turnos, mantenimiento recurrente, capacidad > 1).
- Cuentas de cliente final.
- Facturación automática con Stripe.
- Informes financieros avanzados.
- App móvil nativa.
- Formularios de salud o datos especialmente protegidos.
- Personalización total del diseño de la página pública (solo presets y color principal).

### 6.3 Supuestos de alcance

- Cada empresa tiene **una sede activa** en el MVP; las relaciones N:N permiten varias sin migración destructiva.
- Cada empresa tiene **una página pública** en `/p/[slug]`; la página por sede queda para la fase multi-sede.
- El cliente final **no se registra**; se identifica por teléfono/email y recibe un enlace seguro.
- El negocio se crea **manualmente**; no hay autoservicio de alta en el MVP.
- La autenticación es **sin contraseña**: Google OAuth o enlace mágico por email.
- Las plantillas sectoriales son **no destructivas**: crean datos nuevos y no sobrescriben los existentes.
- Los recursos se asignan **automáticamente** en la reserva pública; el negocio puede cambiarlos manualmente.
- Cada unidad física es un recurso independiente; la capacidad compartida se modela con varias filas.
- El cobro es **manual**; no se procesan pagos.
- El idioma es **español**; los textos se centralizan para i18n futura.
- La moneda es **EUR**; se almacena en el negocio para futuras divisas.
- La zona horaria por defecto es `Europe/Madrid`, configurable por sede.

---

## 7. Requisitos funcionales

Prioridad: **P0** = imprescindible para el MVP; **P1** = deseable en el MVP si no compromete la fecha; **P2** = posterior.

### A. Plataforma y multitenencia

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| A1 | Crear una empresa desde la plataforma | P0 | El superadministrador introduce nombre, slug, plan y email del propietario; se crea empresa, suscripción y invitación. |
| A2 | Aislar datos por empresa | P0 | Ningún usuario puede leer o modificar datos de otra empresa, ni por ID directo ni por API. |
| A3 | Activar, suspender y desactivar empresas | P0 | Suspender bloquea reservas públicas y mutaciones; el propietario puede entrar a ver el aviso. Desactivar bloquea el acceso salvo al superadministrador. |
| A4 | Gestionar planes y límites | P0 | El superadministrador puede asignar plan, cambiar límites y añadir overrides por empresa. |
| A5 | Métricas globales | P0 | Dashboard con empresas activas, trials, suspendidas, citas y MRR estimado (ingreso recurrente mensual). |
| A6 | Herramientas de soporte | P1 | Ver auditoría, reenviar invitación o enlace de acceso sin impersonar. |
| A7 | Multi-sede | P2 | Relaciones N:N desde el MVP (P0); la UI multi-sede completa y la página por sede quedan para P2. |

### B. Autenticación, usuarios y permisos

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| B1 | Acceso por invitación | P0 | El propietario recibe una invitación; entra con Google o enlace mágico y se vincula a la empresa. |
| B2 | Google OAuth | P0 | Auth.js gestiona el flujo OAuth, state, PKCE y sesión; Velora usa un cliente OAuth propio. |
| B3 | Enlace mágico por email | P0 | Auth.js envía un enlace de un solo uso; no hay contraseña ni recuperación de contraseña. |
| B4 | Sesiones revocables | P0 | Sesiones en base de datos; el usuario puede cerrar todas y el administrador puede revocar una. |
| B5 | Roles y permisos | P0 | Propietario: todo el negocio. Profesional: sus sedes, agenda y datos permitidos. Superadmin: plataforma. |
| B6 | Invitar profesionales | P0 | El propietario invita por email; el profesional puede activar su cuenta o trabajar sin login. |
| B7 | Permisos finos del profesional | P1 | El propietario decide si puede crear/editar citas, gestionar su disponibilidad y ver datos de clientes. |
| B8 | 2FA para superadministrador | P1 | El superadministrador usa Google con 2FA; valorar llave de seguridad antes de escalar el equipo. |
| B9 | SSO empresarial | P2 | No en MVP. |
| B10 | Sin contraseñas almacenadas | P0 | La base de datos no contiene hashes de contraseña ni flujos de reset propios. |

### C. Configuración del negocio

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| C1 | Datos fiscales y comerciales | P0 | Nombre comercial, nombre fiscal opcional, CIF/NIF, dirección, teléfono, email. |
| C2 | Perfil público | P0 | Descripción, logo, portada, galería, redes sociales y enlaces de contacto. |
| C3 | Horario comercial | P0 | Horario semanal con intervalos múltiples por día; validación de apertura/cierre. |
| C4 | Zona horaria y moneda | P0 | Zona IANA y EUR; los cálculos se hacen en UTC y se muestran en la zona del negocio. |
| C5 | URL pública | P0 | Slug único, reservado y validado; URL `/p/[slug]`. |
| C6 | Políticas | P0 | Antelación mínima, antelación máxima, margen entre citas y política de cancelación. |
| C7 | Personalización visual | P0 | Color principal, logo, portada y presets de diseño; sin editor libre de HTML/CSS. |
| C8 | Estado de publicación | P0 | Borrador/publicada; una página en borrador no recibe reservas. |
| C9 | Multi-idioma | P2 | Español en MVP; textos centralizados. |
| C10 | Relación empresa-sede | P0 | Una empresa puede tener varias sedes en el esquema; en el MVP se opera una sede activa. |
| C11 | Profesionales, servicios y recursos por sede | P0 | Un profesional puede trabajar en varias sedes; un servicio puede ofrecerse en varias; un recurso pertenece a una sede. |
| C12 | Sector y plantilla | P0 | El negocio selecciona su actividad principal y aplica una plantilla inicial editable. |

### D. Catálogo de servicios

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| D1 | Crear/editar categorías | P0 | Nombre, orden y estado; no se puede borrar una categoría con servicios sin reasignarlos. |
| D2 | Crear/editar servicios | P0 | Nombre, descripción, categoría, precio, duración, margen, foto, estado. |
| D3 | Variantes | P0 | Variantes de precio y duración; la cita guarda la variante elegida. |
| D4 | Profesionales por servicio | P0 | Solo se ofrecen profesionales que realizan el servicio. |
| D5 | Reserva online por servicio | P0 | Se puede desactivar un servicio para reservas online sin desactivarlo internamente. |
| D6 | Orden y visibilidad | P0 | Orden manual y visibilidad en la página pública. |
| D7 | Precio y duración efectivos | P0 | La variante prevalece sobre el servicio; si no hay variante, se usa el servicio. |
| D8 | Impuestos | P2 | Precios con IVA incluido mostrado; desglose fiscal en futuras facturas. |
| D9 | Requisitos de recursos | P0 | Cada servicio puede exigir uno o varios tipos de recurso, con cantidad y recurso concreto opcional. |
| D10 | Servicio por sede | P0 | Un servicio puede activarse/desactivarse por sede; el precio y la duración base son del servicio en el MVP. |

### E. Profesionales y equipo

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| E1 | Crear/editar profesionales | P0 | Nombre, foto, descripción, color, estado y orden. |
| E2 | Asociar servicios | P0 | Un profesional solo puede recibir citas de servicios que realiza. |
| E3 | Horario individual | P0 | Horario semanal con intervalos; puede copiar el horario del negocio. |
| E4 | Días libres y vacaciones | P0 | Excepciones por fecha/rango, con o sin hora. |
| E5 | Bloqueos | P0 | Bloqueo de intervalos por profesional o para todo el negocio. |
| E6 | Acceso al panel | P1 | El profesional puede consultar su agenda; permisos de edición configurables. |
| E7 | Color en agenda | P0 | Color por profesional y por estado del servicio. |
| E8 | Comisiones | P2 | No en MVP. |
| E9 | Profesional por sede | P0 | Un profesional puede estar activo en una o varias sedes; su horario se define por sede. |
| E10 | Disponibilidad por sede | P0 | La agenda del profesional respeta la sede de la cita y su horario en esa sede. |

### F. Horarios y disponibilidad

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| F1 | Horario comercial | P0 | Define la ventana base de reservas. |
| F2 | Horario del profesional | P0 | Define la ventana real de cada profesional. |
| F3 | Excepciones | P0 | Vacaciones, festivos, formación o apertura extra se aplican a la disponibilidad. |
| F4 | Margen entre citas | P0 | El margen posterior al servicio bloquea tiempo adicional. |
| F5 | Antelación mínima | P0 | No se ofrecen huecos dentro del tiempo mínimo configurado. |
| F6 | Antelación máxima | P0 | No se ofrecen fechas más allá del límite configurado. |
| F7 | Granularidad de slots | P0 | Intervalo configurable (por defecto 15 min). |
| F8 | Zona horaria y DST | P0 | Cambios de hora de verano/invierno sin duplicar ni perder citas. |
| F9 | Horarios partidos | P0 | Varios intervalos por día (mañana/tarde). |
| F10 | Horarios nocturnos | P2 | No en MVP; se valida que el cierre sea posterior a la apertura. |
| F11 | Disponibilidad de recursos | P0 | Un slot solo se ofrece si están libres el profesional y todos los recursos exigidos por el servicio. |
| F12 | Bloqueos de recursos | P0 | Mantenimiento, limpieza o uso interno eliminan la disponibilidad del recurso. |

### G. Agenda y citas

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| G1 | Vista diaria | P0 | Citas por hora y profesional; navegación por fecha. |
| G2 | Vista semanal | P0 | Semana completa con carga por profesional. |
| G3 | Vista general y por profesional | P0 | Filtro de profesional y vista de todo el establecimiento. |
| G4 | Crear cita manual | P0 | Cliente, servicio, profesional, fecha/hora, notas; validaciones completas. |
| G5 | Editar cita | P0 | Cambio de hora, servicio, profesional, notas y estado. |
| G6 | Cambiar profesional | P0 | Revalida disponibilidad y servicios del nuevo profesional. |
| G7 | Cancelar cita | P0 | Motivo, quién cancela y notificación; libera el hueco. |
| G8 | Bloquear intervalo | P0 | Bloqueo con motivo, visible en agenda y respetado por la disponibilidad. |
| G9 | Estados | P0 | Confirmada, completada, cancelada y no presentada. |
| G10 | Cobro manual | P0 | Marcar cobrada con importe y método; no es un TPV. |
| G11 | Colores | P0 | Color por servicio, profesional o estado, configurable y accesible. |
| G12 | Arrastrar y soltar | P1 | Mover citas en la agenda; no imprescindible para el MVP. |
| G13 | Citas recurrentes | P2 | No en MVP. |
| G14 | Lista de espera | P2 | No en MVP. |
| G15 | Asignación de recursos en cita manual | P0 | El sistema propone y asigna recursos compatibles; el owner puede cambiarlos si hay alternativas. |
| G16 | Vista de ocupación de recursos | P0 | Calendario por recurso para detectar huecos y conflictos. |
| G17 | Bloqueo de recurso | P0 | Bloqueo de un recurso con motivo, visible y respetado por la disponibilidad. |

### H. Reservas online

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| H1 | Página pública | P0 | `/p/[slug]` con servicios, precios, equipo, horarios, localización y CTA. |
| H2 | Selección de servicio | P0 | Categorías, variantes, duración y precio visibles. |
| H3 | Selección de profesional | P0 | Profesional concreto o "cualquiera disponible". |
| H4 | Disponibilidad real | P0 | Solo se muestran huecos libres; se respetan horarios, excepciones, buffers y citas. |
| H5 | Reserva sin cuenta | P0 | Nombre, teléfono, email, notas y consentimiento; sin registro. |
| H6 | Confirmación | P0 | Página de confirmación con código, datos, política y enlace de cancelación. |
| H7 | Email de confirmación | P0 | Se envía al cliente y aviso al negocio. |
| H8 | Cancelación por enlace | P0 | Token seguro, sin login; respeta la política de cancelación. |
| H9 | Anti-doble-reserva | P0 | Una sola cita puede ocupar un intervalo; el resto recibe 409 y alternativas. |
| H10 | Idempotencia | P0 | Un doble clic o reintento no crea dos citas. |
| H11 | Añadir a calendario | P1 | Archivo `.ics` descargable. |
| H12 | Reprogramación | P2 | No en MVP; el cliente cancela y vuelve a reservar. |
| H13 | Pago o señal | P2 | No en MVP. |
| H14 | Lista de espera | P2 | No en MVP. |
| H15 | Reseñas | P2 | No en MVP. |
| H16 | Asignación automática de recursos | P0 | El cliente no elige cabina/camilla; el sistema asigna un recurso libre compatible. |
| H17 | Sin recurso no hay slot | P0 | Si falta un recurso exigido, la hora no se muestra como disponible. |
| H18 | Conflicto de recurso | P0 | Si dos reservas compiten por el mismo recurso, solo una se confirma y la otra recibe 409 con alternativas. |

### I. Clientes

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| I1 | Alta y edición | P0 | Nombre, teléfono, email, fecha de nacimiento opcional, notas. |
| I2 | Historial | P0 | Citas pasadas y futuras, servicios y última visita. |
| I3 | Deduplicación | P0 | Normalización de teléfono/email y detección de duplicados por empresa. |
| I4 | Búsqueda y filtros | P0 | Por nombre, teléfono, email y última visita. |
| I5 | Exportación | P0 | CSV/JSON con los datos del negocio. |
| I6 | Anonimización | P0 | Sustitución de datos personales, conservando métricas agregadas. |
| I7 | Fusión de clientes | P1 | Unir dos fichas duplicadas con confirmación. |
| I8 | Campos personalizados | P2 | No en MVP. |
| I9 | Datos de salud | P2 | No se habilitan campos estructurados; las notas libres se tratan con cautela. |

### J. Comunicaciones

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| J1 | Confirmación al cliente | P0 | Email con servicio, profesional, fecha, dirección y enlace de gestión. |
| J2 | Aviso al negocio | P0 | Email al propietario con los datos de la nueva reserva. |
| J3 | Aviso de cancelación | P0 | Email al cliente y al negocio. |
| J4 | Recordatorio | P0 | Email 24 h antes, configurable; no se envía si la cita se canceló. |
| J5 | Reintentos | P0 | Hasta 3 intentos con backoff; registro de errores. |
| J6 | Coste por comunicación | P0 | Registro de proveedor, coste y estado por envío. |
| J7 | SMS/WhatsApp | P2 | Adaptador preparado; no se implementa en MVP. |
| J8 | Plantillas editables | P2 | No en MVP; plantillas del sistema. |
| J9 | Marketing | P2 | No en MVP. |

### K. Estadísticas

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| K1 | Citas de hoy | P0 | Confirmadas y completadas, por profesional. |
| K2 | Citas de la semana | P0 | Semana natural, comparación con la anterior. |
| K3 | Reservas futuras | P0 | Próximos 7/30 días. |
| K4 | Cancelaciones | P0 | Periodo seleccionable y motivo. |
| K5 | Clientes nuevos | P0 | Altas en el periodo. |
| K6 | Servicios top | P0 | Por número de citas e ingresos estimados. |
| K7 | Ingresos estimados | P0 | Suma de precios de citas completadas; no es contabilidad. |
| K8 | Cobros registrados | P0 | Suma de importes marcados como cobrados; separado del estimado. |
| K9 | Ocupación | P1 | Porcentaje de horas disponibles ocupadas. |
| K10 | Informes avanzados | P2 | No en MVP. |

### L. Planes y suscripciones

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| L1 | Planes configurables | P0 | Código, nombre, precio, límites, funcionalidades y prueba. |
| L2 | Suscripción por empresa | P0 | Estado, plan, fechas de prueba y periodo. |
| L3 | Límites efectivos | P0 | Profesionales, sedes, emails y funcionalidades; se validan en servidor. |
| L4 | Overrides | P0 | El superadministrador puede ampliar límites o activar funciones a una empresa. |
| L5 | Prueba | P0 | 14 días por defecto; al terminar, el sistema marca la prueba como vencida y avisa; el superadministrador activa o suspende manualmente. |
| L6 | Activación manual | P0 | El superadministrador activa, suspende o cambia el plan sin pasarela de pago. |
| L7 | Stripe | P2 | Preparado con campos de proveedor; no se implementa. |
| L8 | Facturas | P2 | No en MVP. |

### M. Auditoría, privacidad y cumplimiento

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| M1 | Registro de auditoría | P0 | Altas, cambios, cancelaciones, accesos a datos y acciones de plataforma. |
| M2 | Consentimientos | P0 | Aceptación de privacidad al reservar; marketing opcional y desmarcado. |
| M3 | Exportación de datos | P0 | El negocio puede exportar su información; el cliente puede solicitar su copia. |
| M4 | Supresión/anonimización | P0 | Proceso con verificación y registro; conserva lo estrictamente legal. |
| M5 | Retención | P0 | Política configurable y job de limpieza. |
| M6 | Backups | P0 | Copia diaria cifrada, retención y prueba de restauración. |
| M7 | Registro de actividades | P0 | Quién hizo qué y cuándo, sin almacenar datos innecesarios. |
| M8 | DPA y subencargados | P0 | Documentos y registro de proveedores antes del lanzamiento. |

### N. Empresites (atribución)

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| N1 | Referencia externa | P1 | Guardar `source`, `external_id`, `external_url`, `status` y `converted_at`. |
| N2 | Independencia | P0 | El alta y la gestión funcionan aunque Empresites no esté disponible. |
| N3 | Sin acoplamiento | P0 | No hay llamadas síncronas ni dependencia de su base de datos. |
| N4 | Panel de atribución | P2 | Informe de conversiones por origen. |

### O. Onboarding

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| O1 | Alta guiada | P0 | Asistente: negocio, actividad/plantilla, servicios, equipo, recursos, horarios, página y compartir. |
| O2 | Checklist | P0 | El dashboard muestra lo que falta para publicar. |
| O3 | Vista previa | P0 | El propietario ve la página antes de publicarla. |
| O4 | Datos de ejemplo | P1 | Opción de crear servicios de ejemplo según vertical. |
| O5 | Importación | P2 | Importar clientes/servicios desde CSV. |

### P. Recursos físicos

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| P1 | Tipos de recurso | P0 | Crear tipos como cabina, camilla, puesto de manicura, sillón, sala o equipamiento; nombre y clave estables. |
| P2 | Recursos por sede | P0 | Cada recurso pertenece a una sede, tiene tipo, nombre, estado y orden. |
| P3 | Requisitos por servicio | P0 | Un servicio exige uno o varios tipos, con cantidad y recurso concreto opcional; se valida que exista en la sede. |
| P4 | Bloqueos de recurso | P0 | Mantenimiento, limpieza o uso interno bloquean el recurso y afectan a la disponibilidad. |
| P5 | Exclusividad de recurso | P0 | Dos citas no pueden ocupar el mismo recurso en el mismo intervalo; se garantiza en PostgreSQL. |
| P6 | Asignación automática | P0 | El sistema elige un recurso libre compatible; si hay varias opciones, usa una regla determinista. |
| P7 | Cambio manual de recurso | P0 | El owner puede cambiar la asignación si hay otra compatible y libre. |
| P8 | Vista de recursos | P0 | Calendario de ocupación por recurso. |
| P9 | Capacidad compartida | P2 | Un recurso con capacidad > 1; en MVP cada unidad física es un recurso. |

### Q. Plantillas sectoriales

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| Q1 | Catálogo de sectores | P0 | Barbería, peluquería, manicura, spa, cejas/pestañas, estética y masajes. |
| Q2 | Contenido de plantilla | P0 | Categorías, servicios, variantes, duración, precio orientativo, recursos y ajustes iniciales. |
| Q3 | Vista previa | P0 | El negocio ve qué se creará antes de aplicar la plantilla. |
| Q4 | Aplicación no destructiva | P0 | La plantilla crea datos nuevos y no sobrescribe servicios o recursos existentes. |
| Q5 | Idempotencia | P0 | Aplicar dos veces la misma versión no duplica categorías, servicios ni recursos. |
| Q6 | Versionado | P0 | Cada plantilla tiene versión; una actualización no se aplica automáticamente. |
| Q7 | Edición posterior | P0 | Todo lo creado por la plantilla se puede editar o desactivar como datos propios. |
| Q8 | Sectores secundarios | P1 | Un negocio mixto puede aplicar una segunda plantilla en modo merge. |
| Q9 | Plantillas gestionables | P2 | El superadministrador puede crear/editar plantillas desde la plataforma. |

---

## 8. Requisitos no funcionales

| Categoría | Requisito | Objetivo MVP |
|---|---|---|
| Rendimiento | Página pública en móvil | LCP < 2,5 s en 4G; Lighthouse performance > 90. |
| Rendimiento | API de disponibilidad | p95 < 500 ms con hasta 20 profesionales, 50 recursos y 90 días de horizonte. |
| Rendimiento | Panel | p95 < 300 ms en consultas normales. |
| Disponibilidad | Servicio | 99,5 % mensual en MVP; ventana de mantenimiento comunicada. |
| Escalabilidad | Empresas | 100 empresas y 50 000 citas/año sin cambios de arquitectura. |
| Seguridad | Aislamiento | 100 % de tablas de negocio con `business_id` y RLS. |
| Seguridad | Autenticación | Auth.js con Google OAuth y enlace mágico; sin contraseñas propias. |
| Seguridad | Sesiones | Sesiones en base de datos, cookie `HttpOnly`, `Secure`, `SameSite=Lax`, revocación. |
| Privacidad | Datos | Minimización, consentimiento, retención y derecho de supresión. |
| Accesibilidad | WCAG | 2.2 AA en panel y flujo de reserva. |
| Compatibilidad | Navegadores | Últimas 2 versiones de Chrome, Safari, Firefox y Edge; iOS 16+. |
| SEO | Página pública | Metadatos, Open Graph, JSON-LD y contenido indexable. |
| Observabilidad | Trazabilidad | Request ID, logs estructurados, errores y métricas de negocio. |
| Copias | RPO/RTO | RPO 24 h; RTO 4 h en MVP. |
| Localización | Idioma | Español; textos centralizados para i18n. |
| Legal | RGPD | Registro de actividades, DPA, subencargados y política de cookies. |

---

## 9. Modelo SaaS y monetización

### 9.1 Estructura

Suscripción mensual con planes que configuran:

- Número máximo de profesionales.
- Número máximo de sedes.
- Funcionalidades disponibles.
- Límite de emails incluidos.
- Periodo de prueba.
- Precio y moneda.

El MVP no integra Stripe. El superadministrador activa y cambia planes manualmente. El modelo de datos ya incluye campos de proveedor para una futura integración.

### 9.2 Hipótesis de precios (no definitiva)

| Plan | Precio/mes | Profesionales | Sedes | Emails/mes | Enfoque |
|---|---:|---:|---:|---:|---|
| Solo | 19 € | 1 | 1 | 1.000 | Autónomo / una silla |
| Salón | 34 € | 5 | 1 | 3.000 | Peluquería o barbería pequeña |
| Estudio | 59 € | 12 | 1 | 10.000 | Salón mediano |
| Profesional extra | +6 € | — | — | — | Crecimiento del equipo |

Condiciones propuestas:

- 14 días de prueba, sin tarjeta.
- Sin comisión por reserva.
- Sin permanencia.
- Descuento anual del 20 %.
- IVA no incluido.
- Módulos futuros (SMS, pagos, multi-sede) con precio propio.

**Esto es una hipótesis para validar con entrevistas y con el negocio piloto.** No se publicará hasta tener datos de disposición a pagar y coste de soporte.

### 9.3 Referencia competitiva

| Producto | Precio observado | Modelo |
|---|---|---|
| Booksy | 34,99 €/mes + 8 €/usuario adicional | Plan único, pagos y Boost aparte |
| Versum | 25 / 39 / 69 / 109 €/mes | Tramos por agendas/empleados |
| Velora (hipótesis) | 19 / 34 / 59 €/mes | Tramos por profesionales, sin comisión |

Velora no debe competir por tener más funciones. Debe competir por **tiempo de puesta en marcha, claridad y soporte**.

### 9.4 Unit economics preliminares

- Infraestructura por empresa a 100 empresas: 0,30–0,60 €/mes.
- Email transaccional: coste marginal muy bajo; el soporte es el coste real.
- Margen bruto objetivo: > 85 % a escala de 100 empresas.
- Coste de adquisición: canal Empresites + venta directa; no se construye marketplace.
- Churn objetivo: < 3 % mensual.
- LTV/CAC objetivo: > 3 (valor de vida del cliente frente a coste de adquisición).

Las cifras de infraestructura se detallan en [ROADMAP.md](ROADMAP.md#8-costes-de-infraestructura-y-servicios).

---

## 10. Métricas de producto

### 10.1 North star

**Reservas confirmadas gestionadas a través de Velora por semana.**

### 10.2 Activación

| Métrica | Objetivo |
|---|---|
| Tiempo hasta página publicada | < 30 minutos |
| Negocios que completan el onboarding en 7 días | > 70 % |
| Negocios con al menos 1 reserva online en 14 días | > 60 % |
| Servicios configurados al publicar | ≥ 3 |
| Profesionales configurados al publicar | ≥ 1 |
| Plantilla sectorial aplicada | ≥ 1 |
| Recursos configurados si el servicio los exige | 100 % de los servicios que los necesitan |

### 10.3 Producto

| Métrica | Objetivo |
|---|---|
| Inicio de reserva → confirmación | > 70 % |
| Reservas online sobre total | > 30 % en 90 días |
| Cancelaciones de última hora | Reducción del 20 % en negocios activos |
| Errores de doble reserva de profesional | 0 |
| Errores de doble ocupación de recurso | 0 |
| Uso semanal del panel por propietario | > 70 % |
| Tickets de soporte por negocio/mes | < 1 |
| NPS | > 40 |

### 10.4 Técnicas

| Métrica | Objetivo |
|---|---|
| Disponibilidad mensual | ≥ 99,5 % |
| p95 disponibilidad | < 500 ms |
| LCP página pública | < 2,5 s |
| Errores 5xx | < 0,5 % |
| Emails entregados | > 98 % |
| Backups restaurados correctamente | 100 % de las pruebas |

---

## 11. Riesgos de producto

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| El alcance crece hacia un Booksy completo | Alta | Alto | Backlog P0 cerrado; toda función nueva entra en P1/P2 con coste explícito. |
| El propietario no completa la configuración | Media | Alto | Onboarding guiado, datos de ejemplo, checklist y alta asistida. |
| La agenda móvil resulta incómoda | Media | Alto | Prototipo y pruebas en móvil antes de construir; vistas simples, acciones rápidas. |
| Los clientes no confían en reservar sin cuenta | Media | Medio | Flujo sin registro, políticas claras, confirmación inmediata y cancelación sencilla. |
| No hay pagos y aumentan los no-shows | Media | Medio | Recordatorios, política de cancelación y registro manual; pagos en fase posterior. |
| Los negocios piden SMS desde el día uno | Alta | Medio | Email primero; adaptador y coste por mensaje preparados; paquete futuro. |
| Competidores tienen más funciones | Alta | Medio | No competir por paridad; posicionar simplicidad, precio y soporte. |
| Dependencia de un proveedor de email | Media | Alto | Adaptador, reintentos, monitorización y proveedor alternativo. |
| Coste de soporte por onboarding | Media | Alto | Documentación, vídeos cortos, plantillas y alta asistida. |
| Empresites se convierte en dependencia | Baja | Alto | Integración solo por atribución; alta y operación independientes. |
| Marca "Velora" no disponible | Media | Medio | Búsqueda de marca antes de invertir en identidad; nombre de trabajo. |
| RGPD mal resuelto | Media | Alto | DPA, registro de actividades, retención y revisión legal antes del lanzamiento. |
| Datos de salud en notas libres | Media | Alto | Aviso en UI, política de uso y ausencia de campos estructurados de salud. |
| Falta de multi-sede en el MVP | Media | Medio | Relaciones N:N desde el inicio; validar demanda; no bloquear el lanzamiento. |
| Doble ocupación de un recurso | Media | Crítico | Exclusion constraint por recurso, bloqueo y revalidación transaccional. |
| Plantillas desactualizadas o mal mantenidas | Media | Medio | Versionado, plantillas sembradas y revisión periódica; no se autoaplican. |
| Complejidad de requisitos de recursos | Media | Alto | Empezar por tipo + cantidad + recurso opcional; capacidad >1 y horarios por recurso en P2. |
| Dependencia de Google para el acceso | Media | Alto | Enlace mágico por email como alternativa; cliente OAuth propio; monitorización. |

---

## 12. Decisiones de producto

| # | Decisión | Estado |
|---|---|---|
| DP1 | Una sede activa por empresa en el MVP, con relaciones N:N | Propuesta |
| DP2 | Alta manual por superadministrador | Propuesta |
| DP3 | Sin marketplace ni comisiones | Confirmado por la solicitud |
| DP4 | Sin pagos online en el MVP | Confirmado por la solicitud |
| DP5 | Email como único canal transaccional | Propuesta |
| DP6 | Registro manual de cobro, sin TPV | Propuesta |
| DP7 | Profesionales con login opcional | Propuesta |
| DP8 | Precios 19/34/59 € como hipótesis | Pendiente de validación |
| DP9 | Español y EUR en el MVP | Propuesta |
| DP10 | Sin cuenta de cliente final | Confirmado por la solicitud |
| DP11 | Recursos físicos y requisitos por servicio | Confirmado por el feedback |
| DP12 | Plantillas sectoriales sobre un único motor | Confirmado por el feedback |
| DP13 | Auth.js con Google y enlace mágico, sin contraseñas | Confirmado por el feedback |
| DP14 | Exclusividad de recursos con constraint PostgreSQL | Confirmado por el feedback |
| DP15 | Relación empresa-sede-profesional-servicio-recurso desde el inicio | Confirmado por el feedback |

---

## 13. Criterios de éxito del MVP

El MVP se considera comercializable cuando:

1. Se puede dar de alta una peluquería real y publicar su página en menos de 30 minutos.
2. Un cliente puede reservar desde un móvil sin cuenta y recibe confirmación.
3. El propietario ve la cita en la agenda y puede modificarla o cancelarla.
4. Dos personas que intentan reservar el mismo hueco a la vez: solo una lo consigue.
5. Dos personas que necesitan la misma cabina a la vez: solo una la ocupa; la otra recibe alternativas.
6. Un usuario de una empresa no puede acceder a datos de otra ni manipulando IDs.
7. El recordatorio se envía 24 h antes y no se envía si la cita se canceló.
8. El negocio puede exportar y anonimizar datos de clientes.
9. Los backups se restauran correctamente en una prueba real.
10. El flujo funciona en iOS Safari y Android Chrome.
11. Una barbería, un spa y un centro de manicura pueden configurarse desde su plantilla sin código específico.
12. Un negocio piloto opera durante dos semanas sin incidencias críticas.

---

## 14. Preguntas para la aprobación

1. ¿Se aprueba **una sede activa por empresa** en el MVP, con relaciones N:N desde el inicio?
2. ¿Se aprueba el **alta manual** por superadministrador y descartar el autoservicio?
3. ¿Se aprueba **PostgreSQL desde el primer día** y descartar SQLite?
4. ¿Se aprueba el **registro manual de cobro** en la cita, sin TPV?
5. ¿Se aprueba la **hipótesis de precios** 19/34/59 € o se prefiere validar antes de fijarla?
6. ¿Se aprueba **Brevo** como proveedor inicial de email?
7. ¿Se aprueba **Hetzner/VPS europeo + Docker Compose** como infraestructura inicial?
8. ¿Se aprueba **Velora** como nombre de trabajo?
9. ¿Se aprueba **Auth.js con Google + enlace mágico** y eliminar las contraseñas propias?
10. ¿Se aprueban los **recursos físicos con requisitos por servicio y exclusion constraint**?
11. ¿Se aprueban las **7 plantillas sectoriales** y su aplicación no destructiva?

---

## 15. Trazabilidad con la solicitud

| Apartado de la solicitud | Dónde se responde |
|---|---|
| 1. Contexto y objetivo | Este documento, secciones 1–4; [README](../README.md). |
| 2. Filosofía del producto | Sección 4 y principios de [ARCHITECTURE](ARCHITECTURE.md#2-principios-de-diseño). |
| 3. Tipos de usuario | Sección 3; matriz de permisos en [SECURITY](SECURITY.md#62-matriz-de-permisos). |
| 4.A Gestión de empresas | Requisitos A y C; [DATABASE](DATABASE.md#42-empresa-y-sede). |
| 4.B Catálogo de servicios | Requisitos D; [DATABASE](DATABASE.md#44-catálogo). |
| 4.C Profesionales | Requisitos E; [DATABASE](DATABASE.md#43-membresías-y-profesionales). |
| 4.D Agenda de citas | Requisitos F y G; [USER-FLOWS](USER-FLOWS.md#8-flujo-f6--agenda-diaria-del-propietario). |
| 4.E Reservas online | Requisitos H; [USER-FLOWS](USER-FLOWS.md#11-flujo-f9--reserva-online-del-cliente-final). |
| 4.F Gestión de clientes | Requisitos I; [DATABASE](DATABASE.md#46-clientes). |
| 4.G Comunicaciones | Requisitos J; [ARCHITECTURE](ARCHITECTURE.md#11-notificaciones-y-trabajos). |
| 4.H Estadísticas | Requisitos K. |
| 4.I Recursos físicos (feedback v1.1) | Requisitos P; [ARCHITECTURE](ARCHITECTURE.md#10-recursos-físicos-y-concurrencia). |
| 4.J Plantillas sectoriales (feedback v1.1) | Requisitos Q; [ARCHITECTURE](ARCHITECTURE.md#11-plantillas-sectoriales). |
| 5. Diseño y experiencia | [ARCHITECTURE](ARCHITECTURE.md#16-frontend-y-sistema-de-diseño). |
| 6. Arquitectura tecnológica | [ARCHITECTURE](ARCHITECTURE.md). |
| 7. Modelo SaaS y monetización | Sección 9; [ROADMAP](ROADMAP.md#8-costes-de-infraestructura-y-servicios). |
| 8. Seguridad y cumplimiento | [SECURITY](SECURITY.md). |
| 9. Funcionalidades futuras | Sección 6.2 y [ROADMAP](ROADMAP.md#9-post-mvp). |
| 10. Integración con Empresites | Requisitos N; [USER-FLOWS](USER-FLOWS.md#21-flujo-f19--atribución-de-empresites). |
| 11. Forma de trabajo | Documentación completa + [ROADMAP](ROADMAP.md). |
| 12. Resultado esperado | Sección 13 y [ROADMAP](ROADMAP.md#7-plan-de-piloto-y-lanzamiento). |
