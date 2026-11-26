"use client";

import {
  BookMarked,
  Boxes,
  Check,
  Download,
  Link2,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
  Unplug,
  Upload,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheatSheetDrawer } from "@/components/labs/CheatSheetDrawer";
import { CliTerminal, type TerminalLine } from "@/components/labs/CliTerminal";
import { TopologyCanvas } from "@/components/labs/TopologyCanvas";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  addSandboxDevice,
  connectSandboxLink,
  decodeSandboxStateFromBase64Url,
  disconnectSandboxLink,
  encodeSandboxStateToBase64Url,
  executeCommand,
  getDevicePrompt,
  isInterfaceUsedInLinks,
  parseSandboxJson,
  removeSandboxDevice,
  SANDBOX_PRESETS,
  toggleSandboxLinkUp,
  type DeviceType,
  type NetworkDevice,
  type NetworkState,
  type PacketTraceResult,
} from "@/lib/network-engine";

function buildWelcomeLine(device: NetworkDevice): TerminalLine {
  const isHost = device.type === "pc" || device.type === "server";
  return {
    id: `sb-welcome-${device.id}`,
    kind: "system",
    text: isHost
      ? `[${device.hostname}] サンドボックス端末に接続しました。ipconfig / ping / curl などを自由に実行できます。`
      : `[${device.hostname}] サンドボックス Cisco IOS に接続しました。enable → conf t で自由に構成を試せます。`,
  };
}

function initLogsForState(state: NetworkState): Record<string, TerminalLine[]> {
  const map: Record<string, TerminalLine[]> = {};
  for (const dev of Object.values(state.devices)) {
    map[dev.id] = [buildWelcomeLine(dev)];
  }
  return map;
}

function SandboxWorkspaceInner({
  initialState,
  initialBanner,
}: {
  initialState: NetworkState;
  initialBanner: string | null;
}) {
  const [networkState, setNetworkState] = useState<NetworkState>(() =>
    structuredClone(initialState),
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    () => Object.keys(initialState.devices)[0] ?? "",
  );
  const [logsByDevice, setLogsByDevice] = useState<
    Record<string, TerminalLine[]>
  >(() => initLogsForState(initialState));
  const [historyByDevice, setHistoryByDevice] = useState<
    Record<string, string[]>
  >({});
  const [commandInput, setCommandInput] = useState("");
  const [activeTrace, setActiveTrace] = useState<PacketTraceResult | null>(
    null,
  );
  const [traceRunId, setTraceRunId] = useState(0);
  const [lineSeq, setLineSeq] = useState(0);
  const [showCheatSheet, setShowCheatSheet] = useState(false);

  const devicesList = Object.values(networkState.devices);
  const selectedDevice =
    networkState.devices[selectedDeviceId] ?? devicesList[0];

  const [fromDevId, setFromDevId] = useState<string>(
    () => Object.keys(initialState.devices)[0] ?? "",
  );
  const [fromIf, setFromIf] = useState<string>("");
  const [toDevId, setToDevId] = useState<string>(
    () => Object.keys(initialState.devices)[1] ?? "",
  );
  const [toIf, setToIf] = useState<string>("");

  const [jsonPanelOpen, setJsonPanelOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(initialBanner ? { kind: "ok", text: initialBanner } : null);
  const [copiedShare, setCopiedShare] = useState(false);

  const resolvedFromDev = networkState.devices[fromDevId] ?? devicesList[0];
  const resolvedToDev =
    networkState.devices[toDevId] ?? devicesList[1] ?? devicesList[0];

  const freeFromInterfaces = resolvedFromDev
    ? Object.keys(resolvedFromDev.interfaces).filter(
        (ifName) =>
          !isInterfaceUsedInLinks(networkState, resolvedFromDev.id, ifName),
      )
    : [];
  const freeToInterfaces = resolvedToDev
    ? Object.keys(resolvedToDev.interfaces).filter(
        (ifName) =>
          !isInterfaceUsedInLinks(networkState, resolvedToDev.id, ifName),
      )
    : [];

  const effectiveFromIf = freeFromInterfaces.includes(fromIf)
    ? fromIf
    : (freeFromInterfaces[0] ?? "");
  const effectiveToIf = freeToInterfaces.includes(toIf)
    ? toIf
    : (freeToInterfaces[0] ?? "");

  const loadState = (next: NetworkState, message: string) => {
    const cloned = structuredClone(next);
    setNetworkState(cloned);
    const ids = Object.keys(cloned.devices);
    setSelectedDeviceId(ids[0] ?? "");
    setFromDevId(ids[0] ?? "");
    setToDevId(ids[1] ?? ids[0] ?? "");
    setLogsByDevice(initLogsForState(cloned));
    setHistoryByDevice({});
    setActiveTrace(null);
    setTraceRunId(0);
    setFeedback({ kind: "ok", text: message });
  };

  const handleAddDevice = (type: DeviceType) => {
    const { nextState, device } = addSandboxDevice(networkState, type);
    setNetworkState(nextState);
    setSelectedDeviceId(device.id);
    setLogsByDevice((prev) => ({
      ...prev,
      [device.id]: [buildWelcomeLine(device)],
    }));
    setFeedback({
      kind: "ok",
      text: `${device.hostname} (${type.toUpperCase()}) を追加しました。`,
    });
  };

  const handleRemoveSelectedDevice = () => {
    if (!selectedDevice || devicesList.length <= 1) {
      setFeedback({
        kind: "err",
        text: "最低 1 台の機器は残す必要があります。",
      });
      return;
    }
    const nextState = removeSandboxDevice(networkState, selectedDevice.id);
    setNetworkState(nextState);
    const remainingIds = Object.keys(nextState.devices);
    setSelectedDeviceId(remainingIds[0] ?? "");
    setActiveTrace(null);
    setFeedback({
      kind: "ok",
      text: `${selectedDevice.hostname} と接続リンクを削除しました。`,
    });
  };

  const handleConnectLink = () => {
    if (!resolvedFromDev || !resolvedToDev || !effectiveFromIf || !effectiveToIf) {
      setFeedback({
        kind: "err",
        text: "空きポートのある2台の異なる機器を選択してください。",
      });
      return;
    }
    const res = connectSandboxLink(
      networkState,
      resolvedFromDev.id,
      effectiveFromIf,
      resolvedToDev.id,
      effectiveToIf,
    );
    if (!res.ok) {
      setFeedback({ kind: "err", text: res.error });
      return;
    }
    setNetworkState(res.nextState);
    setFeedback({
      kind: "ok",
      text: `${resolvedFromDev.hostname}:${effectiveFromIf} ⇄ ${resolvedToDev.hostname}:${effectiveToIf} を接続しました。`,
    });
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
        id: `sb-cmd-${baseSeq}`,
        kind: "command",
        prompt: promptBefore,
        text: rawCommand,
      },
    ];
    if (result.output.trim().length > 0) {
      appended.push({
        id: `sb-out-${baseSeq}`,
        kind: result.output.includes("% Invalid") ||
          result.output.includes("0 percent") ||
          result.output.includes("timed out")
          ? "error"
          : result.output.includes("100 percent")
            ? "success"
            : "output",
        text: result.output,
      });
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
        return {
          ...prev,
          [selectedDevice.id]:
            prevHist[prevHist.length - 1] === trimmed
              ? prevHist
              : [...prevHist, trimmed],
        };
      });
    }
    if (result.trace) {
      setActiveTrace(result.trace);
      setTraceRunId((p) => p + 1);
    }
  };

  const handleShareUrl = async () => {
    const encoded = encodeSandboxStateToBase64Url(networkState);
    const shareUrl = `${window.location.origin}/labs/sandbox?state=${encoded}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      window.setTimeout(() => setCopiedShare(false), 1800);
      setFeedback({
        kind: "ok",
        text: "共有用URLをクリップボードへコピーしました。",
      });
    } catch {
      setJsonText(shareUrl);
      setJsonPanelOpen(true);
    }
  };

  const handleExportJson = () => {
    const json = JSON.stringify(networkState, null, 2);
    setJsonText(json);
    setJsonPanelOpen(true);
    setFeedback({
      kind: "ok",
      text: "現在のトポロジJSONを表示しました（コピーや編集して再読み込みできます）。",
    });
  };

  const handleImportJson = () => {
    const parsed = parseSandboxJson(jsonText);
    if (!parsed.ok) {
      setFeedback({ kind: "err", text: parsed.error });
      return;
    }
    loadState(parsed.state, "JSONからサンドボックス構成を読み込みました。");
    setJsonPanelOpen(false);
  };

  if (!selectedDevice) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header & Presets */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="emerald">
                <Boxes className="h-3 w-3" />
                FREE BUILD SANDBOX
              </Badge>
              <Badge variant="slate">
                機器 {devicesList.length}台 / リンク {networkState.links.length}本
              </Badge>
            </div>
            <h2 className="text-xl font-bold text-slate-50">
              フリービルド・サンドボックス
            </h2>
            <p className="max-w-3xl text-xs leading-relaxed text-slate-400 sm:text-sm">
              ルータ・L2スイッチ・PC・サーバを自由に配置・ケーブル接続し、IPv4/IPv6ルーティングやVLAN・ACL・EtherChannelを自由に検証できます。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCheatSheet(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070b14] px-3 py-2 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:text-cyan-200"
            >
              <BookMarked className="h-3.5 w-3.5 text-cyan-400" />
              <span>チートシート</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070b14] px-3 py-2 text-xs font-medium text-slate-200 hover:border-cyan-500/50"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              <span>JSON入出力</span>
            </button>
            <button
              type="button"
              onClick={handleShareUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
            >
              {copiedShare ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              <span>{copiedShare ? "URLコピー済み" : "共有URLコピー"}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                loadState(
                  SANDBOX_PRESETS[0].state,
                  "基本プリセットへリセットしました。",
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>リセット</span>
            </button>
          </div>
        </div>

        {/* Preset Strip */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-3">
          <span className="text-xs font-semibold text-slate-400">
            プリセット構成:
          </span>
          {SANDBOX_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                loadState(preset.state, `プリセット「${preset.label}」を読み込みました。`)
              }
              className="rounded-lg border border-slate-700 bg-[#070b14] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-cyan-200"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Device & Link Builder Strip */}
        <div className="grid gap-3 border-t border-slate-800/80 pt-3 lg:grid-cols-12">
          <div className="flex flex-wrap items-center gap-2 lg:col-span-5">
            <span className="text-xs font-semibold text-slate-400">
              機器を追加:
            </span>
            {(
              [
                ["router", "Router"],
                ["switch", "Switch"],
                ["pc", "PC"],
                ["server", "Server"],
              ] as const
            ).map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => handleAddDevice(type)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-[#0d1322] px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:text-cyan-200"
              >
                <Plus className="h-3 w-3 text-cyan-400" />
                <span>{label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={handleRemoveSelectedDevice}
              className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/20"
            >
              <Trash2 className="h-3 w-3" />
              <span>{selectedDevice.hostname} 削除</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:col-span-7">
            <span className="text-xs font-semibold text-slate-400">
              ケーブル接続:
            </span>
            <select
              aria-label="接続元機器"
              value={resolvedFromDev?.id ?? ""}
              onChange={(e) => setFromDevId(e.target.value)}
              className="rounded-md border border-slate-700 bg-[#05080f] px-2 py-1 font-mono text-xs text-slate-200"
            >
              {devicesList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.hostname}
                </option>
              ))}
            </select>
            <select
              aria-label="接続元ポート"
              value={effectiveFromIf}
              onChange={(e) => setFromIf(e.target.value)}
              className="rounded-md border border-slate-700 bg-[#05080f] px-2 py-1 font-mono text-xs text-slate-200"
            >
              {freeFromInterfaces.length === 0 ? (
                <option value="">空きなし</option>
              ) : (
                freeFromInterfaces.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))
              )}
            </select>
            <span className="text-xs text-slate-500">⇄</span>
            <select
              aria-label="接続先機器"
              value={resolvedToDev?.id ?? ""}
              onChange={(e) => setToDevId(e.target.value)}
              className="rounded-md border border-slate-700 bg-[#05080f] px-2 py-1 font-mono text-xs text-slate-200"
            >
              {devicesList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.hostname}
                </option>
              ))}
            </select>
            <select
              aria-label="接続先ポート"
              value={effectiveToIf}
              onChange={(e) => setToIf(e.target.value)}
              className="rounded-md border border-slate-700 bg-[#05080f] px-2 py-1 font-mono text-xs text-slate-200"
            >
              {freeToInterfaces.length === 0 ? (
                <option value="">空きなし</option>
              ) : (
                freeToInterfaces.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={handleConnectLink}
              className="inline-flex items-center gap-1 rounded-md bg-cyan-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-cyan-400"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>接続</span>
            </button>
          </div>
        </div>

        {/* Active Links List */}
        {networkState.links.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-slate-800/80 pt-3">
            {networkState.links.map((lk) => {
              const fromH =
                networkState.devices[lk.fromDeviceId]?.hostname ??
                lk.fromDeviceId;
              const toH =
                networkState.devices[lk.toDeviceId]?.hostname ?? lk.toDeviceId;
              return (
                <div
                  key={lk.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-[#05080f] px-2.5 py-1 font-mono text-[11px]"
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      lk.up ? "bg-emerald-400" : "bg-rose-400",
                    )}
                  />
                  <span className="text-slate-200">
                    {fromH}:{lk.fromInterface} ⇄ {toH}:{lk.toInterface}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setNetworkState((prev) => toggleSandboxLinkUp(prev, lk.id))
                    }
                    className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-amber-400"
                  >
                    {lk.up ? "切断テスト" : "復旧"}
                  </button>
                  <button
                    type="button"
                    aria-label={`${fromH}と${toH}のリンクを削除`}
                    onClick={() =>
                      setNetworkState((prev) =>
                        disconnectSandboxLink(prev, lk.id),
                      )
                    }
                    className="text-slate-500 hover:text-rose-400"
                  >
                    <Unplug className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {feedback && (
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-xs",
              feedback.kind === "ok"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-rose-500/40 bg-rose-500/10 text-rose-200",
            )}
          >
            {feedback.text}
          </div>
        )}

        {jsonPanelOpen && (
          <div className="space-y-2 rounded-xl border border-slate-800 bg-[#05080f] p-3">
            <label
              htmlFor="sandbox-json-textarea"
              className="block text-xs font-semibold text-slate-300"
            >
              サンドボックス構成 JSON（エクスポート / インポート）
            </label>
            <textarea
              id="sandbox-json-textarea"
              rows={6}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#070b14] p-2.5 font-mono text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setJsonPanelOpen(false)}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>このJSONを読み込む</span>
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Main 2-Pane Workspace */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <TopologyCanvas
            networkState={networkState}
            selectedDeviceId={selectedDevice.id}
            onSelectDevice={(id) => {
              setSelectedDeviceId(id);
              setCommandInput("");
            }}
            activeTrace={activeTrace}
            traceRunId={traceRunId}
            onReplayTrace={() => setTraceRunId((p) => p + 1)}
          />
        </div>

        <div className="lg:col-span-6">
          <CliTerminal
            device={selectedDevice}
            networkState={networkState}
            devices={devicesList}
            onSelectDevice={(id) => {
              setSelectedDeviceId(id);
              setCommandInput("");
            }}
            lines={logsByDevice[selectedDevice.id] ?? []}
            commandHistory={historyByDevice[selectedDevice.id] ?? []}
            inputValue={commandInput}
            onInputChange={setCommandInput}
            onExecute={handleExecuteCommand}
            onClear={() =>
              setLogsByDevice((prev) => ({
                ...prev,
                [selectedDevice.id]: [buildWelcomeLine(selectedDevice)],
              }))
            }
          />
        </div>
      </div>

      <CheatSheetDrawer
        open={showCheatSheet}
        onClose={() => setShowCheatSheet(false)}
        onInsertCommand={(cmd) => setCommandInput(cmd)}
        deviceType={selectedDevice.type}
      />
    </div>
  );
}

export function SandboxWorkspace() {
  const searchParams = useSearchParams();
  const stateParam = searchParams.get("state");
  let initialState = SANDBOX_PRESETS[0].state;
  let initialBanner: string | null = null;

  if (stateParam) {
    const decoded = decodeSandboxStateFromBase64Url(stateParam);
    if (decoded.ok) {
      initialState = decoded.state;
      initialBanner = "共有URLからサンドボックス構成を復元しました。";
    }
  }

  return (
    <SandboxWorkspaceInner
      key={stateParam ?? "default"}
      initialState={initialState}
      initialBanner={initialBanner}
    />
  );
}
