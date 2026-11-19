"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  BookMarked,
  CheckCircle2,
  Circle,
  Lightbulb,
  RotateCcw,
  ShieldAlert,
  Terminal,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { CheatSheetDrawer } from "@/components/labs/CheatSheetDrawer";
import { CliTerminal, type TerminalLine } from "@/components/labs/CliTerminal";
import { HintsPanel } from "@/components/labs/HintsPanel";
import { TopologyCanvas } from "@/components/labs/TopologyCanvas";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import {
  evaluateScenario,
  executeCommand,
  getDevicePrompt,
  type NetworkDevice,
  type NetworkState,
  type PacketTraceResult,
  type ScenarioDefinition,
} from "@/lib/network-engine";
import { useLearningStore } from "@/store/useLearningStore";

interface LabWorkspaceProps {
  category: "lab" | "troubleshoot";
  scenarios: ScenarioDefinition[];
}

function buildWelcomeLine(device: NetworkDevice): TerminalLine {
  const isHost = device.type === "pc" || device.type === "server";
  return {
    id: `welcome-${device.id}`,
    kind: "system",
    text: isHost
      ? `[${device.hostname}] エンドホスト端末に接続しました。"?" でコマンド一覧、ipconfig / ping / nslookup / set dns などが使用できます。`
      : `[${device.hostname}] Cisco IOS 仮想コンソールに接続しました。"?" でコマンド一覧、"enable" で特権モードへ移行できます。`,
  };
}

function classifyOutputKind(output: string): TerminalLine["kind"] {
  if (
    output.includes("% Invalid") ||
    output.includes("% Incomplete") ||
    output.includes("% Ambiguous") ||
    output.includes("Request failed") ||
    output.includes("0 percent (0/5)") ||
    output.includes("Non-existent domain") ||
    output.includes("DNS Server Unreachable") ||
    output.includes("timed out") ||
    output.includes("Blocked by ACL") ||
    output.includes("Connection refused") ||
    output.includes("DHCP failed") ||
    output.includes("An error occurred") ||
    output.includes("inactive (dead)") ||
    output.includes("NXDOMAIN") ||
    output.includes("connection timed out")
  ) {
    return "error";
  }
  if (
    output.includes("Success rate is 100 percent") ||
    output.includes("0% loss") ||
    output.includes("Trace complete.") ||
    output.includes("HTTP/1.1 200 OK") ||
    output.includes("succeeded!") ||
    output.includes("DHCP Lease acquired") ||
    output.includes("active (running)") ||
    output.includes("status: NOERROR") ||
    output.includes("Started ")
  ) {
    return "success";
  }
  return "output";
}

function getDefaultDeviceId(scenario: ScenarioDefinition): string {
  const keys = Object.keys(scenario.initialState.devices);
  return keys[0] ?? "";
}

interface ScenarioSessionProps {
  scenario: ScenarioDefinition;
  category: "lab" | "troubleshoot";
  onCompleted: (scenarioId: string) => void;
}

function ScenarioSession({
  scenario,
  category,
  onCompleted,
}: ScenarioSessionProps) {
  const [networkState, setNetworkState] = useState<NetworkState>(() =>
    structuredClone(scenario.initialState),
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() =>
    getDefaultDeviceId(scenario),
  );
  const [logsByDevice, setLogsByDevice] = useState<
    Record<string, TerminalLine[]>
  >(() => {
    const init: Record<string, TerminalLine[]> = {};
    for (const dev of Object.values(scenario.initialState.devices)) {
      init[dev.id] = [buildWelcomeLine(dev)];
    }
    return init;
  });
  const [historyByDevice, setHistoryByDevice] = useState<
    Record<string, string[]>
  >({});
  const [commandInput, setCommandInput] = useState("");
  const [activeTrace, setActiveTrace] = useState<PacketTraceResult | null>(
    null,
  );
  const [traceRunId, setTraceRunId] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [mobileTab, setMobileTab] = useState<"topology" | "terminal">(
    "topology",
  );
  const [lineSeq, setLineSeq] = useState(0);

  const selectedDevice =
    networkState.devices[selectedDeviceId] ??
    Object.values(networkState.devices)[0];

  const evaluation = evaluateScenario(networkState, scenario);

  const handleReset = () => {
    const fresh = structuredClone(scenario.initialState);
    setNetworkState(fresh);
    setSelectedDeviceId(getDefaultDeviceId(scenario));
    const initLogs: Record<string, TerminalLine[]> = {};
    for (const dev of Object.values(fresh.devices)) {
      initLogs[dev.id] = [buildWelcomeLine(dev)];
    }
    setLogsByDevice(initLogs);
    setHistoryByDevice({});
    setCommandInput("");
    setActiveTrace(null);
    setTraceRunId(0);
    setRevealedHints(0);
    setShowHints(false);
  };

  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setCommandInput("");
  };

  const handleExecuteCommand = (rawCommand: string) => {
    if (!selectedDevice) {
      return;
    }

    const trimmed = rawCommand.trim();
    const promptBefore = getDevicePrompt(selectedDevice);
    const result = executeCommand(networkState, selectedDevice.id, rawCommand);

    const baseSeq = lineSeq + 1;
    const appended: TerminalLine[] = [
      {
        id: `cmd-${baseSeq}`,
        kind: "command",
        prompt: promptBefore,
        text: rawCommand,
      },
    ];

    if (result.output.trim().length > 0) {
      const hasHintLine = result.output.includes("\nHint: ");
      if (hasHintLine) {
        const [mainText, hintLine] = result.output.split("\nHint: ");
        appended.push({
          id: `out-${baseSeq}-a`,
          kind: "error",
          text: mainText,
        });
        appended.push({
          id: `out-${baseSeq}-b`,
          kind: "hint",
          text: `Hint: ${hintLine}`,
        });
      } else {
        appended.push({
          id: `out-${baseSeq}`,
          kind: classifyOutputKind(result.output),
          text: result.output,
        });
      }
    }

    setLineSeq(baseSeq + 10);
    setNetworkState(result.nextState);
    setLogsByDevice((prev) => ({
      ...prev,
      [selectedDevice.id]: [...(prev[selectedDevice.id] ?? []), ...appended],
    }));

    if (trimmed.length > 0) {
      setHistoryByDevice((prev) => {
        const prevHist = prev[selectedDevice.id] ?? [];
        const nextHist =
          prevHist[prevHist.length - 1] === trimmed
            ? prevHist
            : [...prevHist, trimmed];
        return {
          ...prev,
          [selectedDevice.id]: nextHist,
        };
      });
    }

    if (result.trace) {
      setActiveTrace(result.trace);
      setTraceRunId((prev) => prev + 1);
    }

    const nextEval = evaluateScenario(result.nextState, scenario);
    if (nextEval.passed) {
      onCompleted(scenario.id);
    }
  };

  const handleClearTerminal = () => {
    if (!selectedDevice) {
      return;
    }
    setLogsByDevice((prev) => ({
      ...prev,
      [selectedDevice.id]: [buildWelcomeLine(selectedDevice)],
    }));
  };

  if (!selectedDevice) {
    return null;
  }

  return (
    <div className="space-y-5">
      {/* Scenario Brief + Header Action Bar */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={category === "lab" ? "amber" : "rose"}>
                {category === "lab" ? "CLI LAB" : "INCIDENT TICKET"}
              </Badge>
              <Badge variant="slate">難易度: {scenario.difficulty}</Badge>
              <Badge variant={evaluation.passed ? "emerald" : "cyan"}>
                達成状況: {evaluation.passedCount} / {evaluation.totalCount}
              </Badge>
            </div>
            <h2 className="text-xl font-bold text-slate-50">
              {scenario.title}
            </h2>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
              {scenario.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHints((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                showHints
                  ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                  : "border-slate-700 bg-[#070b14] text-slate-200 hover:border-amber-500/50 hover:text-amber-200",
              )}
            >
              <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
              <span>3段階ヒント</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCheatSheet(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070b14] px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-cyan-200"
            >
              <BookMarked className="h-3.5 w-3.5 text-cyan-400" />
              <span>逆引きチートシート</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition-colors hover:bg-rose-500/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>初期状態にリセット</span>
            </button>
          </div>
        </div>

        {/* Ticket Symptom Banner (Troubleshoot mode) */}
        {scenario.ticketSymptom && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs leading-relaxed text-rose-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <p>{scenario.ticketSymptom}</p>
          </div>
        )}

        {/* Live Goal Checklist */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {evaluation.results.map((goal) => (
            <div
              key={goal.goalId}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs",
                goal.passed
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                  : "border-slate-800 bg-[#070b14] text-slate-300",
              )}
            >
              {goal.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
              )}
              <div className="min-w-0">
                <p className="font-medium">{goal.description}</p>
                <p
                  className={cn(
                    "mt-0.5 text-[11px]",
                    goal.passed ? "text-emerald-300/90" : "text-slate-500",
                  )}
                >
                  {goal.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Progressive 3-Stage Hints */}
      {showHints && (
        <HintsPanel
          hints={scenario.hints}
          revealedCount={revealedHints}
          onRevealNext={() =>
            setRevealedHints((prev) => Math.min(3, prev + 1))
          }
        />
      )}

      {/* Celebration & Model Solution Banner */}
      {evaluation.passed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-xl border border-emerald-500/50 bg-gradient-to-br from-emerald-500/15 via-[#0d1322] to-cyan-500/10 p-5 shadow-lg shadow-emerald-950/30"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-400/40 bg-emerald-500/20 text-emerald-300">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-200">
                全ゴール達成！シナリオクリア
              </h3>
              <p className="text-xs text-slate-300">
                最短の切り分け手順と模範コンフィグ解説を確認できます。
              </p>
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-slate-200">
            {scenario.solutionExplanation}
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {scenario.solutionCommands.map((sol) => (
              <div
                key={sol.deviceId}
                className="rounded-lg border border-slate-800 bg-[#05080f] p-3"
              >
                <p className="mb-1.5 font-mono text-xs font-semibold text-cyan-300">
                  {sol.hostname} ({sol.deviceId}) 模範コマンド
                </p>
                <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-200">
                  {sol.commands.join("\n")}
                </pre>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Mobile View Switcher (below lg) */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#090e1a] p-1.5 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("topology")}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
            mobileTab === "topology"
              ? "bg-cyan-500/20 text-cyan-200"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          トポロジ図
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("terminal")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
            mobileTab === "terminal"
              ? "bg-cyan-500/20 text-cyan-200"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          <Terminal className="h-3.5 w-3.5" />
          <span>CLI ({selectedDevice.hostname})</span>
        </button>
      </div>

      {/* 2-Pane Workspace */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div
          className={cn(
            "lg:col-span-6",
            mobileTab === "topology" ? "block" : "hidden lg:block",
          )}
        >
          <TopologyCanvas
            networkState={networkState}
            selectedDeviceId={selectedDevice.id}
            onSelectDevice={handleSelectDevice}
            activeTrace={activeTrace}
            traceRunId={traceRunId}
            onReplayTrace={() => setTraceRunId((prev) => prev + 1)}
          />
        </div>

        <div
          className={cn(
            "lg:col-span-6",
            mobileTab === "terminal" ? "block" : "hidden lg:block",
          )}
        >
          <CliTerminal
            device={selectedDevice}
            networkState={networkState}
            lines={logsByDevice[selectedDevice.id] ?? []}
            commandHistory={historyByDevice[selectedDevice.id] ?? []}
            inputValue={commandInput}
            onInputChange={setCommandInput}
            onExecute={handleExecuteCommand}
            onClear={handleClearTerminal}
          />
        </div>
      </div>

      <CheatSheetDrawer
        open={showCheatSheet}
        onClose={() => setShowCheatSheet(false)}
        onInsertCommand={(cmd) => {
          setCommandInput(cmd);
          setMobileTab("terminal");
        }}
        deviceType={selectedDevice.type}
      />
    </div>
  );
}

export function LabWorkspace({ category, scenarios }: LabWorkspaceProps) {
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    scenarios[0]?.id ?? "",
  );
  const hydrated = useHydrated();
  const completedScenarioIds = useLearningStore(
    (state) => state.completedScenarioIds,
  );
  const markScenarioCompleted = useLearningStore(
    (state) => state.markScenarioCompleted,
  );

  const activeScenario =
    scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0];

  if (!activeScenario) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Scenario Selector Strip */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 pr-2">
          {category === "lab" ? (
            <Terminal className="h-5 w-5 text-amber-400" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-rose-400" />
          )}
          <span className="text-sm font-bold text-slate-200">
            {category === "lab" ? "構築ラボを選択:" : "障害チケットを選択:"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {scenarios.map((scenario, idx) => {
            const isActive = scenario.id === activeScenario.id;
            const isCleared =
              hydrated && completedScenarioIds.includes(scenario.id);

            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => setActiveScenarioId(scenario.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-left text-xs font-medium transition-colors",
                  isActive
                    ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-100 shadow-sm shadow-cyan-950/50"
                    : "border-slate-800 bg-[#0d1322] text-slate-300 hover:border-slate-700 hover:text-white",
                )}
              >
                <span className="font-mono text-[11px] text-slate-400">
                  #{idx + 1}
                </span>
                <span>{scenario.title}</span>
                {isCleared && (
                  <Badge variant="emerald" className="px-2 py-0 text-[10px]">
                    CLEAR
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <ScenarioSession
        key={activeScenario.id}
        scenario={activeScenario}
        category={category}
        onCompleted={markScenarioCompleted}
      />
    </div>
  );
}
