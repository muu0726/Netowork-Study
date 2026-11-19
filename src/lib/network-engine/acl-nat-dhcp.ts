import {
  calculateSubnet,
  intToIpv4,
  isIpInRange,
  isIpInSubnet,
  isValidIpv4,
  matchesWildcard,
} from "./ip-math";
import type {
  AccessList,
  AclAction,
  AclProtocol,
  DhcpBinding,
  NatHopInfo,
  NatTranslationEntry,
  NetworkState,
} from "./types";

export interface PacketL3L4Info {
  protocol: "icmp" | "tcp" | "udp" | "ip";
  srcIp: string;
  dstIp: string;
  srcPort?: number;
  dstPort?: number;
}

export interface AclEvalResult {
  action: AclAction;
  isImplicitDeny: boolean;
  matchedSequence?: number;
  nextState: NetworkState;
}

export function evaluateAcl(
  state: NetworkState,
  deviceId: string,
  aclName: string,
  packet: PacketL3L4Info,
  options?: { countHits?: boolean },
): AclEvalResult {
  const device = state.devices[deviceId];
  const acl = device?.acls?.[aclName];
  if (!device || !acl) {
    return {
      action: "permit",
      isImplicitDeny: false,
      nextState: state,
    };
  }

  const countHits = options?.countHits ?? true;
  const sortedRules = [...acl.rules].sort((a, b) => a.sequence - b.sequence);

  for (const rule of sortedRules) {
    try {
      if (!matchesWildcard(packet.srcIp, rule.srcIp, rule.srcWildcard)) {
        continue;
      }

      if (acl.type === "extended") {
        if (rule.protocol !== "ip" && rule.protocol !== packet.protocol) {
          continue;
        }
        if (rule.dstIp && rule.dstWildcard) {
          if (!matchesWildcard(packet.dstIp, rule.dstIp, rule.dstWildcard)) {
            continue;
          }
        }
        if (rule.dstPort !== undefined) {
          if (packet.protocol !== "tcp" && packet.protocol !== "udp") {
            continue;
          }
          if (packet.dstPort !== rule.dstPort) {
            continue;
          }
        }
      }
    } catch {
      continue;
    }

    if (!countHits) {
      return {
        action: rule.action,
        isImplicitDeny: false,
        matchedSequence: rule.sequence,
        nextState: state,
      };
    }

    const updatedAcl: AccessList = {
      ...acl,
      rules: acl.rules.map((r) =>
        r.sequence === rule.sequence ? { ...r, hitCount: r.hitCount + 1 } : r,
      ),
    };

    return {
      action: rule.action,
      isImplicitDeny: false,
      matchedSequence: rule.sequence,
      nextState: {
        ...state,
        devices: {
          ...state.devices,
          [deviceId]: {
            ...device,
            acls: {
              ...device.acls,
              [aclName]: updatedAcl,
            },
          },
        },
      },
    };
  }

  // どのルールにも一致しない場合は末尾の「暗黙の deny」で遮断
  if (!countHits) {
    return {
      action: "deny",
      isImplicitDeny: true,
      nextState: state,
    };
  }

  const updatedAcl: AccessList = {
    ...acl,
    implicitDenyHits: acl.implicitDenyHits + 1,
  };

  return {
    action: "deny",
    isImplicitDeny: true,
    nextState: {
      ...state,
      devices: {
        ...state.devices,
        [deviceId]: {
          ...device,
          acls: {
            ...device.acls,
            [aclName]: updatedAcl,
          },
        },
      },
    },
  };
}

export interface NatTranslationResult {
  translated: boolean;
  translatedIp?: string;
  translatedPort?: number;
  hopInfo?: NatHopInfo;
  nextState: NetworkState;
}

export function applyInsideToOutsideNat(
  state: NetworkState,
  routerId: string,
  inIfaceName: string,
  outIfaceName: string,
  packet: {
    protocol: "icmp" | "tcp" | "udp";
    srcIp: string;
    dstIp: string;
    srcPort: number;
    dstPort: number;
  },
): NatTranslationResult {
  const router = state.devices[routerId];
  if (!router) {
    return { translated: false, nextState: state };
  }

  const inIface = router.interfaces[inIfaceName];
  const outIface = router.interfaces[outIfaceName];
  if (
    !inIface ||
    !outIface ||
    inIface.natRole !== "inside" ||
    outIface.natRole !== "outside" ||
    !outIface.ip ||
    !isValidIpv4(outIface.ip)
  ) {
    return { translated: false, nextState: state };
  }

  if (packet.srcIp === outIface.ip) {
    return { translated: false, nextState: state };
  }

  const matchingRule = (router.natRules ?? []).find(
    (rule) => rule.outsideInterface === outIfaceName,
  );
  if (!matchingRule) {
    return { translated: false, nextState: state };
  }

  const selectorAcl = router.acls?.[matchingRule.aclName];
  if (!selectorAcl) {
    return { translated: false, nextState: state };
  }

  const aclCheck = evaluateAcl(
    state,
    routerId,
    matchingRule.aclName,
    packet,
    { countHits: false },
  );
  if (aclCheck.action !== "permit") {
    return { translated: false, nextState: state };
  }

  const globalIp = outIface.ip;
  const existingList = router.natTranslations ?? [];
  const existing = existingList.find(
    (t) =>
      t.protocol === packet.protocol &&
      t.insideLocalIp === packet.srcIp &&
      t.insideLocalPort === packet.srcPort &&
      t.insideGlobalIp === globalIp &&
      t.outsideGlobalIp === packet.dstIp &&
      t.outsideGlobalPort === packet.dstPort,
  );

  if (existing) {
    return {
      translated: true,
      translatedIp: existing.insideGlobalIp,
      translatedPort: existing.insideGlobalPort,
      hopInfo: {
        beforeIp: packet.srcIp,
        beforePort: packet.srcPort,
        afterIp: existing.insideGlobalIp,
        afterPort: existing.insideGlobalPort,
        direction: "inside-to-outside",
      },
      nextState: state,
    };
  }

  // 決定論的ポート割り当て（他の内部IPと衝突しないポートを選択）
  const usedGlobalPorts = new Set(
    existingList
      .filter(
        (t) =>
          t.protocol === packet.protocol &&
          t.insideGlobalIp === globalIp &&
          t.insideLocalIp !== packet.srcIp,
      )
      .map((t) => t.insideGlobalPort),
  );

  let allocatedPort =
    packet.srcPort > 0 ? packet.srcPort : 10000 + existingList.length;
  if (!matchingRule.overload && usedGlobalPorts.has(allocatedPort)) {
    return { translated: false, nextState: state };
  }
  while (usedGlobalPorts.has(allocatedPort)) {
    allocatedPort = allocatedPort < 10000 ? 10000 : allocatedPort + 1;
  }

  const newEntry: NatTranslationEntry = {
    protocol: packet.protocol,
    insideLocalIp: packet.srcIp,
    insideLocalPort: packet.srcPort,
    insideGlobalIp: globalIp,
    insideGlobalPort: allocatedPort,
    outsideLocalIp: packet.dstIp,
    outsideLocalPort: packet.dstPort,
    outsideGlobalIp: packet.dstIp,
    outsideGlobalPort: packet.dstPort,
  };

  return {
    translated: true,
    translatedIp: globalIp,
    translatedPort: allocatedPort,
    hopInfo: {
      beforeIp: packet.srcIp,
      beforePort: packet.srcPort,
      afterIp: globalIp,
      afterPort: allocatedPort,
      direction: "inside-to-outside",
    },
    nextState: {
      ...state,
      devices: {
        ...state.devices,
        [routerId]: {
          ...router,
          natTranslations: [...existingList, newEntry],
        },
      },
    },
  };
}

export function applyOutsideToInsideNat(
  state: NetworkState,
  routerId: string,
  inIfaceName: string,
  packet: {
    protocol: "icmp" | "tcp" | "udp";
    srcIp: string;
    dstIp: string;
    srcPort: number;
    dstPort: number;
  },
): NatTranslationResult {
  const router = state.devices[routerId];
  if (!router) {
    return { translated: false, nextState: state };
  }
  const inIface = router.interfaces[inIfaceName];
  if (!inIface || inIface.natRole !== "outside") {
    return { translated: false, nextState: state };
  }

  const translations = router.natTranslations ?? [];
  const exact = translations.find(
    (t) =>
      t.protocol === packet.protocol &&
      t.insideGlobalIp === packet.dstIp &&
      t.outsideGlobalIp === packet.srcIp &&
      t.insideGlobalPort === packet.dstPort &&
      (packet.protocol === "icmp" || t.outsideGlobalPort === packet.srcPort),
  );

  const match =
    exact ??
    (packet.protocol === "icmp"
      ? [...translations]
          .reverse()
          .find(
            (t) =>
              t.protocol === "icmp" &&
              t.insideGlobalIp === packet.dstIp &&
              t.outsideGlobalIp === packet.srcIp,
          )
      : undefined);

  if (!match) {
    return { translated: false, nextState: state };
  }

  return {
    translated: true,
    translatedIp: match.insideLocalIp,
    translatedPort: match.insideLocalPort,
    hopInfo: {
      beforeIp: packet.dstIp,
      beforePort: packet.dstPort,
      afterIp: match.insideLocalIp,
      afterPort: match.insideLocalPort,
      direction: "outside-to-inside",
    },
    nextState: state,
  };
}

export type DhcpLeaseResult =
  | {
      ok: true;
      ip: string;
      mask: string;
      defaultRouter?: string;
      dnsServer?: string;
      poolName: string;
      nextState: NetworkState;
    }
  | {
      ok: false;
      reason: string;
    };

export function allocateDhcpLease(
  state: NetworkState,
  serverId: string,
  rxInterfaceName: string,
  clientMac: string,
  clientHostname?: string,
): DhcpLeaseResult {
  const server = state.devices[serverId];
  if (!server) {
    return { ok: false, reason: "DHCPサーバが見つかりません。" };
  }

  const rxIface = server.interfaces[rxInterfaceName];
  if (!rxIface || !rxIface.ip || !rxIface.subnetMask) {
    return {
      ok: false,
      reason: `${server.hostname} ${rxInterfaceName} にIPアドレスが設定されていません。`,
    };
  }

  const pools = Object.values(server.dhcpPools ?? {});
  if (pools.length === 0) {
    return {
      ok: false,
      reason: `${server.hostname} に DHCP プールが設定されていません。`,
    };
  }

  const matchingPool = pools.find((pool) => {
    if (!pool.network || !pool.mask) {
      return false;
    }
    try {
      return isIpInSubnet(rxIface.ip!, pool.network, pool.mask);
    } catch {
      return false;
    }
  });

  if (!matchingPool || !matchingPool.network || !matchingPool.mask) {
    return {
      ok: false,
      reason: `${server.hostname} の DHCP プールネットワーク設定が受信インターフェース (${rxIface.ip}) のサブネットと一致しません。`,
    };
  }

  let subnetInfo;
  try {
    subnetInfo = calculateSubnet(matchingPool.network, matchingPool.mask);
  } catch {
    return {
      ok: false,
      reason: `DHCPプール "${matchingPool.name}" のネットワーク設定が不正です。`,
    };
  }

  if (subnetInfo.prefixLength > 30) {
    return {
      ok: false,
      reason: `DHCPプール "${matchingPool.name}" に割り当て可能なホスト範囲がありません。`,
    };
  }

  const serverOwnIps = new Set(
    Object.values(server.interfaces)
      .map((i) => i.ip)
      .filter((ip): ip is string => Boolean(ip)),
  );
  const excludedRanges = server.dhcpExcludedRanges ?? [];
  const bindings = server.dhcpBindings ?? [];

  const isExcluded = (ip: string): boolean => {
    if (serverOwnIps.has(ip)) {
      return true;
    }
    if (matchingPool.defaultRouter && ip === matchingPool.defaultRouter) {
      return true;
    }
    return excludedRanges.some((range) => {
      try {
        return isIpInRange(ip, range.startIp, range.endIp);
      } catch {
        return false;
      }
    });
  };

  // 既存リースがまだ有効で除外されていない場合は再利用
  const existingForMac = bindings.find(
    (b) => b.mac === clientMac && b.poolName === matchingPool.name,
  );
  let assignedIp: string | null = null;

  if (
    existingForMac &&
    isIpInSubnet(existingForMac.ip, subnetInfo.networkAddress, subnetInfo.mask) &&
    !isExcluded(existingForMac.ip)
  ) {
    assignedIp = existingForMac.ip;
  }

  if (!assignedIp) {
    const usedByOtherMacs = new Set(
      bindings
        .filter((b) => b.mac !== clientMac)
        .map((b) => b.ip),
    );

    const startHost = (subnetInfo.networkInt + 1) >>> 0;
    const endHost = (subnetInfo.broadcastInt - 1) >>> 0;
    const scanLimit = Math.min(endHost, (startHost + 1024) >>> 0);

    for (let ipInt = startHost; ipInt <= scanLimit; ipInt += 1) {
      const candidate = intToIpv4(ipInt >>> 0);
      if (isExcluded(candidate) || usedByOtherMacs.has(candidate)) {
        continue;
      }
      assignedIp = candidate;
      break;
    }
  }

  if (!assignedIp) {
    return {
      ok: false,
      reason: `DHCPプール "${matchingPool.name}" で配布可能なIPアドレスがありません（枯渇または excluded-address 設定を確認してください）。`,
    };
  }

  const newBinding: DhcpBinding = {
    ip: assignedIp,
    mac: clientMac,
    poolName: matchingPool.name,
    hostname: clientHostname,
    type: "Automatic",
  };

  const nextBindings = [
    ...bindings.filter((b) => b.mac !== clientMac),
    newBinding,
  ];

  const nextState: NetworkState = {
    ...state,
    devices: {
      ...state.devices,
      [serverId]: {
        ...server,
        dhcpBindings: nextBindings,
      },
    },
  };

  return {
    ok: true,
    ip: assignedIp,
    mask: subnetInfo.mask,
    defaultRouter: matchingPool.defaultRouter,
    dnsServer: matchingPool.dnsServer,
    poolName: matchingPool.name,
    nextState,
  };
}

export function normalizeAclProtocol(token: string): AclProtocol | null {
  const lower = token.toLowerCase();
  if (lower === "ip" || lower === "icmp" || lower === "tcp" || lower === "udp") {
    return lower;
  }
  return null;
}
