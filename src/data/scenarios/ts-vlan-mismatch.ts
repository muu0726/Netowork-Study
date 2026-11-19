import type { ScenarioDefinition } from "@/lib/network-engine";

export const tsVlanMismatchScenario: ScenarioDefinition = {
  id: "ts-vlan-mismatch",
  title: "「営業部PCだけ社内サーバに繋がらない」",
  category: "troubleshoot",
  difficulty: "初級",
  description:
    "L2スイッチ SW-Floor1 配下の機器構成を調査し、営業部PC (PC-Sales) が社内サーバ (SRV-File) へ疎通できるよう復旧してください。",
  ticketSymptom:
    "【問い合わせ内容】今朝から営業部の PC-Sales (192.168.10.11) だけ社内ファイルサーバ (192.168.10.100) にアクセスできません。隣の総務 PC-Admin (192.168.10.12) からは正常に接続できています。",
  initialState: {
    devices: {
      sw1: {
        id: "sw1",
        hostname: "SW-Floor1",
        type: "switch",
        position: { x: 340, y: 125 },
        interfaces: {
          "Fa0/1": {
            name: "Fa0/1",
            mac: "00:aa:bb:20:00:01",
            adminUp: true,
            switchportMode: "access",
            accessVlan: 30,
          },
          "Fa0/2": {
            name: "Fa0/2",
            mac: "00:aa:bb:20:00:02",
            adminUp: true,
            switchportMode: "access",
            accessVlan: 10,
          },
          "Fa0/10": {
            name: "Fa0/10",
            mac: "00:aa:bb:20:00:10",
            adminUp: true,
            switchportMode: "access",
            accessVlan: 10,
          },
        },
        vlans: {
          1: { id: 1, name: "default", active: true },
          10: { id: 10, name: "Office", active: true },
          30: { id: 30, name: "Guest", active: true },
        },
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        cliState: { mode: "user" },
      },
      "pc-sales": {
        id: "pc-sales",
        hostname: "PC-Sales",
        type: "pc",
        position: { x: 125, y: 290 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:30:00:11",
            adminUp: true,
            ip: "192.168.10.11",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        cliState: { mode: "host" },
      },
      "pc-admin": {
        id: "pc-admin",
        hostname: "PC-Admin",
        type: "pc",
        position: { x: 340, y: 305 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:30:00:12",
            adminUp: true,
            ip: "192.168.10.12",
            subnetMask: "255.255.255.0",
          },
        },
        vlans: {},
        staticRoutes: [],
        arpTable: [],
        macTable: [],
        cliState: { mode: "host" },
      },
      "srv-file": {
        id: "srv-file",
        hostname: "SRV-File",
        type: "server",
        position: { x: 555, y: 290 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:50:56:30:01:00",
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
        id: "link-sales",
        fromDeviceId: "pc-sales",
        fromInterface: "eth0",
        toDeviceId: "sw1",
        toInterface: "Fa0/1",
        up: true,
      },
      {
        id: "link-admin",
        fromDeviceId: "pc-admin",
        fromInterface: "eth0",
        toDeviceId: "sw1",
        toInterface: "Fa0/2",
        up: true,
      },
      {
        id: "link-srv",
        fromDeviceId: "srv-file",
        fromInterface: "eth0",
        toDeviceId: "sw1",
        toInterface: "Fa0/10",
        up: true,
      },
    ],
  },
  goals: [
    {
      type: "vlan_membership",
      id: "goal-fa01-vlan10",
      description: "SW-Floor1 の Fa0/1 を社内LAN用の VLAN 10 (Office) に変更する",
      deviceId: "sw1",
      interfaceName: "Fa0/1",
      expectedVlan: 10,
      expectedMode: "access",
    },
    {
      type: "ping",
      id: "goal-sales-ping",
      description: "PC-Sales から SRV-File (192.168.10.100) へ Ping が通ること",
      sourceDeviceId: "pc-sales",
      target: "192.168.10.100",
    },
  ],
  hints: [
    "まず PC-Sales から `ping 192.168.10.100` を実行し、トポロジ上のどの機器で通信が遮断されているか確認しましょう。",
    "PC-Sales と PC-Admin の IP 設定 (`ipconfig`) に問題がない場合、L2スイッチ SW-Floor1 に接続して `show vlan brief` で各ポートの所属VLANを比較してください。",
    "SW-Floor1 の Fa0/1 がゲスト用 VLAN 30 になっていました。`conf t` → `int fa0/1` → `switchport access vlan 10` で Office VLAN (10) に戻しましょう。",
  ],
  solutionCommands: [
    {
      deviceId: "sw1",
      hostname: "SW-Floor1",
      commands: [
        "enable",
        "configure terminal",
        "interface Fa0/1",
        "switchport access vlan 10",
        "end",
      ],
    },
  ],
  solutionExplanation:
    "症状から「一部PCのみ通信不可・隣接PCは正常」とわかるため、L2ポート設定の差異を `show vlan brief` で比較するのが最短です。Fa0/1 が誤って VLAN 30 (Guest) に割り当てられていたため VLAN 10 (Office) に修正して復旧しました。",
};
