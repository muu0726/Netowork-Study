export type Ipv4ParseResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

export interface SubnetInfo {
  ip: string;
  ipInt: number;
  mask: string;
  maskInt: number;
  wildcardMask: string;
  prefixLength: number;
  networkAddress: string;
  networkInt: number;
  broadcastAddress: string;
  broadcastInt: number;
  firstHost: string | null;
  lastHost: string | null;
  totalAddresses: number;
  usableHostCount: number;
  binaryIp: string;
  binaryMask: string;
}

export interface RouteLookupEntry {
  destination: string;
  mask: string;
  prefixLength?: number;
  adminDistance?: number;
}

const IPV4_STRICT_REGEX =
  /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/;

export function parseIpv4(ip: string): Ipv4ParseResult {
  if (typeof ip !== "string" || ip.length === 0) {
    return { ok: false, error: "IPv4アドレスが空です。" };
  }

  const match = IPV4_STRICT_REGEX.exec(ip);
  if (!match) {
    return {
      ok: false,
      error: `不正なIPv4形式です: "${ip}"（例: 192.168.1.1 の形式で指定してください）`,
    };
  }

  const octets: number[] = [];
  for (let i = 1; i <= 4; i += 1) {
    const val = Number(match[i]);
    if (!Number.isInteger(val) || val < 0 || val > 255) {
      return {
        ok: false,
        error: `IPv4オクテットが範囲外 (0〜255) です: "${ip}"`,
      };
    }
    octets.push(val);
  }

  const intVal =
    ((octets[0] << 24) |
      (octets[1] << 16) |
      (octets[2] << 8) |
      octets[3]) >>>
    0;

  return { ok: true, value: intVal };
}

export function isValidIpv4(ip: string): boolean {
  return parseIpv4(ip).ok;
}

export function ipv4ToInt(ip: string): number {
  const parsed = parseIpv4(ip);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.value;
}

export function intToIpv4(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`32bit符号なし整数範囲外の値です: ${String(value)}`);
  }

  const unsigned = value >>> 0;
  return [
    (unsigned >>> 24) & 0xff,
    (unsigned >>> 16) & 0xff,
    (unsigned >>> 8) & 0xff,
    unsigned & 0xff,
  ].join(".");
}

export function intToBinaryOctets(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`32bit符号なし整数範囲外の値です: ${String(value)}`);
  }

  const unsigned = value >>> 0;
  return [
    ((unsigned >>> 24) & 0xff).toString(2).padStart(8, "0"),
    ((unsigned >>> 16) & 0xff).toString(2).padStart(8, "0"),
    ((unsigned >>> 8) & 0xff).toString(2).padStart(8, "0"),
    (unsigned & 0xff).toString(2).padStart(8, "0"),
  ].join(".");
}

export function prefixToMaskInt(prefix: number): number {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`プレフィックス長は0〜32の整数で指定してください: ${String(prefix)}`);
  }
  if (prefix === 0) {
    return 0;
  }
  return (0xffffffff << (32 - prefix)) >>> 0;
}

export function prefixToMask(prefix: number): string {
  return intToIpv4(prefixToMaskInt(prefix));
}

export function maskToPrefix(mask: string): number {
  const maskInt = ipv4ToInt(mask);
  const inv = (~maskInt) >>> 0;

  // 連続する1の後に連続する0が続く場合のみ、反転値 inv は 2^k - 1 の形になる
  if ((((inv + 1) >>> 0) & inv) !== 0) {
    throw new Error(`連続したビットでない不正なサブネットマスクです: "${mask}"`);
  }

  return Math.clz32(inv);
}

export function isValidSubnetMask(mask: string): boolean {
  try {
    maskToPrefix(mask);
    return true;
  } catch {
    return false;
  }
}

function resolveMaskAndPrefix(maskOrPrefix: string | number): {
  maskInt: number;
  prefixLength: number;
  mask: string;
} {
  if (typeof maskOrPrefix === "number") {
    const maskInt = prefixToMaskInt(maskOrPrefix);
    return {
      maskInt,
      prefixLength: maskOrPrefix,
      mask: intToIpv4(maskInt),
    };
  }

  if (typeof maskOrPrefix === "string" && maskOrPrefix.startsWith("/")) {
    const raw = maskOrPrefix.slice(1);
    if (!/^\d{1,2}$/.test(raw)) {
      throw new Error(`不正なCIDR表記です: "${maskOrPrefix}"`);
    }
    const prefixLength = Number(raw);
    const maskInt = prefixToMaskInt(prefixLength);
    return {
      maskInt,
      prefixLength,
      mask: intToIpv4(maskInt),
    };
  }

  const prefixLength = maskToPrefix(maskOrPrefix);
  const maskInt = prefixToMaskInt(prefixLength);
  return {
    maskInt,
    prefixLength,
    mask: intToIpv4(maskInt),
  };
}

export function calculateSubnet(
  ip: string,
  maskOrPrefix: string | number,
): SubnetInfo {
  const ipInt = ipv4ToInt(ip);
  const { maskInt, prefixLength, mask } = resolveMaskAndPrefix(maskOrPrefix);

  const wildcardInt = (~maskInt) >>> 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;

  const networkAddress = intToIpv4(networkInt);
  const broadcastAddress = intToIpv4(broadcastInt);
  const totalAddresses = 2 ** (32 - prefixLength);

  let usableHostCount: number;
  let firstHost: string | null;
  let lastHost: string | null;

  if (prefixLength <= 30) {
    usableHostCount = totalAddresses - 2;
    firstHost = intToIpv4((networkInt + 1) >>> 0);
    lastHost = intToIpv4((broadcastInt - 1) >>> 0);
  } else if (prefixLength === 31) {
    usableHostCount = 0;
    firstHost = null;
    lastHost = null;
  } else {
    usableHostCount = 1;
    firstHost = networkAddress;
    lastHost = networkAddress;
  }

  return {
    ip: intToIpv4(ipInt),
    ipInt,
    mask,
    maskInt,
    wildcardMask: intToIpv4(wildcardInt),
    prefixLength,
    networkAddress,
    networkInt,
    broadcastAddress,
    broadcastInt,
    firstHost,
    lastHost,
    totalAddresses,
    usableHostCount,
    binaryIp: intToBinaryOctets(ipInt),
    binaryMask: intToBinaryOctets(maskInt),
  };
}

export function isSameSubnet(
  ipA: string,
  ipB: string,
  maskOrPrefix: string | number,
): boolean {
  const intA = ipv4ToInt(ipA);
  const intB = ipv4ToInt(ipB);
  const { maskInt } = resolveMaskAndPrefix(maskOrPrefix);
  return ((intA & maskInt) >>> 0) === ((intB & maskInt) >>> 0);
}

export function isIpInSubnet(
  ip: string,
  network: string,
  maskOrPrefix: string | number,
): boolean {
  return isSameSubnet(ip, network, maskOrPrefix);
}

export function isValidHostIp(
  ip: string,
  maskOrPrefix: string | number,
): boolean {
  const info = calculateSubnet(ip, maskOrPrefix);
  if (info.prefixLength >= 31) {
    return true;
  }
  return info.ipInt !== info.networkInt && info.ipInt !== info.broadcastInt;
}

export function longestPrefixMatch<T extends RouteLookupEntry>(
  destIp: string,
  routes: readonly T[],
): T | null {
  const destInt = ipv4ToInt(destIp);
  let bestRoute: T | null = null;
  let bestPrefix = -1;
  let bestAd = Number.POSITIVE_INFINITY;

  for (const route of routes) {
    const destParsed = parseIpv4(route.destination);
    if (!destParsed.ok) {
      continue;
    }

    let prefix: number;
    try {
      prefix =
        route.prefixLength !== undefined
          ? route.prefixLength
          : maskToPrefix(route.mask);
    } catch {
      continue;
    }

    if (prefix < 0 || prefix > 32) {
      continue;
    }

    const maskInt = prefixToMaskInt(prefix);
    const routeNetwork = (destParsed.value & maskInt) >>> 0;
    const targetNetwork = (destInt & maskInt) >>> 0;

    if (routeNetwork !== targetNetwork) {
      continue;
    }

    const ad = route.adminDistance ?? 1;
    if (prefix > bestPrefix || (prefix === bestPrefix && ad < bestAd)) {
      bestRoute = route;
      bestPrefix = prefix;
      bestAd = ad;
    }
  }

  return bestRoute;
}
