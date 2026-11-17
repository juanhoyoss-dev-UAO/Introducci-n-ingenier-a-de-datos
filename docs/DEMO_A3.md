# Demostración A3 — Importación de recepciones Excel

## Ubicación de los archivos

La plantilla, los diez archivos de demostración, el manifiesto y los resultados reales están en `data/demo/a3/`.

## Secuencia manual

1. Inicia la aplicación e ingresa como administrador.
2. Abre **Alertas operativas**.
3. Pulsa **Reiniciar PRUEBAS desde MAIN** y confirma la acción.
4. Verifica que el selector muestre **Emergencia semanal — PRUEBAS**.
5. Pulsa **Actualizar inventario desde Excel**.
6. Selecciona `RECEPCION_01.xlsx`, pulsa **Previsualizar y validar** y revisa centro, producto, presentación, cantidad y hora.
7. Pulsa **Confirmar importación**. La versión nueva se seleccionará automáticamente y mostrará inventario, cobertura, déficit y alertas antes/después.
8. Repite en orden hasta `RECEPCION_10.xlsx`.
9. Para comprobar idempotencia, vuelve a importar uno de los archivos ya aplicado: el sistema debe reconocerlo y no aumentar las existencias.
10. Selecciona **Emergencia semanal — MAIN** y verifica que permanece como referencia de solo lectura.

## Resultado real de la prueba aislada

| Excel | Centro | Alertas antes | Alertas después | Resueltas | Severidad reducida |
|---|---|---:|---:|---:|---:|
| RECEPCION_01 | C03 | 196 | 196 | 0 | 1 |
| RECEPCION_02 | C05 | 196 | 195 | 1 | 0 |
| RECEPCION_03 | C06 | 195 | 195 | 0 | 1 |
| RECEPCION_04 | C01 | 195 | 194 | 1 | 2 |
| RECEPCION_05 | C04 | 194 | 194 | 0 | 1 |
| RECEPCION_06 | C03 | 195 | 195 | 0 | 1 |
| RECEPCION_07 | C02 | 196 | 196 | 1 | 0 |
| RECEPCION_08 | C05 | 197 | 197 | 0 | 1 |
| RECEPCION_09 | C06 | 200 | 199 | 1 | 0 |
| RECEPCION_10 | C03, C04, C02 | 201 | 199 | 2 | 1 |

Los totales de alertas pueden aumentar entre archivos porque avanza el reloj simulado y se activan reglas temporales. El efecto de cada recepción se compara con el estado inmediatamente anterior usando la misma hora de evaluación.
