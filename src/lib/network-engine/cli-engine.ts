import { normalizeAclProtocol } from "./acl-nat-dhcp";
import {
  formatEtherChannelSummary,
  formatIpv6InterfaceBrief,
  formatPortSecurity,
  simulateIpv6Ping,
} from "./advanced-protocols";
import {
  calculateSubnet,
  isSameSubnet,
  isValidHostIp,
  isValidIpv4,
  maskToPrefix,
  parseIpv4,
} from "./ip-math";
import { compressIpv6, parseIpv6 } from "./ipv6-math";
import {
  getRouterRoutingTable,
  isInterfaceOperationalUp,
  simulateDhcpRenew,
  simulateNslookup,
  simulatePing,
  simulateTcpConnect,
  simulateTraceroute,
} from "./packet-simulator";
import {
  computeHsrpTable,
  computeOspfNeighbors,
  computeStpForSwitch,
  syncHsrpRoles,
} from "./routing-redundancy";
import type {
  AccessList,
  AclAction,
  AclProtocol,
  AclRule,
  CommandResult,
  DhcpPool,
  HsrpGroupConfig,
  ListeningService,
  NatOverloadRule,
  NetworkDevice,
  NetworkInterface,
  NetworkState,
  StaticRoute,
} from "./types";

interface InterfaceFamily {
  family: "gig" | "fa" | "eth" | "se" | "lo";
  canonicalPrefix: string;
}

function detectInterfaceFamily(prefix: string): InterfaceFamily | null {
  const lower = prefix.toLowerCase();
  if ("gigabitethernet".startsWith(lower)) {
    return { family: "gig", canonicalPrefix: "Gig" };
  }
  if ("fastethernet".startsWith(lower)) {
    return { family: "fa", canonicalPrefix: "Fa" };
  }
  if ("ethernet".startsWith(lower)) {
    return { family: "eth", canonicalPrefix: "eth" };
  }
  if ("serial".startsWith(lower)) {
    return { family: "se", canonicalPrefix: "Se" };
  }
  if ("loopback".startsWith(lower)) {
    return { family: "lo", canonicalPrefix: "Lo" };
  }
  return null;
}

function splitInterfaceName(
  raw: string,
): { family: InterfaceFamily; slot: string; subId?: string } | null {
  const match = /^([a-zA-Z]+)\s*(\d+(?:\/\d+)*)(?:\.(\d+))?$/.exec(raw.trim());
  if (!match) {
    return null;
  }
  const family = detectInterfaceFamily(match[1]);
  if (!family) {
    return null;
  }
  return {
    family,
    slot: match[2],
    subId: match[3],
  };
}

export function normalizeInterfaceName(
  raw: string,
  existingInterfaces?: Record<string, NetworkInterface>,
): string | null {
  const parsed = splitInterfaceName(raw);
  if (!parsed) {
    return null;
  }

  const fullSlot =
    parsed.subId !== undefined ? `${parsed.slot}.${parsed.subId}` : parsed.slot;

  if (existingInterfaces) {
    // 完全または同一ファミリ＋スロットの既存インターフェース名に合わせる
    for (const key of Object.keys(existingInterfaces)) {
      const existing = splitInterfaceName(key);
      if (!existing) {
        continue;
      }
      const existingSlot =
        existing.subId !== undefined
          ? `${existing.slot}.${existing.subId}`
          : existing.slot;
      if (
        existing.family.family === parsed.family.family &&
        existingSlot === fullSlot
      ) {
        return key;
      }
    }

    // サブインターフェース新規作成時は親インターフェース名の表記を引き継ぐ
    if (parsed.subId !== undefined) {
      for (const key of Object.keys(existingInterfaces)) {
        const existing = splitInterfaceName(key);
        if (!existing || existing.subId !== undefined) {
          continue;
        }
        if (
          existing.family.family === parsed.family.family &&
          existing.slot === parsed.slot
        ) {
          return `${key}.${parsed.subId}`;
        }
      }
    }
  }

  return `${parsed.family.canonicalPrefix}${fullSlot}`;
}

export function getDevicePrompt(device: NetworkDevice): string {
  const h = device.hostname;
  switch (device.cliState.mode) {
    case "user":
      return `${h}>`;
    case "privileged":
      return `${h}#`;
    case "config":
      return `${h}(config)#`;
    case "config-if":
      return `${h}(config-if)#`;
    case "config-subif":
      return `${h}(config-subif)#`;
    case "config-vlan":
      return `${h}(config-vlan)#`;
    case "config-std-nacl":
      return `${h}(config-std-nacl)#`;
    case "config-ext-nacl":
      return `${h}(config-ext-nacl)#`;
    case "dhcp-config":
      return `${h}(dhcp-config)#`;
    case "config-router":
      return `${h}(config-router)#`;
    case "host":
      return `${h}$`;
  }
}

function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () =>
    Array<number>(lb + 1).fill(0),
  );
  for (let i = 0; i <= la; i += 1) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= lb; j += 1) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= la; i += 1) {
    for (let j = 1; j <= lb; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[la][lb];
}

interface HelpEntry {
  usage: string;
  description: string;
  keywords: string[];
}

function getHelpEntriesForDevice(device: NetworkDevice): HelpEntry[] {
  if (device.type === "pc" || device.type === "server") {
    return [
      {
        usage: "ipconfig [/renew]",
        description: "IP構成表示 / DHCPによるIP自動取得 (/renew)",
        keywords: ["ipconfig", "ipconfig /renew", "ifconfig"],
      },
      {
        usage: "ip addr show | ip route show",
        description: "Linux iproute2 でIP (ip a) / 経路表 (ip r) を確認",
        keywords: ["ip addr show", "ip a", "ip route show", "ip r"],
      },
      {
        usage: "ss -tulpn",
        description: "Listen 中の TCP/UDP ソケットとプロセス一覧を表示",
        keywords: ["ss -tulpn", "ss"],
      },
      {
        usage: "dig <hostname>",
        description: "DNS 名前解決の詳細レスポンス (ANSWER SECTION) を表示",
        keywords: ["dig"],
      },
      {
        usage: "systemctl status|start|stop <service>",
        description: "サーバデーモン (nginx 等) の状態確認・起動・停止",
        keywords: ["systemctl status", "systemctl start", "systemctl stop"],
      },
      {
        usage: "set ip <ip> <mask> [gateway]",
        description: "IPアドレスとサブネットマスク（およびGW）を設定",
        keywords: ["set ip"],
      },
      {
        usage: "set dns <ip>",
        description: "DNSサーバのIPアドレスを設定",
        keywords: ["set dns"],
      },
      {
        usage: "ping <ip|hostname>",
        description: "指定した宛先へICMP疎通確認を実行",
        keywords: ["ping"],
      },
      {
        usage: "curl [-v] http(s)://<host>[:port]",
        description: "HTTP/HTTPS 接続とハンドシェイク詳細 (-v) を確認",
        keywords: ["curl", "curl -v"],
      },
      {
        usage: "nc -zv <ip|host> <port>",
        description: "指定TCPポートの疎通・待ち受けを確認",
        keywords: ["nc"],
      },
      {
        usage: "traceroute <ip|hostname>",
        description: "宛先までのL3経路（ホップ）を追跡",
        keywords: ["traceroute"],
      },
      {
        usage: "nslookup <hostname>",
        description: "DNSサーバへホスト名の名前解決を実行",
        keywords: ["nslookup"],
      },
      {
        usage: "?",
        description: "利用可能なコマンド一覧を表示",
        keywords: ["?", "help"],
      },
    ];
  }

  switch (device.cliState.mode) {
    case "user":
      return [
        {
          usage: "enable",
          description: "特権EXECモード (#) へ移行",
          keywords: ["enable"],
        },
        {
          usage: "ping <ip|hostname>",
          description: "ICMP疎通確認を実行",
          keywords: ["ping"],
        },
        {
          usage: "traceroute <ip|hostname>",
          description: "経路追跡を実行",
          keywords: ["traceroute"],
        },
        {
          usage: "show ip interface brief",
          description: "インターフェースのIP・状態一覧を表示",
          keywords: ["show ip interface brief"],
        },
        {
          usage: "show vlan brief",
          description: "VLAN一覧と所属ポートを表示",
          keywords: ["show vlan brief"],
        },
        {
          usage: "show ip route",
          description: "ルーティングテーブルを表示",
          keywords: ["show ip route"],
        },
        {
          usage: "show mac address-table",
          description: "MACアドレステーブルを表示",
          keywords: ["show mac address-table"],
        },
        {
          usage: "show arp",
          description: "ARPテーブルを表示",
          keywords: ["show arp"],
        },
        {
          usage: "exit",
          description: "セッションを終了",
          keywords: ["exit"],
        },
      ];

    case "privileged":
      return [
        {
          usage: "configure terminal",
          description: "グローバルコンフィグレーションモードへ移行",
          keywords: ["configure terminal"],
        },
        {
          usage: "disable",
          description: "ユーザーEXECモード (>) へ戻る",
          keywords: ["disable"],
        },
        {
          usage: "show ip interface brief",
          description: "インターフェースのIP・状態一覧を表示",
          keywords: ["show ip interface brief"],
        },
        {
          usage: "show vlan brief",
          description: "VLAN一覧と所属ポートを表示",
          keywords: ["show vlan brief"],
        },
        {
          usage: "show ip route",
          description: "ルーティングテーブルを表示",
          keywords: ["show ip route"],
        },
        {
          usage: "show running-config",
          description: "現在の稼働コンフィグを表示",
          keywords: ["show running-config"],
        },
        {
          usage: "show mac address-table",
          description: "MACアドレステーブルを表示",
          keywords: ["show mac address-table"],
        },
        {
          usage: "show arp",
          description: "ARPテーブルを表示",
          keywords: ["show arp"],
        },
        {
          usage: "show access-lists",
          description: "ACL定義とマッチ回数を表示",
          keywords: ["show access-lists"],
        },
        {
          usage: "show ip nat translations",
          description: "NAT/NAPT変換テーブルを表示",
          keywords: ["show ip nat translations"],
        },
        {
          usage: "show ip dhcp binding",
          description: "DHCPリース一覧を表示",
          keywords: ["show ip dhcp binding"],
        },
        {
          usage: "show ip ospf neighbor",
          description: "OSPFネイバー関係一覧を表示",
          keywords: ["show ip ospf neighbor"],
        },
        {
          usage: "show spanning-tree [vlan <id>]",
          description: "STPルートブリッジとポート状態 (FWD/BLK) を表示",
          keywords: ["show spanning-tree"],
        },
        {
          usage: "show standby brief",
          description: "HSRPグループ状態 (Active/Standby/VIP) を表示",
          keywords: ["show standby brief"],
        },
        {
          usage: "show etherchannel summary",
          description: "EtherChannel (LACP / Port-Channel) の束ね状態を表示",
          keywords: ["show etherchannel summary"],
        },
        {
          usage: "show port-security [interface <if>]",
          description: "Port Security 状態と err-disabled の有無を表示",
          keywords: ["show port-security"],
        },
        {
          usage: "show ipv6 interface brief",
          description: "各インターフェースのIPv6アドレスと状態を表示",
          keywords: ["show ipv6 interface brief"],
        },
        {
          usage: "ping <ip|hostname>",
          description: "ICMP疎通確認を実行",
          keywords: ["ping"],
        },
        {
          usage: "traceroute <ip|hostname>",
          description: "経路追跡を実行",
          keywords: ["traceroute"],
        },
        {
          usage: "exit",
          description: "特権モードを終了",
          keywords: ["exit"],
        },
      ];

    case "config":
      return [
        {
          usage: "hostname <name>",
          description: "機器のホスト名を変更",
          keywords: ["hostname"],
        },
        {
          usage: "interface <name>",
          description: "インターフェース / サブIF設定モードへ移行",
          keywords: ["interface"],
        },
        {
          usage: "no interface <subif>",
          description: "サブインターフェースを削除",
          keywords: ["no interface"],
        },
        {
          usage: "vlan <id>",
          description: "VLANを作成してVLAN設定モードへ移行",
          keywords: ["vlan"],
        },
        {
          usage: "no vlan <id>",
          description: "指定VLANを削除",
          keywords: ["no vlan"],
        },
        {
          usage: "ip route <dest> <mask> <next-hop>",
          description: "スタティックルートを追加",
          keywords: ["ip route"],
        },
        {
          usage: "no ip route <dest> <mask> [next-hop]",
          description: "スタティックルートを削除",
          keywords: ["no ip route"],
        },
        {
          usage: "access-list <1-199> permit|deny ...",
          description: "番号付き標準/拡張ACLルールを追加",
          keywords: ["access-list"],
        },
        {
          usage: "ip access-list standard|extended <name>",
          description: "名前付きACL設定モードへ移行",
          keywords: ["ip access-list standard", "ip access-list extended"],
        },
        {
          usage: "ip nat inside source list <acl> interface <if> overload",
          description: "NAPT (PAT) 変換ルールを設定",
          keywords: ["ip nat inside source list"],
        },
        {
          usage: "ip dhcp excluded-address <start> [end]",
          description: "DHCP配布から除外するIP範囲を指定",
          keywords: ["ip dhcp excluded-address"],
        },
        {
          usage: "ip dhcp pool <name>",
          description: "DHCPプール設定モードへ移行",
          keywords: ["ip dhcp pool"],
        },
        {
          usage: "router ospf <process-id>",
          description: "OSPFルーティング設定モードへ移行",
          keywords: ["router ospf"],
        },
        {
          usage: "spanning-tree vlan <id> priority <value>",
          description: "指定VLANのSTPブリッジプライオリティ (4096の倍数) を設定",
          keywords: ["spanning-tree vlan"],
        },
        {
          usage: "ipv6 unicast-routing",
          description: "ルータのIPv6ユニキャストルーティングを有効化",
          keywords: ["ipv6 unicast-routing"],
        },
        {
          usage: "do <command>",
          description: "設定モードのまま特権コマンド (show/ping等) を実行",
          keywords: ["do"],
        },
        {
          usage: "exit",
          description: "特権EXECモードへ戻る",
          keywords: ["exit"],
        },
        {
          usage: "end",
          description: "特権EXECモードへ一気に戻る",
          keywords: ["end"],
        },
      ];

    case "config-if":
      return [
        {
          usage: "ip address <ip> <mask>",
          description: "IPアドレスとサブネットマスクを設定",
          keywords: ["ip address"],
        },
        {
          usage: "no ip address",
          description: "IPアドレス設定を削除",
          keywords: ["no ip address"],
        },
        {
          usage: "ip access-group <id|name> in|out",
          description: "インターフェースへACLを適用",
          keywords: ["ip access-group"],
        },
        {
          usage: "ip nat inside|outside",
          description: "NATの内部 (inside) / 外部 (outside) ロールを設定",
          keywords: ["ip nat inside", "ip nat outside"],
        },
        {
          usage: "ip ospf cost <1-65535>",
          description: "インターフェースのOSPFコストを設定",
          keywords: ["ip ospf cost"],
        },
        {
          usage: "standby <group> ip|priority|preempt ...",
          description: "HSRP仮想IP・プライオリティ・プリエンプトを設定",
          keywords: ["standby"],
        },
        {
          usage: "shutdown",
          description: "インターフェースを管理停止 (Down)",
          keywords: ["shutdown"],
        },
        {
          usage: "no shutdown",
          description: "インターフェースを有効化 (Up)",
          keywords: ["no shutdown"],
        },
        {
          usage: "switchport mode access|trunk",
          description: "スイッチポートの動作モードを設定",
          keywords: ["switchport mode access", "switchport mode trunk"],
        },
        {
          usage: "switchport access vlan <id>",
          description: "アクセスポートの所属VLANを設定",
          keywords: ["switchport access vlan"],
        },
        {
          usage: "no switchport access vlan",
          description: "アクセスポートのVLANをデフォルト (VLAN 1) に戻す",
          keywords: ["no switchport access vlan"],
        },
        {
          usage: "switchport trunk allowed vlan <list|all|add|remove>",
          description: "トランクポートで許可するVLANを指定",
          keywords: ["switchport trunk allowed vlan"],
        },
        {
          usage: "no switchport trunk allowed vlan",
          description: "トランク許可VLAN制限を解除 (all)",
          keywords: ["no switchport trunk allowed vlan"],
        },
        {
          usage: "channel-group <1-6> mode active|passive|on",
          description: "EtherChannel (LACP / Static) グループへ参加",
          keywords: ["channel-group"],
        },
        {
          usage: "switchport port-security [maximum <n>|violation <mode>]",
          description: "ポートセキュリティ有効化・最大MAC数・違反動作を設定",
          keywords: ["switchport port-security"],
        },
        {
          usage: "ipv6 address <addr/prefix>",
          description: "インターフェースへIPv6アドレスを設定",
          keywords: ["ipv6 address"],
        },
        {
          usage: "interface <name>",
          description: "別インターフェース設定へ移動",
          keywords: ["interface"],
        },
        {
          usage: "do <command>",
          description: "特権コマンド (show/ping等) を実行",
          keywords: ["do"],
        },
        {
          usage: "exit",
          description: "グローバルコンフィグモードへ戻る",
          keywords: ["exit"],
        },
        {
          usage: "end",
          description: "特権EXECモードへ戻る",
          keywords: ["end"],
        },
      ];

    case "config-subif":
      return [
        {
          usage: "encapsulation dot1Q <vlan-id>",
          description: "IEEE 802.1Q VLANタグIDを設定",
          keywords: ["encapsulation dot1Q"],
        },
        {
          usage: "no encapsulation dot1Q",
          description: "802.1Qカプセル化設定を削除",
          keywords: ["no encapsulation dot1Q"],
        },
        {
          usage: "ip address <ip> <mask>",
          description: "IPアドレスとサブネットマスクを設定",
          keywords: ["ip address"],
        },
        {
          usage: "no ip address",
          description: "IPアドレス設定を削除",
          keywords: ["no ip address"],
        },
        {
          usage: "ip access-group <id|name> in|out",
          description: "サブインターフェースへACLを適用",
          keywords: ["ip access-group"],
        },
        {
          usage: "ip nat inside|outside",
          description: "NATの内部/外部ロールを設定",
          keywords: ["ip nat inside", "ip nat outside"],
        },
        {
          usage: "ip ospf cost <1-65535>",
          description: "OSPFコストを設定",
          keywords: ["ip ospf cost"],
        },
        {
          usage: "standby <group> ip|priority|preempt ...",
          description: "HSRP設定",
          keywords: ["standby"],
        },
        {
          usage: "shutdown",
          description: "サブインターフェースを管理停止",
          keywords: ["shutdown"],
        },
        {
          usage: "no shutdown",
          description: "サブインターフェースを有効化",
          keywords: ["no shutdown"],
        },
        {
          usage: "interface <name>",
          description: "別インターフェース設定へ移動",
          keywords: ["interface"],
        },
        {
          usage: "do <command>",
          description: "特権コマンド (show/ping等) を実行",
          keywords: ["do"],
        },
        {
          usage: "exit",
          description: "グローバルコンフィグモードへ戻る",
          keywords: ["exit"],
        },
        {
          usage: "end",
          description: "特権EXECモードへ戻る",
          keywords: ["end"],
        },
      ];

    case "config-vlan":
      return [
        {
          usage: "name <vlan-name>",
          description: "VLAN名を設定",
          keywords: ["name"],
        },
        {
          usage: "vlan <id>",
          description: "別VLAN設定へ移動",
          keywords: ["vlan"],
        },
        {
          usage: "do <command>",
          description: "特権コマンド (show/ping等) を実行",
          keywords: ["do"],
        },
        {
          usage: "exit",
          description: "グローバルコンフィグモードへ戻る",
          keywords: ["exit"],
        },
        {
          usage: "end",
          description: "特権EXECモードへ戻る",
          keywords: ["end"],
        },
      ];

    case "config-std-nacl":
      return [
        {
          usage: "[seq] permit|deny <src> [wildcard]",
          description: "標準ACLルールを追加",
          keywords: ["permit", "deny"],
        },
        {
          usage: "no <seq>",
          description: "指定シーケンス番号のACLルールを削除",
          keywords: ["no"],
        },
        {
          usage: "do <command>",
          description: "特権コマンドを実行",
          keywords: ["do"],
        },
        {
          usage: "exit",
          description: "グローバルコンフィグモードへ戻る",
          keywords: ["exit"],
        },
        {
          usage: "end",
          description: "特権EXECモードへ戻る",
          keywords: ["end"],
        },
      ];

    case "config-ext-nacl":
      return [
        {
          usage: "[seq] permit|deny <proto> <src> <dst> [eq port]",
          description: "拡張ACLルールを追加",
          keywords: ["permit", "deny"],
        },
        {
          usage: "no <seq>",
          description: "指定シーケンス番号のACLルールを削除",
          keywords: ["no"],
        },
        {
          usage: "do <command>",
          description: "特権コマンドを実行",
          keywords: ["do"],
        },
        {
          usage: "exit",
          description: "グローバルコンフィグモードへ戻る",
          keywords: ["exit"],
        },
        {
          usage: "end",
          description: "特権EXECモードへ戻る",
          keywords: ["end"],
        },
      ];

    case "dhcp-config":
      return [
        {
          usage: "network <ip> <mask>",
          description: "DHCP配布ネットワークとマスクを設定",
          keywords: ["network"],
        },
        {
          usage: "default-router <ip>",
          description: "デフォルトゲートウェイを設定",
          keywords: ["default-router"],
        },
        {
          usage: "dns-server <ip>",
          description: "DNSサーバIPを設定",
          keywords: ["dns-server"],
        },
        {
          usage: "no network | no default-router | no dns-server",
          description: "DHCPプール設定項目を削除",
          keywords: ["no network", "no default-router", "no dns-server"],
        },
        {
          usage: "do <command>",
          description: "特権コマンドを実行",
          keywords: ["do"],
        },
        {
          usage: "exit",
          description: "グローバルコンフィグモードへ戻る",
          keywords: ["exit"],
        },
        {
          usage: "end",
          description: "特権EXECモードへ戻る",
          keywords: ["end"],
        },
      ];

    case "config-router":
      return [
        {
          usage: "router-id <A.B.C.D>",
          description: "OSPF ルータIDを設定",
          keywords: ["router-id"],
        },
        {
          usage: "network <ip> <wildcard> area <id>",
          description: "OSPF を有効化するネットワークと Area ID を指定",
          keywords: ["network"],
        },
        {
          usage: "no network <ip> <wildcard> area <id>",
          description: "指定した OSPF ネットワーク宣言を削除",
          keywords: ["no network", "no router-id"],
        },
        {
          usage: "do <command>",
          description: "特権コマンドを実行",
          keywords: ["do"],
        },
        {
          usage: "exit",
          description: "グローバルコンフィグモードへ戻る",
          keywords: ["exit"],
        },
        {
          usage: "end",
          description: "特権EXECモードへ戻る",
          keywords: ["end"],
        },
      ];

    case "host":
      return [];
  }
}

function formatHelpOutput(device: NetworkDevice): string {
  const entries = getHelpEntriesForDevice(device);
  const lines = ["Available commands:"];
  for (const entry of entries) {
    lines.push(`  ${entry.usage.padEnd(36)} ${entry.description}`);
  }
  return lines.join("\n");
}

function suggestClosestCommand(
  device: NetworkDevice,
  inputTokens: string[],
): string | null {
  const entries = getHelpEntriesForDevice(device);
  if (inputTokens.length === 0) {
    return null;
  }

  let bestSuggestion: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const entry of entries) {
    for (const kw of entry.keywords) {
      const kwTokens = kw.toLowerCase().split(/\s+/);
      const compareCount = Math.min(inputTokens.length, kwTokens.length);
      if (compareCount === 0) {
        continue;
      }

      let tokenDistanceSum = 0;
      let validCandidate = true;

      for (let i = 0; i < compareCount; i += 1) {
        const inTok = inputTokens[i].toLowerCase();
        const kwTok = kwTokens[i];
        if (kwTok.startsWith(inTok)) {
          continue;
        }

        const fullDist = levenshtein(inTok, kwTok);
        const prefixSlice = kwTok.slice(
          0,
          Math.min(kwTok.length, Math.max(inTok.length, 3)),
        );
        const prefixDist = levenshtein(inTok, prefixSlice);
        const dist = Math.min(fullDist, prefixDist);
        const denom = Math.max(inTok.length, prefixSlice.length);

        if (dist > 2 || (denom > 0 && dist / denom > 0.55)) {
          validCandidate = false;
          break;
        }
        tokenDistanceSum += dist;
      }

      if (!validCandidate || tokenDistanceSum === 0) {
        continue;
      }

      const lengthPenalty = Math.abs(kwTokens.length - inputTokens.length) * 0.5;
      const totalScore = tokenDistanceSum + lengthPenalty;

      if (totalScore < bestScore) {
        bestScore = totalScore;
        bestSuggestion = kw;
      }
    }
  }

  return bestSuggestion;
}

function buildInvalidInputResult(
  state: NetworkState,
  device: NetworkDevice,
  tokens: string[],
  customReason?: string,
): CommandResult {
  const lines = ["% Invalid input detected at '^' marker."];
  if (customReason) {
    lines.push(customReason);
  } else {
    const suggestion = suggestClosestCommand(device, tokens);
    if (suggestion) {
      lines.push(`Hint: もしかして "${suggestion}" ですか？`);
    }
  }
  return {
    nextState: state,
    output: lines.join("\n"),
    prompt: getDevicePrompt(device),
  };
}

function matchKeyword(
  token: string,
  candidates: readonly string[],
):
  | { kind: "exact"; value: string }
  | { kind: "ambiguous"; matches: string[] }
  | { kind: "none" } {
  const lower = token.toLowerCase();
  const exact = candidates.find((c) => c.toLowerCase() === lower);
  if (exact) {
    return { kind: "exact", value: exact };
  }

  const matches = candidates.filter((c) => c.toLowerCase().startsWith(lower));
  if (matches.length === 1) {
    return { kind: "exact", value: matches[0] };
  }
  if (matches.length > 1) {
    return { kind: "ambiguous", matches };
  }
  return { kind: "none" };
}

function updateDevice(
  state: NetworkState,
  device: NetworkDevice,
): NetworkState {
  return {
    ...state,
    devices: {
      ...state.devices,
      [device.id]: device,
    },
  };
}

function formatShowIpInterfaceBrief(
  state: NetworkState,
  device: NetworkDevice,
): string {
  const header =
    "Interface              IP-Address      OK? Method Status                Protocol";
  const rows = Object.values(device.interfaces).map((iface) => {
    const ipStr = iface.ip ?? "unassigned";
    const ok = "YES";
    const method = iface.ip ? "manual" : "unset";
    const status = iface.portSecurity?.errDisabled
      ? "err-disabled"
      : iface.adminUp
        ? "up"
        : "administratively down";
    const protocol = isInterfaceOperationalUp(state, device.id, iface.name)
      ? "up"
      : "down";
    return `${iface.name.padEnd(23)}${ipStr.padEnd(16)}${ok.padEnd(4)}${method.padEnd(7)}${status.padEnd(22)}${protocol}`;
  });
  return [header, ...rows].join("\n");
}

function formatShowVlanBrief(device: NetworkDevice): string {
  const lines = [
    "VLAN Name                             Status    Ports",
    "---- -------------------------------- --------- -------------------------------",
  ];
  const vlans = Object.values(device.vlans).sort((a, b) => a.id - b.id);

  for (const vlan of vlans) {
    const ports = Object.values(device.interfaces)
      .filter((iface) => {
        if (device.type !== "switch") {
          return false;
        }
        const mode = iface.switchportMode ?? "access";
        if (mode !== "access") {
          return false;
        }
        return (iface.accessVlan ?? 1) === vlan.id;
      })
      .map((iface) => iface.name)
      .join(", ");
    const status = vlan.active ? "active" : "act/unsup";
    lines.push(
      `${String(vlan.id).padEnd(5)}${vlan.name.padEnd(33)}${status.padEnd(10)}${ports}`,
    );
  }

  return lines.join("\n");
}

function formatShowIpRoute(
  state: NetworkState,
  device: NetworkDevice,
): string {
  const routes = getRouterRoutingTable(state, device);
  const lines = [
    "Codes: C - connected, S - static, O - OSPF",
    "",
  ];
  if (routes.length === 0) {
    lines.push("Gateway of last resort is not set", "", "(No routes configured)");
    return lines.join("\n");
  }

  const hasDefault = routes.some(
    (r) => r.destination === "0.0.0.0" && r.prefixLength === 0,
  );
  lines.push(
    hasDefault
      ? "Gateway of last resort is set"
      : "Gateway of last resort is not set",
    "",
  );

  for (const r of routes) {
    if (r.type === "connected") {
      lines.push(
        `C    ${r.destination}/${r.prefixLength} is directly connected, ${r.interfaceName}`,
      );
    } else if (r.type === "ospf") {
      lines.push(
        `O    ${r.destination}/${r.prefixLength} [${r.adminDistance}/${r.metric ?? 1}] via ${r.nextHop}, ${r.interfaceName}`,
      );
    } else {
      lines.push(
        `S    ${r.destination}/${r.prefixLength} [${r.adminDistance}/0] via ${r.nextHop}`,
      );
    }
  }

  return lines.join("\n");
}

function formatShowRunningConfig(device: NetworkDevice): string {
  const lines = [
    "Building configuration...",
    "",
    "!",
    `hostname ${device.hostname}`,
    "!",
  ];
  if (device.ipv6UnicastRouting) {
    lines.push("ipv6 unicast-routing", "!");
  }

  const vlans = Object.values(device.vlans)
    .filter((v) => v.id !== 1)
    .sort((a, b) => a.id - b.id);
  for (const vlan of vlans) {
    lines.push(`vlan ${vlan.id}`);
    lines.push(` name ${vlan.name}`);
    lines.push("!");
  }
  for (const [vid, prio] of Object.entries(device.stpPriorities ?? {}).sort(
    ([a], [b]) => Number(a) - Number(b),
  )) {
    lines.push(`spanning-tree vlan ${vid} priority ${prio}`);
  }

  for (const excluded of device.dhcpExcludedRanges ?? []) {
    lines.push(
      excluded.startIp === excluded.endIp
        ? `ip dhcp excluded-address ${excluded.startIp}`
        : `ip dhcp excluded-address ${excluded.startIp} ${excluded.endIp}`,
    );
  }
  for (const pool of Object.values(device.dhcpPools ?? {})) {
    lines.push(`ip dhcp pool ${pool.name}`);
    if (pool.network && pool.mask) {
      lines.push(` network ${pool.network} ${pool.mask}`);
    }
    if (pool.defaultRouter) {
      lines.push(` default-router ${pool.defaultRouter}`);
    }
    if (pool.dnsServer) {
      lines.push(` dns-server ${pool.dnsServer}`);
    }
    lines.push("!");
  }

  for (const iface of Object.values(device.interfaces)) {
    lines.push(`interface ${iface.name}`);
    if (iface.dot1qVlan !== undefined) {
      lines.push(` encapsulation dot1Q ${iface.dot1qVlan}`);
    }
    if (iface.ip && iface.subnetMask) {
      lines.push(` ip address ${iface.ip} ${iface.subnetMask}`);
    }
    if (iface.ipv6Address) {
      lines.push(` ipv6 address ${iface.ipv6Address}`);
    }
    if (iface.natRole) {
      lines.push(` ip nat ${iface.natRole}`);
    }
    if (iface.inboundAcl) {
      lines.push(` ip access-group ${iface.inboundAcl} in`);
    }
    if (iface.outboundAcl) {
      lines.push(` ip access-group ${iface.outboundAcl} out`);
    }
    if (iface.ospfCost !== undefined) {
      lines.push(` ip ospf cost ${iface.ospfCost}`);
    }
    for (const hsrp of Object.values(iface.hsrpGroups ?? {}).sort(
      (a, b) => a.group - b.group,
    )) {
      if (hsrp.virtualIp) {
        lines.push(` standby ${hsrp.group} ip ${hsrp.virtualIp}`);
      }
      if (hsrp.priority !== 100) {
        lines.push(` standby ${hsrp.group} priority ${hsrp.priority}`);
      }
      if (hsrp.preempt) {
        lines.push(` standby ${hsrp.group} preempt`);
      }
    }
    if (iface.switchportMode) {
      lines.push(` switchport mode ${iface.switchportMode}`);
    }
    if (
      iface.switchportMode !== "trunk" &&
      iface.accessVlan !== undefined &&
      iface.accessVlan !== 1
    ) {
      lines.push(` switchport access vlan ${iface.accessVlan}`);
    }
    if (iface.trunkAllowedVlans !== undefined) {
      const list =
        iface.trunkAllowedVlans.length > 0
          ? iface.trunkAllowedVlans.join(",")
          : "none";
      lines.push(` switchport trunk allowed vlan ${list}`);
    }
    if (iface.channelGroup !== undefined) {
      lines.push(
        ` channel-group ${iface.channelGroup} mode ${iface.channelMode ?? "on"}`,
      );
    }
    if (iface.portSecurity?.enabled) {
      lines.push(" switchport port-security");
      lines.push(` switchport port-security maximum ${iface.portSecurity.maxMac}`);
      lines.push(
        ` switchport port-security violation ${iface.portSecurity.violation}`,
      );
    }
    if (!iface.adminUp) {
      lines.push(" shutdown");
    }
    lines.push("!");
  }

  for (const sr of device.staticRoutes) {
    lines.push(`ip route ${sr.destination} ${sr.mask} ${sr.nextHop}`);
  }
  if (device.ospf) {
    lines.push(`router ospf ${device.ospf.processId}`);
    if (device.ospf.routerId) {
      lines.push(` router-id ${device.ospf.routerId}`);
    }
    for (const stmt of device.ospf.networks) {
      lines.push(` network ${stmt.network} ${stmt.wildcard} area ${stmt.area}`);
    }
    lines.push("!");
  }
  for (const nat of device.natRules ?? []) {
    lines.push(
      `ip nat inside source list ${nat.aclName} interface ${nat.outsideInterface}${nat.overload ? " overload" : ""}`,
    );
  }
  for (const acl of Object.values(device.acls ?? {})) {
    const isNumbered = /^\d+$/.test(acl.name);
    if (isNumbered) {
      for (const rule of acl.rules) {
        if (acl.type === "standard") {
          lines.push(
            `access-list ${acl.name} ${rule.action} ${formatAclAddr(rule.srcIp, rule.srcWildcard)}`,
          );
        } else {
          lines.push(
            `access-list ${acl.name} ${rule.action} ${rule.protocol} ${formatAclAddr(rule.srcIp, rule.srcWildcard)} ${formatAclAddr(rule.dstIp ?? "0.0.0.0", rule.dstWildcard ?? "255.255.255.255")}${rule.dstPort !== undefined ? ` eq ${rule.dstPort}` : ""}`,
          );
        }
      }
    } else {
      lines.push(`ip access-list ${acl.type} ${acl.name}`);
      for (const rule of acl.rules) {
        if (acl.type === "standard") {
          lines.push(
            ` ${rule.sequence} ${rule.action} ${formatAclAddr(rule.srcIp, rule.srcWildcard)}`,
          );
        } else {
          lines.push(
            ` ${rule.sequence} ${rule.action} ${rule.protocol} ${formatAclAddr(rule.srcIp, rule.srcWildcard)} ${formatAclAddr(rule.dstIp ?? "0.0.0.0", rule.dstWildcard ?? "255.255.255.255")}${rule.dstPort !== undefined ? ` eq ${rule.dstPort}` : ""}`,
          );
        }
      }
    }
    lines.push("!");
  }
  if (device.staticRoutes.length > 0) {
    lines.push("!");
  }
  lines.push("end");
  return lines.join("\n");
}

function formatAclAddr(ip: string, wildcard: string): string {
  if (ip === "0.0.0.0" && wildcard === "255.255.255.255") {
    return "any";
  }
  if (wildcard === "0.0.0.0") {
    return `host ${ip}`;
  }
  return `${ip} ${wildcard}`;
}

function formatShowAccessLists(
  device: NetworkDevice,
  filterName?: string,
): string {
  const allAcls = Object.values(device.acls ?? {});
  const targetAcls = filterName
    ? allAcls.filter((a) => a.name.toLowerCase() === filterName.toLowerCase())
    : allAcls;

  if (targetAcls.length === 0) {
    return filterName
      ? `% Access list "${filterName}" does not exist.`
      : "(No access lists configured)";
  }

  const lines: string[] = [];
  for (const acl of targetAcls) {
    const header =
      acl.type === "standard"
        ? `Standard IP access list ${acl.name}`
        : `Extended IP access list ${acl.name}`;
    lines.push(header);
    const sorted = [...acl.rules].sort((a, b) => a.sequence - b.sequence);
    for (const rule of sorted) {
      const desc =
        acl.type === "standard"
          ? `${rule.action} ${formatAclAddr(rule.srcIp, rule.srcWildcard)}`
          : `${rule.action} ${rule.protocol} ${formatAclAddr(rule.srcIp, rule.srcWildcard)} ${formatAclAddr(rule.dstIp ?? "0.0.0.0", rule.dstWildcard ?? "255.255.255.255")}${rule.dstPort !== undefined ? ` eq ${rule.dstPort}` : ""}`;
      lines.push(
        `    ${rule.sequence} ${desc}${rule.hitCount > 0 ? ` (${rule.hitCount} matches)` : ""}`,
      );
    }
    if (acl.implicitDenyHits > 0) {
      lines.push(
        `    (implicit) deny any (${acl.implicitDenyHits} matches)`,
      );
    }
  }
  return lines.join("\n");
}

function formatShowNatTranslations(device: NetworkDevice): string {
  const entries = device.natTranslations ?? [];
  if (entries.length === 0) {
    return "(No NAT translations active)";
  }
  const lines = [
    "Pro Inside global         Inside local          Outside local         Outside global",
  ];
  for (const e of entries) {
    const ig = `${e.insideGlobalIp}:${e.insideGlobalPort}`;
    const il = `${e.insideLocalIp}:${e.insideLocalPort}`;
    const ol = `${e.outsideLocalIp}:${e.outsideLocalPort}`;
    const og = `${e.outsideGlobalIp}:${e.outsideGlobalPort}`;
    lines.push(
      `${e.protocol.padEnd(4)}${ig.padEnd(22)}${il.padEnd(22)}${ol.padEnd(22)}${og}`,
    );
  }
  return lines.join("\n");
}

function formatShowDhcpBinding(device: NetworkDevice): string {
  const bindings = device.dhcpBindings ?? [];
  const lines = [
    "Bindings from all pools not associated with VRF:",
    "IP address       Client-ID/Hardware address   Pool             Type",
  ];
  if (bindings.length === 0) {
    lines.push("(No DHCP bindings active)");
    return lines.join("\n");
  }
  for (const b of bindings) {
    lines.push(
      `${b.ip.padEnd(17)}${b.mac.padEnd(29)}${b.poolName.padEnd(17)}${b.type}`,
    );
  }
  return lines.join("\n");
}

function formatShowMacAddressTable(device: NetworkDevice): string {
  const lines = [
    "          Mac Address Table",
    "-------------------------------------------",
    "Vlan    Mac Address       Type        Ports",
    "----    -----------       --------    -----",
  ];
  for (const entry of device.macTable) {
    lines.push(
      `${String(entry.vlan).padStart(4)}    ${entry.mac.padEnd(18)}${entry.type.toUpperCase().padEnd(12)}${entry.interfaceName}`,
    );
  }
  if (device.macTable.length === 0) {
    lines.push("(No MAC entries learned yet)");
  }
  return lines.join("\n");
}

function formatShowArp(device: NetworkDevice): string {
  const lines = [
    "Protocol  Address          Age (min)  Hardware Addr   Type   Interface",
  ];
  const seenIps = new Set<string>();

  for (const iface of Object.values(device.interfaces)) {
    if (!iface.ip || !iface.adminUp) {
      continue;
    }
    seenIps.add(iface.ip);
    lines.push(
      `Internet  ${iface.ip.padEnd(17)}-          ${iface.mac.padEnd(16)}ARPA   ${iface.name}`,
    );
  }

  for (const entry of device.arpTable) {
    if (seenIps.has(entry.ip)) {
      continue;
    }
    seenIps.add(entry.ip);
    lines.push(
      `Internet  ${entry.ip.padEnd(17)}0          ${entry.mac.padEnd(16)}ARPA   ${entry.interfaceName}`,
    );
  }

  return lines.join("\n");
}

function formatShowIpOspfNeighbor(
  state: NetworkState,
  device: NetworkDevice,
): string {
  if (!device.ospf) {
    return "(OSPF routing process not enabled)";
  }
  const neighbors = computeOspfNeighbors(state, device.id);
  if (neighbors.length === 0) {
    return "(No OSPF neighbors)";
  }
  const lines = [
    "Neighbor ID     Pri   State           Dead Time   Address         Interface",
  ];
  for (const n of neighbors) {
    lines.push(
      `${n.neighborRouterId.padEnd(16)}  1   ${`${n.state}/DR`.padEnd(16)}00:00:35    ${n.neighborIp.padEnd(16)}${n.localInterface}`,
    );
  }
  return lines.join("\n");
}

function formatShowSpanningTree(
  state: NetworkState,
  device: NetworkDevice,
  filterVlanId?: number,
): string {
  if (device.type !== "switch") {
    return "% Spanning tree is only supported on Layer 2 switches.";
  }
  const vlanStates = computeStpForSwitch(state, device.id, filterVlanId);
  if (vlanStates.length === 0) {
    return filterVlanId !== undefined
      ? `% Spanning tree instance not found for VLAN ${filterVlanId}.`
      : "(No active spanning-tree VLANs)";
  }

  const sections: string[] = [];
  for (const vs of vlanStates) {
    const userPriority = vs.bridgePriority - vs.vlanId;
    const vlanLabel = `VLAN${String(vs.vlanId).padStart(4, "0")}`;
    const lines = [
      vlanLabel,
      "  Spanning tree enabled protocol ieee",
      `  Root ID    Priority    ${vs.rootPriority}`,
      `             Address     ${vs.rootMac}`,
      vs.isRoot
        ? "             This bridge is the root"
        : `             Cost        ${vs.rootCost}`,
      `  Bridge ID  Priority    ${vs.bridgePriority}  (priority ${userPriority} sys-id-ext ${vs.vlanId})`,
      `             Address     ${vs.bridgeMac}`,
      "",
      "Interface        Role Sts Cost      Prio.Nbr Type",
      "---------------- ---- --- --------- -------- --------------------------------",
    ];
    for (const p of vs.ports) {
      lines.push(
        `${p.interfaceName.padEnd(17)}${p.role.padEnd(5)}${p.state.padEnd(4)}${String(p.cost).padEnd(10)}${p.portId.padEnd(9)}${p.type}`,
      );
    }
    sections.push(lines.join("\n"));
  }
  return sections.join("\n\n");
}

function formatShowStandbyBrief(
  state: NetworkState,
  device: NetworkDevice,
): string {
  const entries = computeHsrpTable(state).filter(
    (e) => e.deviceId === device.id,
  );
  if (entries.length === 0) {
    return "(No HSRP groups configured)";
  }
  const lines = [
    "                     P indicates configured to preempt.",
    "                     |",
    "Interface   Grp  Pri P State   Active          Standby         Virtual IP",
  ];
  for (const e of entries) {
    lines.push(
      `${e.interfaceName.padEnd(12)}${String(e.group).padEnd(5)}${String(e.priority).padEnd(4)}${e.preempt ? "P " : "  "}${e.state.padEnd(8)}${e.activeRouterIp.padEnd(16)}${e.standbyRouterIp.padEnd(16)}${e.virtualIp}`,
    );
  }
  return lines.join("\n");
}

function parseVlanId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1 || id > 4094) {
    return null;
  }
  return id;
}

function parseVlanList(spec: string): number[] | null {
  const parts = spec.split(",").map((s) => s.trim());
  if (parts.some((p) => p.length === 0)) {
    return null;
  }
  const ids = new Set<number>();

  for (const part of parts) {
    if (part.includes("-")) {
      const rangeParts = part.split("-");
      if (rangeParts.length !== 2) {
        return null;
      }
      const start = parseVlanId(rangeParts[0]);
      const end = parseVlanId(rangeParts[1]);
      if (start === null || end === null || start > end) {
        return null;
      }
      for (let v = start; v <= end; v += 1) {
        ids.add(v);
      }
    } else {
      const id = parseVlanId(part);
      if (id === null) {
        return null;
      }
      ids.add(id);
    }
  }

  return Array.from(ids).sort((a, b) => a - b);
}

function handleShowCommand(
  state: NetworkState,
  device: NetworkDevice,
  args: string[],
  rawTokens: string[],
): CommandResult {
  if (args.length === 0) {
    return {
      nextState: state,
      output: "% Incomplete command.",
      prompt: getDevicePrompt(device),
    };
  }

  const first = matchKeyword(args[0], [
    "ip",
    "ipv6",
    "vlan",
    "running-config",
    "mac",
    "arp",
    "access-lists",
    "spanning-tree",
    "standby",
    "etherchannel",
    "port-security",
  ]);
  if (first.kind === "ambiguous") {
    return {
      nextState: state,
      output: `% Ambiguous command: "${rawTokens.join(" ")}" (${first.matches.join(", ")})`,
      prompt: getDevicePrompt(device),
    };
  }
  if (first.kind === "none") {
    return buildInvalidInputResult(state, device, rawTokens);
  }

  if (first.value === "etherchannel") {
    if (args.length < 2) {
      return {
        nextState: state,
        output: "% Incomplete command. Usage: show etherchannel summary",
        prompt: getDevicePrompt(device),
      };
    }
    const sumKw = matchKeyword(args[1], ["summary"]);
    if (sumKw.kind !== "exact") {
      return buildInvalidInputResult(state, device, rawTokens);
    }
    return {
      nextState: state,
      output: formatEtherChannelSummary(state, device.id),
      prompt: getDevicePrompt(device),
    };
  }

  if (first.value === "port-security") {
    if (args.length === 1) {
      return {
        nextState: state,
        output: formatPortSecurity(state, device.id),
        prompt: getDevicePrompt(device),
      };
    }
    const ifKw = matchKeyword(args[1], ["interface"]);
    if (ifKw.kind !== "exact") {
      return buildInvalidInputResult(state, device, rawTokens);
    }
    if (args.length < 3) {
      return {
        nextState: state,
        output: "% Incomplete command. Usage: show port-security interface <name>",
        prompt: getDevicePrompt(device),
      };
    }
    const norm = normalizeInterfaceName(args.slice(2).join(""), device.interfaces);
    return {
      nextState: state,
      output: formatPortSecurity(state, device.id, norm ?? args[2]),
      prompt: getDevicePrompt(device),
    };
  }

  if (first.value === "ipv6") {
    if (args.length < 3) {
      return {
        nextState: state,
        output: "% Incomplete command. Usage: show ipv6 interface brief",
        prompt: getDevicePrompt(device),
      };
    }
    const ifKw = matchKeyword(args[1], ["interface"]);
    const brKw = matchKeyword(args[2], ["brief"]);
    if (ifKw.kind !== "exact" || brKw.kind !== "exact") {
      return buildInvalidInputResult(state, device, rawTokens);
    }
    return {
      nextState: state,
      output: formatIpv6InterfaceBrief(state, device.id),
      prompt: getDevicePrompt(device),
    };
  }

  if (first.value === "spanning-tree") {
    let filterVlan: number | undefined;
    if (args.length >= 2) {
      const vlKw = matchKeyword(args[1], ["vlan"]);
      if (vlKw.kind !== "exact") {
        return buildInvalidInputResult(state, device, rawTokens);
      }
      if (args.length < 3) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const parsedVid = parseVlanId(args[2]);
      if (parsedVid === null) {
        return buildInvalidInputResult(
          state,
          device,
          rawTokens,
          `不正なVLAN IDです: "${args[2]}"`,
        );
      }
      filterVlan = parsedVid;
    }
    return {
      nextState: state,
      output: formatShowSpanningTree(state, device, filterVlan),
      prompt: getDevicePrompt(device),
    };
  }

  if (first.value === "standby") {
    if (args.length >= 2) {
      const brKw = matchKeyword(args[1], ["brief"]);
      if (brKw.kind !== "exact") {
        return buildInvalidInputResult(state, device, rawTokens);
      }
    }
    return {
      nextState: state,
      output: formatShowStandbyBrief(state, device),
      prompt: getDevicePrompt(device),
    };
  }

  if (first.value === "access-lists") {
    return {
      nextState: state,
      output: formatShowAccessLists(device, args[1]),
      prompt: getDevicePrompt(device),
    };
  }

  if (first.value === "running-config") {
    if (device.cliState.mode === "user") {
      return {
        nextState: state,
        output:
          '% Privileged EXEC mode required. Hint: "enable" を実行してから再試行してください。',
        prompt: getDevicePrompt(device),
      };
    }
    return {
      nextState: state,
      output: formatShowRunningConfig(device),
      prompt: getDevicePrompt(device),
    };
  }

  if (first.value === "arp") {
    return {
      nextState: state,
      output: formatShowArp(device),
      prompt: getDevicePrompt(device),
    };
  }

  if (first.value === "vlan") {
    if (args.length < 2) {
      return {
        nextState: state,
        output: "% Incomplete command.",
        prompt: getDevicePrompt(device),
      };
    }
    const sub = matchKeyword(args[1], ["brief"]);
    if (sub.kind !== "exact") {
      return buildInvalidInputResult(state, device, rawTokens);
    }
    return {
      nextState: state,
      output: formatShowVlanBrief(device),
      prompt: getDevicePrompt(device),
    };
  }

  if (first.value === "mac") {
    if (args.length < 2) {
      return {
        nextState: state,
        output: "% Incomplete command.",
        prompt: getDevicePrompt(device),
      };
    }
    const sub = matchKeyword(args[1], ["address-table"]);
    if (sub.kind !== "exact") {
      return buildInvalidInputResult(state, device, rawTokens);
    }
    return {
      nextState: state,
      output: formatShowMacAddressTable(device),
      prompt: getDevicePrompt(device),
    };
  }

  // show ip ...
  if (args.length < 2) {
    return {
      nextState: state,
      output: "% Incomplete command.",
      prompt: getDevicePrompt(device),
    };
  }
  const ipSub = matchKeyword(args[1], [
    "interface",
    "route",
    "nat",
    "dhcp",
    "access-lists",
    "ospf",
  ]);
  if (ipSub.kind === "ambiguous") {
    return {
      nextState: state,
      output: `% Ambiguous command: "${rawTokens.join(" ")}"`,
      prompt: getDevicePrompt(device),
    };
  }
  if (ipSub.kind === "none") {
    return buildInvalidInputResult(state, device, rawTokens);
  }

  if (ipSub.value === "ospf") {
    if (args.length < 3) {
      return {
        nextState: state,
        output: "% Incomplete command.",
        prompt: getDevicePrompt(device),
      };
    }
    const nLower = args[2].toLowerCase();
    const isNbr =
      nLower.length > 0 &&
      ("neighbor".startsWith(nLower) || "neighbors".startsWith(nLower));
    if (!isNbr) {
      return buildInvalidInputResult(state, device, rawTokens);
    }
    return {
      nextState: state,
      output: formatShowIpOspfNeighbor(state, device),
      prompt: getDevicePrompt(device),
    };
  }

  if (ipSub.value === "route") {
    return {
      nextState: state,
      output: formatShowIpRoute(state, device),
      prompt: getDevicePrompt(device),
    };
  }

  if (ipSub.value === "access-lists") {
    return {
      nextState: state,
      output: formatShowAccessLists(device, args[2]),
      prompt: getDevicePrompt(device),
    };
  }

  if (ipSub.value === "nat") {
    if (args.length < 3) {
      return {
        nextState: state,
        output: "% Incomplete command.",
        prompt: getDevicePrompt(device),
      };
    }
    const trans = matchKeyword(args[2], ["translations"]);
    if (trans.kind !== "exact") {
      return buildInvalidInputResult(state, device, rawTokens);
    }
    return {
      nextState: state,
      output: formatShowNatTranslations(device),
      prompt: getDevicePrompt(device),
    };
  }

  if (ipSub.value === "dhcp") {
    if (args.length < 3) {
      return {
        nextState: state,
        output: "% Incomplete command.",
        prompt: getDevicePrompt(device),
      };
    }
    const bind = matchKeyword(args[2], ["binding"]);
    if (bind.kind !== "exact") {
      return buildInvalidInputResult(state, device, rawTokens);
    }
    return {
      nextState: state,
      output: formatShowDhcpBinding(device),
      prompt: getDevicePrompt(device),
    };
  }

  // show ip interface brief
  if (args.length < 3) {
    return {
      nextState: state,
      output: "% Incomplete command.",
      prompt: getDevicePrompt(device),
    };
  }
  const br = matchKeyword(args[2], ["brief"]);
  if (br.kind !== "exact") {
    return buildInvalidInputResult(state, device, rawTokens);
  }
  return {
    nextState: state,
    output: formatShowIpInterfaceBrief(state, device),
    prompt: getDevicePrompt(device),
  };
}

function handleEnterInterface(
  state: NetworkState,
  device: NetworkDevice,
  argTokens: string[],
  rawTokens: string[],
): CommandResult {
  if (argTokens.length === 0) {
    return {
      nextState: state,
      output: "% Incomplete command.",
      prompt: getDevicePrompt(device),
    };
  }

  const rawName = argTokens.join("");
  const normalized = normalizeInterfaceName(rawName, device.interfaces);
  if (!normalized) {
    return buildInvalidInputResult(
      state,
      device,
      rawTokens,
      `不正なインターフェース名です: "${argTokens.join(" ")}"`,
    );
  }

  const existing = device.interfaces[normalized];
  if (existing) {
    const nextMode = existing.isSubinterface ? "config-subif" : "config-if";
    const nextDevice: NetworkDevice = {
      ...device,
      cliState: {
        mode: nextMode,
        selectedInterface: normalized,
      },
    };
    return {
      nextState: updateDevice(state, nextDevice),
      output: "",
      prompt: getDevicePrompt(nextDevice),
    };
  }

  const dotIdx = normalized.indexOf(".");
  if (dotIdx !== -1) {
    const parentName = normalized.slice(0, dotIdx);
    const parentIface = device.interfaces[parentName];
    if (!parentIface) {
      return buildInvalidInputResult(
        state,
        device,
        rawTokens,
        `親インターフェース ${parentName} が存在しません。`,
      );
    }

    const newSubIface: NetworkInterface = {
      name: normalized,
      mac: parentIface.mac,
      adminUp: true,
      isSubinterface: true,
      parentInterface: parentName,
    };

    const nextDevice: NetworkDevice = {
      ...device,
      interfaces: {
        ...device.interfaces,
        [normalized]: newSubIface,
      },
      cliState: {
        mode: "config-subif",
        selectedInterface: normalized,
      },
    };

    return {
      nextState: updateDevice(state, nextDevice),
      output: "",
      prompt: getDevicePrompt(nextDevice),
    };
  }

  return buildInvalidInputResult(
    state,
    device,
    rawTokens,
    `インターフェース ${normalized} はこの機器に存在しません。`,
  );
}

function handleEnterVlan(
  state: NetworkState,
  device: NetworkDevice,
  argTokens: string[],
  rawTokens: string[],
): CommandResult {
  if (argTokens.length === 0) {
    return {
      nextState: state,
      output: "% Incomplete command.",
      prompt: getDevicePrompt(device),
    };
  }

  const vlanId = parseVlanId(argTokens[0]);
  if (vlanId === null) {
    return buildInvalidInputResult(
      state,
      device,
      rawTokens,
      `VLAN ID は 1〜4094 の整数で指定してください: "${argTokens[0]}"`,
    );
  }

  const existingVlan = device.vlans[vlanId];
  const nextVlans = existingVlan
    ? device.vlans
    : {
        ...device.vlans,
        [vlanId]: {
          id: vlanId,
          name: `VLAN${String(vlanId).padStart(4, "0")}`,
          active: true,
        },
      };

  const nextDevice: NetworkDevice = {
    ...device,
    vlans: nextVlans,
    cliState: {
      mode: "config-vlan",
      selectedVlanId: vlanId,
    },
  };

  return {
    nextState: updateDevice(state, nextDevice),
    output: "",
    prompt: getDevicePrompt(nextDevice),
  };
}

function executeEndHostCommand(
  state: NetworkState,
  device: NetworkDevice,
  tokens: string[],
): CommandResult {
  const cmdLower = tokens[0].toLowerCase();
  if (cmdLower === "?" || cmdLower === "help") {
    return {
      nextState: state,
      output: formatHelpOutput(device),
      prompt: getDevicePrompt(device),
    };
  }

  const matched = matchKeyword(cmdLower, [
    "ipconfig",
    "ifconfig",
    "ip",
    "ss",
    "dig",
    "systemctl",
    "set",
    "ping",
    "traceroute",
    "nslookup",
    "curl",
    "nc",
  ]);
  if (matched.kind === "ambiguous") {
    return {
      nextState: state,
      output: `% Ambiguous command: "${tokens.join(" ")}" (${matched.matches.join(", ")})`,
      prompt: getDevicePrompt(device),
    };
  }
  if (matched.kind === "none") {
    return buildInvalidInputResult(state, device, tokens);
  }

  if (matched.value === "ip") {
    if (tokens.length < 2) {
      return {
        nextState: state,
        output: "% Incomplete command. Usage: ip addr [show] | ip route [show]",
        prompt: getDevicePrompt(device),
      };
    }
    const ipSub = matchKeyword(tokens[1], ["address", "route"]);
    if (ipSub.kind === "ambiguous") {
      return {
        nextState: state,
        output: `% Ambiguous command: "${tokens.join(" ")}"`,
        prompt: getDevicePrompt(device),
      };
    }
    if (ipSub.kind !== "exact") {
      return buildInvalidInputResult(state, device, tokens);
    }
    if (tokens[2] && !"show".startsWith(tokens[2].toLowerCase())) {
      return buildInvalidInputResult(state, device, tokens);
    }

    if (ipSub.value === "address") {
      const lines = [
        "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default",
        "    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00",
        "    inet 127.0.0.1/8 scope host lo",
      ];
      Object.values(device.interfaces).forEach((iface, idx) => {
        const up = isInterfaceOperationalUp(state, device.id, iface.name);
        lines.push(
          `${idx + 2}: ${iface.name}: <BROADCAST,MULTICAST${up ? ",UP,LOWER_UP" : ""}> mtu 1500 state ${up ? "UP" : "DOWN"}`,
        );
        lines.push(`    link/ether ${iface.mac} brd ff:ff:ff:ff:ff:ff`);
        if (iface.ip && iface.subnetMask) {
          try {
            const info = calculateSubnet(iface.ip, iface.subnetMask);
            lines.push(
              `    inet ${iface.ip}/${info.prefixLength} brd ${info.broadcastAddress} scope global ${iface.name}`,
            );
          } catch {
            lines.push(`    inet ${iface.ip} scope global ${iface.name}`);
          }
        }
      });
      return {
        nextState: state,
        output: lines.join("\n"),
        prompt: getDevicePrompt(device),
      };
    }

    // ip route [show]
    const ifaces = Object.values(device.interfaces);
    const primaryIf =
      ifaces.find((i) => isInterfaceOperationalUp(state, device.id, i.name)) ??
      ifaces[0];
    const lines: string[] = [];
    if (device.defaultGateway && primaryIf) {
      lines.push(
        `default via ${device.defaultGateway} dev ${primaryIf.name} proto static`,
      );
    }
    for (const iface of ifaces) {
      if (
        !iface.ip ||
        !iface.subnetMask ||
        !isInterfaceOperationalUp(state, device.id, iface.name)
      ) {
        continue;
      }
      try {
        const info = calculateSubnet(iface.ip, iface.subnetMask);
        lines.push(
          `${info.networkAddress}/${info.prefixLength} dev ${iface.name} proto kernel scope link src ${iface.ip}`,
        );
      } catch {
        continue;
      }
    }
    return {
      nextState: state,
      output: lines.length > 0 ? lines.join("\n") : "(No routes configured)",
      prompt: getDevicePrompt(device),
    };
  }

  if (matched.value === "ss") {
    const flags = tokens.slice(1).filter((t) => t.startsWith("-")).join("");
    const hasT = flags.includes("t");
    const hasU = flags.includes("u");
    const showTcp = !flags || hasT || (!hasT && !hasU);
    const showUdp = !flags || hasU || (!hasT && !hasU);

    const rawServices: ListeningService[] =
      device.listeningServices !== undefined
        ? device.listeningServices
        : device.type === "server"
          ? [
              {
                protocol: "tcp",
                port: 80,
                serviceName: "http",
                active: true,
                processName: "nginx",
                unitName: "nginx",
              },
              {
                protocol: "tcp",
                port: 443,
                serviceName: "https",
                active: true,
                processName: "nginx",
                unitName: "nginx",
              },
            ]
          : [];

    const active = rawServices.filter((s) => s.active);
    if (
      device.dnsRecords &&
      Object.keys(device.dnsRecords).length > 0 &&
      !active.some((s) => s.port === 53)
    ) {
      active.push({
        protocol: "udp",
        port: 53,
        serviceName: "dns",
        active: true,
        processName: "named",
        unitName: "named",
      });
    }

    const filtered = active
      .filter((s) => (s.protocol === "tcp" ? showTcp : showUdp))
      .sort((a, b) =>
        a.protocol !== b.protocol
          ? a.protocol.localeCompare(b.protocol)
          : a.port - b.port,
      );

    const header =
      "Netid  State   Recv-Q  Send-Q   Local Address:Port   Peer Address:Port  Process";
    if (filtered.length === 0) {
      return {
        nextState: state,
        output: `${header}\n(No listening sockets)`,
        prompt: getDevicePrompt(device),
      };
    }

    const rows = filtered.map((s) => {
      const proc =
        s.processName ??
        s.unitName ??
        (s.serviceName === "http" || s.serviceName === "https"
          ? "nginx"
          : s.serviceName === "ssh"
            ? "sshd"
            : s.serviceName === "telnet"
              ? "telnetd"
              : s.serviceName);
      const localAddr = `0.0.0.0:${s.port}`;
      const peerAddr = s.protocol === "tcp" ? "0.0.0.0:*" : "*:*";
      return `${s.protocol.padEnd(7)}${(s.protocol === "tcp" ? "LISTEN" : "UNCONN").padEnd(8)}0       128      ${localAddr.padEnd(21)}${peerAddr.padEnd(19)}users:(("${proc}",pid=${1000 + s.port},fd=6))`;
    });

    return {
      nextState: state,
      output: [header, ...rows].join("\n"),
      prompt: getDevicePrompt(device),
    };
  }

  if (matched.value === "dig") {
    let serverOverride: string | undefined;
    const positional: string[] = [];
    for (const tok of tokens.slice(1)) {
      if (tok.startsWith("@")) {
        serverOverride = tok.slice(1);
      } else if (!tok.startsWith("-") && !tok.startsWith("+")) {
        positional.push(tok);
      }
    }
    const targetHost = positional[0];
    if (!targetHost) {
      return {
        nextState: state,
        output: "% Incomplete command. Usage: dig [@server] <hostname>",
        prompt: getDevicePrompt(device),
      };
    }
    let queryState = state;
    if (serverOverride) {
      const parsedSrv = parseIpv4(serverOverride);
      if (!parsedSrv.ok) {
        return buildInvalidInputResult(state, device, tokens, parsedSrv.error);
      }
      queryState = updateDevice(state, { ...device, dnsServer: serverOverride });
    }

    const sim = simulateNslookup(queryState, device.id, targetHost);
    const trace = sim.trace;
    if (trace.success && trace.resolvedIp) {
      const out = [
        `; <<>> DiG 9.18.24-Ubuntu <<>> ${targetHost}`,
        `;; Got answer:`,
        `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 4201`,
        `;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 0`,
        "",
        `;; QUESTION SECTION:`,
        `;${targetHost}.                 IN      A`,
        "",
        `;; ANSWER SECTION:`,
        `${targetHost}.          300     IN      A       ${trace.resolvedIp}`,
        "",
        `;; SERVER: ${trace.dnsServerIp ?? "127.0.0.53"}#53(${trace.dnsServerIp ?? "127.0.0.53"})`,
      ].join("\n");
      return {
        nextState: state,
        output: out,
        prompt: getDevicePrompt(device),
        trace,
      };
    }

    if (trace.failureReason === "NXDOMAIN") {
      const out = [
        `; <<>> DiG 9.18.24-Ubuntu <<>> ${targetHost}`,
        `;; Got answer:`,
        `;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 4201`,
        `;; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 0`,
        "",
        `;; QUESTION SECTION:`,
        `;${targetHost}.                 IN      A`,
        "",
        `;; SERVER: ${trace.dnsServerIp ?? "unknown"}#53(${trace.dnsServerIp ?? "unknown"})`,
      ].join("\n");
      return {
        nextState: state,
        output: out,
        prompt: getDevicePrompt(device),
        trace,
      };
    }

    return {
      nextState: state,
      output: [
        `; <<>> DiG 9.18.24-Ubuntu <<>> ${targetHost}`,
        `;; connection timed out; no servers could be reached (${trace.failureReason ?? "Unreachable"}: ${trace.failureMessage ?? ""})`,
      ].join("\n"),
      prompt: getDevicePrompt(device),
      trace,
    };
  }

  if (matched.value === "systemctl") {
    if (tokens.length < 3) {
      return {
        nextState: state,
        output:
          "% Incomplete command. Usage: systemctl {status|start|stop|restart} <service>",
        prompt: getDevicePrompt(device),
      };
    }
    const actionMatch = matchKeyword(tokens[1], [
      "status",
      "start",
      "stop",
      "restart",
    ]);
    if (actionMatch.kind === "ambiguous") {
      return {
        nextState: state,
        output: `% Ambiguous command: "${tokens.join(" ")}"`,
        prompt: getDevicePrompt(device),
      };
    }
    if (actionMatch.kind !== "exact") {
      return buildInvalidInputResult(state, device, tokens);
    }

    const unit = tokens[2].replace(/\.service$/i, "").toLowerCase();
    const matchesUnit = (svc: ListeningService): boolean => {
      if (
        svc.unitName?.toLowerCase() === unit ||
        svc.processName?.toLowerCase() === unit ||
        svc.serviceName.toLowerCase() === unit
      ) {
        return true;
      }
      if (
        unit === "nginx" &&
        (svc.serviceName === "http" ||
          svc.serviceName === "https" ||
          svc.port === 80 ||
          svc.port === 443)
      ) {
        return true;
      }
      if (unit === "sshd" && svc.port === 22) {
        return true;
      }
      if ((unit === "named" || unit === "bind9") && svc.port === 53) {
        return true;
      }
      return false;
    };

    const currentServices: ListeningService[] =
      device.listeningServices !== undefined
        ? device.listeningServices
        : device.type === "server" && unit === "nginx"
          ? [
              {
                protocol: "tcp",
                port: 80,
                serviceName: "http",
                active: true,
                processName: "nginx",
                unitName: "nginx",
              },
              {
                protocol: "tcp",
                port: 443,
                serviceName: "https",
                active: true,
                processName: "nginx",
                unitName: "nginx",
              },
            ]
          : [];

    const matching = currentServices.filter(matchesUnit);

    if (actionMatch.value === "status") {
      if (matching.length === 0) {
        return {
          nextState: state,
          output: `Unit ${unit}.service could not be found on ${device.hostname}.`,
          prompt: getDevicePrompt(device),
        };
      }
      const isActive = matching.some((s) => s.active);
      const portsDesc = matching
        .map((s) => `${s.protocol.toUpperCase()}/${s.port} (${s.serviceName})`)
        .join(", ");
      const dot = isActive ? "●" : "○";
      const out = [
        `${dot} ${unit}.service - ${unit.toUpperCase()} Server Daemon`,
        `     Loaded: loaded (/lib/systemd/system/${unit}.service; enabled)`,
        `     Active: ${isActive ? "active (running)" : "inactive (dead)"}`,
        `      Ports: ${portsDesc}`,
      ].join("\n");
      return {
        nextState: state,
        output: out,
        prompt: getDevicePrompt(device),
      };
    }

    const enableTarget =
      actionMatch.value === "start" || actionMatch.value === "restart";
    let updatedServices: ListeningService[];
    if (matching.length > 0) {
      updatedServices = currentServices.map((s) =>
        matchesUnit(s) ? { ...s, active: enableTarget } : s,
      );
    } else if (enableTarget && unit === "nginx") {
      updatedServices = [
        ...currentServices,
        {
          protocol: "tcp",
          port: 80,
          serviceName: "http",
          active: true,
          processName: "nginx",
          unitName: "nginx",
        },
        {
          protocol: "tcp",
          port: 443,
          serviceName: "https",
          active: true,
          processName: "nginx",
          unitName: "nginx",
        },
      ];
    } else {
      return {
        nextState: state,
        output: `Failed to ${actionMatch.value} ${unit}.service: Unit ${unit}.service not found.`,
        prompt: getDevicePrompt(device),
      };
    }

    const nextDevice: NetworkDevice = {
      ...device,
      listeningServices: updatedServices,
    };
    const nextPorts = updatedServices
      .filter((s) => matchesUnit(s) && s.active)
      .map((s) => `${s.protocol.toUpperCase()}/${s.port}`)
      .join(", ");

    return {
      nextState: updateDevice(state, nextDevice),
      output: enableTarget
        ? `Started ${unit}.service (Active ports: ${nextPorts})`
        : `Stopped ${unit}.service`,
      prompt: getDevicePrompt(nextDevice),
    };
  }

  if (matched.value === "ipconfig" || matched.value === "ifconfig") {
    if (
      matched.value === "ipconfig" &&
      tokens[1]?.toLowerCase() === "/renew"
    ) {
      const sim = simulateDhcpRenew(state, device.id);
      return {
        nextState: sim.nextState,
        output: sim.output,
        prompt: getDevicePrompt(sim.nextState.devices[device.id] ?? device),
        trace: sim.trace,
      };
    }

    const ifaces = Object.values(device.interfaces);
    const lines = [`Host Configuration for ${device.hostname}:`];
    for (const iface of ifaces) {
      const linkState = isInterfaceOperationalUp(state, device.id, iface.name)
        ? "UP"
        : "DOWN";
      lines.push(`  Interface     : ${iface.name} (${linkState})`);
      lines.push(`  MAC Address   : ${iface.mac}`);
      lines.push(`  IPv4 Address  : ${iface.ip ?? "Not assigned"}`);
      lines.push(`  Subnet Mask   : ${iface.subnetMask ?? "Not assigned"}`);
    }
    lines.push(
      `  Default GW    : ${device.defaultGateway ?? "Not configured"}`,
    );
    lines.push(`  DNS Server    : ${device.dnsServer ?? "Not configured"}`);
    if (device.dnsRecords && Object.keys(device.dnsRecords).length > 0) {
      lines.push("  DNS Zone A    :");
      for (const [host, ip] of Object.entries(device.dnsRecords)) {
        lines.push(`    ${host} -> ${ip}`);
      }
    }
    return {
      nextState: state,
      output: lines.join("\n"),
      prompt: getDevicePrompt(device),
    };
  }

  if (matched.value === "ping") {
    if (tokens.length < 2) {
      return {
        nextState: state,
        output: "% Incomplete command. Usage: ping <ip|hostname>",
        prompt: getDevicePrompt(device),
      };
    }
    const sim = tokens[1].includes(":")
      ? simulateIpv6Ping(state, device.id, tokens[1])
      : simulatePing(state, device.id, tokens[1]);
    return {
      nextState: sim.nextState,
      output: sim.output,
      prompt: getDevicePrompt(sim.nextState.devices[device.id] ?? device),
      trace: sim.trace,
    };
  }

  if (matched.value === "traceroute") {
    if (tokens.length < 2) {
      return {
        nextState: state,
        output: "% Incomplete command. Usage: traceroute <ip|hostname>",
        prompt: getDevicePrompt(device),
      };
    }
    const sim = simulateTraceroute(state, device.id, tokens[1]);
    return {
      nextState: sim.nextState,
      output: sim.output,
      prompt: getDevicePrompt(sim.nextState.devices[device.id] ?? device),
      trace: sim.trace,
    };
  }

  if (matched.value === "nslookup") {
    if (tokens.length < 2) {
      return {
        nextState: state,
        output: "% Incomplete command. Usage: nslookup <hostname>",
        prompt: getDevicePrompt(device),
      };
    }
    const sim = simulateNslookup(state, device.id, tokens[1]);
    return {
      nextState: sim.nextState,
      output: sim.output,
      prompt: getDevicePrompt(sim.nextState.devices[device.id] ?? device),
      trace: sim.trace,
    };
  }

  if (matched.value === "curl") {
    const flags = tokens.slice(1).filter((t) => t.startsWith("-"));
    const positional = tokens.slice(1).filter((t) => !t.startsWith("-"));
    if (positional.length < 1) {
      return {
        nextState: state,
        output:
          "% Incomplete command. Usage: curl [-v] http(s)://<ip|host>[:port]",
        prompt: getDevicePrompt(device),
      };
    }
    const verbose = flags.some(
      (f) =>
        f === "-v" ||
        f === "--verbose" ||
        (f.startsWith("-") && !f.startsWith("--") && f.includes("v")),
    );
    const rawUrl = positional[0].trim();
    const isHttpsScheme = rawUrl.toLowerCase().startsWith("https://");
    const stripped = rawUrl.replace(/^https?:\/\//i, "").split("/")[0] ?? "";
    const [hostPart, portPart] = stripped.split(":");
    const port = portPart ? Number(portPart) : isHttpsScheme ? 443 : 80;

    if (!hostPart || !Number.isInteger(port) || port < 1 || port > 65535) {
      return buildInvalidInputResult(
        state,
        device,
        tokens,
        `不正なURL指定です: "${rawUrl}"`,
      );
    }

    const sim = simulateTcpConnect(state, device.id, hostPart, port, "curl", {
      verbose,
      isHttps: isHttpsScheme || port === 443,
    });
    return {
      nextState: sim.nextState,
      output: sim.output,
      prompt: getDevicePrompt(sim.nextState.devices[device.id] ?? device),
      trace: sim.trace,
    };
  }

  if (matched.value === "nc") {
    const args = tokens.slice(1).filter((t) => !t.startsWith("-"));
    if (args.length < 2) {
      return {
        nextState: state,
        output: "% Incomplete command. Usage: nc -zv <ip|host> <port>",
        prompt: getDevicePrompt(device),
      };
    }
    const hostPart = args[0];
    const port = Number(args[1]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return buildInvalidInputResult(
        state,
        device,
        tokens,
        `不正なポート番号です: "${args[1]}"`,
      );
    }
    const sim = simulateTcpConnect(state, device.id, hostPart, port, "nc");
    return {
      nextState: sim.nextState,
      output: sim.output,
      prompt: getDevicePrompt(sim.nextState.devices[device.id] ?? device),
      trace: sim.trace,
    };
  }

  // set ...
  if (tokens.length < 2) {
    return {
      nextState: state,
      output: "% Incomplete command. Usage: set ip <ip> <mask> [gateway] | set dns <ip>",
      prompt: getDevicePrompt(device),
    };
  }
  const sub = matchKeyword(tokens[1], ["ip", "dns"]);
  if (sub.kind !== "exact") {
    return buildInvalidInputResult(state, device, tokens);
  }

  if (sub.value === "dns") {
    if (tokens.length < 3) {
      return {
        nextState: state,
        output: "% Incomplete command. Usage: set dns <ip>",
        prompt: getDevicePrompt(device),
      };
    }
    const parsedDns = parseIpv4(tokens[2]);
    if (!parsedDns.ok) {
      return buildInvalidInputResult(state, device, tokens, parsedDns.error);
    }
    const nextDevice: NetworkDevice = {
      ...device,
      dnsServer: tokens[2],
    };
    return {
      nextState: updateDevice(state, nextDevice),
      output: `DNS Server set to ${tokens[2]}`,
      prompt: getDevicePrompt(nextDevice),
    };
  }

  // set ip <ip> <mask> [gateway]
  if (tokens.length < 4) {
    return {
      nextState: state,
      output: "% Incomplete command. Usage: set ip <ip> <mask> [gateway]",
      prompt: getDevicePrompt(device),
    };
  }
  const ipStr = tokens[2];
  const maskStr = tokens[3];
  const gwStr = tokens[4];

  const ipParsed = parseIpv4(ipStr);
  if (!ipParsed.ok) {
    return buildInvalidInputResult(state, device, tokens, ipParsed.error);
  }
  try {
    maskToPrefix(maskStr);
  } catch (error) {
    return buildInvalidInputResult(
      state,
      device,
      tokens,
      error instanceof Error ? error.message : "不正なサブネットマスクです。",
    );
  }
  if (!isValidHostIp(ipStr, maskStr)) {
    return buildInvalidInputResult(
      state,
      device,
      tokens,
      `${ipStr}/${maskToPrefix(maskStr)} はネットワークアドレスまたはブロードキャストアドレスのためホストに設定できません。`,
    );
  }
  if (gwStr !== undefined) {
    const gwParsed = parseIpv4(gwStr);
    if (!gwParsed.ok) {
      return buildInvalidInputResult(state, device, tokens, gwParsed.error);
    }
    if (!isSameSubnet(ipStr, gwStr, maskStr)) {
      return buildInvalidInputResult(
        state,
        device,
        tokens,
        `デフォルトゲートウェイ (${gwStr}) がホストIP (${ipStr}) と同一サブネット内にありません。`,
      );
    }
  }

  const primaryIface =
    Object.values(device.interfaces).find((i) => !i.name.toLowerCase().startsWith("lo")) ??
    Object.values(device.interfaces)[0];
  if (!primaryIface) {
    return buildInvalidInputResult(
      state,
      device,
      tokens,
      "ネットワークインターフェースが存在しません。",
    );
  }

  const nextDevice: NetworkDevice = {
    ...device,
    interfaces: {
      ...device.interfaces,
      [primaryIface.name]: {
        ...primaryIface,
        ip: ipStr,
        subnetMask: maskStr,
      },
    },
    ...(gwStr !== undefined ? { defaultGateway: gwStr } : {}),
  };

  return {
    nextState: updateDevice(state, nextDevice),
    output: gwStr
      ? `IP configured: ${ipStr} ${maskStr} (Gateway: ${gwStr})`
      : `IP configured: ${ipStr} ${maskStr}`,
    prompt: getDevicePrompt(nextDevice),
  };
}

function executeIosPrivilegedOrUserCommand(
  state: NetworkState,
  device: NetworkDevice,
  tokens: string[],
  allowPrivileged: boolean,
): CommandResult {
  const candidates = allowPrivileged
    ? [
        "disable",
        "configure",
        "show",
        "ping",
        "traceroute",
        "exit",
        "end",
      ]
    : ["enable", "show", "ping", "traceroute", "exit", "quit"];

  const matched = matchKeyword(tokens[0], candidates);
  if (matched.kind === "ambiguous") {
    return {
      nextState: state,
      output: `% Ambiguous command: "${tokens.join(" ")}" (${matched.matches.join(", ")})`,
      prompt: getDevicePrompt(device),
    };
  }
  if (matched.kind === "none") {
    return buildInvalidInputResult(state, device, tokens);
  }

  switch (matched.value) {
    case "enable": {
      const nextDevice: NetworkDevice = {
        ...device,
        cliState: { mode: "privileged" },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "disable": {
      const nextDevice: NetworkDevice = {
        ...device,
        cliState: { mode: "user" },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "configure": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const term = matchKeyword(tokens[1], ["terminal"]);
      if (term.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      const nextDevice: NetworkDevice = {
        ...device,
        cliState: { mode: "config" },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "Enter configuration commands, one per line.  End with CNTL/Z.",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "show":
      return handleShowCommand(state, device, tokens.slice(1), tokens);

    case "ping": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const sim = tokens[1].includes(":")
        ? simulateIpv6Ping(state, device.id, tokens[1])
        : simulatePing(state, device.id, tokens[1]);
      return {
        nextState: sim.nextState,
        output: sim.output,
        prompt: getDevicePrompt(sim.nextState.devices[device.id] ?? device),
        trace: sim.trace,
      };
    }

    case "traceroute": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const sim = simulateTraceroute(state, device.id, tokens[1]);
      return {
        nextState: sim.nextState,
        output: sim.output,
        prompt: getDevicePrompt(sim.nextState.devices[device.id] ?? device),
        trace: sim.trace,
      };
    }

    case "exit":
    case "quit": {
      if (device.cliState.mode === "privileged") {
        const nextDevice: NetworkDevice = {
          ...device,
          cliState: { mode: "user" },
        };
        return {
          nextState: updateDevice(state, nextDevice),
          output: "",
          prompt: getDevicePrompt(nextDevice),
        };
      }
      return {
        nextState: state,
        output: "",
        prompt: getDevicePrompt(device),
      };
    }

    case "end":
      return {
        nextState: state,
        output: "",
        prompt: getDevicePrompt(device),
      };

    default:
      return buildInvalidInputResult(state, device, tokens);
  }
}

function executeDoCommand(
  state: NetworkState,
  device: NetworkDevice,
  doTokens: string[],
  rawTokens: string[],
): CommandResult {
  if (doTokens.length === 0) {
    return {
      nextState: state,
      output: "% Incomplete command.",
      prompt: getDevicePrompt(device),
    };
  }
  const first = matchKeyword(doTokens[0], ["show", "ping", "traceroute"]);
  if (first.kind === "ambiguous") {
    return {
      nextState: state,
      output: `% Ambiguous command: "${rawTokens.join(" ")}"`,
      prompt: getDevicePrompt(device),
    };
  }
  if (first.kind === "none") {
    return buildInvalidInputResult(state, device, rawTokens);
  }

  // 一時的に特権コンテキストとして実行し、現在のコンフィグモード・プロンプトを維持する
  const savedCliState = device.cliState;
  const res = executeIosPrivilegedOrUserCommand(
    state,
    { ...device, cliState: { mode: "privileged" } },
    doTokens,
    true,
  );
  const updatedDevice = res.nextState.devices[device.id] ?? device;
  const restoredDevice: NetworkDevice = {
    ...updatedDevice,
    cliState: savedCliState,
  };
  return {
    nextState: updateDevice(res.nextState, restoredDevice),
    output: res.output,
    prompt: getDevicePrompt(restoredDevice),
    trace: res.trace,
  };
}

function parseAclPort(raw: string): number | null {
  const lower = raw.toLowerCase();
  const named: Record<string, number> = {
    www: 80,
    http: 80,
    https: 443,
    ssh: 22,
    telnet: 23,
    domain: 53,
    dns: 53,
    ftp: 21,
    smtp: 25,
  };
  if (named[lower] !== undefined) {
    return named[lower];
  }
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 1 || num > 65535) {
    return null;
  }
  return num;
}

type AclAddrParseResult =
  | { ok: true; ip: string; wildcard: string; nextIndex: number }
  | { ok: false; incomplete?: boolean; error?: string };

function parseAclAddressSpec(
  tokens: string[],
  startIdx: number,
  allowImplicitHost: boolean,
): AclAddrParseResult {
  const first = tokens[startIdx];
  if (!first) {
    return { ok: false, incomplete: true };
  }
  const lower = first.toLowerCase();
  if (lower === "any") {
    return {
      ok: true,
      ip: "0.0.0.0",
      wildcard: "255.255.255.255",
      nextIndex: startIdx + 1,
    };
  }
  if (lower === "host") {
    const ipTok = tokens[startIdx + 1];
    if (!ipTok) {
      return { ok: false, incomplete: true };
    }
    const parsed = parseIpv4(ipTok);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    return {
      ok: true,
      ip: ipTok,
      wildcard: "0.0.0.0",
      nextIndex: startIdx + 2,
    };
  }

  const ipParsed = parseIpv4(first);
  if (!ipParsed.ok) {
    return { ok: false, error: ipParsed.error };
  }

  const second = tokens[startIdx + 1];
  if (second && isValidIpv4(second)) {
    return {
      ok: true,
      ip: first,
      wildcard: second,
      nextIndex: startIdx + 2,
    };
  }

  if (allowImplicitHost) {
    return {
      ok: true,
      ip: first,
      wildcard: "0.0.0.0",
      nextIndex: startIdx + 1,
    };
  }

  if (!second) {
    return { ok: false, incomplete: true };
  }
  return {
    ok: false,
    error: `不正なワイルドカードマスクです: "${second}"`,
  };
}

function buildAclRuleFromTokens(
  aclType: "standard" | "extended",
  tokens: string[],
  startIdx: number,
  explicitSeq?: number,
):
  | { ok: true; rule: Omit<AclRule, "sequence">; explicitSeq?: number }
  | { ok: false; incomplete?: boolean; error?: string } {
  const actionTok = tokens[startIdx];
  if (!actionTok) {
    return { ok: false, incomplete: true };
  }
  const actMatch = matchKeyword(actionTok, ["permit", "deny"]);
  if (actMatch.kind !== "exact") {
    return { ok: false };
  }
  const action = actMatch.value as AclAction;

  if (aclType === "standard") {
    const src = parseAclAddressSpec(tokens, startIdx + 1, true);
    if (!src.ok) {
      return src;
    }
    if (src.nextIndex < tokens.length) {
      return {
        ok: false,
        error: `余分な引数が指定されています: "${tokens[src.nextIndex]}"`,
      };
    }
    return {
      ok: true,
      explicitSeq,
      rule: {
        action,
        protocol: "ip",
        srcIp: src.ip,
        srcWildcard: src.wildcard,
        hitCount: 0,
      },
    };
  }

  const protoTok = tokens[startIdx + 1];
  if (!protoTok) {
    return { ok: false, incomplete: true };
  }
  const proto: AclProtocol | null = normalizeAclProtocol(protoTok);
  if (!proto) {
    return {
      ok: false,
      error: `サポートされていないプロトコルです: "${protoTok}" (ip | icmp | tcp | udp)`,
    };
  }

  const src = parseAclAddressSpec(tokens, startIdx + 2, false);
  if (!src.ok) {
    return src;
  }
  const dst = parseAclAddressSpec(tokens, src.nextIndex, false);
  if (!dst.ok) {
    return dst;
  }

  let dstPort: number | undefined;
  if (dst.nextIndex < tokens.length) {
    const eqTok = tokens[dst.nextIndex]?.toLowerCase();
    if (eqTok !== "eq") {
      return {
        ok: false,
        error: `未知のACLオプションです: "${tokens[dst.nextIndex]}" ("eq <port>" を使用してください)`,
      };
    }
    const portTok = tokens[dst.nextIndex + 1];
    if (!portTok) {
      return { ok: false, incomplete: true };
    }
    const parsedPort = parseAclPort(portTok);
    if (parsedPort === null) {
      return {
        ok: false,
        error: `不正なポート番号です: "${portTok}"`,
      };
    }
    dstPort = parsedPort;
    if (dst.nextIndex + 2 < tokens.length) {
      return {
        ok: false,
        error: `余分な引数が指定されています: "${tokens[dst.nextIndex + 2]}"`,
      };
    }
  }

  return {
    ok: true,
    explicitSeq,
    rule: {
      action,
      protocol: proto,
      srcIp: src.ip,
      srcWildcard: src.wildcard,
      dstIp: dst.ip,
      dstWildcard: dst.wildcard,
      ...(dstPort !== undefined ? { dstPort } : {}),
      hitCount: 0,
    },
  };
}

function upsertAclEntryOnDevice(
  device: NetworkDevice,
  aclName: string,
  aclType: "standard" | "extended",
  ruleBody: Omit<AclRule, "sequence">,
  explicitSeq?: number,
): NetworkDevice {
  const existingAcl: AccessList = device.acls?.[aclName] ?? {
    name: aclName,
    type: aclType,
    rules: [],
    implicitDenyHits: 0,
  };
  const maxSeq = existingAcl.rules.reduce(
    (max, r) => Math.max(max, r.sequence),
    0,
  );
  const seq = explicitSeq ?? maxSeq + 10;
  const fullRule: AclRule = { ...ruleBody, sequence: seq };
  const nextRules = [
    ...existingAcl.rules.filter((r) => r.sequence !== seq),
    fullRule,
  ].sort((a, b) => a.sequence - b.sequence);

  return {
    ...device,
    acls: {
      ...(device.acls ?? {}),
      [aclName]: {
        ...existingAcl,
        rules: nextRules,
      },
    },
  };
}

function executeConfigMode(
  state: NetworkState,
  device: NetworkDevice,
  tokens: string[],
): CommandResult {
  const matched = matchKeyword(tokens[0], [
    "hostname",
    "interface",
    "vlan",
    "ip",
    "ipv6",
    "access-list",
    "router",
    "spanning-tree",
    "no",
    "do",
    "exit",
    "end",
  ]);
  if (matched.kind === "ambiguous") {
    return {
      nextState: state,
      output: `% Ambiguous command: "${tokens.join(" ")}" (${matched.matches.join(", ")})`,
      prompt: getDevicePrompt(device),
    };
  }
  if (matched.kind === "none") {
    return buildInvalidInputResult(state, device, tokens);
  }

  switch (matched.value) {
    case "ipv6": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command. Usage: ipv6 unicast-routing",
          prompt: getDevicePrompt(device),
        };
      }
      const urKw = matchKeyword(tokens[1], ["unicast-routing"]);
      if (urKw.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      const nextDevice: NetworkDevice = {
        ...device,
        ipv6UnicastRouting: true,
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "router": {
      if (tokens.length < 3) {
        return {
          nextState: state,
          output: "% Incomplete command. Usage: router ospf <process-id>",
          prompt: getDevicePrompt(device),
        };
      }
      const protoKw = matchKeyword(tokens[1], ["ospf"]);
      if (protoKw.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      if (!/^\d+$/.test(tokens[2])) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `OSPF プロセスIDは 1〜65535 の整数で指定してください: "${tokens[2]}"`,
        );
      }
      const pid = Number(tokens[2]);
      if (pid < 1 || pid > 65535) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `OSPF プロセスIDは 1〜65535 の範囲で指定してください: ${pid}`,
        );
      }
      const nextOspf = device.ospf
        ? { ...device.ospf, processId: pid }
        : { processId: pid, networks: [] };
      const nextDevice: NetworkDevice = {
        ...device,
        ospf: nextOspf,
        cliState: {
          mode: "config-router",
          selectedOspfProcessId: pid,
        },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "spanning-tree": {
      if (tokens.length < 5) {
        return {
          nextState: state,
          output:
            "% Incomplete command. Usage: spanning-tree vlan <id> priority <value>",
          prompt: getDevicePrompt(device),
        };
      }
      const vlKw = matchKeyword(tokens[1], ["vlan"]);
      if (vlKw.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      const vlanId = parseVlanId(tokens[2]);
      if (vlanId === null) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `不正なVLAN IDです: "${tokens[2]}"`,
        );
      }
      const prioKw = matchKeyword(tokens[3], ["priority"]);
      if (prioKw.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      if (!/^\d+$/.test(tokens[4])) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `STP priority は 0〜61440 の4096の倍数で指定してください: "${tokens[4]}"`,
        );
      }
      const prio = Number(tokens[4]);
      if (prio < 0 || prio > 61440 || prio % 4096 !== 0) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `STP priority (${prio}) は 0〜61440 の 4096 の倍数（0, 4096, 8192, ..., 61440）である必要があります。`,
        );
      }
      const nextDevice: NetworkDevice = {
        ...device,
        stpPriorities: {
          ...(device.stpPriorities ?? {}),
          [vlanId]: prio,
        },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }
    case "do":
      return executeDoCommand(state, device, tokens.slice(1), tokens);

    case "exit":
    case "end": {
      const nextDevice: NetworkDevice = {
        ...device,
        cliState: { mode: "privileged" },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "hostname": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const nextDevice: NetworkDevice = {
        ...device,
        hostname: tokens[1],
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "interface":
      return handleEnterInterface(state, device, tokens.slice(1), tokens);

    case "vlan":
      return handleEnterVlan(state, device, tokens.slice(1), tokens);

    case "access-list": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      if (!/^\d+$/.test(tokens[1])) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `ACL番号は 1〜199 の整数で指定してください: "${tokens[1]}"`,
        );
      }
      const aclNum = Number(tokens[1]);
      if (aclNum < 1 || aclNum > 199) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `サポートされている番号付きACL範囲は 1〜99 (標準) / 100〜199 (拡張) です: ${aclNum}`,
        );
      }
      const aclType = aclNum <= 99 ? "standard" : "extended";
      const parsedRule = buildAclRuleFromTokens(aclType, tokens, 2);
      if (!parsedRule.ok) {
        if (parsedRule.incomplete) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        return buildInvalidInputResult(state, device, tokens, parsedRule.error);
      }

      const aclName = String(aclNum);
      if (device.acls?.[aclName] && device.acls[aclName].type !== aclType) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `ACL ${aclName} は異なる種別で既に存在します。`,
        );
      }
      const nextDevice = upsertAclEntryOnDevice(
        device,
        aclName,
        aclType,
        parsedRule.rule,
      );
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "ip": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const sub = matchKeyword(tokens[1], [
        "route",
        "access-list",
        "nat",
        "dhcp",
      ]);
      if (sub.kind === "ambiguous") {
        return {
          nextState: state,
          output: `% Ambiguous command: "${tokens.join(" ")}"`,
          prompt: getDevicePrompt(device),
        };
      }
      if (sub.kind === "none") {
        return buildInvalidInputResult(state, device, tokens);
      }

      if (sub.value === "access-list") {
        if (tokens.length < 4) {
          return {
            nextState: state,
            output: "% Incomplete command. Usage: ip access-list standard|extended <name>",
            prompt: getDevicePrompt(device),
          };
        }
        const typeMatch = matchKeyword(tokens[2], ["standard", "extended"]);
        if (typeMatch.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        const aclType = typeMatch.value as "standard" | "extended";
        const aclName = tokens[3];
        const existing = device.acls?.[aclName];
        if (existing && existing.type !== aclType) {
          return buildInvalidInputResult(
            state,
            device,
            tokens,
            `ACL "${aclName}" は ${existing.type} として既に存在します。`,
          );
        }
        const nextAcl: AccessList = existing ?? {
          name: aclName,
          type: aclType,
          rules: [],
          implicitDenyHits: 0,
        };
        const nextDevice: NetworkDevice = {
          ...device,
          acls: {
            ...(device.acls ?? {}),
            [aclName]: nextAcl,
          },
          cliState: {
            mode:
              aclType === "standard" ? "config-std-nacl" : "config-ext-nacl",
            selectedAclName: aclName,
          },
        };
        return {
          nextState: updateDevice(state, nextDevice),
          output: "",
          prompt: getDevicePrompt(nextDevice),
        };
      }

      if (sub.value === "nat") {
        // ip nat inside source list <acl> interface <iface> [overload]
        if (tokens.length < 8) {
          return {
            nextState: state,
            output: "% Incomplete command. Usage: ip nat inside source list <acl> interface <iface> [overload]",
            prompt: getDevicePrompt(device),
          };
        }
        const kwIn = matchKeyword(tokens[2], ["inside"]);
        const kwSrc = matchKeyword(tokens[3], ["source"]);
        const kwList = matchKeyword(tokens[4], ["list"]);
        const kwIf = matchKeyword(tokens[6], ["interface"]);
        if (
          kwIn.kind !== "exact" ||
          kwSrc.kind !== "exact" ||
          kwList.kind !== "exact" ||
          kwIf.kind !== "exact"
        ) {
          return buildInvalidInputResult(state, device, tokens);
        }
        const aclName = tokens[5];
        const outIf = normalizeInterfaceName(tokens[7], device.interfaces);
        if (!outIf || !device.interfaces[outIf]) {
          return buildInvalidInputResult(
            state,
            device,
            tokens,
            `インターフェース "${tokens[7]}" が見つかりません。`,
          );
        }
        let overload = false;
        if (tokens[8]) {
          const ov = matchKeyword(tokens[8], ["overload"]);
          if (ov.kind !== "exact") {
            return buildInvalidInputResult(state, device, tokens);
          }
          overload = true;
        }
        const newNat: NatOverloadRule = {
          aclName,
          outsideInterface: outIf,
          overload,
        };
        const existingRules = device.natRules ?? [];
        const dup = existingRules.some(
          (r) =>
            r.aclName === newNat.aclName &&
            r.outsideInterface === newNat.outsideInterface &&
            r.overload === newNat.overload,
        );
        const nextDevice: NetworkDevice = dup
          ? device
          : {
              ...device,
              natRules: [
                ...existingRules.filter(
                  (r) => r.outsideInterface !== newNat.outsideInterface,
                ),
                newNat,
              ],
            };
        return {
          nextState: updateDevice(state, nextDevice),
          output: "",
          prompt: getDevicePrompt(nextDevice),
        };
      }

      if (sub.value === "dhcp") {
        if (tokens.length < 3) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        const dhcpSub = matchKeyword(tokens[2], ["excluded-address", "pool"]);
        if (dhcpSub.kind === "ambiguous") {
          return {
            nextState: state,
            output: `% Ambiguous command: "${tokens.join(" ")}"`,
            prompt: getDevicePrompt(device),
          };
        }
        if (dhcpSub.kind === "none") {
          return buildInvalidInputResult(state, device, tokens);
        }

        if (dhcpSub.value === "excluded-address") {
          if (tokens.length < 4) {
            return {
              nextState: state,
              output: "% Incomplete command. Usage: ip dhcp excluded-address <start> [end]",
              prompt: getDevicePrompt(device),
            };
          }
          const startIp = tokens[3];
          const endIp = tokens[4] ?? startIp;
          const pStart = parseIpv4(startIp);
          if (!pStart.ok) {
            return buildInvalidInputResult(state, device, tokens, pStart.error);
          }
          const pEnd = parseIpv4(endIp);
          if (!pEnd.ok) {
            return buildInvalidInputResult(state, device, tokens, pEnd.error);
          }
          const existing = device.dhcpExcludedRanges ?? [];
          const dup = existing.some(
            (r) => r.startIp === startIp && r.endIp === endIp,
          );
          const nextDevice: NetworkDevice = dup
            ? device
            : {
                ...device,
                dhcpExcludedRanges: [...existing, { startIp, endIp }],
              };
          return {
            nextState: updateDevice(state, nextDevice),
            output: "",
            prompt: getDevicePrompt(nextDevice),
          };
        }

        // ip dhcp pool <name>
        if (tokens.length < 4) {
          return {
            nextState: state,
            output: "% Incomplete command. Usage: ip dhcp pool <name>",
            prompt: getDevicePrompt(device),
          };
        }
        const poolName = tokens[3];
        const existingPool: DhcpPool = device.dhcpPools?.[poolName] ?? {
          name: poolName,
        };
        const nextDevice: NetworkDevice = {
          ...device,
          dhcpPools: {
            ...(device.dhcpPools ?? {}),
            [poolName]: existingPool,
          },
          cliState: {
            mode: "dhcp-config",
            selectedDhcpPool: poolName,
          },
        };
        return {
          nextState: updateDevice(state, nextDevice),
          output: "",
          prompt: getDevicePrompt(nextDevice),
        };
      }

      // ip route <dest> <mask> <next-hop>
      if (tokens.length < 5) {
        return {
          nextState: state,
          output: "% Incomplete command. Usage: ip route <dest> <mask> <next-hop>",
          prompt: getDevicePrompt(device),
        };
      }

      const [, , dest, mask, nextHop] = tokens;
      const destParsed = parseIpv4(dest);
      if (!destParsed.ok) {
        return buildInvalidInputResult(state, device, tokens, destParsed.error);
      }

      let prefixLength: number;
      try {
        prefixLength = maskToPrefix(mask);
      } catch (err) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          err instanceof Error ? err.message : "不正なサブネットマスクです。",
        );
      }

      const nhParsed = parseIpv4(nextHop);
      if (!nhParsed.ok) {
        return buildInvalidInputResult(state, device, tokens, nhParsed.error);
      }

      const subnetInfo = calculateSubnet(dest, mask);
      if (subnetInfo.networkAddress !== dest) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `%Inconsistent address and mask (ネットワークアドレスは ${subnetInfo.networkAddress} である必要があります)`,
        );
      }

      const newRoute: StaticRoute = {
        destination: subnetInfo.networkAddress,
        mask: subnetInfo.mask,
        prefixLength,
        nextHop,
        adminDistance: 1,
      };

      const exists = device.staticRoutes.some(
        (r) =>
          r.destination === newRoute.destination &&
          r.mask === newRoute.mask &&
          r.nextHop === newRoute.nextHop,
      );
      if (exists) {
        return {
          nextState: state,
          output: "",
          prompt: getDevicePrompt(device),
        };
      }

      const nextDevice: NetworkDevice = {
        ...device,
        staticRoutes: [...device.staticRoutes, newRoute],
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "no": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const target = matchKeyword(tokens[1], [
        "interface",
        "vlan",
        "ip",
        "ipv6",
        "access-list",
        "router",
        "spanning-tree",
      ]);
      if (target.kind === "ambiguous") {
        return {
          nextState: state,
          output: `% Ambiguous command: "${tokens.join(" ")}"`,
          prompt: getDevicePrompt(device),
        };
      }
      if (target.kind === "none") {
        return buildInvalidInputResult(state, device, tokens);
      }

      if (target.value === "ipv6") {
        if (tokens.length < 3) {
          return {
            nextState: state,
            output: "% Incomplete command. Usage: no ipv6 unicast-routing",
            prompt: getDevicePrompt(device),
          };
        }
        const urKw = matchKeyword(tokens[2], ["unicast-routing"]);
        if (urKw.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        const nextDevice: NetworkDevice = {
          ...device,
          ipv6UnicastRouting: false,
        };
        return {
          nextState: updateDevice(state, nextDevice),
          output: "",
          prompt: getDevicePrompt(nextDevice),
        };
      }

      if (target.value === "router") {
        if (tokens.length < 3) {
          return {
            nextState: state,
            output: "% Incomplete command. Usage: no router ospf [process-id]",
            prompt: getDevicePrompt(device),
          };
        }
        const protoKw = matchKeyword(tokens[2], ["ospf"]);
        if (protoKw.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        if (!device.ospf) {
          return {
            nextState: state,
            output: "% OSPF routing process not configured.",
            prompt: getDevicePrompt(device),
          };
        }
        const nextDevice: NetworkDevice = { ...device };
        delete nextDevice.ospf;
        return {
          nextState: updateDevice(state, nextDevice),
          output: "",
          prompt: getDevicePrompt(nextDevice),
        };
      }

      if (target.value === "spanning-tree") {
        if (tokens.length < 5) {
          return {
            nextState: state,
            output:
              "% Incomplete command. Usage: no spanning-tree vlan <id> priority",
            prompt: getDevicePrompt(device),
          };
        }
        const vlKw = matchKeyword(tokens[2], ["vlan"]);
        if (vlKw.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        const vlanId = parseVlanId(tokens[3]);
        if (vlanId === null) {
          return buildInvalidInputResult(
            state,
            device,
            tokens,
            `不正なVLAN IDです: "${tokens[3]}"`,
          );
        }
        const prioKw = matchKeyword(tokens[4], ["priority"]);
        if (prioKw.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        const nextPrios = { ...(device.stpPriorities ?? {}) };
        delete nextPrios[vlanId];
        const nextDevice: NetworkDevice = {
          ...device,
          stpPriorities: nextPrios,
        };
        return {
          nextState: updateDevice(state, nextDevice),
          output: "",
          prompt: getDevicePrompt(nextDevice),
        };
      }

      if (target.value === "access-list") {
        if (tokens.length < 3) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        const aclName = tokens[2];
        if (!device.acls?.[aclName]) {
          return {
            nextState: state,
            output: `% Access list "${aclName}" does not exist.`,
            prompt: getDevicePrompt(device),
          };
        }
        const nextAcls = { ...device.acls };
        delete nextAcls[aclName];
        const nextDevice: NetworkDevice = { ...device, acls: nextAcls };
        return {
          nextState: updateDevice(state, nextDevice),
          output: "",
          prompt: getDevicePrompt(nextDevice),
        };
      }

      if (target.value === "interface") {
        if (tokens.length < 3) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        const rawIf = tokens.slice(2).join("");
        const normalized = normalizeInterfaceName(rawIf, device.interfaces);
        if (!normalized || !device.interfaces[normalized]) {
          return buildInvalidInputResult(
            state,
            device,
            tokens,
            `インターフェース "${tokens.slice(2).join(" ")}" が見つかりません。`,
          );
        }
        const iface = device.interfaces[normalized];
        if (!iface.isSubinterface) {
          return buildInvalidInputResult(
            state,
            device,
            tokens,
            `物理インターフェース ${normalized} は削除できません。`,
          );
        }
        const restInterfaces = { ...device.interfaces };
        delete restInterfaces[normalized];
        const nextDevice: NetworkDevice = {
          ...device,
          interfaces: restInterfaces,
        };
        return {
          nextState: updateDevice(state, nextDevice),
          output: "",
          prompt: getDevicePrompt(nextDevice),
        };
      }

      if (target.value === "vlan") {
        if (tokens.length < 3) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        const vlanId = parseVlanId(tokens[2]);
        if (vlanId === null) {
          return buildInvalidInputResult(
            state,
            device,
            tokens,
            `不正なVLAN IDです: "${tokens[2]}"`,
          );
        }
        if (vlanId === 1) {
          return {
            nextState: state,
            output: "% Default VLAN 1 may not be deleted.",
            prompt: getDevicePrompt(device),
          };
        }
        if (!device.vlans[vlanId]) {
          return {
            nextState: state,
            output: `% VLAN ${vlanId} does not exist.`,
            prompt: getDevicePrompt(device),
          };
        }
        const nextVlans = { ...device.vlans };
        delete nextVlans[vlanId];
        const nextDevice: NetworkDevice = {
          ...device,
          vlans: nextVlans,
        };
        return {
          nextState: updateDevice(state, nextDevice),
          output: "",
          prompt: getDevicePrompt(nextDevice),
        };
      }

      // no ip <route|access-list|nat|dhcp> ...
      if (tokens.length < 3) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const sub = matchKeyword(tokens[2], [
        "route",
        "access-list",
        "nat",
        "dhcp",
      ]);
      if (sub.kind === "ambiguous") {
        return {
          nextState: state,
          output: `% Ambiguous command: "${tokens.join(" ")}"`,
          prompt: getDevicePrompt(device),
        };
      }
      if (sub.kind === "none") {
        return buildInvalidInputResult(state, device, tokens);
      }

      if (sub.value === "access-list") {
        if (tokens.length < 4) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        const aclName =
          tokens[3].toLowerCase() === "standard" ||
          tokens[3].toLowerCase() === "extended"
            ? tokens[4]
            : tokens[3];
        if (!aclName) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        if (!device.acls?.[aclName]) {
          return {
            nextState: state,
            output: `% Access list "${aclName}" does not exist.`,
            prompt: getDevicePrompt(device),
          };
        }
        const nextAcls = { ...device.acls };
        delete nextAcls[aclName];
        const nextDevice: NetworkDevice = { ...device, acls: nextAcls };
        return {
          nextState: updateDevice(state, nextDevice),
          output: "",
          prompt: getDevicePrompt(nextDevice),
        };
      }

      if (sub.value === "nat") {
        // no ip nat inside source list <acl> interface <if> [overload]
        if (tokens.length < 9) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        const aclName = tokens[6];
        const outIf = normalizeInterfaceName(tokens[8], device.interfaces);
        const existing = device.natRules ?? [];
        const filteredNat = existing.filter(
          (r) => !(r.aclName === aclName && (!outIf || r.outsideInterface === outIf)),
        );
        const nextDevice: NetworkDevice = {
          ...device,
          natRules: filteredNat,
          natTranslations: [],
        };
        return {
          nextState: updateDevice(state, nextDevice),
          output: "",
          prompt: getDevicePrompt(nextDevice),
        };
      }

      if (sub.value === "dhcp") {
        if (tokens.length < 4) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        const dhcpSub = matchKeyword(tokens[3], ["excluded-address", "pool"]);
        if (dhcpSub.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        if (dhcpSub.value === "excluded-address") {
          if (tokens.length < 5) {
            return {
              nextState: state,
              output: "% Incomplete command.",
              prompt: getDevicePrompt(device),
            };
          }
          const startIp = tokens[4];
          const endIp = tokens[5];
          const filteredExcl = (device.dhcpExcludedRanges ?? []).filter((r) =>
            endIp !== undefined
              ? !(r.startIp === startIp && r.endIp === endIp)
              : r.startIp !== startIp,
          );
          const nextDevice: NetworkDevice = {
            ...device,
            dhcpExcludedRanges: filteredExcl,
          };
          return {
            nextState: updateDevice(state, nextDevice),
            output: "",
            prompt: getDevicePrompt(nextDevice),
          };
        }

        if (tokens.length < 5) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        const poolName = tokens[4];
        const nextPools = { ...(device.dhcpPools ?? {}) };
        delete nextPools[poolName];
        const nextDevice: NetworkDevice = {
          ...device,
          dhcpPools: nextPools,
        };
        return {
          nextState: updateDevice(state, nextDevice),
          output: "",
          prompt: getDevicePrompt(nextDevice),
        };
      }

      if (tokens.length < 5) {
        return {
          nextState: state,
          output: "% Incomplete command. Usage: no ip route <dest> <mask> [next-hop]",
          prompt: getDevicePrompt(device),
        };
      }

      const dest = tokens[3];
      const mask = tokens[4];
      const nextHop = tokens[5];

      if (!isValidIpv4(dest)) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `不正な宛先IPです: "${dest}"`,
        );
      }
      try {
        maskToPrefix(mask);
      } catch (err) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          err instanceof Error ? err.message : "不正なサブネットマスクです。",
        );
      }
      if (nextHop !== undefined && !isValidIpv4(nextHop)) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `不正なネクストホップIPです: "${nextHop}"`,
        );
      }

      const beforeLen = device.staticRoutes.length;
      const filtered = device.staticRoutes.filter((r) => {
        const sameDestMask = r.destination === dest && r.mask === mask;
        if (!sameDestMask) {
          return true;
        }
        if (nextHop !== undefined) {
          return r.nextHop !== nextHop;
        }
        return false;
      });

      if (filtered.length === beforeLen) {
        return {
          nextState: state,
          output: "% No matching static route found.",
          prompt: getDevicePrompt(device),
        };
      }

      const nextDevice: NetworkDevice = {
        ...device,
        staticRoutes: filtered,
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    default:
      return buildInvalidInputResult(state, device, tokens);
  }
}

function executeInterfaceOrSubifMode(
  state: NetworkState,
  device: NetworkDevice,
  tokens: string[],
): CommandResult {
  const isSubif = device.cliState.mode === "config-subif";
  const selectedName = device.cliState.selectedInterface;
  const iface = selectedName ? device.interfaces[selectedName] : undefined;

  const candidates = isSubif
    ? [
        "encapsulation",
        "ip",
        "ipv6",
        "shutdown",
        "standby",
        "no",
        "interface",
        "do",
        "exit",
        "end",
      ]
    : [
        "ip",
        "ipv6",
        "shutdown",
        "switchport",
        "channel-group",
        "standby",
        "no",
        "interface",
        "do",
        "exit",
        "end",
      ];

  const matched = matchKeyword(tokens[0], candidates);
  if (matched.kind === "ambiguous") {
    return {
      nextState: state,
      output: `% Ambiguous command: "${tokens.join(" ")}" (${matched.matches.join(", ")})`,
      prompt: getDevicePrompt(device),
    };
  }
  if (matched.kind === "none") {
    return buildInvalidInputResult(state, device, tokens);
  }

  if (matched.value === "do") {
    return executeDoCommand(state, device, tokens.slice(1), tokens);
  }
  if (matched.value === "interface") {
    return handleEnterInterface(state, device, tokens.slice(1), tokens);
  }
  if (matched.value === "exit") {
    const nextDevice: NetworkDevice = {
      ...device,
      cliState: { mode: "config" },
    };
    return {
      nextState: updateDevice(state, nextDevice),
      output: "",
      prompt: getDevicePrompt(nextDevice),
    };
  }
  if (matched.value === "end") {
    const nextDevice: NetworkDevice = {
      ...device,
      cliState: { mode: "privileged" },
    };
    return {
      nextState: updateDevice(state, nextDevice),
      output: "",
      prompt: getDevicePrompt(nextDevice),
    };
  }

  if (!iface || !selectedName) {
    return buildInvalidInputResult(
      state,
      device,
      tokens,
      "選択されたインターフェースが見つかりません。",
    );
  }

  const updateCurrentInterface = (
    updater: (prev: NetworkInterface) => NetworkInterface,
  ): CommandResult => {
    const updatedIface = updater(iface);
    const nextDevice: NetworkDevice = {
      ...device,
      interfaces: {
        ...device.interfaces,
        [selectedName]: updatedIface,
      },
    };
    const synced = syncHsrpRoles(updateDevice(state, nextDevice));
    return {
      nextState: synced,
      output: "",
      prompt: getDevicePrompt(synced.devices[device.id] ?? nextDevice),
    };
  };

  switch (matched.value) {
    case "shutdown":
      return updateCurrentInterface((prev) => ({
        ...prev,
        adminUp: false,
        ...(prev.portSecurity
          ? { portSecurity: { ...prev.portSecurity, errDisabled: false } }
          : {}),
      }));

    case "ipv6": {
      if (tokens.length < 3) {
        return {
          nextState: state,
          output: "% Incomplete command. Usage: ipv6 address <addr/prefix>",
          prompt: getDevicePrompt(device),
        };
      }
      const addrKw = matchKeyword(tokens[1], ["address"]);
      if (addrKw.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      const parsed = parseIpv6(tokens[2]);
      if (!parsed.ok || parsed.prefixLength === undefined) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          parsed.ok
            ? `プレフィックス長 (例: ${tokens[2]}/64) を含めて指定してください。`
            : parsed.error,
        );
      }
      const canonical = `${compressIpv6(tokens[2].split("/")[0])}/${parsed.prefixLength}`;
      return updateCurrentInterface((prev) => ({
        ...prev,
        ipv6Address: canonical,
      }));
    }

    case "channel-group": {
      if (tokens.length < 4) {
        return {
          nextState: state,
          output:
            "% Incomplete command. Usage: channel-group <1-6> mode <active|passive|on>",
          prompt: getDevicePrompt(device),
        };
      }
      if (!/^\d+$/.test(tokens[1])) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `channel-group 番号は 1〜6 の整数で指定してください: "${tokens[1]}"`,
        );
      }
      const grp = Number(tokens[1]);
      if (grp < 1 || grp > 6) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `channel-group 番号は 1〜6 の範囲で指定してください: ${grp}`,
        );
      }
      const modeKw = matchKeyword(tokens[2], ["mode"]);
      if (modeKw.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      const modeVal = matchKeyword(tokens[3], ["active", "passive", "on"]);
      if (modeVal.kind !== "exact") {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `EtherChannel モードは active / passive / on のいずれかを指定してください: "${tokens[3]}"`,
        );
      }
      return updateCurrentInterface((prev) => ({
        ...prev,
        channelGroup: grp,
        channelMode: modeVal.value as "active" | "passive" | "on",
      }));
    }

    case "standby": {
      if (tokens.length < 3) {
        return {
          nextState: state,
          output:
            "% Incomplete command. Usage: standby <group> {ip <vip>|priority <0-255>|preempt}",
          prompt: getDevicePrompt(device),
        };
      }
      if (!/^\d+$/.test(tokens[1])) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `HSRPグループ番号は 0〜255 の整数で指定してください: "${tokens[1]}"`,
        );
      }
      const group = Number(tokens[1]);
      if (group < 0 || group > 255) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `HSRPグループ番号は 0〜255 の範囲で指定してください: ${group}`,
        );
      }
      const stSub = matchKeyword(tokens[2], ["ip", "priority", "preempt"]);
      if (stSub.kind === "ambiguous") {
        return {
          nextState: state,
          output: `% Ambiguous command: "${tokens.join(" ")}"`,
          prompt: getDevicePrompt(device),
        };
      }
      if (stSub.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }

      if (stSub.value === "preempt") {
        return updateCurrentInterface((prev) => {
          const cur: HsrpGroupConfig = prev.hsrpGroups?.[group] ?? {
            group,
            priority: 100,
            preempt: false,
          };
          return {
            ...prev,
            hsrpGroups: {
              ...(prev.hsrpGroups ?? {}),
              [group]: { ...cur, preempt: true },
            },
          };
        });
      }

      if (tokens.length < 4) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }

      if (stSub.value === "ip") {
        const vipParsed = parseIpv4(tokens[3]);
        if (!vipParsed.ok) {
          return buildInvalidInputResult(state, device, tokens, vipParsed.error);
        }
        return updateCurrentInterface((prev) => {
          const cur: HsrpGroupConfig = prev.hsrpGroups?.[group] ?? {
            group,
            priority: 100,
            preempt: false,
          };
          return {
            ...prev,
            hsrpGroups: {
              ...(prev.hsrpGroups ?? {}),
              [group]: { ...cur, virtualIp: tokens[3] },
            },
          };
        });
      }

      // standby <group> priority <0-255>
      if (!/^\d+$/.test(tokens[3])) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `HSRP priority は 0〜255 の整数で指定してください: "${tokens[3]}"`,
        );
      }
      const prio = Number(tokens[3]);
      if (prio < 0 || prio > 255) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `HSRP priority は 0〜255 の範囲で指定してください: ${prio}`,
        );
      }
      return updateCurrentInterface((prev) => {
        const cur: HsrpGroupConfig = prev.hsrpGroups?.[group] ?? {
          group,
          priority: 100,
          preempt: false,
        };
        return {
          ...prev,
          hsrpGroups: {
            ...(prev.hsrpGroups ?? {}),
            [group]: { ...cur, priority: prio },
          },
        };
      });
    }

    case "encapsulation": {
      if (tokens.length < 3) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const encType = matchKeyword(tokens[1], ["dot1q"]);
      if (encType.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      const vlanId = parseVlanId(tokens[2]);
      if (vlanId === null) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `VLAN ID は 1〜4094 の整数で指定してください: "${tokens[2]}"`,
        );
      }
      return updateCurrentInterface((prev) => ({
        ...prev,
        dot1qVlan: vlanId,
      }));
    }

    case "ip": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const sub = matchKeyword(tokens[1], [
        "address",
        "access-group",
        "nat",
        "ospf",
      ]);
      if (sub.kind === "ambiguous") {
        return {
          nextState: state,
          output: `% Ambiguous command: "${tokens.join(" ")}"`,
          prompt: getDevicePrompt(device),
        };
      }
      if (sub.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      if (sub.value === "ospf") {
        if (tokens.length < 4) {
          return {
            nextState: state,
            output: "% Incomplete command. Usage: ip ospf cost <1-65535>",
            prompt: getDevicePrompt(device),
          };
        }
        const costKw = matchKeyword(tokens[2], ["cost"]);
        if (costKw.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        if (!/^\d+$/.test(tokens[3])) {
          return buildInvalidInputResult(
            state,
            device,
            tokens,
            `OSPF cost は 1〜65535 の整数で指定してください: "${tokens[3]}"`,
          );
        }
        const cost = Number(tokens[3]);
        if (cost < 1 || cost > 65535) {
          return buildInvalidInputResult(
            state,
            device,
            tokens,
            `OSPF cost は 1〜65535 の範囲で指定してください: ${cost}`,
          );
        }
        return updateCurrentInterface((prev) => ({
          ...prev,
          ospfCost: cost,
        }));
      }
      if (sub.value === "access-group") {
        if (tokens.length < 4) {
          return {
            nextState: state,
            output: "% Incomplete command. Usage: ip access-group <id|name> {in|out}",
            prompt: getDevicePrompt(device),
          };
        }
        const aclId = tokens[2];
        const dirMatch = matchKeyword(tokens[3], ["in", "out"]);
        if (dirMatch.kind === "ambiguous") {
          return {
            nextState: state,
            output: `% Ambiguous command: "${tokens.join(" ")}"`,
            prompt: getDevicePrompt(device),
          };
        }
        if (dirMatch.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        return updateCurrentInterface((prev) => ({
          ...prev,
          ...(dirMatch.value === "in"
            ? { inboundAcl: aclId }
            : { outboundAcl: aclId }),
        }));
      }
      if (sub.value === "nat") {
        if (tokens.length < 3) {
          return {
            nextState: state,
            output: "% Incomplete command. Usage: ip nat {inside|outside}",
            prompt: getDevicePrompt(device),
          };
        }
        const natMatch = matchKeyword(tokens[2], ["inside", "outside"]);
        if (natMatch.kind === "ambiguous") {
          return {
            nextState: state,
            output: `% Ambiguous command: "${tokens.join(" ")}"`,
            prompt: getDevicePrompt(device),
          };
        }
        if (natMatch.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        return updateCurrentInterface((prev) => ({
          ...prev,
          natRole: natMatch.value as "inside" | "outside",
        }));
      }
      if (tokens.length < 4) {
        return {
          nextState: state,
          output: "% Incomplete command. Usage: ip address <ip> <mask>",
          prompt: getDevicePrompt(device),
        };
      }
      const ipStr = tokens[2];
      const maskStr = tokens[3];
      const parsedIp = parseIpv4(ipStr);
      if (!parsedIp.ok) {
        return buildInvalidInputResult(state, device, tokens, parsedIp.error);
      }
      try {
        maskToPrefix(maskStr);
      } catch (err) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          err instanceof Error ? err.message : "不正なサブネットマスクです。",
        );
      }
      if (!isValidHostIp(ipStr, maskStr)) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `${ipStr}/${maskToPrefix(maskStr)} はネットワーク/ブロードキャストアドレスのためインターフェースに設定できません。`,
        );
      }
      return updateCurrentInterface((prev) => ({
        ...prev,
        ip: ipStr,
        subnetMask: maskStr,
      }));
    }

    case "switchport": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const spSub = matchKeyword(tokens[1], [
        "mode",
        "access",
        "trunk",
        "port-security",
      ]);
      if (spSub.kind === "ambiguous") {
        return {
          nextState: state,
          output: `% Ambiguous command: "${tokens.join(" ")}"`,
          prompt: getDevicePrompt(device),
        };
      }
      if (spSub.kind === "none") {
        return buildInvalidInputResult(state, device, tokens);
      }

      if (spSub.value === "port-security") {
        if (tokens.length === 2) {
          return updateCurrentInterface((prev) => ({
            ...prev,
            portSecurity: {
              enabled: true,
              maxMac: prev.portSecurity?.maxMac ?? 1,
              violation: prev.portSecurity?.violation ?? "shutdown",
              errDisabled: prev.portSecurity?.errDisabled ?? false,
              learnedMacs: prev.portSecurity?.learnedMacs ?? [],
            },
          }));
        }
        const psOpt = matchKeyword(tokens[2], ["maximum", "violation"]);
        if (psOpt.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        if (tokens.length < 4) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        if (psOpt.value === "maximum") {
          if (!/^\d+$/.test(tokens[3])) {
            return buildInvalidInputResult(
              state,
              device,
              tokens,
              `最大MAC数は 1〜10 の整数で指定してください: "${tokens[3]}"`,
            );
          }
          const maxMac = Number(tokens[3]);
          if (maxMac < 1 || maxMac > 10) {
            return buildInvalidInputResult(
              state,
              device,
              tokens,
              `最大MAC数は 1〜10 の範囲で指定してください: ${maxMac}`,
            );
          }
          return updateCurrentInterface((prev) => ({
            ...prev,
            portSecurity: {
              enabled: prev.portSecurity?.enabled ?? true,
              maxMac,
              violation: prev.portSecurity?.violation ?? "shutdown",
              errDisabled: prev.portSecurity?.errDisabled ?? false,
              learnedMacs: prev.portSecurity?.learnedMacs ?? [],
            },
          }));
        }
        const viol = matchKeyword(tokens[3], ["shutdown", "restrict", "protect"]);
        if (viol.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        return updateCurrentInterface((prev) => ({
          ...prev,
          portSecurity: {
            enabled: prev.portSecurity?.enabled ?? true,
            maxMac: prev.portSecurity?.maxMac ?? 1,
            violation: viol.value as "shutdown" | "restrict" | "protect",
            errDisabled: prev.portSecurity?.errDisabled ?? false,
            learnedMacs: prev.portSecurity?.learnedMacs ?? [],
          },
        }));
      }

      if (spSub.value === "mode") {
        if (tokens.length < 3) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        const modeArg = matchKeyword(tokens[2], ["access", "trunk"]);
        if (modeArg.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        return updateCurrentInterface((prev) => ({
          ...prev,
          switchportMode: modeArg.value as "access" | "trunk",
        }));
      }

      if (spSub.value === "access") {
        if (tokens.length < 4) {
          return {
            nextState: state,
            output: "% Incomplete command. Usage: switchport access vlan <id>",
            prompt: getDevicePrompt(device),
          };
        }
        const vlanKw = matchKeyword(tokens[2], ["vlan"]);
        if (vlanKw.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        const vlanId = parseVlanId(tokens[3]);
        if (vlanId === null) {
          return buildInvalidInputResult(
            state,
            device,
            tokens,
            `VLAN ID は 1〜4094 の整数で指定してください: "${tokens[3]}"`,
          );
        }

        // 指定VLANが未登録なら自動生成する（IOS実機準拠）
        const nextVlans = device.vlans[vlanId]
          ? device.vlans
          : {
              ...device.vlans,
              [vlanId]: {
                id: vlanId,
                name: `VLAN${String(vlanId).padStart(4, "0")}`,
                active: true,
              },
            };
        const nextDevice: NetworkDevice = {
          ...device,
          vlans: nextVlans,
          interfaces: {
            ...device.interfaces,
            [selectedName]: {
              ...iface,
              switchportMode: iface.switchportMode ?? "access",
              accessVlan: vlanId,
            },
          },
        };
        return {
          nextState: updateDevice(state, nextDevice),
          output: device.vlans[vlanId]
            ? ""
            : `% Access VLAN does not exist. Creating vlan ${vlanId}`,
          prompt: getDevicePrompt(nextDevice),
        };
      }

      // switchport trunk allowed vlan ...
      if (tokens.length < 5) {
        return {
          nextState: state,
          output: "% Incomplete command. Usage: switchport trunk allowed vlan <list|all|add <list>|remove <list>>",
          prompt: getDevicePrompt(device),
        };
      }
      const allowedKw = matchKeyword(tokens[2], ["allowed"]);
      const vlanKw = matchKeyword(tokens[3], ["vlan"]);
      if (allowedKw.kind !== "exact" || vlanKw.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }

      const specToken = tokens[4].toLowerCase();
      if (specToken === "all") {
        return updateCurrentInterface((prev) => {
          const next = { ...prev };
          delete next.trunkAllowedVlans;
          return next;
        });
      }
      if (specToken === "none") {
        return updateCurrentInterface((prev) => ({
          ...prev,
          trunkAllowedVlans: [],
        }));
      }
      if (specToken === "add" || specToken === "remove") {
        if (tokens.length < 6) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        const delta = parseVlanList(tokens[5]);
        if (!delta) {
          return buildInvalidInputResult(
            state,
            device,
            tokens,
            `不正なVLANリストです: "${tokens[5]}"`,
          );
        }
        return updateCurrentInterface((prev) => {
          const base =
            prev.trunkAllowedVlans ??
            Object.keys(device.vlans)
              .map(Number)
              .sort((a, b) => a - b);
          const nextSet = new Set(base);
          if (specToken === "add") {
            if (prev.trunkAllowedVlans === undefined) {
              return prev;
            }
            for (const id of delta) {
              nextSet.add(id);
            }
          } else {
            for (const id of delta) {
              nextSet.delete(id);
            }
          }
          return {
            ...prev,
            trunkAllowedVlans: Array.from(nextSet).sort((a, b) => a - b),
          };
        });
      }

      const parsedList = parseVlanList(tokens[4]);
      if (!parsedList) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `不正なVLANリストです: "${tokens[4]}"`,
        );
      }
      return updateCurrentInterface((prev) => ({
        ...prev,
        trunkAllowedVlans: parsedList,
      }));
    }

    case "no": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const noCandidates = isSubif
        ? ["encapsulation", "ip", "ipv6", "shutdown", "standby"]
        : ["ip", "ipv6", "shutdown", "switchport", "channel-group", "standby"];
      const noTarget = matchKeyword(tokens[1], noCandidates);
      if (noTarget.kind === "ambiguous") {
        return {
          nextState: state,
          output: `% Ambiguous command: "${tokens.join(" ")}"`,
          prompt: getDevicePrompt(device),
        };
      }
      if (noTarget.kind === "none") {
        return buildInvalidInputResult(state, device, tokens);
      }

      if (noTarget.value === "shutdown") {
        return updateCurrentInterface((prev) => ({ ...prev, adminUp: true }));
      }

      if (noTarget.value === "ipv6") {
        return updateCurrentInterface((prev) => {
          const next = { ...prev };
          delete next.ipv6Address;
          return next;
        });
      }

      if (noTarget.value === "channel-group") {
        return updateCurrentInterface((prev) => {
          const next = { ...prev };
          delete next.channelGroup;
          delete next.channelMode;
          return next;
        });
      }

      if (noTarget.value === "standby") {
        if (tokens.length < 3) {
          return {
            nextState: state,
            output:
              "% Incomplete command. Usage: no standby <group> [ip|priority|preempt]",
            prompt: getDevicePrompt(device),
          };
        }
        if (!/^\d+$/.test(tokens[2])) {
          return buildInvalidInputResult(
            state,
            device,
            tokens,
            `不正な HSRP グループ番号です: "${tokens[2]}"`,
          );
        }
        const group = Number(tokens[2]);
        if (tokens.length === 3) {
          return updateCurrentInterface((prev) => {
            const nextGroups = { ...(prev.hsrpGroups ?? {}) };
            delete nextGroups[group];
            return { ...prev, hsrpGroups: nextGroups };
          });
        }
        const stSub = matchKeyword(tokens[3], ["ip", "priority", "preempt"]);
        if (stSub.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        return updateCurrentInterface((prev) => {
          const cur = prev.hsrpGroups?.[group];
          if (!cur) {
            return prev;
          }
          const nextCur = { ...cur };
          if (stSub.value === "ip") {
            delete nextCur.virtualIp;
          } else if (stSub.value === "priority") {
            nextCur.priority = 100;
          } else if (stSub.value === "preempt") {
            nextCur.preempt = false;
          }
          return {
            ...prev,
            hsrpGroups: {
              ...(prev.hsrpGroups ?? {}),
              [group]: nextCur,
            },
          };
        });
      }

      if (noTarget.value === "ip") {
        if (tokens.length < 3) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        const addr = matchKeyword(tokens[2], [
          "address",
          "access-group",
          "nat",
          "ospf",
        ]);
        if (addr.kind === "ambiguous") {
          return {
            nextState: state,
            output: `% Ambiguous command: "${tokens.join(" ")}"`,
            prompt: getDevicePrompt(device),
          };
        }
        if (addr.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        if (addr.value === "ospf") {
          if (tokens.length < 4) {
            return {
              nextState: state,
              output: "% Incomplete command. Usage: no ip ospf cost",
              prompt: getDevicePrompt(device),
            };
          }
          const costKw = matchKeyword(tokens[3], ["cost"]);
          if (costKw.kind !== "exact") {
            return buildInvalidInputResult(state, device, tokens);
          }
          return updateCurrentInterface((prev) => {
            const next = { ...prev };
            delete next.ospfCost;
            return next;
          });
        }
        if (addr.value === "access-group") {
          // Support both: "no ip access-group <id|name> {in|out}" and "no ip access-group {in|out}"
          let dirToken: string | undefined;
          let targetAcl: string | undefined;
          if (tokens.length >= 5) {
            targetAcl = tokens[3];
            dirToken = tokens[4];
          } else if (tokens.length === 4) {
            dirToken = tokens[3];
          } else {
            return {
              nextState: state,
              output: "% Incomplete command. Usage: no ip access-group [<id|name>] {in|out}",
              prompt: getDevicePrompt(device),
            };
          }
          const dirMatch = matchKeyword(dirToken, ["in", "out"]);
          if (dirMatch.kind !== "exact") {
            return buildInvalidInputResult(state, device, tokens);
          }
          return updateCurrentInterface((prev) => {
            const next = { ...prev };
            if (dirMatch.value === "in") {
              if (!targetAcl || next.inboundAcl === targetAcl) {
                delete next.inboundAcl;
              }
            } else {
              if (!targetAcl || next.outboundAcl === targetAcl) {
                delete next.outboundAcl;
              }
            }
            return next;
          });
        }
        if (addr.value === "nat") {
          if (tokens.length >= 4) {
            const natMatch = matchKeyword(tokens[3], ["inside", "outside"]);
            if (natMatch.kind !== "exact") {
              return buildInvalidInputResult(state, device, tokens);
            }
          }
          return updateCurrentInterface((prev) => {
            const next = { ...prev };
            if (
              tokens.length < 4 ||
              next.natRole === tokens[3].toLowerCase()
            ) {
              delete next.natRole;
            }
            return next;
          });
        }
        return updateCurrentInterface((prev) => {
          const next = { ...prev };
          delete next.ip;
          delete next.subnetMask;
          return next;
        });
      }

      if (noTarget.value === "encapsulation") {
        if (tokens.length < 3) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        const dot = matchKeyword(tokens[2], ["dot1q"]);
        if (dot.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        return updateCurrentInterface((prev) => {
          const next = { ...prev };
          delete next.dot1qVlan;
          return next;
        });
      }

      // no switchport ...
      if (tokens.length < 3) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const spSub = matchKeyword(tokens[2], ["access", "trunk"]);
      if (spSub.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      if (spSub.value === "access") {
        if (tokens.length < 4) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        const vlanKw = matchKeyword(tokens[3], ["vlan"]);
        if (vlanKw.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
        }
        return updateCurrentInterface((prev) => ({
          ...prev,
          switchportMode: prev.switchportMode ?? "access",
          accessVlan: 1,
        }));
      }

      if (tokens.length < 5) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const allowedKw = matchKeyword(tokens[3], ["allowed"]);
      const vlanKw = matchKeyword(tokens[4], ["vlan"]);
      if (allowedKw.kind !== "exact" || vlanKw.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      return updateCurrentInterface((prev) => {
        const next = { ...prev };
        delete next.trunkAllowedVlans;
        return next;
      });
    }

    default:
      return buildInvalidInputResult(state, device, tokens);
  }
}

function executeVlanConfigMode(
  state: NetworkState,
  device: NetworkDevice,
  tokens: string[],
): CommandResult {
  const matched = matchKeyword(tokens[0], [
    "name",
    "vlan",
    "do",
    "exit",
    "end",
  ]);
  if (matched.kind === "ambiguous") {
    return {
      nextState: state,
      output: `% Ambiguous command: "${tokens.join(" ")}"`,
      prompt: getDevicePrompt(device),
    };
  }
  if (matched.kind === "none") {
    return buildInvalidInputResult(state, device, tokens);
  }

  switch (matched.value) {
    case "do":
      return executeDoCommand(state, device, tokens.slice(1), tokens);

    case "vlan":
      return handleEnterVlan(state, device, tokens.slice(1), tokens);

    case "exit": {
      const nextDevice: NetworkDevice = {
        ...device,
        cliState: { mode: "config" },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "end": {
      const nextDevice: NetworkDevice = {
        ...device,
        cliState: { mode: "privileged" },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "name": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const vlanId = device.cliState.selectedVlanId;
      if (vlanId === undefined || !device.vlans[vlanId]) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          "VLANが選択されていません。",
        );
      }
      const nextDevice: NetworkDevice = {
        ...device,
        vlans: {
          ...device.vlans,
          [vlanId]: {
            ...device.vlans[vlanId],
            name: tokens[1],
          },
        },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    default:
      return buildInvalidInputResult(state, device, tokens);
  }
}

function executeNamedAclMode(
  state: NetworkState,
  device: NetworkDevice,
  tokens: string[],
): CommandResult {
  const aclName = device.cliState.selectedAclName;
  const aclType: "standard" | "extended" =
    device.cliState.mode === "config-std-nacl" ? "standard" : "extended";

  if (!aclName) {
    const fallback: NetworkDevice = {
      ...device,
      cliState: { mode: "config" },
    };
    return {
      nextState: updateDevice(state, fallback),
      output: "% ACLコンテキストが見つからないためグローバル設定モードへ戻りました。",
      prompt: getDevicePrompt(fallback),
    };
  }

  const firstLower = tokens[0].toLowerCase();

  if ("exit".startsWith(firstLower)) {
    const nextDevice: NetworkDevice = {
      ...device,
      cliState: { mode: "config" },
    };
    return {
      nextState: updateDevice(state, nextDevice),
      output: "",
      prompt: getDevicePrompt(nextDevice),
    };
  }

  if ("end".startsWith(firstLower)) {
    const nextDevice: NetworkDevice = {
      ...device,
      cliState: { mode: "privileged" },
    };
    return {
      nextState: updateDevice(state, nextDevice),
      output: "",
      prompt: getDevicePrompt(nextDevice),
    };
  }

  if ("do".startsWith(firstLower)) {
    if (tokens.length < 2) {
      return {
        nextState: state,
        output: "% Incomplete command.",
        prompt: getDevicePrompt(device),
      };
    }
    const doRes = executeIosPrivilegedOrUserCommand(
      state,
      device,
      tokens.slice(1),
      true,
    );
    const updatedDev = doRes.nextState.devices[device.id];
    const preserved = updatedDev
      ? updateDevice(doRes.nextState, {
          ...updatedDev,
          cliState: device.cliState,
        })
      : doRes.nextState;
    return {
      ...doRes,
      nextState: preserved,
      prompt: getDevicePrompt(device),
    };
  }

  if ("no".startsWith(firstLower)) {
    if (tokens.length < 2) {
      return {
        nextState: state,
        output: "% Incomplete command.",
        prompt: getDevicePrompt(device),
      };
    }
    const existingAcl = device.acls?.[aclName];
    if (/^\d+$/.test(tokens[1])) {
      const targetSeq = Number(tokens[1]);
      if (!existingAcl) {
        return {
          nextState: state,
          output: "",
          prompt: getDevicePrompt(device),
        };
      }
      const nextDevice: NetworkDevice = {
        ...device,
        acls: {
          ...(device.acls ?? {}),
          [aclName]: {
            ...existingAcl,
            rules: existingAcl.rules.filter((r) => r.sequence !== targetSeq),
          },
        },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    const parsed = buildAclRuleFromTokens(aclType, tokens, 1);
    if (!parsed.ok) {
      if (parsed.incomplete) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      return buildInvalidInputResult(state, device, tokens, parsed.error);
    }
    if (!existingAcl) {
      return {
        nextState: state,
        output: "",
        prompt: getDevicePrompt(device),
      };
    }
    const r = parsed.rule;
    const nextDevice: NetworkDevice = {
      ...device,
      acls: {
        ...(device.acls ?? {}),
        [aclName]: {
          ...existingAcl,
          rules: existingAcl.rules.filter(
            (item) =>
              !(
                item.action === r.action &&
                item.protocol === r.protocol &&
                item.srcIp === r.srcIp &&
                item.srcWildcard === r.srcWildcard &&
                item.dstIp === r.dstIp &&
                item.dstWildcard === r.dstWildcard &&
                item.dstPort === r.dstPort
              ),
          ),
        },
      },
    };
    return {
      nextState: updateDevice(state, nextDevice),
      output: "",
      prompt: getDevicePrompt(nextDevice),
    };
  }

  const hasExplicitSeq = /^\d+$/.test(tokens[0]);
  const explicitSeq = hasExplicitSeq ? Number(tokens[0]) : undefined;
  const startIdx = hasExplicitSeq ? 1 : 0;

  if (explicitSeq !== undefined && explicitSeq <= 0) {
    return buildInvalidInputResult(
      state,
      device,
      tokens,
      "ACLシーケンス番号は 1 以上を指定してください。",
    );
  }

  const parsed = buildAclRuleFromTokens(aclType, tokens, startIdx, explicitSeq);
  if (!parsed.ok) {
    if (parsed.incomplete) {
      return {
        nextState: state,
        output: "% Incomplete command.",
        prompt: getDevicePrompt(device),
      };
    }
    return buildInvalidInputResult(state, device, tokens, parsed.error);
  }

  const nextDevice = upsertAclEntryOnDevice(
    device,
    aclName,
    aclType,
    parsed.rule,
    parsed.explicitSeq,
  );
  return {
    nextState: updateDevice(state, nextDevice),
    output: "",
    prompt: getDevicePrompt(nextDevice),
  };
}

function executeDhcpConfigMode(
  state: NetworkState,
  device: NetworkDevice,
  tokens: string[],
): CommandResult {
  const poolName = device.cliState.selectedDhcpPool;
  if (!poolName) {
    const fallback: NetworkDevice = {
      ...device,
      cliState: { mode: "config" },
    };
    return {
      nextState: updateDevice(state, fallback),
      output: "% DHCPプールコンテキストが見つからないためグローバル設定モードへ戻りました。",
      prompt: getDevicePrompt(fallback),
    };
  }

  const matched = matchKeyword(tokens[0], [
    "network",
    "default-router",
    "dns-server",
    "no",
    "do",
    "exit",
    "end",
  ]);
  if (matched.kind === "ambiguous") {
    return {
      nextState: state,
      output: `% Ambiguous command: "${tokens.join(" ")}" (${matched.matches.join(", ")})`,
      prompt: getDevicePrompt(device),
    };
  }
  if (matched.kind === "none") {
    return buildInvalidInputResult(state, device, tokens);
  }

  const currentPool: DhcpPool = device.dhcpPools?.[poolName] ?? {
    name: poolName,
  };

  switch (matched.value) {
    case "exit": {
      const nextDevice: NetworkDevice = {
        ...device,
        cliState: { mode: "config" },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "end": {
      const nextDevice: NetworkDevice = {
        ...device,
        cliState: { mode: "privileged" },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "do": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const doRes = executeIosPrivilegedOrUserCommand(
        state,
        device,
        tokens.slice(1),
        true,
      );
      const updatedDev = doRes.nextState.devices[device.id];
      const preserved = updatedDev
        ? updateDevice(doRes.nextState, {
            ...updatedDev,
            cliState: device.cliState,
          })
        : doRes.nextState;
      return {
        ...doRes,
        nextState: preserved,
        prompt: getDevicePrompt(device),
      };
    }

    case "network": {
      if (tokens.length < 3) {
        return {
          nextState: state,
          output: "% Incomplete command. Usage: network <ip> <mask>",
          prompt: getDevicePrompt(device),
        };
      }
      const ipParsed = parseIpv4(tokens[1]);
      if (!ipParsed.ok) {
        return buildInvalidInputResult(state, device, tokens, ipParsed.error);
      }
      let subnetInfo;
      try {
        subnetInfo = calculateSubnet(tokens[1], tokens[2]);
      } catch (err) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          err instanceof Error ? err.message : "不正なサブネットマスクです。",
        );
      }
      const nextPool: DhcpPool = {
        ...currentPool,
        network: subnetInfo.networkAddress,
        mask: subnetInfo.mask,
      };
      const nextDevice: NetworkDevice = {
        ...device,
        dhcpPools: {
          ...(device.dhcpPools ?? {}),
          [poolName]: nextPool,
        },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "default-router": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command. Usage: default-router <ip>",
          prompt: getDevicePrompt(device),
        };
      }
      const gwParsed = parseIpv4(tokens[1]);
      if (!gwParsed.ok) {
        return buildInvalidInputResult(state, device, tokens, gwParsed.error);
      }
      const nextPool: DhcpPool = {
        ...currentPool,
        defaultRouter: tokens[1],
      };
      const nextDevice: NetworkDevice = {
        ...device,
        dhcpPools: {
          ...(device.dhcpPools ?? {}),
          [poolName]: nextPool,
        },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "dns-server": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command. Usage: dns-server <ip>",
          prompt: getDevicePrompt(device),
        };
      }
      const dnsParsed = parseIpv4(tokens[1]);
      if (!dnsParsed.ok) {
        return buildInvalidInputResult(state, device, tokens, dnsParsed.error);
      }
      const nextPool: DhcpPool = {
        ...currentPool,
        dnsServer: tokens[1],
      };
      const nextDevice: NetworkDevice = {
        ...device,
        dhcpPools: {
          ...(device.dhcpPools ?? {}),
          [poolName]: nextPool,
        },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "no": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const noSub = matchKeyword(tokens[1], [
        "network",
        "default-router",
        "dns-server",
      ]);
      if (noSub.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      const nextPool: DhcpPool = { ...currentPool };
      if (noSub.value === "network") {
        delete nextPool.network;
        delete nextPool.mask;
      } else if (noSub.value === "default-router") {
        delete nextPool.defaultRouter;
      } else if (noSub.value === "dns-server") {
        delete nextPool.dnsServer;
      }
      const nextDevice: NetworkDevice = {
        ...device,
        dhcpPools: {
          ...(device.dhcpPools ?? {}),
          [poolName]: nextPool,
        },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    default:
      return buildInvalidInputResult(state, device, tokens);
  }
}

function executeRouterOspfMode(
  state: NetworkState,
  device: NetworkDevice,
  tokens: string[],
): CommandResult {
  const ospf = device.ospf ?? {
    processId: device.cliState.selectedOspfProcessId ?? 1,
    networks: [],
  };

  const matched = matchKeyword(tokens[0], [
    "router-id",
    "network",
    "no",
    "do",
    "exit",
    "end",
  ]);
  if (matched.kind === "ambiguous") {
    return {
      nextState: state,
      output: `% Ambiguous command: "${tokens.join(" ")}" (${matched.matches.join(", ")})`,
      prompt: getDevicePrompt(device),
    };
  }
  if (matched.kind === "none") {
    return buildInvalidInputResult(state, device, tokens);
  }

  switch (matched.value) {
    case "exit": {
      const nextDevice: NetworkDevice = {
        ...device,
        cliState: { mode: "config" },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "end": {
      const nextDevice: NetworkDevice = {
        ...device,
        cliState: { mode: "privileged" },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "do":
      return executeDoCommand(state, device, tokens.slice(1), tokens);

    case "router-id": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command. Usage: router-id <A.B.C.D>",
          prompt: getDevicePrompt(device),
        };
      }
      const ridParsed = parseIpv4(tokens[1]);
      if (!ridParsed.ok) {
        return buildInvalidInputResult(state, device, tokens, ridParsed.error);
      }
      const nextDevice: NetworkDevice = {
        ...device,
        ospf: {
          ...ospf,
          routerId: tokens[1],
        },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "network": {
      if (tokens.length < 5) {
        return {
          nextState: state,
          output:
            "% Incomplete command. Usage: network <ip> <wildcard> area <id>",
          prompt: getDevicePrompt(device),
        };
      }
      const netIp = tokens[1];
      const wildcard = tokens[2];
      const areaKw = matchKeyword(tokens[3], ["area"]);
      if (areaKw.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      const netParsed = parseIpv4(netIp);
      if (!netParsed.ok) {
        return buildInvalidInputResult(state, device, tokens, netParsed.error);
      }
      const wcParsed = parseIpv4(wildcard);
      if (!wcParsed.ok) {
        return buildInvalidInputResult(state, device, tokens, wcParsed.error);
      }
      if (!/^\d+$/.test(tokens[4])) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `Area ID は 0 以上の整数で指定してください: "${tokens[4]}"`,
        );
      }
      const areaId = Number(tokens[4]);
      const exists = ospf.networks.some(
        (n) =>
          n.network === netIp && n.wildcard === wildcard && n.area === areaId,
      );
      if (exists) {
        return {
          nextState: state,
          output: "",
          prompt: getDevicePrompt(device),
        };
      }
      const nextDevice: NetworkDevice = {
        ...device,
        ospf: {
          ...ospf,
          networks: [
            ...ospf.networks,
            { network: netIp, wildcard, area: areaId },
          ],
        },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    case "no": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const noSub = matchKeyword(tokens[1], ["router-id", "network"]);
      if (noSub.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      if (noSub.value === "router-id") {
        const nextOspf = { ...ospf };
        delete nextOspf.routerId;
        const nextDevice: NetworkDevice = { ...device, ospf: nextOspf };
        return {
          nextState: updateDevice(state, nextDevice),
          output: "",
          prompt: getDevicePrompt(nextDevice),
        };
      }
      // no network <ip> <wildcard> area <id>
      if (tokens.length < 6) {
        return {
          nextState: state,
          output:
            "% Incomplete command. Usage: no network <ip> <wildcard> area <id>",
          prompt: getDevicePrompt(device),
        };
      }
      const netIp = tokens[2];
      const wildcard = tokens[3];
      const areaKw = matchKeyword(tokens[4], ["area"]);
      if (areaKw.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
      if (!/^\d+$/.test(tokens[5])) {
        return buildInvalidInputResult(
          state,
          device,
          tokens,
          `不正な Area ID です: "${tokens[5]}"`,
        );
      }
      const areaId = Number(tokens[5]);
      const nextDevice: NetworkDevice = {
        ...device,
        ospf: {
          ...ospf,
          networks: ospf.networks.filter(
            (n) =>
              !(
                n.network === netIp &&
                n.wildcard === wildcard &&
                n.area === areaId
              ),
          ),
        },
      };
      return {
        nextState: updateDevice(state, nextDevice),
        output: "",
        prompt: getDevicePrompt(nextDevice),
      };
    }

    default:
      return buildInvalidInputResult(state, device, tokens);
  }
}

export function executeCommand(
  state: NetworkState,
  deviceId: string,
  command: string,
): CommandResult {
  const device = state.devices[deviceId];
  if (!device) {
    return {
      nextState: state,
      output: `% Error: Device "${deviceId}" not found.`,
      prompt: ">",
    };
  }

  const trimmed = command.trim();
  if (!trimmed) {
    return {
      nextState: state,
      output: "",
      prompt: getDevicePrompt(device),
    };
  }

  if (trimmed === "?") {
    return {
      nextState: state,
      output: formatHelpOutput(device),
      prompt: getDevicePrompt(device),
    };
  }

  // 末尾に ? がついた場合もヘルプを表示
  if (trimmed.endsWith("?")) {
    return {
      nextState: state,
      output: formatHelpOutput(device),
      prompt: getDevicePrompt(device),
    };
  }

  const tokens = trimmed.split(/\s+/);

  if (device.type === "pc" || device.type === "server") {
    return executeEndHostCommand(state, device, tokens);
  }

  switch (device.cliState.mode) {
    case "user":
      return executeIosPrivilegedOrUserCommand(state, device, tokens, false);
    case "privileged":
      return executeIosPrivilegedOrUserCommand(state, device, tokens, true);
    case "config":
      return executeConfigMode(state, device, tokens);
    case "config-if":
    case "config-subif":
      return executeInterfaceOrSubifMode(state, device, tokens);
    case "config-vlan":
      return executeVlanConfigMode(state, device, tokens);
    case "config-std-nacl":
    case "config-ext-nacl":
      return executeNamedAclMode(state, device, tokens);
    case "dhcp-config":
      return executeDhcpConfigMode(state, device, tokens);
    case "config-router":
      return executeRouterOspfMode(state, device, tokens);
    case "host":
      return executeEndHostCommand(state, device, tokens);
  }
}

export function getCliCompletions(
  state: NetworkState,
  deviceId: string,
  partialInput: string,
): string[] {
  const device = state.devices[deviceId];
  if (!device) {
    return [];
  }

  const entries = getHelpEntriesForDevice(device);
  const trimmedStart = partialInput.trimStart();
  const hasTrailingSpace = /\s$/.test(partialInput);
  const tokens = trimmedStart ? trimmedStart.split(/\s+/) : [];

  // interface <tab> で機器上のインターフェース名を補完
  if (
    (device.cliState.mode === "config" ||
      device.cliState.mode === "config-if" ||
      device.cliState.mode === "config-subif") &&
    tokens.length >= 1 &&
    "interface".startsWith(tokens[0].toLowerCase()) &&
    (hasTrailingSpace || tokens.length === 2)
  ) {
    const partialIf = hasTrailingSpace ? "" : (tokens[1] ?? "").toLowerCase();
    return Object.keys(device.interfaces)
      .filter((ifName) => ifName.toLowerCase().startsWith(partialIf))
      .map((ifName) => `${tokens[0]} ${ifName}`);
  }

  const lowerPartial = trimmedStart.toLowerCase();
  const results = new Set<string>();
  for (const entry of entries) {
    for (const kw of entry.keywords) {
      if (kw.toLowerCase().startsWith(lowerPartial)) {
        results.add(kw);
      }
    }
  }
  return Array.from(results);
}
