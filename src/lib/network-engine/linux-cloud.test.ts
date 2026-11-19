import { describe, expect, it } from "vitest";
import { CLOUD_SCENARIOS_META } from "@/data/curriculum-meta";
import {
  cloudIgwSgHttpsScenario,
  cloudNaclEphemeralScenario,
  cloudPrivateNatEgressScenario,
  CLOUD_VPC_SCENARIOS,
} from "@/data/scenarios/cloud-vpc-scenarios";
import {
  addSecurityGroupRule,
  addVpcRoute,
  evaluateCloudVpcScenario,
  executeCommand,
  simulateVpcTraffic,
  upsertNaclRule,
  type NetworkState,
} from "./index";

function createLinuxLabState(): NetworkState {
  return {
    devices: {
      client: {
        id: "client",
        hostname: "PC-Ops",
        type: "pc",
        position: { x: 100, y: 180 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:77:00:10",
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
      r1: {
        id: "r1",
        hostname: "R1",
        type: "router",
        position: { x: 300, y: 180 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:77:00:01",
            adminUp: true,
            ip: "192.168.10.1",
            subnetMask: "255.255.255.0",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:77:00:02",
            adminUp: true,
            ip: "192.168.20.1",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        cliState: { mode: "user" },
      },
      web: {
        id: "web",
        hostname: "SRV-Linux",
        type: "server",
        position: { x: 520, y: 180 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:50:56:77:20:10",
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
          "api.prod.local": "192.168.20.10",
        },
        listeningServices: [
          {
            protocol: "tcp",
            port: 80,
            serviceName: "http",
            active: false,
            processName: "nginx",
            unitName: "nginx",
          },
          {
            protocol: "tcp",
            port: 443,
            serviceName: "https",
            active: false,
            processName: "nginx",
            unitName: "nginx",
          },
          {
            protocol: "tcp",
            port: 22,
            serviceName: "ssh",
            active: true,
            processName: "sshd",
            unitName: "sshd",
          },
        ],
        cliState: { mode: "host" },
      },
    },
    links: [
      {
        id: "l1",
        fromDeviceId: "client",
        fromInterface: "eth0",
        toDeviceId: "r1",
        toInterface: "Gig0/0",
        up: true,
      },
      {
        id: "l2",
        fromDeviceId: "r1",
        fromInterface: "Gig0/1",
        toDeviceId: "web",
        toInterface: "eth0",
        up: true,
      },
    ],
  };
}

describe("Phase 7: Linux practical server inspection & troubleshooting commands", () => {
  it("runs ip a, ip r, ss -tulpn, dig, systemctl status|start|stop nginx, and curl -v https", () => {
    const base = createLinuxLabState();

    const ipAddr = executeCommand(base, "web", "ip a");
    expect(ipAddr.output).toContain("inet 192.168.20.10/24");
    expect(ipAddr.output).toContain("state UP");

    const ipRoute = executeCommand(base, "web", "ip route show");
    expect(ipRoute.output).toContain("default via 192.168.20.1 dev eth0");
    expect(ipRoute.output).toContain("192.168.20.0/24 dev eth0");

    // ss -tulpn shows sshd(22) and named(53), not nginx(80/443) yet
    const ssBefore = executeCommand(base, "web", "ss -tulpn");
    expect(ssBefore.output).toContain("0.0.0.0:22");
    expect(ssBefore.output).toContain("sshd");
    expect(ssBefore.output).toContain("0.0.0.0:53");
    expect(ssBefore.output).not.toContain("0.0.0.0:443");

    // dig succeeds with NOERROR + ANSWER SECTION, and NXDOMAIN on missing record
    const digOk = executeCommand(base, "client", "dig api.prod.local");
    expect(digOk.trace?.success).toBe(true);
    expect(digOk.output).toContain("status: NOERROR");
    expect(digOk.output).toContain("192.168.20.10");

    const digNx = executeCommand(base, "client", "dig unknown.prod.local");
    expect(digNx.trace?.success).toBe(false);
    expect(digNx.output).toContain("status: NXDOMAIN");

    // systemctl status shows nginx inactive, curl -v fails Connection refused
    const statusDown = executeCommand(base, "web", "systemctl status nginx");
    expect(statusDown.output).toContain("inactive (dead)");

    const curlRefused = executeCommand(base, "client", "curl -v https://api.prod.local");
    expect(curlRefused.trace?.success).toBe(false);
    expect(curlRefused.output).toContain("Connection refused");

    // Start nginx -> ss -tulpn lists 80 & 443, curl -v shows DNS + TCP + TLSv1.3 + HTTP 200 OK
    const started = executeCommand(base, "web", "systemctl start nginx");
    expect(started.output).toContain("Started nginx.service");

    const ssAfter = executeCommand(started.nextState, "web", "ss -tulpn");
    expect(ssAfter.output).toContain("0.0.0.0:80");
    expect(ssAfter.output).toContain("0.0.0.0:443");
    expect(ssAfter.output).toContain("nginx");

    const curlHttps = executeCommand(
      started.nextState,
      "client",
      "curl -v https://api.prod.local",
    );
    expect(curlHttps.trace?.success).toBe(true);
    expect(curlHttps.output).toContain("Resolved api.prod.local -> 192.168.20.10");
    expect(curlHttps.output).toContain("TCP 3-Way Handshake");
    expect(curlHttps.output).toContain("SSL connection using TLSv1.3");
    expect(curlHttps.output).toContain("HTTP/1.1 200 OK");
  });
});

describe("Phase 7: AWS VPC simulation (IGW, NAT GW, Stateful SG vs Stateless NACL)", () => {
  it("matches CLOUD_SCENARIOS_META IDs and maintains JSON-serializable initialVpc", () => {
    const metaIds = CLOUD_SCENARIOS_META.map((m) => m.id).sort();
    const scenarioIds = CLOUD_VPC_SCENARIOS.map((s) => s.id).sort();
    expect(scenarioIds).toEqual(metaIds);

    for (const sc of CLOUD_VPC_SCENARIOS) {
      expect(JSON.parse(JSON.stringify(sc.initialVpc))).toEqual(sc.initialVpc);
      expect(evaluateCloudVpcScenario(sc.initialVpc, sc).passed).toBe(false);
    }
  });

  it("solves Public HTTPS scenario using IGW route + Stateful SG Inbound (0 outbound SG rules)", () => {
    // Initially fails on SG-In (443 blocked)
    const initTrace = simulateVpcTraffic(
      cloudIgwSgHttpsScenario.initialVpc,
      cloudIgwSgHttpsScenario.testFlows[0].flow,
    );
    expect(initTrace.success).toBe(false);
    expect(initTrace.failureLayer).toBe("SG-In");

    // Adding SG Inbound 443 alone then exposes missing IGW Route on response!
    let vpc = addSecurityGroupRule(cloudIgwSgHttpsScenario.initialVpc, "sg-web", {
      id: "allow-https",
      direction: "inbound",
      protocol: "tcp",
      fromPort: 443,
      toPort: 443,
      cidr: "0.0.0.0/0",
    });
    const rtMissing = simulateVpcTraffic(vpc, cloudIgwSgHttpsScenario.testFlows[0].flow);
    expect(rtMissing.success).toBe(false);
    expect(rtMissing.failureLayer).toBe("RouteTable");

    // Adding 0.0.0.0/0 -> igw-main makes SG stateful bypass + full evaluation pass!
    vpc = addVpcRoute(vpc, "rt-public", {
      destinationCidr: "0.0.0.0/0",
      targetType: "igw",
      targetId: "igw-main",
    });
    const finalTrace = simulateVpcTraffic(vpc, cloudIgwSgHttpsScenario.testFlows[0].flow);
    expect(finalTrace.success).toBe(true);
    expect(finalTrace.steps.some((s) => s.action === "STATEFUL-BYPASS")).toBe(true);
    expect(evaluateCloudVpcScenario(vpc, cloudIgwSgHttpsScenario).passed).toBe(true);
  });

  it("solves Stateless NACL ephemeral port response block (and respects rule number priority)", () => {
    const initTrace = simulateVpcTraffic(
      cloudNaclEphemeralScenario.initialVpc,
      cloudNaclEphemeralScenario.testFlows[0].flow,
    );
    expect(initTrace.success).toBe(false);
    expect(initTrace.failureLayer).toBe("NACL-Out");

    // Lower rule number DENY overrides higher rule number ALLOW
    const withDenyFirst = upsertNaclRule(
      cloudNaclEphemeralScenario.initialVpc,
      "nacl-strict",
      {
        ruleNumber: 90,
        direction: "outbound",
        protocol: "tcp",
        fromPort: 55100,
        toPort: 55100,
        cidr: "0.0.0.0/0",
        action: "DENY",
      },
    );
    const withAllowAfter = upsertNaclRule(withDenyFirst, "nacl-strict", {
      ruleNumber: 120,
      direction: "outbound",
      protocol: "tcp",
      fromPort: 1024,
      toPort: 65535,
      cidr: "0.0.0.0/0",
      action: "ALLOW",
    });
    expect(
      simulateVpcTraffic(withAllowAfter, cloudNaclEphemeralScenario.testFlows[0].flow)
        .success,
    ).toBe(false);

    // Proper ephemeral ALLOW rule (without conflicting DENY) resolves scenario 100%
    const fixed = upsertNaclRule(
      cloudNaclEphemeralScenario.initialVpc,
      "nacl-strict",
      {
        ruleNumber: 110,
        direction: "outbound",
        protocol: "tcp",
        fromPort: 1024,
        toPort: 65535,
        cidr: "0.0.0.0/0",
        action: "ALLOW",
      },
    );
    expect(evaluateCloudVpcScenario(fixed, cloudNaclEphemeralScenario).passed).toBe(true);
  });

  it("solves Private Subnet outbound HTTPS via NAT Gateway + SG Outbound", () => {
    let vpc = addSecurityGroupRule(cloudPrivateNatEgressScenario.initialVpc, "sg-app", {
      id: "sg-out-https",
      direction: "outbound",
      protocol: "tcp",
      fromPort: 443,
      toPort: 443,
      cidr: "0.0.0.0/0",
    });
    vpc = addVpcRoute(vpc, "rt-app-priv", {
      destinationCidr: "0.0.0.0/0",
      targetType: "nat",
      targetId: "nat-gw-1",
    });

    const outTrace = simulateVpcTraffic(
      vpc,
      cloudPrivateNatEgressScenario.testFlows[0].flow,
    );
    expect(outTrace.success).toBe(true);
    expect(outTrace.steps.some((s) => s.layer === "NAT-GW")).toBe(true);
    expect(outTrace.steps.some((s) => s.action === "STATEFUL-BYPASS")).toBe(true);
    expect(evaluateCloudVpcScenario(vpc, cloudPrivateNatEgressScenario).passed).toBe(true);
  });
});
