import {
  calculateSubnet,
  isSameSubnet,
  isValidHostIp,
  isValidIpv4,
  maskToPrefix,
  parseIpv4,
} from "./ip-math";
import {
  getRouterRoutingTable,
  isInterfaceOperationalUp,
  simulateNslookup,
  simulatePing,
  simulateTraceroute,
} from "./packet-simulator";
import type {
  CommandResult,
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
        usage: "ipconfig",
        description: "IPアドレス・マスク・ゲートウェイ・DNS設定を表示",
        keywords: ["ipconfig", "ifconfig"],
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
    const status = iface.adminUp ? "up" : "administratively down";
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
    "Codes: C - connected, S - static",
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

  const vlans = Object.values(device.vlans)
    .filter((v) => v.id !== 1)
    .sort((a, b) => a.id - b.id);
  for (const vlan of vlans) {
    lines.push(`vlan ${vlan.id}`);
    lines.push(` name ${vlan.name}`);
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
    if (!iface.adminUp) {
      lines.push(" shutdown");
    }
    lines.push("!");
  }

  for (const sr of device.staticRoutes) {
    lines.push(`ip route ${sr.destination} ${sr.mask} ${sr.nextHop}`);
  }
  if (device.staticRoutes.length > 0) {
    lines.push("!");
  }
  lines.push("end");
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
    "vlan",
    "running-config",
    "mac",
    "arp",
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
  const ipSub = matchKeyword(args[1], ["interface", "route"]);
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

  if (ipSub.value === "route") {
    return {
      nextState: state,
      output: formatShowIpRoute(state, device),
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
    "set",
    "ping",
    "traceroute",
    "nslookup",
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

  if (matched.value === "ipconfig" || matched.value === "ifconfig") {
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
    const sim = simulatePing(state, device.id, tokens[1]);
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
      const sim = simulatePing(state, device.id, tokens[1]);
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

    case "ip": {
      if (tokens.length < 2) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const sub = matchKeyword(tokens[1], ["route"]);
      if (sub.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
      }
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
      const target = matchKeyword(tokens[1], ["interface", "vlan", "ip"]);
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

      // no ip route <dest> <mask> [next-hop]
      if (tokens.length < 3) {
        return {
          nextState: state,
          output: "% Incomplete command.",
          prompt: getDevicePrompt(device),
        };
      }
      const sub = matchKeyword(tokens[2], ["route"]);
      if (sub.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
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
        "shutdown",
        "no",
        "interface",
        "do",
        "exit",
        "end",
      ]
    : [
        "ip",
        "shutdown",
        "switchport",
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
    return {
      nextState: updateDevice(state, nextDevice),
      output: "",
      prompt: getDevicePrompt(nextDevice),
    };
  };

  switch (matched.value) {
    case "shutdown":
      return updateCurrentInterface((prev) => ({ ...prev, adminUp: false }));

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
      const sub = matchKeyword(tokens[1], ["address"]);
      if (sub.kind !== "exact") {
        return buildInvalidInputResult(state, device, tokens);
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
      const spSub = matchKeyword(tokens[1], ["mode", "access", "trunk"]);
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
        ? ["encapsulation", "ip", "shutdown"]
        : ["ip", "shutdown", "switchport"];
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

      if (noTarget.value === "ip") {
        if (tokens.length < 3) {
          return {
            nextState: state,
            output: "% Incomplete command.",
            prompt: getDevicePrompt(device),
          };
        }
        const addr = matchKeyword(tokens[2], ["address"]);
        if (addr.kind !== "exact") {
          return buildInvalidInputResult(state, device, tokens);
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
