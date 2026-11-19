"use client";

import { Lightbulb, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface HintsPanelProps {
  hints: [string, string, string];
  revealedCount: number;
  onRevealNext: () => void;
}

export function HintsPanel({
  hints,
  revealedCount,
  onRevealNext,
}: HintsPanelProps) {
  const visibleHints = hints.slice(0, revealedCount);

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-400" />
          <h3 className="text-xs font-bold text-amber-200">
            3段階ヒント ({revealedCount} / 3 公開中)
          </h3>
        </div>

        {revealedCount < 3 && (
          <button
            type="button"
            onClick={onRevealNext}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>ヒント {revealedCount + 1} を表示</span>
          </button>
        )}
      </div>

      {visibleHints.length === 0 ? (
        <p className="mt-2.5 text-xs text-slate-400">
          まずは自力で調査してみましょう。詰まったら段階的にヒントを開示できます。
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {visibleHints.map((hint, idx) => (
            <div
              key={hint}
              className="rounded-lg border border-amber-500/20 bg-[#0d1322] p-3 text-xs leading-relaxed text-slate-200"
            >
              <Badge variant="amber" className="mb-1.5">
                Step {idx + 1}
              </Badge>
              <p>{hint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
