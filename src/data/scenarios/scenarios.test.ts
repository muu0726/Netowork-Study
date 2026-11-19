import { describe, expect, it } from "vitest";
import { SCENARIOS_META } from "@/data/curriculum-meta";
import { evaluateScenario, executeCommand } from "@/lib/network-engine";
import { ALL_SCENARIOS } from "./index";

describe("data-driven scenarios", () => {
  it("matches SCENARIOS_META IDs and maintains JSON-serializable initialState", () => {
    const metaIds = SCENARIOS_META.map((m) => m.id).sort();
    const scenarioIds = ALL_SCENARIOS.map((s) => s.id).sort();

    expect(scenarioIds).toEqual(metaIds);

    for (const scenario of ALL_SCENARIOS) {
      const roundTripped = JSON.parse(JSON.stringify(scenario.initialState));
      expect(roundTripped).toEqual(scenario.initialState);
      expect(scenario.hints).toHaveLength(3);
      expect(scenario.goals.length).toBeGreaterThan(0);
    }
  });

  it.each(ALL_SCENARIOS)(
    "fails initialState and passes after executing solutionCommands ($id)",
    (scenario) => {
      const initialEval = evaluateScenario(scenario.initialState, scenario);
      expect(initialEval.passed).toBe(false);

      let state = scenario.initialState;
      for (const deviceSol of scenario.solutionCommands) {
        for (const cmd of deviceSol.commands) {
          state = executeCommand(state, deviceSol.deviceId, cmd).nextState;
        }
      }

      const finalEval = evaluateScenario(state, scenario);
      expect(finalEval.passed).toBe(true);
      expect(finalEval.passedCount).toBe(finalEval.totalCount);
    },
  );
});
