"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  MousePointerClick,
  RotateCw,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import {
  computeHsrpTable,
  getTopologyStpBlockingLinks,
  inspectTraceHopHeaders,
  isPhysicalInterfaceUp,
  type NetworkDevice,
  type NetworkState,
  type PacketHop,
  type PacketTraceResult,
} from "@/lib/network-engine";
import { cn } from "@/lib/cn";

interface TopologyCanvasProps {
  networkState: NetworkState;
  selectedDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
  activeTrace: PacketTraceResult | null;
  traceRunId: number;
  onReplayTrace: () => void;
}

function TraceAnimator({
  trace,
  children,
}: {
  trace: PacketTraceResult | null;
  children: (
    hopIndex: number,
    onSelectHop: (idx: number) => void,
    isManualInspect: boolean,
  ) => ReactNode;
}) {
  const [hopIndex, setHopIndex] = useState(0);
  const [manualHopIndex, setManualHopIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!trace || trace.hops.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setHopIndex((prev) => {
        if (prev + 1 >= trace.hops.length) {
          window.clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 650);

    return () => window.clearInterval(timer);
  }, [trace]);

  const activeHop =
    manualHopIndex !== null
      ? Math.min(manualHopIndex, Math.max(0, (trace?.hops.length ?? 1) - 1))
      : hopIndex;

  return (
    <>
      {children(
        activeHop,
        (idx) => setManualHopIndex(idx),
        manualHopIndex !== null,
      )}
    </>
  );
}

function getDeviceColors(type: NetworkDevice["type"]): {
  stroke: string;
  fill: string;
  label: string;
} {
  switch (type) {
    case "router":
      return { stroke: "#22d3ee", fill: "#0a2234", label: "Router" };
    case "switch":
      return { stroke: "#f59e0b", fill: "#261b08", label: "L2SW" };
    case "pc":
      return { stroke: "#38bdf8", fill: "#0f1e36", label: "PC" };
    case "server":
      return { stroke: "#a78bfa", fill: "#1e1638", label: "Server" };
  }
}

function getDeviceDisplayIp(device: NetworkDevice): string | null {
  const withIp = Object.values(device.interfaces).filter((i) => i.ip);
  if (withIp.length === 0) {
    return null;
  }
  if (device.type === "router") {
    return withIp.length === 1
      ? `${withIp[0].ip}`
      : `${withIp[0].ip} (+${withIp.length - 1})`;
  }
  return withIp[0].ip ?? null;
}

function getHopColor(hop: PacketHop): string {
  if (hop.status === "error") {
    return "#f43f5e";
  }
  if (hop.direction === "dns-query" || hop.direction === "dns-response") {
    return "#a78bfa";
  }
  if (hop.direction === "reply") {
    return "#10b981";
  }
  return "#22d3ee";
}

function pickEndpointLabelPos(
  endpoint: NetworkDevice,
  other: NetworkDevice,
): { x: number; y: number } {
  const dx = other.position.x - endpoint.position.x;
  const dy = other.position.y - endpoint.position.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const dist =
    uy > 0.35
      ? Math.min(Math.max(56, len * 0.34), len * 0.43)
      : Math.min(Math.max(36, len * 0.26), len * 0.38);

  const ax = endpoint.position.x + ux * dist;
  const ay = endpoint.position.y + uy * dist;
  const px = -uy;
  const py = ux;
  const perp = Math.abs(ux) < 0.2 ? 22 : 16;

  const candA = { x: ax + px * perp, y: ay + py * perp };
  const candB = { x: ax - px * perp, y: ay - py * perp };

  const targetX = endpoint.position.x;
  const targetY = endpoint.position.y + 44;
  const distA = Math.hypot(candA.x - targetX, candA.y - targetY);
  const distB = Math.hypot(candB.x - targetX, candB.y - targetY);

  if (Math.abs(distA - distB) < 0.5) {
    return candA.x <= candB.x ? candA : candB;
  }
  return distA >= distB ? candA : candB;
}

function computeLinkLabelPositions(
  fromDev: NetworkDevice,
  toDev: NetworkDevice,
): {
  fromLabel: { x: number; y: number };
  toLabel: { x: number; y: number };
} {
  return {
    fromLabel: pickEndpointLabelPos(fromDev, toDev),
    toLabel: pickEndpointLabelPos(toDev, fromDev),
  };
}

function renderDeviceSymbol(device: NetworkDevice, stroke: string, fill: string) {
  switch (device.type) {
    case "router":
      return (
        <g>
          <circle cx={0} cy={0} r={22} fill={fill} stroke={stroke} strokeWidth={2} />
          <path
            d="M-10 -6 L-4 -6 M-7 -9 L-4 -6 L-7 -3 M10 6 L4 6 M7 3 L4 6 L7 9 M-6 10 L-6 4 M-9 7 L-6 4 L-3 7 M6 -10 L6 -4 M3 -7 L6 -4 L9 -7"
            stroke={stroke}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      );

    case "switch":
      return (
        <g>
          <rect
            x={-26}
            y={-17}
            width={52}
            height={34}
            rx={6}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
          <path
            d="M-15 -5 L15 -5 M11 -8 L15 -5 L11 -2 M15 5 L-15 5 M-11 2 L-15 5 L-11 8"
            stroke={stroke}
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      );

    case "pc":
      return (
        <g>
          <rect
            x={-21}
            y={-17}
            width={42}
            height={27}
            rx={4}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
          <line
            x1={-13}
            y1={-7}
            x2={13}
            y2={-7}
            stroke={stroke}
            strokeOpacity={0.5}
            strokeWidth={1.5}
          />
          <line x1={0} y1={10} x2={0} y2={17} stroke={stroke} strokeWidth={2} />
          <line
            x1={-11}
            y1={17}
            x2={11}
            y2={17}
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      );

    case "server":
      return (
        <g>
          <rect
            x={-20}
            y={-22}
            width={40}
            height={44}
            rx={5}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
          <line x1={-13} y1={-9} x2={13} y2={-9} stroke={stroke} strokeWidth={1.5} />
          <line x1={-13} y1={3} x2={13} y2={3} stroke={stroke} strokeWidth={1.5} />
          <circle cx={-9} cy={-15} r={1.8} fill="#10b981" />
          <circle cx={-9} cy={-3} r={1.8} fill={stroke} />
          <circle cx={-9} cy={12} r={1.8} fill={stroke} />
        </g>
      );
  }
}

export function TopologyCanvas({
  networkState,
  selectedDeviceId,
  onSelectDevice,
  activeTrace,
  traceRunId,
  onReplayTrace,
}: TopologyCanvasProps) {
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const devices = Object.values(networkState.devices);
  const stpBlockingLinks = getTopologyStpBlockingLinks(networkState);
  const hsrpEntries = computeHsrpTable(networkState);
  const inspectedHops = activeTrace
    ? inspectTraceHopHeaders(networkState, activeTrace)
    : [];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-800/90 bg-[#0d1322] shadow-lg shadow-black/30">
      {/* Canvas Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 bg-[#090e1a] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span className="font-mono text-xs font-semibold tracking-wide text-slate-200">
            TOPOLOGY VIEW
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Link Up
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Link Down
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 border-t-2 border-dashed border-orange-400" />
            STP BLK
          </span>
          <span className="hidden items-center gap-1 text-cyan-300/90 sm:inline-flex">
            <MousePointerClick className="h-3.5 w-3.5" />
            機器クリックでCLI切替
          </span>
        </div>
      </div>

      {/* Synchronized SVG + Trace Overlay */}
      <TraceAnimator key={traceRunId} trace={activeTrace}>
        {(hopIndex, onSelectHop, isManualInspect) => {
          const hops = activeTrace?.hops ?? [];
          const clampedIndex =
            hops.length > 0 ? Math.min(hopIndex, hops.length - 1) : 0;
          const currentHop = hops.length > 0 ? hops[clampedIndex] : null;
          const activeInspected =
            inspectedHops.length > 0 ? inspectedHops[clampedIndex] : null;
          const initialHopDevice =
            hops.length > 0 ? networkState.devices[hops[0].deviceId] : undefined;
          const currentHopDevice = currentHop
            ? networkState.devices[currentHop.deviceId]
            : undefined;

          const showErrorBubble =
            activeTrace &&
            !activeTrace.success &&
            currentHop &&
            currentHop.status === "error" &&
            currentHopDevice;

          const bubbleX = currentHopDevice
            ? Math.max(14, Math.min(430, currentHopDevice.position.x - 115))
            : 0;
          const bubbleY = currentHopDevice
            ? Math.max(
                10,
                currentHopDevice.position.y > 120
                  ? currentHopDevice.position.y - 98
                  : currentHopDevice.position.y + 48,
              )
            : 0;

          return (
            <>
              <div className="bg-topo-grid relative flex-1 p-2 sm:p-3">
                <svg
                  viewBox="0 0 680 380"
                  role="group"
                  aria-label="ネットワーク構成トポロジ図"
                  className="h-auto w-full select-none"
                >
                  {/* Links Layer */}
                  {networkState.links.map((link) => {
                    const fromDev = networkState.devices[link.fromDeviceId];
                    const toDev = networkState.devices[link.toDeviceId];
                    if (!fromDev || !toDev) {
                      return null;
                    }

                    const up = isPhysicalInterfaceUp(
                      networkState,
                      link.fromDeviceId,
                      link.fromInterface,
                    );
                    const x1 = fromDev.position.x;
                    const y1 = fromDev.position.y;
                    const x2 = toDev.position.x;
                    const y2 = toDev.position.y;

                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    const { fromLabel, toLabel } = computeLinkLabelPositions(
                      fromDev,
                      toDev,
                    );

                    const isHighlightedByHop =
                      currentHop &&
                      ((currentHop.deviceId === fromDev.id &&
                        (currentHop.outgoingInterface?.startsWith(
                          link.fromInterface,
                        ) ||
                          currentHop.incomingInterface?.startsWith(
                            link.fromInterface,
                          ))) ||
                        (currentHop.deviceId === toDev.id &&
                          (currentHop.outgoingInterface?.startsWith(
                            link.toInterface,
                          ) ||
                            currentHop.incomingInterface?.startsWith(
                              link.toInterface,
                            ))));

                    const stpBlock = up ? stpBlockingLinks[link.id] : undefined;
                    const stpBadgeT = stpBlock?.blockedSide === "from" ? 0.46 : 0.54;

                    return (
                      <g key={link.id}>
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={
                            !up
                              ? "#f43f5e"
                              : stpBlock
                                ? "#f97316"
                                : "#10b981"
                          }
                          strokeWidth={isHighlightedByHop ? 4 : 2.5}
                          strokeOpacity={up ? 0.85 : 0.75}
                          strokeDasharray={!up || stpBlock ? "6 4" : undefined}
                        />
                        <text
                          x={fromLabel.x}
                          y={fromLabel.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#cbd5e1"
                          fontSize={10}
                          fontFamily="monospace"
                          paintOrder="stroke"
                          stroke="#09101f"
                          strokeWidth={3}
                          strokeLinejoin="round"
                        >
                          {link.fromInterface}
                        </text>
                        <text
                          x={toLabel.x}
                          y={toLabel.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#cbd5e1"
                          fontSize={10}
                          fontFamily="monospace"
                          paintOrder="stroke"
                          stroke="#09101f"
                          strokeWidth={3}
                          strokeLinejoin="round"
                        >
                          {link.toInterface}
                        </text>
                        {stpBlock && (
                          <g
                            transform={`translate(${x1 + dx * stpBadgeT}, ${
                              y1 + dy * stpBadgeT
                            })`}
                          >
                            <rect
                              x={-16}
                              y={-9}
                              width={32}
                              height={16}
                              rx={4}
                              fill="#431407"
                              stroke="#f97316"
                              strokeWidth={1.2}
                            />
                            <text
                              x={0}
                              y={2}
                              textAnchor="middle"
                              fill="#fdba74"
                              fontSize={9}
                              fontFamily="monospace"
                              fontWeight={700}
                            >
                              BLK
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Devices Layer */}
                  {devices.map((device) => {
                    const colors = getDeviceColors(device.type);
                    const isSelected = device.id === selectedDeviceId;
                    const ipLabel = getDeviceDisplayIp(device);
                    const isHopTarget = currentHop?.deviceId === device.id;
                    const deviceHsrp = hsrpEntries.find(
                      (e) =>
                        e.deviceId === device.id &&
                        (e.state === "Active" || e.state === "Standby"),
                    );

                    return (
                      <g
                        key={device.id}
                        transform={`translate(${device.position.x}, ${device.position.y})`}
                        role="button"
                        tabIndex={0}
                        aria-label={`${device.hostname} (${colors.label}) をCLIで操作`}
                        onClick={() => onSelectDevice(device.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelectDevice(device.id);
                          }
                        }}
                        className="cursor-pointer focus:outline-none"
                      >
                        {/* Active Selection Halo */}
                        {isSelected && (
                          <circle
                            cx={0}
                            cy={0}
                            r={32}
                            fill="rgba(34, 211, 238, 0.08)"
                            stroke="#22d3ee"
                            strokeWidth={2}
                            strokeDasharray="4 3"
                          />
                        )}

                        {/* Current Trace Hop Ring */}
                        {isHopTarget && currentHop && (
                          <circle
                            cx={0}
                            cy={0}
                            r={36}
                            fill="none"
                            stroke={getHopColor(currentHop)}
                            strokeWidth={2}
                            strokeOpacity={0.8}
                          />
                        )}

                        {renderDeviceSymbol(device, colors.stroke, colors.fill)}

                        {isSelected && (
                          <g transform="translate(0, -39)">
                            <rect
                              x={-31}
                              y={-9}
                              width={62}
                              height={16}
                              rx={8}
                              fill="#083344"
                              stroke="#22d3ee"
                              strokeWidth={1}
                            />
                            <text
                              x={0}
                              y={2}
                              textAnchor="middle"
                              fill="#67e8f9"
                              fontSize={9}
                              fontFamily="monospace"
                              fontWeight={600}
                            >
                              CLI接続中
                            </text>
                          </g>
                        )}

                        <text
                          x={0}
                          y={36}
                          textAnchor="middle"
                          fill="#f1f5f9"
                          fontSize={12}
                          fontFamily="monospace"
                          fontWeight={700}
                        >
                          {device.hostname}
                        </text>

                        {ipLabel && (
                          <text
                            x={0}
                            y={50}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize={10}
                            fontFamily="monospace"
                          >
                            {ipLabel}
                          </text>
                        )}

                        {deviceHsrp && (
                          <g transform={`translate(0, ${ipLabel ? 63 : 49})`}>
                            <rect
                              x={-35}
                              y={-8}
                              width={70}
                              height={15}
                              rx={7}
                              fill={
                                deviceHsrp.state === "Active"
                                  ? "#064e3b"
                                  : "#451a03"
                              }
                              stroke={
                                deviceHsrp.state === "Active"
                                  ? "#10b981"
                                  : "#f59e0b"
                              }
                              strokeWidth={1}
                            />
                            <text
                              x={0}
                              y={2}
                              textAnchor="middle"
                              fill={
                                deviceHsrp.state === "Active"
                                  ? "#6ee7b7"
                                  : "#fcd34d"
                              }
                              fontSize={8.5}
                              fontFamily="monospace"
                              fontWeight={700}
                            >
                              HSRP {deviceHsrp.state === "Active" ? "ACT" : "STBY"}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Animated Packet Token */}
                  {currentHop && currentHopDevice && initialHopDevice && (
                    <motion.g
                      initial={{
                        x: initialHopDevice.position.x,
                        y: initialHopDevice.position.y,
                      }}
                      animate={{
                        x: currentHopDevice.position.x,
                        y: currentHopDevice.position.y,
                      }}
                      transition={{ duration: 0.45, ease: "easeInOut" }}
                    >
                      <circle
                        cx={0}
                        cy={-26}
                        r={12}
                        fill={getHopColor(currentHop)}
                        fillOpacity={0.22}
                      />
                      <circle
                        cx={0}
                        cy={-26}
                        r={7}
                        fill={getHopColor(currentHop)}
                        stroke="#05080f"
                        strokeWidth={2}
                      />
                      <text
                        x={0}
                        y={-23}
                        textAnchor="middle"
                        fill="#05080f"
                        fontSize={8}
                        fontFamily="monospace"
                        fontWeight={800}
                      >
                        {currentHop.status === "error"
                          ? "!"
                          : currentHop.direction === "reply" ||
                              currentHop.direction === "dns-response"
                            ? "R"
                            : "P"}
                      </text>
                    </motion.g>
                  )}

                  {/* NAT Translation Callout Pill */}
                  {currentHop?.natTranslation && (
                    <g
                      transform={`translate(${Math.min(bubbleX, 390)}, ${
                        showErrorBubble ? Math.max(10, bubbleY - 48) : bubbleY
                      })`}
                    >
                      <rect
                        width={270}
                        height={40}
                        rx={8}
                        fill="#062231"
                        stroke="#22d3ee"
                        strokeWidth={1.5}
                      />
                      <text
                        x={10}
                        y={16}
                        fill="#67e8f9"
                        fontSize={10}
                        fontFamily="monospace"
                        fontWeight={700}
                      >
                        NAPT TRANSLATION ({currentHop.hostname})
                      </text>
                      <text
                        x={10}
                        y={32}
                        fill="#cffafe"
                        fontSize={10.5}
                        fontFamily="monospace"
                      >
                        {currentHop.natTranslation.beforeIp}
                        {currentHop.natTranslation.beforePort !== undefined
                          ? `:${currentHop.natTranslation.beforePort}`
                          : ""}{" "}
                        → {currentHop.natTranslation.afterIp}
                        {currentHop.natTranslation.afterPort !== undefined
                          ? `:${currentHop.natTranslation.afterPort}`
                          : ""}
                      </text>
                    </g>
                  )}

                  {/* Failure Callout Bubble */}
                  {showErrorBubble && currentHop && (
                    <g transform={`translate(${Math.min(bubbleX, 375)}, ${bubbleY})`}>
                      <rect
                        width={290}
                        height={54}
                        rx={8}
                        fill="#2a0a16"
                        stroke="#f43f5e"
                        strokeWidth={1.5}
                      />
                      <text
                        x={10}
                        y={19}
                        fill="#fda4af"
                        fontSize={10}
                        fontFamily="monospace"
                        fontWeight={700}
                      >
                        ERROR:{" "}
                        {(currentHop.errorReason ?? activeTrace.failureReason ?? "").slice(0, 38)}
                      </text>
                      <text
                        x={10}
                        y={37}
                        fill="#ffe4e6"
                        fontSize={10}
                        fontFamily="sans-serif"
                      >
                        {currentHop.action.length > 36
                          ? `${currentHop.action.slice(0, 36)}...`
                          : currentHop.action}
                      </text>
                    </g>
                  )}
                </svg>
              </div>

              {/* Trace Telemetry Strip */}
              <div className="border-t border-slate-800/90 bg-[#090e1a] px-4 py-3">
                {activeTrace ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {activeTrace.success ? (
                          <Badge variant="emerald">
                            <CheckCircle2 className="h-3 w-3" />
                            通信成功 ({activeTrace.protocol.toUpperCase()})
                          </Badge>
                        ) : (
                          <Badge variant="rose">
                            <AlertTriangle className="h-3 w-3" />
                            失敗: {activeTrace.failureReason}
                          </Badge>
                        )}
                        <span className="font-mono text-xs text-slate-300">
                          Target: {activeTrace.targetInput}
                          {activeTrace.resolvedIp &&
                          activeTrace.resolvedIp !== activeTrace.targetInput
                            ? ` (${activeTrace.resolvedIp})`
                            : ""}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {hops.length > 0 && (
                          <span className="font-mono text-[11px] text-slate-400">
                            Hop {clampedIndex + 1}/{hops.length}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={onReplayTrace}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-[11px] text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-cyan-200"
                        >
                          <RotateCw className="h-3 w-3" />
                          再生
                        </button>
                      </div>
                    </div>

                    {currentHop && (
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={cn(
                            "rounded-md border px-3 py-1.5 font-mono text-xs",
                            currentHop.status === "error"
                              ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                              : "border-slate-800 bg-[#05080f] text-slate-300",
                          )}
                        >
                          [{currentHop.layer} / {currentHop.hostname}]{" "}
                          {currentHop.action}
                        </p>
                        {currentHop.natTranslation && (
                          <span className="inline-flex items-center rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 font-mono text-xs font-medium text-cyan-200">
                            NAT:{" "}
                            {currentHop.natTranslation.beforeIp}
                            {currentHop.natTranslation.beforePort !== undefined
                              ? `:${currentHop.natTranslation.beforePort}`
                              : ""}{" "}
                            → {currentHop.natTranslation.afterIp}
                            {currentHop.natTranslation.afterPort !== undefined
                              ? `:${currentHop.natTranslation.afterPort}`
                              : ""}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Per-Hop Packet Header Dissector */}
                    {inspectedHops.length > 0 && activeInspected && (
                      <div className="mt-2 rounded-lg border border-slate-800 bg-[#05080f] p-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-cyan-300">
                            <Layers className="h-3.5 w-3.5" />
                            <span>
                              ホップ別パケットヘッダ分解インスペクタ (L2 / L3 / L4)
                            </span>
                            {isManualInspect && (
                              <Badge variant="amber">検査固定中</Badge>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setInspectorOpen((prev) => !prev)}
                            className="inline-flex items-center gap-1 rounded border border-slate-800 bg-[#090e1a] px-2 py-0.5 font-mono text-[10px] text-slate-300 hover:border-cyan-500/50"
                          >
                            {inspectorOpen ? (
                              <>
                                <ChevronUp className="h-3 w-3" />
                                <span>折りたたむ</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3" />
                                <span>ヘッダ展開</span>
                              </>
                            )}
                          </button>
                        </div>

                        {inspectorOpen && (
                          <div className="mt-2.5 space-y-2.5">
                            {/* Hop Selector Chips */}
                            <div
                              role="group"
                              aria-label="検査するホップを選択"
                              className="flex flex-wrap gap-1.5"
                            >
                              {inspectedHops.map((item, idx) => {
                                const selectedHop = idx === clampedIndex;
                                return (
                                  <button
                                    key={`${item.hop.step}-${item.hop.deviceId}`}
                                    type="button"
                                    aria-pressed={selectedHop}
                                    onClick={() => onSelectHop(idx)}
                                    className={cn(
                                      "rounded border px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors",
                                      selectedHop
                                        ? item.hop.status === "error"
                                          ? "border-rose-400 bg-rose-500/20 text-rose-100"
                                          : "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                                        : item.hop.status === "error"
                                          ? "border-rose-500/40 bg-rose-500/5 text-rose-300 hover:bg-rose-500/15"
                                          : "border-slate-800 bg-[#090e1a] text-slate-400 hover:border-slate-700 hover:text-slate-200",
                                    )}
                                  >
                                    #{idx + 1} {item.hop.hostname}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Educational Mutation Summary */}
                            <p className="rounded border border-cyan-500/25 bg-cyan-500/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-cyan-100">
                              {activeInspected.mutationSummary}
                            </p>

                            {/* 3-Column L2 / L3 / L4 Breakdown */}
                            <div className="grid gap-2 sm:grid-cols-3">
                              {/* L2 Box */}
                              <div className="rounded border border-slate-800 bg-[#080d19] p-2 font-mono text-[10px]">
                                <p className="mb-1 font-bold text-amber-300">
                                  L2 Ethernet / 802.1Q
                                </p>
                                <div className="space-y-0.5 text-slate-300">
                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="text-slate-500">SrcMAC:</span>
                                    <span className="flex items-center gap-1">
                                      <span>{activeInspected.headers.l2.srcMac}</span>
                                      {activeInspected.changedFields.includes("srcMac") && (
                                        <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-200">
                                          書換
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="text-slate-500">DstMAC:</span>
                                    <span className="flex items-center gap-1">
                                      <span>{activeInspected.headers.l2.dstMac}</span>
                                      {activeInspected.changedFields.includes("dstMac") && (
                                        <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-200">
                                          書換
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="text-slate-500">Tag:</span>
                                    <span className="flex items-center gap-1">
                                      <span>{activeInspected.headers.l2.vlanTag}</span>
                                      {activeInspected.changedFields.includes("vlanTag") && (
                                        <span className="rounded bg-cyan-500/20 px-1 text-[9px] font-bold text-cyan-200">
                                          タグ
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* L3 Box */}
                              <div className="rounded border border-slate-800 bg-[#080d19] p-2 font-mono text-[10px]">
                                <p className="mb-1 font-bold text-cyan-300">
                                  L3 IPv4
                                </p>
                                <div className="space-y-0.5 text-slate-300">
                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="text-slate-500">SrcIP:</span>
                                    <span className="flex items-center gap-1">
                                      <span>{activeInspected.headers.l3.srcIp}</span>
                                      {activeInspected.changedFields.includes("srcIp") && (
                                        <span className="rounded bg-cyan-500/25 px-1 text-[9px] font-bold text-cyan-200">
                                          NAT
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="text-slate-500">DstIP:</span>
                                    <span className="flex items-center gap-1">
                                      <span>{activeInspected.headers.l3.dstIp}</span>
                                      {activeInspected.changedFields.includes("dstIp") && (
                                        <span className="rounded bg-cyan-500/25 px-1 text-[9px] font-bold text-cyan-200">
                                          NAT
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="text-slate-500">TTL:</span>
                                    <span className="flex items-center gap-1">
                                      <span>
                                        {activeInspected.headers.l3.ttl ?? "-"}
                                      </span>
                                      {activeInspected.changedFields.includes("ttl") && (
                                        <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-200">
                                          -1
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* L4 / L7 Box */}
                              <div className="rounded border border-slate-800 bg-[#080d19] p-2 font-mono text-[10px]">
                                <p className="mb-1 font-bold text-violet-300">
                                  L4 ({activeInspected.headers.l4.protocol}) / L7
                                </p>
                                <div className="space-y-0.5 text-slate-300">
                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="text-slate-500">Port:</span>
                                    <span className="flex items-center gap-1">
                                      <span>
                                        {activeInspected.headers.l4.srcPort !== null
                                          ? `:${activeInspected.headers.l4.srcPort} → :${activeInspected.headers.l4.dstPort ?? "-"}`
                                          : activeInspected.headers.l4.detail}
                                      </span>
                                      {(activeInspected.changedFields.includes("srcPort") ||
                                        activeInspected.changedFields.includes("dstPort")) && (
                                        <span className="rounded bg-cyan-500/25 px-1 text-[9px] font-bold text-cyan-200">
                                          NAT
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="truncate text-slate-400">
                                    {activeInspected.headers.l4.detail}
                                  </div>
                                  <div className="truncate text-slate-400">
                                    {activeInspected.headers.l7.summary}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="font-mono text-xs text-slate-500">
                    ping / traceroute / nslookup を実行すると、ここにパケットのホップ経路と成否がアニメーション表示されます。
                  </p>
                )}
              </div>
            </>
          );
        }}
      </TraceAnimator>
    </div>
  );
}
