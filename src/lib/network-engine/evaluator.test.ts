import { describe, expect, it } from "vitest";
import { executeCommand } from "./cli-engine";
import { evaluateScenario } from "./evaluator";
import type { ScenarioDefinition } from "./types";

function createBrokenScenario(): ScenarioDefinition {
  return {
    id: "test-scenario-1",
    title: "VLAN・DNS・ルーティング総合復旧シナリオ",
    category: "troubleshoot",
    difficulty: "中級",
    description: "CLIコマンドで設定不備をすべて復旧するテストシナリオ",
    initialState: {
      devices: {
        pc1: {
          id: "pc1",
          hostname: "PC1",
          type: "pc",
          position: { x: 80, y: 120 },
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
          dnsServer: "192.168.99.99",
          cliState: { mode: "host" },
        },
        sw1: {
          id: "sw1",
          hostname: "SW1",
          type: "switch",
          position: { x: 200, y: 120 },
          interfaces: {
            "Fa0/1": {
              name: "Fa0/1",
              mac: "00:aa:bb:cc:01:01",
              adminUp: true,
              switchportMode: "access",
              accessVlan: 99,
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
            99: { id: 99, name: "Guest", active: true },
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
              adminUp: false,
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
              nextHop: "10.0.0.99",
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
          hostname: "SRV1",
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
            "app.internal": "192.168.20.10",
          },
          cliState: { mode: "host" },
        },
      },
      links: [
        {
          id: "l1",
          fromDeviceId: "pc1",
          fromInterface: "eth0",
          toDeviceId: "sw1",
          toInterface: "Fa0/1",
          up: true,
        },
        {
          id: "l2",
          fromDeviceId: "sw1",
          fromInterface: "Fa0/24",
          toDeviceId: "r1",
          toInterface: "Gig0/0",
          up: true,
        },
        {
          id: "l3",
          fromDeviceId: "r1",
          fromInterface: "Gig0/1",
          toDeviceId: "r2",
          toInterface: "Gig0/0",
          up: true,
        },
        {
          id: "l4",
          fromDeviceId: "r2",
          fromInterface: "Gig0/1",
          toDeviceId: "srv1",
          toInterface: "eth0",
          up: true,
        },
      ],
    },
    goals: [
      {
        type: "vlan_membership",
        id: "g-vlan",
        description: "SW1 Fa0/1 を VLAN 10 に設定する",
        deviceId: "sw1",
        interfaceName: "Fa0/1",
        expectedVlan: 10,
        expectedMode: "access",
      },
      {
        type: "interface_config",
        id: "g-if",
        description: "R1 Gig0/1 を no shutdown で有効化する",
        deviceId: "r1",
        interfaceName: "Gig0/1",
        expectedIp: "10.0.0.1",
        expectedMask: "255.255.255.252",
        expectedAdminUp: true,
      },
      {
        type: "route_absent",
        id: "g-route-del",
        description: "R1 から誤ったスタティックルートを削除する",
        deviceId: "r1",
        destination: "192.168.20.0",
        mask: "255.255.255.0",
        nextHop: "10.0.0.99",
      },
      {
        type: "route_exists",
        id: "g-route-add",
        description: "R1 に正しい静的ルートを設定する",
        deviceId: "r1",
        destination: "192.168.20.0",
        mask: "255.255.255.0",
        nextHop: "10.0.0.2",
      },
      {
        type: "dns_setting",
        id: "g-dns",
        description: "PC1 の DNS サーバを 192.168.20.10 に設定する",
        deviceId: "pc1",
        expectedDnsIp: "192.168.20.10",
      },
      {
        type: "nslookup",
        id: "g-nslookup",
        description: "PC1 から app.internal を名前解決できること",
        sourceDeviceId: "pc1",
        hostname: "app.internal",
        expectedIp: "192.168.20.10",
      },
      {
        type: "ping",
        id: "g-ping",
        description: "PC1 から app.internal へ Ping 疎通できること",
        sourceDeviceId: "pc1",
        target: "app.internal",
      },
    ],
    hints: ["ヒント1", "ヒント2", "ヒント3"],
    solutionCommands: [],
    solutionExplanation: "解説",
  };
}

describe("evaluator", () => {
  it("fails on broken initialState and passes after applying CLI fixes", () => {
    const scenario = createBrokenScenario();

    const initialEval = evaluateScenario(scenario.initialState, scenario);
    expect(initialEval.passed).toBe(false);
    expect(initialEval.passedCount).toBe(0);
    expect(initialEval.totalCount).toBe(7);

    let state = scenario.initialState;
    const cmds: Array<[string, string]> = [
      ["sw1", "en"],
      ["sw1", "conf t"],
      ["sw1", "int fa0/1"],
      ["sw1", "sw a v 10"],
      ["r1", "en"],
      ["r1", "conf t"],
      ["r1", "int g0/1"],
      ["r1", "no sh"],
      ["r1", "exit"],
      ["r1", "no ip route 192.168.20.0 255.255.255.0 10.0.0.99"],
      ["r1", "ip route 192.168.20.0 255.255.255.0 10.0.0.2"],
      ["pc1", "set dns 192.168.20.10"],
    ];

    for (const [devId, cmd] of cmds) {
      state = executeCommand(state, devId, cmd).nextState;
    }

    const finalEval = evaluateScenario(state, scenario);
    expect(finalEval.passed).toBe(true);
    expect(finalEval.passedCount).toBe(7);
    expect(finalEval.totalCount).toBe(7);
  });
});
