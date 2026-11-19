"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  Network,
  ShieldAlert,
  Terminal,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { LESSONS_META, SCENARIOS_META } from "@/data/curriculum-meta";
import { useHydrated } from "@/hooks/useHydrated";
import { useLearningStore } from "@/store/useLearningStore";
import { ProgressBar } from "@/components/dashboard/ProgressBar";

interface NavItem {
  href: string;
  label: string;
  sublabel: string;
  icon: typeof LayoutDashboard;
}

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
    href: "/tools",
    label: "実践ツール＆ドリル",
    sublabel: "Subnet / Packet / Diff",
    icon: Wrench,
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const completedLessonIds = useLearningStore(
    (state) => state.completedLessonIds,
  );
  const completedScenarioIds = useLearningStore(
    (state) => state.completedScenarioIds,
  );

  const totalItems = LESSONS_META.length + SCENARIOS_META.length;
  const completedCount =
    completedLessonIds.length + completedScenarioIds.length;
  const overallPercent =
    totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

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
        </div>
      </div>
    </aside>
  );
}
