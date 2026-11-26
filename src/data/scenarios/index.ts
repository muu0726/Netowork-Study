import type { ScenarioDefinition } from "@/lib/network-engine";
import { cliBasicRoutingScenario } from "./cli-basic-routing";
import { cliEtherchannelLacpScenario } from "./cli-etherchannel-lacp";
import { cliFirstStepsScenario } from "./cli-first-steps";
import { cliIpv6BasicScenario } from "./cli-ipv6-basic";
import { cliNatAclWebScenario } from "./cli-nat-acl-web";
import { cliOspfCostScenario } from "./cli-ospf-cost";
import { cliStpRootBridgeScenario } from "./cli-stp-root-bridge";
import { cliVlanRoasScenario } from "./cli-vlan-roas";
import { tsAclWebBlockedScenario } from "./ts-acl-web-blocked";
import { tsDhcpFailureScenario } from "./ts-dhcp-failure";
import { tsDnsFailureScenario } from "./ts-dns-failure";
import { tsHsrpFailoverBrokenScenario } from "./ts-hsrp-failover-broken";
import { tsLinuxNginxDownScenario } from "./ts-linux-nginx-down";
import { tsOspfNeighborDownScenario } from "./ts-ospf-neighbor-down";
import { tsPortSecurityErrdisableScenario } from "./ts-port-security-errdisable";
import { tsRoutingAsymmetricScenario } from "./ts-routing-asymmetric";
import { tsVlanMismatchScenario } from "./ts-vlan-mismatch";

export const CLI_LAB_SCENARIOS: ScenarioDefinition[] = [
  cliFirstStepsScenario,
  cliBasicRoutingScenario,
  cliVlanRoasScenario,
  cliNatAclWebScenario,
  cliOspfCostScenario,
  cliStpRootBridgeScenario,
  cliEtherchannelLacpScenario,
  cliIpv6BasicScenario,
];

export const TROUBLESHOOT_SCENARIOS: ScenarioDefinition[] = [
  tsVlanMismatchScenario,
  tsDnsFailureScenario,
  tsRoutingAsymmetricScenario,
  tsAclWebBlockedScenario,
  tsDhcpFailureScenario,
  tsOspfNeighborDownScenario,
  tsHsrpFailoverBrokenScenario,
  tsPortSecurityErrdisableScenario,
  tsLinuxNginxDownScenario,
];

export const ALL_SCENARIOS: ScenarioDefinition[] = [
  ...CLI_LAB_SCENARIOS,
  ...TROUBLESHOOT_SCENARIOS,
];

export function getScenarioById(id: string): ScenarioDefinition | undefined {
  return ALL_SCENARIOS.find((scenario) => scenario.id === id);
}
