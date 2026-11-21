"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileSearch,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  WIRESHARK_DRILL_CASES,
  type CapturePacket,
  type WiresharkDrillCase,
} from "@/data/drills/wireshark-cases";
import { cn } from "@/lib/cn";
import { useLearningStore } from "@/store/useLearningStore";

const PROTOCOL_BADGE: Record<CapturePacket["protocol"], BadgeVariant> = {
  TCP: "cyan",
  ARP: "amber",
  DNS: "violet",
  ICMP: "emerald",
  HTTP: "slate",
};

function WiresharkCaseSession({
  drillCase,
}: {
  drillCase: WiresharkDrillCase;
}) {
  const [selectedPacketNo, setSelectedPacketNo] = useState<number>(
    drillCase.packets[0]?.no ?? 1,
  );
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>(
    () => {
      const init: Record<string, boolean> = {};
      for (const layer of drillCase.packets[0]?.layers ?? []) {
        init[layer.name] = true;
      }
      return init;
    },
  );
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const recordDrillAttempt = useLearningStore(
    (state) => state.recordDrillAttempt,
  );

  const activePacket =
    drillCase.packets.find((p) => p.no === selectedPacketNo) ??
    drillCase.packets[0];

  const isPacketMatch = drillCase.validPacketNos.includes(selectedPacketNo);
  const isOptionMatch = selectedOption === drillCase.correctOptionIndex;
  const isCorrect = isPacketMatch && isOptionMatch;

  const handleSelectPacket = (packet: CapturePacket) => {
    setSelectedPacketNo(packet.no);
    const nextExpanded: Record<string, boolean> = {};
    for (const layer of packet.layers) {
      nextExpanded[layer.name] = true;
    }
    setExpandedLayers(nextExpanded);
  };

  const handleSubmit = () => {
    if (selectedOption === null) {
      return;
    }
    setSubmitted(true);
    recordDrillAttempt("wireshark", isCorrect, isCorrect ? 1 : 0);
  };

  const handleReset = () => {
    setSelectedOption(null);
    setSubmitted(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="violet">難易度: {drillCase.difficulty}</Badge>
          <span className="font-mono text-xs text-slate-400">
            3ペイン・パケット解析
          </span>
        </div>
        <h3 className="mt-2 text-lg font-bold text-slate-100">
          {drillCase.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
          {drillCase.symptom}
        </p>
      </Card>

      {/* 3-Pane Wireshark Layout */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#05080f] shadow-xl">
        {/* Pane 1: Packet List */}
        <div className="border-b border-slate-800 bg-[#090e1a] px-4 py-2 font-mono text-[11px] font-semibold text-slate-300">
          1. パケット一覧 (Packet List) — クリックして詳細・16進ダンプを検査
        </div>
        <div className="terminal-scroll max-h-56 overflow-x-auto overflow-y-auto border-b border-slate-800">
          <table className="w-full min-w-[640px] text-left font-mono text-xs">
            <thead className="sticky top-0 bg-[#080d19] text-[11px] text-slate-400">
              <tr className="border-b border-slate-800">
                <th className="px-3 py-2">No.</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Destination</th>
                <th className="px-3 py-2">Protocol</th>
                <th className="px-3 py-2">Len</th>
                <th className="px-3 py-2">Info</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {drillCase.packets.map((pkt) => {
                const isSelected = pkt.no === activePacket?.no;
                return (
                  <tr
                    key={pkt.no}
                    onClick={() => handleSelectPacket(pkt)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected
                        ? "bg-cyan-500/20 text-white"
                        : pkt.severity === "error"
                          ? "bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                          : pkt.severity === "warn"
                            ? "bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                            : "text-slate-300 hover:bg-slate-900/80",
                    )}
                  >
                    <td className="px-3 py-2 font-bold">{pkt.no}</td>
                    <td className="px-3 py-2 text-slate-400">{pkt.time}</td>
                    <td className="px-3 py-2">{pkt.source}</td>
                    <td className="px-3 py-2">{pkt.destination}</td>
                    <td className="px-3 py-2">
                      <Badge variant={PROTOCOL_BADGE[pkt.protocol]}>
                        {pkt.protocol}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-400">{pkt.length}</td>
                    <td className="px-3 py-2">{pkt.info}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pane 2 & Pane 3 */}
        {activePacket && (
          <div className="grid divide-y divide-slate-800 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
            {/* Pane 2: Protocol Details */}
            <div className="lg:col-span-6">
              <div className="border-b border-slate-800 bg-[#090e1a] px-4 py-2 font-mono text-[11px] font-semibold text-slate-300">
                2. プロトコル階層詳細 (Packet #{activePacket.no})
              </div>
              <div className="terminal-scroll max-h-64 space-y-2 overflow-y-auto p-3 font-mono text-xs">
                {activePacket.layers.map((layer) => {
                  const isOpen = expandedLayers[layer.name] ?? true;
                  return (
                    <div
                      key={layer.name}
                      className={cn(
                        "rounded-lg border bg-[#080d18]",
                        layer.highlight === "error"
                          ? "border-rose-500/40"
                          : layer.highlight === "warn"
                            ? "border-amber-500/40"
                            : "border-slate-800",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedLayers((prev) => ({
                            ...prev,
                            [layer.name]: !isOpen,
                          }))
                        }
                        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-slate-200 hover:bg-slate-900/70"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        )}
                        <span className="font-bold text-cyan-300">
                          {layer.name}
                        </span>
                        <span className="truncate text-[11px] text-slate-400">
                          ({layer.summary})
                        </span>
                      </button>

                      {isOpen && (
                        <div className="space-y-1 border-t border-slate-800/80 px-4 py-2 text-[11px]">
                          {layer.fields.map((field) => (
                            <div
                              key={`${field.label}-${field.value}`}
                              className={cn(
                                "flex flex-wrap gap-2",
                                field.abnormal
                                  ? "font-semibold text-rose-300"
                                  : "text-slate-300",
                              )}
                            >
                              <span className="text-slate-500">
                                {field.label}:
                              </span>
                              <span>{field.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pane 3: Hex Dump */}
            <div className="lg:col-span-6">
              <div className="border-b border-slate-800 bg-[#090e1a] px-4 py-2 font-mono text-[11px] font-semibold text-slate-300">
                3. 16進ダンプ (Packet Bytes)
              </div>
              <pre className="terminal-scroll max-h-64 overflow-x-auto overflow-y-auto p-3.5 font-mono text-[11px] leading-relaxed text-slate-300">
                {activePacket.hexDump.join("\n")}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Answer Submission */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-slate-100">
              原因パケットと診断結果の回答
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="wireshark-packet-select"
              className="text-xs text-slate-400"
            >
              選択中の原因パケット:
            </label>
            <select
              id="wireshark-packet-select"
              name="wiresharkPacketNo"
              aria-label="原因パケット番号を選択"
              value={selectedPacketNo}
              disabled={submitted}
              onChange={(e) => {
                const no = Number(e.target.value);
                const found = drillCase.packets.find((p) => p.no === no);
                if (found) {
                  handleSelectPacket(found);
                }
              }}
              className="rounded-lg border border-slate-700 bg-[#05080f] px-2.5 py-1 font-mono text-xs text-cyan-300 focus:outline-none"
            >
              {drillCase.packets.map((p) => (
                <option key={p.no} value={p.no}>
                  No.{p.no} ({p.protocol})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {drillCase.options.map((opt, idx) => {
            const isPicked = selectedOption === idx;
            const isRight = idx === drillCase.correctOptionIndex;

            return (
              <button
                key={opt}
                type="button"
                disabled={submitted}
                onClick={() => setSelectedOption(idx)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left text-xs transition-colors sm:text-sm",
                  !submitted &&
                    (isPicked
                      ? "border-cyan-500/70 bg-cyan-500/15 text-cyan-100"
                      : "border-slate-800 bg-[#070b14] text-slate-300 hover:border-slate-700 hover:text-white"),
                  submitted &&
                    isRight &&
                    "border-emerald-500/60 bg-emerald-500/15 text-emerald-100",
                  submitted &&
                    isPicked &&
                    !isRight &&
                    "border-rose-500/60 bg-rose-500/15 text-rose-100",
                )}
              >
                <span>{opt}</span>
                {submitted && isRight && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                )}
                {submitted && isPicked && !isRight && (
                  <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
          {!submitted ? (
            <>
              <span className="text-xs text-slate-400">
                パケット一覧の行またはプルダウンで異常パケットを選び、原因を選択してください。
              </span>
              <button
                type="button"
                disabled={selectedOption === null}
                onClick={handleSubmit}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                診断を提出する
              </button>
            </>
          ) : (
            <div className="w-full space-y-3">
              <div
                className={cn(
                  "rounded-lg border p-3.5 text-xs leading-relaxed sm:text-sm",
                  isCorrect
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-100",
                )}
              >
                <p className="font-bold">
                  {isCorrect
                    ? "正解！原因パケットと障害メカニズムを正確に特定しました。"
                    : `不正解（注目パケット: No.${drillCase.targetPacketNo} / 選択した原因の解説を確認してください）`}
                </p>
                <p className="mt-1.5 text-slate-200">{drillCase.explanation}</p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070b14] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>もう一度挑戦</span>
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export function WiresharkDrill() {
  const [activeCaseId, setActiveCaseId] = useState(
    WIRESHARK_DRILL_CASES[0]?.id ?? "",
  );
  const activeCase =
    WIRESHARK_DRILL_CASES.find((c) => c.id === activeCaseId) ??
    WIRESHARK_DRILL_CASES[0];

  if (!activeCase) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {WIRESHARK_DRILL_CASES.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCaseId(c.id)}
            className={cn(
              "rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors",
              c.id === activeCase.id
                ? "border-violet-500/60 bg-violet-500/15 text-violet-100"
                : "border-slate-800 bg-[#0d1322] text-slate-300 hover:border-slate-700",
            )}
          >
            Case {idx + 1}: {c.title}
          </button>
        ))}
      </div>

      <WiresharkCaseSession key={activeCase.id} drillCase={activeCase} />
    </div>
  );
}
