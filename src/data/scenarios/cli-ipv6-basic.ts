import type { ScenarioDefinition } from "@/lib/network-engine";

export const cliIpv6BasicScenario: ScenarioDefinition = {
  id: "cli-ipv6-basic",
  title: "IPv6 ルーティング設定とデュアルホスト疎通構築",
  category: "lab",
  difficulty: "中級",
  description:
    "ルータ R1-V6 を介して 2 つの IPv6 サブネット (2001:db8:10::/64 と 2001:db8:20::/64) を接続します。R1-V6 で IPv6 ユニキャストルーティングを有効化し、Gig0/1 に 2001:db8:20::1/64 を設定して PC-V6-A から SRV-V6-B (2001:db8:20::10) へ IPv6 Ping を通してください。",
  initialState: {
    devices: {
      "pc-v6-a": {
        id: "pc-v6-a",
        hostname: "PC-V6-A",
        type: "pc",
        position: { x: 110, y: 190 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:60:00:10",
            adminUp: true,
            ipv6Address: "2001:db8:10::10/64",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        ipv6DefaultGateway: "2001:db8:10::1",
        cliState: { mode: "host" },
      },
      "r1-v6": {
        id: "r1-v6",
        hostname: "R1-V6",
        type: "router",
        position: { x: 340, y: 190 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:60:00:00",
            adminUp: true,
            ipv6Address: "2001:db8:10::1/64",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:60:00:01",
            adminUp: false,
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        ipv6UnicastRouting: false,
        cliState: { mode: "user" },
      },
      "srv-v6-b": {
        id: "srv-v6-b",
        hostname: "SRV-V6-B",
        type: "server",
        position: { x: 570, y: 190 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:50:56:60:00:10",
            adminUp: true,
            ipv6Address: "2001:db8:20::10/64",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        ipv6DefaultGateway: "2001:db8:20::1",
        cliState: { mode: "host" },
      },
    },
    links: [
      {
        id: "link-v6-a",
        fromDeviceId: "pc-v6-a",
        fromInterface: "eth0",
        toDeviceId: "r1-v6",
        toInterface: "Gig0/0",
        up: true,
      },
      {
        id: "link-v6-b",
        fromDeviceId: "r1-v6",
        fromInterface: "Gig0/1",
        toDeviceId: "srv-v6-b",
        toInterface: "eth0",
        up: true,
      },
    ],
  },
  goals: [
    {
      type: "ipv6_interface",
      id: "goal-r1-v6-g01",
      description:
        "R1-V6 の Gig0/1 に 2001:db8:20::1/64 を設定し、ポートを有効化する",
      deviceId: "r1-v6",
      interfaceName: "Gig0/1",
      expectedIpv6: "2001:db8:20::1/64",
      expectedAdminUp: true,
    },
    {
      type: "ipv6_ping",
      id: "goal-v6-ping",
      description:
        "PC-V6-A から SRV-V6-B (2001:db8:20::10) への IPv6 Ping が成功する",
      sourceDeviceId: "pc-v6-a",
      targetIpv6: "2001:db8:20::10",
    },
  ],
  hints: [
    "まず R1-V6 で `show ipv6 interface brief` を実行し、Gig0/0 と Gig0/1 の IPv6 設定とリンク状態を確認しましょう。",
    "Cisco IOS ルータは初期状態で IPv6 パケット転送が無効です。`conf t` の直下で `ipv6 unicast-routing` を有効化してください。",
    "`interface Gig0/1` に入り `ipv6 address 2001:db8:20::1/64` と `no shutdown` を投入したあと、PC-V6-A で `ping 2001:db8:20::10` を実行しましょう。",
  ],
  solutionCommands: [
    {
      deviceId: "r1-v6",
      hostname: "R1-V6",
      commands: [
        "enable",
        "configure terminal",
        "ipv6 unicast-routing",
        "interface Gig0/1",
        "ipv6 address 2001:db8:20::1/64",
        "no shutdown",
        "end",
      ],
    },
  ],
  solutionExplanation:
    "Cisco IOS ルータで異なる IPv6 サブネット間をルーティングするには、グローバル設定モードで `ipv6 unicast-routing` を有効化し、各インターフェースへ `/64` プレフィックス付きの IPv6 アドレスと `no shutdown` を設定する必要があります。",
};
