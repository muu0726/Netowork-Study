import { describe, expect, it } from "vitest";
import {
  executeCommand,
  getCliCompletions,
  getDevicePrompt,
  normalizeInterfaceName,
} from "./cli-engine";
import type { NetworkState } from "./types";

function createTestNetwork(): NetworkState {
  return {
    devices: {
      r1: {
        id: "r1",
        hostname: "R1",
        type: "router",
        position: { x: 100, y: 100 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:00:0c:00:01:01",
            adminUp: false,
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:00:0c:00:01:02",
            adminUp: true,
            ip: "10.0.0.1",
            subnetMask: "255.255.255.252",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        cliState: { mode: "user" },
      },
      sw1: {
        id: "sw1",
        hostname: "SW1",
        type: "switch",
        position: { x: 260, y: 100 },
        interfaces: {
          "Fa0/1": {
            name: "Fa0/1",
            mac: "00:00:0c:00:02:01",
            adminUp: true,
            switchportMode: "access",
            accessVlan: 1,
          },
          "Fa0/24": {
            name: "Fa0/24",
            mac: "00:00:0c:00:02:24",
            adminUp: true,
            switchportMode: "access",
            accessVlan: 1,
          },
        },
        vlans: {
          1: { id: 1, name: "default", active: true },
        },
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        cliState: { mode: "user" },
      },
      pc1: {
        id: "pc1",
        hostname: "PC1",
        type: "pc",
        position: { x: 400, y: 100 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "aa:bb:cc:00:01:01",
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
    },
    links: [
      {
        id: "l1",
        fromDeviceId: "r1",
        fromInterface: "Gig0/0",
        toDeviceId: "sw1",
        toInterface: "Fa0/24",
        up: true,
      },
      {
        id: "l2",
        fromDeviceId: "sw1",
        fromInterface: "Fa0/1",
        toDeviceId: "pc1",
        toInterface: "eth0",
        up: true,
      },
    ],
  };
}

function runSequence(
  initialState: NetworkState,
  deviceId: string,
  commands: string[],
) {
  let state = initialState;
  let lastOutput = "";
  let lastPrompt = getDevicePrompt(state.devices[deviceId]);
  for (const cmd of commands) {
    const res = executeCommand(state, deviceId, cmd);
    state = res.nextState;
    lastOutput = res.output;
    lastPrompt = res.prompt;
  }
  return { state, lastOutput, lastPrompt };
}

describe("cli-engine", () => {
  it("normalizes abbreviated Cisco interface names", () => {
    expect(normalizeInterfaceName("g0/0")).toBe("Gig0/0");
    expect(normalizeInterfaceName("gi0/0.10")).toBe("Gig0/0.10");
    expect(normalizeInterfaceName("fa0/1")).toBe("Fa0/1");
    expect(normalizeInterfaceName("se0/0/0")).toBe("Se0/0/0");
    expect(normalizeInterfaceName("lo0")).toBe("Lo0");

    const state = createTestNetwork();
    expect(
      normalizeInterfaceName("gigabitethernet0/0.10", state.devices.r1.interfaces),
    ).toBe("Gig0/0.10");
  });

  it("supports full IOS mode transitions, abbreviations, and immutability", () => {
    const initial = createTestNetwork();
    const snapshotBefore = JSON.stringify(initial);

    let res = executeCommand(initial, "r1", "en");
    expect(res.prompt).toBe("R1#");

    res = executeCommand(res.nextState, "r1", "conf t");
    expect(res.prompt).toBe("R1(config)#");

    res = executeCommand(res.nextState, "r1", "int g0/0");
    expect(res.prompt).toBe("R1(config-if)#");

    res = executeCommand(res.nextState, "r1", "no sh");
    expect(res.nextState.devices.r1.interfaces["Gig0/0"].adminUp).toBe(true);

    res = executeCommand(res.nextState, "r1", "int g0/0.10");
    expect(res.prompt).toBe("R1(config-subif)#");

    res = executeCommand(res.nextState, "r1", "enc dot 10");
    expect(res.nextState.devices.r1.interfaces["Gig0/0.10"].dot1qVlan).toBe(10);

    res = executeCommand(
      res.nextState,
      "r1",
      "ip addr 192.168.10.1 255.255.255.0",
    );
    expect(res.nextState.devices.r1.interfaces["Gig0/0.10"].ip).toBe(
      "192.168.10.1",
    );

    res = executeCommand(res.nextState, "r1", "exit");
    expect(res.prompt).toBe("R1(config)#");

    res = executeCommand(res.nextState, "r1", "ip route 192.168.20.0 255.255.255.0 10.0.0.2");
    expect(res.nextState.devices.r1.staticRoutes).toHaveLength(1);

    res = executeCommand(res.nextState, "r1", "end");
    expect(res.prompt).toBe("R1#");

    res = executeCommand(res.nextState, "r1", "dis");
    expect(res.prompt).toBe("R1>");

    // 初期状態が一切書き換わっていないこと
    expect(JSON.stringify(initial)).toBe(snapshotBefore);
  });

  it("supports all 'no' removal commands across router and switch", () => {
    const initial = createTestNetwork();

    const rSetup = runSequence(initial, "r1", [
      "en",
      "conf t",
      "int g0/0",
      "no sh",
      "ip addr 192.168.1.1 255.255.255.0",
      "int g0/0.10",
      "enc dot 10",
      "ip addr 192.168.10.1 255.255.255.0",
      "exit",
      "ip route 172.16.0.0 255.255.0.0 10.0.0.2",
    ]);

    let res = executeCommand(rSetup.state, "r1", "no ip route 172.16.0.0 255.255.0.0 10.0.0.2");
    expect(res.nextState.devices.r1.staticRoutes).toHaveLength(0);

    res = executeCommand(res.nextState, "r1", "int g0/0.10");
    res = executeCommand(res.nextState, "r1", "no enc dot");
    expect(res.nextState.devices.r1.interfaces["Gig0/0.10"].dot1qVlan).toBeUndefined();

    res = executeCommand(res.nextState, "r1", "no ip addr");
    expect(res.nextState.devices.r1.interfaces["Gig0/0.10"].ip).toBeUndefined();

    res = executeCommand(res.nextState, "r1", "exit");
    res = executeCommand(res.nextState, "r1", "no int g0/0.10");
    expect(res.nextState.devices.r1.interfaces["Gig0/0.10"]).toBeUndefined();

    // Switch VLAN & switchport no commands
    const swSetup = runSequence(res.nextState, "sw1", [
      "en",
      "conf t",
      "vlan 20",
      "name Sales",
      "exit",
      "int fa0/1",
      "sw m a",
      "sw a v 20",
      "int fa0/24",
      "sw m t",
      "sw t a v 10,20",
      "sw t a v add 30",
      "sw t a v remove 10",
    ]);

    expect(swSetup.state.devices.sw1.vlans[20].name).toBe("Sales");
    expect(swSetup.state.devices.sw1.interfaces["Fa0/1"].accessVlan).toBe(20);
    expect(
      swSetup.state.devices.sw1.interfaces["Fa0/24"].trunkAllowedVlans,
    ).toEqual([20, 30]);

    let swRes = executeCommand(swSetup.state, "sw1", "no sw t a v");
    expect(
      swRes.nextState.devices.sw1.interfaces["Fa0/24"].trunkAllowedVlans,
    ).toBeUndefined();

    swRes = executeCommand(swRes.nextState, "sw1", "int fa0/1");
    swRes = executeCommand(swRes.nextState, "sw1", "no sw a v");
    expect(swRes.nextState.devices.sw1.interfaces["Fa0/1"].accessVlan).toBe(1);

    swRes = executeCommand(swRes.nextState, "sw1", "exit");
    swRes = executeCommand(swRes.nextState, "sw1", "no vlan 20");
    expect(swRes.nextState.devices.sw1.vlans[20]).toBeUndefined();

    // VLAN 1 deletion should be refused
    const vlan1Res = executeCommand(swRes.nextState, "sw1", "no vlan 1");
    expect(vlan1Res.output).toContain("Default VLAN 1");
    expect(vlan1Res.nextState.devices.sw1.vlans[1]).toBeDefined();
  });

  it("outputs expected Cisco show commands including abbreviated forms", () => {
    const initial = createTestNetwork();
    const setup = runSequence(initial, "r1", [
      "en",
      "conf t",
      "int g0/0",
      "no sh",
      "ip addr 192.168.10.1 255.255.255.0",
      "exit",
      "ip route 192.168.20.0 255.255.255.0 10.0.0.2",
      "end",
    ]);

    const shIpIntBr = executeCommand(setup.state, "r1", "sh ip int br");
    expect(shIpIntBr.output).toContain("Gig0/0");
    expect(shIpIntBr.output).toContain("192.168.10.1");
    expect(shIpIntBr.output).toContain("up");

    const shIpRoute = executeCommand(setup.state, "r1", "sh ip ro");
    expect(shIpRoute.output).toContain("C    192.168.10.0/24");
    expect(shIpRoute.output).toContain("S    192.168.20.0/24");

    const shRun = executeCommand(setup.state, "r1", "sh run");
    expect(shRun.output).toContain("hostname R1");
    expect(shRun.output).toContain("ip address 192.168.10.1 255.255.255.0");
    expect(shRun.output).toContain("ip route 192.168.20.0 255.255.255.0 10.0.0.2");

    const shArp = executeCommand(setup.state, "r1", "sh arp");
    expect(shArp.output).toContain("192.168.10.1");

    const swSetup = runSequence(setup.state, "sw1", [
      "en",
      "conf t",
      "vlan 10",
      "name Dev",
      "exit",
      "int fa0/1",
      "sw a v 10",
      "end",
    ]);
    const shVlBr = executeCommand(swSetup.state, "sw1", "sh vl br");
    expect(shVlBr.output).toContain("10   Dev");
    expect(shVlBr.output).toContain("Fa0/1");

    const shMac = executeCommand(swSetup.state, "sw1", "sh mac add");
    expect(shMac.output).toContain("Mac Address Table");
  });

  it("handles end-host commands (ipconfig, set ip, set dns, validation)", () => {
    const initial = createTestNetwork();

    const cfg = executeCommand(initial, "pc1", "ipconfig");
    expect(cfg.prompt).toBe("PC1$");
    expect(cfg.output).toContain("192.168.10.10");
    expect(cfg.output).toContain("192.168.10.1");

    const setDns = executeCommand(initial, "pc1", "set dns 192.168.20.53");
    expect(setDns.nextState.devices.pc1.dnsServer).toBe("192.168.20.53");

    const setIp = executeCommand(
      setDns.nextState,
      "pc1",
      "set ip 192.168.10.50 255.255.255.0 192.168.10.1",
    );
    expect(setIp.nextState.devices.pc1.interfaces.eth0.ip).toBe(
      "192.168.10.50",
    );

    const badIp = executeCommand(initial, "pc1", "set ip 192.168.10.300 255.255.255.0");
    expect(badIp.output).toContain("% Invalid input detected");
  });

  it("produces helpful error messages, typo hints, ?, and tab completions", () => {
    const initial = createTestNetwork();

    // Ambiguous in config mode: "i" matches interface and ip
    const cfgState = runSequence(initial, "r1", ["en", "conf t"]).state;
    const ambig = executeCommand(cfgState, "r1", "i");
    expect(ambig.output).toContain("% Ambiguous command");

    // Incomplete command
    const incomplete = executeCommand(initial, "r1", "sh ip");
    expect(incomplete.output).toContain("% Incomplete command.");

    // Typo suggestion
    const typo = executeCommand(initial, "r1", "shwo ip int br");
    expect(typo.output).toContain("% Invalid input detected");
    expect(typo.output).toContain("show ip interface brief");

    // Help ?
    const help = executeCommand(initial, "r1", "?");
    expect(help.output).toContain("enable");
    expect(help.output).toContain("show ip interface brief");

    // Tab completions
    const completions = getCliCompletions(cfgState, "r1", "int g");
    expect(completions).toContain("int Gig0/0");
  });
});
