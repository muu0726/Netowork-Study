import type { ScenarioDefinition } from "@/lib/network-engine";

export const tsRoutingAsymmetricScenario: ScenarioDefinition = {
  id: "ts-routing-asymmetric",
  title: "「拠点間Pingがタイムアウトする」",
  category: "troubleshoot",
  difficulty: "実践",
  description:
    "本社 PC-HQ から支社サーバ SRV-Branch への通信がタイムアウトしています。両拠点のルータのルーティングテーブルを調査し、誤った設定の削除と不足ルートの追加で通信を復旧してください。",
  ticketSymptom:
    "【問い合わせ内容】深夜メンテナンスで支社ルータ周りの静的ルートを編集したあと、本社 PC-HQ (192.168.10.10) から支社 SRV-Branch (192.168.30.10) への Ping がすべてタイムアウトします。",
  initialState: {
    devices: {
      "pc-hq": {
        id: "pc-hq",
        hostname: "PC-HQ",
        type: "pc",
        position: { x: 85, y: 190 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:50:10:10",
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
      "r-hq": {
        id: "r-hq",
        hostname: "R-HQ",
        type: "router",
        position: { x: 245, y: 190 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:50:01:00",
            adminUp: true,
            ip: "192.168.10.1",
            subnetMask: "255.255.255.0",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:50:01:01",
            adminUp: true,
            ip: "10.0.12.1",
            subnetMask: "255.255.255.252",
          },
        },
        vlans: {},
        staticRoutes: [
          {
            destination: "192.168.30.0",
            mask: "255.255.255.0",
            prefixLength: 24,
            nextHop: "10.0.12.99",
            adminDistance: 1,
          },
        ],
        arpTable: [],
        macTable: [],
        cliState: { mode: "user" },
      },
      "r-branch": {
        id: "r-branch",
        hostname: "R-Branch",
        type: "router",
        position: { x: 435, y: 190 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:50:02:00",
            adminUp: true,
            ip: "10.0.12.2",
            subnetMask: "255.255.255.252",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:50:02:01",
            adminUp: true,
            ip: "192.168.30.1",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        cliState: { mode: "user" },
      },
      "srv-branch": {
        id: "srv-branch",
        hostname: "SRV-Branch",
        type: "server",
        position: { x: 595, y: 190 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:50:56:50:30:10",
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
      {
        id: "link-hq-pc",
        fromDeviceId: "pc-hq",
        fromInterface: "eth0",
        toDeviceId: "r-hq",
        toInterface: "Gig0/0",
        up: true,
      },
      {
        id: "link-hq-branch",
        fromDeviceId: "r-hq",
        fromInterface: "Gig0/1",
        toDeviceId: "r-branch",
        toInterface: "Gig0/0",
        up: true,
      },
      {
        id: "link-branch-srv",
        fromDeviceId: "r-branch",
        fromInterface: "Gig0/1",
        toDeviceId: "srv-branch",
        toInterface: "eth0",
        up: true,
      },
    ],
  },
  goals: [
    {
      type: "route_absent",
      id: "goal-del-bad-route",
      description:
        "R-HQ から誤ったネクストホップ (10.0.12.99) へのスタティックルートを削除する",
      deviceId: "r-hq",
      destination: "192.168.30.0",
      mask: "255.255.255.0",
      nextHop: "10.0.12.99",
    },
    {
      type: "route_exists",
      id: "goal-add-hq-route",
      description:
        "R-HQ に正しい支社宛てルート 192.168.30.0/24 (Next-Hop: 10.0.12.2) を設定する",
      deviceId: "r-hq",
      destination: "192.168.30.0",
      mask: "255.255.255.0",
      nextHop: "10.0.12.2",
    },
    {
      type: "route_exists",
      id: "goal-add-branch-return",
      description:
        "R-Branch に本社宛ての戻りルート 192.168.10.0/24 (Next-Hop: 10.0.12.1) を追加する",
      deviceId: "r-branch",
      destination: "192.168.10.0",
      mask: "255.255.255.0",
      nextHop: "10.0.12.1",
    },
    {
      type: "ping",
      id: "goal-hq-branch-ping",
      description: "PC-HQ から SRV-Branch (192.168.30.10) への往復 Ping が成功する",
      sourceDeviceId: "pc-hq",
      target: "192.168.30.10",
    },
  ],
  hints: [
    "R-HQ と R-Branch の両方で `show ip route` と `show ip interface brief` を実行し、WAN IP (10.0.12.1 / 10.0.12.2) と静的ルートを確認してください。",
    "R-HQ の 192.168.30.0/24 宛てルートが `10.0.12.99`（存在しないIP）に向いています。`no ip route 192.168.30.0 255.255.255.0 10.0.12.99` で削除し、`10.0.12.2` 宛てを設定しましょう。",
    "R-HQ だけ直して Ping しても、今度は復路パケットが R-Branch で止まります。R-Branch にも `ip route 192.168.10.0 255.255.255.0 10.0.12.1` を追加してください。",
  ],
  solutionCommands: [
    {
      deviceId: "r-hq",
      hostname: "R-HQ",
      commands: [
        "enable",
        "configure terminal",
        "no ip route 192.168.30.0 255.255.255.0 10.0.12.99",
        "ip route 192.168.30.0 255.255.255.0 10.0.12.2",
        "end",
      ],
    },
    {
      deviceId: "r-branch",
      hostname: "R-Branch",
      commands: [
        "enable",
        "configure terminal",
        "ip route 192.168.10.0 255.255.255.0 10.0.12.1",
        "end",
      ],
    },
  ],
  solutionExplanation:
    "通信障害は2重の原因で発生していました。① R-HQ 側に存在しない Next-Hop (10.0.12.99) への誤ルートが残存していた点、② R-Branch 側に本社セグメント (192.168.10.0/24) への戻りルートが欠落していた点です。誤ルート削除と双方ルート設定により往復疎通を回復しました。",
};
