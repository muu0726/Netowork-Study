import type { NetworkInterface, NetworkLink, NetworkState } from "./types";

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
  if (!iface || !iface.adminUp || iface.portSecurity?.errDisabled) {
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
  return Boolean(peerIface && peerIface.adminUp && !peerIface.portSecurity?.errDisabled);
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
