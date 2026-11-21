"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  ShieldAlert,
  Shuffle,
  Target,
  Terminal,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useHydrated } from "@/hooks/useHydrated";
import {
  buildStudyPrescription,
  computeDomainMastery,
  pickRandomIncidentChallenge,
} from "@/lib/diagnostic-engine";
import { useLearningStore } from "@/store/useLearningStore";

function buildRadarPolygon(
  scores: number[],
  centerX: number,
  centerY: number,
  radius: number,
): string {
  const count = scores.length;
  return scores
    .map((score, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
      const r = (Math.max(8, score) / 100) * radius;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildGridPolygon(
  levelPct: number,
  sides: number,
  centerX: number,
  centerY: number,
  radius: number,
): string {
  const r = (levelPct / 100) * radius;
  return Array.from({ length: sides }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function SkillRadarSection() {
  const hydrated = useHydrated();
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

  const [challengeSeed, setChallengeSeed] = useState(1);

  const persistedSnapshot = {
    completedLessonIds,
    completedScenarioIds,
    quizScores,
    drillStats,
    diagnosticDomainScores,
    lastVisitedPath,
  };
  const mastery = computeDomainMastery(persistedSnapshot);
  const prescription = buildStudyPrescription(persistedSnapshot);

  const randomChallenge = pickRandomIncidentChallenge(
    challengeSeed,
    completedScenarioIds,
  );

  const cx = 190;
  const cy = 135;
  const radius = 78;
  const scores = mastery.domains.map((d) => d.score);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-100">
            分野別習熟度レーダー &amp; 実力診断
          </h2>
          <p className="text-sm text-slate-400">
            6領域のレッスン・ラボ・模擬試験結果をリアルタイム可視化し、弱点補強とランダム障害演習へ繋げます。
          </p>
        </div>
        <Link
          href="/exam"
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20"
        >
          <Target className="h-3.5 w-3.5" />
          <span>総合模擬試験を受験する</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* 6-Axis SVG Radar Chart */}
        <Card className="p-5 lg:col-span-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
              6-Domain Skill Radar
            </span>
            {hydrated ? (
              <Badge variant="cyan">総合スコア: {mastery.averageScore}%</Badge>
            ) : (
              <div className="h-5 w-24 animate-pulse rounded bg-slate-800" />
            )}
          </div>

          {hydrated ? (
            <svg
              viewBox="0 0 380 270"
              role="img"
              aria-label="分野別習熟度レーダーチャート"
              className="mx-auto h-auto w-full max-w-[380px] select-none"
            >
              {/* Concentric Grids */}
              {[25, 50, 75, 100].map((lvl) => (
                <polygon
                  key={lvl}
                  points={buildGridPolygon(lvl, 6, cx, cy, radius)}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth={lvl === 100 ? 1.4 : 1}
                  strokeDasharray={lvl === 50 ? "3 3" : undefined}
                />
              ))}

              {/* Axis Spokes & Labels */}
              {mastery.domains.map((domain, i) => {
                const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
                const ax = cx + radius * Math.cos(angle);
                const ay = cy + radius * Math.sin(angle);
                const lx = cx + (radius + 16) * Math.cos(angle);
                const ly = cy + (radius + 16) * Math.sin(angle);

                const cos = Math.cos(angle);
                const anchor =
                  Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
                const dy = i === 0 ? -4 : i === 3 ? 10 : 4;

                return (
                  <g key={domain.domainId}>
                    <line
                      x1={cx}
                      y1={cy}
                      x2={ax.toFixed(1)}
                      y2={ay.toFixed(1)}
                      stroke="#1e293b"
                      strokeWidth={1}
                    />
                    <text
                      x={lx.toFixed(1)}
                      y={(ly + dy).toFixed(1)}
                      textAnchor={anchor}
                      fill="#cbd5e1"
                      fontSize={10.5}
                      fontFamily="monospace"
                      fontWeight={600}
                    >
                      {domain.shortLabel} ({domain.score}%)
                    </text>
                  </g>
                );
              })}

              {/* User Mastery Polygon */}
              <polygon
                points={buildRadarPolygon(scores, cx, cy, radius)}
                fill="rgba(34, 211, 238, 0.22)"
                stroke="#22d3ee"
                strokeWidth={2}
              />

              {/* Vertices */}
              {scores.map((score, i) => {
                const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
                const r = (Math.max(8, score) / 100) * radius;
                const px = cx + r * Math.cos(angle);
                const py = cy + r * Math.sin(angle);
                return (
                  <circle
                    key={mastery.domains[i].domainId}
                    cx={px.toFixed(1)}
                    cy={py.toFixed(1)}
                    r={3.5}
                    fill="#22d3ee"
                    stroke="#05080f"
                    strokeWidth={1.5}
                  />
                );
              })}
            </svg>
          ) : (
            <div className="h-[240px] animate-pulse rounded-xl bg-slate-900/70" />
          )}
        </Card>

        {/* Scorebars + Weakness Focus + Random Challenge */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="space-y-3 p-5">
            <h3 className="text-sm font-bold text-slate-100">
              ドメイン別スコア内訳
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {mastery.domains.map((d) => (
                <div
                  key={d.domainId}
                  className="rounded-lg border border-slate-800/80 bg-[#080d19] p-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">
                      {d.label}
                    </span>
                    {hydrated ? (
                      <span className="font-mono font-bold text-cyan-300">
                        {d.score}%
                      </span>
                    ) : (
                      <span className="h-4 w-8 animate-pulse rounded bg-slate-800" />
                    )}
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                      style={{ width: `${hydrated ? d.score : 0}%` }}
                    />
                  </div>
                  <p className="mt-1.5 font-mono text-[10px] text-slate-500">
                    記事 {d.lessonsDone}/{d.lessonsTotal}
                    {d.scenariosTotal > 0
                      ? ` • ラボ ${d.scenariosDone}/${d.scenariosTotal}`
                      : ""}
                    {d.examTotal > 0
                      ? ` • 模試 ${d.examCorrect}/${d.examTotal}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>

            {hydrated && (
              <div className="space-y-3 rounded-xl border border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-[#080d19] to-cyan-500/5 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
                    <Compass className="h-4 w-4 text-amber-300" />
                    <span>今日の復習処方箋（弱点自動リコメンド）</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="amber">
                      重点: {prescription.targetDomain.shortLabel} (
                      {prescription.targetDomain.score}%)
                    </Badge>
                    <Badge variant="slate">
                      約{prescription.totalEstimatedMinutes}分
                    </Badge>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-300">
                  {prescription.summary}
                </p>

                <div className="grid gap-2 sm:grid-cols-3">
                  {prescription.actions.map((act) => (
                    <Link
                      key={`${act.kind}-${act.href}`}
                      href={act.href}
                      className="group flex flex-col justify-between rounded-lg border border-slate-800 bg-[#060a14] p-2.5 transition-colors hover:border-cyan-500/50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-cyan-300">
                            {act.kind === "lesson" ? (
                              <BookOpen className="h-3 w-3" />
                            ) : act.kind === "scenario" ? (
                              <Terminal className="h-3 w-3 text-amber-300" />
                            ) : (
                              <Wrench className="h-3 w-3 text-violet-300" />
                            )}
                            {act.badge}
                          </span>
                          {act.completed && (
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          )}
                        </div>
                        <p className="line-clamp-2 text-xs font-bold text-slate-100 group-hover:text-cyan-200">
                          {act.title}
                        </p>
                        <p className="line-clamp-2 text-[11px] leading-snug text-slate-400">
                          {act.reason}
                        </p>
                      </div>
                      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300">
                        <span>開く ({act.estimatedMinutes}分)</span>
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Random Incident Challenge Card */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                <span className="text-xs font-bold text-slate-100">
                  ランダム障害対応チャレンジ
                </span>
                <Badge variant="rose">{randomChallenge.difficulty}</Badge>
              </div>
              <button
                type="button"
                onClick={() => setChallengeSeed((s) => s + 1)}
                className="inline-flex items-center gap-1 rounded border border-slate-700 bg-[#080d19] px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200"
              >
                <Shuffle className="h-3 w-3" />
                別チケットを引く
              </button>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-200">
              {randomChallenge.title}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-slate-400">
              {randomChallenge.symptom}
            </p>
            <div className="mt-3 flex justify-end">
              <Link
                href={randomChallenge.deepLinkHref}
                className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
              >
                <span>{randomChallenge.categoryLabel} を開く</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
