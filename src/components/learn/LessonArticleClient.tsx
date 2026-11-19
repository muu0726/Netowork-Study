"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GlossaryChipBar, GlossaryText } from "@/components/learn/GlossaryText";
import { LessonDiagram } from "@/components/learn/LessonDiagram";
import { LessonQuiz } from "@/components/learn/LessonQuiz";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { STAGES } from "@/data/curriculum-meta";
import type { LessonArticle } from "@/data/lessons/types";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import { useLearningStore } from "@/store/useLearningStore";

interface AdjacentSummary {
  stage: string;
  slug: string;
  title: string;
}

interface LessonArticleClientProps {
  lesson: LessonArticle;
  prevLesson: AdjacentSummary | null;
  nextLesson: AdjacentSummary | null;
}

export function LessonArticleClient({
  lesson,
  prevLesson,
  nextLesson,
}: LessonArticleClientProps) {
  const [mode, setMode] = useState<"beginner" | "exam">("beginner");
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  const hydrated = useHydrated();
  const completedLessonIds = useLearningStore(
    (state) => state.completedLessonIds,
  );
  const toggleLessonCompleted = useLearningStore(
    (state) => state.toggleLessonCompleted,
  );

  const isCompleted = hydrated && completedLessonIds.includes(lesson.id);
  const stageMeta = STAGES.find((s) => s.id === lesson.stage);

  const handleCopyCode = async (idx: number, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeIdx(idx);
      window.setTimeout(() => setCopiedCodeIdx(null), 1500);
    } catch {
      // ignore clipboard failures in restricted environments
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb & Completion Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <Link
            href="/learn"
            className="inline-flex items-center gap-1 hover:text-cyan-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>カリキュラム</span>
          </Link>
          <span>/</span>
          <Badge variant={stageMeta?.accent ?? "cyan"}>
            {stageMeta?.label ?? lesson.stage}
          </Badge>
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400">
            <Clock className="h-3 w-3" />
            約{lesson.estimatedMinutes}分
          </span>
        </div>

        <button
          type="button"
          disabled={!hydrated}
          onClick={() => toggleLessonCompleted(lesson.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
            !hydrated && "cursor-wait border-slate-800 bg-slate-900 text-slate-500",
            hydrated &&
              isCompleted &&
              "border-emerald-500/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25",
            hydrated &&
              !isCompleted &&
              "border-slate-700 bg-[#0d1322] text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200",
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>{isCompleted ? "修了済み" : "修了にする"}</span>
        </button>
      </div>

      {/* Article Header */}
      <Card className="p-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
          {lesson.title}
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-slate-300 sm:text-base">
          {lesson.summary}
        </p>

        {/* Beginner vs Exam Mode Switcher */}
        <div className="mt-5 flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-[#070b14] p-1.5">
          <button
            type="button"
            onClick={() => setMode("beginner")}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors sm:text-sm",
              mode === "beginner"
                ? "bg-cyan-500/20 text-cyan-200 shadow-inner shadow-cyan-500/10"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            <Eye className="h-4 w-4" />
            <span>未経験向け図解モード</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("exam")}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors sm:text-sm",
              mode === "exam"
                ? "bg-amber-500/20 text-amber-200 shadow-inner shadow-amber-500/10"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            <Terminal className="h-4 w-4" />
            <span>試験対策コマンドモード</span>
          </button>
        </div>
      </Card>

      {/* Main Mode Body */}
      {mode === "beginner" ? (
        <div className="space-y-5">
          <LessonDiagram variant={lesson.diagramVariant} />

          <GlossaryChipBar glossary={lesson.glossary} />

          <Card className="border-cyan-500/30 bg-cyan-500/5 p-5 sm:p-6">
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cyan-400" />
              <h2 className="text-base font-bold text-cyan-200">
                {lesson.beginnerMode.analogyTitle}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-200">
              <GlossaryText
                text={lesson.beginnerMode.analogyText}
                glossary={lesson.glossary}
              />
            </p>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            {lesson.beginnerMode.keyPoints.map((kp) => (
              <Card key={kp.title} className="p-4">
                <h3 className="text-sm font-bold text-slate-100">{kp.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  <GlossaryText text={kp.body} glossary={lesson.glossary} />
                </p>
              </Card>
            ))}
          </div>

          <Card className="p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-bold text-slate-100">
              通信・仕組みのステップ分解
            </h3>
            <ol className="space-y-2.5">
              {lesson.beginnerMode.steps.map((stepText, idx) => (
                <li
                  key={stepText}
                  className="flex items-start gap-3 rounded-lg border border-slate-800 bg-[#070b14] p-3 text-xs leading-relaxed text-slate-200 sm:text-sm"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-mono text-[11px] font-bold text-cyan-300">
                    {idx + 1}
                  </span>
                  <span>
                    <GlossaryText text={stepText} glossary={lesson.glossary} />
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Exam Tips */}
          <Card className="border-amber-500/30 bg-amber-500/5 p-5 sm:p-6">
            <h2 className="mb-3 text-base font-bold text-amber-200">
              CCNA・実務 重要ポイント
            </h2>
            <ul className="space-y-2 text-sm leading-relaxed text-slate-200">
              {lesson.examMode.examTips.map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Reference Table */}
          <Card className="overflow-hidden">
            <div className="border-b border-slate-800 bg-[#090e1a] px-5 py-3">
              <h3 className="text-sm font-bold text-slate-100">
                整理リファレンス表
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-slate-800 bg-[#070b14] text-slate-300">
                  <tr>
                    {lesson.examMode.referenceTable.headers.map((header) => (
                      <th key={header} className="px-4 py-2.5 font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {lesson.examMode.referenceTable.rows.map((row) => (
                    <tr key={row.join("|")} className="hover:bg-slate-900/40">
                      {row.map((cell, cIdx) => (
                        <td
                          key={`${cIdx}-${cell}`}
                          className={cn(
                            "px-4 py-2.5",
                            cIdx === 0
                              ? "font-mono font-semibold text-cyan-300"
                              : "text-slate-300",
                          )}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Command Blocks */}
          <div className="space-y-4">
            {lesson.examMode.commandBlocks.map((block, idx) => (
              <Card key={block.title} className="overflow-hidden">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-[#090e1a] px-4 py-2.5">
                  <span className="text-xs font-bold text-slate-200">
                    {block.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(idx, block.code)}
                    className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-[11px] text-slate-300 hover:border-cyan-500/50"
                  >
                    {copiedCodeIdx === idx ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="terminal-scroll overflow-x-auto bg-[#05080f] p-4 font-mono text-xs leading-relaxed text-cyan-200">
                  {block.code}
                </pre>
                <div className="border-t border-slate-800/80 bg-[#0d1322] px-4 py-2.5 text-xs text-slate-400">
                  {block.note}
                </div>
              </Card>
            ))}
          </div>

          {/* Pitfalls */}
          <Card className="border-rose-500/30 bg-rose-500/5 p-5">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <h3 className="text-sm font-bold text-rose-200">
                よくある引っ掛け・実務ミス
              </h3>
            </div>
            <ul className="space-y-1.5 text-xs leading-relaxed text-rose-100/90 sm:text-sm">
              {lesson.examMode.pitfalls.map((pitfall) => (
                <li key={pitfall}>・{pitfall}</li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Related Practical Link */}
      {lesson.relatedHref && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-cyan-500/30 bg-[#09101f] p-4">
          <div className="flex items-center gap-2.5 text-sm font-medium text-slate-200">
            <Terminal className="h-4 w-4 text-cyan-400" />
            <span>学んだ内容をそのまま体験してみましょう</span>
          </div>
          <Link
            href={lesson.relatedHref.href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3.5 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-500/40 transition-colors hover:bg-cyan-500/25"
          >
            <span>{lesson.relatedHref.label}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      )}

      {/* Chapter Quiz */}
      <LessonQuiz key={lesson.id} lessonId={lesson.id} questions={lesson.quiz} />

      {/* Prev / Next Navigation */}
      <div className="grid gap-3 sm:grid-cols-2">
        {prevLesson ? (
          <Link
            href={`/learn/${prevLesson.stage}/${prevLesson.slug}`}
            className="group rounded-xl border border-slate-800 bg-[#0d1322] p-4 transition-colors hover:border-cyan-500/50"
          >
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500">
              <ArrowLeft className="h-3 w-3" />
              前のレッスン
            </span>
            <p className="mt-1 text-sm font-semibold text-slate-200 group-hover:text-cyan-200">
              {prevLesson.title}
            </p>
          </Link>
        ) : (
          <div />
        )}

        {nextLesson && (
          <Link
            href={`/learn/${nextLesson.stage}/${nextLesson.slug}`}
            className="group rounded-xl border border-slate-800 bg-[#0d1322] p-4 text-right transition-colors hover:border-cyan-500/50"
          >
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500">
              次のレッスン
              <ArrowRight className="h-3 w-3" />
            </span>
            <p className="mt-1 text-sm font-semibold text-slate-200 group-hover:text-cyan-200">
              {nextLesson.title}
            </p>
          </Link>
        )}
      </div>
    </div>
  );
}
