import {
  ALERT_SEVERITIES,
  ALERT_TYPES,
  type AlertEvaluationInput,
  type AlertEvaluationResult,
  type AlertSeverity,
  type AlertThresholds,
  type AlertType,
  type OperationalAlert,
  type UnknownTemporalInformation,
} from "@/contracts/types/alerts";

export const DEFAULT_ALERT_THRESHOLDS: Readonly<AlertThresholds> = {
  cobertura_critica_menor_que: 30,
  cobertura_importante_menor_que: 70,
  cobertura_completa_desde: 100,
  donacion_tolerancia_minutos: 60,
  informacion_desactualizada_minutos: 240,
  capacidad_advertencia_desde: 85,
  capacidad_critica_desde: 95,
  capacidad_sobrecapacidad_mayor_que: 100,
};

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critica: 0,
  advertencia: 1,
  informativa: 2,
};

function deterministicId(
  type: AlertType,
  centerId: string,
  subjectId: string,
) {
  return `alerta:${type}:${centerId}:${subjectId}`;
}

function finiteDate(value: string) {
  if (!/(?:z|[+-]\d{2}:\d{2})$/i.test(value)) {
    return null;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function createAlert(
  input: AlertEvaluationInput,
  values: Omit<
    OperationalAlert,
    | "referencia_tipo"
    | "referencia_id"
    | "evaluado_en"
    | "estado"
  >,
): OperationalAlert {
  return {
    ...values,
    referencia_tipo: input.referencia_tipo,
    referencia_id: input.referencia_id,
    evaluado_en: input.evaluado_en,
    estado: "activa",
  };
}

function emptyTypeCounts(): Record<AlertType, number> {
  return Object.fromEntries(ALERT_TYPES.map((type) => [type, 0])) as Record<
    AlertType,
    number
  >;
}

function emptySeverityCounts(): Record<AlertSeverity, number> {
  return Object.fromEntries(
    ALERT_SEVERITIES.map((severity) => [severity, 0]),
  ) as Record<AlertSeverity, number>;
}

function coverageAlert(
  input: AlertEvaluationInput,
  center: AlertEvaluationInput["centros"][number],
  product: AlertEvaluationInput["centros"][number]["productos"][number],
  thresholds: AlertThresholds,
) {
  const coverage = product.cobertura_porcentaje;
  if (
    product.objetivo_unidad_base <= 0 ||
    coverage === null ||
    coverage >= thresholds.cobertura_completa_desde
  ) {
    return null;
  }

  let severity: AlertSeverity;
  let title: string;
  let threshold: number;
  if (coverage < thresholds.cobertura_critica_menor_que) {
    severity = "critica";
    title = "Déficit crítico";
    threshold = thresholds.cobertura_critica_menor_que;
  } else if (coverage < thresholds.cobertura_importante_menor_que) {
    severity = "advertencia";
    title = "Déficit importante";
    threshold = thresholds.cobertura_importante_menor_que;
  } else {
    severity = "informativa";
    title = "Déficit moderado";
    threshold = thresholds.cobertura_completa_desde;
  }

  const priorityText =
    product.prioridad === 1 ? " La necesidad tiene prioridad alta." : "";
  return createAlert(input, {
    alerta_id: deterministicId(
      "deficit_cobertura",
      center.centro_id,
      product.producto_id,
    ),
    tipo: "deficit_cobertura",
    severidad: severity,
    centro_id: center.centro_id,
    centro_nombre: center.centro_nombre,
    producto_id: product.producto_id,
    producto_nombre: product.producto_nombre,
    titulo: title,
    descripcion: `La cobertura es ${coverage.toFixed(2)} % y faltan ${product.deficit_confirmado_unidad_base} ${product.unidad_base}.${priorityText}`,
    valor_observado: coverage,
    umbral_aplicado: threshold,
    unidad: "porcentaje",
    accion_sugerida:
      "Revisar inventario confirmado, necesidad vigente y opciones de abastecimiento.",
    prioridad_operativa: product.prioridad,
  });
}

function capacityAlert(
  input: AlertEvaluationInput,
  center: AlertEvaluationInput["centros"][number],
  thresholds: AlertThresholds,
) {
  const capacity = center.capacidad_almacenamiento;
  const occupancy = capacity.ocupacion_porcentaje;
  if (!capacity.calculable || occupancy === null) {
    return null;
  }

  let severity: AlertSeverity;
  let title: string;
  let threshold: number;
  if (occupancy > thresholds.capacidad_sobrecapacidad_mayor_que) {
    severity = "critica";
    title = "Sobrecapacidad de almacenamiento";
    threshold = thresholds.capacidad_sobrecapacidad_mayor_que;
  } else if (occupancy >= thresholds.capacidad_critica_desde) {
    severity = "critica";
    title = "Capacidad en nivel crítico";
    threshold = thresholds.capacidad_critica_desde;
  } else if (occupancy >= thresholds.capacidad_advertencia_desde) {
    severity = "advertencia";
    title = "Capacidad próxima al límite";
    threshold = thresholds.capacidad_advertencia_desde;
  } else {
    return null;
  }

  return createAlert(input, {
    alerta_id: deterministicId("capacidad", center.centro_id, "almacenamiento"),
    tipo: "capacidad",
    severidad: severity,
    centro_id: center.centro_id,
    centro_nombre: center.centro_nombre,
    producto_id: null,
    producto_nombre: null,
    titulo: title,
    descripcion: `La ocupación validada del centro es ${occupancy.toFixed(2)} %.`,
    valor_observado: occupancy,
    umbral_aplicado: threshold,
    unidad: "porcentaje",
    accion_sugerida:
      "Revisar capacidad disponible y coordinar la distribución sin ejecutar traslados automáticamente.",
    prioridad_operativa: null,
  });
}

export function evaluateOperationalAlerts(
  input: AlertEvaluationInput,
  thresholds: Readonly<AlertThresholds> = DEFAULT_ALERT_THRESHOLDS,
): AlertEvaluationResult {
  const evaluationTime = finiteDate(input.evaluado_en);
  if (evaluationTime === null) {
    throw new Error("La hora de evaluación debe ser una fecha válida y no ambigua.");
  }

  const alerts: OperationalAlert[] = [];
  const evidenceBySubject = new Map<string, AlertEvaluationInput["evidencia_temporal"][number]>();
  for (const evidence of input.evidencia_temporal) {
    const key = `${evidence.entidad}:${evidence.centro_id}:${evidence.producto_id}`;
    const current = evidenceBySubject.get(key);
    const evidenceTime = finiteDate(evidence.actualizado_en);
    const currentTime = current ? finiteDate(current.actualizado_en) : null;
    if (
      evidenceTime !== null &&
      (currentTime === null || evidenceTime > currentTime)
    ) {
      evidenceBySubject.set(key, evidence);
    }
  }

  const unknownTemporal: UnknownTemporalInformation[] = [];
  for (const center of input.centros) {
    for (const product of center.productos) {
      const coverage = coverageAlert(input, center, product, thresholds);
      if (coverage) {
        alerts.push(coverage);
      }

      if (product.excedente_transferible_unidad_base > 0) {
        alerts.push(
          createAlert(input, {
            alerta_id: deterministicId(
              "excedente_transferible",
              center.centro_id,
              product.producto_id,
            ),
            tipo: "excedente_transferible",
            severidad: "informativa",
            centro_id: center.centro_id,
            centro_nombre: center.centro_nombre,
            producto_id: product.producto_id,
            producto_nombre: product.producto_nombre,
            titulo: "Excedente transferible disponible",
            descripcion: `El excedente calculado, después de necesidad y reserva, es ${product.excedente_transferible_unidad_base} ${product.unidad_base}.`,
            valor_observado: product.excedente_transferible_unidad_base,
            umbral_aplicado: 0,
            unidad: product.unidad_base,
            accion_sugerida:
              "Evaluar una recomendación de traslado; no representa una orden automática.",
            prioridad_operativa: product.prioridad,
          }),
        );
      }

      const evidenceKey = `inventario:${center.centro_id}:${product.producto_id}`;
      const evidence = evidenceBySubject.get(evidenceKey);
      if (!evidence) {
        unknownTemporal.push({
          entidad: "inventario",
          centro_id: center.centro_id,
          centro_nombre: center.centro_nombre,
          producto_id: product.producto_id,
          producto_nombre: product.producto_nombre,
        });
      } else {
        const updatedTime = finiteDate(evidence.actualizado_en);
        if (updatedTime !== null) {
          const ageMinutes = (evaluationTime - updatedTime) / 60_000;
          if (ageMinutes > thresholds.informacion_desactualizada_minutos) {
            alerts.push(
              createAlert(input, {
                alerta_id: deterministicId(
                  "informacion_desactualizada",
                  center.centro_id,
                  product.producto_id,
                ),
                tipo: "informacion_desactualizada",
                severidad: "informativa",
                centro_id: center.centro_id,
                centro_nombre: center.centro_nombre,
                producto_id: product.producto_id,
                producto_nombre: product.producto_nombre,
                titulo: "Información de inventario desactualizada",
                descripcion: `La última actualización confirmada ocurrió hace ${Math.floor(ageMinutes)} minutos.`,
                valor_observado: Math.floor(ageMinutes),
                umbral_aplicado: thresholds.informacion_desactualizada_minutos,
                unidad: "minuto",
                accion_sugerida:
                  "Verificar físicamente el inventario y registrar una actualización válida.",
                prioridad_operativa: product.prioridad,
              }),
            );
          }
        }
      }
    }

    const missingVolunteers = Math.max(
      0,
      center.voluntarios_requeridos - center.voluntarios_disponibles,
    );
    if (missingVolunteers > 0) {
      alerts.push(
        createAlert(input, {
          alerta_id: deterministicId(
            "voluntariado_insuficiente",
            center.centro_id,
            "personal",
          ),
          tipo: "voluntariado_insuficiente",
          severidad: "advertencia",
          centro_id: center.centro_id,
          centro_nombre: center.centro_nombre,
          producto_id: null,
          producto_nombre: null,
          titulo: "Voluntariado insuficiente",
          descripcion: `Hay ${center.voluntarios_disponibles} personas disponibles, se requieren ${center.voluntarios_requeridos} y faltan ${missingVolunteers}.`,
          valor_observado: missingVolunteers,
          umbral_aplicado: 0,
          unidad: "persona",
          accion_sugerida:
            "Coordinar personal adicional o redistribuir turnos disponibles.",
          prioridad_operativa: null,
        }),
      );
    }

    const capacity = capacityAlert(input, center, thresholds);
    if (capacity) {
      alerts.push(capacity);
    }
  }

  for (const donation of input.donaciones) {
    const expectedTime = finiteDate(donation.llegada_prevista);
    if (donation.estado !== "pendiente" || expectedTime === null) {
      continue;
    }
    const delayedMinutes =
      (evaluationTime - expectedTime) / 60_000 -
      thresholds.donacion_tolerancia_minutos;
    if (delayedMinutes <= 0) {
      continue;
    }
    alerts.push(
      createAlert(input, {
        alerta_id: deterministicId(
          "donacion_retrasada",
          donation.centro_id,
          donation.intencion_id,
        ),
        tipo: "donacion_retrasada",
        severidad: "advertencia",
        centro_id: donation.centro_id,
        centro_nombre: donation.centro_nombre,
        producto_id: donation.producto_id,
        producto_nombre: donation.producto_nombre,
        titulo: "Donación anunciada retrasada",
        descripcion: `La intención ${donation.intencion_id} superó su llegada prevista y la tolerancia por ${Math.floor(delayedMinutes)} minutos.`,
        valor_observado: Math.floor(delayedMinutes),
        umbral_aplicado: thresholds.donacion_tolerancia_minutos,
        unidad: "minuto",
        accion_sugerida:
          "Contactar al canal logístico de la donación y actualizar su estado cuando exista confirmación.",
        prioridad_operativa: null,
      }),
    );
  }

  const deduplicated = [...new Map(alerts.map((alert) => [alert.alerta_id, alert])).values()];
  deduplicated.sort(
    (left, right) =>
      SEVERITY_ORDER[left.severidad] - SEVERITY_ORDER[right.severidad] ||
      (left.prioridad_operativa ?? 4) - (right.prioridad_operativa ?? 4) ||
      left.centro_nombre.localeCompare(right.centro_nombre, "es") ||
      (left.producto_nombre ?? "").localeCompare(
        right.producto_nombre ?? "",
        "es",
      ) ||
      left.alerta_id.localeCompare(right.alerta_id),
  );

  const severityCounts = emptySeverityCounts();
  const typeCounts = emptyTypeCounts();
  const centerMap = new Map<
    string,
    AlertEvaluationResult["por_centro"][number]
  >();
  for (const alert of deduplicated) {
    severityCounts[alert.severidad] += 1;
    typeCounts[alert.tipo] += 1;
    const summary = centerMap.get(alert.centro_id) ?? {
      centro_id: alert.centro_id,
      centro_nombre: alert.centro_nombre,
      total: 0,
      criticas: 0,
      advertencias: 0,
      informativas: 0,
    };
    summary.total += 1;
    if (alert.severidad === "critica") summary.criticas += 1;
    if (alert.severidad === "advertencia") summary.advertencias += 1;
    if (alert.severidad === "informativa") summary.informativas += 1;
    centerMap.set(alert.centro_id, summary);
  }

  return {
    evaluado_en: input.evaluado_en,
    referencia_tipo: input.referencia_tipo,
    referencia_id: input.referencia_id,
    total: deduplicated.length,
    por_severidad: severityCounts,
    por_centro: [...centerMap.values()].sort((left, right) =>
      left.centro_nombre.localeCompare(right.centro_nombre, "es"),
    ),
    por_tipo: typeCounts,
    centros_que_requieren_atencion: centerMap.size,
    informacion_temporal_desconocida: unknownTemporal.sort(
      (left, right) =>
        left.centro_nombre.localeCompare(right.centro_nombre, "es") ||
        left.producto_nombre.localeCompare(right.producto_nombre, "es"),
    ),
    alertas: deduplicated,
  };
}
