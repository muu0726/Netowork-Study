import type { ScenarioDefinition } from "@/lib/network-engine";

export const tsOspfNeighborDownScenario: ScenarioDefinition = {
  id: "ts-ospf-neighbor-down",
  title: "「OSPFネイバーが確立せず対向拠点へ到達できない」",
  category: "troubleshoot",
  difficulty: "中級",
  description:
    "東京拠点 (PC-Tokyo) と大阪拠点 (SRV-Osaka) を結ぶ WAN で OSPF ネイバーが確立されず通信できません。R2-Osaka の OSPF 設定を調査・修復して拠点間疎通を復旧してください。",
  ticketSymptom:
    "【問い合わせ内容】新設した大阪拠点のサーバ (192.168.20.10) へ東京拠点から接続できません。物理リンクとIPアドレスは両端とも開通済みですが、R1-Tokyo で `show ip ospf neighbor` が空のままです。",
  initialState: {
    devices: {
      "pc-tokyo": {
        id: "pc-tokyo",
        hostname: "PC-Tokyo",
        type: "pc",
        position: { x: 90, y: 190 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:83:10:10",
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
      "r1-tokyo": {
        id: "r1-tokyo",
        hostname: "R1-Tokyo",
        type: "router",
        position: { x: 255, y: 190 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:83:01:00",
            adminUp: true,
            ip: "192.168.10.1",
            subnetMask: "255.255.255.0",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:83:01:01",
            adminUp: true,
            ip: "10.0.0.1",
            subnetMask: "255.255.255.252",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        ospf: {
          processId: 1,
          routerId: "1.1.1.1",
          networks: [
            { network: "192.168.10.0", wildcard: "0.0.0.255", area: 0 },
            { network: "10.0.0.0", wildcard: "0.0.0.3", area: 0 },
          ],
        },
        cliState: { mode: "user" },
      },
      "r2-osaka": {
        id: "r2-osaka",
        hostname: "R2-Osaka",
        type: "router",
        position: { x: 425, y: 190 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:83:02:00",
            adminUp: true,
            ip: "10.0.0.2",
            subnetMask: "255.255.255.252",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:83:02:01",
            adminUp: true,
            ip: "192.168.20.1",
            subnetMask: "255.255.255.0",
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
            { network: "10.0.0.0", wildcard: "0.0.0.3", area: 1 },
            { network: "192.168.20.0", wildcard: "0.0.0.0", area: 0 },
          ],
        },
        cliState: { mode: "user" },
      },
      "srv-osaka": {
        id: "srv-osaka",
        hostname: "SRV-Osaka",
        type: "server",
        position: { x: 590, y: 190 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:50:56:83:20:10",
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
        cliState: { mode: "host" },
      },
    },
    links: [
      {
        id: "link-pc-r1",
        fromDeviceId: "pc-tokyo",
        fromInterface: "eth0",
        toDeviceId: "r1-tokyo",
        toInterface: "Gig0/0",
        up: true,
      },
      {
        id: "link-r1-r2",
        fromDeviceId: "r1-tokyo",
        fromInterface: "Gig0/1",
        toDeviceId: "r2-osaka",
        toInterface: "Gig0/0",
        up: true,
      },
      {
        id: "link-r2-srv",
        fromDeviceId: "r2-osaka",
        fromInterface: "Gig0/1",
        toDeviceId: "srv-osaka",
        toInterface: "eth0",
        up: true,
      },
    ],
  },
  goals: [
    {
      type: "ospf_neighbor",
      id: "goal-ospf-nbr",
      description: "R1-Tokyo が R2-Osaka (2.2.2.2) と OSPF ネイバーを確立している",
      deviceId: "r1-tokyo",
      expectedNeighborRouterId: "2.2.2.2",
    },
    {
      type: "ospf_route",
      id: "goal-ospf-route",
      description:
        "R1-Tokyo が大阪LAN (192.168.20.0/24 via 10.0.0.2) を OSPF (O) で学習している",
      deviceId: "r1-tokyo",
      destination: "192.168.20.0",
      mask: "255.255.255.0",
      expectedNextHop: "10.0.0.2",
    },
    {
      type: "ping",
      id: "goal-ping-osaka",
      description: "PC-Tokyo から SRV-Osaka (192.168.20.10) への Ping が成功する",
      sourceDeviceId: "pc-tokyo",
      target: "192.168.20.10",
    },
  ],
  hints: [
    "R1-Tokyo と R2-Osaka で `show running-config` と `show ip ospf neighbor` を比較してみましょう。",
    "R2-Osaka では WAN リンク (`10.0.0.0 0.0.0.3`) が誤って `area 1` に設定されているため Area ID 不一致でネイバーが組めません。さらに LAN (`192.168.20.0`) のワイルドカードが `0.0.0.0` になっており、`192.168.20.1` の Gig0/1 が含まれていません。",
    "R2-Osaka で `router ospf 1` に入り、誤った2行を `no network ...` で削除した後、`network 10.0.0.0 0.0.0.3 area 0` と `network 192.168.20.0 0.0.0.255 area 0` を設定してください。",
  ],
  solutionCommands: [
    {
      deviceId: "r2-osaka",
      hostname: "R2-Osaka",
      commands: [
        "enable",
        "configure terminal",
        "router ospf 1",
        "no network 10.0.0.0 0.0.0.3 area 1",
        "no network 192.168.20.0 0.0.0.0 area 0",
        "network 10.0.0.0 0.0.0.3 area 0",
        "network 192.168.20.0 0.0.0.255 area 0",
        "end",
      ],
    },
    {
      deviceId: "pc-tokyo",
      hostname: "PC-Tokyo",
      commands: ["ping 192.168.20.10"],
    },
  ],
  solutionExplanation:
    "OSPF ネイバーを確立するには対向インターフェース間で「同一 Area ID」「同一サブネット」が一致している必要があります。また `network` 文のワイルドカードマスクが不適切 (`0.0.0.0`) だとインターフェースIP (`192.168.20.1`) にマッチせず経路広告されません。両方の宣言を修正して収束させました。",
};
