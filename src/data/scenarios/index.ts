import type { ScenarioDefinition } from "@/lib/network-engine";
import { cliBasicRoutingScenario } from "./cli-basic-routing";
import { cliVlanRoasScenario } from "./cli-vlan-roas";
import { tsDnsFailureScenario } from "./ts-dns-failure";
import { tsRoutingAsymmetricScenario } from "./ts-routing-asymmetric";
import { tsVlanMismatchScenario } from "./ts-vlan-mismatch";

export const CLI_LAB_SCENARIOS: ScenarioDefinition[] = [
  cliBasicRoutingScenario,
  cliVlanRoasScenario,
];

export const TROUBLESHOOT_SCENARIOS: ScenarioDefinition[] = [
  tsVlanMismatchScenario,
  tsDnsFailureScenario,
  tsRoutingAsymmetricScenario,
];

export const ALL_SCENARIOS: ScenarioDefinition[] = [
  ...CLI_LAB_SCENARIOS,
  ...TROUBLESHOOT_SCENARIOS,
];

export function getScenarioById(id: string): ScenarioDefinition | undefined {
  return ALL_SCENARIOS.find((scenario) => scenario.id === id);
}
