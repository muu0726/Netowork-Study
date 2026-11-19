"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, Terminal } from "lucide-react";

interface RouteTitleMeta {
  title: string;
  section: string;
}

function getRouteMeta(pathname: string): RouteTitleMeta {
  if (pathname === "/") {
    return { section: "Platform", title: "ダッシュボード" };
  }
  if (pathname.startsWith("/learn")) {
    return { section: "Curriculum", title: "体系的カリキュラム (Stage 1–3)" };
  }
  if (pathname.startsWith("/labs/cli")) {
    return { section: "Virtual Lab", title: "CLI構築ラボ" };
  }
  if (pathname.startsWith("/labs/troubleshoot")) {
    return { section: "Incident Lab", title: "リアル障害対応シミュレータ" };
  }
  if (pathname.startsWith("/tools")) {
    return { section: "Practice Tools", title: "実践ミニツール＆ドリル" };
  }
  return { section: "NetForge", title: "ワークスペース" };
}

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const pathname = usePathname();
  const routeMeta = getRouteMeta(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-800/90 bg-[#070b14]/90 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="ナビゲーションメニューを開く"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-[#0d1322] text-slate-300 transition-colors hover:border-slate-700 hover:text-white lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="hidden font-mono text-xs text-slate-500 sm:inline">
            {routeMeta.section}
          </span>
          <ChevronRight className="hidden h-3.5 w-3.5 text-slate-600 sm:inline" />
          <h1 className="truncate font-semibold text-slate-100">
            {routeMeta.title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] text-emerald-300 sm:inline-flex">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          Virtual Net Engine
        </div>

        <Link
          href="/labs/cli"
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition-colors hover:border-cyan-400 hover:bg-cyan-500/20"
        >
          <Terminal className="h-3.5 w-3.5" />
          <span>ラボを開く</span>
        </Link>
      </div>
    </header>
  );
}
