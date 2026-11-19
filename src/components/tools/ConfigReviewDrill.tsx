"use client";

import {
  CheckCircle2,
  GitCompare,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  CONFIG_REVIEW_CASES,
  type ConfigReviewCase,
} from "@/data/drills/config-review-cases";
import { cn } from "@/lib/cn";
import { useLearningStore } from "@/store/useLearningStore";

function SpofCoreTopologyDiagram() {
  return (
    <div className="bg-topo-grid overflow-hidden rounded-xl border border-slate-800 p-4">
      <svg
        viewBox="0 0 640 260"
        role="img"
        aria-label="SPOFを含む冗長化設計レビュー構成図"
        className="h-auto w-full"
      >
        {/* WAN Links */}
        <line x1={180} y1={52} x2={320} y2={130} stroke="#10b981" strokeWidth={2.2} />
        <line x1={460} y1={52} x2={320} y2={130} stroke="#10b981" strokeWidth={2.2} />

        {/* Core Links */}
        <line x1={320} y1={130} x2={180} y2={208} stroke="#10b981" strokeWidth={2.2} />
        <line x1={320} y1={130} x2={460} y2={208} stroke="#10b981" strokeWidth={2.2} />
        <line x1={180} y1={208} x2={460} y2={208} stroke="#22d3ee" strokeWidth={2} />

        {/* Edge Routers */}
        <rect x={105} y={24} width={150} height={42} rx={8} fill="#0d1322" stroke="#22d3ee" strokeWidth={1.8} />
        <text x={180} y={49} textAnchor="middle" fill="#67e8f9" fontSize={11} fontFamily="monospace" fontWeight={700}>
          Edge-Router-1 (Pri)
        </text>

        <rect x={385} y={24} width={150} height={42} rx={8} fill="#0d1322" stroke="#22d3ee" strokeWidth={1.8} />
        <text x={460} y={49} textAnchor="middle" fill="#67e8f9" fontSize={11} fontFamily="monospace" fontWeight={700}>
          Edge-Router-2 (Sec)
        </text>

        {/* Single Firewall */}
        <rect x={235} y={106} width={170} height={48} rx={10} fill="#2a0a16" stroke="#f59e0b" strokeWidth={2.2} />
        <text x={320} y={128} textAnchor="middle" fill="#fde68a" fontSize={12} fontFamily="monospace" fontWeight={700}>
          FW-Main (1台構成)
        </text>
        <text x={320} y={145} textAnchor="middle" fill="#fda4af" fontSize={10} fontFamily="monospace">
          全通信がこの1台を経由
        </text>

        {/* Core Switches */}
        <rect x={105} y={188} width={150} height={42} rx={8} fill="#0d1322" stroke="#a78bfa" strokeWidth={1.8} />
        <text x={180} y={213} textAnchor="middle" fill="#ede9fe" fontSize={11} fontFamily="monospace" fontWeight={700}>
          Core-SW1
        </text>

        <rect x={385} y={188} width={150} height={42} rx={8} fill="#0d1322" stroke="#a78bfa" strokeWidth={1.8} />
        <text x={460} y={213} textAnchor="middle" fill="#ede9fe" fontSize={11} fontFamily="monospace" fontWeight={700}>
          Core-SW2
        </text>
      </svg>
    </div>
  );
}

function ConfigReviewSession({ reviewCase }: { reviewCase: ConfigReviewCase }) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const recordDrillAttempt = useLearningStore(
    (state) => state.recordDrillAttempt,
  );

  const isCorrect = selectedOption === reviewCase.correctOptionIndex;

  const handleSubmit = () => {
    if (selectedOption === null) {
      return;
    }
    setSubmitted(true);
    recordDrillAttempt("config-review", isCorrect, isCorrect ? 1 : 0);
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={reviewCase.kind === "diff" ? "amber" : "rose"}>
            {reviewCase.kind === "diff" ? "コンフィグ Diff レビュー" : "構成図 SPOF レビュー"}
          </Badge>
          <Badge variant="slate">難易度: {reviewCase.difficulty}</Badge>
        </div>
        <h3 className="mt-2 text-lg font-bold text-slate-100">
          {reviewCase.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
          {reviewCase.scenario}
        </p>

        {/* Diff Panel */}
        {reviewCase.diffLines && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-[#05080f]">
            <div className="flex items-center gap-2 border-b border-slate-800 bg-[#090e1a] px-4 py-2 font-mono text-xs text-slate-300">
              <GitCompare className="h-3.5 w-3.5 text-amber-400" />
              <span>proposed-change.diff</span>
            </div>
            <div className="terminal-scroll overflow-x-auto py-2 font-mono text-xs">
              {reviewCase.diffLines.map((line, idx) => (
                <div
                  key={`${idx}-${line.lineNo}-${line.text}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-1",
                    line.type === "add" && "bg-emerald-500/10 text-emerald-200",
                    line.type === "remove" && "bg-rose-500/10 text-rose-200",
                    line.type === "context" && "text-slate-400",
                  )}
                >
                  <span className="w-6 shrink-0 text-right text-slate-600">
                    {line.lineNo}
                  </span>
                  <span className="w-3 shrink-0 font-bold">
                    {line.type === "add"
                      ? "+"
                      : line.type === "remove"
                        ? "-"
                        : " "}
                  </span>
                  <span className="whitespace-pre">{line.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Topology Diagram */}
        {reviewCase.topologyDiagramId === "spof-core" && (
          <div className="mt-4">
            <SpofCoreTopologyDiagram />
          </div>
        )}
      </Card>

      {/* Review Question */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-400" />
          <h4 className="text-sm font-bold text-slate-100">
            {reviewCase.question}
          </h4>
        </div>

        <div className="space-y-2">
          {reviewCase.options.map((opt, idx) => {
            const isPicked = selectedOption === idx;
            const isRight = idx === reviewCase.correctOptionIndex;

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

        <div className="mt-4 border-t border-slate-800/80 pt-4">
          {!submitted ? (
            <button
              type="button"
              disabled={selectedOption === null}
              onClick={handleSubmit}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              レビュー結果を提出
            </button>
          ) : (
            <div className="space-y-3">
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
                    ? "レビュー正解！本番障害を未然に防ぎました。"
                    : "不正解 — 正しいレビュー指摘を確認しましょう。"}
                </p>
                <p className="mt-1.5 text-slate-200">{reviewCase.explanation}</p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#05080f] p-3">
                <p className="mb-1.5 font-mono text-[11px] font-semibold text-emerald-300">
                  安全な修正例:
                </p>
                <pre className="overflow-x-auto font-mono text-xs text-slate-200">
                  {reviewCase.fixedSnippet}
                </pre>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedOption(null);
                  setSubmitted(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070b14] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>やり直す</span>
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export function ConfigReviewDrill() {
  const [activeCaseId, setActiveCaseId] = useState(
    CONFIG_REVIEW_CASES[0]?.id ?? "",
  );
  const activeCase =
    CONFIG_REVIEW_CASES.find((c) => c.id === activeCaseId) ??
    CONFIG_REVIEW_CASES[0];

  if (!activeCase) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CONFIG_REVIEW_CASES.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCaseId(c.id)}
            className={cn(
              "rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors",
              c.id === activeCase.id
                ? "border-amber-500/60 bg-amber-500/15 text-amber-100"
                : "border-slate-800 bg-[#0d1322] text-slate-300 hover:border-slate-700",
            )}
          >
            Review {idx + 1}: {c.title}
          </button>
        ))}
      </div>

      <ConfigReviewSession key={activeCase.id} reviewCase={activeCase} />
    </div>
  );
}
