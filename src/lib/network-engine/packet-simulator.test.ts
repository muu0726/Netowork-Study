import { describe, expect, it } from "vitest";
import { executeCommand } from "./cli-engine";
import {
  simulateNslookup,
  simulatePing,
  simulateTraceroute,
} from "./packet-simulator";
import type { NetworkState } from "./types";

function createRoutedLanAndWanTopology(): NetworkState {
  return {
    devices: {
      pc1: {
        id: "pc1",
        hostname: "PC1",
        type: "pc",
        position: { x: 60, y: 120 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:33:44:01",
            adminUp: true,
            ip: "192.168.10.10",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        defaultGateway: "192.168.10.1",
        dnsServer: "192.168.20.10",
        cliState: { mode: "host" },
      },
      sw1: {
        id: "sw1",
        hostname: "SW1",
        type: "switch",
        position: { x: 180, y: 120 },
        interfaces: {
          "Fa0/1": {
            name: "Fa0/1",
            mac: "00:aa:bb:cc:01:01",
            adminUp: true,
            switchportMode: "access",
            accessVlan: 10,
          },
          "Fa0/2": {
            name: "Fa0/2",
            mac: "00:aa:bb:cc:01:02",
            adminUp: true,
            switchportMode: "access",
            accessVlan: 10,
          },
          "Fa0/24": {
            name: "Fa0/24",
            mac: "00:aa:bb:cc:01:24",
            adminUp: true,
            switchportMode: "trunk",
            trunkAllowedVlans: [10, 20],
          },
        },
        vlans: {
          1: { id: 1, name: "default", active: true },
          10: { id: 10, name: "Sales", active: true },
          20: { id: 20, name: "Server", active: true },
        },
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        cliState: { mode: "user" },
      },
      r1: {
        id: "r1",
        hostname: "R1",
        type: "router",
        position: { x: 320, y: 120 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:00:01:00",
            adminUp: true,
          },
          "Gig0/0.10": {
            name: "Gig0/0.10",
            mac: "00:0c:29:00:01:00",
            adminUp: true,
            isSubinterface: true,
            parentInterface: "Gig0/0",
            dot1qVlan: 10,
            ip: "192.168.10.1",
            subnetMask: "255.255.255.0",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:00:01:01",
            adminUp: true,
            ip: "10.0.0.1",
            subnetMask: "255.255.255.252",
          },
        },
        vlans: {},
        staticRoutes: [
          {
            destination: "192.168.20.0",
            mask: "255.255.255.0",
            prefixLength: 24,
            nextHop: "10.0.0.2",
            adminDistance: 1,
          },
        ],
        arpTable: [],
        macTable: [],
        cliState: { mode: "user" },
      },
      r2: {
        id: "r2",
        hostname: "R2",
        type: "router",
        position: { x: 460, y: 120 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:00:02:00",
            adminUp: true,
            ip: "10.0.0.2",
            subnetMask: "255.255.255.252",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:00:02:01",
            adminUp: true,
            ip: "192.168.20.1",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [
          {
            destination: "192.168.10.0",
            mask: "255.255.255.0",
            prefixLength: 24,
            nextHop: "10.0.0.1",
            adminDistance: 1,
          },
        ],
        arpTable: [],
        macTable: [],
        cliState: { mode: "user" },
      },
      srv1: {
        id: "srv1",
        hostname: "DNS-WEB",
        type: "server",
        position: { x: 600, y: 120 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:50:56:00:20:10",
            adminUp: true,
            ip: "192.168.20.10",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        defaultGateway: "192.168.20.1",
        dnsRecords: {
          "intranet.local": "192.168.20.10",
        },
        cliState: { mode: "host" },
      },
      pc2: {
        id: "pc2",
        hostname: "PC2",
        type: "pc",
        position: { x: 180, y: 240 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:33:44:02",
            adminUp: true,
            ip: "192.168.10.20",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        defaultGateway: "192.168.10.1",
        cliState: { mode: "host" },
      },
    },
    links: [
      {
        id: "pc1-sw1",
        fromDeviceId: "pc1",
        fromInterface: "eth0",
        toDeviceId: "sw1",
        toInterface: "Fa0/1",
        up: true,
      },
      {
        id: "pc2-sw1",
        fromDeviceId: "pc2",
        fromInterface: "eth0",
        toDeviceId: "sw1",
        toInterface: "Fa0/2",
        up: true,
      },
      {
        id: "sw1-r1",
        fromDeviceId: "sw1",
        fromInterface: "Fa0/24",
        toDeviceId: "r1",
        toInterface: "Gig0/0",
        up: true,
      },
      {
        id: "r1-r2",
        fromDeviceId: "r1",
        fromInterface: "Gig0/1",
        toDeviceId: "r2",
        toInterface: "Gig0/0",
        up: true,
      },
      {
        id: "r2-srv1",
        fromDeviceId: "r2",
        fromInterface: "Gig0/1",
        toDeviceId: "srv1",
        toInterface: "eth0",
        up: true,
      },
    ],
  };
}

describe("packet-simulator", () => {
  it("forwards local L2/L3 traffic and learns MAC & ARP immutably", () => {
    const initial = createRoutedLanAndWanTopology();
    const res = simulatePing(initial, "pc1", "192.168.10.20");

    expect(res.trace.success).toBe(true);
    expect(res.trace.hops.some((h) => h.deviceId === "sw1" && h.vlanTag === 10)).toBe(true);

    // MAC and ARP learned on nextState without mutating initial
    expect(initial.devices.sw1.macTable).toHaveLength(0);
    expect(initial.devices.pc1.arpTable).toHaveLength(0);
    expect(res.nextState.devices.sw1.macTable.length).toBeGreaterThanOrEqual(2);
    expect(
      res.nextState.devices.pc1.arpTable.some((e) => e.ip === "192.168.10.20"),
    ).toBe(true);
  });

  it("supports Router-on-a-Stick 802.1Q + multi-router static routing + traceroute", () => {
    const initial = createRoutedLanAndWanTopology();

    const pingRes = simulatePing(initial, "pc1", "192.168.20.10");
    expect(pingRes.trace.success).toBe(true);
    expect(pingRes.trace.hops.some((h) => h.direction === "request")).toBe(true);
    expect(pingRes.trace.hops.some((h) => h.direction === "reply")).toBe(true);

    const traceRes = simulateTraceroute(initial, "pc1", "192.168.20.10");
    expect(traceRes.trace.success).toBe(true);
    expect(traceRes.output).toContain("R1");
    expect(traceRes.output).toContain("R2");
    expect(traceRes.output).toContain("DNS-WEB");
  });

  it("detects Link Down when an interface or cable is down", () => {
    const initial = createRoutedLanAndWanTopology();
    const r1Down = executeCommand(initial, "r1", "en");
    const r1Cfg = executeCommand(r1Down.nextState, "r1", "conf t");
    const r1If = executeCommand(r1Cfg.nextState, "r1", "int g0/1");
    const r1Shut = executeCommand(r1If.nextState, "r1", "shutdown");

    const pingRes = simulatePing(r1Shut.nextState, "pc1", "192.168.20.10");
    expect(pingRes.trace.success).toBe(false);
    expect(pingRes.trace.failureReason).toBe("Link Down");
  });

  it("detects VLAN Mismatch on access port mismatch and trunk allowed block", () => {
    const initial = createRoutedLanAndWanTopology();

    // Case 1: Access port VLAN mismatch between PC1 (VLAN 10) and PC2 (VLAN 20)
    const mismatchState: NetworkState = {
      ...initial,
      devices: {
        ...initial.devices,
        sw1: {
          ...initial.devices.sw1,
          interfaces: {
            ...initial.devices.sw1.interfaces,
            "Fa0/2": {
              ...initial.devices.sw1.interfaces["Fa0/2"],
              accessVlan: 20,
            },
          },
        },
      },
    };
    const accessFail = simulatePing(mismatchState, "pc1", "192.168.10.20");
    expect(accessFail.trace.success).toBe(false);
    expect(accessFail.trace.failureReason).toBe("VLAN Mismatch");

    // Case 2: Trunk allowed VLAN block for VLAN 10 on SW1 Fa0/24
    const trunkBlockedState: NetworkState = {
      ...initial,
      devices: {
        ...initial.devices,
        sw1: {
          ...initial.devices.sw1,
          interfaces: {
            ...initial.devices.sw1.interfaces,
            "Fa0/24": {
              ...initial.devices.sw1.interfaces["Fa0/24"],
              trunkAllowedVlans: [20],
            },
          },
        },
      },
    };
    const trunkFail = simulatePing(trunkBlockedState, "pc1", "192.168.20.10");
    expect(trunkFail.trace.success).toBe(false);
    expect(trunkFail.trace.failureReason).toBe("VLAN Mismatch");
  });

  it("detects missing return route (復路ルート欠落) even when forward path reaches destination", () => {
    const initial = createRoutedLanAndWanTopology();
    const brokenReturn: NetworkState = {
      ...initial,
      devices: {
        ...initial.devices,
        r2: {
          ...initial.devices.r2,
          staticRoutes: [],
        },
      },
    };

    const res = simulatePing(brokenReturn, "pc1", "192.168.20.10");
    expect(res.trace.success).toBe(false);
    expect(res.trace.failureReason).toBe("No Route to Host");
    expect(res.trace.failureDeviceId).toBe("r2");
    expect(
      res.trace.hops.some(
        (h) =>
          h.direction === "request" &&
          h.deviceId === "srv1" &&
          h.status === "ok",
      ),
    ).toBe(true);
    expect(
      res.trace.hops.some(
        (h) =>
          h.direction === "reply" &&
          h.deviceId === "r2" &&
          h.status === "error" &&
          h.errorReason === "No Route to Host",
      ),
    ).toBe(true);
  });

  it("detects routing loop with TTL Exceeded", () => {
    const initial = createRoutedLanAndWanTopology();
    const looping: NetworkState = {
      ...initial,
      devices: {
        ...initial.devices,
        r1: {
          ...initial.devices.r1,
          staticRoutes: [
            {
              destination: "172.16.99.0",
              mask: "255.255.255.0",
              prefixLength: 24,
              nextHop: "10.0.0.2",
              adminDistance: 1,
            },
          ],
        },
        r2: {
          ...initial.devices.r2,
          staticRoutes: [
            {
              destination: "172.16.99.0",
              mask: "255.255.255.0",
              prefixLength: 24,
              nextHop: "10.0.0.1",
              adminDistance: 1,
            },
          ],
        },
      },
    };

    const res = simulatePing(looping, "pc1", "172.16.99.10");
    expect(res.trace.success).toBe(false);
    expect(res.trace.failureReason).toBe("TTL Exceeded");
  });

  it("detects ARP Timeout for nonexistent local host IP", () => {
    const initial = createRoutedLanAndWanTopology();
    const res = simulatePing(initial, "pc1", "192.168.10.200");
    expect(res.trace.success).toBe(false);
    expect(res.trace.failureReason).toBe("ARP Timeout");
  });

  it("simulates DNS nslookup and hostname ping success, unreachable DNS, and NXDOMAIN", () => {
    const initial = createRoutedLanAndWanTopology();

    const lookupOk = simulateNslookup(initial, "pc1", "intranet.local");
    expect(lookupOk.trace.success).toBe(true);
    expect(lookupOk.trace.resolvedIp).toBe("192.168.20.10");

    const hostPingOk = simulatePing(initial, "pc1", "intranet.local");
    expect(hostPingOk.trace.success).toBe(true);
    expect(hostPingOk.trace.resolvedIp).toBe("192.168.20.10");

    const nx = simulateNslookup(initial, "pc1", "unknown.local");
    expect(nx.trace.success).toBe(false);
    expect(nx.trace.failureReason).toBe("NXDOMAIN");

    const badDnsState: NetworkState = {
      ...initial,
      devices: {
        ...initial.devices,
        pc1: {
          ...initial.devices.pc1,
          dnsServer: "192.168.99.99",
        },
      },
    };
    const unreachableDns = simulatePing(badDnsState, "pc1", "intranet.local");
    expect(unreachableDns.trace.success).toBe(false);
    expect(unreachableDns.trace.failureReason).toBe("DNS Server Unreachable");
  });
});
