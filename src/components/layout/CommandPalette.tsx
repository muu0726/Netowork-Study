"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  Cloud,
  Copy,
  Search,
  ShieldAlert,
  Target,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  getSearchKindLabel,
  searchGlobalItems,
  type GlobalSearchItem,
  type SearchItemKind,
} from "@/lib/global-search";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const FILTER_OPTIONS: Array<{ id: SearchItemKind | "all"; label: string }> = [
  { id: "all", label: "すべて" },
  { id: "lesson", label: "記事" },
  { id: "lab", label: "構築ラボ" },
  { id: "troubleshoot", label: "障害対応" },
  { id: "cloud", label: "クラウド" },
  { id: "tool", label: "ツール" },
  { id: "command", label: "CLI逆引き" },
];

const KIND_BADGE_VARIANT: Record<SearchItemKind, BadgeVariant> = {
  lesson: "cyan",
  lab: "amber",
  troubleshoot: "rose",
  cloud: "cyan",
  tool: "violet",
  exam: "emerald",
  command: "slate",
};

function renderKindIcon(kind: SearchItemKind) {
  switch (kind) {
    case "lesson":
      return <BookOpen className="h-4 w-4 text-cyan-300" />;
    case "lab":
      return <Terminal className="h-4 w-4 text-amber-300" />;
    case "troubleshoot":
      return <ShieldAlert className="h-4 w-4 text-rose-300" />;
    case "cloud":
      return <Cloud className="h-4 w-4 text-sky-300" />;
    case "tool":
      return <Wrench className="h-4 w-4 text-violet-300" />;
    case "exam":
      return <Target className="h-4 w-4 text-emerald-300" />;
    case "command":
      return <Terminal className="h-4 w-4 text-slate-400" />;
  }
}

function CommandPaletteContent({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<SearchItemKind | "all">("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const results = searchGlobalItems(query, kindFilter, 24);
  const clampedIndex =
    results.length > 0 ? Math.min(activeIndex, results.length - 1) : 0;

  const handleSelectItem = (item: GlobalSearchItem) => {
    router.push(item.href);
    onClose();
  };

  const handleCopyCommand = async (item: GlobalSearchItem) => {
    if (!item.copyCommand) {
      return;
    }
    try {
      await navigator.clipboard.writeText(item.copyCommand);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      handleSelectItem(item);
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length > 0) {
        setActiveIndex((prev) => (prev + 1) % results.length);
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length > 0) {
        setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
      }
      return;
    }
    if (event.key === "Enter" && results[clampedIndex]) {
      event.preventDefault();
      handleSelectItem(results[clampedIndex]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16 sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="グローバル検索コマンドパレット"
    >
      <button
        type="button"
        aria-label="検索パレットを閉じる"
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-xs"
      />

      <div className="relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-[#080d19] shadow-2xl shadow-black/70">
        {/* Search Input Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-cyan-400" />
          <label htmlFor="global-search-input" className="sr-only">
            キーワードで検索（記事・ラボ・ツール・CLIコマンド）
          </label>
          <input
            ref={inputRef}
            id="global-search-input"
            name="globalSearch"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="キーワード検索 (例: OSPF, NACL, systemctl, 暗黙のdeny, IPv6...)"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveIndex(0);
                inputRef.current?.focus();
              }}
              aria-label="検索語をクリア"
              className="rounded px-1.5 py-0.5 font-mono text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-800 bg-[#0d1322] text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Category Filter Strip */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 bg-[#060a14] px-4 py-2.5">
          {FILTER_OPTIONS.map((opt) => {
            const active = kindFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setKindFilter(opt.id);
                  setActiveIndex(0);
                  inputRef.current?.focus();
                }}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-200"
                    : "border-slate-800 bg-[#0d1322] text-slate-400 hover:text-slate-200",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Results List */}
        <div className="terminal-scroll flex-1 divide-y divide-slate-800/70 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-300">
                一致する項目が見つかりませんでした
              </p>
              <p className="mt-1 text-xs text-slate-500">
                別のキーワード（例: OSPF, ACL, DHCP, AWS, IPv6）またはカテゴリ切替をお試しください。
              </p>
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === clampedIndex;
              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "flex items-center justify-between gap-3 px-4 py-3 transition-colors",
                    isSelected ? "bg-cyan-500/10" : "hover:bg-slate-900/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectItem(item)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-[#0d1322]">
                      {renderKindIcon(item.kind)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={KIND_BADGE_VARIANT[item.kind]}>
                          {getSearchKindLabel(item.kind)}
                        </Badge>
                        <span className="font-mono text-[10px] text-slate-400">
                          {item.badge}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-1 truncate text-sm font-semibold text-slate-100",
                          item.kind === "command" && "font-mono text-cyan-200",
                        )}
                      >
                        {item.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {item.subtitle}
                      </p>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {item.copyCommand && (
                      <button
                        type="button"
                        onClick={() => handleCopyCommand(item)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-[#0d1322] px-2 py-1 font-mono text-[10px] text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      aria-label={`${item.title} を開く`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-800 bg-[#0d1322] text-slate-400 hover:border-cyan-500/50 hover:text-cyan-200"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-[#060a14] px-4 py-2 font-mono text-[10px] text-slate-500">
          <span>↑↓ 移動 • Enter 開く • Esc 閉じる</span>
          <span>表示中: {results.length} 件</span>
        </div>
      </div>
    </div>
  );
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  if (!open) {
    return null;
  }
  return <CommandPaletteContent key="open" onClose={onClose} />;
}
