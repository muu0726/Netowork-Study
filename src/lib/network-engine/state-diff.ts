import type { NetworkDevice, NetworkState } from "./types";

export interface DiffLine {
  type: "unchanged" | "added" | "removed";
  line: string;
}

export interface DeviceConfigDiff {
  deviceId: string;
  hostname: string;
  deviceType: NetworkDevice["type"];
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
  hasChanges: boolean;
}

export interface NetworkConfigDiff {
  devices: DeviceConfigDiff[];
  totalAdded: number;
  totalRemoved: number;
  changedDeviceCount: number;
}

function formatAclAddressToken(ip: string, wildcard: string): string {
  if (ip === "0.0.0.0" && wildcard === "255.255.255.255") {
    return "any";
  }
  if (wildcard === "0.0.0.0") {
    return `host ${ip}`;
  }
  return `${ip} ${wildcard}`;
}

/**
 * デバイス現在の設定状態を決定論的なコンフィグ行配列としてスナップショット化します。
 */
export function formatDeviceConfigSnapshot(device: NetworkDevice): string[] {
  const lines: string[] = [`hostname ${device.hostname}`];

  if (device.type === "pc" || device.type === "server") {
    const ifaces = Object.values(device.interfaces).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const iface of ifaces) {
      lines.push(`interface ${iface.name}`);
      lines.push(
        iface.ip && iface.subnetMask
          ? ` ip address ${iface.ip} ${iface.subnetMask}`
          : " no ip address",
      );
      lines.push(` state ${iface.adminUp ? "up" : "shutdown"}`);
    }
    lines.push(
      device.defaultGateway
        ? `default-gateway ${device.defaultGateway}`
        : "no default-gateway",
    );
    lines.push(
      device.dnsServer ? `dns-server ${device.dnsServer}` : "no dns-server",
    );

    const dnsEntries = Object.entries(device.dnsRecords ?? {}).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    for (const [host, ip] of dnsEntries) {
      lines.push(`dns-record ${host} -> ${ip}`);
    }

    const services = [...(device.listeningServices ?? [])].sort(
      (a, b) => a.port - b.port || a.protocol.localeCompare(b.protocol),
    );
    for (const svc of services) {
      const unit = svc.unitName ?? svc.serviceName;
      lines.push(
        `service ${unit} ${svc.active ? "active" : "inactive"} (${svc.protocol}/${svc.port})`,
      );
    }

    return lines;
  }

  // Router / Switch Cisco IOS 形式スナップショット
  const vlans = Object.values(device.vlans)
    .filter((v) => v.id !== 1)
    .sort((a, b) => a.id - b.id);
  for (const vlan of vlans) {
    lines.push(`vlan ${vlan.id}`);
    lines.push(` name ${vlan.name}`);
  }

  for (const [vid, prio] of Object.entries(device.stpPriorities ?? {}).sort(
    ([a], [b]) => Number(a) - Number(b),
  )) {
    lines.push(`spanning-tree vlan ${vid} priority ${prio}`);
  }

  const excludedRanges = [...(device.dhcpExcludedRanges ?? [])].sort((a, b) =>
    a.startIp.localeCompare(b.startIp),
  );
  for (const excluded of excludedRanges) {
    lines.push(
      excluded.startIp === excluded.endIp
        ? `ip dhcp excluded-address ${excluded.startIp}`
        : `ip dhcp excluded-address ${excluded.startIp} ${excluded.endIp}`,
    );
  }

  const pools = Object.values(device.dhcpPools ?? {}).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const pool of pools) {
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
  }

  const ifaces = Object.values(device.interfaces).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const iface of ifaces) {
    lines.push(`interface ${iface.name}`);
    if (iface.dot1qVlan !== undefined) {
      lines.push(` encapsulation dot1Q ${iface.dot1qVlan}`);
    }
    if (iface.ip && iface.subnetMask) {
      lines.push(` ip address ${iface.ip} ${iface.subnetMask}`);
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
    if (!iface.adminUp) {
      lines.push(" shutdown");
    }
  }

  const routes = [...device.staticRoutes].sort(
    (a, b) =>
      a.destination.localeCompare(b.destination) ||
      a.mask.localeCompare(b.mask) ||
      a.nextHop.localeCompare(b.nextHop),
  );
  for (const sr of routes) {
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
  }

  for (const nat of device.natRules ?? []) {
    lines.push(
      `ip nat inside source list ${nat.aclName} interface ${nat.outsideInterface}${nat.overload ? " overload" : ""}`,
    );
  }

  const acls = Object.values(device.acls ?? {}).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const acl of acls) {
    const isNumbered = /^\d+$/.test(acl.name);
    const rules = [...acl.rules].sort((a, b) => a.sequence - b.sequence);
    if (isNumbered) {
      for (const rule of rules) {
        if (acl.type === "standard") {
          lines.push(
            `access-list ${acl.name} ${rule.action} ${formatAclAddressToken(rule.srcIp, rule.srcWildcard)}`,
          );
        } else {
          lines.push(
            `access-list ${acl.name} ${rule.action} ${rule.protocol} ${formatAclAddressToken(rule.srcIp, rule.srcWildcard)} ${formatAclAddressToken(rule.dstIp ?? "0.0.0.0", rule.dstWildcard ?? "255.255.255.255")}${rule.dstPort !== undefined ? ` eq ${rule.dstPort}` : ""}`,
          );
        }
      }
    } else {
      lines.push(`ip access-list ${acl.type} ${acl.name}`);
      for (const rule of rules) {
        if (acl.type === "standard") {
          lines.push(
            ` ${rule.sequence} ${rule.action} ${formatAclAddressToken(rule.srcIp, rule.srcWildcard)}`,
          );
        } else {
          lines.push(
            ` ${rule.sequence} ${rule.action} ${rule.protocol} ${formatAclAddressToken(rule.srcIp, rule.srcWildcard)} ${formatAclAddressToken(rule.dstIp ?? "0.0.0.0", rule.dstWildcard ?? "255.255.255.255")}${rule.dstPort !== undefined ? ` eq ${rule.dstPort}` : ""}`,
          );
        }
      }
    }
  }

  return lines;
}

/**
 * 決定論的 LCS ベースの統一ラインDiffを計算します。
 */
export function computeLineDiff(
  beforeLines: readonly string[],
  afterLines: readonly string[],
): DiffLine[] {
  const m = beforeLines.length;
  const n = afterLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (beforeLines[i] === afterLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (beforeLines[i] === afterLines[j]) {
      result.push({ type: "unchanged", line: beforeLines[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "removed", line: beforeLines[i] });
      i += 1;
    } else {
      result.push({ type: "added", line: afterLines[j] });
      j += 1;
    }
  }

  while (i < m) {
    result.push({ type: "removed", line: beforeLines[i] });
    i += 1;
  }
  while (j < n) {
    result.push({ type: "added", line: afterLines[j] });
    j += 1;
  }

  return result;
}

/**
 * 初期 NetworkState と現在 NetworkState 間の機器別コンフィグ差分を算出します。
 */
export function computeNetworkConfigDiff(
  initialState: NetworkState,
  currentState: NetworkState,
): NetworkConfigDiff {
  const seenIds = new Set<string>([
    ...Object.keys(initialState.devices),
    ...Object.keys(currentState.devices),
  ]);

  const devices: DeviceConfigDiff[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;
  let changedDeviceCount = 0;

  for (const deviceId of seenIds) {
    const beforeDev = initialState.devices[deviceId];
    const afterDev = currentState.devices[deviceId];
    const refDev = afterDev ?? beforeDev;
    if (!refDev) {
      continue;
    }

    const beforeLines = beforeDev ? formatDeviceConfigSnapshot(beforeDev) : [];
    const afterLines = afterDev ? formatDeviceConfigSnapshot(afterDev) : [];
    const lines = computeLineDiff(beforeLines, afterLines);
    const addedCount = lines.filter((l) => l.type === "added").length;
    const removedCount = lines.filter((l) => l.type === "removed").length;
    const hasChanges = addedCount > 0 || removedCount > 0;

    if (hasChanges) {
      changedDeviceCount += 1;
      totalAdded += addedCount;
      totalRemoved += removedCount;
    }

    devices.push({
      deviceId,
      hostname: refDev.hostname,
      deviceType: refDev.type,
      lines,
      addedCount,
      removedCount,
      hasChanges,
    });
  }

  return {
    devices,
    totalAdded,
    totalRemoved,
    changedDeviceCount,
  };
}
