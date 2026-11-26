"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  BookMarked,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  GitCompare,
  History,
  Lightbulb,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  ShieldAlert,
  Terminal,
  Trophy,
  Undo2,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheatSheetDrawer } from "@/components/labs/CheatSheetDrawer";
import { CliTerminal, type TerminalLine } from "@/components/labs/CliTerminal";
import { HintsPanel } from "@/components/labs/HintsPanel";
import { TopologyCanvas } from "@/components/labs/TopologyCanvas";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import {
  computeNetworkConfigDiff,
  evaluateScenario,
  executeCommand,
  getDevicePrompt,
  type NetworkDevice,
  type NetworkState,
  type PacketTraceResult,
  type ScenarioDefinition,
} from "@/lib/network-engine";
import { useLearningStore } from "@/store/useLearningStore";

interface CommandSnapshot {
  step: number;
  state: NetworkState;
  deviceId: string;
  hostname: string;
  commandLabel: string;
}

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
  onCompleted: (
    scenarioId: string,
    elapsedSeconds: number,
    commandsCount: number,
  ) => void;
}

const CLI_MODE_HELP: Record<string, string> = {
  user: "ユーザーEXECモード (>) です。状態確認 (show) はできますが、設定変更には `enable` で特権モード (#) へ移ります。",
  privileged: "特権EXECモード (#) です。`show` / `ping` の確認や、`configure terminal` で設定モードへ移れます。",
  config: "グローバル設定モード `(config)#` です。`interface <名前>` や `ip route` / `router ospf` 等を入力できます。",
  "config-if": "インターフェース設定モード `(config-if)#` です。IP設定・`no shutdown`・`switchport`・`channel-group` 等を設定できます。",
  "config-subif": "サブインターフェース設定モード `(config-subif)#` です。`encapsulation dot1Q <vlan>` や IP を設定します。",
  "config-vlan": "VLAN設定モード `(config-vlan)#` です。`name <名前>` 等を設定できます。",
  "config-std-nacl": "名前付き標準ACL設定モードです。`permit` / `deny` ルールを入力します。",
  "config-ext-nacl": "名前付き拡張ACL設定モードです。`permit tcp ...` 等のルールを入力します。",
  "dhcp-config": "DHCPプール設定モードです。`network` / `default-router` / `dns-server` を設定します。",
  "config-router": "OSPF設定モードです。`router-id` や `network ... area ...` を設定します。",
  host: "エンドホスト端末 ($) です。`ipconfig` / `ping` / `nslookup` / `curl` / `systemctl` 等の確認コマンドが使えます。",
};

function formatElapsedSeconds(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function ScenarioSession({
  scenario,
  category,
  onCompleted,
}: ScenarioSessionProps) {
  const [snapshots, setSnapshots] = useState<CommandSnapshot[]>(() => [
    {
      step: 0,
      state: structuredClone(scenario.initialState),
      deviceId: getDefaultDeviceId(scenario),
      hostname: "初期状態",
      commandLabel: "Initial Topology",
    },
  ]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [showDiffPanel, setShowDiffPanel] = useState(false);
  const [diffOnlyChanged, setDiffOnlyChanged] = useState(true);

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
  const [guideMode, setGuideMode] = useState<boolean>(
    () => scenario.difficulty === "初級",
  );
  const [showSampleCommands, setShowSampleCommands] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pmRootChoice, setPmRootChoice] = useState<number | null>(null);
  const [pmPrevChoice, setPmPrevChoice] = useState<number | null>(null);
  const [pmSubmitted, setPmSubmitted] = useState(false);

  const hydrated = useHydrated();
  const incidentBest = useLearningStore((state) =>
    hydrated ? state.incidentRecords?.[scenario.id] : undefined,
  );

  const activeSnapshot = snapshots[currentStepIndex] ?? snapshots[0];
  const networkState = activeSnapshot.state;
  const evaluation = evaluateScenario(networkState, scenario);

  useEffect(() => {
    if (evaluation.passed) {
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [evaluation.passed]);

  useEffect(() => {
    if (!isReplaying) {
      return;
    }
    if (currentStepIndex >= snapshots.length - 1) {
      return;
    }
    const timer = window.setTimeout(() => {
      const next = currentStepIndex + 1;
      setCurrentStepIndex(next);
      if (next >= snapshots.length - 1) {
        setIsReplaying(false);
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [isReplaying, currentStepIndex, snapshots.length]);

  const selectedDevice =
    networkState.devices[selectedDeviceId] ??
    Object.values(networkState.devices)[0];

  const configDiff = computeNetworkConfigDiff(
    scenario.initialState,
    networkState,
  );

  const canUndo = currentStepIndex > 0 && !isReplaying;
  const canRedo = currentStepIndex < snapshots.length - 1 && !isReplaying;

  const handleUndo = () => {
    if (!canUndo) {
      return;
    }
    setIsReplaying(false);
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleRedo = () => {
    if (!canRedo) {
      return;
    }
    setIsReplaying(false);
    setCurrentStepIndex((prev) => Math.min(snapshots.length - 1, prev + 1));
  };

  const handleToggleReplay = () => {
    if (snapshots.length <= 1) {
      return;
    }
    if (isReplaying) {
      setIsReplaying(false);
      return;
    }
    if (currentStepIndex >= snapshots.length - 1) {
      setCurrentStepIndex(0);
    }
    setIsReplaying(true);
  };

  const handleReset = () => {
    const fresh = structuredClone(scenario.initialState);
    setIsReplaying(false);
    setSnapshots([
      {
        step: 0,
        state: fresh,
        deviceId: getDefaultDeviceId(scenario),
        hostname: "初期状態",
        commandLabel: "Initial Topology",
      },
    ]);
    setCurrentStepIndex(0);
    setShowDiffPanel(false);
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
    setElapsedSeconds(0);
    setShowSampleCommands(false);
    setPmRootChoice(null);
    setPmPrevChoice(null);
    setPmSubmitted(false);
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
    setIsReplaying(false);

    let nextStepCount = snapshots.length - 1;
    if (trimmed.length > 0) {
      const baseSnapshots = snapshots.slice(0, currentStepIndex + 1);
      const nextStepIdx = baseSnapshots.length;
      nextStepCount = nextStepIdx;
      setSnapshots([
        ...baseSnapshots,
        {
          step: nextStepIdx,
          state: result.nextState,
          deviceId: selectedDevice.id,
          hostname: selectedDevice.hostname,
          commandLabel: trimmed,
        },
      ]);
      setCurrentStepIndex(nextStepIdx);
    }

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
      onCompleted(scenario.id, elapsedSeconds, nextStepCount);
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
              <Badge variant="slate">
                <Clock className="h-3 w-3" />
                {formatElapsedSeconds(elapsedSeconds)} • {snapshots.length - 1}手
              </Badge>
              {incidentBest && (
                <Badge variant="emerald">
                  自己ベスト: {formatElapsedSeconds(incidentBest.bestSeconds)} /{" "}
                  {incidentBest.bestCommands}手
                </Badge>
              )}
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
              onClick={handleUndo}
              disabled={!canUndo}
              title="直前の操作を1手戻す (Undo)"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#070b14] px-2.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>1手戻す</span>
            </button>

            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              title="戻した操作をやり直す (Redo)"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#070b14] px-2.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Redo2 className="h-3.5 w-3.5" />
              <span>やり直す</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDiffPanel((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                showDiffPanel
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                  : "border-slate-700 bg-[#070b14] text-slate-200 hover:border-emerald-500/50 hover:text-emerald-200",
              )}
            >
              <GitCompare className="h-3.5 w-3.5 text-emerald-400" />
              <span>
                設定Diff (+{configDiff.totalAdded}/-{configDiff.totalRemoved})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setGuideMode((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                guideMode
                  ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-200"
                  : "border-slate-700 bg-[#070b14] text-slate-300 hover:border-cyan-500/50",
              )}
            >
              <Compass className="h-3.5 w-3.5 text-cyan-400" />
              <span>ガイド: {guideMode ? "ON" : "OFF"}</span>
            </button>

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

      {/* Timeline & Operation Replay Strip */}
      {snapshots.length > 1 && (
        <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-cyan-400" />
            <span className="font-mono text-xs font-semibold text-slate-200">
              タイムライン
            </span>
            <Badge variant="cyan">
              Step {currentStepIndex} / {snapshots.length - 1}
            </Badge>
          </div>

          <button
            type="button"
            onClick={handleToggleReplay}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
              isReplaying
                ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                : "border-cyan-500/50 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20",
            )}
          >
            {isReplaying ? (
              <>
                <Pause className="h-3 w-3" />
                <span>停止</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                <span>手順リプレイ</span>
              </>
            )}
          </button>

          <label htmlFor="lab-timeline-slider" className="sr-only">
            コマンド操作タイムラインスライダー
          </label>
          <input
            id="lab-timeline-slider"
            name="labTimelineStep"
            type="range"
            min={0}
            max={snapshots.length - 1}
            value={currentStepIndex}
            onChange={(e) => {
              setIsReplaying(false);
              setCurrentStepIndex(Number(e.target.value));
            }}
            className="min-w-[140px] flex-1 accent-cyan-400"
          />

          <span className="max-w-full truncate font-mono text-[11px] text-slate-300">
            [{activeSnapshot.hostname}] {activeSnapshot.commandLabel}
          </span>
        </Card>
      )}

      {/* Realtime Config Diff Panel */}
      {showDiffPanel && (
        <Card className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-100">
                初期状態からのリアルタイム設定 Diff
              </h3>
              <Badge variant="emerald">+{configDiff.totalAdded}</Badge>
              <Badge variant="rose">-{configDiff.totalRemoved}</Badge>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDiffOnlyChanged((prev) => !prev)}
                className="rounded-md border border-slate-700 bg-[#070b14] px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-cyan-500/50"
              >
                {diffOnlyChanged ? "変更箇所のみ表示中" : "全設定ライン表示中"}
              </button>
              <button
                type="button"
                onClick={() => setShowDiffPanel(false)}
                className="rounded-md border border-slate-800 bg-[#070b14] px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200"
              >
                閉じる
              </button>
            </div>
          </div>

          {configDiff.changedDeviceCount === 0 && diffOnlyChanged ? (
            <p className="rounded-lg border border-slate-800 bg-[#05080f] px-3.5 py-3 font-mono text-xs text-slate-400">
              初期状態からの設定変更はまだありません（CLIで設定を変更するとここに + / - の差分が表示されます）。
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {configDiff.devices
                .filter((d) => !diffOnlyChanged || d.hasChanges)
                .map((dev) => {
                  const visibleLines = diffOnlyChanged
                    ? dev.lines.filter((l) => l.type !== "unchanged")
                    : dev.lines;
                  return (
                    <div
                      key={dev.deviceId}
                      className="rounded-xl border border-slate-800 bg-[#05080f] p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                        <span className="font-mono text-xs font-bold text-cyan-300">
                          {dev.hostname}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-[10px]">
                          <span className="text-emerald-400">
                            +{dev.addedCount}
                          </span>
                          <span className="text-rose-400">
                            -{dev.removedCount}
                          </span>
                        </div>
                      </div>
                      <pre className="terminal-scroll max-h-48 overflow-auto font-mono text-[11px] leading-relaxed">
                        {visibleLines.map((dl, lineIdx) => (
                          <div
                            key={`${dev.deviceId}-${lineIdx}-${dl.line}`}
                            className={cn(
                              "px-1.5",
                              dl.type === "added" &&
                                "bg-emerald-500/15 text-emerald-300",
                              dl.type === "removed" &&
                                "bg-rose-500/15 text-rose-300",
                              dl.type === "unchanged" && "text-slate-400",
                            )}
                          >
                            {dl.type === "added"
                              ? `+ ${dl.line}`
                              : dl.type === "removed"
                                ? `- ${dl.line}`
                                : `  ${dl.line}`}
                          </div>
                        ))}
                      </pre>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      )}

      {/* Guided Step-by-Step Companion */}
      {guideMode && !evaluation.passed && (
        <Card className="space-y-3 border-cyan-500/35 bg-cyan-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-cyan-200">
                ステップ伴走ガイド（未経験サポート）
              </h3>
              <Badge variant="cyan">
                選択中: {selectedDevice.hostname} ({selectedDevice.cliState.mode})
              </Badge>
            </div>

            {scenario.solutionCommands[0] &&
              scenario.solutionCommands[0].deviceId !== selectedDevice.id && (
                <button
                  type="button"
                  onClick={() =>
                    handleSelectDevice(scenario.solutionCommands[0].deviceId)
                  }
                  className="rounded-md border border-cyan-500/50 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/25"
                >
                  設定対象 {scenario.solutionCommands[0].hostname} へ切替
                </button>
              )}
          </div>

          <p className="text-xs leading-relaxed text-slate-200">
            {CLI_MODE_HELP[selectedDevice.cliState.mode] ??
              "選択中の機器へコマンドを入力してください。"}
          </p>

          {(() => {
            const nextGoal = evaluation.results.find((g) => !g.passed);
            return nextGoal ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#05080f] px-3 py-2 text-xs">
                <div>
                  <span className="font-mono text-[10px] font-semibold text-amber-300">
                    NEXT GOAL:{" "}
                  </span>
                  <span className="text-slate-200">{nextGoal.description}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSampleCommands((prev) => !prev)}
                  className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-cyan-500/50"
                >
                  {showSampleCommands ? "入力例を隠す" : "コマンド入力例を見る"}
                </button>
              </div>
            ) : null;
          })()}

          {showSampleCommands && (
            <div className="grid gap-2 sm:grid-cols-2">
              {scenario.solutionCommands.map((sol) => (
                <div
                  key={`guide-${sol.deviceId}`}
                  className="rounded-lg border border-slate-800 bg-[#05080f] p-2.5"
                >
                  <p className="mb-1 font-mono text-[11px] font-semibold text-cyan-300">
                    {sol.hostname} 手順例
                  </p>
                  <pre className="overflow-x-auto font-mono text-[11px] text-slate-300">
                    {sol.commands.join("\n")}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

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
          <div className="flex flex-wrap items-center justify-between gap-2.5">
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

            {snapshots.length > 1 && (
              <button
                type="button"
                onClick={handleToggleReplay}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30"
              >
                <Play className="h-3.5 w-3.5" />
                <span>自分の復旧手順をリプレイ再生</span>
              </button>
            )}
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

          {category === "troubleshoot" && (
            <div className="mt-4 space-y-3 rounded-xl border border-amber-500/35 bg-[#05080f]/90 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-200">
                  ミニ障害報告書（ポストモーテム振り返り）
                </h4>
                <Badge variant="amber">
                  クリア記録: {formatElapsedSeconds(elapsedSeconds)} /{" "}
                  {snapshots.length - 1} コマンド
                </Badge>
              </div>

              {(() => {
                const pm = scenario.postmortem ?? {
                  rootCauseQuestion:
                    "今回のインシデントの直接的な技術原因を説明しているものはどれですか？",
                  rootCauseOptions: [
                    scenario.solutionExplanation,
                    "データセンター全体の電源供給が完全に停止していたため",
                    "ブラウザのブックマークURLが古かったため",
                  ],
                  rootCauseCorrectIndex: 0,
                  preventionQuestion:
                    "同種の障害の再発防止・早期検知として実務で有効なアクションはどれですか？",
                  preventionOptions: [
                    "設定変更後の疎通・show コマンド確認チェックリストと変更前Diffレビューを標準化する",
                    "すべての監視アラート通知を無効化して対応工数を減らす",
                    "障害が起きた機器の設定確認を行わず毎日再起動する",
                  ],
                  preventionCorrectIndex: 0,
                  summary:
                    "原因特定→設定修正→疎通再確認→再発防止策の記録までを一連で回すのが現場のSRE/ネットワーク運用です。",
                };
                const pmAllSelected =
                  pmRootChoice !== null && pmPrevChoice !== null;
                const pmOk =
                  pmRootChoice === pm.rootCauseCorrectIndex &&
                  pmPrevChoice === pm.preventionCorrectIndex;

                return (
                  <div className="space-y-3 text-xs">
                    <div className="space-y-1.5">
                      <p className="font-semibold text-slate-100">
                        1. {pm.rootCauseQuestion}
                      </p>
                      <div className="grid gap-1.5">
                        {pm.rootCauseOptions.map((opt, idx) => (
                          <button
                            key={opt}
                            type="button"
                            disabled={pmSubmitted}
                            onClick={() => setPmRootChoice(idx)}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-left transition-colors",
                              !pmSubmitted && pmRootChoice === idx
                                ? "border-cyan-500 bg-cyan-500/15 text-cyan-100"
                                : !pmSubmitted
                                  ? "border-slate-800 bg-[#080d19] text-slate-300 hover:border-slate-700"
                                  : idx === pm.rootCauseCorrectIndex
                                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-100"
                                    : pmRootChoice === idx
                                      ? "border-rose-500 bg-rose-500/15 text-rose-200"
                                      : "border-slate-800/60 bg-[#060a14] text-slate-500",
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="font-semibold text-slate-100">
                        2. {pm.preventionQuestion}
                      </p>
                      <div className="grid gap-1.5">
                        {pm.preventionOptions.map((opt, idx) => (
                          <button
                            key={opt}
                            type="button"
                            disabled={pmSubmitted}
                            onClick={() => setPmPrevChoice(idx)}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-left transition-colors",
                              !pmSubmitted && pmPrevChoice === idx
                                ? "border-cyan-500 bg-cyan-500/15 text-cyan-100"
                                : !pmSubmitted
                                  ? "border-slate-800 bg-[#080d19] text-slate-300 hover:border-slate-700"
                                  : idx === pm.preventionCorrectIndex
                                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-100"
                                    : pmPrevChoice === idx
                                      ? "border-rose-500 bg-rose-500/15 text-rose-200"
                                      : "border-slate-800/60 bg-[#060a14] text-slate-500",
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {!pmSubmitted ? (
                      <button
                        type="button"
                        disabled={!pmAllSelected}
                        onClick={() => setPmSubmitted(true)}
                        className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        報告書を提出して振り返る
                      </button>
                    ) : (
                      <p
                        className={cn(
                          "rounded-lg border px-3 py-2",
                          pmOk
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-200",
                        )}
                      >
                        {pmOk ? "完璧です！ " : "振り返りポイント: "}
                        {pm.summary}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
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
            devices={Object.values(networkState.devices)}
            onSelectDevice={handleSelectDevice}
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

function LabWorkspaceInner({
  category,
  scenarios,
  initialScenarioId,
}: LabWorkspaceProps & { initialScenarioId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    initialScenarioId,
  );
  const hydrated = useHydrated();
  const completedScenarioIds = useLearningStore(
    (state) => state.completedScenarioIds,
  );
  const markScenarioCompleted = useLearningStore(
    (state) => state.markScenarioCompleted,
  );
  const recordIncidentClear = useLearningStore(
    (state) => state.recordIncidentClear,
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
                onClick={() => {
                  setActiveScenarioId(scenario.id);
                  router.replace(
                    `${pathname}?scenario=${encodeURIComponent(scenario.id)}`,
                    { scroll: false },
                  );
                }}
                className={cn(
                  "scroll-mt-20 flex items-center gap-2 rounded-xl border px-3.5 py-2 text-left text-xs font-medium transition-colors",
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
        onCompleted={(scenarioId, seconds, commandsCount) => {
          markScenarioCompleted(scenarioId);
          recordIncidentClear(scenarioId, seconds, commandsCount);
        }}
      />
    </div>
  );
}

export function LabWorkspace({ category, scenarios }: LabWorkspaceProps) {
  const searchParams = useSearchParams();
  const scenarioParam = searchParams.get("scenario");
  const matched =
    scenarioParam && scenarios.some((s) => s.id === scenarioParam)
      ? scenarioParam
      : (scenarios[0]?.id ?? "");

  return (
    <LabWorkspaceInner
      key={matched}
      category={category}
      scenarios={scenarios}
      initialScenarioId={matched}
    />
  );
}
