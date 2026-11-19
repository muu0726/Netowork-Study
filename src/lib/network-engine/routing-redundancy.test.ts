import { describe, expect, it } from "vitest";
import { executeCommand } from "./cli-engine";
import { simulatePing } from "./packet-simulator";
import {
  computeHsrpTable,
  computeOspfNeighbors,
  computeOspfRoutes,
  computeStpForVlan,
  getTopologyStpBlockingLinks,
} from "./routing-redundancy";
import type { NetworkState } from "./types";

function runCommands(
  initialState: NetworkState,
  deviceId: string,
  commands: string[],
): { state: NetworkState; outputs: string[] } {
  let state = initialState;
  const outputs: string[] = [];
  for (const cmd of commands) {
    const res = executeCommand(state, deviceId, cmd);
    state = res.nextState;
    outputs.push(res.output);
  }
  return { state, outputs };
}

function createOspfTriangleState(): NetworkState {
  return {
    devices: {
      "pc-a": {
        id: "pc-a",
        hostname: "PC-A",
        type: "pc",
        position: { x: 80, y: 180 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:01:10:10",
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
        cliState: { mode: "host" },
      },
      r1: {
        id: "r1",
        hostname: "R1",
        type: "router",
        position: { x: 220, y: 180 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:01:01:00",
            adminUp: true,
            ip: "192.168.10.1",
            subnetMask: "255.255.255.0",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:01:01:01",
            adminUp: true,
            ip: "10.0.12.1",
            subnetMask: "255.255.255.252",
          },
          "Gig0/2": {
            name: "Gig0/2",
            mac: "00:0c:29:01:01:02",
            adminUp: true,
            ip: "10.0.13.1",
            subnetMask: "255.255.255.252",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        cliState: { mode: "user" },
      },
      r2: {
        id: "r2",
        hostname: "R2",
        type: "router",
        position: { x: 360, y: 90 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:01:02:00",
            adminUp: true,
            ip: "10.0.12.2",
            subnetMask: "255.255.255.252",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:01:02:01",
            adminUp: true,
            ip: "10.0.23.1",
            subnetMask: "255.255.255.252",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        ospf: {
          processId: 1,
          routerId: "2.2.2.2",
          networks: [
            { network: "10.0.12.0", wildcard: "0.0.0.3", area: 0 },
            { network: "10.0.23.0", wildcard: "0.0.0.3", area: 0 },
          ],
        },
        cliState: { mode: "user" },
      },
      r3: {
        id: "r3",
        hostname: "R3",
        type: "router",
        position: { x: 460, y: 240 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:01:03:00",
            adminUp: true,
            ip: "10.0.13.2",
            subnetMask: "255.255.255.252",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:01:03:01",
            adminUp: true,
            ip: "10.0.23.2",
            subnetMask: "255.255.255.252",
          },
          "Gig0/2": {
            name: "Gig0/2",
            mac: "00:0c:29:01:03:02",
            adminUp: true,
            ip: "192.168.30.1",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        ospf: {
          processId: 1,
          routerId: "3.3.3.3",
          networks: [
            { network: "10.0.13.0", wildcard: "0.0.0.3", area: 0 },
            { network: "10.0.23.0", wildcard: "0.0.0.3", area: 0 },
            { network: "192.168.30.0", wildcard: "0.0.0.255", area: 0 },
          ],
        },
        cliState: { mode: "user" },
      },
      "srv-b": {
        id: "srv-b",
        hostname: "SRV-B",
        type: "server",
        position: { x: 600, y: 240 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:50:56:01:30:10",
            adminUp: true,
            ip: "192.168.30.10",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        defaultGateway: "192.168.30.1",
        cliState: { mode: "host" },
      },
    },
    links: [
      { id: "l-pc", fromDeviceId: "pc-a", fromInterface: "eth0", toDeviceId: "r1", toInterface: "Gig0/0", up: true },
      { id: "l-12", fromDeviceId: "r1", fromInterface: "Gig0/1", toDeviceId: "r2", toInterface: "Gig0/0", up: true },
      { id: "l-13", fromDeviceId: "r1", fromInterface: "Gig0/2", toDeviceId: "r3", toInterface: "Gig0/0", up: true },
      { id: "l-23", fromDeviceId: "r2", fromInterface: "Gig0/1", toDeviceId: "r3", toInterface: "Gig0/1", up: true },
      { id: "l-srv", fromDeviceId: "r3", fromInterface: "Gig0/2", toDeviceId: "srv-b", toInterface: "eth0", up: true },
    ],
  };
}

describe("Phase 6: OSPF single-area & Dijkstra convergence", () => {
  it("establishes FULL neighbors only on matching area/subnet/up links and reroutes dynamically on cost changes", () => {
    const base = createOspfTriangleState();

    // Area mismatch on R1 (area 1 on R1-R2) prevents R1-R2 adjacency
    const areaMismatch = runCommands(base, "r1", [
      "enable",
      "conf t",
      "router ospf 1",
      "router-id 1.1.1.1",
      "network 192.168.10.0 0.0.0.255 area 0",
      "network 10.0.12.0 0.0.0.3 area 1",
      "network 10.0.13.0 0.0.0.3 area 0",
      "end",
    ]).state;

    const nbrsMismatch = computeOspfNeighbors(areaMismatch, "r1");
    expect(nbrsMismatch.map((n) => n.neighborRouterId)).toEqual(["3.3.3.3"]);

    // Fix Area 0 on 10.0.12.0 -> both neighbors FULL, prefers direct R1->R3 (metric 2 < 3)
    const converged = runCommands(areaMismatch, "r1", [
      "conf t",
      "router ospf 1",
      "no network 10.0.12.0 0.0.0.3 area 1",
      "network 10.0.12.0 0.0.0.3 area 0",
      "end",
    ]).state;

    const nbrsAll = computeOspfNeighbors(converged, "r1");
    expect(nbrsAll.map((n) => n.neighborRouterId).sort()).toEqual(["2.2.2.2", "3.3.3.3"]);

    const routesBeforeCost = computeOspfRoutes(converged, "r1");
    const targetBefore = routesBeforeCost.find((r) => r.destination === "192.168.30.0");
    expect(targetBefore?.nextHop).toBe("10.0.13.2");
    expect(targetBefore?.metric).toBe(2);

    // Raise cost on R1 Gig0/2 -> Dijkstra selects R1->R2->R3 (10.0.12.2, metric 3)
    const rerouted = runCommands(converged, "r1", [
      "conf t",
      "int Gig0/2",
      "ip ospf cost 50",
      "end",
    ]).state;

    const routesAfterCost = computeOspfRoutes(rerouted, "r1");
    const targetAfter = routesAfterCost.find((r) => r.destination === "192.168.30.0");
    expect(targetAfter?.nextHop).toBe("10.0.12.2");
    expect(targetAfter?.interfaceName).toBe("Gig0/1");
    expect(targetAfter?.metric).toBe(3);

    const showNbr = executeCommand(rerouted, "r1", "show ip ospf neighbor");
    expect(showNbr.output).toContain("2.2.2.2");
    expect(showNbr.output).toContain("3.3.3.3");

    const showRoute = executeCommand(rerouted, "r1", "show ip route");
    expect(showRoute.output).toContain("O    192.168.30.0/24 [110/3] via 10.0.12.2, Gig0/1");

    const pingRes = simulatePing(rerouted, "pc-a", "192.168.30.10");
    expect(pingRes.trace.success).toBe(true);
    expect(pingRes.trace.hops.some((h) => h.deviceId === "r2")).toBe(true);

    // Cleanup via no router ospf 1 removes learned OSPF routes
    const removed = runCommands(rerouted, "r1", [
      "conf t",
      "no router ospf 1",
      "end",
    ]).state;
    expect(computeOspfNeighbors(removed, "r1")).toHaveLength(0);
    expect(computeOspfRoutes(removed, "r1")).toHaveLength(0);
  });
});

describe("Phase 6: STP root bridge election & loop prevention (BLK)", () => {
  function createStpTriangleState(): NetworkState {
    return {
      devices: {
        "pc-1": {
          id: "pc-1",
          hostname: "PC-1",
          type: "pc",
          position: { x: 80, y: 120 },
          interfaces: {
            eth0: { name: "eth0", mac: "00:11:22:10:00:10", adminUp: true, ip: "192.168.10.10", subnetMask: "255.255.255.0" },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          cliState: { mode: "host" },
        },
        sw1: {
          id: "sw1",
          hostname: "SW1",
          type: "switch",
          position: { x: 220, y: 120 },
          stpBaseMac: "00:0c:29:00:00:03",
          interfaces: {
            "Fa0/1": { name: "Fa0/1", mac: "00:0c:29:03:00:01", adminUp: true, switchportMode: "trunk" },
            "Fa0/2": { name: "Fa0/2", mac: "00:0c:29:03:00:02", adminUp: true, switchportMode: "trunk" },
            "Fa0/3": { name: "Fa0/3", mac: "00:0c:29:03:00:03", adminUp: true, switchportMode: "access", accessVlan: 1 },
          },
          vlans: { 1: { id: 1, name: "default", active: true } },
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          cliState: { mode: "user" },
        },
        sw2: {
          id: "sw2",
          hostname: "SW2",
          type: "switch",
          position: { x: 220, y: 270 },
          stpBaseMac: "00:0c:29:00:00:02",
          interfaces: {
            "Fa0/1": { name: "Fa0/1", mac: "00:0c:29:02:00:01", adminUp: true, switchportMode: "trunk" },
            "Fa0/2": { name: "Fa0/2", mac: "00:0c:29:02:00:02", adminUp: true, switchportMode: "trunk" },
          },
          vlans: { 1: { id: 1, name: "default", active: true } },
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          cliState: { mode: "user" },
        },
        sw3: {
          id: "sw3",
          hostname: "SW3",
          type: "switch",
          position: { x: 420, y: 195 },
          stpBaseMac: "00:0c:29:00:00:01",
          interfaces: {
            "Fa0/1": { name: "Fa0/1", mac: "00:0c:29:01:00:01", adminUp: true, switchportMode: "trunk" },
            "Fa0/2": { name: "Fa0/2", mac: "00:0c:29:01:00:02", adminUp: true, switchportMode: "trunk" },
            "Fa0/3": { name: "Fa0/3", mac: "00:0c:29:01:00:03", adminUp: true, switchportMode: "access", accessVlan: 1 },
          },
          vlans: { 1: { id: 1, name: "default", active: true } },
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          cliState: { mode: "user" },
        },
        "pc-2": {
          id: "pc-2",
          hostname: "PC-2",
          type: "pc",
          position: { x: 580, y: 195 },
          interfaces: {
            eth0: { name: "eth0", mac: "00:11:22:10:00:20", adminUp: true, ip: "192.168.10.20", subnetMask: "255.255.255.0" },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          cliState: { mode: "host" },
        },
      },
      links: [
        { id: "l-p1", fromDeviceId: "pc-1", fromInterface: "eth0", toDeviceId: "sw1", toInterface: "Fa0/3", up: true },
        { id: "l-12", fromDeviceId: "sw1", fromInterface: "Fa0/1", toDeviceId: "sw2", toInterface: "Fa0/1", up: true },
        { id: "l-13", fromDeviceId: "sw1", fromInterface: "Fa0/2", toDeviceId: "sw3", toInterface: "Fa0/1", up: true },
        { id: "l-23", fromDeviceId: "sw2", fromInterface: "Fa0/2", toDeviceId: "sw3", toInterface: "Fa0/2", up: true },
        { id: "l-p2", fromDeviceId: "sw3", fromInterface: "Fa0/3", toDeviceId: "pc-2", toInterface: "eth0", up: true },
      ],
    };
  }

  it("elects Root Bridge by priority+MAC, computes Altn/BLK ports, shifts BLK on priority change, and recovers on link shutdown", () => {
    const base = createStpTriangleState();

    // Initially sw3 has lowest MAC -> sw3 is Root, sw1 Fa0/1 is BLK on link sw1-sw2
    const initStp = computeStpForVlan(base, 1);
    expect(initStp.sw3.isRoot).toBe(true);
    expect(initStp.sw1.isRoot).toBe(false);
    expect(initStp.sw1.ports.find((p) => p.interfaceName === "Fa0/1")).toMatchObject({
      role: "Altn",
      state: "BLK",
    });
    expect(getTopologyStpBlockingLinks(base)["l-12"]).toMatchObject({
      switchId: "sw1",
      portName: "Fa0/1",
    });

    // Reject non-4096 multiple priority
    const badPrio = runCommands(base, "sw1", [
      "enable",
      "conf t",
      "spanning-tree vlan 1 priority 5000",
    ]);
    expect(badPrio.outputs[2]).toContain("4096");

    // Set priority 4096 on SW1 -> SW1 becomes Root, SW2 Fa0/2 becomes BLK on l-23
    const sw1RootState = runCommands(base, "sw1", [
      "enable",
      "conf t",
      "spanning-tree vlan 1 priority 4096",
      "end",
    ]).state;

    const newStp = computeStpForVlan(sw1RootState, 1);
    expect(newStp.sw1.isRoot).toBe(true);
    expect(newStp.sw3.isRoot).toBe(false);
    expect(newStp.sw2.ports.find((p) => p.interfaceName === "Fa0/2")).toMatchObject({
      role: "Altn",
      state: "BLK",
    });
    expect(getTopologyStpBlockingLinks(sw1RootState)["l-23"]).toMatchObject({
      switchId: "sw2",
      portName: "Fa0/2",
    });

    const showStp = executeCommand(sw1RootState, "sw2", "show spanning-tree");
    expect(showStp.output).toContain("Altn BLK");

    // L2 ping works without loops even with redundant ring
    expect(simulatePing(sw1RootState, "pc-1", "192.168.10.20").trace.success).toBe(true);

    // Shutdown direct link sw1 Fa0/2 <-> sw3 Fa0/1 -> STP unblocks sw2 Fa0/2 so ping still succeeds via SW1->SW2->SW3!
    const afterLinkDown = runCommands(sw1RootState, "sw1", [
      "conf t",
      "int Fa0/2",
      "shutdown",
      "end",
    ]).state;
    expect(Object.keys(getTopologyStpBlockingLinks(afterLinkDown))).toHaveLength(0);
    expect(simulatePing(afterLinkDown, "pc-1", "192.168.10.20").trace.success).toBe(true);
  });
});

describe("Phase 6: HSRP Active/Standby election, failover & preempt", () => {
  function createHsrpState(): NetworkState {
    return {
      devices: {
        pc: {
          id: "pc",
          hostname: "PC",
          type: "pc",
          position: { x: 80, y: 180 },
          interfaces: {
            eth0: { name: "eth0", mac: "00:11:22:30:00:10", adminUp: true, ip: "192.168.10.10", subnetMask: "255.255.255.0" },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          defaultGateway: "192.168.10.254",
          cliState: { mode: "host" },
        },
        sw1: {
          id: "sw1",
          hostname: "SW1",
          type: "switch",
          position: { x: 210, y: 180 },
          interfaces: {
            "Fa0/1": { name: "Fa0/1", mac: "00:0c:29:30:00:01", adminUp: true, switchportMode: "access", accessVlan: 1 },
            "Fa0/2": { name: "Fa0/2", mac: "00:0c:29:30:00:02", adminUp: true, switchportMode: "access", accessVlan: 1 },
            "Fa0/3": { name: "Fa0/3", mac: "00:0c:29:30:00:03", adminUp: true, switchportMode: "access", accessVlan: 1 },
          },
          vlans: { 1: { id: 1, name: "default", active: true } },
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          cliState: { mode: "user" },
        },
        r1: {
          id: "r1",
          hostname: "R1",
          type: "router",
          position: { x: 350, y: 110 },
          interfaces: {
            "Gig0/0": { name: "Gig0/0", mac: "00:0c:29:30:01:00", adminUp: true, ip: "192.168.10.2", subnetMask: "255.255.255.0" },
            "Gig0/1": { name: "Gig0/1", mac: "00:0c:29:30:01:01", adminUp: true, ip: "10.0.13.1", subnetMask: "255.255.255.252" },
          },
          vlans: {},
          staticRoutes: [{ destination: "172.16.10.0", mask: "255.255.255.0", prefixLength: 24, nextHop: "10.0.13.2", adminDistance: 1 }],
          arpTable: [],
          macTable: [],
          cliState: { mode: "user" },
        },
        r2: {
          id: "r2",
          hostname: "R2",
          type: "router",
          position: { x: 350, y: 250 },
          interfaces: {
            "Gig0/0": { name: "Gig0/0", mac: "00:0c:29:30:02:00", adminUp: true, ip: "192.168.10.3", subnetMask: "255.255.255.0" },
            "Gig0/1": { name: "Gig0/1", mac: "00:0c:29:30:02:01", adminUp: true, ip: "10.0.23.1", subnetMask: "255.255.255.252" },
          },
          vlans: {},
          staticRoutes: [{ destination: "172.16.10.0", mask: "255.255.255.0", prefixLength: 24, nextHop: "10.0.23.2", adminDistance: 1 }],
          arpTable: [],
          macTable: [],
          cliState: { mode: "user" },
        },
        srv: {
          id: "srv",
          hostname: "SRV-GW-Peer",
          type: "router",
          position: { x: 520, y: 180 },
          interfaces: {
            "Gig0/0": { name: "Gig0/0", mac: "00:0c:29:30:03:00", adminUp: true, ip: "10.0.13.2", subnetMask: "255.255.255.252" },
            "Gig0/1": { name: "Gig0/1", mac: "00:0c:29:30:03:01", adminUp: true, ip: "10.0.23.2", subnetMask: "255.255.255.252" },
            "Lo0": { name: "Loopback0", mac: "00:0c:29:30:03:ff", adminUp: true, ip: "172.16.10.1", subnetMask: "255.255.255.0" },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          ospf: {
            processId: 1,
            routerId: "3.3.3.3",
            networks: [
              { network: "10.0.13.0", wildcard: "0.0.0.3", area: 0 },
              { network: "10.0.23.0", wildcard: "0.0.0.3", area: 0 },
              { network: "172.16.10.0", wildcard: "0.0.0.255", area: 0 },
            ],
          },
          cliState: { mode: "user" },
        },
      },
      links: [
        { id: "l-pc", fromDeviceId: "pc", fromInterface: "eth0", toDeviceId: "sw1", toInterface: "Fa0/1", up: true },
        { id: "l-r1", fromDeviceId: "sw1", fromInterface: "Fa0/2", toDeviceId: "r1", toInterface: "Gig0/0", up: true },
        { id: "l-r2", fromDeviceId: "sw1", fromInterface: "Fa0/3", toDeviceId: "r2", toInterface: "Gig0/0", up: true },
        { id: "l-13", fromDeviceId: "r1", fromInterface: "Gig0/1", toDeviceId: "srv", toInterface: "Gig0/0", up: true },
        { id: "l-23", fromDeviceId: "r2", fromInterface: "Gig0/1", toDeviceId: "srv", toInterface: "Gig0/1", up: true },
      ],
    };
  }

  it("handles priority election, Active shutdown failover, and preemptive/non-preemptive recovery", () => {
    const base = createHsrpState();
    // Enable OSPF on R1 & R2 so SRV always learns active return path to 192.168.10.0/24
    let state = runCommands(base, "r1", [
      "enable",
      "conf t",
      "router ospf 1",
      "network 192.168.10.0 0.0.0.255 area 0",
      "network 10.0.13.0 0.0.0.3 area 0",
      "exit",
      "int Gig0/0",
      "standby 10 ip 192.168.10.254",
      "standby 10 priority 110",
      "end",
    ]).state;

    state = runCommands(state, "r2", [
      "enable",
      "conf t",
      "router ospf 1",
      "network 192.168.10.0 0.0.0.255 area 0",
      "network 10.0.23.0 0.0.0.3 area 0",
      "exit",
      "int Gig0/0",
      "standby 10 ip 192.168.10.254",
      "standby 10 priority 100",
      "end",
    ]).state;

    const tableInit = computeHsrpTable(state);
    expect(tableInit.find((e) => e.deviceId === "r1")?.state).toBe("Active");
    expect(tableInit.find((e) => e.deviceId === "r2")?.state).toBe("Standby");

    const showR1 = executeCommand(state, "r1", "show standby brief");
    expect(showR1.output).toContain("Active");
    expect(showR1.output).toContain("192.168.10.254");

    // Ping VIP directly + remote target through VIP passes via R1
    expect(simulatePing(state, "pc", "192.168.10.254").trace.success).toBe(true);
    const viaR1 = simulatePing(state, "pc", "172.16.10.1");
    expect(viaR1.trace.success).toBe(true);
    expect(viaR1.trace.hops.some((h) => h.deviceId === "r1")).toBe(true);

    // Shutdown R1 Gig0/0 -> R2 promotes to Active, ping to remote continues seamlessly via R2!
    const failedOver = runCommands(state, "r1", [
      "conf t",
      "int Gig0/0",
      "shutdown",
      "end",
    ]).state;

    const tableDown = computeHsrpTable(failedOver);
    expect(tableDown.find((e) => e.deviceId === "r1")?.state).toBe("Init");
    expect(tableDown.find((e) => e.deviceId === "r2")?.state).toBe("Active");

    const viaR2 = simulatePing(failedOver, "pc", "172.16.10.1");
    expect(viaR2.trace.success).toBe(true);
    expect(viaR2.trace.hops.some((h) => h.deviceId === "r2")).toBe(true);

    // Bring R1 Gig0/0 back UP WITHOUT preempt -> R2 remains incumbent Active!
    const recoveredNoPreempt = runCommands(failedOver, "r1", [
      "conf t",
      "int Gig0/0",
      "no shutdown",
      "end",
    ]).state;

    const tableNoPreempt = computeHsrpTable(recoveredNoPreempt);
    expect(tableNoPreempt.find((e) => e.deviceId === "r2")?.state).toBe("Active");
    expect(tableNoPreempt.find((e) => e.deviceId === "r1")?.state).toBe("Standby");

    // Enable preempt on R1 -> R1 immediately reclaims Active!
    const preempted = runCommands(recoveredNoPreempt, "r1", [
      "conf t",
      "int Gig0/0",
      "standby 10 preempt",
      "end",
    ]).state;

    const tablePreempt = computeHsrpTable(preempted);
    expect(tablePreempt.find((e) => e.deviceId === "r1")?.state).toBe("Active");
    expect(tablePreempt.find((e) => e.deviceId === "r2")?.state).toBe("Standby");
  });
});
