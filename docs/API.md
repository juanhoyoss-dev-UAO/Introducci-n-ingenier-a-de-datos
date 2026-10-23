# API

## Estado

No hay endpoints implementados en el Bloque A. `src/app/api` es únicamente una ubicación reservada y no contiene archivos `route.ts`.

## Convenciones futuras propuestas

Estas convenciones deberán confirmarse antes de implementar la API:

- Usar rutas bajo `/api` y versionar con `/api/v1` cuando exista un contrato público estable.
- Nombrar recursos con sustantivos en plural y utilizar los métodos HTTP según su semántica.
- Intercambiar JSON en UTF-8 y fechas en ISO 8601 con zona horaria explícita.
- Validar toda entrada en el límite HTTP mediante contratos compartidos.
- Mantener controladores delgados: la coordinación irá a servicios y la persistencia a repositorios.
- Tratar una importación como una operación que produce un snapshot nuevo; no sobrescribir snapshots anteriores.
- No mezclar intenciones esperadas con inventario confirmado en una respuesta agregada sin distinguirlos expresamente.

## Formato preliminar de respuestas

Una respuesta exitosa expondrá `data` y podrá incluir `meta` para paginación o trazabilidad. Un error expondrá un código estable, un mensaje seguro para el usuario y, cuando corresponda, detalles de validación por campo. No se publicarán trazas, secretos ni detalles de infraestructura.

Los códigos HTTP, nombres concretos de endpoints, esquemas y reglas de idempotencia siguen pendientes de aprobación. Este documento no constituye una implementación.

