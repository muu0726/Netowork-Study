"use client";

import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Globe,
  HelpCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  analyzeIpv6,
  areIpv6Equal,
  generateIpv6ConversionDrill,
  generateIpv6TypeQuiz,
  isCanonicalCompressedIpv6,
  parseIpv6,
  type Ipv6AddressType,
} from "@/lib/network-engine";
import { useLearningStore } from "@/store/useLearningStore";

type Ipv6Tab = "visualizer" | "conversion-drill" | "type-quiz";

const PRESETS = [
  {
    label: "基本圧縮",
    value: "2001:0db8:0000:0000:0000:0000:0000:0001",
  },
  {
    label: "2箇所の0省略 (RFC 5952)",
    value: "2001:0db8:0000:0001:0000:0000:0000:0001",
  },
  {
    label: "リンクローカル",
    value: "fe80::20c:29ff:fe10:1",
  },
  {
    label: "ユニークローカル",
    value: "fd12:3456:0000:0000:0000:0000:0000:00ff",
  },
  {
    label: "マルチキャスト",
    value: "ff02::1",
  },
];

export function Ipv6Tool() {
  const recordDrillAttempt = useLearningStore(
    (state) => state.recordDrillAttempt,
  );

  const [activeTab, setActiveTab] = useState<Ipv6Tab>("visualizer");

  // Tab 1: Visualizer
  const [inputAddress, setInputAddress] = useState(
    "2001:0db8:0000:0001:0000:0000:0000:0001",
  );
  const parseRes = parseIpv6(inputAddress);
  const analysis = parseRes.ok ? analyzeIpv6(inputAddress) : null;

  // Tab 2: Conversion Drill (deterministic initial seed = 1 to prevent Hydration mismatch)
  const [convSeed, setConvSeed] = useState(1);
  const [convMode, setConvMode] = useState<"compress" | "expand">("compress");
  const [convInput, setConvInput] = useState("");
  const [convFeedback, setConvFeedback] = useState<{
    correct: boolean;
    message: string;
  } | null>(null);
  const [convStreak, setConvStreak] = useState(0);

  const convDrill = generateIpv6ConversionDrill(convSeed, convMode);

  // Tab 3: Address Type Quiz (deterministic initial seed = 1)
  const [typeSeed, setTypeSeed] = useState(1);
  const [selectedTypeChoice, setSelectedTypeChoice] =
    useState<Ipv6AddressType | null>(null);
  const typeQuiz = generateIpv6TypeQuiz(typeSeed);

  const handleCheckConversion = () => {
    const trimmed = convInput.trim();
    if (!trimmed) {
      return;
    }
    const isCorrect =
      convMode === "compress"
        ? areIpv6Equal(trimmed, convDrill.expectedAnswer) &&
          isCanonicalCompressedIpv6(trimmed)
        : trimmed.toLowerCase() === convDrill.expectedAnswer.toLowerCase();

    const nextStreak = isCorrect ? convStreak + 1 : 0;
    setConvStreak(nextStreak);
    recordDrillAttempt("ipv6", isCorrect, nextStreak);
    setConvFeedback({
      correct: isCorrect,
      message: isCorrect
        ? `正解! RFC 5952 準拠の表記です (${convDrill.expectedAnswer})`
        : areIpv6Equal(trimmed, convDrill.expectedAnswer)
          ? `アドレス値は同じですが RFC 5952 の最短圧縮形ではありません。正解: ${convDrill.expectedAnswer}`
          : `不正解。正解は ${convDrill.expectedAnswer} です。`,
    });
  };

  const handleNextConversion = (nextMode = convMode) => {
    setConvMode(nextMode);
    setConvSeed((s) => s + 1);
    setConvInput("");
    setConvFeedback(null);
  };

  const handleSelectType = (choice: Ipv6AddressType) => {
    if (selectedTypeChoice !== null) {
      return;
    }
    setSelectedTypeChoice(choice);
    const isCorrect = choice === typeQuiz.expectedType;
    recordDrillAttempt("ipv6", isCorrect, isCorrect ? 1 : 0);
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {[
          {
            id: "visualizer" as const,
            label: "圧縮 ↔ 展開 ビジュアライザ",
          },
          {
            id: "conversion-drill" as const,
            label: "圧縮・展開 出題ドリル",
          },
          {
            id: "type-quiz" as const,
            label: "アドレス種別 識別クイズ",
          },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors",
              activeTab === t.id
                ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-200"
                : "border-slate-800 bg-[#0d1322] text-slate-400 hover:text-slate-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Visualizer */}
      {activeTab === "visualizer" && (
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <div className="space-y-2">
              <label
                htmlFor="ipv6-input"
                className="flex items-center justify-between text-xs font-semibold text-slate-300"
              >
                <span>IPv6 アドレス入力（展開形 / 圧縮形のどちらでも可）</span>
                <span className="font-mono text-[11px] text-slate-500">
                  RFC 4291 / RFC 5952
                </span>
              </label>
              <input
                id="ipv6-input"
                name="ipv6Address"
                type="text"
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value)}
                placeholder="例: 2001:0db8:0000:0001::1"
                className="w-full rounded-lg border border-slate-700 bg-[#05080f] px-3.5 py-2.5 font-mono text-sm text-cyan-200 focus:border-cyan-500 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setInputAddress(p.value)}
                    className="rounded-md border border-slate-800 bg-[#080d19] px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-200"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {!parseRes.ok && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{parseRes.error}</span>
              </div>
            )}

            {analysis && (
              <div className="space-y-5 pt-2">
                {/* Summary Boxes */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-[#080d19] p-3.5">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      完全展開表記 (128bit Full Form)
                    </p>
                    <p className="mt-1.5 break-all font-mono text-sm font-bold text-slate-100">
                      {analysis.expanded}
                    </p>
                  </div>
                  <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/5 p-3.5">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                      最短圧縮表記 (RFC 5952 Canonical)
                    </p>
                    <p className="mt-1.5 break-all font-mono text-sm font-bold text-cyan-200">
                      {analysis.compressed}
                    </p>
                  </div>
                </div>

                {/* Visual 8-Group Rule Highlighter */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-300">
                      8グループ（各16bit）ルール別ハイライト
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded bg-amber-500/40 border border-amber-400" />
                        先頭ゼロ省略対象
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded bg-violet-500/40 border border-violet-400" />
                        最長連続ゼロ (::)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                    {analysis.expandedGroups.map((g) => {
                      const inZeroRun =
                        analysis.zeroRun !== null &&
                        g.index >= analysis.zeroRun.start &&
                        g.index < analysis.zeroRun.start + analysis.zeroRun.length;

                      return (
                        <div
                          key={g.index}
                          className={cn(
                            "rounded-lg border p-2.5 text-center font-mono",
                            inZeroRun
                              ? "border-violet-500/60 bg-violet-500/15"
                              : "border-slate-800 bg-[#060a14]",
                          )}
                        >
                          <p className="text-[10px] text-slate-500">
                            Block {g.index + 1}
                          </p>
                          <p className="mt-1 text-sm font-bold tracking-wider">
                            {g.leadingZeros && (
                              <span className="rounded bg-amber-500/20 px-0.5 text-amber-300 line-through">
                                {g.leadingZeros}
                              </span>
                            )}
                            <span
                              className={
                                inZeroRun ? "text-violet-200" : "text-cyan-200"
                              }
                            >
                              {g.trimmed}
                            </span>
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {inZeroRun ? ":: へ圧縮" : `→ ${g.trimmed}`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Type Classification Banner */}
                <div className="rounded-xl border border-slate-800 bg-[#080d19] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Globe className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-bold text-slate-100">
                      {analysis.typeInfo.label}
                    </span>
                    <Badge variant="emerald">{analysis.typeInfo.range}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    {analysis.typeInfo.description}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Conversion Drill */}
      {activeTab === "conversion-drill" && (
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="cyan">
                <ArrowRightLeft className="h-3 w-3" />
                {convMode === "compress" ? "展開形 → 最短圧縮" : "圧縮形 → 完全展開"}
              </Badge>
              <Badge variant="amber">連続正解: {convStreak}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  handleNextConversion(
                    convMode === "compress" ? "expand" : "compress",
                  )
                }
                className="rounded-lg border border-slate-700 bg-[#080d19] px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500/50"
              >
                モード切替 ({convMode === "compress" ? "完全展開へ" : "圧縮へ"})
              </button>
              <button
                type="button"
                onClick={() => handleNextConversion()}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                次の問題
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#05080f] p-4">
            <p className="text-xs text-slate-400">
              次の IPv6 アドレスを{" "}
              <strong className="text-cyan-200">
                {convMode === "compress"
                  ? "RFC 5952 準拠の最短圧縮形"
                  : "4桁×8グループの完全展開形"}
              </strong>{" "}
              に変換してください:
            </p>
            <p className="mt-2 break-all font-mono text-base font-bold text-slate-100">
              {convDrill.promptAddress}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="ipv6-drill-answer" className="block flex-1">
              <span className="sr-only">IPv6変換ドリルの回答入力</span>
              <input
                id="ipv6-drill-answer"
                name="ipv6DrillAnswer"
                type="text"
                value={convInput}
                onChange={(e) => setConvInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCheckConversion();
                  }
                }}
                placeholder={
                  convMode === "compress"
                    ? "例: 2001:db8::1"
                    : "例: 2001:0db8:0000:..."
                }
                className="w-full rounded-lg border border-slate-700 bg-[#05080f] px-3.5 py-2 font-mono text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={handleCheckConversion}
              className="rounded-lg bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
            >
              回答をチェック
            </button>
          </div>

          <p className="flex items-start gap-1.5 text-xs text-slate-400">
            <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>{convDrill.hint}</span>
          </p>

          {convFeedback && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-medium",
                convFeedback.correct
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200",
              )}
            >
              {convFeedback.correct ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>{convFeedback.message}</span>
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: Address Type Identification Quiz */}
      {activeTab === "type-quiz" && (
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="violet">
              <Sparkles className="h-3 w-3" />
              IPv6 アドレス種別判定クイズ
            </Badge>
            <button
              type="button"
              onClick={() => {
                setTypeSeed((s) => s + 1);
                setSelectedTypeChoice(null);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              次のアドレスを出題
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#05080f] p-4">
            <p className="text-xs text-slate-400">
              次の IPv6 アドレスが分類されるアドレス種別を選んでください:
            </p>
            <p className="mt-2 font-mono text-lg font-bold text-cyan-200">
              {typeQuiz.address}
            </p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {typeQuiz.choices.map((c) => {
              const isSelected = selectedTypeChoice === c.type;
              const isCorrectChoice = c.type === typeQuiz.expectedType;
              const answered = selectedTypeChoice !== null;

              return (
                <button
                  key={c.type}
                  type="button"
                  disabled={answered}
                  onClick={() => handleSelectType(c.type)}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left text-xs font-semibold transition-colors",
                    !answered &&
                      "border-slate-800 bg-[#080d19] text-slate-200 hover:border-cyan-500/50",
                    answered &&
                      isCorrectChoice &&
                      "border-emerald-500 bg-emerald-500/15 text-emerald-200",
                    answered &&
                      isSelected &&
                      !isCorrectChoice &&
                      "border-rose-500 bg-rose-500/15 text-rose-200",
                    answered &&
                      !isSelected &&
                      !isCorrectChoice &&
                      "border-slate-800/60 bg-[#060a14] text-slate-500",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {selectedTypeChoice !== null && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs leading-relaxed text-slate-200">
              <strong className="text-cyan-300">解説:</strong>{" "}
              {typeQuiz.explanation}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
