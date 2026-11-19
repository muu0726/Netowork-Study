import {
  isIpInSubnet,
  isValidIpv4,
  longestPrefixMatch,
  prefixToMaskInt,
  intToIpv4,
} from "./ip-math";

export type VpcProtocol = "tcp" | "udp" | "icmp" | "all";
export type VpcRouteTargetType = "local" | "igw" | "nat";
export type VpcRuleDirection = "inbound" | "outbound";
export type VpcNaclAction = "ALLOW" | "DENY";

export interface VpcRouteEntry {
  destinationCidr: string;
  targetType: VpcRouteTargetType;
  targetId: string;
}

export interface VpcRouteTable {
  id: string;
  name: string;
  routes: VpcRouteEntry[];
}

export interface SecurityGroupRule {
  id: string;
  direction: VpcRuleDirection;
  protocol: VpcProtocol;
  fromPort: number;
  toPort: number;
  cidr: string;
  description?: string;
}

export interface SecurityGroup {
  id: string;
  name: string;
  description: string;
  rules: SecurityGroupRule[];
}

export interface NetworkAclRule {
  ruleNumber: number;
  direction: VpcRuleDirection;
  protocol: VpcProtocol;
  fromPort: number;
  toPort: number;
  cidr: string;
  action: VpcNaclAction;
}

export interface NetworkAcl {
  id: string;
  name: string;
  rules: NetworkAclRule[];
}

export interface VpcSubnet {
  id: string;
  name: string;
  cidr: string;
  availabilityZone: string;
  type: "public" | "private";
  routeTableId: string;
  naclId: string;
}

export interface VpcInstance {
  id: string;
  name: string;
  subnetId: string;
  privateIp: string;
  publicIp?: string;
  securityGroupIds: string[];
  listeningPorts: number[];
}

export interface VpcNatGateway {
  id: string;
  name: string;
  subnetId: string;
  publicIp: string;
}

export interface VpcState {
  vpcId: string;
  vpcName: string;
  cidrBlock: string;
  igwId?: string;
  natGateways?: VpcNatGateway[];
  subnets: Record<string, VpcSubnet>;
  routeTables: Record<string, VpcRouteTable>;
  securityGroups: Record<string, SecurityGroup>;
  nacls: Record<string, NetworkAcl>;
  instances: Record<string, VpcInstance>;
}

export type VpcTrafficFlow =
  | {
      direction: "internet-to-instance";
      sourceIp: string;
      ephemeralPort: number;
      targetInstanceId: string;
      protocol: "tcp" | "udp" | "icmp";
      destPort: number;
    }
  | {
      direction: "instance-to-internet";
      sourceInstanceId: string;
      ephemeralPort: number;
      destIp: string;
      protocol: "tcp" | "udp" | "icmp";
      destPort: number;
    };

export interface VpcTraceStep {
  step: number;
  phase: "request" | "response";
  componentId: string;
  componentLabel: string;
  layer:
    | "IGW"
    | "NACL-In"
    | "NACL-Out"
    | "SG-In"
    | "SG-Out"
    | "RouteTable"
    | "NAT-GW"
    | "EC2";
  action: "ALLOW" | "DENY" | "STATEFUL-BYPASS" | "ROUTE";
  detail: string;
}

export interface VpcSimulationResult {
  success: boolean;
  failureLayer?: VpcTraceStep["layer"];
  failureReason?: string;
  steps: VpcTraceStep[];
}

export interface CloudVpcScenarioFlowPreset {
  id: string;
  label: string;
  description: string;
  flow: VpcTrafficFlow;
}

export interface CloudVpcGoal {
  id: string;
  description: string;
  flow: VpcTrafficFlow;
  expectSuccess: boolean;
}

export interface CloudVpcScenarioDefinition {
  id: string;
  title: string;
  difficulty: "初級" | "中級" | "実践";
  description: string;
  ticketSymptom: string;
  initialVpc: VpcState;
  testFlows: CloudVpcScenarioFlowPreset[];
  goals: CloudVpcGoal[];
  hints: [string, string, string];
  solutionExplanation: string;
}

export interface CloudGoalResult {
  goalId: string;
  description: string;
  passed: boolean;
  detail: string;
}

export interface CloudScenarioEvaluationResult {
  scenarioId: string;
  passed: boolean;
  passedCount: number;
  totalCount: number;
  results: CloudGoalResult[];
}

export function parseCidr(
  cidr: string,
): { ok: true; network: string; mask: string; prefix: number } | { ok: false } {
  const parts = cidr.trim().split("/");
  if (parts.length !== 2) {
    return { ok: false };
  }
  const [ipPart, prefixPart] = parts;
  if (!isValidIpv4(ipPart) || !/^\d+$/.test(prefixPart)) {
    return { ok: false };
  }
  const prefix = Number(prefixPart);
  if (prefix < 0 || prefix > 32) {
    return { ok: false };
  }
  const mask = intToIpv4(prefixToMaskInt(prefix));
  return { ok: true, network: ipPart, mask, prefix };
}

export function isIpInCidr(ip: string, cidr: string): boolean {
  if (!isValidIpv4(ip)) {
    return false;
  }
  const parsed = parseCidr(cidr);
  if (!parsed.ok) {
    return false;
  }
  try {
    return isIpInSubnet(ip, parsed.network, parsed.prefix);
  } catch {
    return false;
  }
}

export function lookupVpcRoute(
  routeTable: VpcRouteTable,
  destIp: string,
): VpcRouteEntry | null {
  if (!isValidIpv4(destIp)) {
    return null;
  }
  const entries = routeTable.routes
    .map((entry) => {
      const parsed = parseCidr(entry.destinationCidr);
      if (!parsed.ok) {
        return null;
      }
      return {
        destination: parsed.network,
        mask: parsed.mask,
        prefixLength: parsed.prefix,
        adminDistance: 1,
        entry,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const match = longestPrefixMatch(destIp, entries);
  return match?.entry ?? null;
}

function matchesPortAndProtocol(
  ruleProto: VpcProtocol,
  fromPort: number,
  toPort: number,
  pktProto: "tcp" | "udp" | "icmp",
  pktPort: number,
): boolean {
  if (ruleProto !== "all" && ruleProto !== pktProto) {
    return false;
  }
  if (ruleProto === "all" || pktProto === "icmp") {
    return true;
  }
  return pktPort >= fromPort && pktPort <= toPort;
}

export function evaluateSecurityGroup(
  sgs: SecurityGroup[],
  direction: VpcRuleDirection,
  protocol: "tcp" | "udp" | "icmp",
  remoteIp: string,
  port: number,
): { allowed: boolean; matchedSg?: string; matchedRuleId?: string } {
  for (const sg of sgs) {
    for (const rule of sg.rules) {
      if (rule.direction !== direction) {
        continue;
      }
      if (
        isIpInCidr(remoteIp, rule.cidr) &&
        matchesPortAndProtocol(
          rule.protocol,
          rule.fromPort,
          rule.toPort,
          protocol,
          port,
        )
      ) {
        return {
          allowed: true,
          matchedSg: sg.id,
          matchedRuleId: rule.id,
        };
      }
    }
  }
  return { allowed: false };
}

export function evaluateNacl(
  nacl: NetworkAcl,
  direction: VpcRuleDirection,
  protocol: "tcp" | "udp" | "icmp",
  remoteIp: string,
  port: number,
): { allowed: boolean; matchedRule?: NetworkAclRule; isImplicitDeny: boolean } {
  const sorted = nacl.rules
    .filter((r) => r.direction === direction)
    .sort((a, b) => a.ruleNumber - b.ruleNumber);

  for (const rule of sorted) {
    if (
      isIpInCidr(remoteIp, rule.cidr) &&
      matchesPortAndProtocol(
        rule.protocol,
        rule.fromPort,
        rule.toPort,
        protocol,
        port,
      )
    ) {
      return {
        allowed: rule.action === "ALLOW",
        matchedRule: rule,
        isImplicitDeny: false,
      };
    }
  }

  return { allowed: false, isImplicitDeny: true };
}

function formatPortLabel(protocol: "tcp" | "udp" | "icmp", port: number): string {
  return protocol === "icmp" ? "ICMP" : `${protocol.toUpperCase()}/${port}`;
}

export function simulateVpcTraffic(
  vpc: VpcState,
  flow: VpcTrafficFlow,
): VpcSimulationResult {
  const steps: VpcTraceStep[] = [];
  let seq = 1;

  const pushFail = (
    phase: "request" | "response",
    componentId: string,
    componentLabel: string,
    layer: VpcTraceStep["layer"],
    detail: string,
  ): VpcSimulationResult => {
    steps.push({
      step: seq,
      phase,
      componentId,
      componentLabel,
      layer,
      action: "DENY",
      detail,
    });
    return {
      success: false,
      failureLayer: layer,
      failureReason: detail,
      steps,
    };
  };

  if (flow.direction === "internet-to-instance") {
    const instance = vpc.instances[flow.targetInstanceId];
    const subnet = instance ? vpc.subnets[instance.subnetId] : undefined;
    if (!instance || !subnet) {
      return pushFail(
        "request",
        flow.targetInstanceId,
        flow.targetInstanceId,
        "EC2",
        `ターゲットEC2 (${flow.targetInstanceId}) または所属サブネットが見つかりません。`,
      );
    }

    const nacl = vpc.nacls[subnet.naclId];
    const routeTable = vpc.routeTables[subnet.routeTableId];
    const sgs = instance.securityGroupIds
      .map((id) => vpc.securityGroups[id])
      .filter((sg): sg is SecurityGroup => Boolean(sg));

    // Step 1: IGW + Public IP check
    if (!vpc.igwId) {
      return pushFail(
        "request",
        vpc.vpcId,
        "Internet Gateway",
        "IGW",
        "VPC に Internet Gateway (IGW) がアタッチされていないため外部から到達できません。",
      );
    }
    if (!instance.publicIp) {
      return pushFail(
        "request",
        instance.id,
        instance.name,
        "IGW",
        `${instance.name} にはパブリックIPが割り当てられていません。`,
      );
    }
    steps.push({
      step: seq++,
      phase: "request",
      componentId: vpc.igwId,
      componentLabel: vpc.igwId,
      layer: "IGW",
      action: "ALLOW",
      detail: `外部 ${flow.sourceIp}:${flow.ephemeralPort} → ${instance.publicIp} (${formatPortLabel(flow.protocol, flow.destPort)}) IGW 通過`,
    });

    // Step 2: Subnet NACL Inbound (Stateless)
    if (!nacl) {
      return pushFail(
        "request",
        subnet.naclId,
        subnet.naclId,
        "NACL-In",
        `サブネット ${subnet.name} の NACL (${subnet.naclId}) が見つかりません。`,
      );
    }
    const naclIn = evaluateNacl(
      nacl,
      "inbound",
      flow.protocol,
      flow.sourceIp,
      flow.destPort,
    );
    if (!naclIn.allowed) {
      return pushFail(
        "request",
        nacl.id,
        `${nacl.name} (Inbound)`,
        "NACL-In",
        naclIn.isImplicitDeny
          ? `NACL ${nacl.name} Inbound の末尾 * DENY ALL により ${flow.sourceIp} → ${formatPortLabel(flow.protocol, flow.destPort)} が拒否されました。`
          : `NACL ${nacl.name} Inbound Rule #${naclIn.matchedRule?.ruleNumber} (DENY) により遮断されました。`,
      );
    }
    steps.push({
      step: seq++,
      phase: "request",
      componentId: nacl.id,
      componentLabel: `${nacl.name} (In)`,
      layer: "NACL-In",
      action: "ALLOW",
      detail: `NACL Inbound Rule #${naclIn.matchedRule?.ruleNumber} で ${formatPortLabel(flow.protocol, flow.destPort)} を許可`,
    });

    // Step 3: Security Group Inbound (Stateful)
    const sgIn = evaluateSecurityGroup(
      sgs,
      "inbound",
      flow.protocol,
      flow.sourceIp,
      flow.destPort,
    );
    if (!sgIn.allowed) {
      return pushFail(
        "request",
        sgs[0]?.id ?? "sg",
        sgs.map((s) => s.name).join("/") || "Security Group",
        "SG-In",
        `Security Group Inbound ルールで ${flow.sourceIp} からの ${formatPortLabel(flow.protocol, flow.destPort)} が許可されていません。`,
      );
    }
    steps.push({
      step: seq++,
      phase: "request",
      componentId: sgIn.matchedSg ?? "sg",
      componentLabel: `${sgIn.matchedSg} (In)`,
      layer: "SG-In",
      action: "ALLOW",
      detail: `Security Group (${sgIn.matchedSg}) Inbound が ${formatPortLabel(flow.protocol, flow.destPort)} を許可（セッション追跡を開始）`,
    });

    // Step 4: Instance listening port
    if (
      flow.protocol !== "icmp" &&
      !instance.listeningPorts.includes(flow.destPort)
    ) {
      return pushFail(
        "request",
        instance.id,
        instance.name,
        "EC2",
        `${instance.name} (${instance.privateIp}) のポート ${flow.destPort} でアプリケーションが待機していません。`,
      );
    }
    steps.push({
      step: seq++,
      phase: "request",
      componentId: instance.id,
      componentLabel: instance.name,
      layer: "EC2",
      action: "ALLOW",
      detail: `${instance.name} (${instance.privateIp}:${flow.destPort}) がリクエストを受信・処理開始`,
    });

    // Step 5: Response - Security Group Outbound Stateful Bypass
    steps.push({
      step: seq++,
      phase: "response",
      componentId: sgIn.matchedSg ?? "sg",
      componentLabel: `${sgIn.matchedSg} (Out)`,
      layer: "SG-Out",
      action: "STATEFUL-BYPASS",
      detail: `Security Group はステートフルなため、${flow.sourceIp}:${flow.ephemeralPort} への戻りレスポンスを Outbound ルール不要で自動許可`,
    });

    // Step 6: Response - NACL Outbound Stateless Ephemeral Port Check
    const naclOut = evaluateNacl(
      nacl,
      "outbound",
      flow.protocol,
      flow.sourceIp,
      flow.ephemeralPort,
    );
    if (!naclOut.allowed) {
      return pushFail(
        "response",
        nacl.id,
        `${nacl.name} (Outbound)`,
        "NACL-Out",
        naclOut.isImplicitDeny
          ? `ステートレス NACL (${nacl.name}) Outbound にクライアント側エフェメラルポート (${flow.protocol.toUpperCase()}/${flow.ephemeralPort}, 通常 1024-65535) の許可ルールがないため、戻りレスポンスが * DENY ALL で遮断されました。`
          : `NACL ${nacl.name} Outbound Rule #${naclOut.matchedRule?.ruleNumber} (DENY) により戻りレスポンス (ポート ${flow.ephemeralPort}) が遮断されました。`,
      );
    }
    steps.push({
      step: seq++,
      phase: "response",
      componentId: nacl.id,
      componentLabel: `${nacl.name} (Out)`,
      layer: "NACL-Out",
      action: "ALLOW",
      detail: `NACL Outbound Rule #${naclOut.matchedRule?.ruleNumber} でエフェメラルポート ${flow.ephemeralPort} への応答を許可`,
    });

    // Step 7: Response - Subnet Route Table LPM to IGW
    if (!routeTable) {
      return pushFail(
        "response",
        subnet.routeTableId,
        subnet.routeTableId,
        "RouteTable",
        `ルートテーブル ${subnet.routeTableId} が見つかりません。`,
      );
    }
    const returnRoute = lookupVpcRoute(routeTable, flow.sourceIp);
    if (!returnRoute || returnRoute.targetType !== "igw") {
      return pushFail(
        "response",
        routeTable.id,
        routeTable.name,
        "RouteTable",
        `ルートテーブル ${routeTable.name} に外部 (${flow.sourceIp}) 向けの IGW ルート (0.0.0.0/0 -> ${vpc.igwId}) がありません。`,
      );
    }
    steps.push({
      step: seq++,
      phase: "response",
      componentId: routeTable.id,
      componentLabel: routeTable.name,
      layer: "RouteTable",
      action: "ROUTE",
      detail: `Route ${returnRoute.destinationCidr} -> ${returnRoute.targetId} (IGW) 経由で応答返送完了`,
    });

    return { success: true, steps };
  }

  // direction === "instance-to-internet"
  const srcInstance = vpc.instances[flow.sourceInstanceId];
  const srcSubnet = srcInstance ? vpc.subnets[srcInstance.subnetId] : undefined;
  if (!srcInstance || !srcSubnet) {
    return pushFail(
      "request",
      flow.sourceInstanceId,
      flow.sourceInstanceId,
      "EC2",
      `送信元EC2 (${flow.sourceInstanceId}) または所属サブネットが見つかりません。`,
    );
  }

  const srcSgs = srcInstance.securityGroupIds
    .map((id) => vpc.securityGroups[id])
    .filter((sg): sg is SecurityGroup => Boolean(sg));
  const srcNacl = vpc.nacls[srcSubnet.naclId];
  const srcRt = vpc.routeTables[srcSubnet.routeTableId];

  steps.push({
    step: seq++,
    phase: "request",
    componentId: srcInstance.id,
    componentLabel: srcInstance.name,
    layer: "EC2",
    action: "ALLOW",
    detail: `${srcInstance.name} (${srcInstance.privateIp}:${flow.ephemeralPort}) → ${flow.destIp} (${formatPortLabel(flow.protocol, flow.destPort)}) 送信開始`,
  });

  // SG Outbound
  const sgOut = evaluateSecurityGroup(
    srcSgs,
    "outbound",
    flow.protocol,
    flow.destIp,
    flow.destPort,
  );
  if (!sgOut.allowed) {
    return pushFail(
      "request",
      srcSgs[0]?.id ?? "sg",
      srcSgs.map((s) => s.name).join("/") || "Security Group",
      "SG-Out",
      `Security Group Outbound ルールで ${flow.destIp} への ${formatPortLabel(flow.protocol, flow.destPort)} 送信が許可されていません。`,
    );
  }
  steps.push({
    step: seq++,
    phase: "request",
    componentId: sgOut.matchedSg ?? "sg",
    componentLabel: `${sgOut.matchedSg} (Out)`,
    layer: "SG-Out",
    action: "ALLOW",
    detail: `Security Group (${sgOut.matchedSg}) Outbound が ${formatPortLabel(flow.protocol, flow.destPort)} 送信を許可`,
  });

  // Source NACL Outbound
  if (!srcNacl) {
    return pushFail(
      "request",
      srcSubnet.naclId,
      srcSubnet.naclId,
      "NACL-Out",
      `NACL ${srcSubnet.naclId} が見つかりません。`,
    );
  }
  const srcNaclOut = evaluateNacl(
    srcNacl,
    "outbound",
    flow.protocol,
    flow.destIp,
    flow.destPort,
  );
  if (!srcNaclOut.allowed) {
    return pushFail(
      "request",
      srcNacl.id,
      `${srcNacl.name} (Outbound)`,
      "NACL-Out",
      srcNaclOut.isImplicitDeny
        ? `NACL ${srcNacl.name} Outbound で ${formatPortLabel(flow.protocol, flow.destPort)} 送信が許可されていません。`
        : `NACL ${srcNacl.name} Outbound Rule #${srcNaclOut.matchedRule?.ruleNumber} (DENY) で遮断されました。`,
    );
  }
  steps.push({
    step: seq++,
    phase: "request",
    componentId: srcNacl.id,
    componentLabel: `${srcNacl.name} (Out)`,
    layer: "NACL-Out",
    action: "ALLOW",
    detail: `NACL Outbound Rule #${srcNaclOut.matchedRule?.ruleNumber} で送信許可`,
  });

  // Source Subnet Route Table
  if (!srcRt) {
    return pushFail(
      "request",
      srcSubnet.routeTableId,
      srcSubnet.routeTableId,
      "RouteTable",
      `ルートテーブル ${srcSubnet.routeTableId} が見つかりません。`,
    );
  }
  const route = lookupVpcRoute(srcRt, flow.destIp);
  if (!route) {
    return pushFail(
      "request",
      srcRt.id,
      srcRt.name,
      "RouteTable",
      `ルートテーブル ${srcRt.name} に ${flow.destIp} へのルートがありません (0.0.0.0/0 ルート設定漏れ)。`,
    );
  }
  if (route.targetType === "local") {
    return pushFail(
      "request",
      srcRt.id,
      srcRt.name,
      "RouteTable",
      `ルートテーブル ${srcRt.name} に外部ゲートウェイ (IGW または NAT GW) へのルートがありません。`,
    );
  }

  let natSubnetNacl: NetworkAcl | undefined;

  if (route.targetType === "igw") {
    if (!vpc.igwId) {
      return pushFail(
        "request",
        vpc.vpcId,
        "Internet Gateway",
        "IGW",
        "VPC に Internet Gateway が存在しません。",
      );
    }
    if (!srcInstance.publicIp) {
      return pushFail(
        "request",
        srcInstance.id,
        srcInstance.name,
        "IGW",
        `${srcInstance.name} にパブリックIPがないため IGW を直接通過できません (NAT Gateway が必要)。`,
      );
    }
    steps.push({
      step: seq++,
      phase: "request",
      componentId: srcRt.id,
      componentLabel: srcRt.name,
      layer: "RouteTable",
      action: "ROUTE",
      detail: `Route ${route.destinationCidr} -> ${route.targetId} (IGW) 経由でインターネットへ送出`,
    });
  } else if (route.targetType === "nat") {
    const natGw = (vpc.natGateways ?? []).find((n) => n.id === route.targetId);
    if (!natGw) {
      return pushFail(
        "request",
        route.targetId,
        "NAT Gateway",
        "NAT-GW",
        `指定された NAT Gateway (${route.targetId}) が見つかりません。`,
      );
    }
    const natSubnet = vpc.subnets[natGw.subnetId];
    const natRt = natSubnet ? vpc.routeTables[natSubnet.routeTableId] : undefined;
    natSubnetNacl = natSubnet ? vpc.nacls[natSubnet.naclId] : undefined;
    const natToIgw = natRt ? lookupVpcRoute(natRt, flow.destIp) : null;
    if (!natSubnet || !natRt || !vpc.igwId || natToIgw?.targetType !== "igw") {
      return pushFail(
        "request",
        natGw.id,
        natGw.name,
        "NAT-GW",
        `NAT Gateway (${natGw.name}) が配置されたサブネットのルートテーブルから IGW へ到達できません。`,
      );
    }
    if (natSubnetNacl) {
      const natNaclOut = evaluateNacl(
        natSubnetNacl,
        "outbound",
        flow.protocol,
        flow.destIp,
        flow.destPort,
      );
      if (!natNaclOut.allowed) {
        return pushFail(
          "request",
          natSubnetNacl.id,
          `${natSubnetNacl.name} (Outbound)`,
          "NACL-Out",
          `NAT GW 側 Public サブネットの NACL Outbound が送信を拒否しました。`,
        );
      }
    }
    steps.push({
      step: seq++,
      phase: "request",
      componentId: natGw.id,
      componentLabel: natGw.name,
      layer: "NAT-GW",
      action: "ROUTE",
      detail: `${srcRt.name} (${route.destinationCidr} -> ${natGw.id}) 経由で送信元を Elastic IP ${natGw.publicIp} に SNAT 変換し IGW へ送出`,
    });
  }

  // Response checks (if NAT GW -> Public NACL Inbound ephemeral, then Source NACL Inbound ephemeral)
  if (natSubnetNacl) {
    const natNaclIn = evaluateNacl(
      natSubnetNacl,
      "inbound",
      flow.protocol,
      flow.destIp,
      flow.ephemeralPort,
    );
    if (!natNaclIn.allowed) {
      return pushFail(
        "response",
        natSubnetNacl.id,
        `${natSubnetNacl.name} (Inbound)`,
        "NACL-In",
        `Public サブネットの NACL (${natSubnetNacl.name}) Inbound が戻りエフェメラルポート ${flow.ephemeralPort} を拒否しました。`,
      );
    }
  }

  const srcNaclIn = evaluateNacl(
    srcNacl,
    "inbound",
    flow.protocol,
    flow.destIp,
    flow.ephemeralPort,
  );
  if (!srcNaclIn.allowed) {
    return pushFail(
      "response",
      srcNacl.id,
      `${srcNacl.name} (Inbound)`,
      "NACL-In",
      `ステートレス NACL (${srcNacl.name}) Inbound が戻りレスポンス (エフェメラルポート ${flow.ephemeralPort}) を拒否しました。`,
    );
  }
  steps.push({
    step: seq++,
    phase: "response",
    componentId: srcNacl.id,
    componentLabel: `${srcNacl.name} (In)`,
    layer: "NACL-In",
    action: "ALLOW",
    detail: `NACL Inbound Rule #${srcNaclIn.matchedRule?.ruleNumber} で戻りエフェメラルポート ${flow.ephemeralPort} を許可`,
  });

  steps.push({
    step: seq++,
    phase: "response",
    componentId: sgOut.matchedSg ?? "sg",
    componentLabel: `${sgOut.matchedSg} (In)`,
    layer: "SG-In",
    action: "STATEFUL-BYPASS",
    detail: `Security Group はステートフルなため、アウトバウンド要求に対する ${flow.destIp} からの戻り通信を Inbound ルール不要で自動許可`,
  });

  return { success: true, steps };
}

// Pure immutable mutators for Cloud VPC Console UI & unit tests
export function addVpcRoute(
  vpc: VpcState,
  routeTableId: string,
  entry: VpcRouteEntry,
): VpcState {
  const rt = vpc.routeTables[routeTableId];
  if (!rt) {
    return vpc;
  }
  const filtered = rt.routes.filter(
    (r) => r.destinationCidr !== entry.destinationCidr,
  );
  return {
    ...vpc,
    routeTables: {
      ...vpc.routeTables,
      [routeTableId]: {
        ...rt,
        routes: [...filtered, entry],
      },
    },
  };
}

export function removeVpcRoute(
  vpc: VpcState,
  routeTableId: string,
  destinationCidr: string,
): VpcState {
  const rt = vpc.routeTables[routeTableId];
  if (!rt) {
    return vpc;
  }
  return {
    ...vpc,
    routeTables: {
      ...vpc.routeTables,
      [routeTableId]: {
        ...rt,
        routes: rt.routes.filter(
          (r) => !(r.destinationCidr === destinationCidr && r.targetType !== "local"),
        ),
      },
    },
  };
}

export function addSecurityGroupRule(
  vpc: VpcState,
  sgId: string,
  rule: SecurityGroupRule,
): VpcState {
  const sg = vpc.securityGroups[sgId];
  if (!sg) {
    return vpc;
  }
  const filtered = sg.rules.filter((r) => r.id !== rule.id);
  return {
    ...vpc,
    securityGroups: {
      ...vpc.securityGroups,
      [sgId]: {
        ...sg,
        rules: [...filtered, rule],
      },
    },
  };
}

export function removeSecurityGroupRule(
  vpc: VpcState,
  sgId: string,
  ruleId: string,
): VpcState {
  const sg = vpc.securityGroups[sgId];
  if (!sg) {
    return vpc;
  }
  return {
    ...vpc,
    securityGroups: {
      ...vpc.securityGroups,
      [sgId]: {
        ...sg,
        rules: sg.rules.filter((r) => r.id !== ruleId),
      },
    },
  };
}

export function upsertNaclRule(
  vpc: VpcState,
  naclId: string,
  rule: NetworkAclRule,
): VpcState {
  const nacl = vpc.nacls[naclId];
  if (!nacl) {
    return vpc;
  }
  const filtered = nacl.rules.filter(
    (r) => !(r.direction === rule.direction && r.ruleNumber === rule.ruleNumber),
  );
  return {
    ...vpc,
    nacls: {
      ...vpc.nacls,
      [naclId]: {
        ...nacl,
        rules: [...filtered, rule].sort((a, b) => a.ruleNumber - b.ruleNumber),
      },
    },
  };
}

export function removeNaclRule(
  vpc: VpcState,
  naclId: string,
  direction: VpcRuleDirection,
  ruleNumber: number,
): VpcState {
  const nacl = vpc.nacls[naclId];
  if (!nacl) {
    return vpc;
  }
  return {
    ...vpc,
    nacls: {
      ...vpc.nacls,
      [naclId]: {
        ...nacl,
        rules: nacl.rules.filter(
          (r) => !(r.direction === direction && r.ruleNumber === ruleNumber),
        ),
      },
    },
  };
}

export function evaluateCloudVpcScenario(
  vpc: VpcState,
  scenario: CloudVpcScenarioDefinition,
): CloudScenarioEvaluationResult {
  const results: CloudGoalResult[] = scenario.goals.map((goal) => {
    const sim = simulateVpcTraffic(vpc, goal.flow);
    const passed = sim.success === goal.expectSuccess;
    return {
      goalId: goal.id,
      description: goal.description,
      passed,
      detail: passed
        ? goal.expectSuccess
          ? "通信成功（全セキュリティ・経路チェック通過）"
          : `期待通り遮断 (${sim.failureLayer ?? "DENY"})`
        : goal.expectSuccess
          ? `通信失敗 [${sim.failureLayer ?? "ERROR"}]: ${sim.failureReason ?? ""}`
          : "許可されないべきトラフィックが通過しています",
    };
  });
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  return {
    scenarioId: scenario.id,
    passed: totalCount > 0 && passedCount === totalCount,
    passedCount,
    totalCount,
    results,
  };
}
