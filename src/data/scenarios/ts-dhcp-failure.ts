import type { ScenarioDefinition } from "@/lib/network-engine";

export const tsDhcpFailureScenario: ScenarioDefinition = {
  id: "ts-dhcp-failure",
  title: "「新規PCにIPアドレスが自動配布されない」",
  category: "troubleshoot",
  difficulty: "中級",
  description:
    "新設された PC-New が R1-DHCP から IPアドレス・GW・DNS を自動取得できるよう DHCP プール設定と除外アドレス範囲を修正し、`ipconfig /renew` で復旧してください。",
  ticketSymptom:
    "【問い合わせ内容】オフィスに新しい PC-New を接続して `ipconfig /renew` を実行しましたが、IPアドレスが取得できず業務アプリ `app.office.local` へ接続できません。設定変更中のR1-DHCPを確認してほしいです。",
  initialState: {
    devices: {
      "pc-new": {
        id: "pc-new",
        hostname: "PC-New",
        type: "pc",
        position: { x: 90, y: 190 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:55:30:11",
            adminUp: true,
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        cliState: { mode: "host" },
      },
      sw1: {
        id: "sw1",
        hostname: "SW1-Access",
        type: "switch",
        position: { x: 245, y: 190 },
        interfaces: {
          "Fa0/1": {
            name: "Fa0/1",
            mac: "00:0c:29:55:00:01",
            adminUp: true,
            switchportMode: "access",
            accessVlan: 1,
          },
          "Fa0/2": {
            name: "Fa0/2",
            mac: "00:0c:29:55:00:02",
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
      "r1-dhcp": {
        id: "r1-dhcp",
        hostname: "R1-DHCP",
        type: "router",
        position: { x: 420, y: 190 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:55:01:00",
            adminUp: true,
            ip: "192.168.30.1",
            subnetMask: "255.255.255.0",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:55:01:01",
            adminUp: true,
            ip: "192.168.40.1",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        dhcpPools: {
          OFFICE_LAN: {
            name: "OFFICE_LAN",
            network: "192.168.99.0",
            mask: "255.255.255.0",
            defaultRouter: "192.168.30.1",
            dnsServer: "192.168.40.10",
          },
        },
        dhcpExcludedRanges: [
          { startIp: "192.168.30.1", endIp: "192.168.30.254" },
        ],
        dhcpBindings: [],
        cliState: { mode: "user" },
      },
      "srv-app": {
        id: "srv-app",
        hostname: "SRV-App",
        type: "server",
        position: { x: 600, y: 190 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:50:56:55:40:10",
            adminUp: true,
            ip: "192.168.40.10",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        defaultGateway: "192.168.40.1",
        dnsRecords: {
          "app.office.local": "192.168.40.10",
        },
        listeningServices: [
          { protocol: "tcp", port: 80, serviceName: "http", active: true },
        ],
        cliState: { mode: "host" },
      },
    },
    links: [
      {
        id: "link-pc-sw",
        fromDeviceId: "pc-new",
        fromInterface: "eth0",
        toDeviceId: "sw1",
        toInterface: "Fa0/1",
        up: true,
      },
      {
        id: "link-sw-r1",
        fromDeviceId: "sw1",
        fromInterface: "Fa0/2",
        toDeviceId: "r1-dhcp",
        toInterface: "Gig0/0",
        up: true,
      },
      {
        id: "link-r1-srv",
        fromDeviceId: "r1-dhcp",
        fromInterface: "Gig0/1",
        toDeviceId: "srv-app",
        toInterface: "eth0",
        up: true,
      },
    ],
  },
  goals: [
    {
      type: "dhcp_lease",
      id: "goal-pc-dhcp",
      description:
        "PC-New が DHCP で 192.168.30.0/24 のIP・GW(192.168.30.1)・DNS(192.168.40.10) を取得している",
      clientDeviceId: "pc-new",
      expectedNetwork: "192.168.30.0",
      expectedMask: "255.255.255.0",
      expectedGateway: "192.168.30.1",
      expectedDns: "192.168.40.10",
    },
    {
      type: "ping",
      id: "goal-ping-app",
      description: "PC-New から SRV-App (192.168.40.10) への Ping が成功する",
      sourceDeviceId: "pc-new",
      target: "192.168.40.10",
    },
    {
      type: "tcp_connect",
      id: "goal-curl-app",
      description: "PC-New から app.office.local (HTTP 80) へ接続できる",
      sourceDeviceId: "pc-new",
      target: "app.office.local",
      port: 80,
      expectSuccess: true,
    },
  ],
  hints: [
    "まず PC-New で `ipconfig /renew` を実行し、どの理由で DHCP 取得が失敗しているか確認しましょう。続いて R1-DHCP で `show running-config` を確認してください。",
    "R1-DHCP の DHCP プール `OFFICE_LAN` が誤って `network 192.168.99.0`（Gig0/0 の 192.168.30.0/24 と不一致）になっており、さらに `ip dhcp excluded-address 192.168.30.1 192.168.30.254` で全ホストIPが除外されています。",
    "R1-DHCP で `no ip dhcp excluded-address 192.168.30.1 192.168.30.254`、`ip dhcp excluded-address 192.168.30.1 192.168.30.10`（GW等を除外）、`ip dhcp pool OFFICE_LAN` → `network 192.168.30.0 255.255.255.0` を設定後、PC-New で `ipconfig /renew` を実行してください。",
  ],
  solutionCommands: [
    {
      deviceId: "r1-dhcp",
      hostname: "R1-DHCP",
      commands: [
        "enable",
        "configure terminal",
        "no ip dhcp excluded-address 192.168.30.1 192.168.30.254",
        "ip dhcp excluded-address 192.168.30.1 192.168.30.10",
        "ip dhcp pool OFFICE_LAN",
        "network 192.168.30.0 255.255.255.0",
        "end",
      ],
    },
    {
      deviceId: "pc-new",
      hostname: "PC-New",
      commands: ["ipconfig /renew"],
    },
  ],
  solutionExplanation:
    "DHCPプールの `network` はクライアントが接続されたルータIF (`Gig0/0`: 192.168.30.0/24) と一致している必要があります。また `excluded-address` が `192.168.30.1〜.254` の全範囲を除外していたため払い出し可能なIPが枯渇していました。正しいネットワークと最小限の除外範囲へ修正し、`ipconfig /renew` で復旧させました。",
};
