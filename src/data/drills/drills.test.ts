import { describe, expect, it } from "vitest";
import { CONFIG_REVIEW_CASES } from "./config-review-cases";
import { WIRESHARK_DRILL_CASES } from "./wireshark-cases";

describe("practical drill cases", () => {
  it("validates Wireshark drill cases and packet target references", () => {
    expect(WIRESHARK_DRILL_CASES).toHaveLength(3);

    for (const c of WIRESHARK_DRILL_CASES) {
      const nos = c.packets.map((p) => p.no);
      expect(nos).toContain(c.targetPacketNo);
      for (const validNo of c.validPacketNos) {
        expect(nos).toContain(validNo);
      }
      expect(c.correctOptionIndex).toBeGreaterThanOrEqual(0);
      expect(c.correctOptionIndex).toBeLessThan(c.options.length);
      expect(c.explanation.length).toBeGreaterThan(0);
    }
  });

  it("validates config review drill cases", () => {
    expect(CONFIG_REVIEW_CASES).toHaveLength(3);

    for (const c of CONFIG_REVIEW_CASES) {
      expect(c.correctOptionIndex).toBeGreaterThanOrEqual(0);
      expect(c.correctOptionIndex).toBeLessThan(c.options.length);
      expect(c.explanation.length).toBeGreaterThan(0);
      expect(c.fixedSnippet.length).toBeGreaterThan(0);
    }
  });
});
