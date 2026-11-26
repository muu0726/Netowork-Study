"use client";

import { motion } from "framer-motion";
import type { DiagramVariant } from "@/data/lessons/types";

function renderDiagramContent(variant: DiagramVariant) {
  switch (variant) {
    case "lan-wan":
      return (
        <g>
          {/* LAN Zone */}
          <rect x={24} y={24} width={250} height={192} rx={12} fill="rgba(34,211,238,0.05)" stroke="#22d3ee" strokeOpacity={0.35} strokeDasharray="5 4" />
          <text x={38} y={46} fill="#67e8f9" fontSize={11} fontFamily="monospace" fontWeight={700}>社内 LAN (192.168.10.0/24)</text>
          {/* WAN Zone */}
          <rect x={370} y={24} width={246} height={192} rx={12} fill="rgba(167,139,250,0.05)" stroke="#a78bfa" strokeOpacity={0.35} strokeDasharray="5 4" />
          <text x={384} y={46} fill="#c4b5fd" fontSize={11} fontFamily="monospace" fontWeight={700}>WAN / 外部ネットワーク</text>

          <line x1={96} y1={130} x2={200} y2={130} stroke="#10b981" strokeWidth={2.5} />
          <line x1={200} y1={130} x2={322} y2={130} stroke="#10b981" strokeWidth={2.5} />
          <line x1={322} y1={130} x2={470} y2={130} stroke="#a78bfa" strokeWidth={2.5} />

          <motion.circle
            cy={130}
            r={5}
            fill="#22d3ee"
            initial={{ cx: 96 }}
            animate={{ cx: [96, 322, 470] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />

          <rect x={44} y={108} width={66} height={44} rx={8} fill="#0d1322" stroke="#38bdf8" strokeWidth={1.8} />
          <text x={77} y={134} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontFamily="monospace">PC-A</text>

          <rect x={165} y={108} width={74} height={44} rx={8} fill="#0d1322" stroke="#f59e0b" strokeWidth={1.8} />
          <text x={202} y={134} textAnchor="middle" fill="#fef3c7" fontSize={11} fontFamily="monospace">L2SW</text>

          <circle cx={322} cy={130} r={26} fill="#0d1322" stroke="#22d3ee" strokeWidth={2} />
          <text x={322} y={134} textAnchor="middle" fill="#67e8f9" fontSize={11} fontFamily="monospace" fontWeight={700}>Router</text>
          <text x={322} y={172} textAnchor="middle" fill="#94a3b8" fontSize={10}>Default GW境界</text>

          <rect x={470} y={108} width={116} height={44} rx={8} fill="#0d1322" stroke="#a78bfa" strokeWidth={1.8} />
          <text x={528} y={134} textAnchor="middle" fill="#ede9fe" fontSize={11} fontFamily="monospace">支社 / Cloud</text>
        </g>
      );

    case "osi-tcpip":
      return (
        <g>
          <text x={320} y={28} textAnchor="middle" fill="#cbd5e1" fontSize={12} fontWeight={700}>
            カプセル化：上位データに順番にヘッダを付与
          </text>
          {[
            { y: 46, w: 180, color: "#a78bfa", label: "L7–L5 アプリデータ (HTTP/DNS)" },
            { y: 84, w: 280, color: "#38bdf8", label: "L4 [TCP/UDPヘッダ] + データ = セグメント" },
            { y: 122, w: 390, color: "#22d3ee", label: "L3 [IPヘッダ] + セグメント = パケット" },
            { y: 160, w: 510, color: "#f59e0b", label: "L2 [MACヘッダ] + パケット + [FCS] = フレーム" },
            { y: 198, w: 580, color: "#10b981", label: "L1 01011010101... 電気・光信号 (ビット)" },
          ].map((row, idx) => (
            <motion.g
              key={row.label}
              initial={{ opacity: 0.5, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.12, duration: 0.4 }}
            >
              <rect
                x={320 - row.w / 2}
                y={row.y}
                width={row.w}
                height={30}
                rx={6}
                fill="#0d1322"
                stroke={row.color}
                strokeWidth={1.6}
              />
              <text
                x={320}
                y={row.y + 19}
                textAnchor="middle"
                fill="#f1f5f9"
                fontSize={11}
                fontFamily="monospace"
              >
                {row.label}
              </text>
            </motion.g>
          ))}
        </g>
      );

    case "ip-mac":
      return (
        <g>
          <rect x={44} y={76} width={132} height={70} rx={10} fill="#0d1322" stroke="#38bdf8" strokeWidth={1.8} />
          <text x={110} y={104} textAnchor="middle" fill="#e2e8f0" fontSize={12} fontFamily="monospace" fontWeight={700}>PC1</text>
          <text x={110} y={122} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">192.168.10.10</text>
          <text x={110} y={136} textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="monospace">MAC: aa:11</text>

          <rect x={464} y={76} width={132} height={70} rx={10} fill="#0d1322" stroke="#22d3ee" strokeWidth={1.8} />
          <text x={530} y={104} textAnchor="middle" fill="#e2e8f0" fontSize={12} fontFamily="monospace" fontWeight={700}>Router GW</text>
          <text x={530} y={122} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">192.168.10.1</text>
          <text x={530} y={136} textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="monospace">MAC: cc:01</text>

          <line x1={176} y1={96} x2={464} y2={96} stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" />
          <text x={320} y={86} textAnchor="middle" fill="#fcd34d" fontSize={10} fontFamily="monospace">
            1. ARP Request (Broadcast): 192.168.10.1 の MAC は誰？
          </text>

          <line x1={464} y1={128} x2={176} y2={128} stroke="#10b981" strokeWidth={2} />
          <text x={320} y={148} textAnchor="middle" fill="#6ee7b7" fontSize={10} fontFamily="monospace">
            2. ARP Reply (Unicast): 私の MAC は cc:01 です
          </text>

          <rect x={180} y={176} width={280} height={38} rx={8} fill="#05080f" stroke="#1e293b" />
          <text x={320} y={199} textAnchor="middle" fill="#67e8f9" fontSize={11} fontFamily="monospace">
            ARPキャッシュ保存: 192.168.10.1 ↔ cc:01
          </text>
        </g>
      );

    case "subnetting":
      return (
        <g>
          <text x={320} y={36} textAnchor="middle" fill="#e2e8f0" fontSize={13} fontFamily="monospace" fontWeight={700}>
            192.168.10.75 /26 (255.255.255.192)
          </text>
          <rect x={44} y={64} width={400} height={54} rx={8} fill="rgba(34,211,238,0.12)" stroke="#22d3ee" strokeWidth={1.8} />
          <text x={244} y={88} textAnchor="middle" fill="#67e8f9" fontSize={12} fontFamily="monospace" fontWeight={700}>
            ネットワーク部 (26 bit)
          </text>
          <text x={244} y={106} textAnchor="middle" fill="#bae6fd" fontSize={11} fontFamily="monospace">
            11000000 . 10101000 . 00001010 . 01
          </text>

          <rect x={452} y={64} width={144} height={54} rx={8} fill="rgba(245,158,11,0.12)" stroke="#f59e0b" strokeWidth={1.8} />
          <text x={524} y={88} textAnchor="middle" fill="#fcd34d" fontSize={12} fontFamily="monospace" fontWeight={700}>
            ホスト部 (6 bit)
          </text>
          <text x={524} y={106} textAnchor="middle" fill="#fde68a" fontSize={11} fontFamily="monospace">
            001011
          </text>

          <rect x={44} y={142} width={552} height={68} rx={8} fill="#0d1322" stroke="#1e293b" />
          <text x={64} y={168} fill="#67e8f9" fontSize={11} fontFamily="monospace">
            Network: 192.168.10.64 (ホスト部 000000) | Broadcast: .127 (ホスト部 111111)
          </text>
          <text x={64} y={192} fill="#10b981" fontSize={11} fontFamily="monospace">
            利用可能ホスト範囲: 192.168.10.65 〜 192.168.10.126 (2^6 - 2 = 62台)
          </text>
        </g>
      );

    case "tcp-udp":
      return (
        <g>
          <rect x={48} y={36} width={110} height={36} rx={8} fill="#0d1322" stroke="#38bdf8" strokeWidth={1.8} />
          <text x={103} y={58} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontFamily="monospace">Client</text>
          <rect x={482} y={36} width={110} height={36} rx={8} fill="#0d1322" stroke="#a78bfa" strokeWidth={1.8} />
          <text x={537} y={58} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontFamily="monospace">Server :443</text>

          <line x1={103} y1={72} x2={103} y2={212} stroke="#334155" strokeWidth={2} />
          <line x1={537} y1={72} x2={537} y2={212} stroke="#334155" strokeWidth={2} />

          <line x1={103} y1={96} x2={537} y2={116} stroke="#22d3ee" strokeWidth={2} />
          <text x={320} y={96} textAnchor="middle" fill="#67e8f9" fontSize={11} fontFamily="monospace">1. TCP [SYN] 接続要求</text>

          <line x1={537} y1={134} x2={103} y2={154} stroke="#10b981" strokeWidth={2} />
          <text x={320} y={136} textAnchor="middle" fill="#6ee7b7" fontSize={11} fontFamily="monospace">2. TCP [SYN, ACK] 応答・同期</text>

          <line x1={103} y1={174} x2={537} y2={194} stroke="#22d3ee" strokeWidth={2} />
          <text x={320} y={176} textAnchor="middle" fill="#67e8f9" fontSize={11} fontFamily="monospace">3. TCP [ACK] 確立 (ESTABLISHED)</text>
        </g>
      );

    case "dns-http":
      return (
        <g>
          <rect x={36} y={90} width={104} height={54} rx={8} fill="#0d1322" stroke="#38bdf8" strokeWidth={1.8} />
          <text x={88} y={121} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontFamily="monospace">Browser</text>

          <rect x={268} y={28} width={128} height={54} rx={8} fill="#0d1322" stroke="#a78bfa" strokeWidth={1.8} />
          <text x={332} y={53} textAnchor="middle" fill="#ede9fe" fontSize={11} fontFamily="monospace">DNS Server :53</text>
          <text x={332} y={69} textAnchor="middle" fill="#c4b5fd" fontSize={9} fontFamily="monospace">192.168.20.10</text>

          <rect x={496} y={90} width={114} height={54} rx={8} fill="#0d1322" stroke="#10b981" strokeWidth={1.8} />
          <text x={553} y={115} textAnchor="middle" fill="#d1fae5" fontSize={11} fontFamily="monospace">Web :443</text>
          <text x={553} y={131} textAnchor="middle" fill="#6ee7b7" fontSize={9} fontFamily="monospace">intranet.local</text>

          <line x1={140} y1={104} x2={268} y2={62} stroke="#a78bfa" strokeWidth={2} />
          <text x={182} y={68} textAnchor="middle" fill="#c4b5fd" fontSize={10} fontFamily="monospace">1. Query: intranet.local?</text>

          <line x1={140} y1={126} x2={496} y2={126} stroke="#10b981" strokeWidth={2.2} />
          <text x={320} y={168} textAnchor="middle" fill="#6ee7b7" fontSize={11} fontFamily="monospace">
            2. Aレコード解決 (192.168.20.10) → HTTPS GET 通信開始
          </text>
        </g>
      );

    case "vlan-trunk":
      return (
        <g>
          <circle cx={320} cy={46} r={24} fill="#0d1322" stroke="#22d3ee" strokeWidth={2} />
          <text x={320} y={50} textAnchor="middle" fill="#67e8f9" fontSize={11} fontFamily="monospace" fontWeight={700}>R1</text>

          <line x1={320} y1={70} x2={320} y2={122} stroke="#f59e0b" strokeWidth={3} />
          <text x={410} y={98} fill="#fcd34d" fontSize={10} fontFamily="monospace">802.1Q Trunk (VLAN 10, 20)</text>

          <rect x={256} y={122} width={128} height={36} rx={8} fill="#0d1322" stroke="#f59e0b" strokeWidth={2} />
          <text x={320} y={144} textAnchor="middle" fill="#fef3c7" fontSize={11} fontFamily="monospace" fontWeight={700}>L2SW (Fa0/24 Trunk)</text>

          <line x1={276} y1={158} x2={156} y2={192} stroke="#22d3ee" strokeWidth={2} />
          <line x1={364} y1={158} x2={484} y2={192} stroke="#a78bfa" strokeWidth={2} />

          <rect x={80} y={184} width={132} height={38} rx={8} fill="#0d1322" stroke="#22d3ee" strokeWidth={1.6} />
          <text x={146} y={207} textAnchor="middle" fill="#67e8f9" fontSize={10} fontFamily="monospace">VLAN 10 (Sales)</text>

          <rect x={428} y={184} width={132} height={38} rx={8} fill="#0d1322" stroke="#a78bfa" strokeWidth={1.6} />
          <text x={494} y={207} textAnchor="middle" fill="#c4b5fd" fontSize={10} fontFamily="monospace">VLAN 20 (Dev)</text>
        </g>
      );

    case "stp-etherchannel":
      return (
        <g>
          <rect x={245} y={28} width={150} height={38} rx={8} fill="#0d1322" stroke="#22d3ee" strokeWidth={2} />
          <text x={320} y={51} textAnchor="middle" fill="#67e8f9" fontSize={11} fontFamily="monospace" fontWeight={700}>Root Bridge (SW1)</text>

          <rect x={80} y={154} width={124} height={42} rx={8} fill="#0d1322" stroke="#f59e0b" strokeWidth={1.8} />
          <text x={142} y={179} textAnchor="middle" fill="#fef3c7" fontSize={11} fontFamily="monospace">SW2</text>

          <rect x={436} y={154} width={124} height={42} rx={8} fill="#0d1322" stroke="#f59e0b" strokeWidth={1.8} />
          <text x={498} y={179} textAnchor="middle" fill="#fef3c7" fontSize={11} fontFamily="monospace">SW3</text>

          {/* EtherChannel */}
          <line x1={265} y1={66} x2={150} y2={154} stroke="#10b981" strokeWidth={2} />
          <line x1={275} y1={66} x2={160} y2={154} stroke="#10b981" strokeWidth={2} />
          <ellipse cx={212} cy={110} rx={16} ry={8} fill="none" stroke="#22d3ee" strokeWidth={1.6} />
          <text x={134} y={102} fill="#6ee7b7" fontSize={10} fontFamily="monospace">LACP Po1</text>

          {/* Forwarding */}
          <line x1={370} y1={66} x2={490} y2={154} stroke="#10b981" strokeWidth={2.2} />
          {/* STP Blocked */}
          <line x1={204} y1={175} x2={436} y2={175} stroke="#f43f5e" strokeWidth={2} strokeDasharray="6 4" />
          <text x={320} y={196} textAnchor="middle" fill="#fda4af" fontSize={10} fontFamily="monospace">
            STP Blocking (ループ防止のため論理遮断)
          </text>
        </g>
      );

    case "static-ospf":
      return (
        <g>
          <text x={320} y={32} textAnchor="middle" fill="#e2e8f0" fontSize={12} fontFamily="monospace" fontWeight={700}>
            最長一致 (LPM) 優先度: /24 &gt; /16 &gt; /0
          </text>
          {[
            { y: 54, label: "S  0.0.0.0/0 [1/0] via 10.0.0.2", match: false, note: "0 bit一致 (候補)" },
            { y: 102, label: "S  192.168.0.0/16 [1/0] via 10.0.0.2", match: false, note: "16 bit一致 (候補)" },
            { y: 150, label: "O  192.168.10.0/24 [110/2] via 10.0.0.6", match: true, note: "24 bit一致 → 最長一致で採用!" },
          ].map((row) => (
            <g key={row.label}>
              <rect
                x={44}
                y={row.y}
                width={552}
                height={38}
                rx={8}
                fill={row.match ? "rgba(16,185,129,0.14)" : "#0d1322"}
                stroke={row.match ? "#10b981" : "#334155"}
                strokeWidth={row.match ? 2 : 1.4}
              />
              <text x={60} y={row.y + 23} fill="#f1f5f9" fontSize={11} fontFamily="monospace">
                {row.label}
              </text>
              <text x={580} y={row.y + 23} textAnchor="end" fill={row.match ? "#6ee7b7" : "#94a3b8"} fontSize={10} fontFamily="monospace">
                {row.note}
              </text>
            </g>
          ))}
        </g>
      );

    case "nat-napt":
      return (
        <g>
          <rect x={36} y={70} width={150} height={84} rx={8} fill="#0d1322" stroke="#38bdf8" strokeWidth={1.6} />
          <text x={111} y={96} textAnchor="middle" fill="#67e8f9" fontSize={10} fontFamily="monospace">Inside Local</text>
          <text x={111} y={118} textAnchor="middle" fill="#f1f5f9" fontSize={11} fontFamily="monospace">192.168.10.10:51001</text>
          <text x={111} y={136} textAnchor="middle" fill="#94a3b8" fontSize={11} fontFamily="monospace">192.168.10.11:51002</text>

          <rect x={242} y={76} width={156} height={72} rx={10} fill="#0d1322" stroke="#f59e0b" strokeWidth={2} />
          <text x={320} y={104} textAnchor="middle" fill="#fcd34d" fontSize={11} fontFamily="monospace" fontWeight={700}>NAT/PAT ルータ</text>
          <text x={320} y={124} textAnchor="middle" fill="#cbd5e1" fontSize={10} fontFamily="monospace">ip nat inside → outside</text>

          <rect x={454} y={70} width={150} height={84} rx={8} fill="#0d1322" stroke="#10b981" strokeWidth={1.6} />
          <text x={529} y={96} textAnchor="middle" fill="#6ee7b7" fontSize={10} fontFamily="monospace">Inside Global</text>
          <text x={529} y={118} textAnchor="middle" fill="#f1f5f9" fontSize={11} fontFamily="monospace">203.0.113.5:51001</text>
          <text x={529} y={136} textAnchor="middle" fill="#94a3b8" fontSize={11} fontFamily="monospace">203.0.113.5:51002</text>

          <line x1={186} y1={112} x2={242} y2={112} stroke="#22d3ee" strokeWidth={2} />
          <line x1={398} y1={112} x2={454} y2={112} stroke="#10b981" strokeWidth={2} />
          <text x={320} y={188} textAnchor="middle" fill="#94a3b8" fontSize={11}>
            単一のグローバルIP (203.0.113.5) をポート番号の違いで共有 (overload)
          </text>
        </g>
      );

    case "acl-security":
      return (
        <g>
          <text x={320} y={32} textAnchor="middle" fill="#e2e8f0" fontSize={12} fontFamily="monospace" fontWeight={700}>
            ACL トップダウン評価と暗黙の deny
          </text>
          {[
            { y: 50, color: "#f43f5e", text: "10 deny tcp any any eq 23     ← 一致したら即破棄" },
            { y: 98, color: "#10b981", text: "20 permit ip any any          ← 明示許可が必要" },
            { y: 146, color: "#64748b", text: "(暗黙) deny ip any any        ← 書かないと全員拒否!" },
          ].map((r) => (
            <g key={r.text}>
              <rect x={70} y={r.y} width={500} height={38} rx={8} fill="#0d1322" stroke={r.color} strokeWidth={1.6} />
              <text x={90} y={r.y + 23} fill="#f1f5f9" fontSize={11} fontFamily="monospace">{r.text}</text>
            </g>
          ))}
        </g>
      );

    case "cisco-ios":
      return (
        <g>
          {[
            { x: 40, w: 130, label: "User EXEC\nRouter>", color: "#94a3b8" },
            { x: 190, w: 140, label: "Privileged\nRouter#", color: "#22d3ee" },
            { x: 350, w: 140, label: "Global Config\n(config)#", color: "#f59e0b" },
            { x: 510, w: 100, label: "IF / VLAN\n(config-if)#", color: "#a78bfa" },
          ].map((box, i) => (
            <g key={box.label}>
              <rect x={box.x} y={84} width={box.w} height={64} rx={8} fill="#0d1322" stroke={box.color} strokeWidth={1.8} />
              <text x={box.x + box.w / 2} y={110} textAnchor="middle" fill="#f1f5f9" fontSize={10} fontFamily="monospace">
                {box.label.split("\n")[0]}
              </text>
              <text x={box.x + box.w / 2} y={128} textAnchor="middle" fill={box.color} fontSize={11} fontFamily="monospace" fontWeight={700}>
                {box.label.split("\n")[1]}
              </text>
              {i < 3 && (
                <line x1={box.x + box.w} y1={116} x2={box.x + box.w + 20} y2={116} stroke="#475569" strokeWidth={2} />
              )}
            </g>
          ))}
          <text x={180} y={70} textAnchor="middle" fill="#67e8f9" fontSize={10} fontFamily="monospace">enable</text>
          <text x={340} y={70} textAnchor="middle" fill="#fcd34d" fontSize={10} fontFamily="monospace">conf t</text>
          <text x={500} y={70} textAnchor="middle" fill="#c4b5fd" fontSize={10} fontFamily="monospace">int / vlan</text>
          <text x={320} y={188} textAnchor="middle" fill="#94a3b8" fontSize={11} fontFamily="monospace">
            exit (1段戻る) / end (Privileged # へ一気に戻る)
          </text>
        </g>
      );

    case "troubleshooting-layers":
      return (
        <g>
          {[
            { y: 34, label: "L7 アプリ / DNS (nslookup / HTTP応答)", color: "#a78bfa" },
            { y: 80, label: "L4 TCP / ポート / FW (TCP RST / SYN確認)", color: "#38bdf8" },
            { y: 126, label: "L3 IP / ルーティング (ping / traceroute / show ip route)", color: "#22d3ee" },
            { y: 172, label: "L1–L2 物理リンク / VLAN (show ip int br / show vlan br)", color: "#10b981" },
          ].map((l) => (
            <g key={l.label}>
              <rect x={80} y={l.y} width={480} height={36} rx={8} fill="#0d1322" stroke={l.color} strokeWidth={1.6} />
              <text x={320} y={l.y + 22} textAnchor="middle" fill="#f1f5f9" fontSize={11} fontFamily="monospace">{l.label}</text>
            </g>
          ))}
        </g>
      );

    case "packet-analysis":
      return (
        <g>
          <rect x={40} y={30} width={560} height={82} rx={8} fill="#05080f" stroke="#334155" />
          <text x={54} y={52} fill="#94a3b8" fontSize={10} fontFamily="monospace">1  0.000s  192.168.10.10 → 192.168.20.10  TCP  [SYN]</text>
          <text x={54} y={72} fill="#fda4af" fontSize={10} fontFamily="monospace" fontWeight={700}>2  0.002s  192.168.20.10 → 192.168.10.10  TCP  [RST, ACK]  ← 異常特定!</text>
          <text x={54} y={92} fill="#64748b" fontSize={10} fontFamily="monospace">3  0.015s  192.168.10.10 → 192.168.20.53  DNS  NXDOMAIN</text>

          <rect x={40} y={124} width={272} height={84} rx={8} fill="#0d1322" stroke="#22d3ee" strokeWidth={1.4} />
          <text x={54} y={146} fill="#67e8f9" fontSize={10} fontFamily="monospace" fontWeight={700}>2. プロトコル階層詳細</text>
          <text x={54} y={166} fill="#cbd5e1" fontSize={10} fontFamily="monospace">Flags: 0x014 (RST, ACK)</text>
          <text x={54} y={184} fill="#94a3b8" fontSize={10} fontFamily="monospace">Dst Port: 8080 (Closed)</text>

          <rect x={328} y={124} width={272} height={84} rx={8} fill="#0d1322" stroke="#a78bfa" strokeWidth={1.4} />
          <text x={342} y={146} fill="#c4b5fd" fontSize={10} fontFamily="monospace" fontWeight={700}>3. 16進Hexダンプ</text>
          <text x={342} y={166} fill="#cbd5e1" fontSize={10} fontFamily="monospace">0000  45 00 00 28 1a 2b 40 00</text>
          <text x={342} y={184} fill="#94a3b8" fontSize={10} fontFamily="monospace">0008  40 06 b2 c1 c0 a8 14 0a</text>
        </g>
      );

    case "cloud-vpc-vpn":
      return (
        <g>
          <rect x={36} y={44} width={180} height={148} rx={10} fill="#0d1322" stroke="#f59e0b" strokeWidth={1.6} />
          <text x={126} y={70} textAnchor="middle" fill="#fcd34d" fontSize={11} fontFamily="monospace" fontWeight={700}>オンプレミス</text>
          <text x={126} y={92} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">192.168.0.0/16</text>
          <text x={126} y={128} textAnchor="middle" fill="#cbd5e1" fontSize={10} fontFamily="monospace">VPN GW / ルータ</text>

          <rect x={424} y={44} width={180} height={148} rx={10} fill="#0d1322" stroke="#a78bfa" strokeWidth={1.6} />
          <text x={514} y={70} textAnchor="middle" fill="#c4b5fd" fontSize={11} fontFamily="monospace" fontWeight={700}>Cloud VPC</text>
          <text x={514} y={92} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">10.20.0.0/16 (重複NG)</text>
          <rect x={444} y={110} width={140} height={28} rx={6} fill="#05080f" stroke="#22d3ee" />
          <text x={514} y={128} textAnchor="middle" fill="#67e8f9" fontSize={10} fontFamily="monospace">Public / Private</text>
          <rect x={444} y={146} width={140} height={28} rx={6} fill="#05080f" stroke="#10b981" />
          <text x={514} y={164} textAnchor="middle" fill="#6ee7b7" fontSize={10} fontFamily="monospace">Security Group</text>

          <line x1={216} y1={118} x2={424} y2={118} stroke="#22d3ee" strokeWidth={2.5} strokeDasharray="6 4" />
          <text x={320} y={104} textAnchor="middle" fill="#67e8f9" fontSize={10} fontFamily="monospace">IPsec Encrypted Tunnel</text>
        </g>
      );

    case "netops-automation":
      return (
        <g>
          {[
            { x: 36, title: "1. Git / YAML", sub: "構成をコード管理", color: "#22d3ee" },
            { x: 236, title: "2. Diff / CI検証", sub: "SPOF・ACL自動検査", color: "#f59e0b" },
            { x: 436, title: "3. RESTCONF / Ansible", sub: "APIで冪等に配布", color: "#10b981" },
          ].map((step, i) => (
            <g key={step.title}>
              <rect x={step.x} y={76} width={168} height={82} rx={10} fill="#0d1322" stroke={step.color} strokeWidth={1.8} />
              <text x={step.x + 84} y={110} textAnchor="middle" fill="#f1f5f9" fontSize={11} fontFamily="monospace" fontWeight={700}>
                {step.title}
              </text>
              <text x={step.x + 84} y={134} textAnchor="middle" fill="#94a3b8" fontSize={10}>
                {step.sub}
              </text>
              {i < 2 && (
                <line x1={step.x + 168} y1={117} x2={step.x + 200} y2={117} stroke="#64748b" strokeWidth={2} />
              )}
            </g>
          ))}
        </g>
      );

    case "ipv6-fundamentals":
      return (
        <g>
          <text x={320} y={28} textAnchor="middle" fill="#cbd5e1" fontSize={12} fontFamily="monospace" fontWeight={700}>
            IPv6 128bit アドレス構造 &amp; 種別プレフィックス
          </text>
          <rect x={40} y={48} width={220} height={46} rx={8} fill="#082f49" stroke="#22d3ee" strokeWidth={1.5} />
          <text x={150} y={68} textAnchor="middle" fill="#67e8f9" fontSize={11} fontFamily="monospace" fontWeight={700}>Global Routing Prefix</text>
          <text x={150} y={85} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">48bit (2001:0db8:0000)</text>

          <rect x={268} y={48} width={110} height={46} rx={8} fill="#2e1a47" stroke="#a78bfa" strokeWidth={1.5} />
          <text x={323} y={68} textAnchor="middle" fill="#ddd6fe" fontSize={11} fontFamily="monospace" fontWeight={700}>Subnet ID</text>
          <text x={323} y={85} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">16bit</text>

          <rect x={386} y={48} width={214} height={46} rx={8} fill="#064e3b" stroke="#10b981" strokeWidth={1.5} />
          <text x={493} y={68} textAnchor="middle" fill="#6ee7b7" fontSize={11} fontFamily="monospace" fontWeight={700}>Interface ID (SLAAC/EUI-64)</text>
          <text x={493} y={85} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">64bit (/64 標準)</text>

          {[
            { x: 40, label: "2000::/3", title: "GUA (インターネット)", color: "#22d3ee" },
            { x: 230, label: "FE80::/10", title: "Link-Local (NDP/同一LAN)", color: "#f59e0b" },
            { x: 420, label: "FC00::/7", title: "ULA (閉域Private)", color: "#a78bfa" },
          ].map((box) => (
            <g key={box.label}>
              <rect x={box.x} y={120} width={180} height={82} rx={9} fill="#0d1322" stroke={box.color} strokeWidth={1.5} />
              <text x={box.x + 90} y={150} textAnchor="middle" fill={box.color} fontSize={13} fontFamily="monospace" fontWeight={700}>
                {box.label}
              </text>
              <text x={box.x + 90} y={175} textAnchor="middle" fill="#cbd5e1" fontSize={10.5}>
                {box.title}
              </text>
            </g>
          ))}
        </g>
      );

    case "network-management":
      return (
        <g>
          <rect x={44} y={46} width={150} height={144} rx={10} fill="#0d1322" stroke="#22d3ee" strokeWidth={1.6} />
          <text x={119} y={76} textAnchor="middle" fill="#67e8f9" fontSize={12} fontFamily="monospace" fontWeight={700}>IOS Router / SW</text>
          <text x={119} y={104} textAnchor="middle" fill="#cbd5e1" fontSize={10} fontFamily="monospace">transport input ssh</text>
          <text x={119} y={126} textAnchor="middle" fill="#cbd5e1" fontSize={10} fontFamily="monospace">cdp run / lldp run</text>
          <text x={119} y={148} textAnchor="middle" fill="#cbd5e1" fontSize={10} fontFamily="monospace">ntp server</text>
          <text x={119} y={170} textAnchor="middle" fill="#cbd5e1" fontSize={10} fontFamily="monospace">logging / snmpv3</text>

          {[
            { y: 46, title: "SSH (TCP 22)", desc: "暗号化リモート管理", color: "#10b981" },
            { y: 98, title: "NTP (UDP 123)", desc: "ログ調査用の時刻同期", color: "#f59e0b" },
            { y: 150, title: "Syslog / SNMPv3", desc: "Severity 0-7 / OID監視", color: "#a78bfa" },
          ].map((item) => (
            <g key={item.title}>
              <line x1={194} y1={item.y + 22} x2={340} y2={item.y + 22} stroke={item.color} strokeWidth={2} strokeDasharray="5 3" />
              <rect x={340} y={item.y} width={256} height={44} rx={8} fill="#0d1322" stroke={item.color} strokeWidth={1.5} />
              <text x={468} y={item.y + 19} textAnchor="middle" fill={item.color} fontSize={11} fontFamily="monospace" fontWeight={700}>
                {item.title}
              </text>
              <text x={468} y={item.y + 35} textAnchor="middle" fill="#94a3b8" fontSize={10}>
                {item.desc}
              </text>
            </g>
          ))}
        </g>
      );

    case "l2-security-wireless":
      return (
        <g>
          <rect x={36} y={40} width={274} height={160} rx={10} fill="#0d1322" stroke="#f59e0b" strokeWidth={1.6} />
          <text x={173} y={66} textAnchor="middle" fill="#fcd34d" fontSize={12} fontFamily="monospace" fontWeight={700}>L2 Defense (Switch)</text>
          <rect x={54} y={82} width={238} height={32} rx={6} fill="#060a14" stroke="#22d3ee" />
          <text x={173} y={102} textAnchor="middle" fill="#67e8f9" fontSize={10.5} fontFamily="monospace">Port Security (MAC上限制限)</text>
          <rect x={54} y={120} width={238} height={32} rx={6} fill="#060a14" stroke="#10b981" />
          <text x={173} y={140} textAnchor="middle" fill="#6ee7b7" fontSize={10.5} fontFamily="monospace">DHCP Snooping (Trust/Untrust)</text>
          <rect x={54} y={158} width={238} height={32} rx={6} fill="#060a14" stroke="#f43f5e" />
          <text x={173} y={178} textAnchor="middle" fill="#fda4af" fontSize={10.5} fontFamily="monospace">DAI (不正ARP防御)</text>

          <rect x={334} y={40} width={270} height={160} rx={10} fill="#0d1322" stroke="#a78bfa" strokeWidth={1.6} />
          <text x={469} y={66} textAnchor="middle" fill="#c4b5fd" fontSize={12} fontFamily="monospace" fontWeight={700}>Wireless &amp; CAPWAP</text>
          <rect x={354} y={86} width={104} height={46} rx={7} fill="#060a14" stroke="#38bdf8" />
          <text x={406} y={114} textAnchor="middle" fill="#7dd3fc" fontSize={11} fontFamily="monospace">AP (LWAP)</text>
          <rect x={486} y={86} width={98} height={46} rx={7} fill="#060a14" stroke="#a78bfa" />
          <text x={535} y={114} textAnchor="middle" fill="#ddd6fe" fontSize={11} fontFamily="monospace">WLC</text>
          <line x1={458} y1={109} x2={486} y2={109} stroke="#22d3ee" strokeWidth={2} />
          <text x={469} y={156} textAnchor="middle" fill="#cbd5e1" fontSize={10} fontFamily="monospace">Control (UDP 5246) / Data (5247)</text>
          <text x={469} y={178} textAnchor="middle" fill="#6ee7b7" fontSize={10} fontFamily="monospace">WPA2-AES / WPA3-SAE</text>
        </g>
      );

    case "web-modern-network":
      return (
        <g>
          {[
            { x: 32, title: "Client", sub: "TLS 1.3 (1-RTT)", color: "#38bdf8" },
            { x: 186, title: "L7 ALB / WAF", sub: "HTTPS終端・分散", color: "#22d3ee" },
            { x: 344, title: "App / Container", sub: "Bridge / Overlay", color: "#a78bfa" },
            { x: 500, title: "AS / BGP Edge", sub: "AS Path / eBGP", color: "#10b981" },
          ].map((node, i) => (
            <g key={node.title}>
              <rect x={node.x} y={68} width={118} height={92} rx={9} fill="#0d1322" stroke={node.color} strokeWidth={1.6} />
              <text x={node.x + 59} y={108} textAnchor="middle" fill={node.color} fontSize={11} fontFamily="monospace" fontWeight={700}>
                {node.title}
              </text>
              <text x={node.x + 59} y={132} textAnchor="middle" fill="#cbd5e1" fontSize={9.5}>
                {node.sub}
              </text>
              {i < 3 && (
                <line x1={node.x + 118} y1={114} x2={node.x + 154} y2={114} stroke="#64748b" strokeWidth={2} />
              )}
            </g>
          ))}
        </g>
      );

    case "physical-layer":
      return (
        <g>
          <rect x={32} y={36} width={274} height={164} rx={10} fill="#0d1322" stroke="#22d3ee" strokeWidth={1.6} />
          <text x={169} y={62} textAnchor="middle" fill="#67e8f9" fontSize={12} fontFamily="monospace" fontWeight={700}>銅線UTP &amp; PoE</text>
          <text x={169} y={92} textAnchor="middle" fill="#cbd5e1" fontSize={10.5} fontFamily="monospace">Cat5e / Cat6 / Cat6A (10GBASE-T)</text>
          <text x={169} y={118} textAnchor="middle" fill="#fbbf24" fontSize={10.5} fontFamily="monospace">PoE / PoE+ (IEEE 802.3af/at)</text>
          <text x={169} y={144} textAnchor="middle" fill="#10b981" fontSize={10.5} fontFamily="monospace">Full-Duplex ⇄ 双方向同時通信</text>
          <text x={169} y={170} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">Auto-MDIX / MTU 1500 Bytes</text>

          <rect x={334} y={36} width={274} height={164} rx={10} fill="#0d1322" stroke="#a78bfa" strokeWidth={1.6} />
          <text x={471} y={62} textAnchor="middle" fill="#c4b5fd" fontSize={12} fontFamily="monospace" fontWeight={700}>光ファイバ &amp; SFP</text>
          <rect x={354} y={80} width={234} height={44} rx={6} fill="#060a14" stroke="#f59e0b" />
          <text x={471} y={100} textAnchor="middle" fill="#fcd34d" fontSize={10.5} fontFamily="monospace">MMF (マルチモード / 橙・水色)</text>
          <text x={471} y={116} textAnchor="middle" fill="#94a3b8" fontSize={9.5}>短〜中距離 (データセンタ内 ~400m)</text>
          <rect x={354} y={136} width={234} height={44} rx={6} fill="#060a14" stroke="#38bdf8" />
          <text x={471} y={156} textAnchor="middle" fill="#7dd3fc" fontSize={10.5} fontFamily="monospace">SMF (シングルモード / 黄)</text>
          <text x={471} y={172} textAnchor="middle" fill="#94a3b8" fontSize={9.5}>長距離 (拠点間 数km〜数十km)</text>
        </g>
      );

    case "dhcp-dora":
      return (
        <g>
          <rect x={44} y={40} width={120} height={156} rx={10} fill="#0d1322" stroke="#38bdf8" strokeWidth={1.8} />
          <text x={104} y={76} textAnchor="middle" fill="#7dd3fc" fontSize={12} fontFamily="monospace" fontWeight={700}>Client PC</text>
          <text x={104} y={102} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">0.0.0.0</text>
          <text x={104} y={122} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">UDP Port 68</text>
          <text x={104} y={168} textAnchor="middle" fill="#10b981" fontSize={10} fontFamily="monospace">IP確定!</text>

          <rect x={476} y={40} width={120} height={156} rx={10} fill="#0d1322" stroke="#22d3ee" strokeWidth={1.8} />
          <text x={536} y={76} textAnchor="middle" fill="#67e8f9" fontSize={12} fontFamily="monospace" fontWeight={700}>DHCP Server</text>
          <text x={536} y={102} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">Pool .50~.200</text>
          <text x={536} y={122} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="monospace">UDP Port 67</text>
          <text x={536} y={168} textAnchor="middle" fill="#fbbf24" fontSize={9.5} fontFamily="monospace">ip helper-address</text>

          {[
            { y: 60, dir: "right", color: "#f59e0b", text: "1. Discover (Broadcast: DHCPサーバどこ？)" },
            { y: 98, dir: "left", color: "#38bdf8", text: "2. Offer (192.168.10.50 を提案)" },
            { y: 136, dir: "right", color: "#a78bfa", text: "3. Request (そのIPを借ります!)" },
            { y: 174, dir: "left", color: "#10b981", text: "4. Ack (リース確定 + GW/DNS通知)" },
          ].map((step) => (
            <g key={step.text}>
              <line x1={164} y1={step.y} x2={476} y2={step.y} stroke={step.color} strokeWidth={2} strokeDasharray={step.dir === "right" ? "5 3" : undefined} />
              <text x={320} y={step.y - 6} textAnchor="middle" fill={step.color} fontSize={10} fontFamily="monospace" fontWeight={700}>
                {step.text}
              </text>
            </g>
          ))}
        </g>
      );

    case "vlsm-design":
      return (
        <g>
          <text x={320} y={26} textAnchor="middle" fill="#e2e8f0" fontSize={12} fontFamily="monospace" fontWeight={700}>
            親ブロック 192.168.10.0/24 (256アドレス) を大きい部署から分割
          </text>
          <rect x={36} y={48} width={284} height={82} rx={8} fill="#0d1322" stroke="#22d3ee" strokeWidth={1.8} />
          <text x={178} y={82} textAnchor="middle" fill="#67e8f9" fontSize={12} fontFamily="monospace" fontWeight={700}>192.168.10.0/25</text>
          <text x={178} y={104} textAnchor="middle" fill="#cbd5e1" fontSize={10}>開発部 (100台) → 最大126台収容</text>

          <rect x={332} y={48} width={140} height={82} rx={8} fill="#0d1322" stroke="#f59e0b" strokeWidth={1.8} />
          <text x={402} y={82} textAnchor="middle" fill="#fcd34d" fontSize={11} fontFamily="monospace" fontWeight={700}>.128/26</text>
          <text x={402} y={104} textAnchor="middle" fill="#cbd5e1" fontSize={9.5}>営業 (50台/62)</text>

          <rect x={484} y={48} width={120} height={82} rx={8} fill="#0d1322" stroke="#a78bfa" strokeWidth={1.8} />
          <text x={544} y={82} textAnchor="middle" fill="#c4b5fd" fontSize={11} fontFamily="monospace" fontWeight={700}>.192/27</text>
          <text x={544} y={104} textAnchor="middle" fill="#cbd5e1" fontSize={9.5}>管理 (20台/30)</text>

          <rect x={36} y={150} width={568} height={58} rx={8} fill="#060a14" stroke="#10b981" strokeWidth={1.4} />
          <text x={320} y={175} textAnchor="middle" fill="#6ee7b7" fontSize={11} fontFamily="monospace" fontWeight={700}>
            WAN P2Pリンク用: .224/30 (.225 &amp; .226) + 空き領域は将来用に予約
          </text>
          <text x={320} y={195} textAnchor="middle" fill="#94a3b8" fontSize={10}>
            鉄則：必要ホスト数が多いサブネットから順に割り当てて境界重複を防ぐ
          </text>
        </g>
      );

    case "l3-switch-svi":
      return (
        <g>
          <rect x={170} y={28} width={300} height={74} rx={10} fill="#0d1322" stroke="#22d3ee" strokeWidth={2} />
          <text x={320} y={54} textAnchor="middle" fill="#67e8f9" fontSize={12} fontFamily="monospace" fontWeight={700}>L3 Core Switch (ip routing)</text>
          <text x={245} y={82} textAnchor="middle" fill="#fbbf24" fontSize={10.5} fontFamily="monospace">SVI Vlan10: .10.1</text>
          <text x={395} y={82} textAnchor="middle" fill="#a78bfa" fontSize={10.5} fontFamily="monospace">SVI Vlan20: .20.1</text>

          <line x1={240} y1={102} x2={150} y2={156} stroke="#f59e0b" strokeWidth={2.4} />
          <line x1={400} y1={102} x2={490} y2={156} stroke="#a78bfa" strokeWidth={2.4} />
          <path d="M 275 68 C 300 44, 340 44, 365 68" fill="none" stroke="#10b981" strokeWidth={2} strokeDasharray="4 3" />

          <rect x={60} y={156} width={180} height={52} rx={8} fill="#0d1322" stroke="#f59e0b" />
          <text x={150} y={180} textAnchor="middle" fill="#fef3c7" fontSize={11} fontFamily="monospace">VLAN 10 (192.168.10.0/24)</text>
          <text x={150} y={196} textAnchor="middle" fill="#94a3b8" fontSize={9.5}>GW: 192.168.10.1</text>

          <rect x={400} y={156} width={180} height={52} rx={8} fill="#0d1322" stroke="#a78bfa" />
          <text x={490} y={180} textAnchor="middle" fill="#ede9fe" fontSize={11} fontFamily="monospace">VLAN 20 (192.168.20.0/24)</text>
          <text x={490} y={196} textAnchor="middle" fill="#94a3b8" fontSize={9.5}>GW: 192.168.20.1</text>
        </g>
      );

    case "fhrp-hsrp":
      return (
        <g>
          <rect x={60} y={32} width={196} height={66} rx={10} fill="#0d1322" stroke="#10b981" strokeWidth={2} />
          <text x={158} y={58} textAnchor="middle" fill="#6ee7b7" fontSize={12} fontFamily="monospace" fontWeight={700}>R1 (Active)</text>
          <text x={158} y={78} textAnchor="middle" fill="#cbd5e1" fontSize={10} fontFamily="monospace">Pri 110 / Preempt / .252</text>

          <rect x={384} y={32} width={196} height={66} rx={10} fill="#0d1322" stroke="#f59e0b" strokeWidth={1.8} />
          <text x={482} y={58} textAnchor="middle" fill="#fcd34d" fontSize={12} fontFamily="monospace" fontWeight={700}>R2 (Standby)</text>
          <text x={482} y={78} textAnchor="middle" fill="#cbd5e1" fontSize={10} fontFamily="monospace">Pri 100 / Hello待機 / .253</text>

          <rect x={210} y={114} width={220} height={36} rx={18} fill="#060a14" stroke="#22d3ee" strokeWidth={1.8} strokeDasharray="5 3" />
          <text x={320} y={136} textAnchor="middle" fill="#67e8f9" fontSize={11} fontFamily="monospace" fontWeight={700}>
            Virtual GW: 192.168.10.254
          </text>

          <line x1={158} y1={98} x2={250} y2={114} stroke="#10b981" strokeWidth={2.2} />
          <line x1={482} y1={98} x2={390} y2={114} stroke="#64748b" strokeWidth={2} strokeDasharray="4 4" />
          <line x1={320} y1={150} x2={320} y2={176} stroke="#22d3ee" strokeWidth={2.2} />

          <rect x={220} y={176} width={200} height={42} rx={8} fill="#0d1322" stroke="#38bdf8" />
          <text x={320} y={201} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontFamily="monospace">PC GW = .254 (切替を意識不要)</text>
        </g>
      );

    case "qos-pipeline":
      return (
        <g>
          {[
            { x: 26, title: "1. 分類・マーク", sub: "Voice→DSCP EF(46)", color: "#22d3ee" },
            { x: 180, title: "2. 優先キュー", sub: "LLQ (音声を最優先)", color: "#10b981" },
            { x: 334, title: "3. 帯域制御", sub: "Policing / Shaping", color: "#f59e0b" },
            { x: 488, title: "4. 輻輳回避", sub: "WRED (破棄予測)", color: "#a78bfa" },
          ].map((b, idx) => (
            <g key={b.title}>
              <rect x={b.x} y={64} width={126} height={100} rx={9} fill="#0d1322" stroke={b.color} strokeWidth={1.6} />
              <text x={b.x + 63} y={104} textAnchor="middle" fill={b.color} fontSize={11} fontFamily="monospace" fontWeight={700}>
                {b.title}
              </text>
              <text x={b.x + 63} y={130} textAnchor="middle" fill="#cbd5e1" fontSize={9.5}>
                {b.sub}
              </text>
              {idx < 3 && (
                <line x1={b.x + 126} y1={114} x2={b.x + 154} y2={114} stroke="#64748b" strokeWidth={2} />
              )}
            </g>
          ))}
        </g>
      );

    case "wireless-lan":
      return (
        <g>
          <rect x={36} y={40} width={154} height={154} rx={10} fill="#0d1322" stroke="#38bdf8" strokeWidth={1.6} />
          <text x={113} y={76} textAnchor="middle" fill="#7dd3fc" fontSize={12} fontFamily="monospace" fontWeight={700}>Wi-Fi 端末</text>
          <text x={113} y={104} textAnchor="middle" fill="#cbd5e1" fontSize={10}>2.4GHz (Ch 1, 6, 11)</text>
          <text x={113} y={124} textAnchor="middle" fill="#cbd5e1" fontSize={10}>5GHz / 6GHz (高速)</text>
          <text x={113} y={154} textAnchor="middle" fill="#6ee7b7" fontSize={10} fontFamily="monospace">WPA3-Enterprise</text>

          <line x1={190} y1={117} x2={252} y2={117} stroke="#38bdf8" strokeWidth={2} strokeDasharray="4 3" />

          <rect x={252} y={56} width={132} height={122} rx={10} fill="#0d1322" stroke="#f59e0b" strokeWidth={1.6} />
          <text x={318} y={96} textAnchor="middle" fill="#fcd34d" fontSize={12} fontFamily="monospace" fontWeight={700}>Lightweight AP</text>
          <text x={318} y={122} textAnchor="middle" fill="#94a3b8" fontSize={10}>BSS / SSID配信</text>
          <text x={318} y={142} textAnchor="middle" fill="#94a3b8" fontSize={10}>PoE+ 給電受電</text>

          <line x1={384} y1={117} x2={446} y2={117} stroke="#a78bfa" strokeWidth={2.4} />
          <text x={415} y={105} textAnchor="middle" fill="#c4b5fd" fontSize={9.5} fontFamily="monospace">CAPWAP</text>

          <rect x={446} y={40} width={158} height={154} rx={10} fill="#0d1322" stroke="#a78bfa" strokeWidth={1.6} />
          <text x={525} y={76} textAnchor="middle" fill="#c4b5fd" fontSize={12} fontFamily="monospace" fontWeight={700}>WLC &amp; RADIUS</text>
          <text x={525} y={106} textAnchor="middle" fill="#cbd5e1" fontSize={10}>UDP 5246 (制御)</text>
          <text x={525} y={126} textAnchor="middle" fill="#cbd5e1" fontSize={10}>UDP 5247 (データ)</text>
          <text x={525} y={154} textAnchor="middle" fill="#67e8f9" fontSize={10} fontFamily="monospace">802.1X 認証連携</text>
        </g>
      );

    case "firewall-dmz-vpn":
      return (
        <g>
          <rect x={24} y={68} width={116} height={96} rx={9} fill="#0d1322" stroke="#f43f5e" strokeWidth={1.6} />
          <text x={82} y={110} textAnchor="middle" fill="#fda4af" fontSize={11} fontFamily="monospace" fontWeight={700}>Untrust / WAN</text>
          <text x={82} y={132} textAnchor="middle" fill="#94a3b8" fontSize={9.5}>IPsec VPN (IKEv2)</text>

          <rect x={196} y={54} width={160} height={124} rx={10} fill="#0d1322" stroke="#f59e0b" strokeWidth={2} />
          <text x={276} y={90} textAnchor="middle" fill="#fcd34d" fontSize={12} fontFamily="monospace" fontWeight={700}>NGFW / IPS</text>
          <text x={276} y={114} textAnchor="middle" fill="#cbd5e1" fontSize={10}>Stateful 検査</text>
          <text x={276} y={134} textAnchor="middle" fill="#cbd5e1" fontSize={10}>Zone分離制御</text>
          <text x={276} y={156} textAnchor="middle" fill="#67e8f9" fontSize={9.5} fontFamily="monospace">TACACS+ / RADIUS</text>

          <rect x={428} y={32} width={182} height={74} rx={9} fill="#0d1322" stroke="#a78bfa" strokeWidth={1.6} />
          <text x={519} y={62} textAnchor="middle" fill="#c4b5fd" fontSize={11} fontFamily="monospace" fontWeight={700}>DMZ (公開Web等)</text>
          <text x={519} y={84} textAnchor="middle" fill="#94a3b8" fontSize={9.5}>外部からHTTPSのみ許可</text>

          <rect x={428} y={128} width={182} height={74} rx={9} fill="#0d1322" stroke="#10b981" strokeWidth={1.6} />
          <text x={519} y={158} textAnchor="middle" fill="#6ee7b7" fontSize={11} fontFamily="monospace" fontWeight={700}>Trust (社内LAN/DB)</text>
          <text x={519} y={180} textAnchor="middle" fill="#94a3b8" fontSize={9.5}>直接アクセス全面禁止</text>

          <line x1={140} y1={116} x2={196} y2={116} stroke="#f43f5e" strokeWidth={2.2} />
          <line x1={356} y1={96} x2={428} y2={69} stroke="#a78bfa" strokeWidth={2} />
          <line x1={356} y1={138} x2={428} y2={165} stroke="#10b981" strokeWidth={2} />
        </g>
      );

    case "linux-net-stack":
      return (
        <g>
          {[
            { y: 34, title: "L7 App & Service", cmd: "systemctl status nginx  |  curl -v https://...", color: "#a78bfa" },
            { y: 82, title: "L7/L4 DNS & Socket", cmd: "dig web.local  |  ss -tulpn (LISTEN確認)", color: "#22d3ee" },
            { y: 130, title: "L3/Firewall", cmd: "ip route (ip r)  |  nft list ruleset / ufw status", color: "#10b981" },
            { y: 178, title: "L2/L1 & Packet", cmd: "ip addr (ip a)  |  ip neigh  |  tcpdump -ni eth0", color: "#f59e0b" },
          ].map((row) => (
            <g key={row.title}>
              <rect x={36} y={row.y} width={568} height={38} rx={7} fill="#0d1322" stroke={row.color} strokeWidth={1.5} />
              <text x={56} y={row.y + 23} fill={row.color} fontSize={11} fontFamily="monospace" fontWeight={700}>
                {row.title}
              </text>
              <text x={242} y={row.y + 23} fill="#e2e8f0" fontSize={10.5} fontFamily="monospace">
                {row.cmd}
              </text>
            </g>
          ))}
        </g>
      );

    case "internet-bgp-cdn":
      return (
        <g>
          <rect x={28} y={40} width={144} height={154} rx={9} fill="#0d1322" stroke="#38bdf8" strokeWidth={1.6} />
          <text x={100} y={76} textAnchor="middle" fill="#7dd3fc" fontSize={11} fontFamily="monospace" fontWeight={700}>User &amp; DNS</text>
          <text x={100} y={108} textAnchor="middle" fill="#cbd5e1" fontSize={9.5}>再帰DNSリゾルバ</text>
          <text x={100} y={128} textAnchor="middle" fill="#cbd5e1" fontSize={9.5}>Root → TLD → 権威</text>
          <text x={100} y={156} textAnchor="middle" fill="#67e8f9" fontSize={9.5} fontFamily="monospace">Anycast IP へ誘導</text>

          <line x1={172} y1={117} x2={224} y2={117} stroke="#22d3ee" strokeWidth={2} />

          <rect x={224} y={40} width={176} height={154} rx={9} fill="#0d1322" stroke="#22d3ee" strokeWidth={1.6} />
          <text x={312} y={76} textAnchor="middle" fill="#67e8f9" fontSize={11} fontFamily="monospace" fontWeight={700}>CDN / Reverse Proxy</text>
          <text x={312} y={108} textAnchor="middle" fill="#cbd5e1" fontSize={9.5}>エッジキャッシュ &amp; WAF</text>
          <text x={312} y={128} textAnchor="middle" fill="#cbd5e1" fontSize={9.5}>SSL終端 &amp; オリジン保護</text>
          <text x={312} y={156} textAnchor="middle" fill="#fcd34d" fontSize={9.5} fontFamily="monospace">X-Forwarded-For 付与</text>

          <line x1={400} y1={117} x2={452} y2={117} stroke="#10b981" strokeWidth={2} />

          <rect x={452} y={40} width={160} height={154} rx={9} fill="#0d1322" stroke="#10b981" strokeWidth={1.6} />
          <text x={532} y={76} textAnchor="middle" fill="#6ee7b7" fontSize={11} fontFamily="monospace" fontWeight={700}>AS / BGP 網</text>
          <text x={532} y={108} textAnchor="middle" fill="#cbd5e1" fontSize={9.5}>AS65001 ↔ AS65002</text>
          <text x={532} y={128} textAnchor="middle" fill="#cbd5e1" fontSize={9.5}>eBGP (AS_PATH)</text>
          <text x={532} y={156} textAnchor="middle" fill="#a78bfa" fontSize={9.5} fontFamily="monospace">フルルート経路交換</text>
        </g>
      );
  }
}

export function LessonDiagram({ variant }: { variant: DiagramVariant }) {
  return (
    <div className="bg-topo-grid overflow-hidden rounded-xl border border-slate-800/90 p-3">
      <svg
        viewBox="0 0 640 236"
        role="img"
        aria-label={`${variant} のネットワーク図解`}
        className="h-auto w-full"
      >
        {renderDiagramContent(variant)}
      </svg>
    </div>
  );
}
