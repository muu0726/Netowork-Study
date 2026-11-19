import { describe, expect, it } from "vitest";
import { isIpInRange, matchesWildcard } from "./ip-math";
import { allocateDhcpLease, evaluateAcl } from "./acl-nat-dhcp";
import { executeCommand } from "./cli-engine";
import { simulateDhcpRenew, simulateTcpConnect } from "./packet-simulator";
import type { NetworkState } from "./types";

function createNatAclState(): NetworkState {
  return {
    devices: {
      "pc-1": {
        id: "pc-1",
        hostname: "PC-1",
        type: "pc",
        position: { x: 100, y: 150 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:01:00:10",
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
      "pc-2": {
        id: "pc-2",
        hostname: "PC-2",
        type: "pc",
        position: { x: 100, y: 270 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:01:00:20",
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
      sw1: {
        id: "sw1",
        hostname: "SW1",
        type: "switch",
        position: { x: 230, y: 210 },
        interfaces: {
          "Fa0/1": {
            name: "Fa0/1",
            mac: "00:0c:29:01:00:01",
            adminUp: true,
            switchportMode: "access",
            accessVlan: 1,
          },
          "Fa0/2": {
            name: "Fa0/2",
            mac: "00:0c:29:01:00:02",
            adminUp: true,
            switchportMode: "access",
            accessVlan: 1,
          },
          "Fa0/3": {
            name: "Fa0/3",
            mac: "00:0c:29:01:00:03",
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
      r1: {
        id: "r1",
        hostname: "R1-NAT",
        type: "router",
        position: { x: 400, y: 210 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:02:00:00",
            adminUp: true,
            ip: "192.168.10.1",
            subnetMask: "255.255.255.0",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:02:00:01",
            adminUp: true,
            ip: "203.0.113.1",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        cliState: { mode: "user" },
      },
      srv1: {
        id: "srv1",
        hostname: "Web-Server",
        type: "server",
        position: { x: 590, y: 210 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:50:56:02:00:10",
            adminUp: true,
            ip: "203.0.113.50",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        // No defaultGateway: forces NAPT to work for return traffic!
        listeningServices: [
          { protocol: "tcp", port: 80, serviceName: "http", active: true },
          { protocol: "tcp", port: 23, serviceName: "telnet", active: true },
        ],
        cliState: { mode: "host" },
      },
    },
    links: [
      {
        id: "l1",
        fromDeviceId: "pc-1",
        fromInterface: "eth0",
        toDeviceId: "sw1",
        toInterface: "Fa0/1",
        up: true,
      },
      {
        id: "l2",
        fromDeviceId: "pc-2",
        fromInterface: "eth0",
        toDeviceId: "sw1",
        toInterface: "Fa0/2",
        up: true,
      },
      {
        id: "l3",
        fromDeviceId: "sw1",
        fromInterface: "Fa0/3",
        toDeviceId: "r1",
        toInterface: "Gig0/0",
        up: true,
      },
      {
        id: "l4",
        fromDeviceId: "r1",
        fromInterface: "Gig0/1",
        toDeviceId: "srv1",
        toInterface: "eth0",
        up: true,
      },
    ],
  };
}

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

describe("Phase 5: Wildcard math & IP ranges", () => {
  it("evaluates 32-bit bitwise wildcard masks including non-contiguous masks", () => {
    expect(matchesWildcard("192.168.10.5", "192.168.10.5", "0.0.0.0")).toBe(true);
    expect(matchesWildcard("192.168.10.6", "192.168.10.5", "0.0.0.0")).toBe(false);
    expect(matchesWildcard("10.20.30.40", "0.0.0.0", "255.255.255.255")).toBe(true);
    expect(matchesWildcard("192.168.10.254", "192.168.10.0", "0.0.0.255")).toBe(true);
    expect(matchesWildcard("192.168.11.1", "192.168.10.0", "0.0.0.255")).toBe(false);

    // Non-contiguous wildcard: 0.0.254.255 matches even 3rd octets (bit 0 = 0)
    expect(matchesWildcard("172.16.0.10", "172.16.0.0", "0.0.254.255")).toBe(true);
    expect(matchesWildcard("172.16.42.99", "172.16.0.0", "0.0.254.255")).toBe(true);
    expect(matchesWildcard("172.16.1.10", "172.16.0.0", "0.0.254.255")).toBe(false);
    expect(matchesWildcard("172.16.3.10", "172.16.0.0", "0.0.254.255")).toBe(false);

    expect(() => matchesWildcard("192.168.1.300", "192.168.1.0", "0.0.0.255")).toThrow();
  });

  it("checks IP inclusive ranges via 32-bit unsigned comparison", () => {
    expect(isIpInRange("192.168.10.1", "192.168.10.1", "192.168.10.10")).toBe(true);
    expect(isIpInRange("192.168.10.10", "192.168.10.1", "192.168.10.10")).toBe(true);
    expect(isIpInRange("192.168.10.11", "192.168.10.1", "192.168.10.10")).toBe(false);
    expect(isIpInRange("192.168.9.255", "192.168.10.1", "192.168.10.10")).toBe(false);
  });
});

describe("Phase 5: ACL evaluation, ordering, implicit deny & CLI", () => {
  it("evaluates rules top-down with first-match, increments hit counts, and enforces implicit deny", () => {
    const base = createNatAclState();
    base.devices.srv1.defaultGateway = "203.0.113.1";
    const { state } = runCommands(base, "r1", [
      "enable",
      "configure terminal",
      "access-list 100 deny tcp host 192.168.10.10 host 203.0.113.50 eq 23",
      "access-list 100 permit tcp 192.168.10.0 0.0.0.255 host 203.0.113.50 eq 80",
      "access-list 100 permit icmp any any",
      "interface Gig0/0",
      "ip access-group 100 in",
      "end",
    ]);

    // Implicit deny on UDP/5353
    const udpEval = evaluateAcl(state, "r1", "100", {
      protocol: "udp",
      srcIp: "192.168.10.10",
      dstIp: "203.0.113.50",
      srcPort: 50000,
      dstPort: 5353,
    });
    expect(udpEval.action).toBe("deny");
    expect(udpEval.isImplicitDeny).toBe(true);
    expect(udpEval.nextState.devices.r1.acls?.["100"].implicitDenyHits).toBe(1);

    // Explicit permit TCP 80 for PC-1 works, TCP 23 is Blocked by ACL
    const curlRes = executeCommand(state, "pc-1", "curl http://203.0.113.50");
    expect(curlRes.trace?.success).toBe(true);
    expect(curlRes.output).toContain("HTTP/1.1 200 OK");

    const ncBlocked = executeCommand(curlRes.nextState, "pc-1", "nc -zv 203.0.113.50 23");
    expect(ncBlocked.trace?.success).toBe(false);
    expect(ncBlocked.trace?.failureReason).toBe("Blocked by ACL (100 in on Gig0/0)");

    const showAcl = executeCommand(ncBlocked.nextState, "r1", "show access-lists");
    expect(showAcl.output).toContain("Extended IP access list 100");
    expect(showAcl.output).toContain(
      "deny tcp host 192.168.10.10 host 203.0.113.50 eq 23 (1 matches)",
    );
    expect(showAcl.output).toContain(
      "permit tcp 192.168.10.0 0.0.0.255 host 203.0.113.50 eq 80 (1 matches)",
    );
  });

  it("supports named extended ACL mode, sequence deletion (no <seq>), and unapplying from interface", () => {
    const base = createNatAclState();
    base.devices.srv1.defaultGateway = "203.0.113.1";
    const { state } = runCommands(base, "r1", [
      "enable",
      "configure terminal",
      "ip access-list extended CORP_EDGE",
      "10 deny tcp 192.168.10.0 0.0.0.255 any eq 80",
      "20 permit ip any any",
      "exit",
      "interface Gig0/1",
      "ip access-group CORP_EDGE out",
      "end",
    ]);

    expect(state.devices.r1.cliState.mode).toBe("privileged");
    const blockedHttp = simulateTcpConnect(state, "pc-1", "203.0.113.50", 80, "curl");
    expect(blockedHttp.trace.success).toBe(false);
    expect(blockedHttp.trace.failureReason).toBe("Blocked by ACL (CORP_EDGE out on Gig0/1)");

    // Remove rule 10 inside named ACL mode -> seq 20 permit ip any any now allows HTTP
    const afterDel = runCommands(state, "r1", [
      "conf t",
      "ip access-list extended CORP_EDGE",
      "no 10",
      "end",
    ]).state;
    const allowedHttp = simulateTcpConnect(afterDel, "pc-1", "203.0.113.50", 80, "curl");
    expect(allowedHttp.trace.success).toBe(true);

    // Also verify no ip access-group out removes ACL from interface
    const afterUnapply = runCommands(afterDel, "r1", [
      "conf t",
      "int Gig0/1",
      "no ip access-group CORP_EDGE out",
      "end",
    ]).state;
    expect(afterUnapply.devices.r1.interfaces["Gig0/1"].outboundAcl).toBeUndefined();
  });
});

describe("Phase 5: NAT / NAPT (PAT) & L4 curl / nc", () => {
  it("translates multiple inside hosts to outside IP with distinct NAPT ports and records hop metadata", () => {
    const base = createNatAclState();
    const configured = runCommands(base, "r1", [
      "enable",
      "conf t",
      "access-list 1 permit 192.168.10.0 0.0.0.255",
      "ip nat inside source list 1 interface Gig0/1 overload",
      "int Gig0/0",
      "ip nat inside",
      "exit",
      "int Gig0/1",
      "ip nat outside",
      "end",
    ]).state;

    // Host 1 curl -> NAPT translates 192.168.10.10 -> 203.0.113.1 & return traffic works
    const res1 = executeCommand(configured, "pc-1", "curl http://203.0.113.50");
    expect(res1.trace?.success).toBe(true);
    expect(res1.output).toContain("HTTP/1.1 200 OK");

    const natHop1 = res1.trace?.hops.find((h) => h.natTranslation?.direction === "inside-to-outside");
    expect(natHop1?.natTranslation?.beforeIp).toBe("192.168.10.10");
    expect(natHop1?.natTranslation?.afterIp).toBe("203.0.113.1");

    // Host 2 nc -zv on same destination port gets disambiguated global port
    const res2 = executeCommand(res1.nextState, "pc-2", "nc -zv 203.0.113.50 80");
    expect(res2.trace?.success).toBe(true);
    expect(res2.output).toContain("succeeded!");

    const translations = res2.nextState.devices.r1.natTranslations ?? [];
    expect(translations).toHaveLength(2);
    expect(translations[0].insideGlobalIp).toBe("203.0.113.1");
    expect(translations[1].insideGlobalIp).toBe("203.0.113.1");
    expect(translations[0].insideGlobalPort).not.toBe(translations[1].insideGlobalPort);

    const showNat = executeCommand(res2.nextState, "r1", "show ip nat translations");
    expect(showNat.output).toContain("192.168.10.10");
    expect(showNat.output).toContain("192.168.10.20");
    expect(showNat.output).toContain("203.0.113.1");

    // Closed port (e.g., 8080) returns Connection Refused cleanly
    const refused = executeCommand(res2.nextState, "pc-1", "nc -zv 203.0.113.50 8080");
    expect(refused.trace?.success).toBe(false);
    expect(refused.trace?.failureReason).toBe("Connection Refused");
    expect(refused.output).toContain("Connection refused");
  });
});

describe("Phase 5: DHCP pool allocation, exclusions & ipconfig /renew", () => {
  function createDhcpState(): NetworkState {
    return {
      devices: {
        pc1: {
          id: "pc1",
          hostname: "PC-Client",
          type: "pc",
          position: { x: 100, y: 180 },
          interfaces: {
            eth0: {
              name: "eth0",
              mac: "00:11:22:dd:00:11",
              adminUp: true,
            },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          cliState: { mode: "host" },
        },
        r1: {
          id: "r1",
          hostname: "R1-DHCP",
          type: "router",
          position: { x: 350, y: 180 },
          interfaces: {
            "Gig0/0": {
              name: "Gig0/0",
              mac: "00:0c:29:dd:00:01",
              adminUp: true,
              ip: "192.168.50.1",
              subnetMask: "255.255.255.0",
            },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          cliState: { mode: "user" },
        },
      },
      links: [
        {
          id: "link-dhcp",
          fromDeviceId: "pc1",
          fromInterface: "eth0",
          toDeviceId: "r1",
          toInterface: "Gig0/0",
          up: true,
        },
      ],
    };
  }

  it("allocates IP skipping excluded ranges, records binding, and detects subnet mismatch or exhaustion", () => {
    const base = createDhcpState();

    // 1. Mismatched pool fails cleanly
    const wrongPool = runCommands(base, "r1", [
      "enable",
      "conf t",
      "ip dhcp pool LAN_POOL",
      "network 10.0.0.0 255.255.255.0",
      "default-router 192.168.50.1",
      "dns-server 8.8.8.8",
      "end",
    ]).state;
    const mismatchRes = simulateDhcpRenew(wrongPool, "pc1");
    expect(mismatchRes.trace.success).toBe(false);
    expect(mismatchRes.trace.failureReason).toBe("DHCP Failed");

    // 2. Correct network + exhausted range fails cleanly
    const exhausted = runCommands(wrongPool, "r1", [
      "conf t",
      "ip dhcp excluded-address 192.168.50.1 192.168.50.254",
      "ip dhcp pool LAN_POOL",
      "network 192.168.50.0 255.255.255.0",
      "end",
    ]).state;
    const exhaustedRes = simulateDhcpRenew(exhausted, "pc1");
    expect(exhaustedRes.trace.success).toBe(false);

    // 3. Fix excluded range -> ipconfig /renew acquires .11 + GW + DNS
    const fixed = runCommands(exhausted, "r1", [
      "conf t",
      "no ip dhcp excluded-address 192.168.50.1 192.168.50.254",
      "ip dhcp excluded-address 192.168.50.1 192.168.50.10",
      "end",
    ]).state;

    const renewCmd = executeCommand(fixed, "pc1", "ipconfig /renew");
    expect(renewCmd.trace?.success).toBe(true);
    expect(renewCmd.output).toContain("192.168.50.11");
    expect(renewCmd.nextState.devices.pc1.interfaces.eth0.ip).toBe("192.168.50.11");
    expect(renewCmd.nextState.devices.pc1.defaultGateway).toBe("192.168.50.1");
    expect(renewCmd.nextState.devices.pc1.dnsServer).toBe("8.8.8.8");

    const bindingOut = executeCommand(renewCmd.nextState, "r1", "show ip dhcp binding");
    expect(bindingOut.output).toContain("192.168.50.11");
    expect(bindingOut.output).toContain("00:11:22:dd:00:11");

    // Direct allocateDhcpLease unit check
    const lease2 = allocateDhcpLease(
      renewCmd.nextState,
      "r1",
      "Gig0/0",
      "00:11:22:dd:00:22",
      "PC-Second",
    );
    expect(lease2.ok).toBe(true);
    if (lease2.ok) {
      expect(lease2.ip).toBe("192.168.50.12");
    }
  });
});
