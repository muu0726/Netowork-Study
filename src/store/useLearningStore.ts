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
