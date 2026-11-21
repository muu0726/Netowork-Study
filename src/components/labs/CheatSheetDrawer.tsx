"use client";

import { BookMarked, Check, Copy, CornerDownLeft, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { CHEAT_SHEET_SECTIONS } from "@/data/cheatsheet";
import type { DeviceType } from "@/lib/network-engine";
import { cn } from "@/lib/cn";

interface CheatSheetDrawerProps {
  open: boolean;
  onClose: () => void;
  onInsertCommand: (command: string) => void;
  deviceType: DeviceType;
}

export function CheatSheetDrawer({
  open,
  onClose,
  onInsertCommand,
  deviceType,
}: CheatSheetDrawerProps) {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const isHost = deviceType === "pc" || deviceType === "server";

  const handleCopy = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
      window.setTimeout(() => setCopiedCommand(null), 1500);
    } catch {
      onInsertCommand(command);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="コマンド逆引きチートシート"
    >
      <button
        type="button"
        aria-label="チートシートを閉じる"
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs"
      />

      <div className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-slate-800 bg-[#080d19] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <BookMarked className="h-5 w-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                コマンド逆引きチートシート
              </h3>
              <p className="text-xs text-slate-400">
                「入力」ボタンでそのままCLI入力欄にセットできます
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="terminal-scroll flex-1 space-y-5 overflow-y-auto p-5">
          {CHEAT_SHEET_SECTIONS.map((section) => {
            const highlighted = isHost
              ? Boolean(section.forEndHost)
              : !section.forEndHost;
            return (
              <div
                key={section.title}
                className={cn(
                  "rounded-xl border p-4",
                  highlighted
                    ? "border-slate-700/90 bg-[#0d1322]"
                    : "border-slate-800/70 bg-[#0a0f1c] opacity-80",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-100">
                    {section.title}
                  </h4>
                  <Badge variant={highlighted ? "cyan" : "slate"}>
                    {section.badge}
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {section.items.map((item) => (
                    <div
                      key={item.command}
                      className="rounded-lg border border-slate-800/90 bg-[#05080f] p-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <code className="font-mono text-xs text-cyan-300">
                          {item.command}
                        </code>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.command)}
                            className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-300 hover:border-slate-700"
                          >
                            {copiedCommand === item.command ? (
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
                          <button
                            type="button"
                            onClick={() => {
                              onInsertCommand(item.command);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-200 hover:bg-cyan-500/20"
                          >
                            <CornerDownLeft className="h-3 w-3" />
                            <span>入力</span>
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
