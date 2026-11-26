"use client";

import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Circle,
  Cloud,
  HelpCircle,
  Play,
  Plus,
  RotateCcw,
  Shield,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import {
  addSecurityGroupRule,
  addVpcRoute,
  evaluateCloudVpcScenario,
  parseCidr,
  removeNaclRule,
  removeSecurityGroupRule,
  removeVpcRoute,
  simulateVpcTraffic,
  upsertNaclRule,
  type CloudVpcScenarioDefinition,
  type VpcProtocol,
  type VpcRuleDirection,
  type VpcSimulationResult,
  type VpcState,
  type VpcTraceStep,
} from "@/lib/network-engine";
import { useLearningStore } from "@/store/useLearningStore";

interface CloudVpcWorkspaceProps {
  scenarios: CloudVpcScenarioDefinition[];
}

type ConsoleTab = "route-tables" | "security-groups" | "nacls";

function parsePortRange(raw: string): { ok: true; from: number; to: number } | { ok: false } {
  const cleaned = raw.trim();
  if (/^\d+$/.test(cleaned)) {
    const p = Number(cleaned);
    if (p >= 0 && p <= 65535) {
      return { ok: true, from: p, to: p };
    }
    return { ok: false };
  }
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(cleaned);
  if (!m) {
    return { ok: false };
  }
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (from >= 0 && to <= 65535 && from <= to) {
    return { ok: true, from, to };
  }
  return { ok: false };
}

function getStepBadgeClass(action: VpcTraceStep["action"]): string {
  switch (action) {
    case "ALLOW":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
    case "STATEFUL-BYPASS":
      return "border-cyan-500/40 bg-cyan-500/15 text-cyan-200";
    case "ROUTE":
      return "border-sky-500/40 bg-sky-500/15 text-sky-300";
    case "DENY":
      return "border-rose-500/50 bg-rose-500/15 text-rose-300";
  }
}

function VpcArchitectureDiagram({
  vpc,
  lastTrace,
}: {
  vpc: VpcState;
  lastTrace: VpcSimulationResult | null;
}) {
  const subnets = Object.values(vpc.subnets);
  const failedComponentId =
    lastTrace && !lastTrace.success
      ? lastTrace.steps[lastTrace.steps.length - 1]?.componentId
      : undefined;
  const igwHit = lastTrace?.steps.some((s) => s.layer === "IGW");
  const igwFailed = lastTrace?.failureLayer === "IGW";

  return (
    <div className="rounded-xl border border-slate-800/90 bg-[#0d1322] p-4 shadow-lg shadow-black/30">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-sky-400" />
          <span className="font-mono text-xs font-semibold text-slate-200">
            AWS VPC ARCHITECTURE // {vpc.vpcName} ({vpc.cidrBlock})
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <Badge variant="cyan">IGW: {vpc.igwId ?? "未接続"}</Badge>
          {vpc.natGateways && vpc.natGateways.length > 0 && (
            <Badge variant="amber">NAT GW: {vpc.natGateways[0].id}</Badge>
          )}
        </div>
      </div>

      {/* Interactive VPC Architecture Layout */}
      <div className="space-y-4">
        {/* Internet + IGW Top Bar */}
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-4">
          <div className="rounded-lg border border-slate-700 bg-[#080d19] px-3.5 py-2 text-center font-mono text-xs text-slate-300">
            Internet (0.0.0.0/0)
          </div>
          <span className="font-mono text-xs text-slate-500">↔</span>
          <div
            className={cn(
              "rounded-lg border px-4 py-2 font-mono text-xs transition-colors",
              igwFailed
                ? "border-rose-500 bg-rose-500/15 text-rose-200"
                : igwHit
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                  : "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
            )}
          >
            Internet Gateway ({vpc.igwId ?? "none"})
          </div>
        </div>

        {/* Subnets Grid */}
        <div
          className={cn(
            "grid gap-4",
            subnets.length > 1 ? "md:grid-cols-2" : "grid-cols-1",
          )}
        >
          {subnets.map((subnet) => {
            const rt = vpc.routeTables[subnet.routeTableId];
            const nacl = vpc.nacls[subnet.naclId];
            const instances = Object.values(vpc.instances).filter(
              (i) => i.subnetId === subnet.id,
            );
            const natGws = (vpc.natGateways ?? []).filter(
              (n) => n.subnetId === subnet.id,
            );
            const naclFailed =
              !lastTrace?.success &&
              (lastTrace?.failureLayer === "NACL-In" ||
                lastTrace?.failureLayer === "NACL-Out") &&
              failedComponentId === nacl?.id;
            const rtFailed =
              !lastTrace?.success &&
              lastTrace?.failureLayer === "RouteTable" &&
              failedComponentId === rt?.id;

            return (
              <div
                key={subnet.id}
                className={cn(
                  "rounded-xl border-2 border-dashed p-3.5",
                  naclFailed
                    ? "border-rose-500/80 bg-rose-500/5"
                    : subnet.type === "public"
                      ? "border-emerald-500/40 bg-[#08131d]"
                      : "border-violet-500/40 bg-[#0d1022]",
                )}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-100">
                      {subnet.name}{" "}
                      <span className="font-mono text-slate-400">
                        ({subnet.cidr})
                      </span>
                    </p>
                    <p className="font-mono text-[10px] text-slate-500">
                      {subnet.availabilityZone} • {subnet.type.toUpperCase()} SUBNET
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={naclFailed ? "rose" : "amber"}>
                      NACL: {nacl?.name ?? subnet.naclId}
                    </Badge>
                    <Badge variant={rtFailed ? "rose" : "cyan"}>
                      RT: {rt?.name ?? subnet.routeTableId}
                    </Badge>
                  </div>
                </div>

                {/* NAT Gateways inside subnet */}
                {natGws.map((nat) => (
                  <div
                    key={nat.id}
                    className="mb-2.5 flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-mono text-xs text-amber-200"
                  >
                    <span>NAT Gateway: {nat.id}</span>
                    <span>EIP: {nat.publicIp}</span>
                  </div>
                ))}

                {/* Instances inside subnet */}
                <div className="space-y-2.5">
                  {instances.map((inst) => {
                    const sgs = inst.securityGroupIds
                      .map((id) => vpc.securityGroups[id])
                      .filter(Boolean);
                    const sgFailed =
                      !lastTrace?.success &&
                      (lastTrace?.failureLayer === "SG-In" ||
                        lastTrace?.failureLayer === "SG-Out") &&
                      sgs.some((s) => s.id === failedComponentId);

                    return (
                      <div
                        key={inst.id}
                        className={cn(
                          "rounded-lg border bg-[#060b16] p-3",
                          sgFailed ? "border-rose-500/80" : "border-slate-700/90",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs font-semibold text-slate-100">
                              EC2: {inst.name}
                            </p>
                            <p className="font-mono text-[11px] text-slate-400">
                              Private: {inst.privateIp}
                              {inst.publicIp
                                ? ` / Public: ${inst.publicIp}`
                                : " (Public IP なし)"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {sgs.map((sg) => (
                              <Badge
                                key={sg.id}
                                variant={
                                  !lastTrace?.success &&
                                  (lastTrace?.failureLayer === "SG-In" ||
                                    lastTrace?.failureLayer === "SG-Out") &&
                                  failedComponentId === sg.id
                                    ? "rose"
                                    : "emerald"
                                }
                              >
                                <Shield className="h-3 w-3" />
                                {sg.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <p className="mt-1.5 font-mono text-[10px] text-slate-500">
                          Listening Ports: {inst.listeningPorts.join(", ")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface CloudScenarioSessionProps {
  scenario: CloudVpcScenarioDefinition;
  onCompleted: (scenarioId: string) => void;
}

function CloudScenarioSession({
  scenario,
  onCompleted,
}: CloudScenarioSessionProps) {
  const [vpcState, setVpcState] = useState<VpcState>(() =>
    structuredClone(scenario.initialVpc),
  );
  const [activeTab, setActiveTab] = useState<ConsoleTab>("route-tables");
  const [selectedRtId, setSelectedRtId] = useState<string>(
    () => Object.keys(scenario.initialVpc.routeTables)[0] ?? "",
  );
  const [selectedSgId, setSelectedSgId] = useState<string>(
    () => Object.keys(scenario.initialVpc.securityGroups)[0] ?? "",
  );
  const [selectedNaclId, setSelectedNaclId] = useState<string>(
    () => Object.keys(scenario.initialVpc.nacls)[0] ?? "",
  );

  // Route Table Form State
  const [rtCidr, setRtCidr] = useState("0.0.0.0/0");
  const availableTargets = [
    ...(vpcState.igwId
      ? [{ type: "igw" as const, id: vpcState.igwId, label: `${vpcState.igwId} (Internet Gateway)` }]
      : []),
    ...(vpcState.natGateways ?? []).map((n) => ({
      type: "nat" as const,
      id: n.id,
      label: `${n.id} (NAT Gateway)`,
    })),
  ];
  const [rtTargetChoice, setRtTargetChoice] = useState<string>(
    () =>
      availableTargets[0]
        ? `${availableTargets[0].type}:${availableTargets[0].id}`
        : "",
  );
  const [formError, setFormError] = useState<string | null>(null);

  // SG Form State
  const [sgDirection, setSgDirection] = useState<VpcRuleDirection>("inbound");
  const [sgProto, setSgProto] = useState<VpcProtocol>("tcp");
  const [sgPortRange, setSgPortRange] = useState("443");
  const [sgCidr, setSgCidr] = useState("0.0.0.0/0");
  const [sgSeqCounter, setSgSeqCounter] = useState(1);

  // NACL Form State
  const [naclRuleNum, setNaclRuleNum] = useState("110");
  const [naclDirection, setNaclDirection] = useState<VpcRuleDirection>("outbound");
  const [naclProto, setNaclProto] = useState<VpcProtocol>("tcp");
  const [naclPortRange, setNaclPortRange] = useState("1024-65535");
  const [naclCidr, setNaclCidr] = useState("0.0.0.0/0");
  const [naclAction, setNaclAction] = useState<"ALLOW" | "DENY">("ALLOW");

  // Trace & Hints
  const [lastTrace, setLastTrace] = useState<VpcSimulationResult | null>(null);
  const [lastFlowLabel, setLastFlowLabel] = useState<string | null>(null);
  const [revealedHints, setRevealedHints] = useState(0);

  const evaluation = evaluateCloudVpcScenario(vpcState, scenario);

  const applyVpcMutation = (nextVpc: VpcState) => {
    setFormError(null);
    setVpcState(nextVpc);
    const nextEval = evaluateCloudVpcScenario(nextVpc, scenario);
    if (nextEval.passed) {
      onCompleted(scenario.id);
    }
  };

  const handleRunTestFlow = (
    flowPreset: CloudVpcScenarioDefinition["testFlows"][number],
  ) => {
    const result = simulateVpcTraffic(vpcState, flowPreset.flow);
    setLastTrace(result);
    setLastFlowLabel(flowPreset.label);
  };

  const handleAddRoute = () => {
    const cidrCheck = parseCidr(rtCidr);
    if (!cidrCheck.ok) {
      setFormError(`不正な CIDR 表記です: "${rtCidr}" (例: 0.0.0.0/0)`);
      return;
    }
    const [targetTypeRaw, targetId] = rtTargetChoice.split(":");
    if (
      (targetTypeRaw !== "igw" && targetTypeRaw !== "nat") ||
      !targetId
    ) {
      setFormError("ターゲットゲートウェイを選択してください。");
      return;
    }
    applyVpcMutation(
      addVpcRoute(vpcState, selectedRtId, {
        destinationCidr: rtCidr.trim(),
        targetType: targetTypeRaw,
        targetId,
      }),
    );
  };

  const handleAddSgRule = () => {
    if (!parseCidr(sgCidr).ok) {
      setFormError(`不正な CIDR です: "${sgCidr}"`);
      return;
    }
    const ports =
      sgProto === "icmp" || sgProto === "all"
        ? ({ ok: true, from: 0, to: 65535 } as const)
        : parsePortRange(sgPortRange);
    if (!ports.ok) {
      setFormError(`不正なポート/範囲です: "${sgPortRange}" (例: 443 または 1024-65535)`);
      return;
    }
    const nextSeq = sgSeqCounter + 1;
    setSgSeqCounter(nextSeq);
    applyVpcMutation(
      addSecurityGroupRule(vpcState, selectedSgId, {
        id: `custom-sg-${nextSeq}`,
        direction: sgDirection,
        protocol: sgProto,
        fromPort: ports.from,
        toPort: ports.to,
        cidr: sgCidr.trim(),
      }),
    );
  };

  const handleAddNaclRule = () => {
    if (!/^\d+$/.test(naclRuleNum.trim())) {
      setFormError("ルール番号は 1〜32766 の整数で入力してください。");
      return;
    }
    const rNum = Number(naclRuleNum.trim());
    if (rNum < 1 || rNum > 32766) {
      setFormError("ルール番号は 1〜32766 の範囲で指定してください。");
      return;
    }
    if (!parseCidr(naclCidr).ok) {
      setFormError(`不正な CIDR です: "${naclCidr}"`);
      return;
    }
    const ports =
      naclProto === "icmp" || naclProto === "all"
        ? ({ ok: true, from: 0, to: 65535 } as const)
        : parsePortRange(naclPortRange);
    if (!ports.ok) {
      setFormError(`不正なポート/範囲です: "${naclPortRange}" (例: 1024-65535)`);
      return;
    }
    applyVpcMutation(
      upsertNaclRule(vpcState, selectedNaclId, {
        ruleNumber: rNum,
        direction: naclDirection,
        protocol: naclProto,
        fromPort: ports.from,
        toPort: ports.to,
        cidr: naclCidr.trim(),
        action: naclAction,
      }),
    );
  };

  const handleReset = () => {
    setVpcState(structuredClone(scenario.initialVpc));
    setLastTrace(null);
    setLastFlowLabel(null);
    setFormError(null);
    setRevealedHints(0);
  };

  const activeRt = vpcState.routeTables[selectedRtId];
  const activeSg = vpcState.securityGroups[selectedSgId];
  const activeNacl = vpcState.nacls[selectedNaclId];

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0d1322] p-4 shadow-lg shadow-black/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="cyan">AWS VPC Simulator</Badge>
              <Badge variant="amber">{scenario.difficulty}</Badge>
              {evaluation.passed && (
                <Badge variant="emerald">
                  <Award className="h-3 w-3" />
                  復旧クリア!
                </Badge>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-100">{scenario.title}</h2>
            <p className="text-xs leading-relaxed text-slate-400 sm:text-sm">
              {scenario.description}
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#080d19] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-rose-500/50 hover:text-rose-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            環境リセット
          </button>
        </div>

        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-rose-200">
          {scenario.ticketSymptom}
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid gap-4 xl:grid-cols-12">
        {/* Left: Topology SVG + Traffic Trace */}
        <div className="space-y-4 xl:col-span-6">
          <VpcArchitectureDiagram vpc={vpcState} lastTrace={lastTrace} />

          {/* Traffic Simulator Card */}
          <div className="rounded-xl border border-slate-800/90 bg-[#0d1322] p-4 shadow-lg shadow-black/30">
            <h3 className="mb-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
              トラフィック疎通シミュレータ
            </h3>
            <div className="flex flex-wrap gap-2">
              {scenario.testFlows.map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => handleRunTestFlow(tf)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>{tf.label}</span>
                </button>
              ))}
            </div>

            {lastTrace && (
              <div className="mt-3 space-y-2 rounded-lg border border-slate-800 bg-[#05080f] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <span className="font-mono text-xs font-semibold text-slate-200">
                    {lastFlowLabel}
                  </span>
                  {lastTrace.success ? (
                    <Badge variant="emerald">通信成功 (200 OK / ESTABLISHED)</Badge>
                  ) : (
                    <Badge variant="rose">
                      遮断 [{lastTrace.failureLayer}]
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5">
                  {lastTrace.steps.map((s) => (
                    <div
                      key={`${s.step}-${s.layer}`}
                      className="flex items-start gap-2 font-mono text-[11px]"
                    >
                      <span
                        className={cn(
                          "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold",
                          getStepBadgeClass(s.action),
                        )}
                      >
                        {s.phase === "request" ? "REQ" : "RES"} • {s.action}
                      </span>
                      <span className="text-slate-300">
                        <span className="text-slate-400">[{s.layer}]</span>{" "}
                        {s.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Interactive AWS Console Editor */}
        <div className="space-y-4 xl:col-span-6">
          <div className="rounded-xl border border-slate-800/90 bg-[#0d1322] p-4 shadow-lg shadow-black/30">
            {/* Tabs */}
            <div className="mb-4 flex flex-wrap gap-1.5 border-b border-slate-800 pb-3">
              {[
                { id: "route-tables" as const, label: "Route Tables" },
                {
                  id: "security-groups" as const,
                  label: "Security Groups (Stateful)",
                },
                { id: "nacls" as const, label: "Network ACLs (Stateless)" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setFormError(null);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                    activeTab === tab.id
                      ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-200"
                      : "border-slate-800 bg-[#080d19] text-slate-400 hover:text-slate-200",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {formError && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Route Tables Tab */}
            {activeTab === "route-tables" && activeRt && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="vpc-rt-select"
                    className="text-xs font-semibold text-slate-300"
                  >
                    ルートテーブル選択:
                  </label>
                  <select
                    id="vpc-rt-select"
                    name="routeTableId"
                    value={selectedRtId}
                    onChange={(e) => setSelectedRtId(e.target.value)}
                    className="rounded-md border border-slate-700 bg-[#080d19] px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  >
                    {Object.values(vpcState.routeTables).map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.name} ({rt.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#060a14]">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="border-b border-slate-800 bg-[#090f1d] text-[11px] text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Destination</th>
                        <th className="px-3 py-2">Target</th>
                        <th className="px-3 py-2 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {activeRt.routes.map((route) => (
                        <tr key={`${route.destinationCidr}-${route.targetId}`}>
                          <td className="px-3 py-2">{route.destinationCidr}</td>
                          <td className="px-3 py-2">
                            {route.targetId} ({route.targetType})
                          </td>
                          <td className="px-3 py-2 text-right">
                            {route.targetType === "local" ? (
                              <span className="text-[10px] text-slate-500">
                                fixed
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  applyVpcMutation(
                                    removeVpcRoute(
                                      vpcState,
                                      activeRt.id,
                                      route.destinationCidr,
                                    ),
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded border border-rose-500/40 px-2 py-0.5 text-[11px] text-rose-300 hover:bg-rose-500/15"
                              >
                                <Trash2 className="h-3 w-3" />
                                削除
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-2 rounded-lg border border-slate-800 bg-[#080d19] p-3 sm:grid-cols-3">
                  <label htmlFor="vpc-rt-cidr" className="block">
                    <span className="sr-only">Destination CIDR</span>
                    <input
                      id="vpc-rt-cidr"
                      name="routeDestinationCidr"
                      type="text"
                      value={rtCidr}
                      onChange={(e) => setRtCidr(e.target.value)}
                      placeholder="0.0.0.0/0"
                      className="w-full rounded border border-slate-700 bg-[#05080f] px-2.5 py-1.5 font-mono text-xs text-slate-100"
                    />
                  </label>
                  <label htmlFor="vpc-rt-target" className="block">
                    <span className="sr-only">Route Target</span>
                    <select
                      id="vpc-rt-target"
                      name="routeTarget"
                      value={rtTargetChoice}
                      onChange={(e) => setRtTargetChoice(e.target.value)}
                      className="w-full rounded border border-slate-700 bg-[#05080f] px-2.5 py-1.5 font-mono text-xs text-slate-100"
                    >
                      {availableTargets.map((t) => (
                        <option key={t.id} value={`${t.type}:${t.id}`}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddRoute}
                    className="inline-flex items-center justify-center gap-1 rounded bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    ルート追加
                  </button>
                </div>
              </div>
            )}

            {/* Security Groups Tab */}
            {activeTab === "security-groups" && activeSg && (
              <div className="space-y-3">
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
                  <strong>Stateful フィルタ:</strong>{" "}
                  許可されたインバウンドへの戻り応答（またはアウトバウンドへの戻り応答）は逆方向のルール不要で自動許可されます。
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="vpc-sg-select"
                    className="text-xs font-semibold text-slate-300"
                  >
                    Security Group:
                  </label>
                  <select
                    id="vpc-sg-select"
                    name="securityGroupId"
                    value={selectedSgId}
                    onChange={(e) => setSelectedSgId(e.target.value)}
                    className="rounded-md border border-slate-700 bg-[#080d19] px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  >
                    {Object.values(vpcState.securityGroups).map((sg) => (
                      <option key={sg.id} value={sg.id}>
                        {sg.name} ({sg.id})
                      </option>
                    ))}
                  </select>
                </div>

                {(["inbound", "outbound"] as const).map((dir) => {
                  const dirRules = activeSg.rules.filter(
                    (r) => r.direction === dir,
                  );
                  return (
                    <div key={dir} className="space-y-1.5">
                      <p className="font-mono text-[11px] font-semibold uppercase text-slate-400">
                        {dir} Rules ({dirRules.length})
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#060a14]">
                        <table className="w-full text-left font-mono text-xs">
                          <thead className="border-b border-slate-800 bg-[#090f1d] text-[11px] text-slate-400">
                            <tr>
                              <th className="px-2.5 py-1.5">Proto</th>
                              <th className="px-2.5 py-1.5">Port</th>
                              <th className="px-2.5 py-1.5">CIDR</th>
                              <th className="px-2.5 py-1.5 text-right">操作</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-slate-200">
                            {dirRules.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-2.5 py-2 text-[11px] text-slate-500"
                                >
                                  (ルールなし — 新規 {dir} 通信は暗黙拒否 / 戻り通信は Stateful 自動許可)
                                </td>
                              </tr>
                            ) : (
                              dirRules.map((rule) => (
                                <tr key={rule.id}>
                                  <td className="px-2.5 py-1.5 uppercase">
                                    {rule.protocol}
                                  </td>
                                  <td className="px-2.5 py-1.5">
                                    {rule.protocol === "all" ||
                                    rule.protocol === "icmp"
                                      ? "All"
                                      : rule.fromPort === rule.toPort
                                        ? rule.fromPort
                                        : `${rule.fromPort}-${rule.toPort}`}
                                  </td>
                                  <td className="px-2.5 py-1.5">{rule.cidr}</td>
                                  <td className="px-2.5 py-1.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        applyVpcMutation(
                                          removeSecurityGroupRule(
                                            vpcState,
                                            activeSg.id,
                                            rule.id,
                                          ),
                                        )
                                      }
                                      className="inline-flex items-center gap-1 rounded border border-rose-500/40 px-2 py-0.5 text-[11px] text-rose-300 hover:bg-rose-500/15"
                                    >
                                      削除
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

                <div className="grid gap-2 rounded-lg border border-slate-800 bg-[#080d19] p-3 sm:grid-cols-5">
                  <label htmlFor="vpc-sg-direction" className="block">
                    <span className="sr-only">Security Group Direction</span>
                    <select
                      id="vpc-sg-direction"
                      name="sgDirection"
                      value={sgDirection}
                      onChange={(e) =>
                        setSgDirection(e.target.value as VpcRuleDirection)
                      }
                      className="w-full rounded border border-slate-700 bg-[#05080f] px-2 py-1.5 font-mono text-xs text-slate-100"
                    >
                      <option value="inbound">Inbound</option>
                      <option value="outbound">Outbound</option>
                    </select>
                  </label>
                  <label htmlFor="vpc-sg-protocol" className="block">
                    <span className="sr-only">Security Group Protocol</span>
                    <select
                      id="vpc-sg-protocol"
                      name="sgProtocol"
                      value={sgProto}
                      onChange={(e) => setSgProto(e.target.value as VpcProtocol)}
                      className="w-full rounded border border-slate-700 bg-[#05080f] px-2 py-1.5 font-mono text-xs text-slate-100"
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                      <option value="icmp">ICMP</option>
                      <option value="all">ALL</option>
                    </select>
                  </label>
                  <label htmlFor="vpc-sg-port" className="block">
                    <span className="sr-only">Security Group Port Range</span>
                    <input
                      id="vpc-sg-port"
                      name="sgPortRange"
                      type="text"
                      value={sgPortRange}
                      onChange={(e) => setSgPortRange(e.target.value)}
                      placeholder="443"
                      disabled={sgProto === "icmp" || sgProto === "all"}
                      className="w-full rounded border border-slate-700 bg-[#05080f] px-2 py-1.5 font-mono text-xs text-slate-100 disabled:opacity-40"
                    />
                  </label>
                  <label htmlFor="vpc-sg-cidr" className="block">
                    <span className="sr-only">Security Group CIDR</span>
                    <input
                      id="vpc-sg-cidr"
                      name="sgCidr"
                      type="text"
                      value={sgCidr}
                      onChange={(e) => setSgCidr(e.target.value)}
                      placeholder="0.0.0.0/0"
                      className="w-full rounded border border-slate-700 bg-[#05080f] px-2 py-1.5 font-mono text-xs text-slate-100"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSgRule}
                    className="inline-flex items-center justify-center gap-1 rounded bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    許可追加
                  </button>
                </div>
              </div>
            )}

            {/* Network ACLs Tab */}
            {activeTab === "nacls" && activeNacl && (
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  <strong>Stateless フィルタ:</strong>{" "}
                  ルール番号の昇順で評価され、戻りトラフィック（クライアントのエフェメラルポート 1024-65535 等）も Outbound / Inbound で明示許可が必要です。
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="vpc-nacl-select"
                    className="text-xs font-semibold text-slate-300"
                  >
                    Network ACL:
                  </label>
                  <select
                    id="vpc-nacl-select"
                    name="naclId"
                    value={selectedNaclId}
                    onChange={(e) => setSelectedNaclId(e.target.value)}
                    className="rounded-md border border-slate-700 bg-[#080d19] px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  >
                    {Object.values(vpcState.nacls).map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.id})
                      </option>
                    ))}
                  </select>
                </div>

                {(["inbound", "outbound"] as const).map((dir) => {
                  const dirRules = activeNacl.rules
                    .filter((r) => r.direction === dir)
                    .sort((a, b) => a.ruleNumber - b.ruleNumber);
                  return (
                    <div key={dir} className="space-y-1.5">
                      <p className="font-mono text-[11px] font-semibold uppercase text-slate-400">
                        {dir} Rules
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#060a14]">
                        <table className="w-full text-left font-mono text-xs">
                          <thead className="border-b border-slate-800 bg-[#090f1d] text-[11px] text-slate-400">
                            <tr>
                              <th className="px-2.5 py-1.5">#</th>
                              <th className="px-2.5 py-1.5">Proto</th>
                              <th className="px-2.5 py-1.5">Port</th>
                              <th className="px-2.5 py-1.5">CIDR</th>
                              <th className="px-2.5 py-1.5">Allow/Deny</th>
                              <th className="px-2.5 py-1.5 text-right">操作</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-slate-200">
                            {dirRules.map((r) => (
                              <tr key={`${dir}-${r.ruleNumber}`}>
                                <td className="px-2.5 py-1.5">{r.ruleNumber}</td>
                                <td className="px-2.5 py-1.5 uppercase">
                                  {r.protocol}
                                </td>
                                <td className="px-2.5 py-1.5">
                                  {r.protocol === "all" || r.protocol === "icmp"
                                    ? "ALL"
                                    : r.fromPort === r.toPort
                                      ? r.fromPort
                                      : `${r.fromPort}-${r.toPort}`}
                                </td>
                                <td className="px-2.5 py-1.5">{r.cidr}</td>
                                <td className="px-2.5 py-1.5">
                                  <Badge
                                    variant={
                                      r.action === "ALLOW" ? "emerald" : "rose"
                                    }
                                  >
                                    {r.action}
                                  </Badge>
                                </td>
                                <td className="px-2.5 py-1.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      applyVpcMutation(
                                        removeNaclRule(
                                          vpcState,
                                          activeNacl.id,
                                          dir,
                                          r.ruleNumber,
                                        ),
                                      )
                                    }
                                    className="rounded border border-rose-500/40 px-2 py-0.5 text-[11px] text-rose-300 hover:bg-rose-500/15"
                                  >
                                    削除
                                  </button>
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-rose-950/20 text-rose-300/80">
                              <td className="px-2.5 py-1.5">*</td>
                              <td className="px-2.5 py-1.5">ALL</td>
                              <td className="px-2.5 py-1.5">ALL</td>
                              <td className="px-2.5 py-1.5">0.0.0.0/0</td>
                              <td className="px-2.5 py-1.5">DENY</td>
                              <td className="px-2.5 py-1.5 text-right text-[10px]">
                                implicit
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

                <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-[#080d19] p-3 sm:grid-cols-4">
                  <label htmlFor="vpc-nacl-rule-num" className="block">
                    <span className="sr-only">NACL Rule Number</span>
                    <input
                      id="vpc-nacl-rule-num"
                      name="naclRuleNumber"
                      type="text"
                      value={naclRuleNum}
                      onChange={(e) => setNaclRuleNum(e.target.value)}
                      placeholder="Rule#"
                      className="w-full rounded border border-slate-700 bg-[#05080f] px-2 py-1.5 font-mono text-xs text-slate-100"
                    />
                  </label>
                  <label htmlFor="vpc-nacl-direction" className="block">
                    <span className="sr-only">NACL Direction</span>
                    <select
                      id="vpc-nacl-direction"
                      name="naclDirection"
                      value={naclDirection}
                      onChange={(e) =>
                        setNaclDirection(e.target.value as VpcRuleDirection)
                      }
                      className="w-full rounded border border-slate-700 bg-[#05080f] px-2 py-1.5 font-mono text-xs text-slate-100"
                    >
                      <option value="inbound">In</option>
                      <option value="outbound">Out</option>
                    </select>
                  </label>
                  <label htmlFor="vpc-nacl-protocol" className="block">
                    <span className="sr-only">NACL Protocol</span>
                    <select
                      id="vpc-nacl-protocol"
                      name="naclProtocol"
                      value={naclProto}
                      onChange={(e) =>
                        setNaclProto(e.target.value as VpcProtocol)
                      }
                      className="w-full rounded border border-slate-700 bg-[#05080f] px-2 py-1.5 font-mono text-xs text-slate-100"
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                      <option value="all">ALL</option>
                    </select>
                  </label>
                  <label htmlFor="vpc-nacl-port" className="block">
                    <span className="sr-only">NACL Port Range</span>
                    <input
                      id="vpc-nacl-port"
                      name="naclPortRange"
                      type="text"
                      value={naclPortRange}
                      onChange={(e) => setNaclPortRange(e.target.value)}
                      placeholder="1024-65535"
                      disabled={naclProto === "all"}
                      className="w-full rounded border border-slate-700 bg-[#05080f] px-2 py-1.5 font-mono text-xs text-slate-100 disabled:opacity-40"
                    />
                  </label>
                  <label
                    htmlFor="vpc-nacl-cidr"
                    className="col-span-1 block sm:col-span-2"
                  >
                    <span className="sr-only">NACL CIDR</span>
                    <input
                      id="vpc-nacl-cidr"
                      name="naclCidr"
                      type="text"
                      value={naclCidr}
                      onChange={(e) => setNaclCidr(e.target.value)}
                      placeholder="0.0.0.0/0"
                      className="w-full rounded border border-slate-700 bg-[#05080f] px-2 py-1.5 font-mono text-xs text-slate-100"
                    />
                  </label>
                  <label htmlFor="vpc-nacl-action" className="block">
                    <span className="sr-only">NACL Action</span>
                    <select
                      id="vpc-nacl-action"
                      name="naclAction"
                      value={naclAction}
                      onChange={(e) =>
                        setNaclAction(e.target.value as "ALLOW" | "DENY")
                      }
                      className="w-full rounded border border-slate-700 bg-[#05080f] px-2 py-1.5 font-mono text-xs text-slate-100"
                    >
                      <option value="ALLOW">ALLOW</option>
                      <option value="DENY">DENY</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddNaclRule}
                    className="inline-flex items-center justify-center gap-1 rounded bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
                  >
                    ルール適用
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Goals & Hints */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-800/90 bg-[#0d1322] p-4 shadow-lg shadow-black/30 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
              達成条件チェック ({evaluation.passedCount}/{evaluation.totalCount})
            </span>
            <Badge variant={evaluation.passed ? "emerald" : "slate"}>
              {evaluation.passed ? "ALL PASSED" : "未完了"}
            </Badge>
          </div>
          <div className="space-y-2">
            {evaluation.results.map((r) => (
              <div
                key={r.goalId}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs",
                  r.passed
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                    : "border-slate-800 bg-[#080d19] text-slate-300",
                )}
              >
                {r.passed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                )}
                <div>
                  <p className="font-semibold">{r.description}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                    {r.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {evaluation.passed && (
            <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-100">
              <strong className="text-emerald-300">解説:</strong>{" "}
              {scenario.solutionExplanation}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0d1322] p-4 shadow-lg shadow-black/30 lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-amber-300">
              <HelpCircle className="h-4 w-4" />
              段階ヒント ({revealedHints}/3)
            </span>
            {revealedHints < 3 && (
              <button
                type="button"
                onClick={() => setRevealedHints((h) => Math.min(3, h + 1))}
                className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
              >
                次のヒントを見る
              </button>
            )}
          </div>
          <div className="space-y-2">
            {revealedHints === 0 ? (
              <p className="text-xs text-slate-400">
                詰まった場合は上の「次のヒントを見る」から段階的に調査ポイントを確認できます。
              </p>
            ) : (
              scenario.hints.slice(0, revealedHints).map((hint, idx) => (
                <div
                  key={hint}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-slate-200"
                >
                  <span className="mr-1.5 font-mono font-bold text-amber-300">
                    Hint {idx + 1}:
                  </span>
                  {hint}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CloudVpcWorkspaceInner({
  scenarios,
  initialScenarioId,
}: {
  scenarios: CloudVpcScenarioDefinition[];
  initialScenarioId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const completedScenarioIds = useLearningStore(
    (state) => state.completedScenarioIds,
  );
  const markScenarioCompleted = useLearningStore(
    (state) => state.markScenarioCompleted,
  );

  const [activeId, setActiveId] = useState<string>(initialScenarioId);
  const activeScenario =
    scenarios.find((s) => s.id === activeId) ?? scenarios[0];

  if (!activeScenario) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Scenario Selector */}
      <div className="grid gap-3 md:grid-cols-3">
        {scenarios.map((scenario) => {
          const isActive = scenario.id === activeScenario.id;
          const isSolved =
            hydrated && completedScenarioIds.includes(scenario.id);
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => {
                setActiveId(scenario.id);
                router.replace(
                  `${pathname}?scenario=${encodeURIComponent(scenario.id)}`,
                  { scroll: false },
                );
              }}
              className={cn(
                "rounded-xl border p-3.5 text-left transition-colors",
                isActive
                  ? "border-cyan-500/60 bg-cyan-500/10"
                  : "border-slate-800/90 bg-[#0d1322] hover:border-slate-700",
              )}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase text-cyan-300">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {scenario.difficulty}
                </span>
                {isSolved && <Badge variant="emerald">クリア済み</Badge>}
              </div>
              <p className="text-xs font-bold leading-snug text-slate-100 sm:text-sm">
                {scenario.title}
              </p>
            </button>
          );
        })}
      </div>

      <CloudScenarioSession
        key={activeScenario.id}
        scenario={activeScenario}
        onCompleted={markScenarioCompleted}
      />
    </div>
  );
}

export function CloudVpcWorkspace({ scenarios }: CloudVpcWorkspaceProps) {
  const searchParams = useSearchParams();
  const scenarioParam = searchParams.get("scenario");
  const matched =
    scenarioParam && scenarios.some((s) => s.id === scenarioParam)
      ? scenarioParam
      : (scenarios[0]?.id ?? "");

  return (
    <CloudVpcWorkspaceInner
      key={matched}
      scenarios={scenarios}
      initialScenarioId={matched}
    />
  );
}
