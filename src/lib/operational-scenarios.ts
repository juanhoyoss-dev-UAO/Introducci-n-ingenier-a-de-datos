export const WEEKLY_MAIN_SCENARIO_ID =
  "65000000-0000-4000-8000-000000000001";
export const WEEKLY_MAIN_SNAPSHOT_ID =
  "65000000-0000-4000-8000-000000000003";
export const WEEKLY_TESTING_SCENARIO_ID =
  "a3000000-0000-4000-8000-000000000001";
export const WEEKLY_TESTING_BASE_SNAPSHOT_ID =
  "a3000000-0000-4000-8000-000000000002";

export const WEEKLY_MAIN_LABEL = "Emergencia semanal — MAIN";
export const WEEKLY_TESTING_LABEL = "Emergencia semanal — PRUEBAS";

export function isWeeklyMainScenario(input: {
  id: string;
  escenario_id?: string;
}) {
  return (
    input.id === WEEKLY_MAIN_SNAPSHOT_ID ||
    input.escenario_id === WEEKLY_MAIN_SCENARIO_ID
  );
}

export function isWeeklyTestingScenario(input: {
  escenario_id?: string;
}) {
  return input.escenario_id === WEEKLY_TESTING_SCENARIO_ID;
}
