import type { ScenarioDefinition } from "@/lib/network-engine";

export const tsDnsFailureScenario: ScenarioDefinition = {
  id: "ts-dns-failure",
  title: "「IP直打ちなら繋がるがURL（ホスト名）で開かない」",
  category: "troubleshoot",
  difficulty: "中級",
  description:
    "クライアント PC-User のネットワーク設定と名前解決の挙動を切り分け、社内ポータル `intranet.local` へホスト名で疎通できるよう復旧してください。",
  ticketSymptom:
    "【問い合わせ内容】ブラウザで `intranet.local` を開こうとするとエラーになります。ただし、IPアドレス `192.168.20.10` を直接指定するとアクセスできる状態です。",
  initialState: {
    devices: {
      "pc-user": {
        id: "pc-user",
        hostname: "PC-User",
        type: "pc",
        position: { x: 100, y: 190 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:40:00:10",
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
        dnsServer: "192.168.99.53",
        cliState: { mode: "host" },
      },
      r1: {
        id: "r1",
        hostname: "R1-GW",
        type: "router",
        position: { x: 340, y: 190 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:40:00:00",
            adminUp: true,
            ip: "192.168.10.1",
            subnetMask: "255.255.255.0",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:40:00:01",
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
      "srv-dns": {
        id: "srv-dns",
        hostname: "SRV-Portal-DNS",
        type: "server",
        position: { x: 580, y: 190 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:50:56:40:20:10",
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
          "intranet.local": "192.168.20.10",
          "dns.local": "192.168.20.10",
        },
        cliState: { mode: "host" },
      },
    },
    links: [
      {
        id: "link-pc-r1",
        fromDeviceId: "pc-user",
        fromInterface: "eth0",
        toDeviceId: "r1",
        toInterface: "Gig0/0",
        up: true,
      },
      {
        id: "link-r1-srv",
        fromDeviceId: "r1",
        fromInterface: "Gig0/1",
        toDeviceId: "srv-dns",
        toInterface: "eth0",
        up: true,
      },
    ],
  },
  goals: [
    {
      type: "dns_setting",
      id: "goal-pc-dns",
      description: "PC-User の DNS サーバを SRV-Portal-DNS (192.168.20.10) に修正する",
      deviceId: "pc-user",
      expectedDnsIp: "192.168.20.10",
    },
    {
      type: "nslookup",
      id: "goal-nslookup",
      description: "PC-User から `nslookup intranet.local` で 192.168.20.10 が解決できる",
      sourceDeviceId: "pc-user",
      hostname: "intranet.local",
      expectedIp: "192.168.20.10",
    },
    {
      type: "ping",
      id: "goal-host-ping",
      description: "PC-User から `ping intranet.local` が成功する",
      sourceDeviceId: "pc-user",
      target: "intranet.local",
    },
  ],
  hints: [
    "IP直打ち (`ping 192.168.20.10`) が通るならL1〜L3の経路は正常です。PC-User で `ipconfig` と `nslookup intranet.local` を実行して名前解決の状態を確認しましょう。",
    "`nslookup` で `192.168.99.53` への問い合わせが失敗しています。SRV-Portal-DNS をクリックして `ipconfig` で正しいDNSサーバのIPとゾーンレコードを確認しましょう。",
    "PC-User で `set dns 192.168.20.10` を実行し、`nslookup intranet.local` および `ping intranet.local` で復旧を確認してください。",
  ],
  solutionCommands: [
    {
      deviceId: "pc-user",
      hostname: "PC-User",
      commands: ["set dns 192.168.20.10", "nslookup intranet.local", "ping intranet.local"],
    },
  ],
  solutionExplanation:
    "「IP疎通OK・ホスト名NG」はL7のDNS設定不良の典型症状です。`ipconfig` と `nslookup` で存在しない旧DNSサーバ (192.168.99.53) へ問い合わせていることを特定し、`set dns 192.168.20.10` で正しい社内DNSへ向けて復旧しました。",
};
