import type { ScenarioDefinition } from "@/lib/network-engine";

export const cliEtherchannelLacpScenario: ScenarioDefinition = {
  id: "cli-etherchannel-lacp",
  title: "EtherChannel (LACP) によるスイッチ間リンクアグリゲーション",
  category: "lab",
  difficulty: "中級",
  description:
    "SW1-Core と SW2-Dist の間が 2 本のケーブル (Fa0/1, Fa0/2) で接続されています。対向の SW2-Dist 側はすでに LACP passive モードで channel-group 1 が設定済みです。SW1-Core の Fa0/1 と Fa0/2 を LACP active モードで束ね、Port-Channel 1 (Po1) を稼働 (SU) させてください。",
  initialState: {
    devices: {
      sw1: {
        id: "sw1",
        hostname: "SW1-Core",
        type: "switch",
        position: { x: 185, y: 190 },
        interfaces: {
          "Fa0/1": {
            name: "Fa0/1",
            mac: "00:aa:bb:70:01:01",
            adminUp: true,
            switchportMode: "trunk",
          },
          "Fa0/2": {
            name: "Fa0/2",
            mac: "00:aa:bb:70:01:02",
            adminUp: true,
            switchportMode: "trunk",
          },
          "Fa0/10": {
            name: "Fa0/10",
            mac: "00:aa:bb:70:01:10",
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
      sw2: {
        id: "sw2",
        hostname: "SW2-Dist",
        type: "switch",
        position: { x: 495, y: 190 },
        interfaces: {
          "Fa0/1": {
            name: "Fa0/1",
            mac: "00:aa:bb:70:02:01",
            adminUp: true,
            switchportMode: "trunk",
            channelGroup: 1,
            channelMode: "passive",
          },
          "Fa0/2": {
            name: "Fa0/2",
            mac: "00:aa:bb:70:02:02",
            adminUp: true,
            switchportMode: "trunk",
            channelGroup: 1,
            channelMode: "passive",
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
    },
    links: [
      {
        id: "link-lacp-1",
        fromDeviceId: "sw1",
        fromInterface: "Fa0/1",
        toDeviceId: "sw2",
        toInterface: "Fa0/1",
        up: true,
      },
      {
        id: "link-lacp-2",
        fromDeviceId: "sw1",
        fromInterface: "Fa0/2",
        toDeviceId: "sw2",
        toInterface: "Fa0/2",
        up: true,
      },
    ],
  },
  goals: [
    {
      type: "etherchannel_up",
      id: "goal-sw1-po1",
      description:
        "SW1-Core で Port-Channel 1 (Po1) が 2 本のメンバー (P) で稼働 (SU) している",
      deviceId: "sw1",
      groupId: 1,
      minMembers: 2,
    },
    {
      type: "etherchannel_up",
      id: "goal-sw2-po1",
      description:
        "SW2-Dist 側でも Port-Channel 1 (Po1) が双方向で稼働 (SU) している",
      deviceId: "sw2",
      groupId: 1,
      minMembers: 2,
    },
  ],
  hints: [
    "まず SW2-Dist で `show etherchannel summary` や `show running-config` を実行し、どの group 番号とモード (`passive`) が使われているか確認しましょう。",
    "対向が `passive` の場合、同じ `passive` 同士では LACP ネゴシエーションが始まらずリンクが束ねられません（`active` と `passive`、または `active` 同士の組み合わせが必要です）。",
    "SW1-Core で `interface Fa0/1` と `interface Fa0/2` の両方に `channel-group 1 mode active` を設定し、`show etherchannel summary` で `Po1(SU)` と `Fa0/1(P) Fa0/2(P)` を確認してください。",
  ],
  solutionCommands: [
    {
      deviceId: "sw1",
      hostname: "SW1-Core",
      commands: [
        "enable",
        "configure terminal",
        "interface Fa0/1",
        "channel-group 1 mode active",
        "interface Fa0/2",
        "channel-group 1 mode active",
        "end",
      ],
    },
  ],
  solutionExplanation:
    "LACP (IEEE 802.3ad) では少なくとも一方が `active` モードである必要があります。SW2 が `passive` 待機しているため、SW1 側で `channel-group 1 mode active` を設定すると 2 本の物理ポートが 1 本の論理チャネル `Po1(SU)` に束ねられ、帯域倍増と冗長性を確保できます。",
};
