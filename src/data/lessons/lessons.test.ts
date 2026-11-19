import { describe, expect, it } from "vitest";
import { LESSONS_META } from "@/data/curriculum-meta";
import { ALL_LESSONS, getLessonByRoute } from "./index";

describe("structured curriculum lessons", () => {
  it("matches LESSONS_META 1-to-1 on id, stage, and slug", () => {
    expect(ALL_LESSONS).toHaveLength(LESSONS_META.length);

    for (const meta of LESSONS_META) {
      const lesson = getLessonByRoute(meta.stage, meta.slug);
      expect(lesson).toBeDefined();
      expect(lesson?.id).toBe(meta.id);
      expect(lesson?.title).toBe(meta.title);
    }
  });

  it.each(ALL_LESSONS)(
    "contains complete glossary, beginner/exam modes, and valid quizzes ($id)",
    (lesson) => {
      expect(lesson.glossary.length).toBeGreaterThanOrEqual(2);
      expect(lesson.beginnerMode.keyPoints.length).toBeGreaterThanOrEqual(2);
      expect(lesson.beginnerMode.steps.length).toBeGreaterThanOrEqual(2);
      expect(lesson.examMode.referenceTable.rows.length).toBeGreaterThanOrEqual(
        2,
      );
      expect(lesson.examMode.commandBlocks.length).toBeGreaterThanOrEqual(1);
      expect(lesson.quiz.length).toBeGreaterThanOrEqual(2);

      for (const q of lesson.quiz) {
        expect(q.choices.length).toBeGreaterThanOrEqual(3);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.choices.length);
        expect(q.explanation.length).toBeGreaterThan(0);
      }
    },
  );
});
