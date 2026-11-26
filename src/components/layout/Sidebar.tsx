"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Cloud,
  DatabaseBackup,
  LayoutDashboard,
  Network,
  ShieldAlert,
  Target,
  Terminal,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { ProgressBackupModal } from "@/components/dashboard/ProgressBackupModal";
import { cn } from "@/lib/cn";
import {
  CLOUD_SCENARIOS_META,
  LESSONS_META,
  SCENARIOS_META,
} from "@/data/curriculum-meta";
import { useHydrated } from "@/hooks/useHydrated";
import { useLearningStore } from "@/store/useLearningStore";
import { ProgressBar } from "@/components/dashboard/ProgressBar";

interface NavItem {
  href: string;
  label: string;
  sublabel: string;
  icon: typeof LayoutDashboard;
}

const VALID_LESSON_IDS = new Set(LESSONS_META.map((l) => l.id));
const VALID_SCENARIO_IDS = new Set([
  ...SCENARIOS_META.map((s) => s.id),
  ...CLOUD_SCENARIOS_META.map((c) => c.id),
]);

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "ダッシュボード",
    sublabel: "Overview & Roadmap",
    icon: LayoutDashboard,
  },
  {
    href: "/learn",
    label: "カリキュラム",
    sublabel: "Stage 1–3 Lessons",
    icon: BookOpen,
  },
  {
    href: "/labs/cli",
    label: "CLI構築ラボ",
    sublabel: "Virtual IOS Lab",
    icon: Terminal,
  },
  {
    href: "/labs/troubleshoot",
    label: "障害対応シミュレータ",
    sublabel: "Incident Tickets",
    icon: ShieldAlert,
  },
  {
    href: "/labs/cloud",
    label: "クラウドVPCラボ",
    sublabel: "AWS VPC / SG / NACL",
    icon: Cloud,
  },
  {
    href: "/tools",
    label: "実践ツール＆ドリル",
    sublabel: "IPv4 / IPv6 / Packet",
    icon: Wrench,
  },
  {
    href: "/exam",
    label: "総合実力診断",
    sublabel: "Mock Exam & Radar",
    icon: Target,
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const [backupOpen, setBackupOpen] = useState(false);
  const completedLessonIds = useLearningStore(
    (state) => state.completedLessonIds,
  );
  const completedScenarioIds = useLearningStore(
    (state) => state.completedScenarioIds,
  );

  const totalItems =
    LESSONS_META.length + SCENARIOS_META.length + CLOUD_SCENARIOS_META.length;
  const completedCount =
    completedLessonIds.filter((id) => VALID_LESSON_IDS.has(id)).length +
    completedScenarioIds.filter((id) => VALID_SCENARIO_IDS.has(id)).length;
  const overallPercent =
    totalItems > 0
      ? Math.min(100, Math.round((completedCount / totalItems) * 100))
      : 0;

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-800/90 bg-[#080d19]">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800/90 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.18)]">
          <Network className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-slate-100">
            NetForge
          </p>
          <p className="truncate font-mono text-[11px] text-cyan-400/90">
            CCNA &amp; NetOps Lab
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav
        aria-label="メインナビゲーション"
        className="terminal-scroll flex-1 space-y-1.5 overflow-y-auto px-3 py-4"
      >
        <p className="px-3 pb-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Workspace
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                isActive
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200 shadow-inner shadow-cyan-500/5"
                  : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900/70 hover:text-slate-100",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive
                    ? "text-cyan-300"
                    : "text-slate-500 group-hover:text-slate-300",
                )}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-tight">
                  {item.label}
                </p>
                <p
                  className={cn(
                    "truncate font-mono text-[10px]",
                    isActive ? "text-cyan-400/80" : "text-slate-500",
                  )}
                >
                  {item.sublabel}
                </p>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Progress Widget */}
      <div className="shrink-0 border-t border-slate-800/90 p-4">
        <div className="rounded-xl border border-slate-800/90 bg-[#0d1322] p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">
              総合進捗
            </span>
            {hydrated ? (
              <span className="font-mono text-xs font-semibold text-cyan-300">
                {overallPercent}%
              </span>
            ) : (
              <span className="h-4 w-9 animate-pulse rounded bg-slate-800" />
            )}
          </div>
          <ProgressBar
            value={overallPercent}
            accent="cyan"
            size="sm"
            hydrated={hydrated}
            ariaLabel="総合学習進捗"
          />
          <div className="mt-2.5 flex items-center justify-between font-mono text-[11px] text-slate-400">
            <span>完了項目</span>
            {hydrated ? (
              <span>
                {completedCount} / {totalItems}
              </span>
            ) : (
              <span className="h-3.5 w-12 animate-pulse rounded bg-slate-800" />
            )}
          </div>
          <button
            type="button"
            onClick={() => setBackupOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-[#070b14] px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-200"
          >
            <DatabaseBackup className="h-3.5 w-3.5 text-cyan-400" />
            <span>バックアップ / 復元</span>
          </button>
        </div>
      </div>

      <ProgressBackupModal
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
      />
    </aside>
  );
}
