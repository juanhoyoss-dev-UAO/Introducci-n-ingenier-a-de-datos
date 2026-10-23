import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const ADMIN_EMAIL = "admin@redes-ayuda.local";
export const USER_EMAIL = "usuario@redes-ayuda.local";
export const TEST_PASSWORD = "RedesAyuda-Local-2026!";

interface TestConfig {
  url: string;
  publishableKey: string;
  serviceRoleKey: string;
}

export function integrationIsEnabled() {
  return process.env.RUN_SUPABASE_INTEGRATION === "true";
}

export function getTestConfig(): TestConfig {
  const url = process.env.SUPABASE_TEST_URL;
  const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

  if (!url || !publishableKey || !serviceRoleKey) {
    throw new Error("Faltan variables del entorno local de pruebas Supabase.");
  }

  const hostname = new URL(url).hostname;
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error("Las pruebas con service role solo se permiten contra Supabase local.");
  }

  return { url, publishableKey, serviceRoleKey };
}

export function createServiceRoleClient() {
  const { url, serviceRoleKey } = getTestConfig();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createPublicClient() {
  const { url, publishableKey } = getTestConfig();
  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function recreateAuthorizationFixtures() {
  const serviceClient = createServiceRoleClient();
  const { data: existingUsers, error: listError } =
    await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    throw listError;
  }

  for (const user of existingUsers.users) {
    if (user.email === ADMIN_EMAIL || user.email === USER_EMAIL) {
      const { error } = await serviceClient.auth.admin.deleteUser(user.id);
      if (error) {
        throw error;
      }
    }
  }

  const { data: adminData, error: adminError } =
    await serviceClient.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
  if (adminError || !adminData.user) {
    throw adminError ?? new Error("No se creó el administrador de prueba.");
  }

  const { data: userData, error: userError } =
    await serviceClient.auth.admin.createUser({
      email: USER_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
  if (userError || !userData.user) {
    throw userError ?? new Error("No se creó el usuario de prueba.");
  }

  const { error: authorizationError } = await serviceClient
    .from("administradores")
    .insert({ user_id: adminData.user.id });
  if (authorizationError) {
    throw authorizationError;
  }

  return {
    administratorId: adminData.user.id,
    regularUserId: userData.user.id,
  };
}

export async function createSessionCookieHeader(
  email: string,
  password: string,
) {
  const { url, publishableKey } = getTestConfig();
  const cookieJar = new Map<string, string>();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return [...cookieJar].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          cookieJar.set(cookie.name, cookie.value);
        }
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }

  return [...cookieJar]
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}

