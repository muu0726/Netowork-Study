import { describe, expect, it } from "vitest";
import {
  computeEtherChannelSummary,
  evaluateScenario,
  executeCommand,
  simulateIpv6Ping,
} from "./index";
import { cliEtherchannelLacpScenario } from "@/data/scenarios/cli-etherchannel-lacp";
import { cliIpv6BasicScenario } from "@/data/scenarios/cli-ipv6-basic";
import { tsPortSecurityErrdisableScenario } from "@/data/scenarios/ts-port-security-errdisable";

describe("Phase 9: EtherChannel, Port Security, and IPv6 engine", () => {
  it("bundles LACP active+passive EtherChannel links and rejects passive+passive", () => {
    let state = structuredClone(cliEtherchannelLacpScenario.initialState);
    const initialSummary = computeEtherChannelSummary(state, "sw1");
    expect(initialSummary).toHaveLength(0);

    // passive <-> passive should stay standalone (I) and SD
    for (const cmd of [
      "enable",
      "configure terminal",
      "interface Fa0/1",
      "channel-group 1 mode passive",
      "interface Fa0/2",
      "channel-group 1 mode passive",
      "end",
    ]) {
      state = executeCommand(state, "sw1", cmd).nextState;
    }
    const passiveSummary = computeEtherChannelSummary(state, "sw1");
    expect(passiveSummary[0]?.status).toBe("SD");
    expect(passiveSummary[0]?.members.every((m) => m.flag === "I")).toBe(true);

    // active <-> passive should bundle (P) and SU
    for (const cmd of [
      "configure terminal",
      "interface Fa0/1",
      "channel-group 1 mode active",
      "interface Fa0/2",
      "channel-group 1 mode active",
      "end",
    ]) {
      state = executeCommand(state, "sw1", cmd).nextState;
    }
    const activeSummary = computeEtherChannelSummary(state, "sw1");
    expect(activeSummary[0]?.status).toBe("SU");
    expect(activeSummary[0]?.members.every((m) => m.flag === "P")).toBe(true);
    expect(
      executeCommand(state, "sw1", "show etherchannel summary").output,
    ).toContain("Po1(SU)");
  });

  it("recovers err-disabled port-security interfaces after updating maximum and bouncing port", () => {
    let state = structuredClone(tsPortSecurityErrdisableScenario.initialState);
    expect(evaluateScenario(state, tsPortSecurityErrdisableScenario).passed).toBe(
      false,
    );
    expect(
      executeCommand(state, "sw-conf", "show port-security").output,
    ).toContain("err-disabled");

    for (const cmd of [
      "enable",
      "configure terminal",
      "interface Fa0/1",
      "switchport port-security maximum 2",
      "shutdown",
      "no shutdown",
      "end",
    ]) {
      state = executeCommand(state, "sw-conf", cmd).nextState;
    }

    expect(evaluateScenario(state, tsPortSecurityErrdisableScenario).passed).toBe(
      true,
    );
    expect(
      executeCommand(state, "sw-conf", "show port-security interface Fa0/1")
        .output,
    ).toContain("Secure-up");
  });

  it("routes IPv6 packets when ipv6 unicast-routing and interface addresses are configured", () => {
    let state = structuredClone(cliIpv6BasicScenario.initialState);
    expect(
      simulateIpv6Ping(state, "pc-v6-a", "2001:db8:20::10").trace.success,
    ).toBe(false);

    for (const cmd of [
      "enable",
      "configure terminal",
      "ipv6 unicast-routing",
      "interface Gig0/1",
      "ipv6 address 2001:db8:20::1/64",
      "no shutdown",
      "end",
    ]) {
      state = executeCommand(state, "r1-v6", cmd).nextState;
    }

    const pingRes = executeCommand(state, "pc-v6-a", "ping 2001:db8:20::10");
    expect(pingRes.trace?.success).toBe(true);
    expect(pingRes.output).toContain("Success rate is 100 percent");
    expect(
      executeCommand(state, "r1-v6", "show ipv6 interface brief").output,
    ).toContain("2001:db8:20::1/64");
  });
});
