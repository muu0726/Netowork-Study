import type { ScenarioDefinition } from "@/lib/network-engine";

export const cliFirstStepsScenario: ScenarioDefinition = {
  id: "cli-first-steps",
  title: "【超入門】最初のCLI操作：ポート起動とPing疎通体験",
  category: "lab",
  difficulty: "初級",
  description:
    "初めて仮想ターミナルを触る方向けのステップ0演習です。PC-A (192.168.1.10) とルータ R1-Home (192.168.1.1) は接続済みですが、R1 のポート (Gig0/0) が停止中 (shutdown) です。状態確認コマンドとたった1つの設定 (no shutdown) で Ping を通してみましょう。",
  initialState: {
    devices: {
      "pc-a": {
        id: "pc-a",
        hostname: "PC-A",
        type: "pc",
        position: { x: 175, y: 190 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:00:01:10",
            adminUp: true,
            ip: "192.168.1.10",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        defaultGateway: "192.168.1.1",
        cliState: { mode: "host" },
      },
      "r1-home": {
        id: "r1-home",
        hostname: "R1-Home",
        type: "router",
        position: { x: 485, y: 190 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:00:01:01",
            adminUp: false,
            ip: "192.168.1.1",
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
        id: "link-pca-r1",
        fromDeviceId: "pc-a",
        fromInterface: "eth0",
        toDeviceId: "r1-home",
        toInterface: "Gig0/0",
        up: true,
      },
    ],
  },
  goals: [
    {
      type: "interface_config",
      id: "goal-r1-home-up",
      description: "R1-Home の Gig0/0 を起動状態 (no shutdown) にする",
      deviceId: "r1-home",
      interfaceName: "Gig0/0",
      expectedIp: "192.168.1.1",
      expectedMask: "255.255.255.0",
      expectedAdminUp: true,
    },
    {
      type: "ping",
      id: "goal-pca-ping-r1",
      description:
        "PC-A から R1-Home (192.168.1.1) への往復 Ping が成功する",
      sourceDeviceId: "pc-a",
      target: "192.168.1.1",
    },
  ],
  hints: [
    "まずはトポロジ図で PC-A を選んで `ipconfig` や `ping 192.168.1.1` を試してみましょう。次に R1-Home を選んで `show ip interface brief` を実行すると、Gig0/0 が「administratively down（停止中）」になっているのが確認できます。",
    "Cisco IOS で設定を変えるには、特権モード → 設定モード → ポート選択の順に移動します。R1-Home で `enable` → `configure terminal` → `interface Gig0/0` と1行ずつ入力しましょう（Tabキーで自動補完できます）。",
    "プロンプトが `R1-Home(config-if)#` になったら `no shutdown` を入力して Enter！トポロジの赤い線が緑色に変わったら、PC-A を選んで `ping 192.168.1.1` で疎通成功を確認しましょう。",
  ],
  solutionCommands: [
    {
      deviceId: "r1-home",
      hostname: "R1-Home",
      commands: [
        "enable",
        "configure terminal",
        "interface Gig0/0",
        "no shutdown",
        "end",
      ],
    },
  ],
  solutionExplanation:
    "ルータのインターフェースは初期状態や保守時に shutdown（管理ダウン）になっていることがあります。show ip interface brief で状態を確認し、対象インターフェースで no shutdown を実行するだけでリンクアップし、同一LAN内のPCと疎通できるようになります。",
};
