# Fase 2 — Catálogo, equipo, recursos y página pública

**Estado:** completada  
**Fecha:** 2026-11-04  
**Siguiente fase:** Fase 3 — agenda, disponibilidad y reservas

---

## 1. Qué incluye

- **7 plantillas sectoriales versionadas**: barbería, peluquería, manicura, spa, cejas/pestañas, estética y masajes.
- Aplicación **idempotente y no destructiva**: no borra datos y no duplica servicios, categorías, tipos o recursos.
- **Catálogo**:
  - categorías de servicio;
  - servicios con duración, margen, precio, descripción y reserva online;
  - variantes de precio/duración.
- **Equipo**:
  - profesionales con nombre, especialidad, biografía y color;
  - servicios que realiza cada profesional;
  - horario semanal por profesional y sede;
  - ausencias y vacaciones.
- **Recursos**:
  - tipos de recurso;
  - recursos físicos por sede;
  - requisitos de recurso por servicio y cantidad.
- **Página pública** `/p/[slug]`:
  - solo si el negocio está activo y publicado;
  - datos de contacto y dirección;
  - servicios agrupados por categoría;
  - equipo y servicios que realiza;
  - horario;
  - metadatos y JSON-LD básico.
- **RLS** para las nuevas tablas y función `get_public_business` con `SECURITY DEFINER`.

## 2. Plantillas

| Clave | Nombre | Servicios | Recursos iniciales |
|---|---|---|---|
| `barberia` | Barbería | 5 | Sillón de barbero |
| `peluqueria` | Peluquería | 5 | Sillón y lavacabezas |
| `manicura` | Manicura y pedicura | 5 | Mesa de manicura |
| `spa` | Spa | 5 | Camilla y sala de relax |
| `cejas_pestanas` | Cejas y pestañas | 5 | Camilla de cejas |
| `estetica` | Estética | 5 | Camilla de estética |
| `masajes` | Masajes | 5 | Camilla de masaje |

Cada plantilla tiene `version` (`2026.1`) y se guarda en `businesses.sector`, `template_version` y `template_applied_at`.

La aplicación:
1. crea o reutiliza categorías por slug;
2. crea servicios solo si no existe uno con el mismo nombre;
3. crea tipos de recurso por `key`;
4. crea un recurso inicial por tipo si no existe el código;
5. crea requisitos si el servicio los declara;
6. registra `template.applied` en auditoría.

## 3. Página pública

La lectura pública no usa `withTenant`. Se hace mediante `get_public_business(slug)`, una función `SECURITY DEFINER` que:

- exige `published_at is not null`, `status = 'active'` y `deleted_at is null`;
- devuelve solo los campos públicos;
- agrega servicios, variantes, profesionales y horario en un JSON;
- no expone datos fiscales, suscripción, miembros ni auditoría.

La página incluye JSON-LD `BeautySalon` con dirección y horarios. La reserva online todavía no está conectada; llega en Fase 3.

## 4. Migración

`20261104170701_phase2` crea:

- enum `BusinessSector`;
- campos de plantilla en `businesses`;
- `service_categories`;
- `professional_services`;
- `professional_schedules`;
- `professional_time_off`;
- `services.category_id`;
- políticas RLS y claves compuestas de tenant;
- función `get_public_business`.

## 5. Pruebas

`tests/phase2.test.ts` cubre:

- lectura pública de un negocio publicado con servicios, equipo y horario;
- negocio en borrador no visible;
- aislamiento de categorías y horarios entre empresas.

También se mantienen RLS, invitaciones, auditoría y concurrencia.

## 6. Limitaciones conocidas

- **No hay subida de imágenes**: logo, portada y fotos de servicio quedan para la fase de medios (R2/S3).
- **No hay vista previa interna** de la página pública; se publica y se abre `/p/[slug]`.
- **No hay disponibilidad ni reserva online**: Fase 3.
- **No hay multi-sede operativa**: se usa la sede principal; el esquema admite más.
- **No hay CRUD de edición completo**: se crean y activan/desactivan servicios y profesionales; la edición detallada se ampliará.
- **No hay borrado seguro** de servicios o recursos con citas; se evita hasta Fase 3.
- Las plantillas no crean profesionales ni asignan automáticamente servicios al equipo.
- Los límites de plan aún no se aplican a profesionales, sedes o recursos.

## 7. Criterio de salida

- [x] 7 plantillas aplicables e idempotentes.
- [x] Servicios con variantes y categorías.
- [x] Profesionales con servicios, horario y ausencias.
- [x] Tipos de recurso, recursos y requisitos.
- [x] Página pública publicada y no indexable en borrador.
- [x] RLS y pruebas de aislamiento.
- [ ] Imágenes y vista previa: fase de medios.
- [ ] Disponibilidad y reserva: Fase 3.
