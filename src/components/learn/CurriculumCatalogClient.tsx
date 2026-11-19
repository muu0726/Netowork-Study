"use client";

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  LESSONS_META,
  STAGES,
  type StageAccent,
  type StageId,
} from "@/data/curriculum-meta";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import { useLearningStore } from "@/store/useLearningStore";

const ACCENT_BADGE: Record<StageAccent, BadgeVariant> = {
  cyan: "cyan",
  amber: "amber",
  violet: "violet",
};

export function CurriculumCatalogClient() {
  const [filterStage, setFilterStage] = useState<"all" | StageId>("all");
  const hydrated = useHydrated();
  const completedLessonIds = useLearningStore(
    (state) => state.completedLessonIds,
  );
  const quizScores = useLearningStore((state) => state.quizScores);

  const visibleStages =
    filterStage === "all"
      ? STAGES
      : STAGES.filter((stage) => stage.id === filterStage);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Intro & Filter Tabs */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="cyan">
              <Sparkles className="h-3 w-3" />
              Stage 1–3 全16レッスン
            </Badge>
            <Badge variant="slate">図解モード &amp; 試験コマンドモード搭載</Badge>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-50">
            体系的ネットワーク・カリキュラム
          </h2>
          <p className="max-w-2xl text-sm text-slate-400">
            全記事に「未経験向け図解モード」「試験対策コマンドモード」「専門用語ツールチップ」「章末クイズ」を備えています。
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-800 bg-[#090e1a] p-1">
          <button
            type="button"
            onClick={() => setFilterStage("all")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              filterStage === "all"
                ? "bg-cyan-500/20 text-cyan-200"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            すべて (16)
          </button>
          {STAGES.map((stage) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => setFilterStage(stage.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                filterStage === stage.id
                  ? "bg-cyan-500/20 text-cyan-200"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              {stage.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stage Sections */}
      <div className="space-y-8">
        {visibleStages.map((stage) => {
          const lessons = LESSONS_META.filter((l) => l.stage === stage.id);
          const doneCount = lessons.filter((l) =>
            completedLessonIds.includes(l.id),
          ).length;
          const pct =
            lessons.length > 0
              ? Math.round((doneCount / lessons.length) * 100)
              : 0;

          return (
            <section key={stage.id} className="space-y-4">
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ACCENT_BADGE[stage.accent]}>
                        {stage.label}
                      </Badge>
                      <h3 className="text-lg font-bold text-slate-100">
                        {stage.title}
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                      {stage.description}
                    </p>
                  </div>

                  <div className="w-full sm:w-52">
                    <div className="mb-1.5 flex items-center justify-between font-mono text-xs text-slate-400">
                      <span>進捗</span>
                      {hydrated ? (
                        <span>
                          {doneCount} / {lessons.length} ({pct}%)
                        </span>
                      ) : (
                        <span className="h-3.5 w-16 animate-pulse rounded bg-slate-800" />
                      )}
                    </div>
                    <ProgressBar
                      value={pct}
                      accent={stage.accent}
                      size="sm"
                      hydrated={hydrated}
                      ariaLabel={`${stage.label} 修了進捗`}
                    />
                  </div>
                </div>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {lessons.map((lesson, idx) => {
                  const isDone =
                    hydrated && completedLessonIds.includes(lesson.id);
                  const quiz = hydrated ? quizScores[lesson.id] : undefined;

                  return (
                    <Link
                      key={lesson.id}
                      href={`/learn/${lesson.stage}/${lesson.slug}`}
                      className="group block"
                    >
                      <Card
                        interactive
                        className="flex h-full flex-col justify-between p-5"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs text-slate-500">
                              Lesson {stage.number}.{idx + 1}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {isDone && (
                                <Badge variant="emerald">
                                  <CheckCircle2 className="h-3 w-3" />
                                  修了
                                </Badge>
                              )}
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400">
                                <Clock className="h-3 w-3" />
                                {lesson.estimatedMinutes}分
                              </span>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-base font-bold text-slate-100 transition-colors group-hover:text-cyan-200">
                              {lesson.title}
                            </h4>
                            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                              {lesson.summary}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
                          {quiz ? (
                            <span className="font-mono text-[11px] text-emerald-300">
                              Quiz Best: {quiz.bestScore}/{quiz.total}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                              <BookOpen className="h-3 w-3" />
                              記事 + クイズ
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 group-hover:text-cyan-200">
                            <span>読む</span>
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
