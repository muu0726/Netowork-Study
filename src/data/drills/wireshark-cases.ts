export interface ProtocolLayerField {
  label: string;
  value: string;
  abnormal?: boolean;
}

export interface ProtocolLayerNode {
  name: string;
  summary: string;
  highlight?: "error" | "warn";
  fields: ProtocolLayerField[];
}

export interface CapturePacket {
  no: number;
  time: string;
  source: string;
  destination: string;
  protocol: "TCP" | "ARP" | "DNS" | "ICMP" | "HTTP";
  length: number;
  info: string;
  severity?: "normal" | "warn" | "error";
  layers: ProtocolLayerNode[];
  hexDump: string[];
}

export interface WiresharkDrillCase {
  id: string;
  title: string;
  difficulty: "初級" | "中級" | "実践";
  symptom: string;
  targetPacketNo: number;
  validPacketNos: number[];
  packets: CapturePacket[];
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export const WIRESHARK_DRILL_CASES: WiresharkDrillCase[] = [
  {
    id: "ws-tcp-rst",
    title: "WebAPI (Port 8080) への接続が即座に拒否される",
    difficulty: "初級",
    symptom:
      "クライアント (192.168.10.20) から社内APIサーバ (192.168.20.50:8080) へ接続すると、待機時間なしで即座に「Connection Refused」になります。下のキャプチャから原因を示すパケット番号と根本原因を特定してください。",
    targetPacketNo: 4,
    validPacketNos: [4],
    packets: [
      {
        no: 1,
        time: "0.000000",
        source: "192.168.10.20",
        destination: "192.168.20.50",
        protocol: "ICMP",
        length: 74,
        info: "Echo (ping) request  id=0x0010, seq=1/256, ttl=64",
        severity: "normal",
        layers: [
          {
            name: "Frame 1",
            summary: "74 bytes on wire",
            fields: [
              { label: "Arrival Time", value: "0.000000 sec" },
              { label: "Frame Length", value: "74 bytes" },
            ],
          },
          {
            name: "Internet Protocol Version 4",
            summary: "Src: 192.168.10.20, Dst: 192.168.20.50",
            fields: [
              { label: "Source Address", value: "192.168.10.20" },
              { label: "Destination Address", value: "192.168.20.50" },
              { label: "Time to Live", value: "64" },
            ],
          },
          {
            name: "Internet Control Message Protocol",
            summary: "Type: 8 (Echo request)",
            fields: [{ label: "Type", value: "8 (Echo request)" }],
          },
        ],
        hexDump: [
          "0000  00 0c 29 01 00 00 00 11  22 33 44 20 08 00 45 00  ..).....\"3D ..E.",
          "0010  00 3c 12 34 00 00 40 01  a1 b2 c0 a8 0a 14 c0 a8  .<.4..@.........",
          "0020  14 32 08 00 4d 5b 00 10  01 00 61 62 63 64 65 66  .2..M[....abcdef",
        ],
      },
      {
        no: 2,
        time: "0.001420",
        source: "192.168.20.50",
        destination: "192.168.10.20",
        protocol: "ICMP",
        length: 74,
        info: "Echo (ping) reply    id=0x0010, seq=1/256, ttl=63",
        severity: "normal",
        layers: [
          {
            name: "Frame 2",
            summary: "74 bytes on wire",
            fields: [{ label: "Arrival Time", value: "0.001420 sec" }],
          },
          {
            name: "Internet Protocol Version 4",
            summary: "Src: 192.168.20.50, Dst: 192.168.10.20",
            fields: [
              { label: "Source Address", value: "192.168.20.50" },
              { label: "Destination Address", value: "192.168.10.20" },
              { label: "Time to Live", value: "63" },
            ],
          },
        ],
        hexDump: [
          "0000  00 11 22 33 44 20 00 0c  29 01 00 00 08 00 45 00  ..\"3D ..).....E.",
          "0010  00 3c 56 78 00 00 3f 01  5d 6e c0 a8 14 32 c0 a8  .<Vx..?..n...2..",
          "0020  0a 14 00 00 55 5b 00 10  01 00 61 62 63 64 65 66  ....U[....abcdef",
        ],
      },
      {
        no: 3,
        time: "0.010100",
        source: "192.168.10.20",
        destination: "192.168.20.50",
        protocol: "TCP",
        length: 66,
        info: "52104 → 8080 [SYN] Seq=0 Win=64240 Len=0 MSS=1460",
        severity: "normal",
        layers: [
          {
            name: "Frame 3",
            summary: "66 bytes on wire",
            fields: [{ label: "Arrival Time", value: "0.010100 sec" }],
          },
          {
            name: "Internet Protocol Version 4",
            summary: "Src: 192.168.10.20, Dst: 192.168.20.50",
            fields: [
              { label: "Source Address", value: "192.168.10.20" },
              { label: "Destination Address", value: "192.168.20.50" },
            ],
          },
          {
            name: "Transmission Control Protocol",
            summary: "Src Port: 52104, Dst Port: 8080, Flags: SYN",
            fields: [
              { label: "Source Port", value: "52104" },
              { label: "Destination Port", value: "8080" },
              { label: "Flags", value: "0x002 (SYN)" },
            ],
          },
        ],
        hexDump: [
          "0000  00 0c 29 01 00 00 00 11  22 33 44 20 08 00 45 00  ..).....\"3D ..E.",
          "0010  00 34 2a 10 40 00 40 06  8b 11 c0 a8 0a 14 c0 a8  .4*.@.@.........",
          "0020  14 32 cb 88 1f 90 00 00  00 01 00 00 00 00 80 02  .2..............",
        ],
      },
      {
        no: 4,
        time: "0.011250",
        source: "192.168.20.50",
        destination: "192.168.10.20",
        protocol: "TCP",
        length: 54,
        info: "8080 → 52104 [RST, ACK] Seq=1 Ack=1 Win=0 Len=0",
        severity: "error",
        layers: [
          {
            name: "Frame 4",
            summary: "54 bytes on wire",
            fields: [{ label: "Arrival Time", value: "0.011250 sec" }],
          },
          {
            name: "Internet Protocol Version 4",
            summary: "Src: 192.168.20.50, Dst: 192.168.10.20",
            fields: [
              { label: "Source Address", value: "192.168.20.50" },
              { label: "Destination Address", value: "192.168.10.20" },
            ],
          },
          {
            name: "Transmission Control Protocol",
            summary: "Src Port: 8080, Dst Port: 52104, Flags: RST, ACK",
            highlight: "error",
            fields: [
              { label: "Source Port", value: "8080" },
              { label: "Destination Port", value: "52104" },
              {
                label: "Flags",
                value: "0x014 (RST, ACK) — Connection Refused",
                abnormal: true,
              },
              { label: "Window", value: "0" },
            ],
          },
        ],
        hexDump: [
          "0000  00 11 22 33 44 20 00 0c  29 01 00 00 08 00 45 00  ..\"3D ..).....E.",
          "0010  00 28 3b 22 40 00 3f 06  7a 0b c0 a8 14 32 c0 a8  .(;\"@.?.z....2..",
          "0020  0a 14 1f 90 cb 88 00 00  00 01 00 00 00 01 50 14  ..............P.",
        ],
      },
    ],
    options: [
      "L3経路は到達しており、サーバ側の 8080番ポートが未起動(CLOSE)のため TCP RST, ACK で拒否されている",
      "L2スイッチで VLAN 不一致が起きており、パケットがサーバに一切届いていない",
      "DNS サーバが NXDOMAIN を返しているため通信を開始できていない",
      "ルータの TTL 超過により途中でパケットがループ破棄されている",
    ],
    correctOptionIndex: 0,
    explanation:
      "No.1〜2 で ICMP Ping が往復成功しているため L1〜L3 経路は正常です。さらに No.3 の TCP [SYN] に対して No.4 で 1ms 後にサーバ自身から [RST, ACK] が返っているため、「サーバ側アプリ (Port 8080) が停止している／Firewallが積極拒否している」と確定できます。",
  },
  {
    id: "ws-arp-fail",
    title: "LAN 内の他セグメントへ一切通信できない (無応答)",
    difficulty: "中級",
    symptom:
      "新規設置した PC (192.168.10.55) から外部通信を試みましたがタイムアウトします。PC の NIC 上で取得したキャプチャから、通信が止まっている原因のパケットと理由を選んでください。",
    targetPacketNo: 2,
    validPacketNos: [1, 2, 3],
    packets: [
      {
        no: 1,
        time: "0.000000",
        source: "00:11:22:aa:bb:55",
        destination: "Broadcast",
        protocol: "ARP",
        length: 42,
        info: "Who has 192.168.10.1? Tell 192.168.10.55",
        severity: "warn",
        layers: [
          {
            name: "Ethernet II",
            summary: "Src: 00:11:22:aa:bb:55, Dst: Broadcast (ff:ff:ff:ff:ff:ff)",
            fields: [
              { label: "Source", value: "00:11:22:aa:bb:55" },
              { label: "Destination", value: "ff:ff:ff:ff:ff:ff" },
            ],
          },
          {
            name: "Address Resolution Protocol (request)",
            summary: "Sender IP: 192.168.10.55, Target IP: 192.168.10.1",
            highlight: "warn",
            fields: [
              { label: "Opcode", value: "request (1)" },
              { label: "Sender IP address", value: "192.168.10.55" },
              { label: "Target MAC address", value: "00:00:00:00:00:00" },
              { label: "Target IP address", value: "192.168.10.1" },
            ],
          },
        ],
        hexDump: [
          "0000  ff ff ff ff ff ff 00 11  22 aa bb 55 08 06 00 01  ........\"..U....",
          "0010  08 00 06 04 00 01 00 11  22 aa bb 55 c0 a8 0a 37  ........\"..U...7",
          "0020  00 00 00 00 00 00 c0 a8  0a 01                    ..........",
        ],
      },
      {
        no: 2,
        time: "1.002100",
        source: "00:11:22:aa:bb:55",
        destination: "Broadcast",
        protocol: "ARP",
        length: 42,
        info: "Who has 192.168.10.1? Tell 192.168.10.55 [Retry 1 - No Reply]",
        severity: "error",
        layers: [
          {
            name: "Ethernet II",
            summary: "Src: 00:11:22:aa:bb:55, Dst: Broadcast (ff:ff:ff:ff:ff:ff)",
            fields: [
              { label: "Destination", value: "ff:ff:ff:ff:ff:ff" },
            ],
          },
          {
            name: "Address Resolution Protocol (request)",
            summary: "Retransmitted ARP Request — No Reply Received",
            highlight: "error",
            fields: [
              { label: "Opcode", value: "request (1)" },
              { label: "Target IP address", value: "192.168.10.1" },
              {
                label: "Status",
                value: "1秒経過しても ARP Reply なし (L2到達不可)",
                abnormal: true,
              },
            ],
          },
        ],
        hexDump: [
          "0000  ff ff ff ff ff ff 00 11  22 aa bb 55 08 06 00 01  ........\"..U....",
          "0010  08 00 06 04 00 01 00 11  22 aa bb 55 c0 a8 0a 37  ........\"..U...7",
          "0020  00 00 00 00 00 00 c0 a8  0a 01                    ..........",
        ],
      },
      {
        no: 3,
        time: "2.004500",
        source: "00:11:22:aa:bb:55",
        destination: "Broadcast",
        protocol: "ARP",
        length: 42,
        info: "Who has 192.168.10.1? Tell 192.168.10.55 [Retry 2 - No Reply]",
        severity: "error",
        layers: [
          {
            name: "Address Resolution Protocol (request)",
            summary: "Retransmitted ARP Request — ARP Timeout",
            highlight: "error",
            fields: [
              { label: "Target IP address", value: "192.168.10.1" },
              {
                label: "Status",
                value: "ARP Timeout (VLAN不一致またはGWリンクダウン)",
                abnormal: true,
              },
            ],
          },
        ],
        hexDump: [
          "0000  ff ff ff ff ff ff 00 11  22 aa bb 55 08 06 00 01  ........\"..U....",
          "0010  08 00 06 04 00 01 00 11  22 aa bb 55 c0 a8 0a 37  ........\"..U...7",
          "0020  00 00 00 00 00 00 c0 a8  0a 01                    ..........",
        ],
      },
    ],
    options: [
      "デフォルトゲートウェイ (192.168.10.1) への ARP Request に対して Reply が全く返らず、L2レベル (VLAN不一致・ポート停止等) で遮断されている",
      "ゲートウェイ側の 443番ポートが閉じているため TCP RST が返っている",
      "DNS サーバが名前解決を拒否している",
      "宛先サーバから ICMP Redirect を受信している",
    ],
    correctOptionIndex: 0,
    explanation:
      "TCP や ICMP パケットを送る前段階である ARP Request（192.168.10.1 の MAC は誰？）に対して 1秒おきに再送が発生し応答がありません。VLAN 割り当てミス、スイッチリンクダウン、またはゲートウェイIPの設定誤りを確認すべき状態です。",
  },
  {
    id: "ws-dns-nxdomain",
    title: "社内ポータルサイトへのアクセスが名前エラーになる",
    difficulty: "初級",
    symptom:
      "社員が社内ポータルを開こうとしたところブラウザに「サイトが見つかりません」と表示されました。直前の通信キャプチャから原因パケットを特定してください。",
    targetPacketNo: 2,
    validPacketNos: [2],
    packets: [
      {
        no: 1,
        time: "0.000000",
        source: "192.168.10.15",
        destination: "192.168.20.53",
        protocol: "DNS",
        length: 76,
        info: "Standard query 0x4b12 A portal.intrnaet.local",
        severity: "normal",
        layers: [
          {
            name: "User Datagram Protocol",
            summary: "Src Port: 54120, Dst Port: 53",
            fields: [
              { label: "Source Port", value: "54120" },
              { label: "Destination Port", value: "53" },
            ],
          },
          {
            name: "Domain Name System (query)",
            summary: "Transaction ID: 0x4b12, Query: portal.intrnaet.local (A)",
            fields: [
              { label: "Transaction ID", value: "0x4b12" },
              { label: "Query Name", value: "portal.intrnaet.local" },
              { label: "Type", value: "A (Host Address)" },
            ],
          },
        ],
        hexDump: [
          "0000  45 00 00 3e 11 22 00 00  40 11 55 66 c0 a8 0a 0f  E..>.\"..@.Uf....",
          "0010  c0 a8 14 35 d3 68 00 35  00 2a ab cd 4b 12 01 00  ...5.h.5.*..K...",
          "0020  00 01 00 00 00 00 00 00  06 70 6f 72 74 61 6c 00  .........portal.",
        ],
      },
      {
        no: 2,
        time: "0.003810",
        source: "192.168.20.53",
        destination: "192.168.10.15",
        protocol: "DNS",
        length: 92,
        info: "Standard query response 0x4b12 No such name A portal.intrnaet.local",
        severity: "error",
        layers: [
          {
            name: "User Datagram Protocol",
            summary: "Src Port: 53, Dst Port: 54120",
            fields: [
              { label: "Source Port", value: "53" },
              { label: "Destination Port", value: "54120" },
            ],
          },
          {
            name: "Domain Name System (response)",
            summary: "Transaction ID: 0x4b12, Reply code: No such name (3)",
            highlight: "error",
            fields: [
              { label: "Transaction ID", value: "0x4b12" },
              {
                label: "Reply code",
                value: "No such name (NXDOMAIN / RCODE=3)",
                abnormal: true,
              },
              {
                label: "Queried Name",
                value: "portal.intrnaet.local (綴り誤りまたは未登録)",
                abnormal: true,
              },
            ],
          },
        ],
        hexDump: [
          "0000  45 00 00 4e 22 33 00 00  3f 11 44 55 c0 a8 14 35  E..N\"3..?.DU...5",
          "0010  c0 a8 0a 0f 00 35 d3 68  00 3a ef 01 4b 12 81 83  .....5.h.:..K...",
          "0020  00 01 00 00 00 00 00 00  06 70 6f 72 74 61 6c 00  .........portal.",
        ],
      },
    ],
    options: [
      "DNS サーバまでは到達しているが、要求ドメイン名 (portal.intrnaet.local) に対するレコードが存在せず NXDOMAIN が返っている",
      "DNS サーバ自体が停止しており UDP/53 の応答が無い",
      "Web サーバの TLS 証明書検証に失敗している",
      "ルータのデフォルトルートが欠落している",
    ],
    correctOptionIndex: 0,
    explanation:
      "No.2 に DNS サーバ (192.168.20.53) からの応答パケットが届いているため、DNS サーバまでの到達性は正常です。Reply code が「No such name (NXDOMAIN)」であり、クライアント側のURLタイポ (intrnaet) または DNS ゾーン側の A レコード登録漏れが原因と特定できます。",
  },
];
