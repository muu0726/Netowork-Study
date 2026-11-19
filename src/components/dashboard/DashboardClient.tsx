"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cloud,
  Cpu,
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
import { useLearningStore } from "@/store/useLearningStore";

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

  const totalLessons = LESSONS_META.length;
  const totalScenarios = SCENARIOS_META.length + CLOUD_SCENARIOS_META.length;
  const totalItems = totalLessons + totalScenarios;

  const completedLessonsCount = completedLessonIds.length;
  const completedScenariosCount = completedScenarioIds.length;
  const completedTotal = completedLessonsCount + completedScenariosCount;
  const overallPercent =
    totalItems > 0 ? Math.round((completedTotal / totalItems) * 100) : 0;

  const totalDrillSolved = Object.values(drillStats).reduce(
    (acc, record) => acc + record.solved,
    0,
  );

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
            構築ラボ {labCount}本・障害チケット {ticketCount}本
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        </div>
      </section>
    </div>
  );
}
