import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
}

export function Card({
  children,
  interactive = false,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-800/90 bg-[#0d1322] shadow-lg shadow-black/20",
        interactive &&
          "transition-colors duration-200 hover:border-cyan-500/50 hover:bg-[#10182b]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
