"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export type ProgressAccent = "cyan" | "amber" | "violet" | "emerald";

const FILL_CLASSES: Record<ProgressAccent, string> = {
  cyan: "bg-gradient-to-r from-cyan-500 to-sky-400 shadow-[0_0_12px_rgba(34,211,238,0.45)]",
  amber:
    "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]",
  violet:
    "bg-gradient-to-r from-violet-500 to-purple-400 shadow-[0_0_12px_rgba(167,139,250,0.4)]",
  emerald:
    "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.45)]",
};

interface ProgressBarProps {
  value: number;
  accent?: ProgressAccent;
  size?: "sm" | "md";
  hydrated: boolean;
  ariaLabel: string;
  className?: string;
}

export function ProgressBar({
  value,
  accent = "cyan",
  size = "md",
  hydrated,
  ariaLabel,
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const heightClass = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={hydrated ? clamped : 0}
      className={cn(
        "w-full overflow-hidden rounded-full border border-slate-800 bg-slate-900/90",
        heightClass,
        className,
      )}
    >
      {hydrated ? (
        <motion.div
          className={cn("h-full rounded-full", FILL_CLASSES[accent])}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      ) : (
        <div className="h-full w-1/3 animate-pulse rounded-full bg-slate-800/80" />
      )}
    </div>
  );
}
