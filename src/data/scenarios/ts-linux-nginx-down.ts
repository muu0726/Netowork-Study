import type { ScenarioDefinition } from "@/lib/network-engine";

export const tsLinuxNginxDownScenario: ScenarioDefinition = {
  id: "ts-linux-nginx-down",
  title: "「Pingは通るのにWebサイト(HTTP/HTTPS)がConnection refusedになる」",
  category: "troubleshoot",
  difficulty: "中級",
  description:
    "運用端末 PC-Ops から Web サーバ SRV-Web (`web.prod.local`) へ Ping と DNS (`dig`) は通るのに、HTTP/HTTPS アクセスだけ `Connection refused` で失敗しています。Linux 実務コマンド (`ss -tulpn`, `systemctl`, `curl -v`) を使って原因を特定・復旧してください。",
  ticketSymptom:
    "【問い合わせ内容】メンテナンス再起動後から本番社内サイト `https://web.prod.local` が開きません。監視サーバからの ICMP (Ping) は正常応答しているため、サーバ側のプロセス・ポート待ち受け状態を確認してほしいです。",
  initialState: {
    devices: {
      "pc-ops": {
        id: "pc-ops",
        hostname: "PC-Ops",
        type: "pc",
        position: { x: 100, y: 190 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:11:22:90:10:10",
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
        hostname: "R1-GW",
        type: "router",
        position: { x: 340, y: 190 },
        interfaces: {
          "Gig0/0": {
            name: "Gig0/0",
            mac: "00:0c:29:90:00:00",
            adminUp: true,
            ip: "192.168.10.1",
            subnetMask: "255.255.255.0",
          },
          "Gig0/1": {
            name: "Gig0/1",
            mac: "00:0c:29:90:00:01",
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
      "srv-web": {
        id: "srv-web",
        hostname: "SRV-Web",
        type: "server",
        position: { x: 580, y: 190 },
        interfaces: {
          eth0: {
            name: "eth0",
            mac: "00:50:56:90:20:10",
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
          "web.prod.local": "192.168.20.10",
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
        id: "link-ops-r1",
        fromDeviceId: "pc-ops",
        fromInterface: "eth0",
        toDeviceId: "r1",
        toInterface: "Gig0/0",
        up: true,
      },
      {
        id: "link-r1-srv",
        fromDeviceId: "r1",
        fromInterface: "Gig0/1",
        toDeviceId: "srv-web",
        toInterface: "eth0",
        up: true,
      },
    ],
  },
  goals: [
    {
      type: "ping",
      id: "goal-dns-ping",
      description: "PC-Ops から web.prod.local への名前解決と ICMP 疎通が正常である",
      sourceDeviceId: "pc-ops",
      target: "web.prod.local",
    },
    {
      type: "tcp_connect",
      id: "goal-http-up",
      description: "PC-Ops から web.prod.local の HTTP (TCP 80) へ接続できる",
      sourceDeviceId: "pc-ops",
      target: "web.prod.local",
      port: 80,
      expectSuccess: true,
    },
    {
      type: "tcp_connect",
      id: "goal-https-up",
      description: "PC-Ops から web.prod.local の HTTPS (TCP 443) へ接続できる",
      sourceDeviceId: "pc-ops",
      target: "web.prod.local",
      port: 443,
      expectSuccess: true,
    },
  ],
  hints: [
    "PC-Ops で `dig web.prod.local` と `curl -v https://web.prod.local` を実行し、DNS・L3経路とポート接続 (`Connection refused`) を切り分けましょう。",
    "続いて SRV-Web をクリックして `ip a`, `ss -tulpn`, `systemctl status nginx` を実行してください。ポート 22 (`sshd`) だけ LISTEN しており、Web デーモン (`nginx`) が停止 (`inactive (dead)`) しています。",
    "SRV-Web で `systemctl start nginx` を実行し、`ss -tulpn` で `:80` と `:443` が LISTEN したことを確認後、PC-Ops から `curl -v https://web.prod.local` で TLS 1.3 ハンドシェイクと HTTP 200 OK を確認してください。",
  ],
  solutionCommands: [
    {
      deviceId: "srv-web",
      hostname: "SRV-Web",
      commands: [
        "systemctl status nginx",
        "systemctl start nginx",
        "ss -tulpn",
      ],
    },
    {
      deviceId: "pc-ops",
      hostname: "PC-Ops",
      commands: ["dig web.prod.local", "curl -v https://web.prod.local"],
    },
  ],
  solutionExplanation:
    "Ping (ICMP / L3) が成功して `dig` でも名前解決が成功している場合、L3 までは正常であり L4〜L7（ファイアウォール遮断かプロセス停止）が原因です。`ss -tulpn` と `systemctl status nginx` により nginx 停止を特定し、`systemctl start nginx` で 80/443番ポートの待ち受けを復旧させました。",
};
