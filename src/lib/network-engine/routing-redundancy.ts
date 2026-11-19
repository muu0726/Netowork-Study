import {
  calculateSubnet,
  ipv4ToInt,
  isSameSubnet,
  isValidIpv4,
  matchesWildcard,
} from "./ip-math";
import {
  findConnectedLink,
  getPhysicalInterfaceName,
  isInterfaceOperationalUp,
  isLoopbackInterfaceName,
  isPhysicalInterfaceUp,
} from "./link-utils";
import type {
  HsrpRole,
  NetworkDevice,
  NetworkInterface,
  NetworkState,
  StpPortRole,
  StpPortState,
} from "./types";

export interface StpPortEntry {
  interfaceName: string;
  role: StpPortRole;
  state: StpPortState;
  cost: number;
  portId: string;
  type: "P2p";
}

export interface StpSwitchVlanState {
  switchId: string;
  hostname: string;
  vlanId: number;
  isRoot: boolean;
  rootBridgeId: string;
  rootPriority: number;
  rootMac: string;
  rootCost: number;
  bridgePriority: number;
  bridgeMac: string;
  ports: StpPortEntry[];
}

export interface TopologyBlockingLinkInfo {
  linkId: string;
  blockedSide: "from" | "to";
  switchId: string;
  portName: string;
  vlanId: number;
}

export interface L2PeerInterface {
  deviceId: string;
  interfaceName: string;
}

export interface OspfNeighborEntry {
  neighborDeviceId: string;
  neighborHostname: string;
  neighborRouterId: string;
  neighborIp: string;
  state: "FULL";
  localInterface: string;
  remoteInterface: string;
  area: number;
  cost: number;
}

export interface OspfComputedRoute {
  destination: string;
  mask: string;
  prefixLength: number;
  nextHop: string;
  interfaceName: string;
  metric: number;
  adminDistance: number;
  type: "ospf";
}

export interface HsrpRuntimeEntry {
  deviceId: string;
  hostname: string;
  interfaceName: string;
  group: number;
  priority: number;
  preempt: boolean;
  state: HsrpRole;
  activeRouterIp: string;
  standbyRouterIp: string;
  virtualIp: string;
  virtualMac: string;
  localIp?: string;
}

export interface ActiveHsrpMatch {
  group: number;
  virtualIp: string;
  virtualMac: string;
}

function getSwitchBaseMac(sw: NetworkDevice): string {
  if (sw.stpBaseMac) {
    return sw.stpBaseMac.toLowerCase();
  }
  const macs = Object.values(sw.interfaces)
    .map((i) => i.mac.toLowerCase())
    .filter((m) => m.length > 0)
    .sort();
  return macs[0] ?? "00:00:00:00:00:00";
}

export function getStpPortCost(interfaceName: string): number {
  const lower = interfaceName.toLowerCase();
  if (lower.startsWith("te")) {
    return 2;
  }
  if (lower.startsWith("gi")) {
    return 4;
  }
  return 19;
}

function parsePortNumber(interfaceName: string): number {
  const match = interfaceName.match(/(\d+)$/);
  if (!match) {
    return 1;
  }
  const num = Number(match[1]);
  return Number.isFinite(num) && num >= 0 ? num : 1;
}

function isSwitchPortCarryingVlan(
  iface: NetworkInterface,
  vlanId: number,
): boolean {
  const mode = iface.switchportMode ?? "access";
  if (mode === "access") {
    return (iface.accessVlan ?? 1) === vlanId;
  }
  if (iface.trunkAllowedVlans === undefined) {
    return true;
  }
  return iface.trunkAllowedVlans.includes(vlanId);
}

interface StpEdge {
  linkId: string;
  fromSwitchId: string;
  fromPort: string;
  toSwitchId: string;
  toPort: string;
}

interface SwitchTuple {
  cost: number;
  effPrio: number;
  mac: string;
  portNum: number;
  id: string;
}

function compareTuples(a: SwitchTuple, b: SwitchTuple): number {
  if (a.cost !== b.cost) {
    return a.cost - b.cost;
  }
  if (a.effPrio !== b.effPrio) {
    return a.effPrio - b.effPrio;
  }
  const macCmp = a.mac.localeCompare(b.mac);
  if (macCmp !== 0) {
    return macCmp;
  }
  if (a.portNum !== b.portNum) {
    return a.portNum - b.portNum;
  }
  return a.id.localeCompare(b.id);
}

function compareBridgeIds(
  a: { effPrio: number; mac: string; id: string },
  b: { effPrio: number; mac: string; id: string },
): number {
  if (a.effPrio !== b.effPrio) {
    return a.effPrio - b.effPrio;
  }
  const macCmp = a.mac.localeCompare(b.mac);
  if (macCmp !== 0) {
    return macCmp;
  }
  return a.id.localeCompare(b.id);
}

export function computeStpForVlan(
  state: NetworkState,
  vlanId: number,
): Record<string, StpSwitchVlanState> {
  const switches = Object.values(state.devices).filter(
    (d) => d.type === "switch" && Boolean(d.vlans[vlanId]?.active),
  );
  if (switches.length === 0) {
    return {};
  }

  const switchById = new Map(switches.map((s) => [s.id, s]));
  const effPrioById = new Map<string, number>();
  const macById = new Map<string, string>();

  for (const sw of switches) {
    const basePrio = sw.stpPriorities?.[vlanId] ?? 32768;
    effPrioById.set(sw.id, basePrio + vlanId);
    macById.set(sw.id, getSwitchBaseMac(sw));
  }

  // スイッチ間 STP リンク収集
  const adj = new Map<string, StpEdge[]>();
  for (const sw of switches) {
    adj.set(sw.id, []);
  }

  for (const link of state.links) {
    if (!link.up) {
      continue;
    }
    const devA = switchById.get(link.fromDeviceId);
    const devB = switchById.get(link.toDeviceId);
    if (!devA || !devB || devA.id === devB.id) {
      continue;
    }
    const portA = devA.interfaces[link.fromInterface];
    const portB = devB.interfaces[link.toInterface];
    if (!portA || !portB || !portA.adminUp || !portB.adminUp) {
      continue;
    }
    if (
      !isSwitchPortCarryingVlan(portA, vlanId) ||
      !isSwitchPortCarryingVlan(portB, vlanId)
    ) {
      continue;
    }

    adj.get(devA.id)!.push({
      linkId: link.id,
      fromSwitchId: devA.id,
      fromPort: portA.name,
      toSwitchId: devB.id,
      toPort: portB.name,
    });
    adj.get(devB.id)!.push({
      linkId: link.id,
      fromSwitchId: devB.id,
      fromPort: portB.name,
      toSwitchId: devA.id,
      toPort: portA.name,
    });
  }

  // 連結成分ごとにルート選出・最短パス計算・ポート役割決定
  const visitedComp = new Set<string>();
  const result: Record<string, StpSwitchVlanState> = {};

  for (const sw of switches) {
    if (visitedComp.has(sw.id)) {
      continue;
    }
    const compIds: string[] = [];
    const bfsQueue = [sw.id];
    visitedComp.add(sw.id);
    while (bfsQueue.length > 0) {
      const cur = bfsQueue.shift()!;
      compIds.push(cur);
      for (const edge of adj.get(cur) ?? []) {
        if (!visitedComp.has(edge.toSwitchId)) {
          visitedComp.add(edge.toSwitchId);
          bfsQueue.push(edge.toSwitchId);
        }
      }
    }

    // Root Bridge 選出
    let rootId = compIds[0];
    for (const id of compIds.slice(1)) {
      const cmp = compareBridgeIds(
        {
          effPrio: effPrioById.get(id)!,
          mac: macById.get(id)!,
          id,
        },
        {
          effPrio: effPrioById.get(rootId)!,
          mac: macById.get(rootId)!,
          id: rootId,
        },
      );
      if (cmp < 0) {
        rootId = id;
      }
    }

    // Root Bridge からの Dijkstra 最短ルートパス計算
    const rootCost = new Map<string, number>();
    const bestParentTuple = new Map<
      string,
      { senderPrio: number; senderMac: string; senderPortNum: number; localPortNum: number; linkId: string; localPort: string }
    >();
    const settled = new Set<string>();

    for (const id of compIds) {
      rootCost.set(id, id === rootId ? 0 : Number.POSITIVE_INFINITY);
    }

    while (settled.size < compIds.length) {
      let bestNode: string | null = null;
      let bestCost = Number.POSITIVE_INFINITY;
      for (const id of compIds) {
        if (settled.has(id)) {
          continue;
        }
        const c = rootCost.get(id)!;
        if (
          c < bestCost ||
          (c === bestCost &&
            bestNode !== null &&
            compareBridgeIds(
              { effPrio: effPrioById.get(id)!, mac: macById.get(id)!, id },
              {
                effPrio: effPrioById.get(bestNode)!,
                mac: macById.get(bestNode)!,
                id: bestNode,
              },
            ) < 0)
        ) {
          bestCost = c;
          bestNode = id;
        }
      }

      if (!bestNode || !Number.isFinite(bestCost)) {
        break;
      }
      settled.add(bestNode);

      for (const edge of adj.get(bestNode) ?? []) {
        const rxCost = getStpPortCost(edge.toPort);
        const candCost = bestCost + rxCost;
        const candTuple = {
          senderPrio: effPrioById.get(bestNode)!,
          senderMac: macById.get(bestNode)!,
          senderPortNum: parsePortNumber(edge.fromPort),
          localPortNum: parsePortNumber(edge.toPort),
          linkId: edge.linkId,
          localPort: edge.toPort,
        };

        const prevCost = rootCost.get(edge.toSwitchId)!;
        const prevTuple = bestParentTuple.get(edge.toSwitchId);

        let isBetter = candCost < prevCost;
        if (candCost === prevCost && prevTuple) {
          const cmp = compareTuples(
            {
              cost: candCost,
              effPrio: candTuple.senderPrio,
              mac: candTuple.senderMac,
              portNum: candTuple.senderPortNum,
              id: `${candTuple.localPortNum}:${candTuple.linkId}`,
            },
            {
              cost: prevCost,
              effPrio: prevTuple.senderPrio,
              mac: prevTuple.senderMac,
              portNum: prevTuple.senderPortNum,
              id: `${prevTuple.localPortNum}:${prevTuple.linkId}`,
            },
          );
          if (cmp < 0) {
            isBetter = true;
          }
        }

        if (isBetter) {
          rootCost.set(edge.toSwitchId, candCost);
          bestParentTuple.set(edge.toSwitchId, candTuple);
        }
      }
    }

    const rootEffPrio = effPrioById.get(rootId)!;
    const rootMac = macById.get(rootId)!;
    const rootBridgeId = `${rootEffPrio}.${rootMac}`;

    for (const id of compIds) {
      const curSw = switchById.get(id)!;
      const rootLink = bestParentTuple.get(id);
      const ports: StpPortEntry[] = [];

      const sortedIfaces = Object.values(curSw.interfaces).sort((a, b) =>
        a.name.localeCompare(b.name),
      );

      for (const iface of sortedIfaces) {
        if (!isPhysicalInterfaceUp(state, curSw.id, iface.name)) {
          continue;
        }
        if (!isSwitchPortCarryingVlan(iface, vlanId)) {
          continue;
        }

        const cost = getStpPortCost(iface.name);
        const portNum = parsePortNumber(iface.name);
        const portId = `128.${portNum}`;

        const conn = findConnectedLink(state, curSw.id, iface.name);
        const peerSw = conn ? switchById.get(conn.peerDeviceId) : undefined;
        const peerIface =
          conn && peerSw ? peerSw.interfaces[conn.peerInterface] : undefined;

        if (
          !conn ||
          !peerSw ||
          !peerIface ||
          !isSwitchPortCarryingVlan(peerIface, vlanId)
        ) {
          ports.push({
            interfaceName: iface.name,
            role: "Desg",
            state: "FWD",
            cost,
            portId,
            type: "P2p",
          });
          continue;
        }

        if (
          id !== rootId &&
          rootLink &&
          rootLink.linkId === conn.link.id &&
          rootLink.localPort === iface.name
        ) {
          ports.push({
            interfaceName: iface.name,
            role: "Root",
            state: "FWD",
            cost,
            portId,
            type: "P2p",
          });
          continue;
        }

        const localTuple: SwitchTuple = {
          cost: rootCost.get(id) ?? Number.POSITIVE_INFINITY,
          effPrio: effPrioById.get(id)!,
          mac: macById.get(id)!,
          portNum,
          id,
        };
        const peerTuple: SwitchTuple = {
          cost: rootCost.get(peerSw.id) ?? Number.POSITIVE_INFINITY,
          effPrio: effPrioById.get(peerSw.id)!,
          mac: macById.get(peerSw.id)!,
          portNum: parsePortNumber(peerIface.name),
          id: peerSw.id,
        };

        const winsDesignated = compareTuples(localTuple, peerTuple) < 0;
        ports.push({
          interfaceName: iface.name,
          role: winsDesignated ? "Desg" : "Altn",
          state: winsDesignated ? "FWD" : "BLK",
          cost,
          portId,
          type: "P2p",
        });
      }

      result[id] = {
        switchId: id,
        hostname: curSw.hostname,
        vlanId,
        isRoot: id === rootId,
        rootBridgeId,
        rootPriority: rootEffPrio,
        rootMac,
        rootCost: rootCost.get(id) ?? 0,
        bridgePriority: effPrioById.get(id)!,
        bridgeMac: macById.get(id)!,
        ports,
      };
    }
  }

  return result;
}

function collectActiveStpVlanIds(state: NetworkState): number[] {
  const ids = new Set<number>([1]);
  for (const dev of Object.values(state.devices)) {
    if (dev.type !== "switch") {
      continue;
    }
    for (const v of Object.values(dev.vlans)) {
      if (v.active) {
        ids.add(v.id);
      }
    }
  }
  return Array.from(ids).sort((a, b) => a - b);
}

export function computeStpBlockingPortSet(state: NetworkState): Set<string> {
  const blocked = new Set<string>();
  const vlanIds = collectActiveStpVlanIds(state);

  for (const vlanId of vlanIds) {
    const map = computeStpForVlan(state, vlanId);
    for (const swState of Object.values(map)) {
      for (const port of swState.ports) {
        if (port.state === "BLK") {
          blocked.add(`${swState.switchId}:${port.interfaceName}:${vlanId}`);
        }
      }
    }
  }

  return blocked;
}

export function getTopologyStpBlockingLinks(
  state: NetworkState,
): Record<string, TopologyBlockingLinkInfo> {
  const blockingByLink: Record<string, TopologyBlockingLinkInfo> = {};
  const vlanIds = collectActiveStpVlanIds(state);

  for (const vlanId of vlanIds) {
    const map = computeStpForVlan(state, vlanId);
    for (const link of state.links) {
      if (!link.up || blockingByLink[link.id]) {
        continue;
      }
      const fromSw = map[link.fromDeviceId];
      const fromPort = fromSw?.ports.find(
        (p) => p.interfaceName === link.fromInterface && p.state === "BLK",
      );
      if (fromPort) {
        blockingByLink[link.id] = {
          linkId: link.id,
          blockedSide: "from",
          switchId: link.fromDeviceId,
          portName: link.fromInterface,
          vlanId,
        };
        continue;
      }

      const toSw = map[link.toDeviceId];
      const toPort = toSw?.ports.find(
        (p) => p.interfaceName === link.toInterface && p.state === "BLK",
      );
      if (toPort) {
        blockingByLink[link.id] = {
          linkId: link.id,
          blockedSide: "to",
          switchId: link.toDeviceId,
          portName: link.toInterface,
          vlanId,
        };
      }
    }
  }

  return blockingByLink;
}

export function computeStpForSwitch(
  state: NetworkState,
  switchId: string,
  filterVlanId?: number,
): StpSwitchVlanState[] {
  const sw = state.devices[switchId];
  if (!sw || sw.type !== "switch") {
    return [];
  }

  const vlanIds =
    filterVlanId !== undefined
      ? [filterVlanId]
      : Object.values(sw.vlans)
          .filter((v) => v.active)
          .map((v) => v.id)
          .sort((a, b) => a - b);

  const outputs: StpSwitchVlanState[] = [];
  for (const vid of vlanIds) {
    const map = computeStpForVlan(state, vid);
    if (map[switchId]) {
      outputs.push(map[switchId]);
    }
  }
  return outputs;
}

function findMatchingInterfacesOnPeer(
  peer: NetworkDevice,
  physicalPortName: string,
  incomingTag: number | undefined,
): NetworkInterface[] {
  const matched: NetworkInterface[] = [];
  const ifaces = Object.values(peer.interfaces);

  if (incomingTag !== undefined) {
    for (const iface of ifaces) {
      if (
        iface.isSubinterface &&
        getPhysicalInterfaceName(iface) === physicalPortName &&
        iface.dot1qVlan === incomingTag &&
        iface.adminUp
      ) {
        matched.push(iface);
      }
    }
    if (matched.length === 0 && incomingTag === 1) {
      const hasVlan1Sub = ifaces.some(
        (iface) =>
          iface.isSubinterface &&
          getPhysicalInterfaceName(iface) === physicalPortName &&
          iface.dot1qVlan === 1,
      );
      const phys = peer.interfaces[physicalPortName];
      if (!hasVlan1Sub && phys && phys.adminUp && !phys.isSubinterface) {
        matched.push(phys);
      }
    }
    return matched;
  }

  const phys = peer.interfaces[physicalPortName];
  if (phys && phys.adminUp && !phys.isSubinterface) {
    matched.push(phys);
  }
  return matched;
}

export function findL2ReachableDeviceInterfaces(
  state: NetworkState,
  deviceId: string,
  interfaceName: string,
  stpBlockingSet?: Set<string>,
): L2PeerInterface[] {
  const sourceDevice = state.devices[deviceId];
  const sourceIface = sourceDevice?.interfaces[interfaceName];
  if (!sourceDevice || !sourceIface) {
    return [];
  }
  if (!isInterfaceOperationalUp(state, deviceId, interfaceName)) {
    return [];
  }

  const physName = getPhysicalInterfaceName(sourceIface);
  const firstConn = findConnectedLink(state, deviceId, physName);
  if (!firstConn || !firstConn.link.up) {
    return [];
  }

  const firstPeer = state.devices[firstConn.peerDeviceId];
  const firstPeerPhys = firstPeer?.interfaces[firstConn.peerInterface];
  if (!firstPeer || !firstPeerPhys || !firstPeerPhys.adminUp) {
    return [];
  }

  const initialTag = sourceIface.isSubinterface
    ? sourceIface.dot1qVlan
    : undefined;

  if (firstPeer.type !== "switch") {
    return findMatchingInterfacesOnPeer(
      firstPeer,
      firstConn.peerInterface,
      initialTag,
    ).map((iface) => ({
      deviceId: firstPeer.id,
      interfaceName: iface.name,
    }));
  }

  const stpBlocking = stpBlockingSet ?? computeStpBlockingPortSet(state);
  const results: L2PeerInterface[] = [];
  const seenPeers = new Set<string>();
  const visitedSwitchVlan = new Set<string>();
  const queue: Array<{
    switchId: string;
    ingressPort: string;
    incomingTag: number | undefined;
  }> = [
    {
      switchId: firstPeer.id,
      ingressPort: firstConn.peerInterface,
      incomingTag: initialTag,
    },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const sw = state.devices[cur.switchId];
    if (!sw || sw.type !== "switch") {
      continue;
    }

    const ingressIface = sw.interfaces[cur.ingressPort];
    if (!ingressIface || !ingressIface.adminUp) {
      continue;
    }

    const ingressMode = ingressIface.switchportMode ?? "access";
    let vlanId: number;
    if (ingressMode === "access") {
      if (cur.incomingTag !== undefined) {
        continue;
      }
      vlanId = ingressIface.accessVlan ?? 1;
    } else {
      vlanId = cur.incomingTag ?? 1;
      if (
        ingressIface.trunkAllowedVlans !== undefined &&
        !ingressIface.trunkAllowedVlans.includes(vlanId)
      ) {
        continue;
      }
    }

    if (!sw.vlans[vlanId]?.active) {
      continue;
    }
    if (stpBlocking.has(`${sw.id}:${cur.ingressPort}:${vlanId}`)) {
      continue;
    }

    const visitKey = `${sw.id}:${vlanId}`;
    if (visitedSwitchVlan.has(visitKey)) {
      continue;
    }
    visitedSwitchVlan.add(visitKey);

    for (const outPort of Object.values(sw.interfaces)) {
      if (outPort.name === cur.ingressPort) {
        continue;
      }
      if (!isPhysicalInterfaceUp(state, sw.id, outPort.name)) {
        continue;
      }
      if (stpBlocking.has(`${sw.id}:${outPort.name}:${vlanId}`)) {
        continue;
      }

      const outMode = outPort.switchportMode ?? "access";
      if (!isSwitchPortCarryingVlan(outPort, vlanId)) {
        continue;
      }

      const outConn = findConnectedLink(state, sw.id, outPort.name);
      if (!outConn) {
        continue;
      }
      const peer = state.devices[outConn.peerDeviceId];
      if (!peer) {
        continue;
      }

      const outgoingTag = outMode === "trunk" ? vlanId : undefined;
      if (peer.type === "switch") {
        queue.push({
          switchId: peer.id,
          ingressPort: outConn.peerInterface,
          incomingTag: outgoingTag,
        });
        continue;
      }

      if (peer.id === deviceId && outConn.peerInterface === physName) {
        continue;
      }

      for (const matched of findMatchingInterfacesOnPeer(
        peer,
        outConn.peerInterface,
        outgoingTag,
      )) {
        if (!isInterfaceOperationalUp(state, peer.id, matched.name)) {
          continue;
        }
        const key = `${peer.id}:${matched.name}`;
        if (!seenPeers.has(key)) {
          seenPeers.add(key);
          results.push({ deviceId: peer.id, interfaceName: matched.name });
        }
      }
    }
  }

  return results;
}

export function getOspfRouterId(device: NetworkDevice): string | null {
  if (device.ospf?.routerId && isValidIpv4(device.ospf.routerId)) {
    return device.ospf.routerId;
  }
  const activeIpIfaces = Object.values(device.interfaces).filter(
    (iface) => iface.adminUp && iface.ip && isValidIpv4(iface.ip),
  );
  const loopbacks = activeIpIfaces.filter((iface) =>
    isLoopbackInterfaceName(iface.name),
  );
  const candidates = loopbacks.length > 0 ? loopbacks : activeIpIfaces;
  if (candidates.length === 0) {
    return null;
  }

  let bestIp = candidates[0].ip!;
  let bestInt = ipv4ToInt(bestIp);
  for (const iface of candidates.slice(1)) {
    const val = ipv4ToInt(iface.ip!);
    if (val > bestInt) {
      bestInt = val;
      bestIp = iface.ip!;
    }
  }
  return bestIp;
}

export function getOspfInterfaceCost(iface: NetworkInterface): number {
  if (iface.ospfCost !== undefined && iface.ospfCost >= 1) {
    return iface.ospfCost;
  }
  const lower = iface.name.toLowerCase();
  if (lower.startsWith("gi") || lower.startsWith("lo")) {
    return 1;
  }
  if (lower.startsWith("se")) {
    return 64;
  }
  return 10;
}

export function getOspfInterfaceArea(
  device: NetworkDevice,
  iface: NetworkInterface,
): number | null {
  if (!device.ospf || !iface.ip || !isValidIpv4(iface.ip)) {
    return null;
  }
  for (const stmt of device.ospf.networks) {
    try {
      if (matchesWildcard(iface.ip, stmt.network, stmt.wildcard)) {
        return stmt.area;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function computeOspfNeighbors(
  state: NetworkState,
  routerId: string,
  stpBlockingSet?: Set<string>,
): OspfNeighborEntry[] {
  const router = state.devices[routerId];
  if (!router || router.type !== "router" || !router.ospf) {
    return [];
  }

  const localRouterId = getOspfRouterId(router);
  if (!localRouterId) {
    return [];
  }

  const stpBlocking = stpBlockingSet ?? computeStpBlockingPortSet(state);
  const neighbors: OspfNeighborEntry[] = [];
  const seenKey = new Set<string>();

  for (const iface of Object.values(router.interfaces)) {
    if (!iface.ip || !iface.subnetMask || isLoopbackInterfaceName(iface.name)) {
      continue;
    }
    if (!isInterfaceOperationalUp(state, router.id, iface.name)) {
      continue;
    }
    const localArea = getOspfInterfaceArea(router, iface);
    if (localArea === null) {
      continue;
    }

    const peers = findL2ReachableDeviceInterfaces(
      state,
      router.id,
      iface.name,
      stpBlocking,
    );

    for (const peerRef of peers) {
      const peerDev = state.devices[peerRef.deviceId];
      const peerIface = peerDev?.interfaces[peerRef.interfaceName];
      if (
        !peerDev ||
        peerDev.type !== "router" ||
        !peerDev.ospf ||
        !peerIface ||
        !peerIface.ip ||
        !peerIface.subnetMask
      ) {
        continue;
      }

      const peerArea = getOspfInterfaceArea(peerDev, peerIface);
      const peerRouterId = getOspfRouterId(peerDev);
      if (peerArea === null || peerArea !== localArea || !peerRouterId) {
        continue;
      }
      if (peerRouterId === localRouterId) {
        continue;
      }
      if (peerIface.subnetMask !== iface.subnetMask) {
        continue;
      }
      try {
        if (!isSameSubnet(iface.ip, peerIface.ip, iface.subnetMask)) {
          continue;
        }
      } catch {
        continue;
      }

      const dedupKey = `${iface.name}:${peerDev.id}:${peerIface.name}`;
      if (seenKey.has(dedupKey)) {
        continue;
      }
      seenKey.add(dedupKey);

      neighbors.push({
        neighborDeviceId: peerDev.id,
        neighborHostname: peerDev.hostname,
        neighborRouterId: peerRouterId,
        neighborIp: peerIface.ip,
        state: "FULL",
        localInterface: iface.name,
        remoteInterface: peerIface.name,
        area: localArea,
        cost: getOspfInterfaceCost(iface),
      });
    }
  }

  return neighbors.sort((a, b) => {
    const ifCmp = a.localInterface.localeCompare(b.localInterface);
    if (ifCmp !== 0) {
      return ifCmp;
    }
    return ipv4ToInt(a.neighborRouterId) - ipv4ToInt(b.neighborRouterId);
  });
}

export function computeOspfRoutes(
  state: NetworkState,
  routerId: string,
): OspfComputedRoute[] {
  const origin = state.devices[routerId];
  if (!origin || origin.type !== "router" || !origin.ospf) {
    return [];
  }

  const stpBlocking = computeStpBlockingPortSet(state);

  // 自ルータの直結ネットワーク（管理距離 0 が優先されるため除外）
  const connectedKeys = new Set<string>();
  for (const iface of Object.values(origin.interfaces)) {
    if (!iface.ip || !iface.subnetMask) {
      continue;
    }
    if (!isInterfaceOperationalUp(state, origin.id, iface.name)) {
      continue;
    }
    try {
      const info = calculateSubnet(iface.ip, iface.subnetMask);
      connectedKeys.add(`${info.networkAddress}/${info.prefixLength}`);
    } catch {
      continue;
    }
  }

  // OSPF グラフを隣接関係から構築し、Dijkstra 最短経路を算出
  const dist = new Map<string, number>([[routerId, 0]]);
  const firstHopIp = new Map<string, string>();
  const firstHopIf = new Map<string, string>();
  const settled = new Set<string>();
  const discovered = new Set<string>([routerId]);

  while (true) {
    let bestRouter: string | null = null;
    let bestCost = Number.POSITIVE_INFINITY;

    for (const cand of discovered) {
      if (settled.has(cand)) {
        continue;
      }
      const c = dist.get(cand) ?? Number.POSITIVE_INFINITY;
      if (
        c < bestCost ||
        (c === bestCost && bestRouter !== null && cand.localeCompare(bestRouter) < 0)
      ) {
        bestCost = c;
        bestRouter = cand;
      }
    }

    if (!bestRouter || !Number.isFinite(bestCost)) {
      break;
    }
    settled.add(bestRouter);

    const neighbors = computeOspfNeighbors(state, bestRouter, stpBlocking);
    for (const nbr of neighbors) {
      const targetId = nbr.neighborDeviceId;
      discovered.add(targetId);

      const candCost = bestCost + nbr.cost;
      const candNextHop =
        bestRouter === routerId ? nbr.neighborIp : firstHopIp.get(bestRouter)!;
      const candEgressIf =
        bestRouter === routerId ? nbr.localInterface : firstHopIf.get(bestRouter)!;

      const prevCost = dist.get(targetId) ?? Number.POSITIVE_INFINITY;
      const prevNextHop = firstHopIp.get(targetId);

      const isBetter =
        candCost < prevCost ||
        (candCost === prevCost &&
          prevNextHop !== undefined &&
          ipv4ToInt(candNextHop) < ipv4ToInt(prevNextHop));

      if (isBetter) {
        dist.set(targetId, candCost);
        firstHopIp.set(targetId, candNextHop);
        firstHopIf.set(targetId, candEgressIf);
      }
    }
  }

  // 到達可能な全リモート OSPF ルータが広告するネットワークを収集
  const bestRouteByPrefix = new Map<string, OspfComputedRoute>();

  for (const remoteId of settled) {
    if (remoteId === routerId) {
      continue;
    }
    const remoteDev = state.devices[remoteId];
    const baseDist = dist.get(remoteId);
    const nextHop = firstHopIp.get(remoteId);
    const interfaceName = firstHopIf.get(remoteId);
    if (!remoteDev || baseDist === undefined || !nextHop || !interfaceName) {
      continue;
    }

    for (const iface of Object.values(remoteDev.interfaces)) {
      if (!iface.ip || !iface.subnetMask) {
        continue;
      }
      if (!isInterfaceOperationalUp(state, remoteDev.id, iface.name)) {
        continue;
      }
      if (getOspfInterfaceArea(remoteDev, iface) === null) {
        continue;
      }
      try {
        const info = calculateSubnet(iface.ip, iface.subnetMask);
        const key = `${info.networkAddress}/${info.prefixLength}`;
        if (connectedKeys.has(key)) {
          continue;
        }
        const totalMetric = baseDist + getOspfInterfaceCost(iface);
        const existing = bestRouteByPrefix.get(key);
        if (
          !existing ||
          totalMetric < existing.metric ||
          (totalMetric === existing.metric &&
            ipv4ToInt(nextHop) < ipv4ToInt(existing.nextHop))
        ) {
          bestRouteByPrefix.set(key, {
            destination: info.networkAddress,
            mask: info.mask,
            prefixLength: info.prefixLength,
            nextHop,
            interfaceName,
            metric: totalMetric,
            adminDistance: 110,
            type: "ospf",
          });
        }
      } catch {
        continue;
      }
    }
  }

  return Array.from(bestRouteByPrefix.values()).sort((a, b) => {
    const ipCmp = ipv4ToInt(a.destination) - ipv4ToInt(b.destination);
    if (ipCmp !== 0) {
      return ipCmp;
    }
    return a.prefixLength - b.prefixLength;
  });
}

export function getHsrpVirtualMac(group: number): string {
  return `00:00:0c:07:ac:${(group & 0xff).toString(16).padStart(2, "0")}`;
}

export function computeHsrpTable(state: NetworkState): HsrpRuntimeEntry[] {
  const stpBlocking = computeStpBlockingPortSet(state);
  const results: HsrpRuntimeEntry[] = [];

  interface UpHsrpCandidate {
    device: NetworkDevice;
    iface: NetworkInterface;
    group: number;
    priority: number;
    preempt: boolean;
    virtualIp: string;
    lastRole?: "Active" | "Standby";
  }

  const domainGroups = new Map<string, UpHsrpCandidate[]>();

  for (const device of Object.values(state.devices)) {
    if (device.type !== "router") {
      continue;
    }
    for (const iface of Object.values(device.interfaces)) {
      const groups = Object.values(iface.hsrpGroups ?? {});
      if (groups.length === 0) {
        continue;
      }

      const opUp = isInterfaceOperationalUp(state, device.id, iface.name);

      for (const cfg of groups) {
        const vipValid =
          Boolean(cfg.virtualIp && iface.ip && iface.subnetMask) &&
          isValidIpv4(cfg.virtualIp!) &&
          isSameSubnet(iface.ip!, cfg.virtualIp!, iface.subnetMask!);

        if (!opUp || !vipValid) {
          results.push({
            deviceId: device.id,
            hostname: device.hostname,
            interfaceName: iface.name,
            group: cfg.group,
            priority: cfg.priority,
            preempt: cfg.preempt,
            state: "Init",
            activeRouterIp: "unknown",
            standbyRouterIp: "unknown",
            virtualIp: cfg.virtualIp ?? "unknown",
            virtualMac: getHsrpVirtualMac(cfg.group),
            localIp: iface.ip,
          });
          continue;
        }

        const peers = findL2ReachableDeviceInterfaces(
          state,
          device.id,
          iface.name,
          stpBlocking,
        );
        const domainMembers = [
          `${device.id}:${iface.name}`,
          ...peers
            .filter((p) => state.devices[p.deviceId]?.type === "router")
            .map((p) => `${p.deviceId}:${p.interfaceName}`),
        ].sort();
        const groupKey = `${domainMembers.join(",")}|${cfg.group}|${cfg.virtualIp}`;

        const list = domainGroups.get(groupKey) ?? [];
        list.push({
          device,
          iface,
          group: cfg.group,
          priority: cfg.priority,
          preempt: cfg.preempt,
          virtualIp: cfg.virtualIp!,
          lastRole: cfg.lastRole,
        });
        domainGroups.set(groupKey, list);
      }
    }
  }

  for (const candidates of domainGroups.values()) {
    const sorted = [...candidates].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      const ipDiff = ipv4ToInt(b.iface.ip!) - ipv4ToInt(a.iface.ip!);
      if (ipDiff !== 0) {
        return ipDiff;
      }
      return a.device.id.localeCompare(b.device.id);
    });

    const highest = sorted[0];
    const incumbentActive = sorted.find((c) => c.lastRole === "Active");
    const activeCandidate =
      incumbentActive && incumbentActive !== highest && !highest.preempt
        ? incumbentActive
        : highest;

    const remaining = sorted.filter((c) => c !== activeCandidate);
    const standbyCandidate = remaining[0];

    for (const c of sorted) {
      let role: HsrpRole;
      if (c === activeCandidate) {
        role = "Active";
      } else if (c === standbyCandidate) {
        role = "Standby";
      } else {
        role = "Listen";
      }

      results.push({
        deviceId: c.device.id,
        hostname: c.device.hostname,
        interfaceName: c.iface.name,
        group: c.group,
        priority: c.priority,
        preempt: c.preempt,
        state: role,
        activeRouterIp:
          c === activeCandidate ? "local" : activeCandidate.iface.ip!,
        standbyRouterIp: !standbyCandidate
          ? "unknown"
          : c === standbyCandidate
            ? "local"
            : standbyCandidate.iface.ip!,
        virtualIp: c.virtualIp,
        virtualMac: getHsrpVirtualMac(c.group),
        localIp: c.iface.ip,
      });
    }
  }

  return results.sort((a, b) => {
    const devCmp = a.deviceId.localeCompare(b.deviceId);
    if (devCmp !== 0) {
      return devCmp;
    }
    const ifCmp = a.interfaceName.localeCompare(b.interfaceName);
    if (ifCmp !== 0) {
      return ifCmp;
    }
    return a.group - b.group;
  });
}

export function syncHsrpRoles(state: NetworkState): NetworkState {
  const entries = computeHsrpTable(state);
  const roleMap = new Map<string, HsrpRole>();
  for (const e of entries) {
    roleMap.set(`${e.deviceId}:${e.interfaceName}:${e.group}`, e.state);
  }

  let changed = false;
  const nextDevices: Record<string, NetworkDevice> = { ...state.devices };

  for (const device of Object.values(state.devices)) {
    if (device.type !== "router") {
      continue;
    }
    let devChanged = false;
    const nextIfaces: Record<string, NetworkInterface> = { ...device.interfaces };

    for (const iface of Object.values(device.interfaces)) {
      if (!iface.hsrpGroups) {
        continue;
      }
      let ifChanged = false;
      const nextGroups = { ...iface.hsrpGroups };

      for (const [grpStr, cfg] of Object.entries(iface.hsrpGroups)) {
        const grp = Number(grpStr);
        const runtimeRole = roleMap.get(`${device.id}:${iface.name}:${grp}`);
        const desiredLastRole: "Active" | "Standby" | undefined =
          runtimeRole === "Active" || runtimeRole === "Standby"
            ? runtimeRole
            : undefined;
        if (cfg.lastRole !== desiredLastRole) {
          nextGroups[grp] = {
            ...cfg,
            ...(desiredLastRole !== undefined
              ? { lastRole: desiredLastRole }
              : {}),
          };
          if (desiredLastRole === undefined) {
            delete nextGroups[grp].lastRole;
          }
          ifChanged = true;
        }
      }

      if (ifChanged) {
        nextIfaces[iface.name] = { ...iface, hsrpGroups: nextGroups };
        devChanged = true;
      }
    }

    if (devChanged) {
      nextDevices[device.id] = { ...device, interfaces: nextIfaces };
      changed = true;
    }
  }

  return changed ? { ...state, devices: nextDevices } : state;
}

export function findActiveHsrpForInterface(
  state: NetworkState,
  deviceId: string,
  interfaceName: string,
  targetIp: string,
): ActiveHsrpMatch | null {
  const entries = computeHsrpTable(state);
  const hit = entries.find(
    (e) =>
      e.deviceId === deviceId &&
      e.interfaceName === interfaceName &&
      e.state === "Active" &&
      e.virtualIp === targetIp,
  );
  if (!hit) {
    return null;
  }
  return {
    group: hit.group,
    virtualIp: hit.virtualIp,
    virtualMac: hit.virtualMac,
  };
}
