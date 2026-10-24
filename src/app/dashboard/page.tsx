import { redirect } from "next/navigation";

import { requireAdministrator } from "@/server/auth/require-admin";
import { ApiError } from "@/server/services/errors";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

async function getAdministrator() {
  try {
    return await requireAdministrator();
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      redirect("/login");
    }
    throw error;
  }
}

export default async function DashboardPage() {
  const administrator = await getAdministrator();

  return (
    <DashboardClient
      initialUser={{
        username: administrator.username,
        role: administrator.role,
      }}
    />
  );
}
