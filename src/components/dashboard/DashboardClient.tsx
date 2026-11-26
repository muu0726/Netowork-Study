"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  Cloud,
  Cpu,
  Flame,
  History,
  ShieldAlert,
  Sparkles,
  Target,
  Terminal,
  Wrench,
} from "lucide-react";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { SkillRadarSection } from "@/components/dashboard/SkillRadarSection";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  CLOUD_SCENARIOS_META,
  getLessonsByStage,
  getScenariosByStage,
  LESSONS_META,
  SCENARIOS_META,
  STAGES,
  TOOLS_META,
  type StageAccent,
} from "@/data/curriculum-meta";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import {
  computeLearningStreak,
  useLearningStore,
} from "@/store/useLearningStore";

const ACCENT_STYLES: Record<
  StageAccent,
  {
    badgeVariant: BadgeVariant;
    border: string;
    ctaText: string;
    dot: string;
  }
> = {
  cyan: {
    badgeVariant: "cyan",
    border: "hover:border-cyan-500/50",
    ctaText: "text-cyan-300 group-hover:text-cyan-200",
    dot: "bg-cyan-400",
  },
  amber: {
    badgeVariant: "amber",
    border: "hover:border-amber-500/50",
    dot: "bg-amber-400",
    ctaText: "text-amber-300 group-hover:text-amber-200",
  },
  violet: {
    badgeVariant: "violet",
    border: "hover:border-violet-500/50",
    dot: "bg-violet-400",
    ctaText: "text-violet-300 group-hover:text-violet-200",
  },
};

const VALID_LESSON_IDS = new Set(LESSONS_META.map((l) => l.id));
const VALID_SCENARIO_IDS = new Set([
  ...SCENARIOS_META.map((s) => s.id),
  ...CLOUD_SCENARIOS_META.map((c) => c.id),
]);

function describeVisitedPath(path: string): { label: string; subtitle: string } {
  if (path.startsWith("/learn/")) {
    const [, , stage, slug] = path.split("/");
    const matched = LESSONS_META.find(
      (l) => l.stage === stage && l.slug === slug,
    );
    if (matched) {
      return { label: matched.title, subtitle: `${matched.stage.toUpperCase()} カリキュラム` };
    }
    return { label: "カリキュラム記事", subtitle: path };
  }
  if (path.startsWith("/learn")) {
    return { label: "体系的カリキュラム一覧", subtitle: "Stage 1〜3" };
  }
  if (path.startsWith("/labs/cli")) {
    return { label: "CLI 構築ラボ", subtitle: "仮想 Cisco IOS" };
  }
  if (path.startsWith("/labs/troubleshoot")) {
    return { label: "リアル障害対応シミュレータ", subtitle: "障害チケット" };
  }
  if (path.startsWith("/labs/cloud")) {
    return { label: "クラウド VPC ラボ", subtitle: "AWS VPC / SG / NACL" };
  }
  if (path.startsWith("/labs/sandbox")) {
    return { label: "フリービルド・サンドボックス", subtitle: "自由設計ラボ" };
  }
  if (path.startsWith("/tools")) {
    return { label: "実践ミニツール＆ドリル", subtitle: "IPv4 / IPv6 / Packet" };
  }
  if (path.startsWith("/exam")) {
    return { label: "総合実力診断・模擬試験", subtitle: "6領域模試 & リベンジ" };
  }
  return { label: "前回の学習ページ", subtitle: path };
}

const STAGE_CTA: Record<
  "stage-1" | "stage-2" | "stage-3",
  { href: string; label: string }
> = {
  "stage-1": { href: "/learn", label: "基礎カリキュラムを見る" },
  "stage-2": { href: "/labs/cli", label: "CCNA CLIラボを開く" },
  "stage-3": { href: "/labs/troubleshoot", label: "障害対応に挑戦する" },
};

export function DashboardClient() {
  const hydrated = useHydrated();
  const completedLessonIds = useLearningStore(
    (state) => state.completedLessonIds,
  );
  const completedScenarioIds = useLearningStore(
    (state) => state.completedScenarioIds,
  );
  const drillStats = useLearningStore((state) => state.drillStats);
  const quizScores = useLearningStore((state) => state.quizScores);
  const lastVisitedPath = useLearningStore((state) => state.lastVisitedPath);
  const activityDates = useLearningStore(
    (state) => state.activityDates ?? [],
  );
  const wrongQuestionIds = useLearningStore(
    (state) => state.wrongQuestionIds ?? [],
  );
  const streak = hydrated
    ? computeLearningStreak(activityDates)
    : {
        currentStreak: 0,
        longestStreak: 0,
        totalActiveDays: 0,
        activeLast7Days: [],
      };
  const resumeInfo =
    hydrated && lastVisitedPath && lastVisitedPath !== "/"
      ? describeVisitedPath(lastVisitedPath)
      : null;

  const totalLessons = LESSONS_META.length;
  const totalScenarios = SCENARIOS_META.length + CLOUD_SCENARIOS_META.length;
  const totalItems = totalLessons + totalScenarios;

  const completedLessonsCount = completedLessonIds.filter((id) =>
    VALID_LESSON_IDS.has(id),
  ).length;
  const completedScenariosCount = completedScenarioIds.filter((id) =>
    VALID_SCENARIO_IDS.has(id),
  ).length;
  const completedTotal = completedLessonsCount + completedScenariosCount;
  const overallPercent =
    totalItems > 0
      ? Math.min(100, Math.round((completedTotal / totalItems) * 100))
      : 0;

  const totalDrillSolved = Object.values(drillStats).reduce(
    (acc, record) => acc + record.solved,
    0,
  );
  const isBrandNewLearner =
    hydrated &&
    completedLessonsCount === 0 &&
    completedScenariosCount === 0 &&
    totalDrillSolved === 0 &&
    Object.keys(quizScores).length === 0;

  const labCount = SCENARIOS_META.filter((s) => s.category === "lab").length;
  const ticketCount = SCENARIOS_META.filter(
    (s) => s.category === "troubleshoot",
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Hero Section */}
      <section className="bg-topo-grid relative overflow-hidden rounded-2xl border border-slate-800/90 p-6 shadow-2xl shadow-black/40 sm:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="cyan">
                <Sparkles className="h-3 w-3" />
                Immutable Virtual Network Engine
              </Badge>
              <Badge variant="emerald">CCNA &amp; NetOps Ready</Badge>
            </div>

            <div className="space-y-2.5">
              <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
                叩いて、壊して、直す。
                <span className="block text-cyan-300">
                  体験型ネットワーク学習プラットフォーム
                </span>
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-slate-300/90 sm:text-base">
                ブラウザ上で動作する純粋TypeScript製仮想ネットワークエンジンを核に、
                図解カリキュラム・Cisco IOS風CLI構築ラボ・リアル障害対応チケット・パケット解析ドリルまで一気通貫で習得できます。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/learn"
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-400"
              >
                <BookOpen className="h-4 w-4" />
                <span>Stage 1 から学ぶ</span>
              </Link>
              <Link
                href="/labs/cli"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0d1322]/90 px-4 py-2.5 text-sm font-medium text-slate-100 transition-colors hover:border-cyan-500/50 hover:text-cyan-200"
              >
                <Terminal className="h-4 w-4 text-cyan-400" />
                <span>CLIラボを試す</span>
              </Link>
              <Link
                href="/exam"
                className="inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-200 transition-colors hover:border-violet-400 hover:bg-violet-500/20"
              >
                <Target className="h-4 w-4 text-violet-300" />
                <span>総合実力診断</span>
              </Link>
            </div>
          </div>

          {/* Static Decorative Mini-Topology SVG Preview */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-slate-800/90 bg-[#05080f]/95 p-4 shadow-inner shadow-black/50">
              <div className="mb-3 flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="font-mono text-[11px] font-medium text-slate-400">
                  TOPOLOGY PREVIEW // ROAS-LAB
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  3 LINKS UP
                </span>
              </div>

              <svg
                viewBox="0 0 360 190"
                role="img"
                aria-label="ルータ・L2スイッチ・PC・サーバを接続した仮想ネットワークトポロジのプレビュー図"
                className="h-auto w-full"
              >
                {/* Links */}
                <line
                  x1="180"
                  y1="38"
                  x2="180"
                  y2="96"
                  stroke="#10b981"
                  strokeWidth="2.5"
                />
                <line
                  x1="180"
                  y1="96"
                  x2="78"
                  y2="152"
                  stroke="#10b981"
                  strokeWidth="2.5"
                />
                <line
                  x1="180"
                  y1="96"
                  x2="282"
                  y2="152"
                  stroke="#22d3ee"
                  strokeWidth="2.5"
                  strokeDasharray="5 4"
                />

                {/* Link Interface Labels */}
                <text
                  x="190"
                  y="70"
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  Gi0/0.10-20
                </text>
                <text
                  x="96"
                  y="120"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  VLAN 10
                </text>
                <text
                  x="226"
                  y="120"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  VLAN 20
                </text>

                {/* Packet indicator */}
                <circle cx="136" cy="120" r="4.5" fill="#22d3ee" />
                <circle
                  cx="136"
                  cy="120"
                  r="9"
                  fill="none"
                  stroke="#22d3ee"
                  strokeOpacity="0.35"
                  strokeWidth="1.5"
                />

                {/* Router R1 */}
                <g transform="translate(142, 12)">
                  <rect
                    width="76"
                    height="32"
                    rx="8"
                    fill="#0d1322"
                    stroke="#22d3ee"
                    strokeWidth="1.5"
                  />
                  <text
                    x="38"
                    y="20"
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="600"
                  >
                    Router R1
                  </text>
                </g>

                {/* Switch SW1 */}
                <g transform="translate(134, 80)">
                  <rect
                    width="92"
                    height="32"
                    rx="8"
                    fill="#0d1322"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                  />
                  <text
                    x="46"
                    y="20"
                    textAnchor="middle"
                    fill="#fef3c7"
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="600"
                  >
                    L2SW SW1
                  </text>
                </g>

                {/* PC-A */}
                <g transform="translate(36, 144)">
                  <rect
                    width="84"
                    height="32"
                    rx="8"
                    fill="#0d1322"
                    stroke="#334155"
                    strokeWidth="1.5"
                  />
                  <text
                    x="42"
                    y="20"
                    textAnchor="middle"
                    fill="#cbd5e1"
                    fontSize="11"
                    fontFamily="monospace"
                  >
                    PC-Sales
                  </text>
                </g>

                {/* App Server */}
                <g transform="translate(240, 144)">
                  <rect
                    width="84"
                    height="32"
                    rx="8"
                    fill="#0d1322"
                    stroke="#a78bfa"
                    strokeWidth="1.5"
                  />
                  <text
                    x="42"
                    y="20"
                    textAnchor="middle"
                    fill="#ede9fe"
                    fontSize="11"
                    fontFamily="monospace"
                  >
                    DNS/Web
                  </text>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Brand-new Learner 3-Step Onboarding Guide */}
      {isBrandNewLearner && (
        <section
          aria-label="完全未経験スタートガイド"
          className="rounded-2xl border border-cyan-500/40 bg-cyan-500/5 p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Badge variant="cyan">はじめての方へ</Badge>
              <h2 className="mt-2 text-lg font-bold text-slate-50">
                完全未経験 3ステップ・スタートガイド
              </h2>
              <p className="mt-1 text-xs text-slate-300 sm:text-sm">
                どれか1つでも進めると自動で非表示になり、進捗ダッシュボード中心の表示に切り替わります。
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Link
              href="/learn/stage-1/lan-wan"
              className="group rounded-xl border border-slate-800 bg-[#0d1322] p-4 transition-colors hover:border-cyan-500/60"
            >
              <div className="flex items-center justify-between font-mono text-[11px] text-cyan-300">
                <span>STEP 1</span>
                <span>約10分</span>
              </div>
              <p className="mt-1.5 text-sm font-bold text-slate-100 group-hover:text-cyan-200">
                LAN / WAN の全体像を図解でつかむ
              </p>
              <p className="mt-1 text-xs text-slate-400">
                スイッチとルータの役割を日常の例えで直感理解します。
              </p>
            </Link>

            <Link
              href="/labs/cli?scenario=cli-first-steps"
              className="group rounded-xl border border-slate-800 bg-[#0d1322] p-4 transition-colors hover:border-amber-500/60"
            >
              <div className="flex items-center justify-between font-mono text-[11px] text-amber-300">
                <span>STEP 2</span>
                <span>約5分</span>
              </div>
              <p className="mt-1.5 text-sm font-bold text-slate-100 group-hover:text-amber-200">
                超入門CLIラボで最初のコマンドを叩く
              </p>
              <p className="mt-1 text-xs text-slate-400">
                たった1つの設定（no shutdown）で Ping が通る体験をします。
              </p>
            </Link>

            <Link
              href="/tools?tab=subnet"
              className="group rounded-xl border border-slate-800 bg-[#0d1322] p-4 transition-colors hover:border-violet-500/60"
            >
              <div className="flex items-center justify-between font-mono text-[11px] text-violet-300">
                <span>STEP 3</span>
                <span>約5分</span>
              </div>
              <p className="mt-1.5 text-sm font-bold text-slate-100 group-hover:text-violet-200">
                32bit サブネット計算機を触ってみる
              </p>
              <p className="mt-1 text-xs text-slate-400">
                スライダーを動かして2進数境界の変化を視覚で確認します。
              </p>
            </Link>
          </div>
        </section>
      )}

      {/* Resume + Learning Streak Strip */}
      {hydrated && (resumeInfo || streak.totalActiveDays > 0 || wrongQuestionIds.length > 0) && (
        <section
          aria-label="学習再開とストリーク"
          className="grid gap-4 lg:grid-cols-12"
        >
          {resumeInfo && lastVisitedPath && (
            <Card className="flex flex-wrap items-center justify-between gap-3 border-cyan-500/35 bg-cyan-500/5 p-4 lg:col-span-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/15 text-cyan-300">
                  <History className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-cyan-300">
                    前回の続きから再開 • {resumeInfo.subtitle}
                  </p>
                  <p className="truncate text-sm font-bold text-slate-100">
                    {resumeInfo.label}
                  </p>
                </div>
              </div>
              <Link
                href={lastVisitedPath}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-400"
              >
                <span>再開する</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Card>
          )}

          <Card
            className={cn(
              "flex flex-wrap items-center justify-between gap-4 p-4",
              resumeInfo ? "lg:col-span-6" : "lg:col-span-12",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-300">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">
                  連続学習ストリーク
                </p>
                <p className="font-mono text-lg font-bold text-slate-100">
                  {streak.currentStreak} 日連続
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    (最長 {streak.longestStreak}日 / 累計 {streak.totalActiveDays}日)
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5" aria-label="直近7日間の学習記録">
                {streak.activeLast7Days.map((day) => (
                  <span
                    key={day.dateKey}
                    title={`${day.dateKey}: ${day.active ? "学習あり" : "記録なし"}`}
                    className={cn(
                      "h-4 w-4 rounded-sm border",
                      day.active
                        ? "border-emerald-400/60 bg-emerald-500/70 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                        : "border-slate-800 bg-[#05080f]",
                    )}
                  />
                ))}
              </div>
              {wrongQuestionIds.length > 0 && (
                <Link
                  href="/exam"
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/20"
                >
                  <span>誤答復習 {wrongQuestionIds.length}問</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </Card>
        </section>
      )}

      {/* KPI Metric Strip */}
      <section aria-label="学習進捗サマリー" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              総合学習進捗
            </span>
            <Activity className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-3">
            {hydrated ? (
              <p className="font-mono text-2xl font-bold text-slate-50">
                {overallPercent}%
              </p>
            ) : (
              <div className="h-8 w-20 animate-pulse rounded bg-slate-800" />
            )}
          </div>
          <div className="mt-3">
            <ProgressBar
              value={overallPercent}
              accent="cyan"
              size="sm"
              hydrated={hydrated}
              ariaLabel="総合学習進捗"
            />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              カリキュラム修了
            </span>
            <BookOpen className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            {hydrated ? (
              <p className="font-mono text-2xl font-bold text-slate-50">
                {completedLessonsCount}
                <span className="text-sm font-normal text-slate-400">
                  {" "}
                  / {totalLessons}
                </span>
              </p>
            ) : (
              <div className="h-8 w-24 animate-pulse rounded bg-slate-800" />
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Stage 1〜3 全{totalLessons}レッスン
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              ラボ・障害対応クリア
            </span>
            <CheckCircle2 className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3">
            {hydrated ? (
              <p className="font-mono text-2xl font-bold text-slate-50">
                {completedScenariosCount}
                <span className="text-sm font-normal text-slate-400">
                  {" "}
                  / {totalScenarios}
                </span>
              </p>
            ) : (
              <div className="h-8 w-24 animate-pulse rounded bg-slate-800" />
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            構築ラボ {labCount}本・障害 {ticketCount}本・VPC{" "}
            {CLOUD_SCENARIOS_META.length}本
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              ツール演習クリア数
            </span>
            <Cpu className="h-4 w-4 text-violet-400" />
          </div>
          <div className="mt-3">
            {hydrated ? (
              <p className="font-mono text-2xl font-bold text-slate-50">
                {totalDrillSolved}
                <span className="text-sm font-normal text-slate-400"> 問</span>
              </p>
            ) : (
              <div className="h-8 w-20 animate-pulse rounded bg-slate-800" />
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            サブネット / IPv6 / パケット / Diff演習
          </p>
        </Card>
      </section>

      {/* Skill Radar & Diagnostic */}
      <SkillRadarSection />

      {/* Stage 1-3 Roadmap */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Stage 1〜3 学習ロードマップ
            </h2>
            <p className="text-sm text-slate-400">
              完全未経験の基礎からCCNA試験範囲、実務の障害切り分け・自動化までを段階的に攻略します。
            </p>
          </div>
          <Link
            href="/learn"
            className="inline-flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200"
          >
            <span>全カリキュラム一覧</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {STAGES.map((stage) => {
            const stageLessons = getLessonsByStage(stage.id);
            const stageScenarios = getScenariosByStage(stage.id);
            const stageTotal = stageLessons.length + stageScenarios.length;
            const stageDone =
              stageLessons.filter((l) => completedLessonIds.includes(l.id))
                .length +
              stageScenarios.filter((s) => completedScenarioIds.includes(s.id))
                .length;
            const stagePercent =
              stageTotal > 0 ? Math.round((stageDone / stageTotal) * 100) : 0;
            const style = ACCENT_STYLES[stage.accent];
            const cta = STAGE_CTA[stage.id];

            return (
              <Card
                key={stage.id}
                interactive
                className={cn("flex flex-col justify-between p-5", style.border)}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant={style.badgeVariant}>{stage.label}</Badge>
                    {hydrated ? (
                      <span className="font-mono text-xs text-slate-400">
                        {stageDone} / {stageTotal} 完了
                      </span>
                    ) : (
                      <span className="h-4 w-16 animate-pulse rounded bg-slate-800" />
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-100">
                      {stage.title}
                    </h3>
                    <p className="mt-0.5 text-xs font-medium text-slate-400">
                      {stage.subtitle}
                    </p>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                      {stage.description}
                    </p>
                  </div>

                  <ProgressBar
                    value={stagePercent}
                    accent={stage.accent}
                    size="sm"
                    hydrated={hydrated}
                    ariaLabel={`${stage.label} 進捗`}
                  />

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {stageLessons.slice(0, 4).map((lesson) => (
                      <span
                        key={lesson.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-[#070b14] px-2 py-1 text-[11px] text-slate-300"
                      >
                        <span
                          className={cn("h-1.5 w-1.5 rounded-full", style.dot)}
                        />
                        {lesson.slug}
                      </span>
                    ))}
                    {stageLessons.length > 4 && (
                      <span className="rounded-md border border-slate-800 bg-[#070b14] px-2 py-1 font-mono text-[11px] text-slate-500">
                        +{stageLessons.length - 4}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-800/80 pt-3.5">
                  <Link
                    href={cta.href}
                    className={cn(
                      "group inline-flex items-center gap-1.5 text-xs font-semibold transition-colors",
                      style.ctaText,
                    )}
                  >
                    <span>{cta.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Quick Access Cards */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-100">
          ワークスペース・クイックアクセス
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Link href="/learn" className="group block">
            <Card interactive className="h-full p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  <BookOpen className="h-4 w-4" />
                </div>
                <Badge variant="cyan">{totalLessons} レッスン</Badge>
              </div>
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-cyan-200">
                体系的カリキュラム
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                未経験向け図解とCCNA試験コマンドを切り替えて学べる構造化教材。
              </p>
            </Card>
          </Link>

          <Link href="/labs/cli" className="group block">
            <Card interactive className="h-full p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300">
                  <Terminal className="h-4 w-4" />
                </div>
                <Badge variant="amber">{labCount} ラボ</Badge>
              </div>
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-200">
                CLI構築ラボ
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                トポロジSVGと連動する仮想Cisco IOS端末でL2/L3設計を実践構築。
              </p>
            </Card>
          </Link>

          <Link href="/labs/troubleshoot" className="group block">
            <Card interactive className="h-full p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <Badge variant="rose">{ticketCount} チケット</Badge>
              </div>
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-rose-200">
                障害対応シミュレータ
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                VLAN・DNS・ルーティング・Linux障害を実務チケット形式で復旧。
              </p>
            </Card>
          </Link>

          <Link href="/labs/cloud" className="group block">
            <Card interactive className="h-full p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300">
                  <Cloud className="h-4 w-4" />
                </div>
                <Badge variant="cyan">
                  {CLOUD_SCENARIOS_META.length} VPCラボ
                </Badge>
              </div>
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-sky-200">
                クラウドVPCラボ
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                AWS VPCのRoute Table・SG(Stateful) vs NACL(Stateless)を実践。
              </p>
            </Card>
          </Link>

          <Link href="/tools" className="group block">
            <Card interactive className="h-full p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                  <Wrench className="h-4 w-4" />
                </div>
                <Badge variant="violet">{TOOLS_META.length} ツール</Badge>
              </div>
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-violet-200">
                実践ツール＆ドリル
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                2進数サブネット計算、Wireshark風解析、コンフィグDiffレビュー演習。
              </p>
            </Card>
          </Link>

          <Link href="/labs/sandbox" className="group block">
            <Card interactive className="h-full p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  <Boxes className="h-4 w-4" />
                </div>
                <Badge variant="emerald">FREE BUILD</Badge>
              </div>
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-emerald-200">
                サンドボックス
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                機器やリンクを自由に配置・接続し、URL共有やJSON出力もできる自由ラボ。
              </p>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  );
}
