"use client";

import { CheckCircle2, HelpCircle, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { LessonQuizQuestion } from "@/data/lessons/types";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import { useLearningStore } from "@/store/useLearningStore";

interface LessonQuizProps {
  lessonId: string;
  questions: LessonQuizQuestion[];
}

export function LessonQuiz({ lessonId, questions }: LessonQuizProps) {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const hydrated = useHydrated();
  const bestRecord = useLearningStore((state) => state.quizScores[lessonId]);
  const recordQuizScore = useLearningStore((state) => state.recordQuizScore);
  const recordQuestionOutcomes = useLearningStore(
    (state) => state.recordQuestionOutcomes,
  );
  const markLessonCompleted = useLearningStore(
    (state) => state.markLessonCompleted,
  );

  const answeredCount = questions.filter(
    (q) => selected[q.id] !== undefined,
  ).length;
  const allAnswered = answeredCount === questions.length;

  const score = questions.reduce(
    (acc, q) => acc + (selected[q.id] === q.correctIndex ? 1 : 0),
    0,
  );

  const handleSubmit = () => {
    if (!allAnswered) {
      return;
    }
    setSubmitted(true);
    recordQuizScore(lessonId, score, questions.length);
    recordQuestionOutcomes(
      questions.map((q) => ({
        questionId: `${lessonId}:${q.id}`,
        isCorrect: selected[q.id] === q.correctIndex,
      })),
    );
    if (questions.length > 0 && score / questions.length >= 0.6) {
      markLessonCompleted(lessonId);
    }
  };

  const handleReset = () => {
    setSelected({});
    setSubmitted(false);
  };

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-cyan-400" />
          <div>
            <h3 className="text-base font-bold text-slate-100">
              章末理解度クイズ ({questions.length}問)
            </h3>
            <p className="text-xs text-slate-400">
              正答率60%以上でレッスンが自動的に「修了済み」になります
            </p>
          </div>
        </div>

        {hydrated && bestRecord && (
          <Badge variant="emerald">
            ベストスコア: {bestRecord.bestScore} / {bestRecord.total}
          </Badge>
        )}
      </div>

      <div className="space-y-5">
        {questions.map((q, qIdx) => {
          const picked = selected[q.id];
          const isCorrect = submitted && picked === q.correctIndex;

          return (
            <div
              key={q.id}
              className="rounded-xl border border-slate-800/90 bg-[#070b14] p-4"
            >
              <p className="text-sm font-semibold text-slate-100">
                Q{qIdx + 1}. {q.question}
              </p>

              <div className="mt-3 space-y-2">
                {q.choices.map((choice, cIdx) => {
                  const isPicked = picked === cIdx;
                  const isRightChoice = cIdx === q.correctIndex;

                  return (
                    <button
                      key={choice}
                      type="button"
                      disabled={submitted}
                      onClick={() =>
                        setSelected((prev) => ({ ...prev, [q.id]: cIdx }))
                      }
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left text-xs transition-colors sm:text-sm",
                        !submitted &&
                          (isPicked
                            ? "border-cyan-500/70 bg-cyan-500/15 text-cyan-100"
                            : "border-slate-800 bg-[#0d1322] text-slate-300 hover:border-slate-700 hover:text-white"),
                        submitted &&
                          isRightChoice &&
                          "border-emerald-500/60 bg-emerald-500/15 text-emerald-100",
                        submitted &&
                          isPicked &&
                          !isRightChoice &&
                          "border-rose-500/60 bg-rose-500/15 text-rose-100",
                        submitted &&
                          !isPicked &&
                          !isRightChoice &&
                          "border-slate-800/60 bg-[#090e1a] text-slate-500",
                      )}
                    >
                      <span>{choice}</span>
                      {submitted && isRightChoice && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      )}
                      {submitted && isPicked && !isRightChoice && (
                        <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <div
                  className={cn(
                    "mt-3 rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
                    isCorrect
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-100",
                  )}
                >
                  <span className="font-bold">
                    {isCorrect ? "正解！" : "解説:"}{" "}
                  </span>
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
        {!submitted ? (
          <>
            <span className="text-xs text-slate-400">
              回答済み: {answeredCount} / {questions.length}
            </span>
            <button
              type="button"
              disabled={!allAnswered}
              onClick={handleSubmit}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              採点する
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Badge
                variant={score === questions.length ? "emerald" : "amber"}
              >
                結果: {score} / {questions.length} 問正解
              </Badge>
              {score / questions.length >= 0.6 && (
                <span className="text-xs font-medium text-emerald-300">
                  レッスン修了を記録しました
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070b14] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-cyan-500/50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>解き直す</span>
            </button>
          </>
        )}
      </div>
    </Card>
  );
}
