import { describe, expect, it } from "vitest";
import { cliBasicRoutingScenario } from "@/data/scenarios/cli-basic-routing";
import { tsLinuxNginxDownScenario } from "@/data/scenarios/ts-linux-nginx-down";
import {
  computeLineDiff,
  computeNetworkConfigDiff,
  executeCommand,
  formatDeviceConfigSnapshot,
  type NetworkState,
} from "./index";

function runCommands(
  initialState: NetworkState,
  deviceId: string,
  commands: string[],
): NetworkState {
  let state = structuredClone(initialState);
  for (const cmd of commands) {
    state = executeCommand(state, deviceId, cmd).nextState;
  }
  return state;
}

describe("Network Engine State Diff & Snapshots", () => {
  it("computes deterministic LCS line diffs cleanly", () => {
    const diff = computeLineDiff(
      ["hostname R1", "interface Gig0/0", " shutdown"],
      ["hostname R1", "interface Gig0/0", " ip address 10.0.0.1 255.255.255.252"],
    );

    expect(diff).toEqual([
      { type: "unchanged", line: "hostname R1" },
      { type: "unchanged", line: "interface Gig0/0" },
      { type: "removed", line: " shutdown" },
      { type: "added", line: " ip address 10.0.0.1 255.255.255.252" },
    ]);
  });

  it("tracks Cisco IOS configuration changes across executeCommand and resets diff to zero when reverted", () => {
    const initial = cliBasicRoutingScenario.initialState;
    const baselineDiff = computeNetworkConfigDiff(initial, initial);
    expect(baselineDiff.changedDeviceCount).toBe(0);
    expect(baselineDiff.totalAdded).toBe(0);
    expect(baselineDiff.totalRemoved).toBe(0);

    const updated = runCommands(initial, "r1", [
      "enable",
      "configure terminal",
      "interface Gig0/1",
      "ip address 10.0.0.1 255.255.255.252",
      "no shutdown",
      "exit",
      "ip route 192.168.20.0 255.255.255.0 10.0.0.2",
      "end",
    ]);

    const afterDiff = computeNetworkConfigDiff(initial, updated);
    expect(afterDiff.changedDeviceCount).toBe(1);
    expect(afterDiff.totalAdded).toBeGreaterThanOrEqual(2);
    expect(afterDiff.totalRemoved).toBeGreaterThanOrEqual(1);

    const r1Diff = afterDiff.devices.find((d) => d.deviceId === "r1");
    expect(r1Diff?.hasChanges).toBe(true);
    expect(
      r1Diff?.lines.some(
        (l) =>
          l.type === "added" &&
          l.line === "ip route 192.168.20.0 255.255.255.0 10.0.0.2",
      ),
    ).toBe(true);
    expect(
      r1Diff?.lines.some(
        (l) => l.type === "removed" && l.line === " shutdown",
      ),
    ).toBe(true);
  });

  it("snapshots Linux host service state transitions cleanly", () => {
    const initial = tsLinuxNginxDownScenario.initialState;
    const srvBefore = formatDeviceConfigSnapshot(initial.devices["srv-web"]);
    expect(srvBefore).toContain("service nginx inactive (tcp/80)");

    const started = runCommands(initial, "srv-web", ["systemctl start nginx"]);
    const diff = computeNetworkConfigDiff(initial, started);
    expect(diff.changedDeviceCount).toBe(1);
    const srvDiff = diff.devices.find((d) => d.deviceId === "srv-web");
    expect(
      srvDiff?.lines.some(
        (l) => l.type === "removed" && l.line === "service nginx inactive (tcp/80)",
      ),
    ).toBe(true);
    expect(
      srvDiff?.lines.some(
        (l) => l.type === "added" && l.line === "service nginx active (tcp/80)",
      ),
    ).toBe(true);
  });
});
