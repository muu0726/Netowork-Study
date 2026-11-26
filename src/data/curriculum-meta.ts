export type StageId = "stage-1" | "stage-2" | "stage-3";

export type StageAccent = "cyan" | "amber" | "violet";

export interface LessonMeta {
  id: string;
  stage: StageId;
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
}

export interface ScenarioMeta {
  id: string;
  title: string;
  category: "lab" | "troubleshoot";
  stage: StageId;
  difficulty: "初級" | "中級" | "実践";
  summary: string;
}

export interface ToolMeta {
  id: "subnet" | "wireshark" | "config-review" | "ipv6";
  title: string;
  badge: string;
  summary: string;
}

export interface StageMeta {
  id: StageId;
  number: 1 | 2 | 3;
  label: string;
  title: string;
  subtitle: string;
  accent: StageAccent;
  description: string;
}

export const STAGES: StageMeta[] = [
  {
    id: "stage-1",
    number: 1,
    label: "Stage 1",
    title: "完全未経験〜IT基礎",
    subtitle: "基礎概念とデータの流れを直感で理解する",
    accent: "cyan",
    description:
      "LAN/WANの境界、OSI参照モデルとTCP/IP、IP/MACアドレス、サブネット計算、TCP/UDP、DNS・HTTPまでをビジュアル図解で習得します。",
  },
  {
    id: "stage-2",
    number: 2,
    label: "Stage 2",
    title: "CCNA合格レベル",
    subtitle: "Cisco IOS設計・構築とL2/L3制御を極める",
    accent: "amber",
    description:
      "VLAN・トランク・STP・EtherChannel・スタティック/OSPFルーティング・NAT/NAPT・ACLを、仮想IOSコマンドと構築ラボで体得します。",
  },
  {
    id: "stage-3",
    number: 3,
    label: "Stage 3",
    title: "実務・最新トレンド",
    subtitle: "障害切り分け・パケット解析・自動化へ踏み出す",
    accent: "violet",
    description:
      "レイヤ別障害切り分け、パケットキャプチャ読解、クラウドVPC・VPN設計、API・NetOps・AI運用まで実務直結のスキルを鍛えます。",
  },
];

export const LESSONS_META: LessonMeta[] = [
  // Stage 1: 完全未経験〜IT基礎
  {
    id: "stage1/lan-wan",
    stage: "stage-1",
    slug: "lan-wan",
    title: "LAN / WAN とネットワークの全体像",
    summary: "社内ネットワークとインターネットの境界、ルータ・スイッチの役割を図解で学びます。",
    estimatedMinutes: 10,
  },
  {
    id: "stage1/osi-tcpip",
    stage: "stage-1",
    slug: "osi-tcpip",
    title: "OSI参照モデル & TCP/IP カプセル化",
    summary: "7階層・4階層の役割分担と、データにヘッダが付与・解除される流れを追跡します。",
    estimatedMinutes: 15,
  },
  {
    id: "stage1/ip-mac",
    stage: "stage-1",
    slug: "ip-mac",
    title: "IPアドレスとMACアドレス・ARPの仕組み",
    summary: "L3の論理住所とL2の物理住所がARPによってどう結びつくかを実例で理解します。",
    estimatedMinutes: 15,
  },
  {
    id: "stage1/subnetting",
    stage: "stage-1",
    slug: "subnetting",
    title: "サブネットマスクとCIDR計算の完全攻略",
    summary: "2進数32bitでネットワーク部とホスト部を切り分ける計算手法を身につけます。",
    estimatedMinutes: 20,
  },
  {
    id: "stage1/tcp-udp",
    stage: "stage-1",
    slug: "tcp-udp",
    title: "TCP / UDP とポート番号・3ウェイハンドシェイク",
    summary: "信頼性重視のTCPと低遅延のUDPの違い、代表的なウェルノウンポートを整理します。",
    estimatedMinutes: 15,
  },
  {
    id: "stage1/dns-http",
    stage: "stage-1",
    slug: "dns-http",
    title: "DNS名前解決とHTTP/HTTPS通信の流れ",
    summary: "URL入力からIPアドレス解決、Webページ表示までの通信シーケンスを解説します。",
    estimatedMinutes: 15,
  },
  {
    id: "stage1/physical-layer-ethernet",
    stage: "stage-1",
    slug: "physical-layer-ethernet",
    title: "物理層 (L1)・ケーブル・光ファイバ・PoE・Duplex 基礎",
    summary: "UTPケーブルと光ファイバ(SMF/MMF)の違い、PoE給電、全二重/半二重・Duplex不一致を学びます。",
    estimatedMinutes: 15,
  },
  {
    id: "stage1/dhcp-fundamentals",
    stage: "stage-1",
    slug: "dhcp-fundamentals",
    title: "DHCP による IP 自動配布（DORA・リース・リレーエージェント）",
    summary: "PC接続時にIP/GW/DNSが自動設定されるDORA 4ステップと、ルータ越えのip helper-addressを理解します。",
    estimatedMinutes: 15,
  },

  // Stage 2: CCNA合格レベル
  {
    id: "stage2/vlan-trunk",
    stage: "stage-2",
    slug: "vlan-trunk",
    title: "VLAN・802.1Qトランク & Router-on-a-Stick",
    summary: "ブロードキャストドメイン分割とタグ付きトランク、サブインターフェース構成を学びます。",
    estimatedMinutes: 20,
  },
  {
    id: "stage2/stp-etherchannel",
    stage: "stage-2",
    slug: "stp-etherchannel",
    title: "STP (スパニングツリー) と EtherChannel",
    summary: "L2ループ防止のルートブリッジ選出と、複数リンク束ねによる帯域・冗長性向上を理解します。",
    estimatedMinutes: 20,
  },
  {
    id: "stage2/static-ospf",
    stage: "stage-2",
    slug: "static-ospf",
    title: "スタティックルートとOSPF・最長一致 (LPM)",
    summary: "ルーティングテーブルの参照優先度（LPM・AD値）とOSPFネイバー形成の基礎を学びます。",
    estimatedMinutes: 25,
  },
  {
    id: "stage2/nat-napt",
    stage: "stage-2",
    slug: "nat-napt",
    title: "NAT / NAPT (PAT) によるアドレス変換",
    summary: "プライベートIPとグローバルIPの変換方式（Static / Dynamic / PAT）を実践的に整理します。",
    estimatedMinutes: 15,
  },
  {
    id: "stage2/acl-security",
    stage: "stage-2",
    slug: "acl-security",
    title: "ACL (アクセス制御リスト) と暗黙のdeny",
    summary: "標準ACLと拡張ACLの記述順序、ワイルドカードマスク、適用方向の落とし穴を解説します。",
    estimatedMinutes: 20,
  },
  {
    id: "stage2/cisco-ios",
    stage: "stage-2",
    slug: "cisco-ios",
    title: "Cisco IOS 基本操作と階層コマンド体系",
    summary: "EXEC・コンフィグモード遷移、省略入力、showコマンド、running-config管理を体得します。",
    estimatedMinutes: 15,
  },
  {
    id: "stage2/ipv6-fundamentals",
    stage: "stage-2",
    slug: "ipv6-fundamentals",
    title: "IPv6基礎（アドレス構造・圧縮ルール・SLAAC / NDP）",
    summary: "128bitのIPv6アドレス表記、RFC 5952準拠のゼロ圧縮、GUA/リンクローカル/ULA、およびARPに代わるNDPの仕組みを学びます。",
    estimatedMinutes: 25,
  },
  {
    id: "stage2/network-management",
    stage: "stage-2",
    slug: "network-management",
    title: "ネットワーク管理・監視（SSH・CDP/LLDP・NTP・Syslog・SNMP）",
    summary: "機器への安全なSSH接続設定、隣接機器発見(CDP/LLDP)、時刻同期(NTP)、ログ管理(Syslog)、およびSNMP監視の実務設定を学びます。",
    estimatedMinutes: 20,
  },
  {
    id: "stage2/l2-security-wireless",
    stage: "stage-2",
    slug: "l2-security-wireless",
    title: "L2セキュリティと無線LAN（Port Security・DHCP Snooping・WLC/WPA3）",
    summary: "スイッチポートレベルでの不正PC接続防御（Port Security・DHCP Snooping・DAI）と、法人無線LAN（WLC/CAPWAP・WPA2/WPA3）のアーキテクチャを学びます。",
    estimatedMinutes: 25,
  },
  {
    id: "stage2/vlsm-subnet-design",
    stage: "stage-2",
    slug: "vlsm-subnet-design",
    title: "VLSM（可変長サブネットマスク）による実践IP設計と経路集約",
    summary: "部署ごとの必要台数に合わせて大きなブロックから無駄なく分割するVLSM設計とルートサマリゼーションを学びます。",
    estimatedMinutes: 25,
  },
  {
    id: "stage2/l3-switch-svi",
    stage: "stage-2",
    slug: "l3-switch-svi",
    title: "L3 スイッチ・SVI (interface Vlan) とマルチレイヤ構成",
    summary: "Router-on-a-Stickとの違いを押さえ、L3スイッチのip routing・SVI・Routed Portによる高速VLAN間通信を学びます。",
    estimatedMinutes: 20,
  },
  {
    id: "stage2/fhrp-hsrp-vrrp",
    stage: "stage-2",
    slug: "fhrp-hsrp-vrrp",
    title: "デフォルトゲートウェイ冗長化 FHRP（HSRP / VRRP / GLBP）",
    summary: "仮想IP/MACによるデフォルトゲートウェイ二重化、Active/Standby選出、Priorityとpreempt設計を学びます。",
    estimatedMinutes: 20,
  },
  {
    id: "stage2/qos-fundamentals",
    stage: "stage-2",
    slug: "qos-fundamentals",
    title: "QoS（通信品質制御）：分類・マーキング・優先制御 (DSCP / CoS)",
    summary: "音声やWeb会議を遅延・ジッタから守るための分類・マーキング(DSCP/CoS)、LLQ、ポリシング/シェーピングを学びます。",
    estimatedMinutes: 20,
  },
  {
    id: "stage2/wireless-lan-architecture",
    stage: "stage-2",
    slug: "wireless-lan-architecture",
    title: "無線 LAN アーキテクチャ（Wi-Fi 6/7・チャネル・WLC/CAPWAP・802.1X）",
    summary: "2.4GHz/5GHz/6GHzのチャネル設計、BSS/ESSローミング、WLC/CAPWAP集中管理、WPA3/802.1X認証を体系化します。",
    estimatedMinutes: 20,
  },

  // Stage 3: 実務・最新トレンド
  {
    id: "stage3/troubleshooting-layers",
    stage: "stage-3",
    slug: "troubleshooting-layers",
    title: "レイヤ別障害切り分けメソドロジー",
    summary: "L1からL7へボトムアップ／分割統治で原因を最短特定する実務アプローチを学びます。",
    estimatedMinutes: 20,
  },
  {
    id: "stage3/packet-analysis",
    stage: "stage-3",
    slug: "packet-analysis",
    title: "パケットキャプチャ読解と異常通信パターン",
    summary: "TCP RST、ARP無応答、DNS NXDOMAINなど現場で遭遇するパケット異常の読み解き方を解説。",
    estimatedMinutes: 25,
  },
  {
    id: "stage3/cloud-vpc-vpn",
    stage: "stage-3",
    slug: "cloud-vpc-vpn",
    title: "クラウドVPC設計・Security Group & VPN接続",
    summary: "オンプレミス知識をAWS/GCPのVPC・ルートテーブル・IPsec VPN設計へ接続します。",
    estimatedMinutes: 20,
  },
  {
    id: "stage3/netops-automation",
    stage: "stage-3",
    slug: "netops-automation",
    title: "ネットワーク自動化・REST API・AI運用 (NetOps)",
    summary: "YAML/JSONによる構成管理、Ansible・RESTCONF、LLMを活用した次世代障害調査を展望します。",
    estimatedMinutes: 20,
  },
  {
    id: "stage3/web-modern-network",
    stage: "stage-3",
    slug: "web-modern-network",
    title: "Webインフラとモダンネットワーク（TLS 1.3・LB・BGP・コンテナ網）",
    summary: "実務のWebサービスを支えるTLS 1.3ハンドシェイク、L4/L7ロードバランサ(XFFヘッダ・SSL終端)、インターネットBGP基礎、Dockerブリッジネットワークを学びます。",
    estimatedMinutes: 25,
  },
  {
    id: "stage3/firewall-vpn-aaa",
    stage: "stage-3",
    slug: "firewall-vpn-aaa",
    title: "境界セキュリティ設計（FW / DMZ / IPS / AAA・TACACS+・RADIUS / IPsec VPN）",
    summary: "ステートフルFWとDMZ 3ゾーン設計、機器管理のAAA (TACACS+ vs RADIUS)、拠点間IPsec VPN (IKEv2/ESP) を体系的に学びます。",
    estimatedMinutes: 25,
  },
  {
    id: "stage3/linux-network-ops",
    stage: "stage-3",
    slug: "linux-network-ops",
    title: "Linux ネットワーク実務調査（ip / ss / dig / curl / tcpdump / nftables）",
    summary: "本番サーバ障害時に欠かせない iproute2・ソケット待ち受け確認・DNS/TLS診断・パケット採取・Linux FW調査を網羅します。",
    estimatedMinutes: 20,
  },
  {
    id: "stage3/internet-bgp-dns-cdn",
    stage: "stage-3",
    slug: "internet-bgp-dns-cdn",
    title: "インターネット基盤の仕組み（BGP / AS・権威DNS・リバースプロキシ・CDN）",
    summary: "AS間ルーティング(eBGP/iBGP・AS_PATH)、Root〜権威DNSの反復問い合わせ、Anycast CDNとリバースプロキシの動作を理解します。",
    estimatedMinutes: 25,
  },
];

export const SCENARIOS_META: ScenarioMeta[] = [
  {
    id: "cli-first-steps",
    title: "【超入門】最初のCLI操作：ポート起動とPing疎通体験",
    category: "lab",
    stage: "stage-1",
    difficulty: "初級",
    summary: "初めてのCLI演習。showコマンドで状態を確認し、no shutdown でポートを起動してPing疎通を体験します。",
  },
  {
    id: "cli-basic-routing",
    title: "基本IP設定とL3ルーティング疎通",
    category: "lab",
    stage: "stage-2",
    difficulty: "初級",
    summary: "2台のルータ間にIPとスタティックルートを設定し、異なるサブネット間のPing疎通を確立します。",
  },
  {
    id: "cli-vlan-roas",
    title: "VLAN分割とRouter-on-a-Stick",
    category: "lab",
    stage: "stage-2",
    difficulty: "中級",
    summary: "L2スイッチのAccess/Trunk設定とルータの802.1QサブインターフェースでVLAN間通信を構築します。",
  },
  {
    id: "ts-vlan-mismatch",
    title: "「営業部PCだけ社内サーバに繋がらない」",
    category: "troubleshoot",
    stage: "stage-2",
    difficulty: "初級",
    summary: "一部クライアントのみ通信不可となった構成で、L2スイッチのVLAN割当ミスを特定し復旧します。",
  },
  {
    id: "ts-dns-failure",
    title: "「IP直打ちなら繋がるがURL（ホスト名）で開かない」",
    category: "troubleshoot",
    stage: "stage-3",
    difficulty: "中級",
    summary: "nslookupと疎通確認からPCのDNS設定ミスを切り分け、名前解決を正常化します。",
  },
  {
    id: "ts-routing-asymmetric",
    title: "「拠点間Pingがタイムアウトする」",
    category: "troubleshoot",
    stage: "stage-3",
    difficulty: "実践",
    summary: "誤ったスタティックルートの削除（no ip route）と戻りルートの補完で拠点間通信を復旧します。",
  },
  {
    id: "cli-nat-acl-web",
    title: "社内LANからインターネットへのNAPT（PAT）とWebアクセス許可ACL",
    category: "lab",
    stage: "stage-3",
    difficulty: "実践",
    summary: "NAPT（overload）でプライベートIPをWAN IPへ変換し、拡張ACLでHTTP(80)のみ許可・Telnet(23)を遮断します。",
  },
  {
    id: "ts-acl-web-blocked",
    title: "「特定の部署だけWebサーバ（TCP 80）に繋がらない」",
    category: "troubleshoot",
    stage: "stage-3",
    difficulty: "中級",
    summary: "Telnet禁止要件を保ったまま、暗黙のdenyにより遮断されていた営業部のHTTP通信をACL修正で復旧します。",
  },
  {
    id: "ts-dhcp-failure",
    title: "「新規PCにIPアドレスが自動配布されない」",
    category: "troubleshoot",
    stage: "stage-3",
    difficulty: "中級",
    summary: "DHCPプールのネットワーク不一致と過剰な除外設定（excluded-address）を修復し自動取得を復旧します。",
  },
  {
    id: "cli-ospf-cost",
    title: "3台ルータ構成でのOSPFシングルエリア構築とコスト制御",
    category: "lab",
    stage: "stage-3",
    difficulty: "実践",
    summary: "OSPF Area 0 ネイバー確立とインターフェースコスト変更によるダイクストラ最短経路の誘導を実践します。",
  },
  {
    id: "cli-stp-root-bridge",
    title: "STPルートブリッジ選出と冗長リンクのブロッキング制御",
    category: "lab",
    stage: "stage-3",
    difficulty: "中級",
    summary: "STP プライオリティ変更によりルートブリッジを制御し、L2 ループ防止 (BLK) の再配置を確認します。",
  },
  {
    id: "ts-ospf-neighbor-down",
    title: "「OSPFネイバーが確立せず対向拠点へ到達できない」",
    category: "troubleshoot",
    stage: "stage-3",
    difficulty: "中級",
    summary: "Area ID 不一致とワイルドカードマスク誤りを切り分け、動的ルーティング収束を復旧します。",
  },
  {
    id: "ts-hsrp-failover-broken",
    title: "「冗長化構成でActiveルータが落ちたのに通信が復旧しない」",
    category: "troubleshoot",
    stage: "stage-3",
    difficulty: "実践",
    summary: "HSRP グループ・仮想IP不一致と preempt 設定漏れを修復し、障害フェイルオーバーを正常化します。",
  },
  {
    id: "ts-linux-nginx-down",
    title: "「Pingは通るのにWebサイト(HTTP/HTTPS)がConnection refusedになる」",
    category: "troubleshoot",
    stage: "stage-3",
    difficulty: "中級",
    summary: "dig / ss -tulpn / systemctl / curl -v を駆使して Web サーバデーモン停止を切り分け・復旧します。",
  },
  {
    id: "cli-etherchannel-lacp",
    title: "EtherChannel (LACP) によるスイッチ間リンクアグリゲーション",
    category: "lab",
    stage: "stage-2",
    difficulty: "中級",
    summary: "LACP active/passive モードで2本の物理リンクを Port-Channel (Po1) に束ね、帯域と冗長性を高めます。",
  },
  {
    id: "cli-ipv6-basic",
    title: "IPv6 ルーティング設定とデュアルホスト疎通構築",
    category: "lab",
    stage: "stage-2",
    difficulty: "中級",
    summary: "ipv6 unicast-routing とインターフェースへのIPv6アドレス設定を行い、異なるIPv6サブネット間の疎通を構築します。",
  },
  {
    id: "ts-port-security-errdisable",
    title: "「会議室ハブを繋いだ後から通信が完全に途絶えた (err-disabled)」",
    category: "troubleshoot",
    stage: "stage-2",
    difficulty: "中級",
    summary: "show port-security で違反停止を特定し、最大MAC数変更と shutdown/no shutdown で復旧します。",
  },
];

export interface CloudScenarioMeta {
  id: string;
  title: string;
  difficulty: "初級" | "中級" | "実践";
  summary: string;
}

export const CLOUD_SCENARIOS_META: CloudScenarioMeta[] = [
  {
    id: "cloud-igw-sg-https",
    title: "「Public SubnetのWebサーバに外部からHTTPSアクセスできない」",
    difficulty: "中級",
    summary: "IGW向けデフォルトルート (0.0.0.0/0) の追加と、ステートフル Security Group の443許可を実践します。",
  },
  {
    id: "cloud-nacl-ephemeral",
    title: "「NACLでインバウンド80番を許可したのにレスポンスが返らない」",
    difficulty: "実践",
    summary: "ステートレス NACL 特有の戻りトラフィック遮断を特定し、エフェメラルポート (1024-65535) を開放します。",
  },
  {
    id: "cloud-private-nat-egress",
    title: "「Private Subnetのアプリサーバから外部API(HTTPS 443)へ通信できない」",
    difficulty: "実践",
    summary: "Private Route Table から NAT Gateway への経路設定と SG 最小権限アウトバウンドを構築します。",
  },
];

export const TOOLS_META: ToolMeta[] = [
  {
    id: "subnet",
    title: "サブネット計算機 & 演習ドリル",
    badge: "IPv4 / CIDR",
    summary: "32bitの2進数境界をリアルタイム色分け表示し、サブネット設計問題を反復演習できます。",
  },
  {
    id: "ipv6",
    title: "IPv6 圧縮・展開ツール & 種別クイズ",
    badge: "IPv6 / RFC 5952",
    summary: "IPv6の :: 最長ゼロ圧縮・完全展開ルールを色分け可視化し、GUA/LLA/ULA識別演習を行います。",
  },
  {
    id: "wireshark",
    title: "Wireshark風 パケット解析ドリル",
    badge: "Packet Trace",
    summary: "3ペインビューアでパケット一覧・プロトコル階層・16進ダンプから通信障害の根本原因を特定します。",
  },
  {
    id: "config-review",
    title: "構成図レビュー & コンフィグDiff演習",
    badge: "Design Review",
    summary: "SPOFや暗黙のdeny漏れなど、実務で事故を招く設計・コンフィグの致命的ミスを見抜きます。",
  },
];

export function getLessonsByStage(stage: StageId): LessonMeta[] {
  return LESSONS_META.filter((lesson) => lesson.stage === stage);
}

export function getScenariosByStage(stage: StageId): ScenarioMeta[] {
  return SCENARIOS_META.filter((scenario) => scenario.stage === stage);
}
