import type { StageId } from "@/data/curriculum-meta";
import { STAGE1_LESSONS } from "./stage1";
import { STAGE2_LESSONS } from "./stage2";
import { STAGE3_LESSONS } from "./stage3";
import type { LessonArticle } from "./types";

export * from "./types";

export const ALL_LESSONS: LessonArticle[] = [
  ...STAGE1_LESSONS,
  ...STAGE2_LESSONS,
  ...STAGE3_LESSONS,
];

export function getLessonsForStage(stage: StageId): LessonArticle[] {
  return ALL_LESSONS.filter((lesson) => lesson.stage === stage);
}

export function getLessonByRoute(
  stage: string,
  slug: string,
): LessonArticle | undefined {
  return ALL_LESSONS.find(
    (lesson) => lesson.stage === stage && lesson.slug === slug,
  );
}

export function getAdjacentLessons(
  stage: StageId,
  slug: string,
): { prev: LessonArticle | null; next: LessonArticle | null } {
  const index = ALL_LESSONS.findIndex(
    (lesson) => lesson.stage === stage && lesson.slug === slug,
  );
  if (index === -1) {
    return { prev: null, next: null };
  }
  return {
    prev: index > 0 ? ALL_LESSONS[index - 1] : null,
    next: index + 1 < ALL_LESSONS.length ? ALL_LESSONS[index + 1] : null,
  };
}
