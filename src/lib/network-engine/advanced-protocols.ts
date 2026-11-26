import {
  areIpv6Equal,
  compressIpv6,
  formatExpandedIpv6Groups,
  parseIpv6,
} from "./ipv6-math";
import { findConnectedLink, isPhysicalInterfaceUp } from "./link-utils";
import type {
  NetworkDevice,
  NetworkInterface,
  NetworkState,
  PacketHop,
  PacketTraceResult,
  SimulationOutput,
} from "./types";

export interface EtherChannelMemberStatus {
  interfaceName: string;
  mode: "active" | "passive" | "on";
  flag: "P" | "I" | "D";
  peerDeviceId?: string;
  peerInterface?: string;
  reason?: string;
}

export interface EtherChannelGroupSummary {
  groupId: number;
  portChannelName: string;
  status: "SU" | "SD";
  protocol: "LACP" | "-";
  members: EtherChannelMemberStatus[];
}

function areChannelModesCompatible(
  localMode: "active" | "passive" | "on",
  peerMode: "active" | "passive" | "on",
): boolean {
  if (localMode === "on" && peerMode === "on") {
    return true;
  }
  if (localMode === "active" && (peerMode === "active" || peerMode === "passive")) {
    return true;
  }
  if (localMode === "passive" && peerMode === "active") {
    return true;
  }
  return false;
}

export function computeEtherChannelSummary(
  state: NetworkState,
  deviceId: string,
): EtherChannelGroupSummary[] {
  const device = state.devices[deviceId];
  if (!device) {
    return [];
  }

  const byGroup = new Map<number, NetworkInterface[]>();
  for (const iface of Object.values(device.interfaces)) {
    if (iface.channelGroup !== undefined) {
      const list = byGroup.get(iface.channelGroup) ?? [];
      list.push(iface);
      byGroup.set(iface.channelGroup, list);
    }
  }

  const summaries: EtherChannelGroupSummary[] = [];
  for (const [groupId, ifaces] of [...byGroup.entries()].sort((a, b) => a[0] - b[0])) {
    const members: EtherChannelMemberStatus[] = [];
    let usesLacp = false;

    for (const iface of ifaces) {
      const mode = iface.channelMode ?? "on";
      if (mode !== "on") {
        usesLacp = true;
      }

      const linkUp = isPhysicalInterfaceUp(state, deviceId, iface.name);
      if (!linkUp) {
        members.push({
          interfaceName: iface.name,
          mode,
          flag: "D",
          reason: "Link down",
        });
        continue;
      }

      const linkInfo = findConnectedLink(state, deviceId, iface.name);
      const peerIface = linkInfo
        ? state.devices[linkInfo.peerDeviceId]?.interfaces[linkInfo.peerInterface]
        : undefined;

      if (!linkInfo || !peerIface || peerIface.channelGroup !== groupId) {
        members.push({
          interfaceName: iface.name,
          mode,
          flag: "I",
          peerDeviceId: linkInfo?.peerDeviceId,
          peerInterface: linkInfo?.peerInterface,
          reason: "Peer not in matching channel-group",
        });
        continue;
      }

      const peerMode = peerIface.channelMode ?? "on";
      if (!areChannelModesCompatible(mode, peerMode)) {
        members.push({
          interfaceName: iface.name,
          mode,
          flag: "I",
          peerDeviceId: linkInfo.peerDeviceId,
          peerInterface: linkInfo.peerInterface,
          reason: `Incompatible mode (${mode} <-> ${peerMode})`,
        });
        continue;
      }

      members.push({
        interfaceName: iface.name,
        mode,
        flag: "P",
        peerDeviceId: linkInfo.peerDeviceId,
        peerInterface: linkInfo.peerInterface,
      });
    }

    const bundledCount = members.filter((m) => m.flag === "P").length;
    summaries.push({
      groupId,
      portChannelName: `Po${groupId}`,
      status: bundledCount >= 1 ? "SU" : "SD",
      protocol: usesLacp ? "LACP" : "-",
      members,
    });
  }

  return summaries;
}

export function formatEtherChannelSummary(
  state: NetworkState,
  deviceId: string,
): string {
  const groups = computeEtherChannelSummary(state, deviceId);
  if (groups.length === 0) {
    return "No EtherChannel groups configured.";
  }

  const lines: string[] = [
    "Flags:  D - down        P - bundled in port-channel",
    "        I - stand-alone s - suspended",
    "        S - Layer2      U - in use",
    "",
    `Number of channel-groups in use: ${groups.length}`,
    "Number of aggregators:           " + groups.length,
    "",
    "Group  Port-channel  Protocol    Ports",
    "------+-------------+-----------+-----------------------------------------------",
  ];

  for (const grp of groups) {
    const portStr = grp.members
      .map((m) => `${m.interfaceName}(${m.flag})`)
      .join(" ");
    lines.push(
      `${String(grp.groupId).padEnd(6)} ${`${grp.portChannelName}(${grp.status})`.padEnd(13)} ${grp.protocol.padEnd(11)} ${portStr}`,
    );
  }

  return lines.join("\n");
}

export function formatPortSecurity(
  state: NetworkState,
  deviceId: string,
  ifaceName?: string,
): string {
  const device = state.devices[deviceId];
  if (!device) {
    return "% Device not found.";
  }

  if (ifaceName) {
    const iface = device.interfaces[ifaceName];
    if (!iface) {
      return `% Invalid interface "${ifaceName}"`;
    }
    const ps = iface.portSecurity;
    if (!ps || !ps.enabled) {
      return `Port Security              : Disabled\nPort Status                : ${iface.adminUp ? "Secure-up" : "Secure-down"}`;
    }
    const status = ps.errDisabled
      ? "Secure-shutdown (err-disabled)"
      : iface.adminUp
        ? "Secure-up"
        : "Secure-down";
    return [
      `Port Security              : Enabled`,
      `Port Status                : ${status}`,
      `Violation Mode             : ${ps.violation}`,
      `Maximum MAC Addresses      : ${ps.maxMac}`,
      `Total MAC Addresses        : ${ps.learnedMacs?.length ?? 0}`,
      `Last Source Address:Vlan   : ${ps.learnedMacs?.[0] ?? "00:00:00:00:00:00"}:${iface.accessVlan ?? 1}`,
    ].join("\n");
  }

  const secured = Object.values(device.interfaces).filter(
    (i) => i.portSecurity?.enabled,
  );
  if (secured.length === 0) {
    return "No interfaces have port-security enabled.";
  }

  const lines: string[] = [
    "Secure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Status",
    "               (Count)       (Count)          (Action)",
    "--------------------------------------------------------------------",
  ];

  for (const iface of secured) {
    const ps = iface.portSecurity!;
    const status = ps.errDisabled
      ? "err-disabled"
      : iface.adminUp
        ? "up"
        : "admin-down";
    lines.push(
      `${iface.name.padEnd(12)} ${String(ps.maxMac).padEnd(14)} ${String(ps.learnedMacs?.length ?? 0).padEnd(12)} ${ps.violation.padEnd(18)} ${status}`,
    );
  }

  return lines.join("\n");
}

function getIpv6PrefixKey(addrWithPrefix: string): {
  ipOnly: string;
  prefixLen: number;
  prefixBits: string;
} | null {
  const parsed = parseIpv6(addrWithPrefix);
  if (!parsed.ok) {
    return null;
  }
  const prefixLen = parsed.prefixLength ?? 64;
  const fullHex = formatExpandedIpv6Groups(parsed.groups).replace(/:/g, "");
  let bits = "";
  for (const ch of fullHex) {
    bits += parseInt(ch, 16).toString(2).padStart(4, "0");
  }
  const ipOnly = compressIpv6(addrWithPrefix.split("/")[0]);
  return {
    ipOnly,
    prefixLen,
    prefixBits: bits.slice(0, prefixLen),
  };
}

function sameIpv6Subnet(addrA: string, addrB: string): boolean {
  const pa = getIpv6PrefixKey(addrA);
  const pb = getIpv6PrefixKey(addrB);
  if (!pa || !pb) {
    return false;
  }
  const len = Math.min(pa.prefixLen, pb.prefixLen);
  return pa.prefixBits.slice(0, len) === pb.prefixBits.slice(0, len);
}

export function formatIpv6InterfaceBrief(
  state: NetworkState,
  deviceId: string,
): string {
  const device = state.devices[deviceId];
  if (!device) {
    return "% Device not found.";
  }

  const lines: string[] = [];
  for (const iface of Object.values(device.interfaces)) {
    const up = iface.adminUp && isPhysicalInterfaceUp(state, deviceId, iface.name);
    const statusText = iface.portSecurity?.errDisabled
      ? "err-disabled/down"
      : iface.adminUp
        ? up
          ? "up/up"
          : "up/down"
        : "administratively down/down";
    lines.push(`${iface.name.padEnd(22)} [${statusText}]`);
    if (iface.ipv6Address) {
      lines.push(`    ${iface.ipv6Address}`);
    } else {
      lines.push("    [unassigned]");
    }
  }
  return lines.join("\n");
}

function findIpv6OwnerOnSameLink(
  state: NetworkState,
  fromDeviceId: string,
  targetIpOnly: string,
): {
  device: NetworkDevice;
  inIface: NetworkInterface;
  outIface: NetworkInterface;
} | null {
  const fromDev = state.devices[fromDeviceId];
  if (!fromDev) {
    return null;
  }

  for (const iface of Object.values(fromDev.interfaces)) {
    if (!isPhysicalInterfaceUp(state, fromDeviceId, iface.name)) {
      continue;
    }
    const link = findConnectedLink(state, fromDeviceId, iface.name);
    if (!link || !link.link.up) {
      continue;
    }
    const peer = state.devices[link.peerDeviceId];
    const peerIface = peer?.interfaces[link.peerInterface];
    if (!peer || !peerIface || !isPhysicalInterfaceUp(state, peer.id, peerIface.name)) {
      continue;
    }

    if (
      peerIface.ipv6Address &&
      areIpv6Equal(peerIface.ipv6Address.split("/")[0], targetIpOnly)
    ) {
      return { device: peer, inIface: peerIface, outIface: iface };
    }
  }
  return null;
}

function findNextIpv6RouterHop(
  state: NetworkState,
  fromDeviceId: string,
  gwIpOnly: string,
): {
  device: NetworkDevice;
  inIface: NetworkInterface;
  outIface: NetworkInterface;
} | null {
  return findIpv6OwnerOnSameLink(state, fromDeviceId, gwIpOnly);
}

export function simulateIpv6Ping(
  state: NetworkState,
  sourceDeviceId: string,
  targetIpv6Raw: string,
): SimulationOutput {
  const sourceDevice = state.devices[sourceDeviceId];
  const parsedTarget = parseIpv6(targetIpv6Raw.split("/")[0]);

  if (!sourceDevice || !parsedTarget.ok) {
    const trace: PacketTraceResult = {
      protocol: "icmp",
      sourceDeviceId,
      targetInput: targetIpv6Raw,
      success: false,
      failureReason: "Invalid Destination",
      failureDeviceId: sourceDeviceId,
      failureMessage: `不正なIPv6アドレスです: ${targetIpv6Raw}`,
      hops: [],
    };
    return {
      trace,
      nextState: state,
      output: `% Invalid IPv6 address: ${targetIpv6Raw}`,
    };
  }

  const targetIp = compressIpv6(targetIpv6Raw.split("/")[0]);
  const srcIface = Object.values(sourceDevice.interfaces).find(
    (i) => Boolean(i.ipv6Address),
  );
  const srcAddrWithPrefix = srcIface?.ipv6Address;
  const srcIp = srcAddrWithPrefix?.split("/")[0];

  if (!srcIface || !srcAddrWithPrefix || !srcIp) {
    const trace: PacketTraceResult = {
      protocol: "icmp",
      sourceDeviceId,
      targetInput: targetIp,
      success: false,
      failureReason: "No IP Configured",
      failureDeviceId: sourceDeviceId,
      failureMessage: `${sourceDevice.hostname} に IPv6 アドレスが設定されていません。`,
      hops: [],
    };
    return {
      trace,
      nextState: state,
      output: `Sending 5, 100-byte ICMPv6 Echos to ${targetIp}:\n.....\nSuccess rate is 0 percent (0/5) — No IPv6 address configured`,
    };
  }

  if (!isPhysicalInterfaceUp(state, sourceDeviceId, srcIface.name)) {
    const trace: PacketTraceResult = {
      protocol: "icmp",
      sourceDeviceId,
      sourceIp: srcIp,
      targetInput: targetIp,
      resolvedIp: targetIp,
      success: false,
      failureReason: "Link Down",
      failureDeviceId: sourceDeviceId,
      failureMessage: `${sourceDevice.hostname} ${srcIface.name} がリンクダウンしています。`,
      hops: [
        {
          step: 1,
          deviceId: sourceDeviceId,
          hostname: sourceDevice.hostname,
          outgoingInterface: srcIface.name,
          direction: "request",
          layer: "L1",
          action: `${srcIface.name} Link Down`,
          status: "error",
          errorReason: "Link Down",
        },
      ],
    };
    return {
      trace,
      nextState: state,
      output: `Sending 5, 100-byte ICMPv6 Echos to ${targetIp}:\n.....\nSuccess rate is 0 percent (0/5) — Link Down`,
    };
  }

  const hops: PacketHop[] = [];
  let step = 1;

  // Check self ping
  if (areIpv6Equal(srcIp, targetIp)) {
    hops.push({
      step: step++,
      deviceId: sourceDeviceId,
      hostname: sourceDevice.hostname,
      outgoingInterface: srcIface.name,
      direction: "request",
      layer: "L3",
      action: `Self ICMPv6 Echo (${srcIp})`,
      status: "ok",
    });
    const trace: PacketTraceResult = {
      protocol: "icmp",
      sourceDeviceId,
      sourceIp: srcIp,
      targetInput: targetIp,
      resolvedIp: targetIp,
      success: true,
      hops,
    };
    return {
      trace,
      nextState: state,
      output: `Sending 5, 100-byte ICMPv6 Echos to ${targetIp}, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/1/2 ms`,
    };
  }

  // Direct link neighbor check
  const directTarget = findIpv6OwnerOnSameLink(state, sourceDeviceId, targetIp);
  if (directTarget && sameIpv6Subnet(srcAddrWithPrefix, directTarget.inIface.ipv6Address ?? targetIp)) {
    hops.push(
      {
        step: step++,
        deviceId: sourceDeviceId,
        hostname: sourceDevice.hostname,
        outgoingInterface: srcIface.name,
        direction: "request",
        layer: "L3",
        action: `ICMPv6 Echo Request (${srcIp} -> ${targetIp})`,
        status: "ok",
      },
      {
        step: step++,
        deviceId: directTarget.device.id,
        hostname: directTarget.device.hostname,
        incomingInterface: directTarget.inIface.name,
        direction: "request",
        layer: "L3",
        action: `ICMPv6 Echo Request 受信`,
        status: "ok",
      },
      {
        step: step++,
        deviceId: directTarget.device.id,
        hostname: directTarget.device.hostname,
        outgoingInterface: directTarget.inIface.name,
        direction: "reply",
        layer: "L3",
        action: `ICMPv6 Echo Reply (${targetIp} -> ${srcIp})`,
        status: "ok",
      },
    );
    const trace: PacketTraceResult = {
      protocol: "icmp",
      sourceDeviceId,
      sourceIp: srcIp,
      targetInput: targetIp,
      resolvedIp: targetIp,
      success: true,
      hops,
    };
    return {
      trace,
      nextState: state,
      output: `Sending 5, 100-byte ICMPv6 Echos to ${targetIp}, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/3 ms`,
    };
  }

  // Gateway / L3 routing check (up to 6 hops)
  let currentDev: NetworkDevice = sourceDevice;
  const visited = new Set<string>([sourceDevice.id]);
  let hopBudget = 6;
  let reachedDevice: NetworkDevice | null = null;
  let reachedInIface: NetworkInterface | null = null;

  while (hopBudget > 0) {
    hopBudget -= 1;

    if (currentDev.id === sourceDevice.id && currentDev.type !== "router") {
      if (!currentDev.ipv6DefaultGateway) {
        hops.push({
          step: step++,
          deviceId: currentDev.id,
          hostname: currentDev.hostname,
          direction: "request",
          layer: "L3",
          action: "IPv6 Default Gateway 未設定",
          status: "error",
          errorReason: "No Route to Host",
        });
        break;
      }
      const gwHop = findNextIpv6RouterHop(
        state,
        currentDev.id,
        currentDev.ipv6DefaultGateway,
      );
      if (!gwHop) {
        hops.push({
          step: step++,
          deviceId: currentDev.id,
          hostname: currentDev.hostname,
          outgoingInterface: srcIface.name,
          direction: "request",
          layer: "L2",
          action: `Gateway ${currentDev.ipv6DefaultGateway} 到達不可`,
          status: "error",
          errorReason: "ARP Timeout",
        });
        break;
      }
      hops.push({
        step: step++,
        deviceId: currentDev.id,
        hostname: currentDev.hostname,
        outgoingInterface: gwHop.outIface.name,
        direction: "request",
        layer: "L3",
        action: `GW ${currentDev.ipv6DefaultGateway} へ送信`,
        status: "ok",
      });
      currentDev = gwHop.device;
      visited.add(currentDev.id);
      continue;
    }

    // Current device is a router (or host acting as router)
    if (currentDev.type === "router" && !currentDev.ipv6UnicastRouting) {
      hops.push({
        step: step++,
        deviceId: currentDev.id,
        hostname: currentDev.hostname,
        direction: "request",
        layer: "L3",
        action: "ipv6 unicast-routing が無効のため転送不可",
        status: "error",
        errorReason: "No Route to Host",
      });
      break;
    }

    // Check if target is on a directly connected IPv6 subnet of currentDev
    let forwarded = false;
    for (const ifItem of Object.values(currentDev.interfaces)) {
      if (!ifItem.ipv6Address) {
        continue;
      }
      if (!isPhysicalInterfaceUp(state, currentDev.id, ifItem.name)) {
        continue;
      }
      if (areIpv6Equal(ifItem.ipv6Address.split("/")[0], targetIp)) {
        reachedDevice = currentDev;
        reachedInIface = ifItem;
        forwarded = true;
        break;
      }
      if (sameIpv6Subnet(ifItem.ipv6Address, `${targetIp}/64`)) {
        const targetHop = findIpv6OwnerOnSameLink(state, currentDev.id, targetIp);
        if (targetHop) {
          hops.push({
            step: step++,
            deviceId: currentDev.id,
            hostname: currentDev.hostname,
            outgoingInterface: ifItem.name,
            direction: "request",
            layer: "L3",
            action: `${ifItem.name} から宛先 ${targetIp} へ転送`,
            status: "ok",
          });
          reachedDevice = targetHop.device;
          reachedInIface = targetHop.inIface;
          forwarded = true;
          break;
        }
      }
    }

    if (reachedDevice) {
      break;
    }

    // Try IPv6 static routes
    if (!forwarded && currentDev.ipv6StaticRoutes) {
      for (const sr of currentDev.ipv6StaticRoutes) {
        if (sameIpv6Subnet(sr.prefix, `${targetIp}/64`)) {
          const nextHopInfo = findNextIpv6RouterHop(state, currentDev.id, sr.nextHop);
          if (nextHopInfo && !visited.has(nextHopInfo.device.id)) {
            hops.push({
              step: step++,
              deviceId: currentDev.id,
              hostname: currentDev.hostname,
              outgoingInterface: nextHopInfo.outIface.name,
              direction: "request",
              layer: "L3",
              action: `IPv6 Static Route via ${sr.nextHop}`,
              status: "ok",
            });
            currentDev = nextHopInfo.device;
            visited.add(currentDev.id);
            forwarded = true;
            break;
          }
        }
      }
    }

    if (!forwarded) {
      hops.push({
        step: step++,
        deviceId: currentDev.id,
        hostname: currentDev.hostname,
        direction: "request",
        layer: "L3",
        action: `宛先 ${targetIp} への IPv6 ルートなし`,
        status: "error",
        errorReason: "No Route to Host",
      });
      break;
    }
  }

  if (reachedDevice && reachedInIface) {
    // Verify return path from reachedDevice -> source (if non-router host, check ipv6DefaultGateway)
    let returnOk = true;
    if (
      reachedDevice.id !== sourceDevice.id &&
      reachedDevice.type !== "router" &&
      !sameIpv6Subnet(
        reachedInIface.ipv6Address ?? targetIp,
        srcAddrWithPrefix,
      )
    ) {
      if (!reachedDevice.ipv6DefaultGateway) {
        returnOk = false;
        hops.push({
          step: step++,
          deviceId: reachedDevice.id,
          hostname: reachedDevice.hostname,
          direction: "reply",
          layer: "L3",
          action: "戻り経路の IPv6 Default Gateway が未設定",
          status: "error",
          errorReason: "No Route to Host",
        });
      }
    }

    if (returnOk) {
      hops.push(
        {
          step: step++,
          deviceId: reachedDevice.id,
          hostname: reachedDevice.hostname,
          incomingInterface: reachedInIface.name,
          direction: "request",
          layer: "L3",
          action: `ICMPv6 Echo Request 受信 (${targetIp})`,
          status: "ok",
        },
        {
          step: step++,
          deviceId: reachedDevice.id,
          hostname: reachedDevice.hostname,
          outgoingInterface: reachedInIface.name,
          direction: "reply",
          layer: "L3",
          action: `ICMPv6 Echo Reply 返送 -> ${srcIp}`,
          status: "ok",
        },
      );
      const trace: PacketTraceResult = {
        protocol: "icmp",
        sourceDeviceId,
        sourceIp: srcIp,
        targetInput: targetIp,
        resolvedIp: targetIp,
        success: true,
        hops,
      };
      return {
        trace,
        nextState: state,
        output: `Sending 5, 100-byte ICMPv6 Echos to ${targetIp}, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`,
      };
    }
  }

  const lastErr = hops[hops.length - 1];
  const trace: PacketTraceResult = {
    protocol: "icmp",
    sourceDeviceId,
    sourceIp: srcIp,
    targetInput: targetIp,
    resolvedIp: targetIp,
    success: false,
    failureReason: lastErr?.errorReason ?? "No Route to Host",
    failureDeviceId: lastErr?.deviceId ?? sourceDeviceId,
    failureMessage: lastErr?.action ?? `${targetIp} に到達できません`,
    hops,
  };
  return {
    trace,
    nextState: state,
    output: `Sending 5, 100-byte ICMPv6 Echos to ${targetIp}:\n.....\nSuccess rate is 0 percent (0/5) — ${trace.failureReason}`,
  };
}
