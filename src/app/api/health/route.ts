import { successResponse } from "@/server/services/http";

export function GET() {
  return successResponse({ status: "ok" });
}

