import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

import {
  logger,
  type LogDetails,
  type LogLevel,
  type LogModule,
} from "@/lib/logger";

interface RequestLogContext {
  loggedSnapshotBundles: Set<string>;
  method: string;
  requestId: string;
  route: string;
  snapshot?: string;
}

const requestLogContext = new AsyncLocalStorage<RequestLogContext>();

export function runWithRequestContext<T>(
  request: Request,
  action: () => Promise<T>,
) {
  const url = new URL(request.url);
  return requestLogContext.run(
    {
      loggedSnapshotBundles: new Set<string>(),
      method: request.method,
      requestId: randomUUID(),
      route: url.pathname,
    },
    action,
  );
}

export function shouldLogSnapshotBundle(snapshot: string) {
  const context = requestLogContext.getStore();
  if (!context) {
    return true;
  }
  if (context.loggedSnapshotBundles.has(snapshot)) {
    return false;
  }
  context.loggedSnapshotBundles.add(snapshot);
  return true;
}

export function getRequestId() {
  return requestLogContext.getStore()?.requestId;
}

export function setRequestSnapshot(snapshot: string) {
  const context = requestLogContext.getStore();
  if (context) {
    context.snapshot = snapshot;
  }
}

export function serverLog(
  level: LogLevel,
  module: LogModule,
  message: string,
  details: LogDetails = {},
) {
  const context = requestLogContext.getStore();
  const contextDetails: LogDetails = context
    ? {
        method: context.method,
        requestId: context.requestId,
        route: context.route,
        ...(context.snapshot ? { snapshot: context.snapshot } : {}),
      }
    : {};

  logger[level.toLowerCase() as Lowercase<LogLevel>](
    module,
    message,
    { ...details, ...contextDetails },
  );
}
