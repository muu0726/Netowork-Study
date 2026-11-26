import type { ScenarioDefinition } from "@/lib/network-engine";

export const tsPortSecurityErrdisableScenario: ScenarioDefinition = {
  id: "ts-port-security-errdisable",
  title: "「会議室ハブを繋いだ後から通信が完全に途絶えた (err-disabled)」",
  category: "troubleshoot",
  difficulty: "中級",
  description:
    "会議室の PC-Meeting (192.168.10.20) から社内サーバ SRV-App (192.168.10.100) へ通信できなくなりました。スイッチ SW-Conf のポート状態を調査し、会議室2台運用を許可しつつ err-disabled 状態から復旧してください。",
  ticketSymptom:
    "【問い合わせ内容】会議室に小型ハブを置いて PC-Meeting ともう1台を接続しようとした直後から、ポートのランプが消えて一切ネットワークに繋がらなくなりました。",
  initialState: {
    devices: {
      "sw-conf": {
        id: "sw-conf",
        hostname: "SW-Conf",
        type: "switch",
        position: { x: 340, y: 135 },
        interfaces: {
          "Fa0/1": {
            name: "Fa0/1",
            mac: "00:aa:bb:80:00:01",
            adminUp: true,
            switchportMode: "access",
            accessVlan: 10,
            portSecurity: {
              enabled: true,
              maxMac: 1,
              violation: "shutdown",
              errDisabled: true,
              learnedMacs: ["00:11:22:80:00:20"],
            },
          },
          "Fa0/10": {
            name: "Fa0/10",
            mac: "00:aa:bb:80:00:10",
            adminUp: true,
            switchportMode: "access",
            accessVlan: 10,
          },
        },
        vlans: {
          1: { id: 1, name: "default", active: true },
          10: { id: 10, name: "Office", active: true },
        },
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        cliState: { mode: "user" },
      },
      "pc-meeting": {
        id: "pc-meeting",
        hostname: "PC-Meeting",
        type: "pc",
        position: { x: 135, y: 290 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:80:00:20",
            adminUp: true,
            ip: "192.168.10.20",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        cliState: { mode: "host" },
      },
      "srv-app": {
        id: "srv-app",
        hostname: "SRV-App",
        type: "server",
        position: { x: 545, y: 290 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:50:56:80:01:00",
            adminUp: true,
            ip: "192.168.10.100",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        cliState: { mode: "host" },
      },
    },
    links: [
      {
        id: "link-meeting-sw",
        fromDeviceId: "pc-meeting",
        fromInterface: "eth0",
        toDeviceId: "sw-conf",
        toInterface: "Fa0/1",
        up: true,
      },
      {
        id: "link-sw-srv",
        fromDeviceId: "sw-conf",
        fromInterface: "Fa0/10",
        toDeviceId: "srv-app",
        toInterface: "eth0",
        up: true,
      },
    ],
  },
  goals: [
    {
      type: "port_security_ok",
      id: "goal-psec-fa01",
      description:
        "SW-Conf の Fa0/1 で Port Security の最大MAC数を 2 以上に引き上げ、err-disabled 状態を解除する",
      deviceId: "sw-conf",
      interfaceName: "Fa0/1",
      minMaxMac: 2,
      requireNotErrDisabled: true,
    },
    {
      type: "ping",
      id: "goal-meeting-ping",
      description: "PC-Meeting から SRV-App (192.168.10.100) へ Ping が通ること",
      sourceDeviceId: "pc-meeting",
      target: "192.168.10.100",
    },
  ],
  hints: [
    "SW-Conf で `show ip interface brief` や `show port-security` を実行すると、Fa0/1 が `err-disabled` 状態になっていることが確認できます。",
    "Port Security の違反モード `shutdown` で遮断されたポートは、原因（`maximum 1` に2台目を繋いだ）を直しただけでは復旧せず、`shutdown` → `no shutdown` で明示的に再起動する必要があります。",
    "`conf t` → `int fa0/1` → `switchport port-security maximum 2` → `shutdown` → `no shutdown` を実行し、PC-Meeting から `ping 192.168.10.100` を試してください。",
  ],
  solutionCommands: [
    {
      deviceId: "sw-conf",
      hostname: "SW-Conf",
      commands: [
        "enable",
        "configure terminal",
        "interface Fa0/1",
        "switchport port-security maximum 2",
        "shutdown",
        "no shutdown",
        "end",
      ],
    },
  ],
  solutionExplanation:
    "会議室ポート Fa0/1 に `switchport port-security` (maximum 1, violation shutdown) が有効化されていたため、2つ目の MAC アドレスを検知した瞬間にポートが `err-disabled` へ落ちていました。要件に合わせて `maximum 2` に変更したうえで `shutdown` → `no shutdown` を行うことで復旧します。",
  postmortem: {
    rootCauseQuestion: "今回、ポート Fa0/1 が一切通信できなくなった直接の原因は何ですか？",
    rootCauseOptions: [
      "Port Security の最大MAC数 (1) 超過により violation shutdown が発動し、err-disabled になったため",
      "会議室PCのサブネットマスクが /24 ではなく /16 だったため",
      "VLAN 10 がスイッチ上で削除されていたため",
    ],
    rootCauseCorrectIndex: 0,
    preventionQuestion: "同様のトラブルの再発防止・復旧手順として適切なものはどれですか？",
    preventionOptions: [
      "接続台数要件に合わせて maximum を適切に設定し、err-disabled 時は原因除去後に shutdown / no shutdown で復旧する手順を周知する",
      "セキュリティ向上のため全スイッチの VLAN を 1 に統一する",
      "障害時はケーブルを抜かずにルータの電源だけを毎日再起動する",
    ],
    preventionCorrectIndex: 0,
    summary:
      "Port Security は不正端末・無許可ハブの接続を防ぐ重要なL2防御機能ですが、違反モードが shutdown の場合は原因対処とポート再起動 (shutdown → no shutdown) の両方が必要です。",
  },
};
