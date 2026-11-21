"use client";

import { Binary, FileSearch, GitCompare, Globe, Wrench } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ConfigReviewDrill } from "@/components/tools/ConfigReviewDrill";
import { Ipv6Tool } from "@/components/tools/Ipv6Tool";
import { SubnetTool } from "@/components/tools/SubnetTool";
import { WiresharkDrill } from "@/components/tools/WiresharkDrill";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { TOOLS_META } from "@/data/curriculum-meta";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import { useLearningStore } from "@/store/useLearningStore";

type ActiveToolId = "subnet" | "ipv6" | "wireshark" | "config-review";

const TOOL_ICONS: Record<ActiveToolId, typeof Binary> = {
  subnet: Binary,
  ipv6: Globe,
  wireshark: FileSearch,
  "config-review": GitCompare,
};

const VALID_TOOL_IDS: ActiveToolId[] = [
  "subnet",
  "ipv6",
  "wireshark",
  "config-review",
];

function ToolsWorkspaceInner({
  initialToolId,
}: {
  initialToolId: ActiveToolId;
}) {
  const [activeTool, setActiveTool] = useState<ActiveToolId>(initialToolId);
  const hydrated = useHydrated();
  const drillStats = useLearningStore((state) => state.drillStats);

  const totalSolved = Object.values(drillStats).reduce(
    (sum, s) => sum + s.solved,
    0,
  );
  const totalAttempted = Object.values(drillStats).reduce(
    (sum, s) => sum + s.attempted,
    0,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header & Hydrated Stats */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="violet">
              <Wrench className="h-3 w-3" />
              Practice Tools &amp; Drills
            </Badge>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-50">
            実践ミニツール＆ドリル集
          </h2>
          <p className="max-w-2xl text-sm text-slate-400">
            2進数サブネット計算、3ペインWireshark風パケット解析、構成図・コンフィグDiffレビューをブラウザ上で実践演習できます。
          </p>
        </div>

        <Card className="flex items-center gap-4 px-4 py-3">
          <div>
            <p className="text-[11px] text-slate-400">累計ドリル正解</p>
            {hydrated ? (
              <p className="font-mono text-lg font-bold text-emerald-300">
                {totalSolved}{" "}
                <span className="text-xs font-normal text-slate-400">
                  / {totalAttempted} 挑戦
                </span>
              </p>
            ) : (
              <div className="mt-1 h-6 w-20 animate-pulse rounded bg-slate-800" />
            )}
          </div>
        </Card>
      </div>

      {/* Tool Selector Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS_META.map((tool) => {
          const Icon = TOOL_ICONS[tool.id];
          const isActive = tool.id === activeTool;
          const stats = hydrated ? drillStats[tool.id] : undefined;

          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActiveTool(tool.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                isActive
                  ? "border-cyan-500/60 bg-cyan-500/10 shadow-md shadow-cyan-950/30"
                  : "border-slate-800 bg-[#0d1322] hover:border-slate-700",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isActive ? "text-cyan-300" : "text-slate-400",
                    )}
                  />
                  <Badge variant={isActive ? "cyan" : "slate"}>
                    {tool.badge}
                  </Badge>
                </div>

                {hydrated && stats && (
                  <span className="font-mono text-[11px] text-emerald-300">
                    {stats.solved}問正解
                  </span>
                )}
              </div>

              <h3 className="text-sm font-bold text-slate-100">{tool.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {tool.summary}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active Tool Body */}
      {activeTool === "subnet" && <SubnetTool />}
      {activeTool === "ipv6" && <Ipv6Tool />}
      {activeTool === "wireshark" && <WiresharkDrill />}
      {activeTool === "config-review" && <ConfigReviewDrill />}
    </div>
  );
}

export function ToolsWorkspace() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialToolId: ActiveToolId =
    tabParam && VALID_TOOL_IDS.includes(tabParam as ActiveToolId)
      ? (tabParam as ActiveToolId)
      : "subnet";

  return (
    <ToolsWorkspaceInner
      key={tabParam ?? "default"}
      initialToolId={initialToolId}
    />
  );
}
