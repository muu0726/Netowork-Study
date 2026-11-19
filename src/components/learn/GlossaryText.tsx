"use client";

import { BookOpen } from "lucide-react";
import { useState } from "react";
import type { GlossaryTerm } from "@/data/lessons/types";
import { cn } from "@/lib/cn";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function InlineGlossaryTrigger({ entry }: { entry: GlossaryTerm }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((prev) => !prev);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className="cursor-help border-b border-dashed border-cyan-400/75 font-medium text-cyan-200 transition-colors hover:text-cyan-100 focus:outline-none focus:ring-1 focus:ring-cyan-400"
      >
        {entry.term}
      </span>

      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-40 mb-2 w-72 -translate-x-1/2 rounded-xl border border-cyan-500/40 bg-[#05080f] p-3 text-left text-xs shadow-2xl shadow-black/70"
        >
          <span className="mb-1 flex items-center justify-between gap-2">
            <span className="font-bold text-cyan-300">{entry.term}</span>
            {entry.layer && (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                {entry.layer}
              </span>
            )}
          </span>
          <span className="block font-medium text-slate-100">
            {entry.shortDef}
          </span>
          <span className="mt-1 block leading-relaxed text-slate-400">
            {entry.detail}
          </span>
        </span>
      )}
    </span>
  );
}

export function GlossaryText({
  text,
  glossary,
}: {
  text: string;
  glossary: GlossaryTerm[];
}) {
  if (glossary.length === 0) {
    return <>{text}</>;
  }

  const sortedTerms = [...glossary].sort(
    (a, b) => b.term.length - a.term.length,
  );
  const pattern = new RegExp(
    `(${sortedTerms.map((g) => escapeRegExp(g.term)).join("|")})`,
    "g",
  );
  const termMap = new Map(glossary.map((g) => [g.term, g]));
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, idx) => {
        const entry = termMap.get(part);
        if (!entry) {
          return <span key={`${idx}-${part.slice(0, 8)}`}>{part}</span>;
        }
        return <InlineGlossaryTrigger key={`${idx}-${part}`} entry={entry} />;
      })}
    </>
  );
}

export function GlossaryChipBar({ glossary }: { glossary: GlossaryTerm[] }) {
  const [selectedTerm, setSelectedTerm] = useState<string | null>(
    glossary[0]?.term ?? null,
  );

  const active = glossary.find((g) => g.term === selectedTerm) ?? glossary[0];
  if (!active) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-[#090e1a] p-4">
      <div className="mb-3 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-cyan-400" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          専門用語クイック辞典（クリック / ホバーで解説）
        </h4>
      </div>

      <div className="flex flex-wrap gap-2">
        {glossary.map((entry) => {
          const isSelected = entry.term === active.term;
          return (
            <button
              key={entry.term}
              type="button"
              onMouseEnter={() => setSelectedTerm(entry.term)}
              onClick={() => setSelectedTerm(entry.term)}
              className={cn(
                "rounded-full border px-3 py-1 font-mono text-xs transition-colors",
                isSelected
                  ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-200"
                  : "border-slate-700 bg-[#0d1322] text-slate-300 hover:border-slate-600",
              )}
            >
              {entry.term}
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-lg border border-slate-800/90 bg-[#0d1322] p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-cyan-300">{active.term}</span>
          {active.layer && (
            <span className="font-mono text-[10px] text-slate-400">
              Layer: {active.layer}
            </span>
          )}
        </div>
        <p className="mt-1 font-medium text-slate-100">{active.shortDef}</p>
        <p className="mt-1 leading-relaxed text-slate-400">{active.detail}</p>
      </div>
    </div>
  );
}
