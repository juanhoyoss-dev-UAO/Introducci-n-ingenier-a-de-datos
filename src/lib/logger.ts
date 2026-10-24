export type LogLevel = "INFO" | "OK" | "WARN" | "ERROR";
export type LogModule = "AUTH" | "API" | "SERVICE" | "REPOSITORY" | "UI";
export type LogDetails = Record<string, unknown>;

type ConfiguredLogLevel = LogLevel | "OFF";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  INFO: 10,
  OK: 20,
  WARN: 30,
  ERROR: 40,
};

const SENSITIVE_DETAIL_KEY =
  /password|hash|secret|token|cookie|authorization/i;
const MAX_TEXT_LENGTH = 240;

function normalizeText(value: string) {
  const singleLine = value.replace(/[\r\n]+/g, " ").trim();
  return singleLine.length <= MAX_TEXT_LENGTH
    ? singleLine
    : `${singleLine.slice(0, MAX_TEXT_LENGTH - 1)}…`;
}

function normalizeDetail(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return normalizeText(value);
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  if (value instanceof Error) {
    return `[${normalizeText(value.name || "Error")}]`;
  }
  if (Array.isArray(value)) {
    return `[array:${value.length}]`;
  }
  if (typeof value === "object") {
    return "[object]";
  }
  return normalizeText(String(value));
}

export function resolveMinimumLogLevel(
  configuredValue: string | undefined,
  nodeEnvironment: string | undefined,
): ConfiguredLogLevel {
  const normalized = configuredValue?.trim().toUpperCase();
  if (
    normalized === "INFO" ||
    normalized === "OK" ||
    normalized === "WARN" ||
    normalized === "ERROR" ||
    normalized === "OFF"
  ) {
    return normalized;
  }

  return nodeEnvironment === "development" ? "INFO" : "WARN";
}

function configuredMinimumLevel() {
  const configuredValue =
    typeof window === "undefined"
      ? process.env.APP_LOG_LEVEL
      : process.env.NEXT_PUBLIC_APP_LOG_LEVEL;
  return resolveMinimumLogLevel(configuredValue, process.env.NODE_ENV);
}

function shouldWrite(level: LogLevel) {
  const minimumLevel = configuredMinimumLevel();
  return (
    minimumLevel !== "OFF" &&
    LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[minimumLevel]
  );
}

export function formatLogMessage(
  level: LogLevel,
  module: LogModule,
  message: string,
  details: LogDetails = {},
) {
  const visibleDetails = Object.entries(details)
    .filter(
      ([key, value]) =>
        value !== undefined && !SENSITIVE_DETAIL_KEY.test(key),
    )
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${normalizeDetail(value)}`);
  const suffix = visibleDetails.length > 0 ? ` | ${visibleDetails.join(" ")}` : "";
  return `[${level}] [${module}] ${normalizeText(message)}${suffix}`;
}

export function writeLog(
  level: LogLevel,
  module: LogModule,
  message: string,
  details: LogDetails = {},
) {
  if (!shouldWrite(level)) {
    return;
  }

  const formatted = formatLogMessage(level, module, message, details);
  if (level === "ERROR") {
    console.error(formatted);
  } else if (level === "WARN") {
    console.warn(formatted);
  } else {
    console.info(formatted);
  }
}

export const logger = {
  info(module: LogModule, message: string, details?: LogDetails) {
    writeLog("INFO", module, message, details);
  },
  ok(module: LogModule, message: string, details?: LogDetails) {
    writeLog("OK", module, message, details);
  },
  warn(module: LogModule, message: string, details?: LogDetails) {
    writeLog("WARN", module, message, details);
  },
  error(module: LogModule, message: string, details?: LogDetails) {
    writeLog("ERROR", module, message, details);
  },
};
