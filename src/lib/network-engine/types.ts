export type DeviceType = "router" | "switch" | "pc" | "server";

export type CliMode =
  | "user"
  | "privileged"
  | "config"
  | "config-if"
  | "config-subif"
  | "config-vlan"
  | "config-std-nacl"
  | "config-ext-nacl"
  | "dhcp-config"
  | "config-router"
  | "host";

export type SwitchportMode = "access" | "trunk";

export type AclAction = "permit" | "deny";
export type AclProtocol = "ip" | "icmp" | "tcp" | "udp";
export type AclDirection = "in" | "out";

export interface AclRule {
  sequence: number;
  action: AclAction;
  protocol: AclProtocol;
  srcIp: string;
  srcWildcard: string;
  dstIp?: string;
  dstWildcard?: string;
  dstPort?: number;
  hitCount: number;
}

export interface AccessList {
  name: string;
  type: "standard" | "extended";
  rules: AclRule[];
  implicitDenyHits: number;
}

export type NatRole = "inside" | "outside";

export interface NatOverloadRule {
  aclName: string;
  outsideInterface: string;
  overload: boolean;
}

export interface NatTranslationEntry {
  protocol: "icmp" | "tcp" | "udp";
  insideLocalIp: string;
  insideLocalPort: number;
  insideGlobalIp: string;
  insideGlobalPort: number;
  outsideLocalIp: string;
  outsideLocalPort: number;
  outsideGlobalIp: string;
  outsideGlobalPort: number;
}

export interface DhcpExcludedRange {
  startIp: string;
  endIp: string;
}

export interface DhcpPool {
  name: string;
  network?: string;
  mask?: string;
  defaultRouter?: string;
  dnsServer?: string;
}

export interface DhcpBinding {
  ip: string;
  mac: string;
  poolName: string;
  hostname?: string;
  type: "Automatic";
}

export interface ListeningService {
  protocol: "tcp" | "udp";
  port: number;
  serviceName: string;
  active: boolean;
  processName?: string;
  unitName?: string;
}

export interface OspfNetworkStatement {
  network: string;
  wildcard: string;
  area: number;
}

export interface OspfConfig {
  processId: number;
  routerId?: string;
  networks: OspfNetworkStatement[];
}

export type HsrpRole = "Active" | "Standby" | "Listen" | "Init";

export interface HsrpGroupConfig {
  group: number;
  virtualIp?: string;
  priority: number;
  preempt: boolean;
  lastRole?: "Active" | "Standby";
}

export type StpPortRole = "Root" | "Desg" | "Altn";
export type StpPortState = "FWD" | "BLK";

export interface DeviceCliState {
  mode: CliMode;
  selectedInterface?: string;
  selectedVlanId?: number;
  selectedAclName?: string;
  selectedDhcpPool?: string;
  selectedOspfProcessId?: number;
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
  inboundAcl?: string;
  outboundAcl?: string;
  natRole?: NatRole;
  ospfCost?: number;
  hsrpGroups?: Record<number, HsrpGroupConfig>;
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
  acls?: Record<string, AccessList>;
  natRules?: NatOverloadRule[];
  natTranslations?: NatTranslationEntry[];
  dhcpPools?: Record<string, DhcpPool>;
  dhcpExcludedRanges?: DhcpExcludedRange[];
  dhcpBindings?: DhcpBinding[];
  listeningServices?: ListeningService[];
  ospf?: OspfConfig;
  stpPriorities?: Record<number, number>;
  stpBaseMac?: string;
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
  | "Invalid Destination"
  | "Connection Refused"
  | "DHCP Failed"
  | `Blocked by ACL (${string})`;

export type PacketDirection =
  | "dns-query"
  | "dns-response"
  | "request"
  | "reply";

export interface NatHopInfo {
  beforeIp: string;
  beforePort?: number;
  afterIp: string;
  afterPort?: number;
  direction: "inside-to-outside" | "outside-to-inside";
}

export interface PacketHop {
  step: number;
  deviceId: string;
  hostname: string;
  incomingInterface?: string;
  outgoingInterface?: string;
  vlanTag?: number;
  ttl?: number;
  direction: PacketDirection;
  layer: "L1" | "L2" | "L3" | "L4" | "L7";
  action: string;
  status: "ok" | "error";
  errorReason?: PacketFailureReason;
  natTranslation?: NatHopInfo;
}

export interface PacketTraceResult {
  protocol: "icmp" | "traceroute" | "dns" | "tcp" | "udp" | "http" | "dhcp";
  sourceDeviceId: string;
  sourceIp?: string;
  srcPort?: number;
  dstPort?: number;
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
    }
  | {
      type: "tcp_connect";
      id: string;
      description: string;
      sourceDeviceId: string;
      target: string;
      port: number;
      expectSuccess?: boolean;
    }
  | {
      type: "nat_translation";
      id: string;
      description: string;
      sourceDeviceId: string;
      target: string;
      port?: number;
      natRouterId: string;
      expectedGlobalIp: string;
    }
  | {
      type: "dhcp_lease";
      id: string;
      description: string;
      clientDeviceId: string;
      expectedNetwork: string;
      expectedMask: string;
      expectedGateway?: string;
      expectedDns?: string;
    }
  | {
      type: "acl_applied";
      id: string;
      description: string;
      deviceId: string;
      interfaceName: string;
      direction: AclDirection;
      aclName?: string;
    }
  | {
      type: "ospf_neighbor";
      id: string;
      description: string;
      deviceId: string;
      expectedNeighborDeviceId?: string;
      expectedNeighborRouterId?: string;
      minNeighbors?: number;
    }
  | {
      type: "ospf_route";
      id: string;
      description: string;
      deviceId: string;
      destination: string;
      mask: string;
      expectedNextHop?: string;
      expectedInterface?: string;
    }
  | {
      type: "stp_root";
      id: string;
      description: string;
      vlanId: number;
      expectedRootDeviceId: string;
    }
  | {
      type: "hsrp_state";
      id: string;
      description: string;
      deviceId: string;
      interfaceName: string;
      group: number;
      expectedState: "Active" | "Standby";
      expectedVirtualIp?: string;
      expectedPreempt?: boolean;
    }
  | {
      type: "hsrp_failover";
      id: string;
      description: string;
      activeDeviceId: string;
      activeInterfaceName: string;
      testSourceDeviceId: string;
      testTarget: string;
      expectedStandbyDeviceId: string;
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
