"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Shuffle,
  Target,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import {
  buildDiagnosticQuestionBank,
  buildStudyPrescription,
  DIAGNOSTIC_DOMAINS,
  generateDiagnosticExam,
  pickRandomIncidentChallenge,
  type DiagnosticQuestion,
} from "@/lib/diagnostic-engine";
import { useLearningStore } from "@/store/useLearningStore";

function ExamSession({
  questions,
  onRestart,
  mode = "mock",
}: {
  questions: DiagnosticQuestion[];
  onRestart: () => void;
  mode?: "mock" | "revenge";
}) {
  const recordQuizScore = useLearningStore((state) => state.recordQuizScore);
  const recordDiagnosticResult = useLearningStore(
    (state) => state.recordDiagnosticResult,
  );
  const recordQuestionOutcomes = useLearningStore(
    (state) => state.recordQuestionOutcomes,
  );
  const completedLessonIds = useLearningStore(
    (state) => state.completedLessonIds,
  );
  const completedScenarioIds = useLearningStore(
    (state) => state.completedScenarioIds,
  );
  const quizScores = useLearningStore((state) => state.quizScores);
  const drillStats = useLearningStore((state) => state.drillStats);
  const diagnosticDomainScores = useLearningStore(
    (state) => state.diagnosticDomainScores,
  );
  const lastVisitedPath = useLearningStore((state) => state.lastVisitedPath);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;

  const handleSelect = (qId: string, choiceIndex: number) => {
    if (submitted) {
      return;
    }
    setAnswers((prev) => ({ ...prev, [qId]: choiceIndex }));
  };

  const handleSubmit = () => {
    setSubmitted(true);
    let totalCorrect = 0;
    const domainStats: Record<string, { correct: number; total: number }> = {};
    const outcomes: Array<{ questionId: string; isCorrect: boolean }> = [];

    for (const q of questions) {
      const bucket = domainStats[q.domain] ?? { correct: 0, total: 0 };
      bucket.total += 1;
      const isOk = answers[q.id] === q.correctIndex;
      if (isOk) {
        bucket.correct += 1;
        totalCorrect += 1;
      }
      if (answers[q.id] !== undefined) {
        outcomes.push({ questionId: q.id, isCorrect: isOk });
      }
      domainStats[q.domain] = bucket;
    }

    if (outcomes.length > 0) {
      recordQuestionOutcomes(outcomes);
    }
    if (mode === "mock") {
      recordQuizScore("diagnostic-exam", totalCorrect, totalCount);
      recordDiagnosticResult(domainStats);
    }
  };

  const correctCount = questions.filter(
    (q) => answers[q.id] === q.correctIndex,
  ).length;
  const scorePct =
    totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  const prescription = submitted
    ? buildStudyPrescription({
        completedLessonIds,
        completedScenarioIds,
        quizScores,
        drillStats,
        diagnosticDomainScores,
        lastVisitedPath,
      })
    : null;

  return (
    <div className="space-y-5">
      {/* Top Progress Strip */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={mode === "revenge" ? "rose" : "cyan"}>
              {mode === "revenge"
                ? "誤答リベンジノート"
                : "CCNA & 実務 6領域模擬試験"}
            </Badge>
            <span className="font-mono text-xs text-slate-400">
              回答済み: {answeredCount} / {totalCount} 問
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {mode === "revenge"
              ? "過去に間違えた問題だけを集中的に解き直します。正解するとリベンジリストから自動的に卒業します。"
              : "全6ドメインから均等に出題されます。合格目安スコアは 80% 以上です。"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#080d19] px-3 py-2 text-xs font-medium text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {mode === "revenge" ? "誤答リストを再読込" : "別セットでやり直す"}
          </button>
          {!submitted && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={answeredCount === 0}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              採点して弱点分析する
            </button>
          )}
        </div>
      </Card>

      {/* Graded Summary Banner */}
      {submitted && (
        <Card
          className={cn(
            "space-y-4 border p-5",
            scorePct >= 80
              ? "border-emerald-500/50 bg-emerald-500/10"
              : "border-amber-500/40 bg-amber-500/10",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Award
                className={cn(
                  "h-7 w-7",
                  scorePct >= 80 ? "text-emerald-300" : "text-amber-300",
                )}
              />
              <div>
                <h3 className="text-lg font-bold text-slate-50">
                  診断結果: {correctCount} / {totalCount} 問正解 ({scorePct}%)
                </h3>
                <p className="text-xs text-slate-200">
                  {scorePct >= 80
                    ? "合格水準です! 各分野の実践ラボやクラウドVPC課題も総仕上げとして挑戦してみてください。"
                    : "誤答の解説と出題元レッスンを確認し、スコアの低いドメインを重点復習しましょう。"}
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-[#080d19] px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/15"
            >
              <span>ダッシュボードのレーダーで確認</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Domain Breakdown */}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {DIAGNOSTIC_DOMAINS.map((dom) => {
              const domQs = questions.filter((q) => q.domain === dom.id);
              if (domQs.length === 0) {
                return null;
              }
              const domOk = domQs.filter(
                (q) => answers[q.id] === q.correctIndex,
              ).length;
              const pct = Math.round((domOk / domQs.length) * 100);
              return (
                <div
                  key={dom.id}
                  className="rounded-lg border border-slate-800 bg-[#080d19]/90 p-3 text-xs"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-200">{dom.label}</span>
                    <span
                      className={cn(
                        "font-mono",
                        pct >= 80
                          ? "text-emerald-300"
                          : pct >= 50
                            ? "text-amber-300"
                            : "text-rose-300",
                      )}
                    >
                      {domOk}/{domQs.length} ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {prescription && (
            <div className="space-y-2.5 rounded-xl border border-amber-500/35 bg-[#080d19]/90 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-amber-200">
                  診断結果に基づく推奨復習ルート（{prescription.targetDomain.label}）
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  所要目安: 約{prescription.totalEstimatedMinutes}分
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {prescription.actions.map((act) => (
                  <Link
                    key={`${act.kind}-${act.href}`}
                    href={act.href}
                    className="group rounded-lg border border-slate-800 bg-[#05080f] p-2.5 text-xs transition-colors hover:border-cyan-500/50"
                  >
                    <p className="font-mono text-[10px] text-cyan-300">
                      {act.badge}
                    </p>
                    <p className="mt-1 line-clamp-1 font-bold text-slate-100 group-hover:text-cyan-200">
                      {act.title}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Question List */}
      <div className="space-y-4">
        {questions.map((q, qIdx) => {
          const picked = answers[q.id];
          const isCorrect = picked === q.correctIndex;

          return (
            <Card key={q.id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="slate">Q{qIdx + 1}</Badge>
                  <Badge variant="cyan">{q.domainLabel}</Badge>
                </div>
                {submitted && (
                  <Badge variant={isCorrect ? "emerald" : "rose"}>
                    {isCorrect ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        正解
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3" />
                        不正解
                      </>
                    )}
                  </Badge>
                )}
              </div>

              <p className="text-sm font-semibold leading-relaxed text-slate-100">
                {q.question}
              </p>

              <div className="grid gap-2">
                {q.choices.map((choice, cIdx) => {
                  const selected = picked === cIdx;
                  const rightChoice = cIdx === q.correctIndex;
                  return (
                    <button
                      key={`${q.id}-c-${cIdx}`}
                      type="button"
                      disabled={submitted}
                      onClick={() => handleSelect(q.id, cIdx)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-xs transition-colors",
                        !submitted && selected
                          ? "border-cyan-500 bg-cyan-500/15 font-semibold text-cyan-100"
                          : !submitted
                            ? "border-slate-800 bg-[#080d19] text-slate-300 hover:border-slate-700"
                            : rightChoice
                              ? "border-emerald-500 bg-emerald-500/15 font-semibold text-emerald-100"
                              : selected
                                ? "border-rose-500 bg-rose-500/15 text-rose-200"
                                : "border-slate-800/60 bg-[#060a14] text-slate-500",
                      )}
                    >
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-current font-mono text-[10px]">
                        {String.fromCharCode(65 + cIdx)}
                      </span>
                      <span>{choice}</span>
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#060a14] px-3.5 py-2.5 text-xs">
                  <p className="leading-relaxed text-slate-300">
                    <strong className="text-cyan-300">解説:</strong>{" "}
                    {q.explanation}
                  </p>
                  <Link
                    href={q.sourceHref}
                    className="inline-flex shrink-0 items-center gap-1 font-semibold text-cyan-300 hover:text-cyan-200"
                  >
                    <span>復習: {q.sourceLessonTitle}</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function DiagnosticExamWorkspace() {
  const hydrated = useHydrated();
  const completedScenarioIds = useLearningStore(
    (state) => state.completedScenarioIds,
  );
  const quizScores = useLearningStore((state) => state.quizScores);
  const wrongQuestionIds = useLearningStore(
    (state) => state.wrongQuestionIds ?? [],
  );

  const [examMode, setExamMode] = useState<"mock" | "revenge">("mock");
  const [examSeed, setExamSeed] = useState(1);
  const [revengeKey, setRevengeKey] = useState(1);
  const [ticketSeed, setTicketSeed] = useState(1);

  const allBank = buildDiagnosticQuestionBank();
  const totalBankCount = allBank.length;
  const examQuestions = generateDiagnosticExam(12, examSeed);
  const wrongQuestions = hydrated
    ? allBank.filter((q) => wrongQuestionIds.includes(q.id))
    : [];
  const challenge = pickRandomIncidentChallenge(
    ticketSeed,
    completedScenarioIds,
  );
  const bestExam = hydrated ? quizScores["diagnostic-exam"] : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="violet">
            <Target className="h-3 w-3" />
            Comprehensive Readiness Check
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-slate-50">
            総合実力診断・模擬試験モード
          </h2>
          <p className="max-w-2xl text-sm text-slate-400">
            全{totalBankCount}
            問の問題バンクから6分野均等に12問を抽出し、CCNA 合格レベル＆実務トラブルシュート耐性を測定します。
          </p>
        </div>

        <Card className="px-4 py-3">
          <p className="text-[11px] text-slate-400">これまでの模試最高スコア</p>
          {hydrated ? (
            <p className="font-mono text-lg font-bold text-cyan-300">
              {bestExam
                ? `${Math.round((bestExam.bestScore / bestExam.total) * 100)}% (${bestExam.bestScore}/${bestExam.total})`
                : "未受験"}
            </p>
          ) : (
            <div className="mt-1 h-6 w-24 animate-pulse rounded bg-slate-800" />
          )}
        </Card>
      </div>

      {/* Random Incident Roulette Card */}
      <Card className="border-rose-500/30 bg-[#0d1322] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-400" />
            <h3 className="text-base font-bold text-slate-100">
              ランダム障害対応チャレンジ（突発インシデント演習）
            </h3>
            <Badge variant="rose">{challenge.difficulty}</Badge>
          </div>
          <button
            type="button"
            onClick={() => setTicketSeed((s) => s + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#080d19] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/50"
          >
            <Shuffle className="h-3.5 w-3.5" />
            ランダムに引き直す
          </button>
        </div>

        <div className="mt-3 rounded-lg border border-slate-800 bg-[#060a14] p-4">
          <p className="font-mono text-[11px] text-cyan-300">
            {challenge.categoryLabel}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-100">
            {challenge.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {challenge.symptom}
          </p>
          <div className="mt-3 flex justify-end">
            <Link
              href={challenge.deepLinkHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-rose-400"
            >
              <span>実機シミュレータで調査を開始</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </Card>

      {/* Exam Mode Tabs */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-[#090e1a] p-1.5">
        <button
          type="button"
          onClick={() => setExamMode("mock")}
          className={cn(
            "flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition-colors sm:text-sm",
            examMode === "mock"
              ? "bg-cyan-500/20 text-cyan-200"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          総合模擬試験 (12問)
        </button>
        <button
          type="button"
          onClick={() => setExamMode("revenge")}
          className={cn(
            "flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition-colors sm:text-sm",
            examMode === "revenge"
              ? "bg-rose-500/20 text-rose-200"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          誤答リベンジノート ({hydrated ? wrongQuestions.length : 0}問)
        </button>
      </div>

      {examMode === "mock" ? (
        <ExamSession
          key={`mock-${examSeed}`}
          questions={examQuestions}
          mode="mock"
          onRestart={() => setExamSeed((s) => s + 1)}
        />
      ) : wrongQuestions.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
          <h3 className="mt-3 text-base font-bold text-slate-100">
            未克服の誤答問題はありません
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            模擬試験や各レッスンの章末クイズで間違えた問題があると、ここに自動でストックされて集中的に解き直せます。
          </p>
          <button
            type="button"
            onClick={() => setExamMode("mock")}
            className="mt-4 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
          >
            模擬試験に挑戦する
          </button>
        </Card>
      ) : (
        <ExamSession
          key={`revenge-${revengeKey}`}
          questions={wrongQuestions}
          mode="revenge"
          onRestart={() => setRevengeKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
