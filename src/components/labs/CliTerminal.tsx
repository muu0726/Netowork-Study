"use client";

import { HelpCircle, Terminal as TerminalIcon, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import {
  getCliCompletions,
  getDevicePrompt,
  type NetworkDevice,
  type NetworkState,
} from "@/lib/network-engine";
import { cn } from "@/lib/cn";

export interface TerminalLine {
  id: string;
  kind: "command" | "output" | "error" | "hint" | "success" | "system";
  prompt?: string;
  text: string;
}

interface CliTerminalProps {
  device: NetworkDevice;
  networkState: NetworkState;
  devices?: NetworkDevice[];
  onSelectDevice?: (deviceId: string) => void;
  lines: TerminalLine[];
  commandHistory: string[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onExecute: (command: string) => void;
  onClear: () => void;
}

const SINGLE_TOKEN_COMPLETE_WITHOUT_SPACE = new Set([
  "enable",
  "disable",
  "exit",
  "end",
  "shutdown",
  "no shutdown",
  "ipconfig",
  "ifconfig",
  "show ip interface brief",
  "show vlan brief",
  "show ip route",
  "show running-config",
  "show mac address-table",
  "show arp",
]);

function getLongestCommonPrefix(values: string[]): string {
  if (values.length === 0) {
    return "";
  }
  let prefix = values[0];
  for (let i = 1; i < values.length; i += 1) {
    const candidate = values[i];
    let j = 0;
    while (
      j < prefix.length &&
      j < candidate.length &&
      prefix[j].toLowerCase() === candidate[j].toLowerCase()
    ) {
      j += 1;
    }
    prefix = prefix.slice(0, j);
  }
  return prefix;
}

export function CliTerminal({
  device,
  networkState,
  devices,
  onSelectDevice,
  lines,
  commandHistory,
  inputValue,
  onInputChange,
  onExecute,
  onClear,
}: CliTerminalProps) {
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [completionChoices, setCompletionChoices] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prompt = getDevicePrompt(device);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines.length]);

  const submitCommand = (cmd: string) => {
    setHistoryIndex(null);
    setCompletionChoices([]);
    onExecute(cmd);
    onInputChange("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitCommand(inputValue);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (commandHistory.length === 0) {
        return;
      }
      const nextIdx =
        historyIndex === null
          ? commandHistory.length - 1
          : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setCompletionChoices([]);
      onInputChange(commandHistory[nextIdx] ?? "");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex === null) {
        return;
      }
      if (historyIndex + 1 >= commandHistory.length) {
        setHistoryIndex(null);
        onInputChange("");
      } else {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        onInputChange(commandHistory[nextIdx] ?? "");
      }
      setCompletionChoices([]);
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const matches = getCliCompletions(networkState, device.id, inputValue);
      if (matches.length === 0) {
        setCompletionChoices([]);
        return;
      }
      if (matches.length === 1) {
        const match = matches[0];
        const needsSpace = !SINGLE_TOKEN_COMPLETE_WITHOUT_SPACE.has(match);
        onInputChange(needsSpace ? `${match} ` : match);
        setCompletionChoices([]);
        return;
      }
      const lcp = getLongestCommonPrefix(matches);
      if (lcp.length > inputValue.trimStart().length) {
        onInputChange(lcp);
      }
      setCompletionChoices(matches);
    }
  };

  return (
    <div
      className="flex h-[460px] flex-col overflow-hidden rounded-xl border border-slate-800/90 bg-[#05080f] shadow-lg shadow-black/40 lg:h-[520px]"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Terminal Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 bg-[#090e1a] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <TerminalIcon className="h-4 w-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold text-slate-100">
            {device.hostname}
          </span>
          <Badge variant="slate">{device.cliState.mode}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onExecute("?");
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-[11px] text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-200"
          >
            <HelpCircle className="h-3 w-3" />
            <span>? ヘルプ</span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/70 px-2.5 py-1 font-mono text-[11px] text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
          >
            <Trash2 className="h-3 w-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Explicit Device Selector Strip */}
      {devices && devices.length > 0 && onSelectDevice && (
        <div
          role="group"
          aria-label="CLI接続機器の切替"
          onClick={(event) => event.stopPropagation()}
          className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 bg-[#070b14] px-4 py-2"
        >
          <span className="mr-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Target:
          </span>
          {devices.map((d) => {
            const isCurrent = d.id === device.id;
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={isCurrent}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectDevice(d.id);
                }}
                className={cn(
                  "rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium transition-colors",
                  isCurrent
                    ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-200"
                    : "border-slate-800 bg-[#0d1322] text-slate-400 hover:border-slate-700 hover:text-slate-200",
                )}
              >
                {d.hostname}
              </button>
            );
          })}
        </div>
      )}

      {/* Output Scroll Area */}
      <div
        ref={scrollRef}
        className="terminal-scroll flex-1 space-y-1.5 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed sm:text-[13px]"
      >
        {lines.map((line) => (
          <div key={line.id} className="whitespace-pre-wrap break-words">
            {line.kind === "command" ? (
              <div>
                <span className="text-cyan-400">{line.prompt} </span>
                <span className="font-semibold text-slate-100">
                  {line.text}
                </span>
              </div>
            ) : (
              <div
                className={cn(
                  line.kind === "error" && "text-rose-300",
                  line.kind === "hint" && "text-amber-300",
                  line.kind === "success" && "text-emerald-300",
                  line.kind === "system" && "text-slate-400",
                  line.kind === "output" && "text-slate-200",
                )}
              >
                {line.text}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tab Completion Suggestion Chips */}
      {completionChoices.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5 border-t border-slate-800/80 bg-[#080d18] px-4 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="font-mono text-[10px] text-slate-500">Tab候補:</span>
          {completionChoices.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => {
                const needsSpace =
                  !SINGLE_TOKEN_COMPLETE_WITHOUT_SPACE.has(choice);
                onInputChange(needsSpace ? `${choice} ` : choice);
                setCompletionChoices([]);
                inputRef.current?.focus();
              }}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-cyan-300 hover:border-cyan-500/60"
            >
              {choice}
            </button>
          ))}
        </div>
      )}

      {/* Command Input Prompt */}
      <div className="flex items-center gap-2 border-t border-slate-800/90 bg-[#070b14] px-4 py-2.5 font-mono text-xs sm:text-[13px]">
        <label
          htmlFor="cli-command-input"
          className="shrink-0 font-semibold text-cyan-400"
        >
          {prompt}
        </label>
        <input
          ref={inputRef}
          id="cli-command-input"
          name="cliCommand"
          type="text"
          value={inputValue}
          onChange={(event) => {
            setCompletionChoices([]);
            onInputChange(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="コマンドを入力 (Tab補完 / ↑↓履歴 / ? ヘルプ)"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-label={`${device.hostname} CLI入力`}
          className="min-w-0 flex-1 bg-transparent text-slate-100 placeholder-slate-600 focus:outline-none"
        />
      </div>
    </div>
  );
}
