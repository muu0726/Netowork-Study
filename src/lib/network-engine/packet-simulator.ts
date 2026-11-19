import {
  calculateSubnet,
  isSameSubnet,
  isValidIpv4,
  longestPrefixMatch,
} from "./ip-math";
import type {
  NetworkDevice,
  NetworkInterface,
  NetworkLink,
  NetworkState,
  PacketDirection,
  PacketFailureReason,
  PacketHop,
  PacketTraceResult,
  SimulationOutput,
} from "./types";

export interface EffectiveRouteEntry {
  destination: string;
  mask: string;
  prefixLength: number;
  nextHop?: string;
  interfaceName?: string;
  adminDistance: number;
  type: "connected" | "static";
}

export interface ConnectedLinkInfo {
  link: NetworkLink;
  peerDeviceId: string;
  peerInterface: string;
}

export function isLoopbackInterfaceName(name: string): boolean {
  return name.toLowerCase().startsWith("lo");
}

export function getPhysicalInterfaceName(iface: NetworkInterface): string {
  if (iface.isSubinterface && iface.parentInterface) {
    return iface.parentInterface;
  }
  const dotIdx = iface.name.indexOf(".");
  if (dotIdx !== -1) {
    return iface.name.slice(0, dotIdx);
  }
  return iface.name;
}

export function findConnectedLink(
  state: NetworkState,
  deviceId: string,
  interfaceName: string,
): ConnectedLinkInfo | null {
  const device = state.devices[deviceId];
  const iface = device?.interfaces[interfaceName];
  const physicalName = iface ? getPhysicalInterfaceName(iface) : interfaceName;

  for (const link of state.links) {
    if (link.fromDeviceId === deviceId && link.fromInterface === physicalName) {
      return {
        link,
        peerDeviceId: link.toDeviceId,
        peerInterface: link.toInterface,
      };
    }
    if (link.toDeviceId === deviceId && link.toInterface === physicalName) {
      return {
        link,
        peerDeviceId: link.fromDeviceId,
        peerInterface: link.fromInterface,
      };
    }
  }

  return null;
}

export function isPhysicalInterfaceUp(
  state: NetworkState,
  deviceId: string,
  physicalInterfaceName: string,
): boolean {
  const device = state.devices[deviceId];
  if (!device) {
    return false;
  }
  const iface = device.interfaces[physicalInterfaceName];
  if (!iface || !iface.adminUp) {
    return false;
  }
  if (isLoopbackInterfaceName(physicalInterfaceName)) {
    return true;
  }

  const connected = findConnectedLink(state, deviceId, physicalInterfaceName);
  if (!connected || !connected.link.up) {
    return false;
  }

  const peerDevice = state.devices[connected.peerDeviceId];
  const peerIface = peerDevice?.interfaces[connected.peerInterface];
  return Boolean(peerIface && peerIface.adminUp);
}

export function isInterfaceOperationalUp(
  state: NetworkState,
  deviceId: string,
  interfaceName: string,
): boolean {
  const device = state.devices[deviceId];
  if (!device) {
    return false;
  }
  const iface = device.interfaces[interfaceName];
  if (!iface || !iface.adminUp) {
    return false;
  }
  const physicalName = getPhysicalInterfaceName(iface);
  if (iface.isSubinterface) {
    if (iface.dot1qVlan === undefined) {
      return false;
    }
    return isPhysicalInterfaceUp(state, deviceId, physicalName);
  }
  return isPhysicalInterfaceUp(state, deviceId, physicalName);
}

export function getRouterRoutingTable(
  state: NetworkState,
  router: NetworkDevice,
): EffectiveRouteEntry[] {
  const routes: EffectiveRouteEntry[] = [];

  for (const iface of Object.values(router.interfaces)) {
    if (!iface.ip || !iface.subnetMask) {
      continue;
    }
    if (!isInterfaceOperationalUp(state, router.id, iface.name)) {
      continue;
    }
    try {
      const info = calculateSubnet(iface.ip, iface.subnetMask);
      routes.push({
        destination: info.networkAddress,
        mask: info.mask,
        prefixLength: info.prefixLength,
        interfaceName: iface.name,
        adminDistance: 0,
        type: "connected",
      });
    } catch {
      // 不正なIP設定を持つインターフェースはルーティングテーブルに載せない
    }
  }

  for (const staticRoute of router.staticRoutes) {
    routes.push({
      destination: staticRoute.destination,
      mask: staticRoute.mask,
      prefixLength: staticRoute.prefixLength,
      nextHop: staticRoute.nextHop,
      adminDistance: staticRoute.adminDistance,
      type: "static",
    });
  }

  return routes;
}

export function upsertMacEntry(
  state: NetworkState,
  switchId: string,
  vlan: number,
  mac: string,
  interfaceName: string,
): NetworkState {
  const sw = state.devices[switchId];
  if (!sw) {
    return state;
  }
  const already = sw.macTable.find(
    (e) =>
      e.vlan === vlan && e.mac === mac && e.interfaceName === interfaceName,
  );
  if (already) {
    return state;
  }

  const nextMacTable = [
    ...sw.macTable.filter((e) => !(e.vlan === vlan && e.mac === mac)),
    { vlan, mac, interfaceName, type: "dynamic" as const },
  ];

  return {
    ...state,
    devices: {
      ...state.devices,
      [switchId]: {
        ...sw,
        macTable: nextMacTable,
      },
    },
  };
}

export function upsertArpEntry(
  state: NetworkState,
  deviceId: string,
  ip: string,
  mac: string,
  interfaceName: string,
): NetworkState {
  const device = state.devices[deviceId];
  if (!device) {
    return state;
  }
  const already = device.arpTable.find(
    (e) => e.ip === ip && e.mac === mac && e.interfaceName === interfaceName,
  );
  if (already) {
    return state;
  }

  const nextArpTable = [
    ...device.arpTable.filter((e) => e.ip !== ip),
    { ip, mac, interfaceName, type: "dynamic" as const },
  ];

  return {
    ...state,
    devices: {
      ...state.devices,
      [deviceId]: {
        ...device,
        arpTable: nextArpTable,
      },
    },
  };
}

interface L2SwitchTrailItem {
  switchId: string;
  hostname: string;
  ingressPort: string;
  egressPort: string;
  vlanId: number;
  sourceMac: string;
}

interface L2DeliverySuccess {
  ok: true;
  receiverDevice: NetworkDevice;
  receiverInterface: NetworkInterface;
  switchHops: L2SwitchTrailItem[];
  nextState: NetworkState;
}

interface L2DeliveryFailure {
  ok: false;
  failureReason: PacketFailureReason;
  failureDeviceId: string;
  failureInterface?: string;
  failureLayer: "L1" | "L2";
  failureMessage: string;
  switchHops: L2SwitchTrailItem[];
  nextState: NetworkState;
}

type L2DeliveryResult = L2DeliverySuccess | L2DeliveryFailure;

function findPhysicalInterfaceOnDevice(
  device: NetworkDevice,
  physicalPortName: string,
  incomingTag: number | undefined,
  targetIp: string,
): NetworkInterface | null {
  const interfaces = Object.values(device.interfaces);

  if (incomingTag !== undefined) {
    const subMatch = interfaces.find(
      (iface) =>
        iface.isSubinterface &&
        getPhysicalInterfaceName(iface) === physicalPortName &&
        iface.dot1qVlan === incomingTag &&
        iface.adminUp &&
        iface.ip === targetIp,
    );
    if (subMatch) {
      return subMatch;
    }

    // Native VLAN (VLAN 1) は物理インターフェースが未タグのまま受けることがある
    if (incomingTag === 1) {
      const hasVlan1Sub = interfaces.some(
        (iface) =>
          iface.isSubinterface &&
          getPhysicalInterfaceName(iface) === physicalPortName &&
          iface.dot1qVlan === 1,
      );
      if (!hasVlan1Sub) {
        const phys = device.interfaces[physicalPortName];
        if (phys && phys.adminUp && phys.ip === targetIp) {
          return phys;
        }
      }
    }
    return null;
  }

  const phys = device.interfaces[physicalPortName];
  if (phys && phys.adminUp && phys.ip === targetIp) {
    return phys;
  }
  return null;
}

interface PhysicalL2Discovery {
  foundDeviceId: string;
  foundInterfaceName: string;
  blockingSwitchId?: string;
  blockingSwitchPort?: string;
  isLinkDown: boolean;
}

function findDeviceInPhysicalL2Fabric(
  state: NetworkState,
  startDeviceId: string,
  startPhysPort: string,
  targetIp: string,
): PhysicalL2Discovery | null {
  const conn = findConnectedLink(state, startDeviceId, startPhysPort);
  if (!conn) {
    return null;
  }

  const visitedSwitches = new Set<string>();
  const queue: Array<{
    deviceId: string;
    viaSwitchId?: string;
    viaSwitchPort?: string;
  }> = [{ deviceId: conn.peerDeviceId }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dev = state.devices[current.deviceId];
    if (!dev) {
      continue;
    }

    if (dev.type !== "switch") {
      for (const iface of Object.values(dev.interfaces)) {
        if (iface.ip === targetIp) {
          const physName = getPhysicalInterfaceName(iface);
          const up = isPhysicalInterfaceUp(state, dev.id, physName);
          return {
            foundDeviceId: dev.id,
            foundInterfaceName: iface.name,
            blockingSwitchId: current.viaSwitchId,
            blockingSwitchPort: current.viaSwitchPort,
            isLinkDown: !up || !iface.adminUp,
          };
        }
      }
      continue;
    }

    if (visitedSwitches.has(dev.id)) {
      continue;
    }
    visitedSwitches.add(dev.id);

    for (const port of Object.values(dev.interfaces)) {
      const portConn = findConnectedLink(state, dev.id, port.name);
      if (!portConn) {
        continue;
      }
      if (portConn.peerDeviceId === startDeviceId) {
        continue;
      }
      queue.push({
        deviceId: portConn.peerDeviceId,
        viaSwitchId: dev.id,
        viaSwitchPort: port.name,
      });
    }
  }

  return null;
}

function deliverL2Frame(
  state: NetworkState,
  senderId: string,
  egressInterfaceName: string,
  nextHopIp: string,
): L2DeliveryResult {
  const sender = state.devices[senderId];
  if (!sender) {
    return {
      ok: false,
      failureReason: "Link Down",
      failureDeviceId: senderId,
      failureLayer: "L1",
      failureMessage: "送信元デバイスが見つかりません。",
      switchHops: [],
      nextState: state,
    };
  }

  const egressIface = sender.interfaces[egressInterfaceName];
  if (!egressIface || !egressIface.adminUp) {
    return {
      ok: false,
      failureReason: "Link Down",
      failureDeviceId: senderId,
      failureInterface: egressInterfaceName,
      failureLayer: "L1",
      failureMessage: `${sender.hostname} の ${egressInterfaceName} は shutdown 状態です。`,
      switchHops: [],
      nextState: state,
    };
  }

  if (egressIface.isSubinterface && egressIface.dot1qVlan === undefined) {
    return {
      ok: false,
      failureReason: "VLAN Mismatch",
      failureDeviceId: senderId,
      failureInterface: egressInterfaceName,
      failureLayer: "L2",
      failureMessage: `${sender.hostname} ${egressInterfaceName} に encapsulation dot1Q が未設定です。`,
      switchHops: [],
      nextState: state,
    };
  }

  const physEgressName = getPhysicalInterfaceName(egressIface);
  const physEgressIface = sender.interfaces[physEgressName];
  if (!physEgressIface || !physEgressIface.adminUp) {
    return {
      ok: false,
      failureReason: "Link Down",
      failureDeviceId: senderId,
      failureInterface: physEgressName,
      failureLayer: "L1",
      failureMessage: `${sender.hostname} の親インターフェース ${physEgressName} は shutdown 状態です。`,
      switchHops: [],
      nextState: state,
    };
  }

  const firstConn = findConnectedLink(state, senderId, physEgressName);
  if (!firstConn || !firstConn.link.up) {
    return {
      ok: false,
      failureReason: "Link Down",
      failureDeviceId: senderId,
      failureInterface: physEgressName,
      failureLayer: "L1",
      failureMessage: `${sender.hostname} ${physEgressName} の物理リンクがダウンしています。`,
      switchHops: [],
      nextState: state,
    };
  }

  const firstPeer = state.devices[firstConn.peerDeviceId];
  const firstPeerPhys = firstPeer?.interfaces[firstConn.peerInterface];
  if (!firstPeer || !firstPeerPhys || !firstPeerPhys.adminUp) {
    return {
      ok: false,
      failureReason: "Link Down",
      failureDeviceId: firstPeer?.id ?? senderId,
      failureInterface: firstConn.peerInterface,
      failureLayer: "L1",
      failureMessage: `対向インターフェース ${firstPeer?.hostname ?? ""} ${firstConn.peerInterface} がダウンしています。`,
      switchHops: [],
      nextState: state,
    };
  }

  const initialTag = egressIface.isSubinterface
    ? egressIface.dot1qVlan
    : undefined;
  const sourceMac = egressIface.mac || physEgressIface.mac;

  // スイッチを経由しない直接接続（Router-Router, PC-Server等）
  if (firstPeer.type !== "switch") {
    const matched = findPhysicalInterfaceOnDevice(
      firstPeer,
      firstConn.peerInterface,
      initialTag,
      nextHopIp,
    );
    if (!matched) {
      if (initialTag !== undefined) {
        return {
          ok: false,
          failureReason: "VLAN Mismatch",
          failureDeviceId: firstPeer.id,
          failureInterface: firstConn.peerInterface,
          failureLayer: "L2",
          failureMessage: `${firstPeer.hostname} 側で VLAN ${initialTag} の受信設定が一致しません。`,
          switchHops: [],
          nextState: state,
        };
      }
      return {
        ok: false,
        failureReason: "ARP Timeout",
        failureDeviceId: senderId,
        failureInterface: egressInterfaceName,
        failureLayer: "L2",
        failureMessage: `${nextHopIp} からの ARP 応答がタイムアウトしました。`,
        switchHops: [],
        nextState: state,
      };
    }

    let nextState = upsertArpEntry(
      state,
      senderId,
      nextHopIp,
      matched.mac,
      egressInterfaceName,
    );
    if (egressIface.ip) {
      nextState = upsertArpEntry(
        nextState,
        firstPeer.id,
        egressIface.ip,
        sourceMac,
        matched.name,
      );
    }

    return {
      ok: true,
      receiverDevice: nextState.devices[firstPeer.id],
      receiverInterface: matched,
      switchHops: [],
      nextState,
    };
  }

  // L2 スイッチ網の探索
  interface QueueNode {
    switchId: string;
    ingressPort: string;
    incomingTag: number | undefined;
    trail: L2SwitchTrailItem[];
  }

  let updatedState = state;
  const visited = new Set<string>();
  const queue: QueueNode[] = [
    {
      switchId: firstPeer.id,
      ingressPort: firstConn.peerInterface,
      incomingTag: initialTag,
      trail: [],
    },
  ];

  let recordedVlanBlock: {
    deviceId: string;
    port: string;
    message: string;
    trail: L2SwitchTrailItem[];
  } | null = null;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const sw = updatedState.devices[current.switchId];
    if (!sw || sw.type !== "switch") {
      continue;
    }

    const ingressIface = sw.interfaces[current.ingressPort];
    if (!ingressIface || !ingressIface.adminUp) {
      continue;
    }

    const ingressMode = ingressIface.switchportMode ?? "access";
    let vlanId: number;

    if (ingressMode === "access") {
      if (current.incomingTag !== undefined) {
        recordedVlanBlock ??= {
          deviceId: sw.id,
          port: current.ingressPort,
          message: `${sw.hostname} ${current.ingressPort} は access モードのため VLAN ${current.incomingTag} のタグ付きフレームを受信できません（trunk 設定が必要）。`,
          trail: current.trail,
        };
        continue;
      }
      vlanId = ingressIface.accessVlan ?? 1;
    } else {
      vlanId = current.incomingTag ?? 1;
      if (
        ingressIface.trunkAllowedVlans !== undefined &&
        !ingressIface.trunkAllowedVlans.includes(vlanId)
      ) {
        recordedVlanBlock ??= {
          deviceId: sw.id,
          port: current.ingressPort,
          message: `${sw.hostname} ${current.ingressPort} のトランク許可リストに VLAN ${vlanId} が含まれていません。`,
          trail: current.trail,
        };
        continue;
      }
    }

    const vlanEntry = sw.vlans[vlanId];
    if (!vlanEntry || !vlanEntry.active) {
      recordedVlanBlock ??= {
        deviceId: sw.id,
        port: current.ingressPort,
        message: `${sw.hostname} に VLAN ${vlanId} が存在しないか非アクティブです。`,
        trail: current.trail,
      };
      continue;
    }

    const visitKey = `${sw.id}:${vlanId}`;
    if (visited.has(visitKey)) {
      continue;
    }
    visited.add(visitKey);

    // 送信元 MAC を学習
    updatedState = upsertMacEntry(
      updatedState,
      sw.id,
      vlanId,
      sourceMac,
      current.ingressPort,
    );

    // 同一スイッチ内の他ポートへフラッディング / 転送
    for (const outPort of Object.values(sw.interfaces)) {
      if (outPort.name === current.ingressPort) {
        continue;
      }
      if (!isPhysicalInterfaceUp(updatedState, sw.id, outPort.name)) {
        continue;
      }

      const outMode = outPort.switchportMode ?? "access";
      if (outMode === "access") {
        const portVlan = outPort.accessVlan ?? 1;
        if (portVlan !== vlanId) {
          continue;
        }
      } else {
        if (
          outPort.trunkAllowedVlans !== undefined &&
          !outPort.trunkAllowedVlans.includes(vlanId)
        ) {
          recordedVlanBlock ??= {
            deviceId: sw.id,
            port: outPort.name,
            message: `${sw.hostname} ${outPort.name} のトランクで VLAN ${vlanId} が許可されていません。`,
            trail: current.trail,
          };
          continue;
        }
      }

      const outConn = findConnectedLink(updatedState, sw.id, outPort.name);
      if (!outConn) {
        continue;
      }
      const peer = updatedState.devices[outConn.peerDeviceId];
      if (!peer) {
        continue;
      }

      const hopItem: L2SwitchTrailItem = {
        switchId: sw.id,
        hostname: sw.hostname,
        ingressPort: current.ingressPort,
        egressPort: outPort.name,
        vlanId,
        sourceMac,
      };
      const nextTrail = [...current.trail, hopItem];

      const outgoingTag = outMode === "trunk" ? vlanId : undefined;

      if (peer.type === "switch") {
        queue.push({
          switchId: peer.id,
          ingressPort: outConn.peerInterface,
          incomingTag: outgoingTag,
          trail: nextTrail,
        });
        continue;
      }

      const matched = findPhysicalInterfaceOnDevice(
        peer,
        outConn.peerInterface,
        outgoingTag,
        nextHopIp,
      );
      if (matched) {
        // 到達成功：宛先MAC学習 & 双方ARP学習
        updatedState = upsertMacEntry(
          updatedState,
          sw.id,
          vlanId,
          matched.mac,
          outPort.name,
        );
        updatedState = upsertArpEntry(
          updatedState,
          senderId,
          nextHopIp,
          matched.mac,
          egressInterfaceName,
        );
        if (egressIface.ip) {
          updatedState = upsertArpEntry(
            updatedState,
            peer.id,
            egressIface.ip,
            sourceMac,
            matched.name,
          );
        }

        return {
          ok: true,
          receiverDevice: updatedState.devices[peer.id],
          receiverInterface: matched,
          switchHops: nextTrail,
          nextState: updatedState,
        };
      }
    }
  }

  // L2 転送失敗時の原因切り分け
  if (recordedVlanBlock) {
    return {
      ok: false,
      failureReason: "VLAN Mismatch",
      failureDeviceId: recordedVlanBlock.deviceId,
      failureInterface: recordedVlanBlock.port,
      failureLayer: "L2",
      failureMessage: recordedVlanBlock.message,
      switchHops: recordedVlanBlock.trail,
      nextState: updatedState,
    };
  }

  const physicalDiscovery = findDeviceInPhysicalL2Fabric(
    updatedState,
    senderId,
    physEgressName,
    nextHopIp,
  );
  if (physicalDiscovery) {
    if (physicalDiscovery.isLinkDown) {
      return {
        ok: false,
        failureReason: "Link Down",
        failureDeviceId: physicalDiscovery.foundDeviceId,
        failureInterface: physicalDiscovery.foundInterfaceName,
        failureLayer: "L1",
        failureMessage: `宛先 (${nextHopIp}) のリンクがダウンしているため到達できません。`,
        switchHops: [],
        nextState: updatedState,
      };
    }

    const swId = physicalDiscovery.blockingSwitchId ?? firstPeer.id;
    const swHost = updatedState.devices[swId]?.hostname ?? swId;
    return {
      ok: false,
      failureReason: "VLAN Mismatch",
      failureDeviceId: swId,
      failureInterface: physicalDiscovery.blockingSwitchPort,
      failureLayer: "L2",
      failureMessage: `${swHost} で送信元と宛先 (${nextHopIp}) のVLANが一致しないため通信が遮断されました。`,
      switchHops: [],
      nextState: updatedState,
    };
  }

  return {
    ok: false,
    failureReason: "ARP Timeout",
    failureDeviceId: senderId,
    failureInterface: egressInterfaceName,
    failureLayer: "L2",
    failureMessage: `${nextHopIp} からの ARP 応答がありません（ARP Timeout）。`,
    switchHops: [],
    nextState: updatedState,
  };
}

interface L3TraceResult {
  success: boolean;
  hops: PacketHop[];
  nextState: NetworkState;
  sourceIp?: string;
  destinationDeviceId?: string;
  failureReason?: PacketFailureReason;
  failureDeviceId?: string;
  failureMessage?: string;
}

function findOwnInterfaceByIp(
  device: NetworkDevice,
  targetIp: string,
): NetworkInterface | null {
  return (
    Object.values(device.interfaces).find((iface) => iface.ip === targetIp) ??
    null
  );
}

function getHostPrimaryIpInterface(
  state: NetworkState,
  device: NetworkDevice,
): NetworkInterface | null {
  const ifaces = Object.values(device.interfaces).filter(
    (iface) => iface.ip && iface.subnetMask,
  );
  if (ifaces.length === 0) {
    return null;
  }
  const opUp = ifaces.find((iface) =>
    isInterfaceOperationalUp(state, device.id, iface.name),
  );
  return opUp ?? ifaces[0];
}

function resolveRouterNextHop(
  state: NetworkState,
  router: NetworkDevice,
  routes: EffectiveRouteEntry[],
  targetIp: string,
):
  | {
      ok: true;
      egressInterface: NetworkInterface;
      nextHopIp: string;
    }
  | {
      ok: false;
      reason: PacketFailureReason;
      message: string;
    } {
  let lookupIp = targetIp;
  const visitedStatic = new Set<string>();

  for (let depth = 0; depth < 8; depth += 1) {
    const best = longestPrefixMatch(lookupIp, routes);
    if (!best) {
      // インターフェースが shutdown / リンクダウン / dot1Q未設定のために直結ルートが落ちているか確認
      for (const iface of Object.values(router.interfaces)) {
        if (!iface.ip || !iface.subnetMask) {
          continue;
        }
        try {
          if (isSameSubnet(iface.ip, lookupIp, iface.subnetMask)) {
            if (iface.isSubinterface && iface.dot1qVlan === undefined && iface.adminUp) {
              return {
                ok: false,
                reason: "VLAN Mismatch",
                message: `${router.hostname} ${iface.name} に encapsulation dot1Q が未設定のため送信できません。`,
              };
            }
            return {
              ok: false,
              reason: "Link Down",
              message: `${router.hostname} ${iface.name} がダウンしているため ${lookupIp} へ送信できません。`,
            };
          }
        } catch {
          continue;
        }
      }

      return {
        ok: false,
        reason: "No Route to Host",
        message: `${router.hostname} のルーティングテーブルに ${targetIp} へのルートがありません。`,
      };
    }

    if (best.type === "connected" && best.interfaceName) {
      const egress = router.interfaces[best.interfaceName];
      if (!egress) {
        return {
          ok: false,
          reason: "Link Down",
          message: `${router.hostname} の送出インターフェース ${best.interfaceName} が見つかりません。`,
        };
      }
      return {
        ok: true,
        egressInterface: egress,
        nextHopIp: depth === 0 ? targetIp : lookupIp,
      };
    }

    if (best.nextHop) {
      if (visitedStatic.has(best.nextHop)) {
        return {
          ok: false,
          reason: "No Route to Host",
          message: `${router.hostname} でネクストホップ ${best.nextHop} の解決が循環しています。`,
        };
      }
      visitedStatic.add(best.nextHop);

      // ネクストホップ自身が自分のIPである誤設定を検知
      if (findOwnInterfaceByIp(router, best.nextHop)) {
        return {
          ok: false,
          reason: "No Route to Host",
          message: `${router.hostname} のネクストホップ ${best.nextHop} が自ルータ宛てになっています。`,
        };
      }
      lookupIp = best.nextHop;
      continue;
    }

    return {
      ok: false,
      reason: "No Route to Host",
      message: `${router.hostname} に有効なネクストホップがありません。`,
    };
  }

  return {
    ok: false,
    reason: "No Route to Host",
    message: `${router.hostname} でネクストホップを再帰解決できませんでした。`,
  };
}

function appendSwitchHops(
  hops: PacketHop[],
  switchHops: L2SwitchTrailItem[],
  direction: PacketDirection,
  ttl: number,
  stepStart: number,
): number {
  let step = stepStart;
  for (const sw of switchHops) {
    hops.push({
      step,
      deviceId: sw.switchId,
      hostname: sw.hostname,
      incomingInterface: sw.ingressPort,
      outgoingInterface: sw.egressPort,
      vlanTag: sw.vlanId,
      ttl,
      direction,
      layer: "L2",
      action: `L2転送 (VLAN ${sw.vlanId}, MAC学習: ${sw.sourceMac})`,
      status: "ok",
    });
    step += 1;
  }
  return step;
}

function traceL3Path(
  state: NetworkState,
  sourceDeviceId: string,
  targetIp: string,
  options?: {
    direction?: PacketDirection;
    initialTtl?: number;
    stepOffset?: number;
  },
): L3TraceResult {
  const direction: PacketDirection = options?.direction ?? "request";
  const initialTtl = options?.initialTtl ?? 16;
  let step = (options?.stepOffset ?? 0) + 1;
  let currentState = state;
  const hops: PacketHop[] = [];

  const sourceDevice = currentState.devices[sourceDeviceId];
  if (!sourceDevice) {
    return {
      success: false,
      hops,
      nextState: currentState,
      failureReason: "Invalid Destination",
      failureDeviceId: sourceDeviceId,
      failureMessage: `デバイス "${sourceDeviceId}" が見つかりません。`,
    };
  }

  if (!isValidIpv4(targetIp)) {
    return {
      success: false,
      hops: [
        {
          step,
          deviceId: sourceDevice.id,
          hostname: sourceDevice.hostname,
          direction,
          layer: "L3",
          action: `不正な宛先IP: ${targetIp}`,
          status: "error",
          errorReason: "Invalid Destination",
        },
      ],
      nextState: currentState,
      failureReason: "Invalid Destination",
      failureDeviceId: sourceDevice.id,
      failureMessage: `不正な宛先アドレスです: ${targetIp}`,
    };
  }

  // 自機器宛てチェック
  const ownTargetIface = findOwnInterfaceByIp(sourceDevice, targetIp);
  if (ownTargetIface) {
    if (!ownTargetIface.adminUp) {
      hops.push({
        step,
        deviceId: sourceDevice.id,
        hostname: sourceDevice.hostname,
        outgoingInterface: ownTargetIface.name,
        direction,
        layer: "L1",
        action: `${ownTargetIface.name} は shutdown 状態です`,
        status: "error",
        errorReason: "Link Down",
      });
      return {
        success: false,
        hops,
        nextState: currentState,
        sourceIp: ownTargetIface.ip,
        failureReason: "Link Down",
        failureDeviceId: sourceDevice.id,
        failureMessage: `${sourceDevice.hostname} ${ownTargetIface.name} がダウンしています。`,
      };
    }

    hops.push({
      step,
      deviceId: sourceDevice.id,
      hostname: sourceDevice.hostname,
      outgoingInterface: ownTargetIface.name,
      ttl: initialTtl,
      direction,
      layer: "L3",
      action: `ローカル宛先 ${targetIp} に到達`,
      status: "ok",
    });
    return {
      success: true,
      hops,
      nextState: currentState,
      sourceIp: targetIp,
      destinationDeviceId: sourceDevice.id,
    };
  }

  let currentDevice = sourceDevice;
  let egressIfaceName: string;
  let nextHopIp: string;
  let sourceIp: string;

  if (sourceDevice.type === "router") {
    const routes = getRouterRoutingTable(currentState, sourceDevice);
    const resolved = resolveRouterNextHop(
      currentState,
      sourceDevice,
      routes,
      targetIp,
    );
    if (!resolved.ok) {
      hops.push({
        step,
        deviceId: sourceDevice.id,
        hostname: sourceDevice.hostname,
        ttl: initialTtl,
        direction,
        layer: "L3",
        action: resolved.message,
        status: "error",
        errorReason: resolved.reason,
      });
      return {
        success: false,
        hops,
        nextState: currentState,
        failureReason: resolved.reason,
        failureDeviceId: sourceDevice.id,
        failureMessage: resolved.message,
      };
    }
    egressIfaceName = resolved.egressInterface.name;
    nextHopIp = resolved.nextHopIp;
    sourceIp = resolved.egressInterface.ip ?? targetIp;
  } else {
    const primary = getHostPrimaryIpInterface(currentState, sourceDevice);
    if (!primary || !primary.ip || !primary.subnetMask) {
      const msg = `${sourceDevice.hostname} にIPアドレスが設定されていません。`;
      hops.push({
        step,
        deviceId: sourceDevice.id,
        hostname: sourceDevice.hostname,
        direction,
        layer: "L3",
        action: msg,
        status: "error",
        errorReason: "No IP Configured",
      });
      return {
        success: false,
        hops,
        nextState: currentState,
        failureReason: "No IP Configured",
        failureDeviceId: sourceDevice.id,
        failureMessage: msg,
      };
    }

    sourceIp = primary.ip;
    if (!isInterfaceOperationalUp(currentState, sourceDevice.id, primary.name)) {
      const msg = `${sourceDevice.hostname} ${primary.name} のリンクがダウンしています。`;
      hops.push({
        step,
        deviceId: sourceDevice.id,
        hostname: sourceDevice.hostname,
        outgoingInterface: primary.name,
        direction,
        layer: "L1",
        action: msg,
        status: "error",
        errorReason: "Link Down",
      });
      return {
        success: false,
        hops,
        nextState: currentState,
        sourceIp,
        failureReason: "Link Down",
        failureDeviceId: sourceDevice.id,
        failureMessage: msg,
      };
    }

    egressIfaceName = primary.name;
    if (isSameSubnet(primary.ip, targetIp, primary.subnetMask)) {
      nextHopIp = targetIp;
    } else {
      if (!sourceDevice.defaultGateway || !isValidIpv4(sourceDevice.defaultGateway)) {
        const msg = `${sourceDevice.hostname} にデフォルトゲートウェイが設定されていません。`;
        hops.push({
          step,
          deviceId: sourceDevice.id,
          hostname: sourceDevice.hostname,
          outgoingInterface: primary.name,
          ttl: initialTtl,
          direction,
          layer: "L3",
          action: msg,
          status: "error",
          errorReason: "No Route to Host",
        });
        return {
          success: false,
          hops,
          nextState: currentState,
          sourceIp,
          failureReason: "No Route to Host",
          failureDeviceId: sourceDevice.id,
          failureMessage: msg,
        };
      }

      if (!isSameSubnet(primary.ip, sourceDevice.defaultGateway, primary.subnetMask)) {
        const msg = `${sourceDevice.hostname} のデフォルトゲートウェイ (${sourceDevice.defaultGateway}) が同一サブネット内にありません。`;
        hops.push({
          step,
          deviceId: sourceDevice.id,
          hostname: sourceDevice.hostname,
          outgoingInterface: primary.name,
          ttl: initialTtl,
          direction,
          layer: "L3",
          action: msg,
          status: "error",
          errorReason: "No Route to Host",
        });
        return {
          success: false,
          hops,
          nextState: currentState,
          sourceIp,
          failureReason: "No Route to Host",
          failureDeviceId: sourceDevice.id,
          failureMessage: msg,
        };
      }

      nextHopIp = sourceDevice.defaultGateway;
    }
  }

  let ttl = initialTtl;
  hops.push({
    step,
    deviceId: currentDevice.id,
    hostname: currentDevice.hostname,
    outgoingInterface: egressIfaceName,
    ttl,
    direction,
    layer: "L3",
    action: `${sourceIp} → ${targetIp} へ送信開始 (Next-Hop: ${nextHopIp})`,
    status: "ok",
  });
  step += 1;

  while (ttl > 0) {
    const l2Result = deliverL2Frame(
      currentState,
      currentDevice.id,
      egressIfaceName,
      nextHopIp,
    );
    currentState = l2Result.nextState;

    if (!l2Result.ok) {
      step = appendSwitchHops(hops, l2Result.switchHops, direction, ttl, step);
      hops.push({
        step,
        deviceId: l2Result.failureDeviceId,
        hostname:
          currentState.devices[l2Result.failureDeviceId]?.hostname ??
          l2Result.failureDeviceId,
        incomingInterface: l2Result.failureInterface,
        ttl,
        direction,
        layer: l2Result.failureLayer,
        action: l2Result.failureMessage,
        status: "error",
        errorReason: l2Result.failureReason,
      });
      return {
        success: false,
        hops,
        nextState: currentState,
        sourceIp,
        failureReason: l2Result.failureReason,
        failureDeviceId: l2Result.failureDeviceId,
        failureMessage: l2Result.failureMessage,
      };
    }

    step = appendSwitchHops(hops, l2Result.switchHops, direction, ttl, step);
    const receiver = l2Result.receiverDevice;
    const receiverIface = l2Result.receiverInterface;

    // 宛先IPに到達したか確認
    const matchedTarget =
      receiver.type === "router"
        ? Object.values(receiver.interfaces).find(
            (iface) => iface.ip === targetIp && iface.adminUp,
          )
        : receiverIface.ip === targetIp
          ? receiverIface
          : undefined;

    if (matchedTarget) {
      hops.push({
        step,
        deviceId: receiver.id,
        hostname: receiver.hostname,
        incomingInterface: receiverIface.name,
        vlanTag: receiverIface.dot1qVlan,
        ttl,
        direction,
        layer: "L3",
        action: `${receiver.hostname} (${targetIp}) が受信`,
        status: "ok",
      });
      return {
        success: true,
        hops,
        nextState: currentState,
        sourceIp,
        destinationDeviceId: receiver.id,
      };
    }

    // 中継ルータでのL3フォワーディング
    if (receiver.type !== "router") {
      const msg = `${receiver.hostname} はルータではないため ${targetIp} へ転送できません。`;
      hops.push({
        step,
        deviceId: receiver.id,
        hostname: receiver.hostname,
        incomingInterface: receiverIface.name,
        ttl,
        direction,
        layer: "L3",
        action: msg,
        status: "error",
        errorReason: "No Route to Host",
      });
      return {
        success: false,
        hops,
        nextState: currentState,
        sourceIp,
        failureReason: "No Route to Host",
        failureDeviceId: receiver.id,
        failureMessage: msg,
      };
    }

    ttl -= 1;
    if (ttl <= 0) {
      const msg = `${receiver.hostname} で TTL が 0 になりました（ルーティングループの可能性）。`;
      hops.push({
        step,
        deviceId: receiver.id,
        hostname: receiver.hostname,
        incomingInterface: receiverIface.name,
        ttl: 0,
        direction,
        layer: "L3",
        action: msg,
        status: "error",
        errorReason: "TTL Exceeded",
      });
      return {
        success: false,
        hops,
        nextState: currentState,
        sourceIp,
        failureReason: "TTL Exceeded",
        failureDeviceId: receiver.id,
        failureMessage: msg,
      };
    }

    const routes = getRouterRoutingTable(currentState, receiver);
    const nextResolved = resolveRouterNextHop(
      currentState,
      receiver,
      routes,
      targetIp,
    );
    if (!nextResolved.ok) {
      hops.push({
        step,
        deviceId: receiver.id,
        hostname: receiver.hostname,
        incomingInterface: receiverIface.name,
        ttl,
        direction,
        layer: "L3",
        action: nextResolved.message,
        status: "error",
        errorReason: nextResolved.reason,
      });
      return {
        success: false,
        hops,
        nextState: currentState,
        sourceIp,
        failureReason: nextResolved.reason,
        failureDeviceId: receiver.id,
        failureMessage: nextResolved.message,
      };
    }

    hops.push({
      step,
      deviceId: receiver.id,
      hostname: receiver.hostname,
      incomingInterface: receiverIface.name,
      outgoingInterface: nextResolved.egressInterface.name,
      vlanTag: nextResolved.egressInterface.dot1qVlan,
      ttl,
      direction,
      layer: "L3",
      action: `LPM経路選択 → ${nextResolved.egressInterface.name} (Next-Hop: ${nextResolved.nextHopIp}, TTL=${ttl})`,
      status: "ok",
    });
    step += 1;

    currentDevice = receiver;
    egressIfaceName = nextResolved.egressInterface.name;
    nextHopIp = nextResolved.nextHopIp;
  }

  return {
    success: false,
    hops,
    nextState: currentState,
    sourceIp,
    failureReason: "TTL Exceeded",
    failureDeviceId: currentDevice.id,
    failureMessage: "TTL Exceeded",
  };
}

function lookupDnsRecord(
  dnsRecords: Record<string, string>,
  hostname: string,
): string | undefined {
  const normalized = hostname.trim().replace(/\.$/, "").toLowerCase();
  for (const [key, ip] of Object.entries(dnsRecords)) {
    if (key.trim().replace(/\.$/, "").toLowerCase() === normalized) {
      return ip;
    }
  }
  return undefined;
}

export function simulateNslookup(
  state: NetworkState,
  deviceId: string,
  hostname: string,
): SimulationOutput {
  const device = state.devices[deviceId];
  const cleanHost = hostname.trim();

  if (!device) {
    const trace: PacketTraceResult = {
      protocol: "dns",
      sourceDeviceId: deviceId,
      targetInput: cleanHost,
      success: false,
      failureReason: "DNS Server Unreachable",
      failureMessage: `デバイス "${deviceId}" が見つかりません。`,
      hops: [],
    };
    return { trace, nextState: state, output: trace.failureMessage ?? "" };
  }

  if (!cleanHost) {
    const trace: PacketTraceResult = {
      protocol: "dns",
      sourceDeviceId: deviceId,
      targetInput: cleanHost,
      success: false,
      failureReason: "Invalid Destination",
      failureDeviceId: deviceId,
      failureMessage: "ホスト名を指定してください。",
      hops: [],
    };
    return {
      trace,
      nextState: state,
      output: "% ホスト名を指定してください。",
    };
  }

  if (!device.dnsServer || !isValidIpv4(device.dnsServer)) {
    const msg =
      "DNSサーバが設定されていないため名前解決できません (DNS Server Unreachable)。";
    const trace: PacketTraceResult = {
      protocol: "dns",
      sourceDeviceId: device.id,
      targetInput: cleanHost,
      success: false,
      failureReason: "DNS Server Unreachable",
      failureDeviceId: device.id,
      failureMessage: msg,
      hops: [
        {
          step: 1,
          deviceId: device.id,
          hostname: device.hostname,
          direction: "dns-query",
          layer: "L7",
          action: msg,
          status: "error",
          errorReason: "DNS Server Unreachable",
        },
      ],
    };
    return {
      trace,
      nextState: state,
      output: [
        "Server:  UnKnown",
        "Address:  0.0.0.0",
        "",
        `*** DNS server is not configured (DNS Server Unreachable): ${cleanHost}`,
      ].join("\n"),
    };
  }

  const dnsServerIp = device.dnsServer;
  const queryTrace = traceL3Path(state, device.id, dnsServerIp, {
    direction: "dns-query",
  });

  if (!queryTrace.success || !queryTrace.destinationDeviceId) {
    const msg = `DNSサーバ (${dnsServerIp}) に到達できません: ${queryTrace.failureMessage ?? queryTrace.failureReason ?? ""}`;
    const trace: PacketTraceResult = {
      protocol: "dns",
      sourceDeviceId: device.id,
      sourceIp: queryTrace.sourceIp,
      targetInput: cleanHost,
      dnsServerIp,
      success: false,
      failureReason: "DNS Server Unreachable",
      failureDeviceId: queryTrace.failureDeviceId ?? device.id,
      failureMessage: msg,
      hops: queryTrace.hops,
    };
    return {
      trace,
      nextState: queryTrace.nextState,
      output: [
        "DNS request timed out.",
        `Server:  ${dnsServerIp}`,
        `Address:  ${dnsServerIp}`,
        "",
        `*** DNS Server Unreachable (${queryTrace.failureReason ?? "Timeout"}): ${queryTrace.failureMessage ?? ""}`,
      ].join("\n"),
    };
  }

  const dnsServerDevice =
    queryTrace.nextState.devices[queryTrace.destinationDeviceId];
  if (!dnsServerDevice || !dnsServerDevice.dnsRecords) {
    const msg = `${dnsServerIp} はDNSサービスを提供していません (DNS Server Unreachable)。`;
    const hops: PacketHop[] = [
      ...queryTrace.hops,
      {
        step: queryTrace.hops.length + 1,
        deviceId: dnsServerDevice?.id ?? queryTrace.destinationDeviceId,
        hostname: dnsServerDevice?.hostname ?? dnsServerIp,
        direction: "dns-query",
        layer: "L7",
        action: msg,
        status: "error",
        errorReason: "DNS Server Unreachable",
      },
    ];
    const trace: PacketTraceResult = {
      protocol: "dns",
      sourceDeviceId: device.id,
      sourceIp: queryTrace.sourceIp,
      targetInput: cleanHost,
      dnsServerIp,
      success: false,
      failureReason: "DNS Server Unreachable",
      failureDeviceId: dnsServerDevice?.id ?? queryTrace.destinationDeviceId,
      failureMessage: msg,
      hops,
    };
    return {
      trace,
      nextState: queryTrace.nextState,
      output: [
        `Server:  ${dnsServerDevice?.hostname ?? dnsServerIp}`,
        `Address:  ${dnsServerIp}`,
        "",
        `*** No response from DNS server (${dnsServerIp}): DNS Server Unreachable`,
      ].join("\n"),
    };
  }

  const resolvedIp = lookupDnsRecord(dnsServerDevice.dnsRecords, cleanHost);

  // DNS 応答の復路検証
  let currentState = queryTrace.nextState;
  const combinedHops = [...queryTrace.hops];
  if (queryTrace.sourceIp) {
    const replyTrace = traceL3Path(
      currentState,
      dnsServerDevice.id,
      queryTrace.sourceIp,
      {
        direction: "dns-response",
        stepOffset: combinedHops.length,
      },
    );
    currentState = replyTrace.nextState;
    combinedHops.push(...replyTrace.hops);

    if (!replyTrace.success) {
      const msg = `DNS応答が送信元へ戻れません: ${replyTrace.failureMessage ?? ""}`;
      const trace: PacketTraceResult = {
        protocol: "dns",
        sourceDeviceId: device.id,
        sourceIp: queryTrace.sourceIp,
        targetInput: cleanHost,
        dnsServerIp,
        success: false,
        failureReason: "DNS Server Unreachable",
        failureDeviceId: replyTrace.failureDeviceId,
        failureMessage: msg,
        hops: combinedHops,
      };
      return {
        trace,
        nextState: currentState,
        output: [
          "DNS request timed out.",
          `Server:  ${dnsServerIp}`,
          "",
          `*** DNS Server Unreachable (復路エラー: ${replyTrace.failureReason ?? ""})`,
        ].join("\n"),
      };
    }
  }

  if (!resolvedIp) {
    const msg = `ホスト名 "${cleanHost}" のAレコードが見つかりません (NXDOMAIN)。`;
    combinedHops.push({
      step: combinedHops.length + 1,
      deviceId: dnsServerDevice.id,
      hostname: dnsServerDevice.hostname,
      direction: "dns-response",
      layer: "L7",
      action: msg,
      status: "error",
      errorReason: "NXDOMAIN",
    });
    const trace: PacketTraceResult = {
      protocol: "dns",
      sourceDeviceId: device.id,
      sourceIp: queryTrace.sourceIp,
      targetInput: cleanHost,
      dnsServerIp,
      success: false,
      failureReason: "NXDOMAIN",
      failureDeviceId: dnsServerDevice.id,
      failureMessage: msg,
      hops: combinedHops,
    };
    return {
      trace,
      nextState: currentState,
      output: [
        `Server:  ${dnsServerDevice.hostname}`,
        `Address:  ${dnsServerIp}`,
        "",
        `*** ${dnsServerDevice.hostname} can't find ${cleanHost}: Non-existent domain (NXDOMAIN)`,
      ].join("\n"),
    };
  }

  const trace: PacketTraceResult = {
    protocol: "dns",
    sourceDeviceId: device.id,
    sourceIp: queryTrace.sourceIp,
    targetInput: cleanHost,
    resolvedIp,
    dnsServerIp,
    success: true,
    hops: combinedHops,
  };

  return {
    trace,
    nextState: currentState,
    output: [
      `Server:  ${dnsServerDevice.hostname}`,
      `Address:  ${dnsServerIp}`,
      "",
      `Name:    ${cleanHost}`,
      `Address:  ${resolvedIp}`,
    ].join("\n"),
  };
}

function formatPingOutput(
  device: NetworkDevice,
  trace: PacketTraceResult,
): string {
  const isIos = device.type === "router" || device.type === "switch";
  const targetLabel = trace.resolvedIp
    ? `${trace.targetInput} [${trace.resolvedIp}]`
    : trace.targetInput;

  if (isIos) {
    const header = `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${trace.resolvedIp ?? trace.targetInput}, timeout is 2 seconds:`;
    if (trace.success) {
      return [
        header,
        "!!!!!",
        "Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms",
      ].join("\n");
    }
    return [
      header,
      ".....",
      `Success rate is 0 percent (0/5)  [${trace.failureReason}: ${trace.failureMessage ?? ""}]`,
    ].join("\n");
  }

  const header = `Pinging ${targetLabel} with 32 bytes of data:`;
  if (trace.success) {
    const ip = trace.resolvedIp ?? trace.targetInput;
    return [
      header,
      `Reply from ${ip}: bytes=32 time=2ms TTL=64`,
      `Reply from ${ip}: bytes=32 time=1ms TTL=64`,
      `Reply from ${ip}: bytes=32 time=2ms TTL=64`,
      `Reply from ${ip}: bytes=32 time=1ms TTL=64`,
      "",
      `Ping statistics for ${ip}:`,
      "    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)",
    ].join("\n");
  }

  return [
    header,
    `Request failed: ${trace.failureReason} (${trace.failureMessage ?? ""})`,
    "",
    `Ping statistics for ${trace.resolvedIp ?? trace.targetInput}:`,
    "    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)",
  ].join("\n");
}

export function simulatePing(
  state: NetworkState,
  deviceId: string,
  target: string,
): SimulationOutput {
  const device = state.devices[deviceId];
  const cleanTarget = target.trim();

  if (!device) {
    const trace: PacketTraceResult = {
      protocol: "icmp",
      sourceDeviceId: deviceId,
      targetInput: cleanTarget,
      success: false,
      failureReason: "Invalid Destination",
      failureMessage: `デバイス "${deviceId}" が見つかりません。`,
      hops: [],
    };
    return { trace, nextState: state, output: trace.failureMessage ?? "" };
  }

  let currentState = state;
  const allHops: PacketHop[] = [];
  let resolvedIp = cleanTarget;
  let dnsServerIp: string | undefined;

  if (!isValidIpv4(cleanTarget)) {
    const dnsOut = simulateNslookup(currentState, deviceId, cleanTarget);
    currentState = dnsOut.nextState;
    allHops.push(...dnsOut.trace.hops);
    dnsServerIp = dnsOut.trace.dnsServerIp;

    if (!dnsOut.trace.success || !dnsOut.trace.resolvedIp) {
      const trace: PacketTraceResult = {
        protocol: "icmp",
        sourceDeviceId: deviceId,
        sourceIp: dnsOut.trace.sourceIp,
        targetInput: cleanTarget,
        dnsServerIp,
        success: false,
        failureReason: dnsOut.trace.failureReason,
        failureDeviceId: dnsOut.trace.failureDeviceId,
        failureMessage: dnsOut.trace.failureMessage,
        hops: allHops,
      };
      return {
        trace,
        nextState: currentState,
        output: formatPingOutput(device, trace),
      };
    }

    resolvedIp = dnsOut.trace.resolvedIp;
  }

  const forwardTrace = traceL3Path(currentState, deviceId, resolvedIp, {
    direction: "request",
    stepOffset: allHops.length,
  });
  currentState = forwardTrace.nextState;
  allHops.push(...forwardTrace.hops);

  if (!forwardTrace.success || !forwardTrace.destinationDeviceId) {
    const trace: PacketTraceResult = {
      protocol: "icmp",
      sourceDeviceId: deviceId,
      sourceIp: forwardTrace.sourceIp,
      targetInput: cleanTarget,
      resolvedIp,
      dnsServerIp,
      success: false,
      failureReason: forwardTrace.failureReason,
      failureDeviceId: forwardTrace.failureDeviceId,
      failureMessage: forwardTrace.failureMessage,
      hops: allHops,
    };
    return {
      trace,
      nextState: currentState,
      output: formatPingOutput(device, trace),
    };
  }

  // 復路（ICMP Echo Reply）検証
  if (
    forwardTrace.destinationDeviceId !== deviceId &&
    forwardTrace.sourceIp
  ) {
    const returnTrace = traceL3Path(
      currentState,
      forwardTrace.destinationDeviceId,
      forwardTrace.sourceIp,
      {
        direction: "reply",
        stepOffset: allHops.length,
      },
    );
    currentState = returnTrace.nextState;
    allHops.push(...returnTrace.hops);

    if (!returnTrace.success) {
      const failureMsg = `復路 (ICMP Echo Reply) 失敗: ${returnTrace.failureMessage ?? returnTrace.failureReason ?? ""}`;
      const trace: PacketTraceResult = {
        protocol: "icmp",
        sourceDeviceId: deviceId,
        sourceIp: forwardTrace.sourceIp,
        targetInput: cleanTarget,
        resolvedIp,
        dnsServerIp,
        success: false,
        failureReason: returnTrace.failureReason,
        failureDeviceId: returnTrace.failureDeviceId,
        failureMessage: failureMsg,
        hops: allHops,
      };
      return {
        trace,
        nextState: currentState,
        output: formatPingOutput(device, trace),
      };
    }
  }

  const trace: PacketTraceResult = {
    protocol: "icmp",
    sourceDeviceId: deviceId,
    sourceIp: forwardTrace.sourceIp,
    targetInput: cleanTarget,
    resolvedIp,
    dnsServerIp,
    success: true,
    hops: allHops,
  };

  return {
    trace,
    nextState: currentState,
    output: formatPingOutput(device, trace),
  };
}

export function simulateTraceroute(
  state: NetworkState,
  deviceId: string,
  target: string,
): SimulationOutput {
  const device = state.devices[deviceId];
  const cleanTarget = target.trim();

  if (!device) {
    const trace: PacketTraceResult = {
      protocol: "traceroute",
      sourceDeviceId: deviceId,
      targetInput: cleanTarget,
      success: false,
      failureReason: "Invalid Destination",
      failureMessage: `デバイス "${deviceId}" が見つかりません。`,
      hops: [],
    };
    return { trace, nextState: state, output: trace.failureMessage ?? "" };
  }

  let currentState = state;
  const allHops: PacketHop[] = [];
  let resolvedIp = cleanTarget;
  let dnsServerIp: string | undefined;

  if (!isValidIpv4(cleanTarget)) {
    const dnsOut = simulateNslookup(currentState, deviceId, cleanTarget);
    currentState = dnsOut.nextState;
    allHops.push(...dnsOut.trace.hops);
    dnsServerIp = dnsOut.trace.dnsServerIp;

    if (!dnsOut.trace.success || !dnsOut.trace.resolvedIp) {
      const trace: PacketTraceResult = {
        protocol: "traceroute",
        sourceDeviceId: deviceId,
        sourceIp: dnsOut.trace.sourceIp,
        targetInput: cleanTarget,
        dnsServerIp,
        success: false,
        failureReason: dnsOut.trace.failureReason,
        failureDeviceId: dnsOut.trace.failureDeviceId,
        failureMessage: dnsOut.trace.failureMessage,
        hops: allHops,
      };
      return {
        trace,
        nextState: currentState,
        output: `Unable to resolve ${cleanTarget}: ${dnsOut.trace.failureReason} (${dnsOut.trace.failureMessage ?? ""})`,
      };
    }
    resolvedIp = dnsOut.trace.resolvedIp;
  }

  const forwardTrace = traceL3Path(currentState, deviceId, resolvedIp, {
    direction: "request",
    stepOffset: allHops.length,
  });
  currentState = forwardTrace.nextState;
  allHops.push(...forwardTrace.hops);

  const hopCandidates =
    forwardTrace.hops[0]?.action.includes("送信開始")
      ? forwardTrace.hops.slice(1)
      : forwardTrace.hops;
  const l3Hops = hopCandidates.filter((hop) => hop.layer === "L3");
  const lines = [`Tracing route to ${cleanTarget} [${resolvedIp}] over a maximum of 16 hops:`];

  let hopNumber = 1;
  for (const hop of l3Hops) {
    if (hop.status === "ok") {
      const dev = currentState.devices[hop.deviceId];
      const hopIp =
        (hop.incomingInterface &&
          dev?.interfaces[hop.incomingInterface]?.ip) ||
        resolvedIp;
      lines.push(`  ${hopNumber}    1 ms    2 ms    1 ms  ${hop.hostname} (${hopIp})`);
      hopNumber += 1;
    } else {
      lines.push(
        `  ${hopNumber}    *        *        *     ${hop.hostname}: ${hop.errorReason ?? "Request timed out"}`,
      );
      hopNumber += 1;
    }
  }

  if (l3Hops.length === 0) {
    const errHop = forwardTrace.hops.find((h) => h.status === "error");
    if (errHop) {
      lines.push(
        `  1    *        *        *     ${errHop.hostname}: ${errHop.errorReason ?? "Failed"}`,
      );
    }
  }

  if (forwardTrace.success) {
    lines.push("", "Trace complete.");
  } else {
    lines.push(
      "",
      `Trace stopped: ${forwardTrace.failureReason} (${forwardTrace.failureMessage ?? ""})`,
    );
  }

  const trace: PacketTraceResult = {
    protocol: "traceroute",
    sourceDeviceId: deviceId,
    sourceIp: forwardTrace.sourceIp,
    targetInput: cleanTarget,
    resolvedIp,
    dnsServerIp,
    success: forwardTrace.success,
    failureReason: forwardTrace.failureReason,
    failureDeviceId: forwardTrace.failureDeviceId,
    failureMessage: forwardTrace.failureMessage,
    hops: allHops,
  };

  return {
    trace,
    nextState: currentState,
    output: lines.join("\n"),
  };
}
