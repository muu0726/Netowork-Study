"use client";

import {
  AlertCircle,
  Binary,
  Calculator,
  CheckCircle2,
  Dices,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  calculateSubnet,
  parseIpv4,
  prefixToMask,
} from "@/lib/network-engine/ip-math";
import { useLearningStore } from "@/store/useLearningStore";

type DrillQuestionType = "network" | "broadcast" | "firstHost" | "usableCount";

interface SubnetDrillQuestion {
  ip: string;
  prefix: number;
  ask: DrillQuestionType;
}

const INITIAL_DRILL_QUESTION: SubnetDrillQuestion = {
  ip: "192.168.10.75",
  prefix: 26,
  ask: "network",
};

const ASK_LABELS: Record<DrillQuestionType, string> = {
  network: "ネットワークアドレス",
  broadcast: "ブロードキャストアドレス",
  firstHost: "先頭の利用可能ホストアドレス",
  usableCount: "利用可能ホスト数 (半角数字)",
};

function createRandomDrillQuestion(): SubnetDrillQuestion {
  const prefixes = [23, 24, 25, 26, 27, 28, 29, 30];
  const askTypes: DrillQuestionType[] = [
    "network",
    "broadcast",
    "firstHost",
    "usableCount",
  ];
  const thirdOctets = [1, 10, 16, 20, 50, 120, 200];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const third = thirdOctets[Math.floor(Math.random() * thirdOctets.length)];
  const fourth = 1 + Math.floor(Math.random() * 253);
  const ask = askTypes[Math.floor(Math.random() * askTypes.length)];
  const baseFirst = prefix <= 24 ? "172.16" : "192.168";

  return {
    ip: `${baseFirst}.${third}.${fourth}`,
    prefix,
    ask,
  };
}

function getExpectedDrillAnswer(q: SubnetDrillQuestion): string {
  const info = calculateSubnet(q.ip, q.prefix);
  switch (q.ask) {
    case "network":
      return info.networkAddress;
    case "broadcast":
      return info.broadcastAddress;
    case "firstHost":
      return info.firstHost ?? "";
    case "usableCount":
      return String(info.usableHostCount);
  }
}

export function SubnetTool() {
  const [subTab, setSubTab] = useState<"calc" | "drill">("calc");

  // Calculator state
  const [ipInput, setIpInput] = useState("192.168.10.75");
  const [prefix, setPrefix] = useState(26);

  // Drill state (deterministic initial question for SSR Hydration safety)
  const [question, setQuestion] = useState<SubnetDrillQuestion>(
    INITIAL_DRILL_QUESTION,
  );
  const [answerInput, setAnswerInput] = useState("");
  const [submittedResult, setSubmittedResult] = useState<{
    correct: boolean;
    expected: string;
  } | null>(null);
  const [streak, setStreak] = useState(0);

  const recordDrillAttempt = useLearningStore(
    (state) => state.recordDrillAttempt,
  );

  const parsed = parseIpv4(ipInput.trim());
  const subnetInfo = parsed.ok
    ? calculateSubnet(ipInput.trim(), prefix)
    : null;
  const binaryOctets = subnetInfo ? subnetInfo.binaryIp.split(".") : [];

  const handleCheckDrill = () => {
    const trimmed = answerInput.trim();
    if (!trimmed) {
      return;
    }
    const expected = getExpectedDrillAnswer(question);
    const isCorrect = trimmed === expected;
    const nextStreak = isCorrect ? streak + 1 : 0;

    setStreak(nextStreak);
    setSubmittedResult({ correct: isCorrect, expected });
    recordDrillAttempt("subnet", isCorrect, nextStreak);
  };

  const handleNextDrill = () => {
    setQuestion(createRandomDrillQuestion());
    setAnswerInput("");
    setSubmittedResult(null);
  };

  const drillInfo = calculateSubnet(question.ip, question.prefix);

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-800 bg-[#090e1a] p-1">
          <button
            type="button"
            onClick={() => setSubTab("calc")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
              subTab === "calc"
                ? "bg-cyan-500/20 text-cyan-200"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>サブネット計算機 (32bit可視化)</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab("drill")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
              subTab === "drill"
                ? "bg-amber-500/20 text-amber-200"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            <Dices className="h-3.5 w-3.5" />
            <span>ランダム出題ドリル</span>
          </button>
        </div>

        {subTab === "drill" && (
          <Badge variant="amber">現在の連続正解: {streak} 問</Badge>
        )}
      </div>

      {subTab === "calc" ? (
        <div className="space-y-5">
          {/* Controls */}
          <Card className="p-5">
            <div className="grid gap-5 md:grid-cols-12">
              <div className="space-y-2 md:col-span-5">
                <label
                  htmlFor="subnet-ip-input"
                  className="block text-xs font-semibold text-slate-300"
                >
                  IPv4 アドレス
                </label>
                <input
                  id="subnet-ip-input"
                  type="text"
                  value={ipInput}
                  onChange={(e) => setIpInput(e.target.value)}
                  placeholder="例: 192.168.10.75"
                  className="w-full rounded-lg border border-slate-700 bg-[#05080f] px-3.5 py-2 font-mono text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
                {!parsed.ok && (
                  <p className="flex items-center gap-1 text-xs text-rose-300">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{parsed.error}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-7">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="cidr-slider"
                    className="text-xs font-semibold text-slate-300"
                  >
                    プレフィックス長 (CIDR):{" "}
                    <span className="font-mono text-cyan-300">/{prefix}</span>{" "}
                    <span className="font-mono text-slate-400">
                      ({prefixToMask(prefix)})
                    </span>
                  </label>
                  <div className="flex gap-1.5">
                    {[24, 26, 28, 30].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPrefix(preset)}
                        className={cn(
                          "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                          prefix === preset
                            ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-200"
                            : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200",
                        )}
                      >
                        /{preset}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  id="cidr-slider"
                  type="range"
                  min={0}
                  max={32}
                  value={prefix}
                  onChange={(e) => setPrefix(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />

                <div className="flex justify-between font-mono text-[10px] text-slate-500">
                  <span>/0</span>
                  <span>/8</span>
                  <span>/16</span>
                  <span>/24</span>
                  <span>/32</span>
                </div>
              </div>
            </div>
          </Card>

          {/* 32-bit Binary Split Visualization */}
          {subnetInfo && (
            <>
              <Card className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Binary className="h-4 w-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-slate-100">
                      32bit 2進数境界ビジュアライザ
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-cyan-300">
                      <span className="h-2.5 w-2.5 rounded-xs bg-cyan-500/40 ring-1 ring-cyan-400" />
                      ネットワーク部 ({prefix} bit)
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-amber-300">
                      <span className="h-2.5 w-2.5 rounded-xs bg-amber-500/40 ring-1 ring-amber-400" />
                      ホスト部 ({32 - prefix} bit)
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {binaryOctets.map((bits, octetIdx) => {
                    const decimalOctet = subnetInfo.ip.split(".")[octetIdx];
                    const maskOctet = subnetInfo.mask.split(".")[octetIdx];

                    return (
                      <div
                        key={`octet-${octetIdx}`}
                        className="rounded-xl border border-slate-800 bg-[#05080f] p-3"
                      >
                        <div className="mb-2 flex items-center justify-between font-mono text-xs">
                          <span className="text-slate-400">
                            Octet {octetIdx + 1}
                          </span>
                          <span className="font-bold text-slate-100">
                            {decimalOctet}{" "}
                            <span className="text-[10px] font-normal text-slate-500">
                              (Mask: {maskOctet})
                            </span>
                          </span>
                        </div>

                        <div className="grid grid-cols-8 gap-1">
                          {bits.split("").map((bit, bitIdx) => {
                            const globalIdx = octetIdx * 8 + bitIdx;
                            const isNetworkBit = globalIdx < prefix;
                            const isBoundary = globalIdx === prefix;

                            return (
                              <div
                                key={globalIdx}
                                className={cn(
                                  "flex h-7 items-center justify-center rounded border font-mono text-xs font-bold",
                                  isNetworkBit
                                    ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-200"
                                    : "border-amber-500/40 bg-amber-500/15 text-amber-200",
                                  isBoundary &&
                                    "ring-2 ring-emerald-400 ring-offset-1 ring-offset-[#05080f]",
                                )}
                              >
                                {bit}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Subnet Metrics Grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    label: "ネットワークアドレス",
                    value: `${subnetInfo.networkAddress}/${subnetInfo.prefixLength}`,
                    accent: "text-cyan-300",
                  },
                  {
                    label: "ブロードキャストアドレス",
                    value: subnetInfo.broadcastAddress,
                    accent: "text-amber-300",
                  },
                  {
                    label: "サブネットマスク / ワイルドカード",
                    value: `${subnetInfo.mask} (${subnetInfo.wildcardMask})`,
                    accent: "text-slate-100",
                  },
                  {
                    label: "利用可能ホスト範囲",
                    value:
                      subnetInfo.firstHost && subnetInfo.lastHost
                        ? `${subnetInfo.firstHost} 〜 ${subnetInfo.lastHost}`
                        : "なし (/31 point-to-point)",
                    accent: "text-emerald-300",
                  },
                  {
                    label: "利用可能ホスト数",
                    value: `${subnetInfo.usableHostCount.toLocaleString()} 台`,
                    accent: "text-emerald-300",
                  },
                  {
                    label: "総IPアドレス数",
                    value: `${subnetInfo.totalAddresses.toLocaleString()} 個`,
                    accent: "text-slate-300",
                  },
                ].map((metric) => (
                  <Card key={metric.label} className="p-4">
                    <p className="text-xs text-slate-400">{metric.label}</p>
                    <p
                      className={cn(
                        "mt-1.5 font-mono text-sm font-bold sm:text-base",
                        metric.accent,
                      )}
                    >
                      {metric.value}
                    </p>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        /* Drill Mode */
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge variant="amber">サブネット設計ドリル</Badge>
              <h3 className="mt-2 text-lg font-bold text-slate-100">
                次のIPv4アドレスから{" "}
                <span className="text-cyan-300">
                  {ASK_LABELS[question.ask]}
                </span>{" "}
                を求めてください
              </h3>
            </div>

            <button
              type="button"
              onClick={handleNextDrill}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070b14] px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-cyan-200"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>次の問題を出題</span>
            </button>
          </div>

          <div className="my-5 rounded-xl border border-slate-800 bg-[#05080f] p-5 text-center">
            <p className="font-mono text-2xl font-bold tracking-wide text-cyan-300 sm:text-3xl">
              {question.ip} /{question.prefix}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-400">
              Subnet Mask: {drillInfo.mask}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={answerInput}
              disabled={submittedResult !== null}
              onChange={(e) => setAnswerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submittedResult) {
                  handleCheckDrill();
                }
              }}
              placeholder={
                question.ask === "usableCount"
                  ? "例: 62"
                  : "例: 192.168.10.64"
              }
              aria-label="サブネット問題の回答入力"
              className="flex-1 rounded-lg border border-slate-700 bg-[#05080f] px-4 py-2.5 font-mono text-sm text-slate-100 focus:border-cyan-500 focus:outline-none disabled:opacity-70"
            />
            {submittedResult === null ? (
              <button
                type="button"
                onClick={handleCheckDrill}
                disabled={!answerInput.trim()}
                className="rounded-lg bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                判定する
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNextDrill}
                className="rounded-lg bg-amber-500 px-5 py-2.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400"
              >
                次の問題へ
              </button>
            )}
          </div>

          {submittedResult && (
            <div
              className={cn(
                "mt-5 rounded-xl border p-4 text-xs leading-relaxed sm:text-sm",
                submittedResult.correct
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-100",
              )}
            >
              <div className="flex items-center gap-2 font-bold">
                {submittedResult.correct ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>正解！</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-rose-400" />
                    <span>
                      不正解 — 正しい答え:{" "}
                      <code className="font-mono text-white">
                        {submittedResult.expected}
                      </code>
                    </span>
                  </>
                )}
              </div>

              <div className="mt-2.5 space-y-1 font-mono text-xs text-slate-200">
                <p>2進数IP: {drillInfo.binaryIp}</p>
                <p>2進数Mask: {drillInfo.binaryMask}</p>
                <p>
                  NW: {drillInfo.networkAddress} / BC:{" "}
                  {drillInfo.broadcastAddress} / ホスト範囲:{" "}
                  {drillInfo.firstHost}〜{drillInfo.lastHost} (
                  {drillInfo.usableHostCount}台)
                </p>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
