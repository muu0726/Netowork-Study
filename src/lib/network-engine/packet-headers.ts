import { getPhysicalInterfaceName, isLoopbackInterfaceName } from "./link-utils";
import { findActiveHsrpForInterface } from "./routing-redundancy";
import type {
  NetworkDevice,
  NetworkState,
  PacketDirection,
  PacketHop,
  PacketTraceResult,
} from "./types";

export interface HopHeaderFields {
  l2: {
    srcMac: string;
    dstMac: string;
    vlanTag: string;
    etherType: string;
  };
  l3: {
    srcIp: string;
    dstIp: string;
    ttl: number | null;
    protocol: string;
  };
  l4: {
    protocol: string;
    srcPort: number | null;
    dstPort: number | null;
    detail: string;
  };
  l7: {
    summary: string;
  };
}

export interface InspectedPacketHop {
  hop: PacketHop;
  headers: HopHeaderFields;
  changedFields: string[];
  mutationSummary: string;
}

function getDeviceInterfaceMac(
  device: NetworkDevice | undefined,
  interfaceName?: string,
): string | null {
  if (!device || !interfaceName) {
    return null;
  }
  const direct = device.interfaces[interfaceName];
  if (direct?.mac) {
    return direct.mac;
  }
  const physName = direct
    ? getPhysicalInterfaceName(direct)
    : interfaceName.includes(".")
      ? interfaceName.split(".")[0]
      : interfaceName;
  return device.interfaces[physName]?.mac ?? null;
}

function getPrimaryDeviceIp(device: NetworkDevice | undefined): string {
  if (!device) {
    return "0.0.0.0";
  }
  const iface = Object.values(device.interfaces).find(
    (i) => !isLoopbackInterfaceName(i.name) && i.ip,
  );
  return iface?.ip ?? "0.0.0.0";
}

function parseNextHopIpFromAction(action: string): string | null {
  const match = /Next-Hop:\s*(\d+\.\d+\.\d+\.\d+)/i.exec(action);
  return match ? match[1] : null;
}

function resolveVlanTagLabel(
  state: NetworkState,
  hop: PacketHop,
  fallbackLabel: string,
): string {
  if (hop.vlanTag === undefined) {
    return fallbackLabel;
  }
  const dev = state.devices[hop.deviceId];
  if (!dev) {
    return `VLAN ${hop.vlanTag}`;
  }
  if (dev.type === "switch") {
    const inMode = hop.incomingInterface
      ? dev.interfaces[hop.incomingInterface]?.switchportMode
      : undefined;
    const outMode = hop.outgoingInterface
      ? dev.interfaces[hop.outgoingInterface]?.switchportMode
      : undefined;
    return inMode === "trunk" || outMode === "trunk"
      ? `802.1Q VLAN ${hop.vlanTag}`
      : `VLAN ${hop.vlanTag} (Access)`;
  }
  if (
    hop.outgoingInterface?.includes(".") ||
    hop.incomingInterface?.includes(".")
  ) {
    return `802.1Q VLAN ${hop.vlanTag}`;
  }
  return `VLAN ${hop.vlanTag}`;
}

function resolveSegmentDstMac(
  state: NetworkState,
  hops: readonly PacketHop[],
  currentIndex: number,
  traceProtocol: PacketTraceResult["protocol"],
  direction: PacketDirection,
  fallbackDstMac: string,
): string {
  if (traceProtocol === "dhcp" && direction === "request") {
    return "ff:ff:ff:ff:ff:ff (Broadcast)";
  }

  const currentHop = hops[currentIndex];
  const nextHopHintIp = parseNextHopIpFromAction(currentHop.action);

  for (let j = currentIndex + 1; j < hops.length; j += 1) {
    const candidate = hops[j];
    if (candidate.direction !== direction) {
      break;
    }
    const dev = state.devices[candidate.deviceId];
    if (!dev) {
      break;
    }
    if (dev.type === "switch") {
      continue;
    }
    if (candidate.status === "error" && candidate.errorReason === "ARP Timeout") {
      return "未解決 (ARP Timeout)";
    }
    if (!candidate.incomingInterface) {
      return fallbackDstMac;
    }

    if (nextHopHintIp) {
      const hsrpMatch = findActiveHsrpForInterface(
        state,
        dev.id,
        candidate.incomingInterface,
        nextHopHintIp,
      );
      if (hsrpMatch) {
        return `${hsrpMatch.virtualMac} (HSRP VIP)`;
      }
    }

    return (
      getDeviceInterfaceMac(dev, candidate.incomingInterface) ?? fallbackDstMac
    );
  }

  if (currentHop.status === "error" && currentHop.errorReason === "ARP Timeout") {
    return "未解決 (ARP Timeout)";
  }

  return fallbackDstMac;
}

function resolvePhaseProtocol(
  trace: PacketTraceResult,
  direction: PacketDirection,
  hopStatus: PacketHop["status"],
): {
  l3Proto: string;
  l4Proto: string;
  initSrcIp: string;
  initDstIp: string;
  initSrcPort: number | null;
  initDstPort: number | null;
  l4Detail: string;
  l7Summary: string;
} {
  if (direction === "dns-query" || direction === "dns-response") {
    return {
      l3Proto: "IPv4 (UDP=17)",
      l4Proto: "UDP",
      initSrcIp: trace.sourceIp ?? "0.0.0.0",
      initDstIp: trace.dnsServerIp ?? trace.resolvedIp ?? trace.targetInput,
      initSrcPort: 53053,
      initDstPort: 53,
      l4Detail:
        direction === "dns-query" ? "UDP DNS Query" : "UDP DNS Response",
      l7Summary:
        direction === "dns-query"
          ? `DNS A Query: ${trace.targetInput}`
          : trace.resolvedIp
            ? `DNS Answer: ${trace.targetInput} -> ${trace.resolvedIp}`
            : `DNS Error: ${trace.failureReason ?? "No Response"}`,
    };
  }

  if (trace.protocol === "dhcp") {
    return {
      l3Proto: "IPv4 (UDP=17)",
      l4Proto: "UDP",
      initSrcIp: "0.0.0.0",
      initDstIp: "255.255.255.255",
      initSrcPort: 68,
      initDstPort: 67,
      l4Detail:
        direction === "request"
          ? "UDP BOOTP/DHCP Discover"
          : "UDP BOOTP/DHCP Offer/Ack",
      l7Summary:
        direction === "request"
          ? "DHCP Discover (IPアドレス要求)"
          : `DHCP Lease (${trace.resolvedIp ?? trace.targetInput})`,
    };
  }

  if (trace.protocol === "icmp" || trace.protocol === "traceroute") {
    return {
      l3Proto: "IPv4 (ICMP=1)",
      l4Proto: "ICMP",
      initSrcIp: trace.sourceIp ?? "0.0.0.0",
      initDstIp: trace.resolvedIp ?? trace.targetInput,
      initSrcPort: null,
      initDstPort: null,
      l4Detail:
        trace.protocol === "traceroute"
          ? direction === "request"
            ? "ICMP Probe (Low TTL)"
            : "ICMP Time Exceeded / Reply"
          : direction === "request"
            ? "ICMP Echo Request (Type 8)"
            : "ICMP Echo Reply (Type 0)",
      l7Summary: `Ping Target: ${trace.targetInput}`,
    };
  }

  const l4Upper = trace.protocol === "udp" ? "UDP" : "TCP";
  const srcPort = trace.srcPort ?? 51000;
  const dstPort = trace.dstPort ?? (trace.protocol === "http" ? 80 : 0);

  return {
    l3Proto: trace.protocol === "udp" ? "IPv4 (UDP=17)" : "IPv4 (TCP=6)",
    l4Proto: l4Upper,
    initSrcIp: trace.sourceIp ?? "0.0.0.0",
    initDstIp: trace.resolvedIp ?? trace.targetInput,
    initSrcPort: srcPort,
    initDstPort: dstPort,
    l4Detail:
      l4Upper === "TCP"
        ? direction === "request"
          ? "TCP [SYN]"
          : hopStatus === "error"
            ? "TCP [RST, ACK]"
            : "TCP [SYN, ACK]"
        : "UDP Datagram",
    l7Summary:
      trace.protocol === "http"
        ? `HTTP/HTTPS Target (${trace.targetInput}:${dstPort})`
        : `${l4Upper} Session (:${dstPort})`,
  };
}

/**
 * PacketTraceResult の各ホップについて、L2 MAC / 802.1Q VLAN / L3 IP / TTL / NAPT / L4ポート変化を分解します。
 */
export function inspectTraceHopHeaders(
  state: NetworkState,
  trace: PacketTraceResult,
): InspectedPacketHop[] {
  if (trace.hops.length === 0) {
    return [];
  }

  const sourceDevice = state.devices[trace.sourceDeviceId];
  const fallbackSrcIp = getPrimaryDeviceIp(sourceDevice);

  const inspected: InspectedPacketHop[] = [];
  let prevPhase: PacketDirection | null = null;
  let lastRequestSnapshot: HopHeaderFields | null = null;
  let lastDnsQuerySnapshot: HopHeaderFields | null = null;

  let curSrcIp = trace.sourceIp ?? fallbackSrcIp;
  let curDstIp = trace.resolvedIp ?? trace.targetInput;
  let curSrcPort: number | null = trace.srcPort ?? null;
  let curDstPort: number | null = trace.dstPort ?? null;
  let curSrcMac = "00:00:00:00:00:00";
  let curDstMac = "00:00:00:00:00:00";
  let curVlanTag = "Untagged";

  for (let idx = 0; idx < trace.hops.length; idx += 1) {
    const hop = trace.hops[idx];
    const dev = state.devices[hop.deviceId];
    const phaseDefaults = resolvePhaseProtocol(trace, hop.direction, hop.status);
    const phaseChanged = prevPhase !== hop.direction;
    const prevFieldsSamePhase =
      !phaseChanged && inspected.length > 0
        ? inspected[inspected.length - 1].headers
        : null;

    if (phaseChanged) {
      curVlanTag = "Untagged";
      if (hop.direction === "dns-response" && lastDnsQuerySnapshot) {
        curSrcIp = lastDnsQuerySnapshot.l3.dstIp;
        curDstIp = lastDnsQuerySnapshot.l3.srcIp;
        curSrcPort = lastDnsQuerySnapshot.l4.dstPort;
        curDstPort = lastDnsQuerySnapshot.l4.srcPort;
      } else if (hop.direction === "reply" && trace.protocol === "dhcp") {
        const srvIp =
          (hop.incomingInterface &&
            dev?.interfaces[hop.incomingInterface]?.ip) ||
          getPrimaryDeviceIp(dev);
        curSrcIp = srvIp;
        curDstIp = trace.resolvedIp ?? "255.255.255.255";
        curSrcPort = 67;
        curDstPort = 68;
      } else if (hop.direction === "reply" && lastRequestSnapshot) {
        curSrcIp = lastRequestSnapshot.l3.dstIp;
        curDstIp = lastRequestSnapshot.l3.srcIp;
        curSrcPort = lastRequestSnapshot.l4.dstPort;
        curDstPort = lastRequestSnapshot.l4.srcPort;
      } else {
        curSrcIp =
          phaseDefaults.initSrcIp !== "0.0.0.0" || trace.protocol === "dhcp"
            ? phaseDefaults.initSrcIp
            : fallbackSrcIp;
        curDstIp = phaseDefaults.initDstIp;
        curSrcPort = phaseDefaults.initSrcPort;
        curDstPort = phaseDefaults.initDstPort;
      }
    }

    if (hop.natTranslation) {
      if (hop.natTranslation.direction === "inside-to-outside") {
        curSrcIp = hop.natTranslation.afterIp;
        if (hop.natTranslation.afterPort !== undefined) {
          curSrcPort = hop.natTranslation.afterPort;
        }
      } else {
        curDstIp = hop.natTranslation.afterIp;
        if (hop.natTranslation.afterPort !== undefined) {
          curDstPort = hop.natTranslation.afterPort;
        }
      }
    }

    if (dev?.type === "switch") {
      curVlanTag = resolveVlanTagLabel(state, hop, curVlanTag);
    } else {
      if (hop.outgoingInterface) {
        curSrcMac =
          getDeviceInterfaceMac(dev, hop.outgoingInterface) ?? curSrcMac;
        curDstMac = resolveSegmentDstMac(
          state,
          trace.hops,
          idx,
          trace.protocol,
          hop.direction,
          curDstMac,
        );
      }
      curVlanTag = resolveVlanTagLabel(
        state,
        hop,
        hop.outgoingInterface?.includes(".")
          ? curVlanTag
          : "Untagged",
      );
    }

    const headers: HopHeaderFields = {
      l2: {
        srcMac: curSrcMac,
        dstMac: curDstMac,
        vlanTag: curVlanTag,
        etherType: "0x0800 (IPv4)",
      },
      l3: {
        srcIp: curSrcIp,
        dstIp: curDstIp,
        ttl: hop.ttl ?? null,
        protocol: phaseDefaults.l3Proto,
      },
      l4: {
        protocol: phaseDefaults.l4Proto,
        srcPort: curSrcPort,
        dstPort: curDstPort,
        detail: phaseDefaults.l4Detail,
      },
      l7: {
        summary: phaseDefaults.l7Summary,
      },
    };

    const changedFields: string[] = [];
    if (prevFieldsSamePhase) {
      if (headers.l2.srcMac !== prevFieldsSamePhase.l2.srcMac) {
        changedFields.push("srcMac");
      }
      if (headers.l2.dstMac !== prevFieldsSamePhase.l2.dstMac) {
        changedFields.push("dstMac");
      }
      if (headers.l2.vlanTag !== prevFieldsSamePhase.l2.vlanTag) {
        changedFields.push("vlanTag");
      }
      if (headers.l3.srcIp !== prevFieldsSamePhase.l3.srcIp) {
        changedFields.push("srcIp");
      }
      if (headers.l3.dstIp !== prevFieldsSamePhase.l3.dstIp) {
        changedFields.push("dstIp");
      }
      if (headers.l3.ttl !== prevFieldsSamePhase.l3.ttl) {
        changedFields.push("ttl");
      }
      if (headers.l4.srcPort !== prevFieldsSamePhase.l4.srcPort) {
        changedFields.push("srcPort");
      }
      if (headers.l4.dstPort !== prevFieldsSamePhase.l4.dstPort) {
        changedFields.push("dstPort");
      }
    }

    let mutationSummary: string;
    if (hop.status === "error") {
      mutationSummary = `エラー停止: ${hop.errorReason ?? hop.action}`;
    } else if (hop.natTranslation) {
      mutationSummary = `NAPT変換 (${hop.natTranslation.beforeIp}${hop.natTranslation.beforePort !== undefined ? `:${hop.natTranslation.beforePort}` : ""} → ${hop.natTranslation.afterIp}${hop.natTranslation.afterPort !== undefined ? `:${hop.natTranslation.afterPort}` : ""}) ＋ L2 MAC書換`;
    } else if (phaseChanged) {
      mutationSummary =
        hop.direction === "reply" || hop.direction === "dns-response"
          ? `復路パケット生成: 送信元/宛先 (IP・ポート) を反転して返送開始`
          : `往路パケットカプセル化開始: ${headers.l3.srcIp} → ${headers.l3.dstIp}`;
    } else if (dev?.type === "switch") {
      mutationSummary = `L2スイッチ転送: L2 MAC・L3 IP・TTL は書き換えられず ${headers.l2.vlanTag} 内でフォワーディング`;
    } else if (
      changedFields.includes("srcMac") ||
      changedFields.includes("dstMac")
    ) {
      mutationSummary = `L3ルータ転送: L2 MACヘッダを次セグメント宛てへ書換 / TTL -1 (L3 IPは維持)`;
    } else if (!hop.outgoingInterface && hop.incomingInterface) {
      mutationSummary = `宛先デバイス ${hop.hostname} (${hop.incomingInterface}) がフレームを受信しカプセル化解除`;
    } else {
      mutationSummary = hop.action;
    }

    inspected.push({
      hop,
      headers,
      changedFields,
      mutationSummary,
    });

    if (hop.direction === "request") {
      lastRequestSnapshot = headers;
    } else if (hop.direction === "dns-query") {
      lastDnsQuerySnapshot = headers;
    }
    prevPhase = hop.direction;
  }

  return inspected;
}
