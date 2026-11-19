export type Ipv6AddressType =
  | "global-unicast"
  | "link-local"
  | "unique-local"
  | "multicast"
  | "loopback"
  | "unspecified"
  | "other";

export type Ipv6Groups = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type Ipv6ParseResult =
  | {
      ok: true;
      groups: Ipv6Groups;
      prefixLength?: number;
    }
  | {
      ok: false;
      error: string;
    };

export interface Ipv6GroupBreakdown {
  index: number;
  full: string;
  trimmed: string;
  leadingZeros: string;
  isZero: boolean;
}

export interface Ipv6TypeInfo {
  type: Ipv6AddressType;
  label: string;
  range: string;
  description: string;
}

export interface Ipv6Analysis {
  input: string;
  expanded: string;
  compressed: string;
  groups: Ipv6Groups;
  expandedGroups: Ipv6GroupBreakdown[];
  zeroRun: { start: number; length: number } | null;
  prefixLength?: number;
  typeInfo: Ipv6TypeInfo;
}

export function parseIpv6(rawInput: string): Ipv6ParseResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: "IPv6アドレスが空です。" };
  }

  let addrPart = trimmed;
  let prefixLength: number | undefined;

  if (trimmed.includes("/")) {
    const slashParts = trimmed.split("/");
    if (slashParts.length !== 2) {
      return { ok: false, error: `不正なプレフィックス表記です: "${rawInput}"` };
    }
    addrPart = slashParts[0];
    const pStr = slashParts[1];
    if (!/^\d+$/.test(pStr)) {
      return { ok: false, error: `プレフィックス長が整数ではありません: "${pStr}"` };
    }
    const pNum = Number(pStr);
    if (pNum < 0 || pNum > 128) {
      return { ok: false, error: `プレフィックス長は 0〜128 の範囲で指定してください: ${pNum}` };
    }
    prefixLength = pNum;
  }

  if (addrPart.includes(":::")) {
    return { ok: false, error: `連続した ":::" は不正です: "${addrPart}"` };
  }

  const doubleColonCount = addrPart.split("::").length - 1;
  if (doubleColonCount > 1) {
    return {
      ok: false,
      error: `"::" はアドレス内に1回しか使用できません: "${addrPart}"`,
    };
  }

  const hexGroupRegex = /^[0-9a-fA-F]{1,4}$/;
  const parsedGroups: number[] = [];

  if (doubleColonCount === 1) {
    const [leftRaw, rightRaw] = addrPart.split("::");
    if (
      (leftRaw.startsWith(":") || leftRaw.endsWith(":")) ||
      (rightRaw.startsWith(":") || rightRaw.endsWith(":"))
    ) {
      return { ok: false, error: `不正なコロン位置です: "${addrPart}"` };
    }
    const leftParts = leftRaw.length > 0 ? leftRaw.split(":") : [];
    const rightParts = rightRaw.length > 0 ? rightRaw.split(":") : [];

    for (const part of [...leftParts, ...rightParts]) {
      if (!hexGroupRegex.test(part)) {
        return {
          ok: false,
          error: `各ブロックは 1〜4 桁の16進数である必要があります: "${part}"`,
        };
      }
    }

    const totalProvided = leftParts.length + rightParts.length;
    if (totalProvided > 7) {
      return {
        ok: false,
        error: `"::" で省略できるゼロブロックがありません（ブロック数が過多です）: "${addrPart}"`,
      };
    }

    const missingZeros = 8 - totalProvided;
    for (const part of leftParts) {
      parsedGroups.push(parseInt(part, 16));
    }
    for (let i = 0; i < missingZeros; i += 1) {
      parsedGroups.push(0);
    }
    for (const part of rightParts) {
      parsedGroups.push(parseInt(part, 16));
    }
  } else {
    if (addrPart.startsWith(":") || addrPart.endsWith(":")) {
      return { ok: false, error: `不正なコロン位置です: "${addrPart}"` };
    }
    const parts = addrPart.split(":");
    if (parts.length !== 8) {
      return {
        ok: false,
        error: `IPv6アドレスは "::" を使わない場合 8 ブロック必須です（現在 ${parts.length} 個）`,
      };
    }
    for (const part of parts) {
      if (!hexGroupRegex.test(part)) {
        return {
          ok: false,
          error: `各ブロックは 1〜4 桁の16進数である必要があります: "${part}"`,
        };
      }
      parsedGroups.push(parseInt(part, 16));
    }
  }

  return {
    ok: true,
    groups: parsedGroups as Ipv6Groups,
    prefixLength,
  };
}

export function findLongestZeroRun(
  groups: readonly number[],
): { start: number; length: number } | null {
  let bestStart = -1;
  let bestLength = 0;

  let curStart = -1;
  let curLength = 0;

  for (let i = 0; i < groups.length; i += 1) {
    if (groups[i] === 0) {
      if (curStart === -1) {
        curStart = i;
        curLength = 1;
      } else {
        curLength += 1;
      }
      // Strict '>' preserves RFC 5952 leftmost tie-break
      if (curLength >= 2 && curLength > bestLength) {
        bestStart = curStart;
        bestLength = curLength;
      }
    } else {
      curStart = -1;
      curLength = 0;
    }
  }

  return bestStart !== -1 ? { start: bestStart, length: bestLength } : null;
}

export function formatExpandedIpv6Groups(groups: readonly number[]): string {
  return groups.map((g) => g.toString(16).padStart(4, "0")).join(":");
}

export function formatCompressedIpv6Groups(groups: readonly number[]): string {
  const trimmed = groups.map((g) => g.toString(16));
  const zeroRun = findLongestZeroRun(groups);
  if (!zeroRun) {
    return trimmed.join(":");
  }
  const left = trimmed.slice(0, zeroRun.start).join(":");
  const right = trimmed.slice(zeroRun.start + zeroRun.length).join(":");
  return `${left}::${right}`;
}

export function expandIpv6(input: string): string {
  const parsed = parseIpv6(input);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const base = formatExpandedIpv6Groups(parsed.groups);
  return parsed.prefixLength !== undefined
    ? `${base}/${parsed.prefixLength}`
    : base;
}

export function compressIpv6(input: string): string {
  const parsed = parseIpv6(input);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const base = formatCompressedIpv6Groups(parsed.groups);
  return parsed.prefixLength !== undefined
    ? `${base}/${parsed.prefixLength}`
    : base;
}

export function classifyIpv6Address(groups: readonly number[]): Ipv6TypeInfo {
  const g0 = groups[0] ?? 0;

  if (groups.every((g) => g === 0)) {
    return {
      type: "unspecified",
      label: "未指定アドレス (Unspecified)",
      range: "::/128",
      description: "DHCPv6やDAD（重複アドレス検出）で送信元IP未決定時に使用される特殊アドレスです。",
    };
  }

  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) {
    return {
      type: "loopback",
      label: "ループバックアドレス (Loopback)",
      range: "::1/128",
      description: "IPv4の 127.0.0.1 に相当する自ホスト宛てテスト用アドレスです。",
    };
  }

  if ((g0 & 0xff00) === 0xff00) {
    return {
      type: "multicast",
      label: "マルチキャスト (Multicast)",
      range: "FF00::/8",
      description: "IPv6ではブロードキャストが存在せず、全ノード通信やルータ探索 (NDP) は FF00::/8 を使用します。",
    };
  }

  if ((g0 & 0xffc0) === 0xfe80) {
    return {
      type: "link-local",
      label: "リンクローカル (Link-Local)",
      range: "FE80::/10",
      description: "同一リンク(LAN)内でのみ有効なアドレス。NDPやOSPFv3ネクストホップとして全IPv6 IFに自動生成されます。",
    };
  }

  if ((g0 & 0xfe00) === 0xfc00) {
    return {
      type: "unique-local",
      label: "ユニークローカル (Unique Local: ULA)",
      range: "FC00::/7 (実務は主に FD00::/8)",
      description: "IPv4のプライベートIPに相当し、社内閉域網などインターネットに流さない用途で割り当てます。",
    };
  }

  if ((g0 & 0xe000) === 0x2000) {
    return {
      type: "global-unicast",
      label: "グローバルユニキャスト (GUA)",
      range: "2000::/3",
      description: "インターネット上で一意にルーティング可能なパブリックIPv6アドレスです（2001:db8::/32 は文書例示用）。",
    };
  }

  return {
    type: "other",
    label: "その他・予約済み範囲",
    range: "Other",
    description: "特殊な予約済みまたは実験用途のIPv6アドレス範囲です。",
  };
}

export function analyzeIpv6(input: string): Ipv6Analysis | null {
  const parsed = parseIpv6(input);
  if (!parsed.ok) {
    return null;
  }
  const zeroRun = findLongestZeroRun(parsed.groups);
  const expandedGroups: Ipv6GroupBreakdown[] = parsed.groups.map((val, idx) => {
    const full = val.toString(16).padStart(4, "0");
    const trimmed = val.toString(16);
    const leadingZeros = full.slice(0, full.length - trimmed.length);
    return {
      index: idx,
      full,
      trimmed,
      leadingZeros,
      isZero: val === 0,
    };
  });

  const baseExp = formatExpandedIpv6Groups(parsed.groups);
  const baseComp = formatCompressedIpv6Groups(parsed.groups);

  return {
    input: input.trim(),
    expanded:
      parsed.prefixLength !== undefined
        ? `${baseExp}/${parsed.prefixLength}`
        : baseExp,
    compressed:
      parsed.prefixLength !== undefined
        ? `${baseComp}/${parsed.prefixLength}`
        : baseComp,
    groups: parsed.groups,
    expandedGroups,
    zeroRun,
    prefixLength: parsed.prefixLength,
    typeInfo: classifyIpv6Address(parsed.groups),
  };
}

export function areIpv6Equal(a: string, b: string): boolean {
  const pa = parseIpv6(a);
  const pb = parseIpv6(b);
  if (!pa.ok || !pb.ok) {
    return false;
  }
  if (pa.prefixLength !== pb.prefixLength) {
    return false;
  }
  return pa.groups.every((g, i) => g === pb.groups[i]);
}

export function isCanonicalCompressedIpv6(input: string): boolean {
  const parsed = parseIpv6(input);
  if (!parsed.ok) {
    return false;
  }
  const canonical = formatCompressedIpv6Groups(parsed.groups);
  const expected =
    parsed.prefixLength !== undefined
      ? `${canonical}/${parsed.prefixLength}`
      : canonical;
  return input.trim().toLowerCase() === expected;
}

export interface Ipv6ConversionDrill {
  id: string;
  mode: "compress" | "expand";
  promptAddress: string;
  expectedAnswer: string;
  hint: string;
  analysis: Ipv6Analysis;
}

const DRILL_CANDIDATE_ADDRESSES = [
  "2001:0db8:0000:0000:0000:0000:0000:0001",
  "fe80:0000:0000:0000:020c:29ff:fe10:0001",
  "2001:0db8:0000:0001:0000:0000:0000:0001",
  "fd12:3456:0000:0000:000a:0000:0000:00ff",
  "2001:0db8:0000:000a:0000:000b:000c:000d",
  "ff02:0000:0000:0000:0000:0000:0000:0002",
  "0000:0000:0000:0000:0000:0000:0000:0001",
  "2001:0000:0000:0010:0000:0000:0000:0020",
];

export function generateIpv6ConversionDrill(
  seed: number,
  mode: "compress" | "expand",
): Ipv6ConversionDrill {
  const safeIdx = Math.abs(seed) % DRILL_CANDIDATE_ADDRESSES.length;
  const fullAddr = DRILL_CANDIDATE_ADDRESSES[safeIdx];
  const analysis = analyzeIpv6(fullAddr)!;

  return {
    id: `ipv6-conv-${mode}-${safeIdx}`,
    mode,
    promptAddress: mode === "compress" ? analysis.expanded : analysis.compressed,
    expectedAnswer: mode === "compress" ? analysis.compressed : analysis.expanded,
    hint:
      mode === "compress"
        ? "各ブロック先頭の 0 を省略し、連続する最も長い 0 ブロック（2個以上）を1か所だけ :: に置換してください（単一の 0 は 0 のまま）。"
        : "各ブロックを4桁にゼロ埋めし、:: に省略された 0000 のブロック数を補って全8グループ (39文字) に展開してください。",
    analysis,
  };
}

export interface Ipv6TypeQuizItem {
  id: string;
  address: string;
  expectedType: Ipv6AddressType;
  choices: Array<{ type: Ipv6AddressType; label: string }>;
  explanation: string;
}

const TYPE_QUIZ_SAMPLES: Array<{ address: string; expectedType: Ipv6AddressType }> = [
  { address: "2001:db8:85a3::8a2e:370:7334", expectedType: "global-unicast" },
  { address: "fe80::1ff:fe23:4567:890a", expectedType: "link-local" },
  { address: "fd00:10:20::1", expectedType: "unique-local" },
  { address: "ff02::1", expectedType: "multicast" },
  { address: "::1", expectedType: "loopback" },
  { address: "2404:6800:4004:824::200e", expectedType: "global-unicast" },
  { address: "fc00::10", expectedType: "unique-local" },
  { address: "fe9f::1", expectedType: "link-local" },
];

export function generateIpv6TypeQuiz(seed: number): Ipv6TypeQuizItem {
  const idx = Math.abs(seed) % TYPE_QUIZ_SAMPLES.length;
  const sample = TYPE_QUIZ_SAMPLES[idx];
  const analysis = analyzeIpv6(sample.address)!;

  return {
    id: `ipv6-type-${idx}`,
    address: sample.address,
    expectedType: sample.expectedType,
    choices: [
      { type: "global-unicast", label: "グローバルユニキャスト (2000::/3)" },
      { type: "link-local", label: "リンクローカル (FE80::/10)" },
      { type: "unique-local", label: "ユニークローカル (FC00::/7)" },
      { type: "multicast", label: "マルチキャスト (FF00::/8)" },
      { type: "loopback", label: "ループバック (::1)" },
    ],
    explanation: `${sample.address} は ${analysis.typeInfo.range} に該当するため「${analysis.typeInfo.label}」です。${analysis.typeInfo.description}`,
  };
}
