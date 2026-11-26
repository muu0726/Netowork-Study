import { describe, expect, it } from "vitest";
import { CHEAT_SHEET_SECTIONS } from "@/data/cheatsheet";
import {
  CLOUD_SCENARIOS_META,
  LESSONS_META,
  SCENARIOS_META,
  TOOLS_META,
} from "@/data/curriculum-meta";
import { buildGlobalSearchIndex, searchGlobalItems } from "./global-search";

describe("Global Search Index & Command Palette Filtering", () => {
  it("indexes all lessons, scenarios, cloud labs, tools, exam, and CLI commands", () => {
    const index = buildGlobalSearchIndex();
    const expectedCommandCount = CHEAT_SHEET_SECTIONS.reduce(
      (sum, s) => sum + s.items.length,
      0,
    );
    const expectedTotal =
      LESSONS_META.length +
      SCENARIOS_META.length +
      CLOUD_SCENARIOS_META.length +
      TOOLS_META.length +
      2 +
      expectedCommandCount;

    expect(index.length).toBe(expectedTotal);
  });

  it("matches multi-keyword queries with deep-link URLs and filters by kind", () => {
    const naclResults = searchGlobalItems("NACL エフェメラル", "cloud");
    expect(naclResults.length).toBeGreaterThanOrEqual(1);
    expect(naclResults[0].href).toBe("/labs/cloud?scenario=cloud-nacl-ephemeral");

    const cmdResults = searchGlobalItems("systemctl nginx", "command");
    expect(cmdResults.length).toBeGreaterThanOrEqual(1);
    expect(cmdResults.some((r) => r.copyCommand === "systemctl status nginx")).toBe(
      true,
    );

    const ipv6ToolResults = searchGlobalItems("IPv6 圧縮", "tool");
    expect(ipv6ToolResults[0]?.href).toBe("/tools?tab=ipv6");

    const ospfResults = searchGlobalItems("OSPF", "all", 10);
    expect(ospfResults.length).toBeGreaterThan(0);
    expect(ospfResults.length).toBeLessThanOrEqual(10);
  });
});
