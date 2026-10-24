import { successResponse, withHttpRequest } from "@/server/services/http";

export function GET(request: Request) {
  return withHttpRequest(request, "API", async () =>
    successResponse({ status: "ok" }),
  );
}

