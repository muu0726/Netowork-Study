import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant =
  | "cyan"
  | "emerald"
  | "amber"
  | "violet"
  | "rose"
  | "slate";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  amber: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  violet: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  rose: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  slate: "bg-slate-800/80 text-slate-300 border-slate-700/80",
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({
  children,
  variant = "slate",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wide",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
