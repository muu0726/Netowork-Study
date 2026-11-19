import { beforeEach, describe, expect, it } from "vitest";
import { useLearningStore } from "./useLearningStore";

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
});
