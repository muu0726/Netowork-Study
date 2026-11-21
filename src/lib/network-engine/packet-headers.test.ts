import { describe, expect, it } from "vitest";
import { cliBasicRoutingScenario } from "@/data/scenarios/cli-basic-routing";
import { cliNatAclWebScenario } from "@/data/scenarios/cli-nat-acl-web";
import { cliVlanRoasScenario } from "@/data/scenarios/cli-vlan-roas";
import {
  executeCommand,
  inspectTraceHopHeaders,
  simulatePing,
  type NetworkState,
  type ScenarioDefinition,
} from "./index";

function solveScenario(scenario: ScenarioDefinition): NetworkState {
  let state = structuredClone(scenario.initialState);
  for (const sol of scenario.solutionCommands) {
    for (const cmd of sol.commands) {
      state = executeCommand(state, sol.deviceId, cmd).nextState;
    }
  }
  return state;
}

describe("Network Engine Per-Hop Packet Header Dissector", () => {
  it("tracks L2 MAC rewrites and TTL decrements across L3 routers while keeping L3 IPs stable", () => {
    const solved = solveScenario(cliBasicRoutingScenario);
    const pingRes = simulatePing(solved, "pc-tokyo", "192.168.20.10");
    expect(pingRes.trace.success).toBe(true);

    const inspected = inspectTraceHopHeaders(pingRes.nextState, pingRes.trace);
    expect(inspected.length).toBeGreaterThanOrEqual(4);

    // First hop (PC-Tokyo originating request)
    expect(inspected[0].headers.l3.srcIp).toBe("192.168.10.10");
    expect(inspected[0].headers.l3.dstIp).toBe("192.168.20.10");
    expect(inspected[0].headers.l3.ttl).toBe(16);

    // R1-Tokyo forwarding hop: rewrites L2 MACs and decrements TTL, keeps L3 src/dst IP
    const r1RequestHop = inspected.find(
      (h) => h.hop.deviceId === "r1" && h.hop.direction === "request",
    );
    expect(r1RequestHop).toBeDefined();
    expect(r1RequestHop?.headers.l3.ttl).toBe(15);
    expect(r1RequestHop?.headers.l3.srcIp).toBe("192.168.10.10");
    expect(r1RequestHop?.headers.l3.dstIp).toBe("192.168.20.10");
    expect(r1RequestHop?.changedFields).toEqual(
      expect.arrayContaining(["srcMac", "dstMac", "ttl"]),
    );

    // Reply phase reverses srcIp and dstIp
    const replyStart = inspected.find((h) => h.hop.direction === "reply");
    expect(replyStart?.headers.l3.srcIp).toBe("192.168.20.10");
    expect(replyStart?.headers.l3.dstIp).toBe("192.168.10.10");
  });

  it("captures NAPT inside-to-outside and outside-to-inside IP/port translations per hop", () => {
    const solved = solveScenario(cliNatAclWebScenario);
    const curlOut = executeCommand(
      solved,
      "pc-lan",
      "curl http://203.0.113.10",
    );
    expect(curlOut.trace?.success).toBe(true);
    if (!curlOut.trace) {
      return;
    }

    const inspected = inspectTraceHopHeaders(curlOut.nextState, curlOut.trace);
    const natOutHop = inspected.find(
      (h) =>
        h.hop.direction === "request" &&
        h.hop.natTranslation?.direction === "inside-to-outside",
    );
    expect(natOutHop).toBeDefined();
    expect(natOutHop?.headers.l3.srcIp).toBe("203.0.113.1");
    expect(natOutHop?.changedFields).toContain("srcIp");

    const natInHop = inspected.find(
      (h) =>
        h.hop.direction === "reply" &&
        h.hop.natTranslation?.direction === "outside-to-inside",
    );
    expect(natInHop).toBeDefined();
    expect(natInHop?.headers.l3.dstIp).toBe("192.168.10.10");
    expect(natInHop?.changedFields).toContain("dstIp");

    // Simulate port collision on NAPT overload so source port must be rewritten too
    const withCollision: NetworkState = {
      ...solved,
      devices: {
        ...solved.devices,
        "r1-edge": {
          ...solved.devices["r1-edge"],
          natTranslations: [
            {
              protocol: "tcp",
              insideLocalIp: "192.168.10.99",
              insideLocalPort: 51080,
              insideGlobalIp: "203.0.113.1",
              insideGlobalPort: 51080,
              outsideLocalIp: "203.0.113.10",
              outsideLocalPort: 80,
              outsideGlobalIp: "203.0.113.10",
              outsideGlobalPort: 80,
            },
          ],
        },
      },
    };
    const collidedCurl = executeCommand(
      withCollision,
      "pc-lan",
      "curl http://203.0.113.10",
    );
    expect(collidedCurl.trace?.success).toBe(true);
    if (collidedCurl.trace) {
      const inspectedCollided = inspectTraceHopHeaders(
        collidedCurl.nextState,
        collidedCurl.trace,
      );
      const natPortRewriteHop = inspectedCollided.find(
        (h) =>
          h.hop.direction === "request" &&
          h.hop.natTranslation?.direction === "inside-to-outside",
      );
      expect(natPortRewriteHop?.changedFields).toContain("srcIp");
      expect(natPortRewriteHop?.changedFields).toContain("srcPort");
      expect(natPortRewriteHop?.headers.l4.srcPort).toBe(51081);
    }
  });

  it("preserves L2 MAC addresses and shows 802.1Q VLAN tagging through L2 switches", () => {
    const solved = solveScenario(cliVlanRoasScenario);
    const pingRes = simulatePing(solved, "pc-sales", "192.168.20.10");
    expect(pingRes.trace.success).toBe(true);

    const inspected = inspectTraceHopHeaders(pingRes.nextState, pingRes.trace);
    const firstSwitchHopIdx = inspected.findIndex(
      (h) => h.hop.deviceId === "sw1" && h.hop.direction === "request",
    );
    expect(firstSwitchHopIdx).toBeGreaterThan(0);

    const beforeSw = inspected[firstSwitchHopIdx - 1];
    const atSw = inspected[firstSwitchHopIdx];
    expect(atSw.headers.l2.srcMac).toBe(beforeSw.headers.l2.srcMac);
    expect(atSw.headers.l2.dstMac).toBe(beforeSw.headers.l2.dstMac);
    expect(atSw.headers.l2.vlanTag).toContain("802.1Q VLAN 10");
    expect(atSw.changedFields).not.toContain("srcMac");
    expect(atSw.changedFields).not.toContain("dstMac");
  });
});
