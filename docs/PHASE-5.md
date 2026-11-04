# PHASE-5.md — Hardening, despliegue y piloto

**Estado:** en curso. El hardening y los artefactos de despliegue están
implementados y probados en local; lo que depende de infraestructura (TLS real,
backups automáticos en un VPS, monitorización externa y el piloto con un negocio)
queda pendiente de ejecución.

---

## 1. Hecho

| Área | Implementación |
|---|---|
| Cabeceras de seguridad | `next.config.ts`: `nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy` y HSTS en producción. `poweredByHeader` desactivado. |
| Rate limiting | `src/lib/rate-limit.ts`: ventana fija en memoria. Límites aplicados a disponibilidad (120/min) y reservas (10/min) por IP, con `429` y `Retry-After`. |
| Retención RGPD | `src/modules/retention/cleanup.ts`: anonimiza clientes inactivos (24 meses por defecto) sin citas futuras y purga claves de idempotencia y sesiones caducadas. |
| Worker | Ejecuta la retención una vez al día además de la outbox. |
| Empaquetado | `Dockerfile` multi-stage con salida `standalone`, objetivo `worker` y usuario sin privilegios. |
| Producción | `docker-compose.prod.yml`: Postgres, app, worker y Caddy con TLS automático. |
| Proxy | `Caddyfile` con compresión, HSTS y logs rotados. |
| Runbook | [DEPLOY.md](DEPLOY.md): variables, primer despliegue, actualizaciones, backups, prueba de restauración, monitorización y tabla de incidentes. |
| Pruebas | `tests/hardening.test.ts`: limitador (ventana, claves distintas, reinicio) y retención (anonimiza antiguos, respeta recientes y purga claves). |

## 2. Pendiente (requiere infraestructura o decisión)

- Suite E2E de navegador (Playwright) en CI contra staging. Hoy la cobertura
  funcional se hace con pruebas de integración y comprobaciones HTTP.
- Auditoría de accesibilidad y Lighthouse > 90 en la página pública.
- Pruebas de carga formales de disponibilidad y reserva (el motor ya está
  probado con 20 reservas concurrentes en integración).
- Staging/producción reales, backups automáticos y restauración verificada.
- Monitorización externa con alertas y panel de estado.
- Piloto con un negocio y corrección de incidencias.

## 3. Criterios de salida

- [ ] Producción accesible con TLS.
- [ ] Backup restaurado en un entorno limpio.
- [ ] Monitorización y alertas activas.
- [ ] E2E verde en staging.
- [ ] Lighthouse > 90 en la página pública.
- [ ] Un negocio piloto completa el onboarding y recibe reservas reales.
- [ ] No hay incidencias críticas en 2 semanas de piloto.
- [x] Runbook de incidentes y soporte.

## 4. Cómo verificar en local

```bash
npm run db:migrate && npm run db:seed
npm run dev            # terminal 1
npm run worker         # terminal 2: outbox + retención
curl -i http://localhost:3001/api/health
```

Para probar los límites públicos:

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3001/api/v1/public/alcazar-peluqueros/bookings \
    -H 'content-type: application/json' -d '{}'
done
```

A partir de la décima petición debe aparecer `429`.

Para revisar retención sin esperar al worker:

```bash
npx tsx -e "import('./src/modules/retention/cleanup.ts').then(async (m) => console.log(await m.runRetention()))"
```
