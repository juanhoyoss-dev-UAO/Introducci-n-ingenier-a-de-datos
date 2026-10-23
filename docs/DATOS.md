# Datos

## Contrato vigente del Bloque B

El contrato preliminar del Bloque A quedó aprobado y ampliado por el Bloque B. Los archivos externos futuros podrán tener encabezados diferentes, pero deberán mapearse explícitamente a este contrato. Nunca se inventarán equivalencias, identificadores ni cantidades.

Cada importación válida creará un snapshot nuevo. Los códigos se interpretan junto con `snapshot_id`; seis centros son únicamente el dataset inicial. Los paquetes son enteros, los tiempos son dirigidos y las donaciones esperadas nunca se suman al inventario confirmado.

| Entidad | Campos canónicos |
| --- | --- |
| `snapshots` | `id`, `nombre`, `created_at`, `descripcion` |
| `centros` | `snapshot_id`, `centro_id`, `nombre`, `estado`, `zona`, `coordinador_nombre` |
| `productos` | `snapshot_id`, `producto_id`, `nombre`, `unidad_base` |
| `presentaciones` | `snapshot_id`, `sku_id`, `producto_id`, `nombre`, `contenido_por_paquete` |
| `inventario_inicial` | `snapshot_id`, `centro_id`, `sku_id`, `cantidad_paquetes` |
| `necesidades` | `snapshot_id`, `centro_id`, `producto_id`, `objetivo_unidad_base`, `reserva_unidad_base`, `prioridad` |
| `voluntarios` | `snapshot_id`, `centro_id`, `disponibles`, `requeridos` |
| `tiempos_traslado` | `snapshot_id`, `origen_id`, `destino_id`, `minutos` |
| `donaciones_esperadas` | `snapshot_id`, `intencion_id`, `centro_id`, `sku_id`, `cantidad_paquetes`, `llegada_prevista`, `estado` |
| `simulaciones` | `id`, `snapshot_id`, `nombre`, `hora_inicio`, `hora_actual`, `estado` |
| `eventos_simulacion` | `id`, `simulacion_id`, `tipo`, `ocurrido_en`, `registrado_en`, `payload` |

La tabla técnica `administradores` contiene `user_id`, vinculado con `auth.users`, y `created_at`.

## Valores controlados

- `unidad_base`: `ml`, `g` o `unidad`.
- `prioridad`: 1 alta, 2 media, 3 baja.
- `donaciones_esperadas.estado`: `pendiente`, `recibida` o `cancelada`.
- `simulaciones.estado`: `activa` o `finalizada`.
- `eventos_simulacion.tipo`: `recepcion_confirmada`, `cambio_necesidad` o `cambio_voluntarios`.

Los contratos TypeScript están en `src/contracts`; el detalle relacional se encuentra en `docs/MODELO_ER.md` y las fórmulas en `docs/REGLAS_NEGOCIO.md`.

## Cambios respecto al contrato preliminar

- El coordinador de demostración se almacena en `centros.coordinador_nombre`; no es usuario autenticado ni tabla funcional independiente.
- `inventario` se concretó como `inventario_inicial` para distinguir el estado base de cada simulación.
- `intenciones` se concretó como `donaciones_esperadas`.
- Se incorporaron snapshots, simulaciones, eventos y reserva de necesidad.
- Todos los identificadores dependientes incluyen aislamiento por snapshot mediante claves compuestas.

El historial del contrato preliminar permanece en Git; este documento describe el contrato vigente.

## Datos semilla

`supabase/seed.sql` contiene dos snapshots deterministas. El snapshot A tiene seis centros, cinco productos, siete presentaciones, inventario, necesidades, voluntarios, tiempos dirigidos, donaciones y dos simulaciones. El snapshot B reutiliza `C01` con inventario distinto e incluye `AGUA-330`, exclusivo de ese snapshot para probar referencias cruzadas inválidas.

No se utiliza información personal real. Los usuarios de autenticación para pruebas se crean temporalmente mediante la API administrativa del Supabase local y no forman parte del seed operativo.

