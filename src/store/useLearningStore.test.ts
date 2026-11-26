import { beforeEach, describe, expect, it } from "vitest";
import {
  parseLearningProgressBackup,
  serializeLearningProgress,
  useLearningStore,
} from "./useLearningStore";

describe("useLearningStore", () => {
  beforeEach(() => {
    useLearningStore.getState().resetProgress();
  });

  it("marks lessons completed without duplicates and toggles cleanly", () => {
    const store = useLearningStore.getState();

    store.markLessonCompleted("stage1/lan-wan");
    store.markLessonCompleted("stage1/lan-wan");
    expect(useLearningStore.getState().completedLessonIds).toEqual([
      "stage1/lan-wan",
    ]);

    store.toggleLessonCompleted("stage1/lan-wan");
    expect(useLearningStore.getState().completedLessonIds).toEqual([]);

    store.toggleLessonCompleted("stage1/osi-tcpip");
    expect(useLearningStore.getState().completedLessonIds).toEqual([
      "stage1/osi-tcpip",
    ]);
  });

  it("marks scenarios completed and deduplicates IDs", () => {
    const store = useLearningStore.getState();

    store.markScenarioCompleted("cli-basic-routing");
    store.markScenarioCompleted("cli-basic-routing");
    store.markScenarioCompleted("ts-dns-failure");

    expect(useLearningStore.getState().completedScenarioIds).toEqual([
      "cli-basic-routing",
      "ts-dns-failure",
    ]);
  });

  it("records quiz scores while preserving the highest bestScore", () => {
    const store = useLearningStore.getState();

    store.recordQuizScore("stage1/subnetting", 4, 5);
    expect(useLearningStore.getState().quizScores["stage1/subnetting"]).toMatchObject({
      score: 4,
      total: 5,
      bestScore: 4,
    });

    store.recordQuizScore("stage1/subnetting", 2, 5);
    expect(useLearningStore.getState().quizScores["stage1/subnetting"]).toMatchObject({
      score: 2,
      total: 5,
      bestScore: 4,
    });

    store.recordQuizScore("stage1/subnetting", 5, 5);
    expect(useLearningStore.getState().quizScores["stage1/subnetting"]).toMatchObject({
      score: 5,
      total: 5,
      bestScore: 5,
    });
  });

  it("tracks drill attempts, solved counts, and best streaks", () => {
    const store = useLearningStore.getState();

    store.recordDrillAttempt("subnet", true, 1);
    store.recordDrillAttempt("subnet", true, 2);
    store.recordDrillAttempt("subnet", false, 0);
    store.recordDrillAttempt("subnet", true, 1);

    expect(useLearningStore.getState().drillStats.subnet).toEqual({
      solved: 3,
      attempted: 4,
      bestStreak: 2,
    });
  });

  it("resets persisted learning progress cleanly", () => {
    const store = useLearningStore.getState();

    store.markLessonCompleted("stage1/lan-wan");
    store.markScenarioCompleted("cli-basic-routing");
    store.recordQuizScore("stage1/lan-wan", 3, 3);
    store.recordDrillAttempt("wireshark", true, 3);
    store.setLastVisitedPath("/labs/cli");

    store.resetProgress();

    const next = useLearningStore.getState();
    expect(next.completedLessonIds).toEqual([]);
    expect(next.completedScenarioIds).toEqual([]);
    expect(next.quizScores).toEqual({});
    expect(next.drillStats).toEqual({});
    expect(next.lastVisitedPath).toBeNull();
  });

  it("serializes, validates, and imports JSON progress backups safely", () => {
    const raw = serializeLearningProgress({
      completedLessonIds: ["stage1/lan-wan", "stage1/lan-wan", "stage2/acl-security"],
      completedScenarioIds: ["cli-basic-routing"],
      quizScores: {
        "stage1/lan-wan": {
          score: 3,
          total: 3,
          bestScore: 3,
          updatedAt: "2026-11-21T00:00:00.000Z",
        },
      },
      drillStats: {
        subnet: { solved: 4, attempted: 5, bestStreak: 3 },
      },
      diagnosticDomainScores: {
        fundamentals: { correct: 2, total: 2 },
      },
      lastVisitedPath: "/tools",
    });

    const parsed = parseLearningProgressBackup(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.data.completedLessonIds).toEqual([
      "stage1/lan-wan",
      "stage2/acl-security",
    ]);
    expect(parsed.summary).toEqual({
      completedLessons: 2,
      completedScenarios: 1,
      quizCount: 1,
      drillSolved: 4,
    });

    useLearningStore.getState().importProgress(parsed.data);
    expect(useLearningStore.getState().completedLessonIds).toEqual([
      "stage1/lan-wan",
      "stage2/acl-security",
    ]);
    expect(useLearningStore.getState().drillStats.subnet.solved).toBe(4);

    expect(parseLearningProgressBackup("{not-json").ok).toBe(false);
    expect(
      parseLearningProgressBackup(JSON.stringify({ version: 99, data: {} })).ok,
    ).toBe(false);
    expect(
      parseLearningProgressBackup(
        JSON.stringify({ version: 1, data: { completedLessonIds: [123] } }),
      ).ok,
    ).toBe(false);

    const baseValid = JSON.parse(raw) as {
      version: number;
      data: Record<string, unknown>;
    };
    for (const badPath of [
      "https://example.com",
      "//evil.example",
      "javascript:alert(1)",
    ]) {
      const invalid = parseLearningProgressBackup(
        JSON.stringify({
          ...baseValid,
          data: { ...baseValid.data, lastVisitedPath: badPath },
        }),
      );
      expect(invalid.ok).toBe(false);
    }
  });
});
