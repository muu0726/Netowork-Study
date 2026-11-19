import { notFound } from "next/navigation";
import { LessonArticleClient } from "@/components/learn/LessonArticleClient";
import {
  ALL_LESSONS,
  getAdjacentLessons,
  getLessonByRoute,
} from "@/data/lessons";

export function generateStaticParams() {
  return ALL_LESSONS.map((lesson) => ({
    stage: lesson.stage,
    slug: lesson.slug,
  }));
}

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ stage: string; slug: string }>;
}) {
  const { stage, slug } = await params;
  const lesson = getLessonByRoute(stage, slug);

  if (!lesson) {
    notFound();
  }

  const { prev, next } = getAdjacentLessons(lesson.stage, lesson.slug);

  return (
    <LessonArticleClient
      lesson={lesson}
      prevLesson={
        prev
          ? { stage: prev.stage, slug: prev.slug, title: prev.title }
          : null
      }
      nextLesson={
        next
          ? { stage: next.stage, slug: next.slug, title: next.title }
          : null
      }
    />
  );
}
