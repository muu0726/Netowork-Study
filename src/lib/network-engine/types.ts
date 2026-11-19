export type DeviceType = "router" | "switch" | "pc" | "server";

export type CliMode =
  | "user"
  | "privileged"
  | "config"
  | "config-if"
  | "config-subif"
  | "config-vlan"
  | "host";

export type SwitchportMode = "access" | "trunk";

export interface DeviceCliState {
  mode: CliMode;
  selectedInterface?: string;
  selectedVlanId?: number;
}

export interface NetworkInterface {
  name: string;
  mac: string;
  adminUp: boolean;
  ip?: string;
  subnetMask?: string;
  isSubinterface?: boolean;
  parentInterface?: string;
  dot1qVlan?: number;
  switchportMode?: SwitchportMode;
  accessVlan?: number;
  trunkAllowedVlans?: number[];
}

export interface VlanEntry {
  id: number;
  name: string;
  active: boolean;
}

export interface StaticRoute {
  destination: string;
  mask: string;
  prefixLength: number;
  nextHop: string;
  adminDistance: number;
}

export interface ArpEntry {
  ip: string;
  mac: string;
  interfaceName: string;
  type: "dynamic" | "static";
}

export interface MacTableEntry {
  vlan: number;
  mac: string;
  interfaceName: string;
  type: "dynamic" | "static";
}

export interface NetworkDevice {
  id: string;
  hostname: string;
  type: DeviceType;
  position: {
    x: number;
    y: number;
  };
  interfaces: Record<string, NetworkInterface>;
  vlans: Record<number, VlanEntry>;
  staticRoutes: StaticRoute[];
  arpTable: ArpEntry[];
  macTable: MacTableEntry[];
  defaultGateway?: string;
  dnsServer?: string;
  dnsRecords?: Record<string, string>;
  cliState: DeviceCliState;
}

export interface NetworkLink {
  id: string;
  fromDeviceId: string;
  fromInterface: string;
  toDeviceId: string;
  toInterface: string;
  up: boolean;
}

export interface NetworkState {
  devices: Record<string, NetworkDevice>;
  links: NetworkLink[];
}

export type PacketFailureReason =
  | "Link Down"
  | "VLAN Mismatch"
  | "No Route to Host"
  | "ARP Timeout"
  | "TTL Exceeded"
  | "DNS Server Unreachable"
  | "NXDOMAIN"
  | "No IP Configured"
  | "Invalid Destination";

export type PacketDirection =
  | "dns-query"
  | "dns-response"
  | "request"
  | "reply";

export interface PacketHop {
  step: number;
  deviceId: string;
  hostname: string;
  incomingInterface?: string;
  outgoingInterface?: string;
  vlanTag?: number;
  ttl?: number;
  direction: PacketDirection;
  layer: "L1" | "L2" | "L3" | "L7";
  action: string;
  status: "ok" | "error";
  errorReason?: PacketFailureReason;
}

export interface PacketTraceResult {
  protocol: "icmp" | "traceroute" | "dns";
  sourceDeviceId: string;
  sourceIp?: string;
  targetInput: string;
  resolvedIp?: string;
  dnsServerIp?: string;
  success: boolean;
  failureReason?: PacketFailureReason;
  failureDeviceId?: string;
  failureMessage?: string;
  hops: PacketHop[];
}

export interface SimulationOutput {
  trace: PacketTraceResult;
  nextState: NetworkState;
  output: string;
}

export interface CommandResult {
  nextState: NetworkState;
  output: string;
  prompt: string;
  trace?: PacketTraceResult;
}

export type ScenarioGoal =
  | {
      type: "ping";
      id: string;
      description: string;
      sourceDeviceId: string;
      target: string;
    }
  | {
      type: "nslookup";
      id: string;
      description: string;
      sourceDeviceId: string;
      hostname: string;
      expectedIp: string;
    }
  | {
      type: "vlan_membership";
      id: string;
      description: string;
      deviceId: string;
      interfaceName: string;
      expectedVlan: number;
      expectedMode?: SwitchportMode;
    }
  | {
      type: "route_exists";
      id: string;
      description: string;
      deviceId: string;
      destination: string;
      mask: string;
      nextHop?: string;
    }
  | {
      type: "route_absent";
      id: string;
      description: string;
      deviceId: string;
      destination: string;
      mask: string;
      nextHop?: string;
    }
  | {
      type: "interface_config";
      id: string;
      description: string;
      deviceId: string;
      interfaceName: string;
      expectedIp?: string;
      expectedMask?: string;
      expectedAdminUp?: boolean;
      expectedDot1qVlan?: number;
    }
  | {
      type: "dns_setting";
      id: string;
      description: string;
      deviceId: string;
      expectedDnsIp: string;
    };

export interface ScenarioSolution {
  deviceId: string;
  hostname: string;
  commands: string[];
}

export interface ScenarioDefinition {
  id: string;
  title: string;
  category: "lab" | "troubleshoot";
  difficulty: "初級" | "中級" | "実践";
  description: string;
  ticketSymptom?: string;
  initialState: NetworkState;
  goals: ScenarioGoal[];
  hints: [string, string, string];
  solutionCommands: ScenarioSolution[];
  solutionExplanation: string;
}

export interface GoalEvaluationResult {
  goalId: string;
  description: string;
  passed: boolean;
  detail: string;
}

export interface ScenarioEvaluationResult {
  scenarioId: string;
  passed: boolean;
  passedCount: number;
  totalCount: number;
  results: GoalEvaluationResult[];
}
