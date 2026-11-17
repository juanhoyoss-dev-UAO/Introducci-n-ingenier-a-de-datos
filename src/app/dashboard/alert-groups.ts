import type {
  AlertSeverity,
  OperationalAlert,
} from "@/contracts/types/alerts";

export const ALERT_GROUP_DEFINITIONS = [
  {
    id: "agua_alimentos",
    name: "Agua y alimentos",
    description:
      "Déficits y oportunidades de abastecimiento de agua y alimentos no perecederos.",
  },
  {
    id: "abrigo_higiene",
    name: "Abrigo e higiene",
    description:
      "Necesidades de abrigo, alojamiento, higiene y saneamiento.",
  },
  {
    id: "herramientas_apoyo",
    name: "Herramientas y apoyo",
    description:
      "Protección operativa, herramientas, energía y comunicaciones.",
  },
  {
    id: "otras_alertas",
    name: "Otras alertas operativas",
    description:
      "Voluntariado, donaciones, vigencia de la información y capacidad.",
  },
] as const;

export type AlertGroupId = (typeof ALERT_GROUP_DEFINITIONS)[number]["id"];

export const PRODUCT_CATEGORY_BY_ID = {
  P01: "Agua",
  P02: "Agua",
  P03: "Agua",
  P04: "Agua",
  P05: "Alimentos no perecederos",
  P06: "Alimentos no perecederos",
  P07: "Alimentos no perecederos",
  P08: "Alimentos no perecederos",
  P09: "Higiene y saneamiento",
  P10: "Higiene y saneamiento",
  P11: "Higiene y saneamiento",
  P12: "Higiene y saneamiento",
  P13: "Abrigo y alojamiento",
  P14: "Abrigo y alojamiento",
  P15: "Abrigo y alojamiento",
  P16: "Abrigo y alojamiento",
  P17: "Primeros auxilios y proteccion",
  P18: "Primeros auxilios y proteccion",
  P19: "Primeros auxilios y proteccion",
  P20: "Primeros auxilios y proteccion",
  P21: "Herramientas manuales",
  P22: "Herramientas manuales",
  P23: "Herramientas manuales",
  P24: "Herramientas manuales",
  P25: "Herramientas electricas",
  P26: "Herramientas electricas",
  P27: "Herramientas electricas",
  P28: "Herramientas electricas",
  P29: "Energia y comunicacion",
  P30: "Energia y comunicacion",
  P31: "Energia y comunicacion",
  P32: "Energia y comunicacion",
} as const;

type CatalogCategory = (typeof PRODUCT_CATEGORY_BY_ID)[keyof typeof PRODUCT_CATEGORY_BY_ID];

const CATEGORY_GROUP: Record<CatalogCategory, AlertGroupId> = {
  Agua: "agua_alimentos",
  "Alimentos no perecederos": "agua_alimentos",
  "Higiene y saneamiento": "abrigo_higiene",
  "Abrigo y alojamiento": "abrigo_higiene",
  "Primeros auxilios y proteccion": "herramientas_apoyo",
  "Herramientas manuales": "herramientas_apoyo",
  "Herramientas electricas": "herramientas_apoyo",
  "Energia y comunicacion": "herramientas_apoyo",
};

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critica: 0,
  advertencia: 1,
  informativa: 2,
};

export interface OperationalAlertGroup {
  id: AlertGroupId;
  name: string;
  description: string;
  alerts: OperationalAlert[];
  criticalCount: number;
  affectedCenters: number;
  maximumSeverity: AlertSeverity | null;
}

export function alertGroupId(alert: OperationalAlert): AlertGroupId {
  if (
    alert.tipo !== "deficit_cobertura" &&
    alert.tipo !== "excedente_transferible"
  ) {
    return "otras_alertas";
  }

  const category = alert.producto_id
    ? PRODUCT_CATEGORY_BY_ID[
        alert.producto_id as keyof typeof PRODUCT_CATEGORY_BY_ID
      ]
    : undefined;
  return category ? CATEGORY_GROUP[category] : "otras_alertas";
}

export function groupOperationalAlerts(
  alerts: readonly OperationalAlert[],
): OperationalAlertGroup[] {
  const alertsByGroup = new Map<AlertGroupId, OperationalAlert[]>();
  for (const definition of ALERT_GROUP_DEFINITIONS) {
    alertsByGroup.set(definition.id, []);
  }
  for (const alert of alerts) {
    alertsByGroup.get(alertGroupId(alert))?.push(alert);
  }

  return ALERT_GROUP_DEFINITIONS.map((definition) => {
    const groupAlerts = alertsByGroup.get(definition.id) ?? [];
    const maximumSeverity = groupAlerts.reduce<AlertSeverity | null>(
      (current, alert) =>
        current === null ||
        SEVERITY_ORDER[alert.severidad] < SEVERITY_ORDER[current]
          ? alert.severidad
          : current,
      null,
    );
    return {
      ...definition,
      alerts: groupAlerts,
      criticalCount: groupAlerts.filter(
        (alert) => alert.severidad === "critica",
      ).length,
      affectedCenters: new Set(groupAlerts.map((alert) => alert.centro_id)).size,
      maximumSeverity,
    };
  }).sort(
    (left, right) =>
      (left.maximumSeverity === null
        ? Number.POSITIVE_INFINITY
        : SEVERITY_ORDER[left.maximumSeverity]) -
        (right.maximumSeverity === null
          ? Number.POSITIVE_INFINITY
          : SEVERITY_ORDER[right.maximumSeverity]) ||
      right.alerts.length - left.alerts.length ||
      ALERT_GROUP_DEFINITIONS.findIndex((item) => item.id === left.id) -
        ALERT_GROUP_DEFINITIONS.findIndex((item) => item.id === right.id),
  );
}
