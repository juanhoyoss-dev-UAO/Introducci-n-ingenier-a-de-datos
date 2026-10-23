import { beforeAll, describe, expect, it } from "vitest";

import {
  ADMIN_EMAIL,
  createPublicClient,
  integrationIsEnabled,
  recreateAuthorizationFixtures,
  TEST_PASSWORD,
  USER_EMAIL,
} from "../helpers/supabase";

describe.runIf(integrationIsEnabled())("RLS real", () => {
  beforeAll(async () => {
    await recreateAuthorizationFixtures();
  });

  it("T09 impide lectura anónima", async () => {
    const client = createPublicClient();
    const { data, error } = await client.from("snapshots").select("id");

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("T09 no entrega filas a un autenticado no autorizado", async () => {
    const client = createPublicClient();
    const { error: signInError } = await client.auth.signInWithPassword({
      email: USER_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(signInError).toBeNull();

    const { data, error } = await client.from("snapshots").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("T09 permite lectura al administrador autorizado", async () => {
    const client = createPublicClient();
    const { error: signInError } = await client.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(signInError).toBeNull();

    const { data, error } = await client.from("snapshots").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });
});

