import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export interface QuizScoreRecord {
  score: number;
  total: number;
  bestScore: number;
  updatedAt: string;
}

export interface DrillStatRecord {
  solved: number;
  attempted: number;
  bestStreak: number;
}

export interface DomainExamRecord {
  correct: number;
  total: number;
}

export interface PersistedLearningState {
  completedLessonIds: string[];
  completedScenarioIds: string[];
  quizScores: Record<string, QuizScoreRecord>;
  drillStats: Record<string, DrillStatRecord>;
  diagnosticDomainScores?: Record<string, DomainExamRecord>;
  lastVisitedPath: string | null;
}

export const PROGRESS_BACKUP_VERSION = 1;

export interface LearningProgressBackup {
  version: number;
  exportedAt: string;
  data: PersistedLearningState;
}

export interface ProgressBackupSummary {
  completedLessons: number;
  completedScenarios: number;
  quizCount: number;
  drillSolved: number;
}

export function serializeLearningProgress(state: PersistedLearningState): string {
  const payload: LearningProgressBackup = {
    version: PROGRESS_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      completedLessonIds: [...new Set(state.completedLessonIds)],
      completedScenarioIds: [...new Set(state.completedScenarioIds)],
      quizScores: state.quizScores ?? {},
      drillStats: state.drillStats ?? {},
      diagnosticDomainScores: state.diagnosticDomainScores ?? {},
      lastVisitedPath: state.lastVisitedPath ?? null,
    },
  };
  return JSON.stringify(payload, null, 2);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) {
      return null;
    }
    if (!seen.has(item)) {
      seen.add(item);
      unique.push(item);
    }
  }
  return unique;
}

export function parseLearningProgressBackup(
  raw: string,
):
  | { ok: true; data: PersistedLearningState; summary: ProgressBackupSummary }
  | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "JSONデータが入力されていません。" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      ok: false,
      error: "JSONの構文が正しくありません。エクスポートしたJSONファイルをそのまま指定してください。",
    };
  }

  if (!isPlainRecord(parsed)) {
    return { ok: false, error: "バックアップJSONの形式が不正です。" };
  }

  let rawData: Record<string, unknown> = parsed;
  if ("data" in parsed || "version" in parsed) {
    if (parsed.version !== PROGRESS_BACKUP_VERSION) {
      return {
        ok: false,
        error: `非対応のバックアップバージョンです (version: ${String(parsed.version)})。`,
      };
    }
    if (!isPlainRecord(parsed.data)) {
      return { ok: false, error: "バックアップの data フィールドが不正です。" };
    }
    rawData = parsed.data;
  }

  const completedLessonIds = sanitizeStringArray(rawData.completedLessonIds);
  const completedScenarioIds = sanitizeStringArray(rawData.completedScenarioIds);
  if (!completedLessonIds || !completedScenarioIds) {
    return {
      ok: false,
      error: "completedLessonIds / completedScenarioIds が不正です。",
    };
  }

  if (!isPlainRecord(rawData.quizScores) || !isPlainRecord(rawData.drillStats)) {
    return {
      ok: false,
      error: "quizScores または drillStats が不正です。",
    };
  }

  const quizScores: Record<string, QuizScoreRecord> = {};
  for (const [k, v] of Object.entries(rawData.quizScores)) {
    if (
      !isPlainRecord(v) ||
      typeof v.score !== "number" ||
      typeof v.total !== "number" ||
      typeof v.bestScore !== "number" ||
      !Number.isFinite(v.score) ||
      !Number.isFinite(v.total) ||
      !Number.isFinite(v.bestScore) ||
      v.total < 0
    ) {
      return { ok: false, error: `quizScores["${k}"] の値が不正です。` };
    }
    quizScores[k] = {
      score: Math.max(0, Math.min(v.score, v.total)),
      total: v.total,
      bestScore: Math.max(0, Math.min(v.bestScore, v.total)),
      updatedAt:
        typeof v.updatedAt === "string"
          ? v.updatedAt
          : new Date().toISOString(),
    };
  }

  const drillStats: Record<string, DrillStatRecord> = {};
  for (const [k, v] of Object.entries(rawData.drillStats)) {
    if (
      !isPlainRecord(v) ||
      typeof v.solved !== "number" ||
      typeof v.attempted !== "number" ||
      typeof v.bestStreak !== "number" ||
      v.solved < 0 ||
      v.attempted < 0 ||
      v.bestStreak < 0
    ) {
      return { ok: false, error: `drillStats["${k}"] の値が不正です。` };
    }
    drillStats[k] = {
      solved: v.solved,
      attempted: v.attempted,
      bestStreak: v.bestStreak,
    };
  }

  const diagnosticDomainScores: Record<string, DomainExamRecord> = {};
  if (rawData.diagnosticDomainScores !== undefined) {
    if (!isPlainRecord(rawData.diagnosticDomainScores)) {
      return { ok: false, error: "diagnosticDomainScores の形式が不正です。" };
    }
    for (const [k, v] of Object.entries(rawData.diagnosticDomainScores)) {
      if (
        !isPlainRecord(v) ||
        typeof v.correct !== "number" ||
        typeof v.total !== "number" ||
        v.correct < 0 ||
        v.total < 0
      ) {
        return {
          ok: false,
          error: `diagnosticDomainScores["${k}"] の値が不正です。`,
        };
      }
      diagnosticDomainScores[k] = {
        correct: Math.min(v.correct, v.total),
        total: v.total,
      };
    }
  }

  const lastVisitedPath =
    rawData.lastVisitedPath === null || rawData.lastVisitedPath === undefined
      ? null
      : typeof rawData.lastVisitedPath === "string"
        ? rawData.lastVisitedPath
        : null;

  const data: PersistedLearningState = {
    completedLessonIds,
    completedScenarioIds,
    quizScores,
    drillStats,
    diagnosticDomainScores,
    lastVisitedPath,
  };

  const drillSolved = Object.values(drillStats).reduce(
    (sum, s) => sum + s.solved,
    0,
  );

  return {
    ok: true,
    data,
    summary: {
      completedLessons: completedLessonIds.length,
      completedScenarios: completedScenarioIds.length,
      quizCount: Object.keys(quizScores).length,
      drillSolved,
    },
  };
}

export interface LearningStoreState extends PersistedLearningState {
  _hasHydrated: boolean;
  markLessonCompleted: (lessonId: string) => void;
  toggleLessonCompleted: (lessonId: string) => void;
  markScenarioCompleted: (scenarioId: string) => void;
  recordQuizScore: (quizId: string, score: number, total: number) => void;
  recordDrillAttempt: (
    drillId: string,
    isCorrect: boolean,
    currentStreak?: number,
  ) => void;
  recordDiagnosticResult: (
    domainScores: Record<string, DomainExamRecord>,
  ) => void;
  setLastVisitedPath: (path: string) => void;
  importProgress: (data: PersistedLearningState) => void;
  resetProgress: () => void;
  setHasHydrated: (hydrated: boolean) => void;
}

const initialPersistedState: PersistedLearningState = {
  completedLessonIds: [],
  completedScenarioIds: [],
  quizScores: {},
  drillStats: {},
  diagnosticDomainScores: {},
  lastVisitedPath: null,
};

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function getSafeStorage(): StateStorage {
  if (typeof window === "undefined") {
    return noopStorage;
  }
  try {
    return window.localStorage;
  } catch {
    return noopStorage;
  }
}

export const useLearningStore = create<LearningStoreState>()(
  persist(
    (set) => ({
      ...initialPersistedState,
      _hasHydrated: false,

      markLessonCompleted: (lessonId) =>
        set((state) => {
          if (state.completedLessonIds.includes(lessonId)) {
            return state;
          }
          return {
            completedLessonIds: [...state.completedLessonIds, lessonId],
          };
        }),

      toggleLessonCompleted: (lessonId) =>
        set((state) => {
          const exists = state.completedLessonIds.includes(lessonId);
          return {
            completedLessonIds: exists
              ? state.completedLessonIds.filter((id) => id !== lessonId)
              : [...state.completedLessonIds, lessonId],
          };
        }),

      markScenarioCompleted: (scenarioId) =>
        set((state) => {
          if (state.completedScenarioIds.includes(scenarioId)) {
            return state;
          }
          return {
            completedScenarioIds: [...state.completedScenarioIds, scenarioId],
          };
        }),

      recordQuizScore: (quizId, score, total) =>
        set((state) => {
          const prev = state.quizScores[quizId];
          const clampedScore = Math.max(0, Math.min(score, total));
          const bestScore = prev
            ? Math.max(prev.bestScore, clampedScore)
            : clampedScore;

          return {
            quizScores: {
              ...state.quizScores,
              [quizId]: {
                score: clampedScore,
                total,
                bestScore,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      recordDrillAttempt: (drillId, isCorrect, currentStreak = 0) =>
        set((state) => {
          const prev = state.drillStats[drillId] ?? {
            solved: 0,
            attempted: 0,
            bestStreak: 0,
          };
          const nextSolved = prev.solved + (isCorrect ? 1 : 0);
          const nextStreakCandidate = isCorrect
            ? Math.max(currentStreak, 1)
            : 0;

          return {
            drillStats: {
              ...state.drillStats,
              [drillId]: {
                solved: nextSolved,
                attempted: prev.attempted + 1,
                bestStreak: Math.max(prev.bestStreak, nextStreakCandidate),
              },
            },
          };
        }),

      recordDiagnosticResult: (domainScores) =>
        set((state) => ({
          diagnosticDomainScores: {
            ...(state.diagnosticDomainScores ?? {}),
            ...domainScores,
          },
        })),

      setLastVisitedPath: (path) =>
        set(() => ({
          lastVisitedPath: path,
        })),

      importProgress: (data) =>
        set(() => ({
          completedLessonIds: [...new Set(data.completedLessonIds)],
          completedScenarioIds: [...new Set(data.completedScenarioIds)],
          quizScores: data.quizScores ?? {},
          drillStats: data.drillStats ?? {},
          diagnosticDomainScores: data.diagnosticDomainScores ?? {},
          lastVisitedPath: data.lastVisitedPath ?? null,
        })),

      resetProgress: () =>
        set(() => ({
          ...initialPersistedState,
        })),

      setHasHydrated: (hydrated) =>
        set(() => ({
          _hasHydrated: hydrated,
        })),
    }),
    {
      name: "netforge-learning-progress-v1",
      storage: createJSONStorage(getSafeStorage),
      partialize: (state): PersistedLearningState => ({
        completedLessonIds: state.completedLessonIds,
        completedScenarioIds: state.completedScenarioIds,
        quizScores: state.quizScores,
        drillStats: state.drillStats,
        diagnosticDomainScores: state.diagnosticDomainScores ?? {},
        lastVisitedPath: state.lastVisitedPath,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
          return;
        }
        queueMicrotask(() => {
          useLearningStore.getState().setHasHydrated(true);
        });
      },
    },
  ),
);
