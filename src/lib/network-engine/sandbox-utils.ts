import type {
  DeviceType,
  NetworkDevice,
  NetworkInterface,
  NetworkLink,
  NetworkState,
} from "./types";

export interface SandboxPreset {
  id: string;
  label: string;
  description: string;
  state: NetworkState;
}

export const SANDBOX_PRESETS: SandboxPreset[] = [
  {
    id: "minimal-pc-router",
    label: "基本: PC + ルータ",
    description: "PC1 と R1 を接続した最小構成。IP設定やPing練習に最適。",
    state: {
      devices: {
        pc1: {
          id: "pc1",
          hostname: "PC1",
          type: "pc",
          position: { x: 170, y: 190 },
          interfaces: {
            eth0: {
              name: "eth0",
              mac: "00:11:22:10:00:01",
              adminUp: true,
              ip: "192.168.10.10",
              subnetMask: "255.255.255.0",
            },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          defaultGateway: "192.168.10.1",
          cliState: { mode: "host" },
        },
        r1: {
          id: "r1",
          hostname: "R1",
          type: "router",
          position: { x: 480, y: 190 },
          interfaces: {
            "Gig0/0": {
              name: "Gig0/0",
              mac: "00:0c:29:10:00:01",
              adminUp: true,
              ip: "192.168.10.1",
              subnetMask: "255.255.255.0",
            },
            "Gig0/1": {
              name: "Gig0/1",
              mac: "00:0c:29:10:00:02",
              adminUp: false,
            },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          cliState: { mode: "user" },
        },
      },
      links: [
        {
          id: "link-pc1-r1",
          fromDeviceId: "pc1",
          fromInterface: "eth0",
          toDeviceId: "r1",
          toInterface: "Gig0/0",
          up: true,
        },
      ],
    },
  },
  {
    id: "two-site-wan",
    label: "2拠点: PC1 - R1 - R2 - SRV1",
    description: "スタティックルートやOSPFの疎通実験に使える2拠点WAN構成。",
    state: {
      devices: {
        pc1: {
          id: "pc1",
          hostname: "PC1",
          type: "pc",
          position: { x: 90, y: 190 },
          interfaces: {
            eth0: {
              name: "eth0",
              mac: "00:11:22:20:00:01",
              adminUp: true,
              ip: "192.168.1.10",
              subnetMask: "255.255.255.0",
            },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          defaultGateway: "192.168.1.1",
          cliState: { mode: "host" },
        },
        r1: {
          id: "r1",
          hostname: "R1",
          type: "router",
          position: { x: 250, y: 190 },
          interfaces: {
            "Gig0/0": {
              name: "Gig0/0",
              mac: "00:0c:29:20:01:00",
              adminUp: true,
              ip: "192.168.1.1",
              subnetMask: "255.255.255.0",
            },
            "Gig0/1": {
              name: "Gig0/1",
              mac: "00:0c:29:20:01:01",
              adminUp: true,
              ip: "10.0.0.1",
              subnetMask: "255.255.255.252",
            },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          cliState: { mode: "user" },
        },
        r2: {
          id: "r2",
          hostname: "R2",
          type: "router",
          position: { x: 430, y: 190 },
          interfaces: {
            "Gig0/0": {
              name: "Gig0/0",
              mac: "00:0c:29:20:02:00",
              adminUp: true,
              ip: "10.0.0.2",
              subnetMask: "255.255.255.252",
            },
            "Gig0/1": {
              name: "Gig0/1",
              mac: "00:0c:29:20:02:01",
              adminUp: true,
              ip: "192.168.2.1",
              subnetMask: "255.255.255.0",
            },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          cliState: { mode: "user" },
        },
        srv1: {
          id: "srv1",
          hostname: "SRV1",
          type: "server",
          position: { x: 590, y: 190 },
          interfaces: {
            eth0: {
              name: "eth0",
              mac: "00:50:56:20:00:10",
              adminUp: true,
              ip: "192.168.2.10",
              subnetMask: "255.255.255.0",
            },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          defaultGateway: "192.168.2.1",
          cliState: { mode: "host" },
        },
      },
      links: [
        {
          id: "link-1",
          fromDeviceId: "pc1",
          fromInterface: "eth0",
          toDeviceId: "r1",
          toInterface: "Gig0/0",
          up: true,
        },
        {
          id: "link-2",
          fromDeviceId: "r1",
          fromInterface: "Gig0/1",
          toDeviceId: "r2",
          toInterface: "Gig0/0",
          up: true,
        },
        {
          id: "link-3",
          fromDeviceId: "r2",
          fromInterface: "Gig0/1",
          toDeviceId: "srv1",
          toInterface: "eth0",
          up: true,
        },
      ],
    },
  },
  {
    id: "vlan-switch-lan",
    label: "L2構成: PC1 & PC2 - SW1 - R1",
    description: "VLAN分割、トランク、Port Securityなどを試せるL2/L3構成。",
    state: {
      devices: {
        r1: {
          id: "r1",
          hostname: "R1",
          type: "router",
          position: { x: 340, y: 80 },
          interfaces: {
            "Gig0/0": {
              name: "Gig0/0",
              mac: "00:0c:29:30:01:00",
              adminUp: true,
              ip: "192.168.10.1",
              subnetMask: "255.255.255.0",
            },
            "Gig0/1": {
              name: "Gig0/1",
              mac: "00:0c:29:30:01:01",
              adminUp: false,
            },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          cliState: { mode: "user" },
        },
        sw1: {
          id: "sw1",
          hostname: "SW1",
          type: "switch",
          position: { x: 340, y: 190 },
          interfaces: {
            "Fa0/1": {
              name: "Fa0/1",
              mac: "00:aa:bb:30:00:01",
              adminUp: true,
              switchportMode: "access",
              accessVlan: 1,
            },
            "Fa0/2": {
              name: "Fa0/2",
              mac: "00:aa:bb:30:00:02",
              adminUp: true,
              switchportMode: "access",
              accessVlan: 1,
            },
            "Fa0/3": {
              name: "Fa0/3",
              mac: "00:aa:bb:30:00:03",
              adminUp: true,
              switchportMode: "access",
              accessVlan: 1,
            },
            "Fa0/4": {
              name: "Fa0/4",
              mac: "00:aa:bb:30:00:04",
              adminUp: true,
              switchportMode: "access",
              accessVlan: 1,
            },
          },
          vlans: {
            1: { id: 1, name: "default", active: true },
          },
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          cliState: { mode: "user" },
        },
        pc1: {
          id: "pc1",
          hostname: "PC1",
          type: "pc",
          position: { x: 170, y: 310 },
          interfaces: {
            eth0: {
              name: "eth0",
              mac: "00:11:22:30:00:01",
              adminUp: true,
              ip: "192.168.10.11",
              subnetMask: "255.255.255.0",
            },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          defaultGateway: "192.168.10.1",
          cliState: { mode: "host" },
        },
        pc2: {
          id: "pc2",
          hostname: "PC2",
          type: "pc",
          position: { x: 510, y: 310 },
          interfaces: {
            eth0: {
              name: "eth0",
              mac: "00:11:22:30:00:02",
              adminUp: true,
              ip: "192.168.10.12",
              subnetMask: "255.255.255.0",
            },
          },
          vlans: {},
          staticRoutes: [],
          arpTable: [],
          macTable: [],
          defaultGateway: "192.168.10.1",
          cliState: { mode: "host" },
        },
      },
      links: [
        {
          id: "link-r1-sw1",
          fromDeviceId: "r1",
          fromInterface: "Gig0/0",
          toDeviceId: "sw1",
          toInterface: "Fa0/1",
          up: true,
        },
        {
          id: "link-pc1-sw1",
          fromDeviceId: "pc1",
          fromInterface: "eth0",
          toDeviceId: "sw1",
          toInterface: "Fa0/2",
          up: true,
        },
        {
          id: "link-pc2-sw1",
          fromDeviceId: "pc2",
          fromInterface: "eth0",
          toDeviceId: "sw1",
          toInterface: "Fa0/3",
          up: true,
        },
      ],
    },
  },
];

const TYPE_PREFIX: Record<DeviceType, { id: string; host: string }> = {
  router: { id: "r", host: "R" },
  switch: { id: "sw", host: "SW" },
  pc: { id: "pc", host: "PC" },
  server: { id: "srv", host: "SRV" },
};

export function addSandboxDevice(
  state: NetworkState,
  type: DeviceType,
): { nextState: NetworkState; device: NetworkDevice } {
  const prefix = TYPE_PREFIX[type];
  let seq = 1;
  while (state.devices[`${prefix.id}${seq}`]) {
    seq += 1;
  }
  const id = `${prefix.id}${seq}`;
  const hostname = `${prefix.host}${seq}`;
  const count = Object.keys(state.devices).length;
  const col = count % 4;
  const row = Math.floor(count / 4) % 3;
  const x = 120 + col * 145;
  const y = 90 + row * 110;
  const hexSeq = seq.toString(16).padStart(2, "0");

  let interfaces: Record<string, NetworkInterface>;
  if (type === "router") {
    interfaces = {
      "Gig0/0": { name: "Gig0/0", mac: `00:0c:29:ff:${hexSeq}:00`, adminUp: true },
      "Gig0/1": { name: "Gig0/1", mac: `00:0c:29:ff:${hexSeq}:01`, adminUp: true },
      "Gig0/2": { name: "Gig0/2", mac: `00:0c:29:ff:${hexSeq}:02`, adminUp: true },
    };
  } else if (type === "switch") {
    interfaces = {
      "Fa0/1": { name: "Fa0/1", mac: `00:aa:bb:ff:${hexSeq}:01`, adminUp: true, switchportMode: "access", accessVlan: 1 },
      "Fa0/2": { name: "Fa0/2", mac: `00:aa:bb:ff:${hexSeq}:02`, adminUp: true, switchportMode: "access", accessVlan: 1 },
      "Fa0/3": { name: "Fa0/3", mac: `00:aa:bb:ff:${hexSeq}:03`, adminUp: true, switchportMode: "access", accessVlan: 1 },
      "Fa0/4": { name: "Fa0/4", mac: `00:aa:bb:ff:${hexSeq}:04`, adminUp: true, switchportMode: "access", accessVlan: 1 },
    };
  } else {
    interfaces = {
      eth0: { name: "eth0", mac: `00:11:22:ff:${hexSeq}:01`, adminUp: true },
    };
  }

  const device: NetworkDevice = {
    id,
    hostname,
    type,
    position: { x, y },
    interfaces,
    vlans: type === "switch" ? { 1: { id: 1, name: "default", active: true } } : {},
    staticRoutes: [],
    arpTable: [],
    macTable: [],
    cliState: { mode: type === "pc" || type === "server" ? "host" : "user" },
  };

  return {
    nextState: {
      ...state,
      devices: {
        ...state.devices,
        [id]: device,
      },
    },
    device,
  };
}

export function removeSandboxDevice(
  state: NetworkState,
  deviceId: string,
): NetworkState {
  if (!state.devices[deviceId]) {
    return state;
  }
  const restDevices = { ...state.devices };
  delete restDevices[deviceId];
  return {
    devices: restDevices,
    links: state.links.filter(
      (l) => l.fromDeviceId !== deviceId && l.toDeviceId !== deviceId,
    ),
  };
}

export function isInterfaceUsedInLinks(
  state: NetworkState,
  deviceId: string,
  interfaceName: string,
): boolean {
  return state.links.some(
    (l) =>
      (l.fromDeviceId === deviceId && l.fromInterface === interfaceName) ||
      (l.toDeviceId === deviceId && l.toInterface === interfaceName),
  );
}

export function connectSandboxLink(
  state: NetworkState,
  fromDeviceId: string,
  fromInterface: string,
  toDeviceId: string,
  toInterface: string,
): { ok: true; nextState: NetworkState } | { ok: false; error: string } {
  if (fromDeviceId === toDeviceId) {
    return { ok: false, error: "同一機器同士を直接リンク接続することはできません。" };
  }
  const fromDev = state.devices[fromDeviceId];
  const toDev = state.devices[toDeviceId];
  if (!fromDev || !toDev) {
    return { ok: false, error: "選択した機器が見つかりません。" };
  }
  if (!fromDev.interfaces[fromInterface] || !toDev.interfaces[toInterface]) {
    return { ok: false, error: "選択したインターフェースが存在しません。" };
  }
  if (
    isInterfaceUsedInLinks(state, fromDeviceId, fromInterface) ||
    isInterfaceUsedInLinks(state, toDeviceId, toInterface)
  ) {
    return { ok: false, error: "選択したポートはすでに別リンクへ接続されています。" };
  }

  let seq = state.links.length + 1;
  while (state.links.some((l) => l.id === `link-${seq}`)) {
    seq += 1;
  }

  const link: NetworkLink = {
    id: `link-${seq}`,
    fromDeviceId,
    fromInterface,
    toDeviceId,
    toInterface,
    up: true,
  };

  return {
    ok: true,
    nextState: {
      ...state,
      links: [...state.links, link],
    },
  };
}

export function disconnectSandboxLink(
  state: NetworkState,
  linkId: string,
): NetworkState {
  return {
    ...state,
    links: state.links.filter((l) => l.id !== linkId),
  };
}

export function toggleSandboxLinkUp(
  state: NetworkState,
  linkId: string,
): NetworkState {
  return {
    ...state,
    links: state.links.map((l) =>
      l.id === linkId ? { ...l, up: !l.up } : l,
    ),
  };
}

export function parseSandboxJson(
  raw: string,
): { ok: true; state: NetworkState } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "JSON構文が正しくありません。" };
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    return { ok: false, error: "トポロジJSONはオブジェクト形式である必要があります。" };
  }
  const obj = parsed as Record<string, unknown>;
  if (
    typeof obj.devices !== "object" ||
    obj.devices === null ||
    Array.isArray(obj.devices) ||
    !Array.isArray(obj.links)
  ) {
    return { ok: false, error: "devices オブジェクトと links 配列が必要です。" };
  }
  const devEntries = Object.entries(obj.devices as Record<string, unknown>);
  if (devEntries.length === 0) {
    return { ok: false, error: "1台以上の機器が必要です。" };
  }
  for (const [, d] of devEntries) {
    if (
      typeof d !== "object" ||
      d === null ||
      typeof (d as Record<string, unknown>).id !== "string" ||
      typeof (d as Record<string, unknown>).hostname !== "string" ||
      typeof (d as Record<string, unknown>).interfaces !== "object"
    ) {
      return { ok: false, error: "機器データの必須フィールドが不足しています。" };
    }
  }
  return { ok: true, state: parsed as NetworkState };
}

export function encodeSandboxStateToBase64Url(state: NetworkState): string {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSandboxStateFromBase64Url(
  encoded: string,
): { ok: true; state: NetworkState } | { ok: false; error: string } {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    const binary = atob(padded + "=".repeat(padLen));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    return parseSandboxJson(json);
  } catch {
    return { ok: false, error: "共有URLのトポロジデータが破損しています。" };
  }
}
